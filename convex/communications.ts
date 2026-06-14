import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// ─── Email: Brevo (formerly Sendinblue) ─────────────────────────────────────
export const sendEmail = action({
  args: {
    to: v.string(),
    toName: v.optional(v.string()),
    subject: v.string(),
    htmlContent: v.string(),
    firmId: v.string(),
    recordLog: v.optional(v.boolean()),
  },
  handler: async (_ctx, args) => {
    // Use the same env var as myFunctions.ts sendBrevoEmail (PracticePro_Vega_Mailer)
    // Fall back to BREVO_API_KEY for backwards compatibility
    const BREVO_API_KEY = process.env.PracticePro_Vega_Mailer || process.env.BREVO_API_KEY;

    if (!BREVO_API_KEY) {
      console.warn("[Brevo] No API key set (PracticePro_Vega_Mailer / BREVO_API_KEY) — simulating email send.");
      return { success: true, simulated: true };
    }

    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "api-key": BREVO_API_KEY,
        },
        body: JSON.stringify({
          sender: { name: "PracticePro Legal Technologies", email: process.env.BREVO_SENDER_EMAIL || "practiceprovega@gmail.com" },
          to: [{ email: args.to, name: args.toName || args.to }],
          subject: args.subject,
          htmlContent: args.htmlContent,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        console.error("[Brevo] API Error:", err);
        return { success: false, simulated: false, error: err };
      }

      return { success: true, simulated: false };
    } catch (error: any) {
      console.error("[Brevo] Send failed:", error);
      return { success: false, simulated: false, error: error.message };
    }
  },
});

// ─── WhatsApp: Chakra Chat (pass-through to Meta Cloud API) ─────────────────
//
// Required environment variables (set in Convex dashboard → Settings → Environment):
//   CHAKRA_ACCESS_TOKEN     — Bearer token from Chakra Chat
//   CHAKRA_PLUGIN_ID        — Found in Chakra Chat → WhatsApp setup → 3-dot menu
//   CHAKRA_PHONE_NUMBER_ID  — Found in Chakra Chat → WhatsApp setup → gear icon
//   CHAKRA_WA_API_VERSION   — e.g. "v19.0" (default used if not set)
//
export const sendWhatsApp = action({
  args: {
    to: v.string(),           // Recipient phone number in international format: +2348012345678
    messageText: v.string(),  // Plain text message body (for session/free-form messages)
    // For template messages (required for business-initiated outside 24h window):
    templateName: v.optional(v.string()),
    templateVars: v.optional(v.array(v.string())),
    firmId: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; simulated?: boolean; error?: string; messageId?: string }> => {
    // Check and increment quota — type explicitly to avoid circular inference
    const quotaResult: { success: boolean; error?: string; limit?: number } = await ctx.runMutation(
      api.myFunctions.incrementWhatsAppQuota,
      { firmId: args.firmId }
    );
    if (!quotaResult.success) {
      return { 
        success: false, 
        simulated: false, 
        error: `Monthly WhatsApp limit reached (${quotaResult.limit}). Please upgrade your plan to continue sending automated messages.` 
      };
    }

    const TOKEN     = process.env.CHAKRA_ACCESS_TOKEN;
    const PLUGIN_ID = process.env.CHAKRA_PLUGIN_ID;
    const PHONE_ID  = process.env.CHAKRA_PHONE_NUMBER_ID;
    const WA_VER    = process.env.CHAKRA_WA_API_VERSION || "v19.0";

    if (!TOKEN || !PLUGIN_ID || !PHONE_ID) {
      const missing = [!TOKEN && "CHAKRA_ACCESS_TOKEN", !PLUGIN_ID && "CHAKRA_PLUGIN_ID", !PHONE_ID && "CHAKRA_PHONE_NUMBER_ID"].filter(Boolean).join(", ");
      // Return error instead of throwing — throwing crashes the calling action
      // (e.g. createPortalInvite) even after the invite record is already created.
      return { success: false, simulated: true, error: `WhatsApp not configured. Missing: ${missing}.` };
    }

    // Normalise phone: must be E.164 without "+" for Meta's API
    const normalised = args.to.replace(/\D/g, "");

    // Build payload — use template if provided, otherwise plain text
    const payload = args.templateName
      ? {
          messaging_product: "whatsapp",
          to: normalised,
          type: "template",
          template: {
            name: args.templateName,
            language: { code: "en" },
            components: args.templateVars?.length
              ? [{
                  type: "body",
                  parameters: args.templateVars.map(v => ({ type: "text", text: v })),
                }]
              : [],
          },
        }
      : {
          messaging_product: "whatsapp",
          to: normalised,
          type: "text",
          text: { preview_url: false, body: args.messageText },
        };

    const url = `https://api.chakrahq.com/v1/ext/plugin/whatsapp/${PLUGIN_ID}/api/${WA_VER}/${PHONE_ID}/messages`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("[WhatsApp] Chakra API Error:", JSON.stringify(data));
        return { success: false, simulated: false, error: data?.error?.message || "Unknown error" };
      }

      console.log("[WhatsApp] Sent OK →", data?.messages?.[0]?.id);
      return { success: true, simulated: false, messageId: data?.messages?.[0]?.id };
    } catch (error: any) {
      console.error("[WhatsApp] Send failed:", error);
      return { success: false, simulated: false, error: error.message };
    }
  },
});
