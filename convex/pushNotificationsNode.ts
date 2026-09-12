/**
 * convex/pushNotificationsNode.ts — Node.js-only push notification dispatch.
 *
 * This file uses "use node" because FCM signing needs Node crypto APIs
 * that aren't available in Convex's default runtime.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE WAS REWRITTEN (Sept 2026 push-fix round)
 * ─────────────────────────────────────────────────────────────────────────────
 * The previous implementation had three fatal defects:
 *
 *   1. LEGACY API IS DEAD — "Method 1" posted to https://fcm.googleapis.com/fcm/send
 *      with a long-lived server key. Google shut that API down in June 2024 and
 *      stopped issuing legacy server keys entirely. If FCM_SERVER_KEY was set,
 *      EVERY push returned 401 and nothing was ever delivered.
 *
 *   2. BROKEN TAP HANDLING — the payload set clickAction: "FCM_PLUGIN_ACTIVITY",
 *      a leftover from the old cordova-plugin-firebase. No activity in
 *      AndroidManifest.xml declares that action, so tapping a background
 *      notification did nothing (the app never opened).
 *
 *   3. NON-STRING DATA PAYLOAD — FCM HTTP v1 requires every data value to be a
 *      string; the old code passed raw objects (e.g. apkUrl as an object), which
 *      the v1 API rejects with 400 INVALID_ARGUMENT.
 *
 * The fix:
 *   - Uses the FCM HTTP v1 API with an OAuth2 access token minted from the
 *     service account key (RS256 JWT via node:crypto, cached ~1h). No
 *     firebase-admin SDK import needed — plain fetch, deterministic bundle.
 *   - No clickAction → Android opens the launcher activity on tap and the
 *     Capacitor plugin fires pushNotificationActionPerformed with the data.
 *   - Data values are coerced to strings.
 *   - Stale tokens (404/UNREGISTERED) are deactivated in user_push_tokens.
 *   - sendTestPush / sendTestPushToUser live HERE as public actions so the
 *     founder/user "Send Test Push" buttons get the REAL FCM result
 *     (sent/failed/error) instead of a fire-and-forget scheduler lie.
 *
 * FIREBASE SETUP (required, one-time):
 *   Firebase Console → Project Settings → Service accounts →
 *   "Generate new private key" → download JSON → set it as the
 *   FIREBASE_SERVICE_ACCOUNT_JSON env var on the Convex deployment
 *   (npx convex env set FIREBASE_SERVICE_ACCOUNT_JSON '<json>'
 *    or Dashboard → Settings → Environment Variables).
 *   Do NOT use FCM_SERVER_KEY — that mechanism is dead.
 * ─────────────────────────────────────────────────────────────────────────────
 */
"use node";

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { createSign } from "node:crypto";

// ─── OAuth2 access token (module-level cache) ───────────────────────────────

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

function b64url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

/**
 * Mint a short-lived OAuth2 access token for FCM HTTP v1 from the
 * service-account key, signing an RS256 JWT with node:crypto.
 * Google's token endpoint exchanges the JWT for an access token.
 */
