import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";

// ─── INTERNAL WRAPPER: sendWhatsAppInternal ──────────────────────────────
// internalMutation (like sentry.ts cron jobs) can't call ctx.runAction on
// public actions. This internal action wraps the public sendWhatsApp so
// internal mutations can call it via ctx.runAction(internal.communications.sendWhatsAppInternal).
export const sendWhatsAppInternal = internalAction({
  args: {
    to: v.string(),
    messageText: v.string(),
    firmId: v.string(),
    templateName: v.optional(v.string()),
    templateVars: v.optional(v.array(v.string())),
    templateLanguage: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; simulated?: boolean; error?: string; messageId?: string }> => {
    return await ctx.runAction(api.communications.sendWhatsApp, args);
  },
});

// ─── Email: Brevo (formerly Sendinblue) ─────────────────────────────────────
export const sendEmail = action({
  args: {
    to: v.string(),
    toName: v.optional(v.string()),
    subject: v.string(),
    htmlContent: v.string(),
    firmId: v.string(),
    // SENDER IDENTITY (user feedback 2026-09-08: "the email name did not
    // show the name of the firm"). The display name shown in the
    // recipient's inbox now defaults to the SENDING FIRM's name — the
    // sender email stays the verified Brevo address, but the name the
    // customer sees is the firm they know. replyTo routes answers to the
    // staff member who sent it (normal email-service behaviour).
    senderName: v.optional(v.string()),
    replyTo: v.optional(v.string()),
    recordLog: v.optional(v.boolean()),
  },
  handler: async (_ctx, args) => {
    // Use the same env var as myFunctions.ts sendBrevoEmail (PracticePro_Vega_Mailer)
    // Fall back to BREVO_API_KEY for backwards compatibility
    const BREVO_API_KEY = process.env.PracticePro_Vega_Mailer || process.env.BREVO_API_KEY;

    if (!BREVO_API_KEY) {
      // HONESTY FIX (Messages false-"sent" bug): previously returned
      // { success: true, simulated: true } here, so every caller that only
      // checked result.success marked the message "sent" while NOTHING was
      // delivered. An unconfigured provider is a FAILURE, not a success.
      console.warn("[Brevo] No API key set (PracticePro_Vega_Mailer / BREVO_API_KEY) — email NOT delivered.");
      return {
        success: false,
        simulated: true,
        error: "Email is not configured on this deployment (Brevo API key missing) — the email was NOT delivered. Set PracticePro_Vega_Mailer or BREVO_API_KEY in the Convex dashboard.",
      };
    }

    if (!args.to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(args.to).trim())) {
      return { success: false, simulated: false, error: `Invalid recipient email address: "${args.to}"` };
    }

    try {
      const replyTo = args.replyTo && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(args.replyTo).trim())
        ? [{ email: String(args.replyTo).trim() }]
        : undefined;
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "api-key": BREVO_API_KEY,
        },
        body: JSON.stringify({
          sender: {
            name: (args.senderName || "PracticePro").toString().slice(0, 90),
            email: process.env.BREVO_SENDER_EMAIL || "practiceprosystems@gmail.com",
          },
          to: [{ email: String(args.to).trim(), name: (args.toName || args.to).toString().slice(0, 90) }],
          ...(replyTo ? { replyTo } : {}),
          subject: args.subject,
          htmlContent: args.htmlContent,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        console.error("[Brevo] API Error:", err);
        return { success: false, simulated: false, error: `Brevo API error (${response.status}): ${err}` };
      }

      const data = await response.json().catch(() => ({}));
      // Brevo returns { messageId: "<...>" } on success — surface it so the
      // audit trail can correlate with the provider.
      return { success: true, simulated: false, messageId: data?.messageId };
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
    // Template LOCALE — Meta matches name + language exactly; a template
    // registered under "en_US" is invisible to a send requesting "en"
    // (and vice versa). Callers may pass the locale; default "en". The
    // client fallback chain (deliveryErrors.ts) retries en_US/en_GB when
    // the name+language pair isn't found.
    templateLanguage: v.optional(v.string()),
    firmId: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; simulated?: boolean; error?: string; messageId?: string }> => {
    // Check and increment quota — type explicitly to avoid circular inference
    const quotaResult: { success: boolean; error?: string; limit?: number } = await ctx.runMutation(
      internal.myFunctions.incrementWhatsAppQuota,
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

    // Normalise phone to E.164 digits (no "+") for Meta's API.
    // Handles the shapes actually stored in the DB: "+234801...", "234801...",
    // "0801234..." (local NG), and "801234..." (local NG without leading 0).
    const normalised = normalisePhoneForMeta(args.to);
    if (!normalised) {
      return {
        success: false,
        simulated: false,
        error: `Invalid WhatsApp recipient phone number: "${args.to}" — must be a valid phone in international format.`,
      };
    }

    // Build payload — use template if provided, otherwise plain text
    const payload = args.templateName
      ? {
          messaging_product: "whatsapp",
          to: normalised,
          type: "template",
          template: {
            name: args.templateName,
            language: { code: args.templateLanguage || "en" },
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

      // Parse defensively: Chakra sometimes returns non-JSON bodies (HTML
      // error pages, empty bodies on 502s). response.json() would THROW on
      // those and land in the generic catch branch, hiding the HTTP status.
      const rawBody = await response.text();
      let data: any = null;
      try { data = rawBody ? JSON.parse(rawBody) : null; } catch { data = null; }

      if (!response.ok || !data) {
        const parsed = extractWaError(data);
        const errText = parsed
          ?? (rawBody && rawBody.length > 0 ? `${rawBody.slice(0, 300)}` : null);
        console.error("[WhatsApp] Chakra API Error:", response.status, rawBody.slice(0, 1000));
        return {
          success: false,
          simulated: false,
          error: explainWhatsAppError(parsed) ??
            `Chakra/WhatsApp gateway error (HTTP ${response.status})${errText ? `: ${errText}` : " — empty response body"}`,
        };
      }

      // STRICT success verification (Messages false-"sent" bug): a 200 from
      // Chakra is NOT proof of delivery. Meta's contract returns
      // messages[0].id for every accepted send. Anything else (empty
      // messages array, an error object in the body, or a different shape)
      // must be treated as a failure so logs never claim a send that never
      // happened.
      const metaMessageId = data?.messages?.[0]?.id;
      if (!metaMessageId) {
        const parsed = extractWaError(data);
        console.error("[WhatsApp] Chakra 200 but no Meta message id — treating as failure:", rawBody.slice(0, 1000));
        return {
          success: false,
          simulated: false,
          error: (parsed && explainWhatsAppError(parsed)) ||
            "WhatsApp gateway accepted the request but returned no message id — message NOT delivered.",
        };
      }

      return { success: true, simulated: false, messageId: metaMessageId };
    } catch (error: any) {
      console.error("[WhatsApp] Send failed:", error);
      return { success: false, simulated: false, error: error.message };
    }
  },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Normalise a phone number to E.164 digits without "+" (Meta Cloud API form).
 * Nigeria-first: local numbers (leading 0, 10-11 digits) get the 234 country
 * code prefixed. Already-international numbers pass through unchanged.
 * Returns null when the input can't be a valid phone number.
 */
export function normalisePhoneForMeta(raw: string): string | null {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  // Local Nigerian format: strip leading zeros ("08012345678" → "8012345678")
  digits = digits.replace(/^0+/, "");
  if (!digits) return null;
  // Already carries a country code we recognise as plausible:
  //   "2348012345678" (NG), or any 12+ digit international form (e.g. 44…, 1…)
  if (digits.startsWith("234") && digits.length >= 12) return digits;
  if (digits.length >= 12) return digits;
  // Local NG number without country code ("8012345678") — 10 digits
  if (digits.length >= 10 && digits.length <= 11) return `234${digits}`;
  // Anything else is not a number Meta will accept
  return null;
}

/**
 * Extract a human-readable error from a Chakra/Meta error body.
 *
 * SHAPES (learned the hard way — "Unknown WhatsApp gateway error" bug):
 * 1. Chakra wrapper: { _data, _meta, _errors: ["..."] }  ← THE one we missed
 * 2. Meta Graph:      { error: { message, type, code, error_data: { message } } }
 * 3. Meta Graph alt:  { error: "string" } or { message: "..." }
 * 4. Meta errors array: { errors: [{ message, code }] }
 * 5. Anything else:   null (caller falls back to HTTP status + raw body text)
 */
export function extractWaError(data: any): string | null {
  if (!data) return null;
  if (typeof data.error === "string") return data.error;
  if (data.error?.message) {
    const code = data.error?.code ? ` (code ${data.error.code})` : "";
    const detail = data.error?.error_data?.details || data.error?.error_data?.message;
    const sub = detail ? ` — ${detail}` : "";
    return `${data.error.message}${code}${sub}`;
  }
  // Chakra's documented envelope: errors ride in _errors (array of strings)
  if (Array.isArray(data._errors) && data._errors.length > 0) {
    return data._errors.map((e: any) => (typeof e === "string" ? e : e?.message || JSON.stringify(e))).join("; ");
  }
  if (Array.isArray(data.errors) && data.errors.length > 0) {
    return data.errors.map((e: any) => {
      const code = e?.code ? ` (code ${e.code})` : "";
      return `${e?.message || JSON.stringify(e)}${code}`;
    }).join("; ");
  }
  if (data.message) return String(data.message);
  if (typeof data._data === "string" && data._data) return data._data;
  return null;
}

/**
 * Detect the WhatsApp 24-hour customer-service-window error class — the
 * #1 reason business-initiated free-form sends fail (Meta error 131047
 * "Re-engagement message" / "more than 24 hours have passed"). When the
 * resident hasn't replied within 24h, Meta only accepts messages sent via
 * an APPROVED TEMPLATE. Surfacing this distinction turns a cryptic
 * provider error into an actionable instruction.
 */
export function isWhatsAppWindowError(error: string | null | undefined): boolean {
  if (!error) return false;
  const e = error.toLowerCase();
  return (
    e.includes("131047") ||
    e.includes("re-engagement") ||
    e.includes("reengagement") ||
    e.includes("more than 24 hours") ||
    e.includes("24 hours have passed") ||
    e.includes("outside the 24") ||
    e.includes("support window") ||
    e.includes("customer service window") ||
    (e.includes("template") && (e.includes("required") || e.includes("only allowed")))
  );
}

/**
 * Does this provider error mean "the name+language template pair wasn't
 * found on the WhatsApp Business account"? Meta looks up templates by
 * NAME + LOCALE — a template registered under "en_US" (or "en_GB") is
 * invisible to a send that requests "en". Server-side twin of
 * deliveryErrors.ts isTemplateNotFoundError (kept in sync deliberately:
 * the Convex bundle can't import client modules).
 */
export function isTemplateNotFoundError(error: string | null | undefined): boolean {
  if (!error) return false;
  const e = error.toLowerCase();
  return (
    e.includes("132000") ||
    e.includes("132001") ||
    e.includes("132002") ||
    (/template/.test(e) && /does not exist|not found|not exist|unavailable|no template/.test(e)) ||
    (/language/.test(e) && /does not match|not match|mismatch/.test(e))
  );
}

/**
 * Append an actionable hint to WhatsApp send errors so users see WHY the
 * send failed and what to do, not just the provider's raw text.
 */
export function explainWhatsAppError(error: string | null | undefined): string {
  if (!error) return "Unknown WhatsApp gateway error.";
  if (isWhatsAppWindowError(error)) {
    return `${error} — WhatsApp only delivers free-form messages within 24 hours of the resident's last reply. Business-initiated messages need an approved template (Settings → WhatsApp Templates). The resident can also message you first to open the 24-hour window.`;
  }
  if (isTemplateNotFoundError(error)) {
    return `${error} — the template name or language doesn't match what's registered on this WhatsApp account. Open Settings → WhatsApp Templates and press "Sync from Meta" to see your exact approved template names, languages and variable counts, then map them to your message types.`;
  }
  if (/param.*mismatch|incorrect.*param|number of parameters|placeholders|1320[0-9][0-9]/i.test(error)) {
    return `${error} — the template's variables don't match what was sent (count/order). Check the variable order in Settings → WhatsApp Templates.`;
  }
  if (/\(code 190\)|access token|unauthorized|invalid.*token/i.test(error)) {
    return `${error} — the Chakra access token is missing, expired or revoked. Re-issue it in Chakra Chat (WhatsApp setup) and update CHAKRA_ACCESS_TOKEN in the Convex dashboard.`;
  }
  if (/\(code 1310(4[0-9]|5[0-9])\)|recipient|phone number.*not.*valid/i.test(error)) {
    return `${error} — WhatsApp rejected the recipient's number (not a WhatsApp user, or invalid format). Check the resident's phone in their record.`;
  }
  return error;
}
