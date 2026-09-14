/**
 * convex/pushReplyAuth.ts — reply-token minting/verification for
 * notification inline replies (WhatsApp-style, 2026-09-14).
 *
 * THE PROBLEM: when the user replies from the Android notification shade
 * (RemoteInput → PushReplyReceiver → POST /api/push-reply), the receiver
 * has NO session — the app may not even be running. The reply must still
 * authenticate as the right user to the right conversation.
 *
 * THE DESIGN: a short-lived, single-purpose bearer minted at PUSH TIME and
 * carried inside the FCM data payload:
 *
 *   replyToken = "v2." + b64url(payload) + "." + b64url(hmac)
 *   payload    = "v2|<userId>|<conversationId>|<expiresAtMs>"
 *
 *   - HMAC-SHA256 keyed with SHA-256(private_key of the FCM service
 *     account) — no NEW secret to configure; rotating the Firebase key
 *     rotates the reply secret (and invalidates outstanding tokens,
 *     which is the safe direction).
 *   - Bound to ONE (userId, conversationId) pair: a leaked token can
 *     only post to the conversation it was issued for, as the user it
 *     was issued to.
 *   - 24h expiry — notification replies happen within minutes; a day is
 *     generous, and the token rides a transient push payload anyway.
 *
 * RUNTIME NOTES: implemented with WebCrypto (crypto.subtle) so the SAME
 * code runs in the Node runtime (minting, from pushNotificationsNode.ts)
 * and the default Convex runtime (verifying, from http.ts). Node 18+
 * exposes crypto.subtle globally; Convex's default runtime has it natively.
 */

/** Derive the stable HMAC secret from the service account JSON. */
async function replySecret(serviceAccountJson: string): Promise<string> {
  let sa: any;
  try {
    sa = JSON.parse(serviceAccountJson);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON");
  }
  const keyMaterial = String(sa.private_key || "");
  if (!keyMaterial) throw new Error("service account has no private_key");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(keyMaterial));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecodeToString(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function hmac(secretHex: string, payload: string): Promise<string> {
  const keyBytes = new Uint8Array(secretHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return b64urlEncode(new Uint8Array(sig));
}

/** Reply tokens live 24h — notification replies happen within minutes. */
const REPLY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export async function mintReplyToken(
  serviceAccountJson: string,
  userId: string,
  conversationId: string
): Promise<string> {
  const exp = Date.now() + REPLY_TOKEN_TTL_MS;
  const payload = `v2|${userId}|${conversationId}|${exp}`;
  const sig = await hmac(await replySecret(serviceAccountJson), payload);
  return `v2.${b64urlEncode(new TextEncoder().encode(payload))}.${sig}`;
}

export interface VerifiedReplyToken {
  userId: string;
  conversationId: string;
  expiresAt: number;
}

/**
 * Verify a reply token against the expected conversation. Returns null on
 * ANY failure (bad shape, bad signature, wrong conversation, expiry).
 * Comparison is signature-first; HMAC verification makes forgery
 * computationally infeasible, so a plain equality check on the derived
 * signature is acceptable here (the input space is server-minted tokens).
 */
export async function verifyReplyToken(
  serviceAccountJson: string | undefined,
  token: unknown,
  expectedConversationId: string
): Promise<VerifiedReplyToken | null> {
  if (!serviceAccountJson || typeof token !== "string" || !token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3 || parts[0] !== "v2") return null;
    const payload = b64urlDecodeToString(parts[1]);
    const segs = payload.split("|");
    if (segs.length !== 4 || segs[0] !== "v2") return null;
    const [, userId, conversationId, expStr] = segs;
    const expiresAt = Number(expStr);
    if (!userId || !conversationId || !Number.isFinite(expiresAt)) return null;
    if (conversationId !== expectedConversationId) return null;
    if (Date.now() > expiresAt) return null;
    const expectedSig = await hmac(await replySecret(serviceAccountJson), payload);
    if (expectedSig !== parts[2]) return null;
    return { userId, conversationId, expiresAt };
  } catch {
    return null;
  }
}
