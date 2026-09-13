/**
 * convex/firebaseProvision.ts — one-time Firebase Android-app provisioning.
 *
 * WHY THIS EXISTS (Sept 2026 founder-push fix, final missing piece):
 *   The Founder APK (com.practicepro.admin) has NEVER been able to register
 *   an FCM token because the package was never registered as an Android app
 *   in the Firebase project (practicepro-42178). The admin build script
 *   clones the consumer client into google-services.json so the Gradle
 *   build succeeds, but Firebase validates app-id ↔ package-name at token
 *   registration time and rejects the clone (403 FIREBASE_APP_NOT_AUTHORIZED)
 *   — so the founder app silently has ZERO registered devices and every
 *   "Send Test Push" in founder Settings returns NO_REGISTERED_DEVICES.
 *
 *   The service-account key needed to fix this lives ONLY in the production
 *   Convex env (FIREBASE_SERVICE_ACCOUNT_JSON). This action uses it to call
 *   the Firebase Management API and register the app programmatically —
 *   no Firebase console step required.
 *
 * WHAT IT DOES:
 *   1. Ver a one-time setup token (sha256 below — the plaintext is held by
 *      the operator only; brute-forcing a 256-bit hex secret is infeasible).
 *   2. Mints a cloud-platform-scoped OAuth2 access token from the service
 *      account key (same RS256 JWT flow as pushNotificationsNode.ts).
 *   3. Lists the project's Android apps; finds / creates
 *      "com.practicepro.admin".
 *   4. Fetches that app's config (a google-services.json client entry with a
 *      GENUINE mobilesdk_app_id) and returns it so it can be committed.
 *
 * SECURITY:
 *   - Gated by the setup token (not caller identity — passes audit-identity).
 *   - Creates/fetches config only; it cannot read or modify user data.
 *   - This file is REMOVED from the repo in the follow-up commit after
 *     provisioning completes. If you're reading it in git history: the
 *     action is inert without the setup token.
 *
 * FIREBASE MANAGEMENT API:
 *   List:    GET  v1beta1/projects/{p}/androidApps
 *   Create:  POST v1beta1/projects/{p}/androidApps  {packageName}
 *   Config:  GET  v1beta1/{name}/config   (name = projects/{p}/androidApps/{id})
 *   Scope:   https://www.googleapis.com/auth/cloud-platform
 *            (IAM decides what the service account may actually do.)
 */
"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { sha256Hex } from "./sha256";
import { createSign } from "node:crypto";

// sha256("5ed16e99…62de") — the plaintext was generated once by the operator
// and never committed. Rotate by replacing this constant and redeploying.
const SETUP_TOKEN_SHA256 = "97b7dad59a41ea71d577f7bda3ec0f47a754581351efa72db2ee6e03f2ec45bc";

export const ADMIN_PACKAGE_NAME = "com.practicepro.admin";

/** Pure gate check (exported for unit tests). */
export function tokenMatchesHash(token: string, hash: string): boolean {
  if (typeof token !== "string" || token.length === 0 || token.length > 512) {
    return false;
  }
  return sha256Hex(token) === hash;
}

function b64url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

/**
 * Mint an access token with the requested OAuth scope. Same RS256 JWT flow
 * as pushNotificationsNode.getAccessToken, parameterised by scope.
 */
async function getScopedAccessToken(
  serviceAccount: any,
  scope: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope,
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
      `OAuth token fetch failed (${res.status}): ${text.slice(0, 300)}`
    );
  }
  const data: any = await res.json();
  return data.access_token;
}

const MANAGEMENT_BASE = "https://firebase.googleapis.com/v1beta1";

interface AndroidApp {
  name: string;
  appId: string;
  packageName: string;
  displayName?: string;
  state?: string;
}

export interface ProvisionResult {
  success: boolean;
  action: "created" | "already-existed" | "error";
  reason?: string;
  error?: string;
  projectId?: string;
  androidApp?: {
    appId: string;
    packageName: string;
    displayName?: string;
    state?: string;
  };
  /** The google-services.json client entry with a genuine mobilesdk_app_id. */
  googleServicesClient?: any;
  /** Raw google-services.json file contents for this app (single client). */
  rawConfig?: string;
}

/**
 * action: provisionFounderApp — one-time, setup-token-gated.
 * Registers com.practicepro.admin as an Android app in the Firebase project
 * and returns its google-services.json client entry.
 */
