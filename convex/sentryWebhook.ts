import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

// ─── ROUND A (C7): Chakra webhook signature verification ──────────────────
// The previous check was header-PRESENCE only — any garbage value in
// X-Chakra-Signature-256 passed, and when CHAKRA_WEBHOOK_SECRET was unset
// the webhook was accepted entirely unsigned. A forged "WhatsApp from
// resident" message could be injected into a firm's inbox
// (sentry.processInboundMessage). This mirrors the established Paystack
// webhook pattern (paystack.ts handlePaystackWebhookImpl):
//   secret unset           → 503 (fail closed — same as Paystack)
//   signature missing      → 400
//   signature invalid      → 401
// The HMAC-SHA256 is computed over the RAW request body with Web Crypto
// (available in Convex actions — proven by the Paystack handler).

/** Strip an optional `sha256=` prefix (Stripe/GitHub style) from a signature header. */
export function stripSignaturePrefix(header: string): string {
  const h = String(header || "").trim();
  if (h.toLowerCase().startsWith("sha256=")) return h.slice("sha256=".length).trim();
  return h;
}

/** Constant-time string comparison (avoids leaking match length via timing). */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const A = String(a || "");
  const B = String(b || "");
  if (A.length !== B.length) {
    // Still burn a comparison pass so the cheap length check doesn't leak.
    let acc = 0;
    for (let i = 0; i < Math.max(A.length, B.length); i++) {
      acc |= (A.charCodeAt(i) || 0) ^ (B.charCodeAt(i) || 0);
    }
    return false;
  }
  let diff = 0;
  for (let i = 0; i < A.length; i++) diff |= A.charCodeAt(i) ^ B.charCodeAt(i);
  return diff === 0;
}

/** Compute the expected HMAC-SHA256 hex signature of a raw body (Web Crypto). */
export async function computeChakraSignature(secret: string, rawBody: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Pure verification helper (exported for tests): returns null when valid,
 * or a Response when the request must be rejected.
 * Order of checks mirrors the Paystack webhook: unset secret → 503,
 * missing header → 400, mismatched HMAC → 401.
 */
export async function verifyChakraWebhookRequest(
  request: Request,
  rawBody: string
): Promise<Response | null> {
  const secret = process.env.CHAKRA_WEBHOOK_SECRET;
  if (!secret) {
    // Fail closed (mirrors paystack.ts): an unconfigured secret must never
    // mean "accept unsigned". Set CHAKRA_WEBHOOK_SECRET in the Convex
    // dashboard — inbound WhatsApp requires it.
    return new Response(
      "CHAKRA_WEBHOOK_SECRET not configured — inbound webhook rejected. Set it in the Convex dashboard.",
      { status: 503 }
    );
  }
  const provided = request.headers.get("X-Chakra-Signature-256");
  if (!provided) {
    return new Response("Missing X-Chakra-Signature-256 header", { status: 400 });
  }
  const expected = await computeChakraSignature(secret, rawBody);
  const providedHex = stripSignaturePrefix(provided);
  if (!timingSafeEqualStr(providedHex.toLowerCase(), expected)) {
    return new Response("Invalid signature", { status: 401 });
  }
  return null; // verified
}

export const handleChakraWebhook = httpAction(async (ctx, request) => {
  // Chakra sends a JSON payload (not Twilio url-encoded).
  //
  // ROUND A (C7): the raw body is read ONCE here and used both for the
  // HMAC-SHA256 verification and for the JSON parse below (a body read
  // via request.json() cannot be re-read for signing).
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return new Response("Unreadable body", { status: 400 });
  }

  const rejected = await verifyChakraWebhookRequest(request, rawBody);
  if (rejected) return rejected;

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch (e) {
    return new Response("Invalid JSON", { status: 400 });
  }

  // Ensure it's the expected 'message' event payload
  if (body.event !== "message" || !body.payload) {
    return new Response("Ignored non-message event", { status: 200 });
  }

  const payload = body.payload;
  const fromNumber = payload.from;
  const messageObj = payload.message;

  if (!fromNumber || !messageObj) {
    return new Response("Missing sender or message object", { status: 400 });
  }

  let contentText = "";
  let mediaUrl: string | undefined = undefined;
  let mimeType: string | undefined = undefined;

  if (messageObj.type === "text") {
    contentText = messageObj.text || "";
  } else if (messageObj.type === "image" && messageObj.media) {
    // Media payload!
    contentText = messageObj.caption || "[Image attachment received]";
    mediaUrl = messageObj.media.url;
    mimeType = messageObj.media.mime_type;
  } else {
    contentText = `[Received unsupported message type: ${messageObj.type}]`;
  }

  try {
    await ctx.runMutation(internal.sentry.processInboundMessage, {
      senderContact: fromNumber, // e.g. "2348012345678"
      senderName: payload.profile_name || "Unknown Sender",
      content: contentText,
      channel: "whatsapp", // Assuming Chakra WhatsApp API
      mediaUrl,
      mimeType,
    });

    // Chakra expects a 200 OK
    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Failed to process inbound Chakra message:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
});