async function getAccessToken(serviceAccount: any): Promise<string> {
  if (cachedAccessToken && Date.now() < cachedAccessToken.expiresAt - 60_000) {
    return cachedAccessToken.token;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );

  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const signature = signer.sign(serviceAccount.private_key, "base64url");
  const jwt = `${header}.${claims}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }).toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `FCM OAuth token fetch failed (${res.status}): ${text.slice(0, 300)}. ` +
      `Verify FIREBASE_SERVICE_ACCOUNT_JSON is the FULL service-account JSON from ` +
      `Firebase Console → Project Settings → Service accounts → Generate new private key.`
    );
  }

  const data: any = await res.json();
  cachedAccessToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return cachedAccessToken.token;
}

/** FCM v1 requires data values to be plain strings. (exported for tests) */
export function stringifyData(data: any): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(data || {})) {
    out[key] = typeof value === "string" ? value : JSON.stringify(value ?? null);
  }
  return out;
}

const FCM_NOT_CONFIGURED_GUIDANCE =
  "FCM is not configured on this Convex deployment. Set FIREBASE_SERVICE_ACCOUNT_JSON " +
  "(Firebase Console → Project Settings → Service accounts → Generate new private key, " +
  "then Dashboard → Convex → Settings → Environment Variables, or " +
  "`npx convex env set FIREBASE_SERVICE_ACCOUNT_JSON '<json>'`). " +
  "Note: FCM_SERVER_KEY is DEAD — Google shut down the legacy FCM API in June 2024; " +
  "a service account is now required.";

// ─── Core dispatcher (shared by internal action + public test actions) ──────

export interface FcmDispatchArgs {
  tokens: string[];
  title: string;
  body: string;
  data?: any;
}

export interface FcmDispatchResult {
  success: boolean;
  sent: number;
  failed: number;
  deactivated?: number;
  reason?: string;
  error?: string;
  errors?: string[];
}

async function dispatchFcm(
  ctx: any,
  args: FcmDispatchArgs
): Promise<FcmDispatchResult> {
  if (args.tokens.length === 0) {
    return { success: true, sent: 0, failed: 0 };
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const legacyServerKey = process.env.FCM_SERVER_KEY;

  if (!serviceAccountJson) {
    if (legacyServerKey) {
      // Loud, actionable: this config can never work.
      const msg =
        "FCM_SERVER_KEY is set but the legacy FCM HTTP API was shut down by Google " +
        "(June 2024) — no push can ever be delivered with it. Remove FCM_SERVER_KEY and " +
        "set FIREBASE_SERVICE_ACCOUNT_JSON on the Convex deployment instead.";
      console.error("[push] " + msg);
      return { success: false, sent: 0, failed: args.tokens.length, reason: "LEGACY_FCM_REMOVED", error: msg };
    }
    console.error("[push] " + FCM_NOT_CONFIGURED_GUIDANCE);
    return { success: false, sent: 0, failed: args.tokens.length, reason: "FCM_NOT_CONFIGURED", error: FCM_NOT_CONFIGURED_GUIDANCE };
  }

  let serviceAccount: any;
  try {
    serviceAccount = JSON.parse(serviceAccountJson);
  } catch (err: any) {
    const msg =
      "FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON. Re-download the key from " +
      "Firebase Console → Project Settings → Service accounts and set the FULL JSON.";
    console.error("[push] " + msg);
    return { success: false, sent: 0, failed: args.tokens.length, reason: "INVALID_SERVICE_ACCOUNT", error: msg };
  }
  if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
    const msg = "FIREBASE_SERVICE_ACCOUNT_JSON is missing project_id/client_email/private_key — not a service-account key file.";
    console.error("[push] " + msg);
    return { success: false, sent: 0, failed: args.tokens.length, reason: "INVALID_SERVICE_ACCOUNT", error: msg };
  }

  try {
    const accessToken = await getAccessToken(serviceAccount);
    const project = serviceAccount.project_id;
    const data = stringifyData(args.data);

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];
    const deadTokens: string[] = [];

    // Chunked concurrency: fast enough for the 2000-token app-update fan-out,
    // gentle enough to stay well inside Convex action time limits.
    const CHUNK = 50;
    for (let i = 0; i < args.tokens.length; i += CHUNK) {
      const chunk = args.tokens.slice(i, i + CHUNK);
      await Promise.all(
        chunk.map(async (token) => {
          const message = {
            token,
            notification: { title: args.title, body: args.body },
            android: {
              priority: "HIGH",
              notification: {
                // Channel created client-side by ensureNotificationChannels()
                // BEFORE registration, so background pushes are never dropped.
                channelId: "practicepro-general",
                sound: "default",
                icon: "ic_launcher",
                priority: "PRIORITY_HIGH",
                defaultVibrateTimings: true,
                // NO clickAction: default tap opens the launcher activity and
                // the Capacitor plugin delivers pushNotificationActionPerformed.
              },
            },
            apns: {
              payload: {
                aps: { sound: "default", badge: 1 },
              },
            },
            data,
          };

          try {
            const res = await fetch(
              `https://fcm.googleapis.com/v1/projects/${project}/messages:send`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ message }),
              }
            );
            if (res.ok) {
              sent++;
              return;
            }
            const errText = await res.text();
            failed++;
            // 404 / UNREGISTERED / INVALID_ARGUMENT on the token = stale token
            if (res.status === 404 || /UNREGISTERED|SENDER_ID_MISMATCH/i.test(errText)) {
              deadTokens.push(token);
            }
            if (errors.length < 5) {
              errors.push(`FCM ${res.status}: ${errText.slice(0, 200)}`);
            }
          } catch (e: any) {
            failed++;
            if (errors.length < 5) errors.push(String(e?.message || e).slice(0, 200));
          }
        })
      );
    }

    // Token hygiene: retire tokens FCM says are gone so future sends
    // stop wasting quota on them.
    let deactivated = 0;
    for (const token of deadTokens) {
      try {
        await ctx.runMutation(internal.pushNotifications.deactivatePushToken, { token });
        deactivated++;
      } catch {}
    }

    if (errors.length) console.error("[push] FCM errors:", JSON.stringify(errors));
    console.log(`[push] FCM v1 dispatched: ${sent} sent, ${failed} failed, ${deactivated} tokens retired`);

    return {
      success: failed === 0,
      sent,
      failed,
      deactivated,
      ...(errors.length ? { errors } : {}),
    };
  } catch (err: any) {
    console.error("[push] FCM dispatch error:", err?.message);
    return { success: false, sent: 0, failed: args.tokens.length, error: String(err?.message || err) };
  }
}