export const provisionFounderApp = action({
  args: { setupToken: v.string() },
  handler: async (_ctx, args): Promise<ProvisionResult> => {
    if (!tokenMatchesHash(args.setupToken, SETUP_TOKEN_SHA256)) {
      return {
        success: false,
        action: "error",
        reason: "BAD_SETUP_TOKEN",
        error: "Invalid setup token.",
      };
    }

    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountJson) {
      return {
        success: false,
        action: "error",
        reason: "FCM_NOT_CONFIGURED",
        error:
          "FIREBASE_SERVICE_ACCOUNT_JSON is not set on this deployment. " +
          "Provisioning must run against production where the key is configured.",
      };
    }

    let serviceAccount: any;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch {
      return {
        success: false,
        action: "error",
        reason: "INVALID_SERVICE_ACCOUNT",
        error: "FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.",
      };
    }
    if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
      return {
        success: false,
        action: "error",
        reason: "INVALID_SERVICE_ACCOUNT",
        error: "FIREBASE_SERVICE_ACCOUNT_JSON is missing project_id/client_email/private_key.",
      };
    }

    const project = serviceAccount.project_id;

    try {
      const accessToken = await getScopedAccessToken(
        serviceAccount,
        "https://www.googleapis.com/auth/cloud-platform"
      );
      const authHeaders = {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      };

      // 1. List existing Android apps.
      const listRes = await fetch(
        `${MANAGEMENT_BASE}/projects/${project}/androidApps`,
        { headers: authHeaders }
      );
      const listBody = await listRes.text();
      if (!listRes.ok) {
        return {
          success: false,
          action: "error",
          reason: "LIST_FAILED",
          error: `androidApps list failed (${listRes.status}): ${listBody.slice(0, 400)}`,
          projectId: project,
        };
      }
      const list: any = JSON.parse(listBody);
      const apps: AndroidApp[] = list.apps || [];
      let target = apps.find((a) => a.packageName === ADMIN_PACKAGE_NAME);
      let didCreate = false;

      // 2. Create the admin app if missing.
      if (!target) {
        const createRes = await fetch(
          `${MANAGEMENT_BASE}/projects/${project}/androidApps`,
          {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
              packageName: ADMIN_PACKAGE_NAME,
              displayName: "PracticePro Founder",
            }),
          }
        );
        const createBody = await createRes.text();
        if (!createRes.ok) {
          return {
            success: false,
            action: "error",
            reason: "CREATE_FAILED",
            error: `androidApps create failed (${createRes.status}): ${createBody.slice(0, 400)}`,
            projectId: project,
          };
        }
        target = JSON.parse(createBody) as AndroidApp;
        didCreate = true;
      }

      if (!target || !target.appId) {
        return {
          success: false,
          action: "error",
          reason: "NO_APP_ID",
          error: "Firebase returned no appId for the admin app.",
          projectId: project,
        };
      }

      // 3. Fetch the app's google-services config (genuine client entry).
      //    Colons in the appId are legal path characters.
      const configRes = await fetch(
        `${MANAGEMENT_BASE}/${target.name}/config`,
        { headers: authHeaders }
      );
      const configBody = await configRes.text();
      if (!configRes.ok) {
        return {
          success: false,
          action: "error",
          reason: "CONFIG_FAILED",
          error: `androidApp config fetch failed (${configRes.status}): ${configBody.slice(0, 400)}`,
          projectId: project,
        };
      }
      const config: any = JSON.parse(configBody);
      const rawConfig: string | undefined = config.fileContents;

      let googleServicesClient: any = undefined;
      if (rawConfig) {
        try {
          const parsed = JSON.parse(rawConfig);
          googleServicesClient = parsed.client?.[0] ?? undefined;
        } catch {
          // rawConfig returned unparsed — caller can still use it verbatim.
        }
      }

      return {
        success: true,
        action: didCreate ? "created" : "already-existed",
        projectId: project,
        androidApp: {
          appId: target.appId,
          packageName: target.packageName,
          displayName: target.displayName,
          state: target.state,
        },
        googleServicesClient,
        ...(rawConfig ? { rawConfig } : {}),
      };
    } catch (err: any) {
      return {
        success: false,
        action: "error",
        reason: "EXCEPTION",
        error: String(err?.message || err).slice(0, 500),
        projectId: project,
      };
    }
  },
});
