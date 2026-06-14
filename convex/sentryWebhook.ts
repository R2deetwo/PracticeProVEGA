import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

export const handleChakraWebhook = httpAction(async (ctx, request) => {
  // We're handling Chakra Chat JSON payload now, instead of Twilio url-encoded
  
  // Chakra Signature Verification
  // In production, set CHAKRA_WEBHOOK_SECRET env var to validate signatures.
  // When not set, we log a warning but allow through (for development/testing).
  const chakraSignature = request.headers.get("X-Chakra-Signature-256");
  const webhookSecret = process.env.CHAKRA_WEBHOOK_SECRET;
  if (!chakraSignature && webhookSecret) {
     // Secret is configured but signature is missing — reject
     console.error("Missing Chakra signature header — rejecting request");
     return new Response("Unauthorized", { status: 401 });
  }
  if (!chakraSignature && !webhookSecret) {
     // No secret configured — allow through but warn
     console.warn("CHAKRA_WEBHOOK_SECRET not configured — accepting webhook without signature verification. Set this in production!");
  }
  // TODO: When crypto utilities are available in Convex actions, validate the
  // HMAC-SHA256 signature: hmac(webhookSecret, rawBody) === chakraSignature

  let body;
  try {
    body = await request.json();
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