// ─── Internal action — scheduled by mutations across the codebase ───────────
// (notifyAppUpdate, notifyFounders, broadcasts, …)

export const sendFcmPush = internalAction({
  args: {
    tokens: v.array(v.string()),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args): Promise<FcmDispatchResult> => {
    return dispatchFcm(ctx, args);
  },
});

// ─── Public test actions — REAL results back to the UI ─────────────────────
// These live in this file (node runtime) so they can dispatch FCM inline and
// return the actual delivery outcome, instead of scheduling fire-and-forget
// and reporting a fake success based on token count.

const NO_DEVICES_GUIDANCE =
  "No active device tokens found for your account. Tokens register automatically when you " +
  "log into the app on your Android device and grant notification permission. " +
  "IMPORTANT: the Founder APK (com.practicepro.admin) can only register with FCM after " +
  "'com.practicepro.admin' is added as an Android app in the Firebase project " +
  "(Firebase Console → Project Settings → Your apps → Add app → Android). Until then, " +
  "log into the MAIN PracticePro app on your device to register your account's token.";

/** Explicit shapes to break TS7022 circular inference (the handlers reference
 * `internal`, whose generated type transitively imports this module). */
interface PushTargetsResult {
  reason: string;
  userId?: string;
  tokens?: string[];
  message?: string;
}

interface PushTestResult {
  success: boolean;
  sent: number;
  failed: number;
  deactivated?: number;
  totalDevices?: number;
  reason?: string;
  error?: string;
  errors?: string[];
}

/**
 * action: sendTestPush — Founder-only (founder Settings → Push Diagnostics).
 * Returns the real FCM result so the founder sees exactly what happened.
 */
export const sendTestPush = action({
  args: {
    tokenIdentifier: v.string(),
    title: v.string(),
    body: v.string(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<PushTestResult> => {
    const targets: PushTargetsResult = await ctx.runQuery(
      internal.pushNotifications.getFounderPushTargets,
      { tokenIdentifier: args.tokenIdentifier, sessionToken: args.sessionToken }
    );

    if (targets.reason && targets.reason !== "OK") {
      return {
        success: false,
        sent: 0,
        failed: 0,
        totalDevices: 0,
        reason: targets.reason,
        error:
          targets.reason === "NO_REGISTERED_DEVICES"
            ? NO_DEVICES_GUIDANCE
            : targets.reason === "NOT_FOUNDER"
              ? "Unauthorized. Only Founders can send test pushes."
              : targets.reason,
      };
    }

    // Record the in-app notification (same as before, via internal mutation)
    try {
      await ctx.runMutation(internal.pushNotifications.recordInAppNotification, {
        userId: targets.userId!,
        title: args.title,
        body: args.body,
        type: "system",
      });
    } catch (err: any) {
      console.warn("[push] In-app notification write failed:", err?.message);
    }

    const result = await dispatchFcm(ctx, {
      tokens: targets.tokens!,
      title: args.title,
      body: args.body,
      data: { type: "test_push" },
    });

    return { ...result, totalDevices: targets.tokens!.length };
  },
});

/**
 * action: sendTestPushToUser — ANY authenticated user, own devices only
 * (user app → Settings → Notification Settings → Test Push).
 */
export const sendTestPushToUser = action({
  args: {
    userEmail: v.string(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<PushTestResult> => {
    const targets: PushTargetsResult = await ctx.runQuery(
      internal.pushNotifications.getUserPushTargets,
      { userEmail: args.userEmail, sessionToken: args.sessionToken }
    );

    if (targets.reason && targets.reason !== "OK") {
      return {
        success: false,
        sent: 0,
        failed: 0,
        reason: targets.reason,
        error:
          targets.reason === "NO_REGISTERED_DEVICES"
            ? NO_DEVICES_GUIDANCE
            : targets.reason === "USER_NOT_FOUND"
              ? "No account found for that email."
              : targets.reason,
      };
    }

    const result = await dispatchFcm(ctx, {
      tokens: targets.tokens!,
      title: "PracticePro Test Push",
      body: "This is a test notification from PracticePro. If you can see this, push notifications are working correctly!",
      data: { type: "test_push" },
    });

    return { ...result, totalDevices: targets.tokens!.length };
  },
});
