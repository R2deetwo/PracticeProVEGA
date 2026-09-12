import { action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { requireFirmUser } from "./authHelpers";

// Chakra's WhatsApp plan-upgrade billing page — the action link surfaced in
// admin UI whenever the gateway returns the 402 billing gate (Task 37 live
// test: "Template Message sending is disabled. You need to upgrade to a
// paid plan." — the root cause of EVERY failed template send).
export const CHAKRA_WHATSAPP_BILLING_URL =
  "https://app.chakrahq.com/admin/billing/chakra-whatsapp-upgrade";

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
    // Template retry configuration (mirrors sendWhatsApp's public args) —
    // lets cron-driven automation use the window-fallback too.
    fallback: v.optional(v.object({
      messageType: v.string(),
      templateVarsData: v.optional(v.object({
        tenantName: v.optional(v.string()),
        amount: v.optional(v.number()),
        totalPayable: v.optional(v.number()),
        serviceCharge: v.optional(v.number()),
        address: v.optional(v.string()),
        firmName: v.optional(v.string()),
        dueDate: v.optional(v.string()),
        messageText: v.optional(v.string()),
      })),
    })),
    retryTemplateLocales: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; simulated?: boolean; error?: string; errorClass?: string; messageId?: string; usedTemplate?: boolean }> => {
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
    // PDF ATTACHMENT (user feedback 2026-09-12: "should we not make it a
    // pdf as well so that what they see in the email attachment is what
    // they get from their portal"). Receipts ride as a real PDF document
    // so the inbox copy is the document itself, not an email that merely
    // LOOKS like a receipt. Brevo expects { name, content } with content
    // base64-encoded.
    attachment: v.optional(v.object({
      name: v.string(),
      contentBase64: v.string(),
    })),
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

    // Attachment guards: a malformed or oversized payload must fail LOUDLY
    // before the API call, not as a vague Brevo 400 afterwards. Receipt
    // PDFs are ~10-30KB; the cap catches accidental whole-file uploads.
    if (args.attachment) {
      const b64 = String(args.attachment.contentBase64 || "");
      if (!b64) {
        return { success: false, simulated: false, error: "Attachment contentBase64 is empty — the email was NOT sent." };
      }
      if (b64.length > 8_000_000) {
        return { success: false, simulated: false, error: `Attachment "${args.attachment.name}" is too large (${Math.round(b64.length / 1024)}KB base64) — the email was NOT sent.` };
      }
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
          ...(args.attachment
            ? { attachment: [{ name: args.attachment.name, content: String(args.attachment.contentBase64) }] }
            : {}),
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
    // server retries en_US/en_GB when the name+language pair isn't found
    // (retryTemplateLocales, default true).
    templateLanguage: v.optional(v.string()),
    firmId: v.string(),
    // ── AUTOMATIC TEMPLATE FALLBACK (server-side, 2026-09-12) ──────────
    // THE bug this kills: every cron/scheduled/bulk send went out
    // free-form ONLY, and free-form is rejected by Meta (error 131047)
    // whenever the resident hasn't replied within 24h — so ALL automated
    // reminders failed silently outside the window. The client-side
    // fallback only covered ComposeModal; portals.ts scheduled dispatch,
    // sentry.ts crons and portal invites had nothing.
    // Now: pass `fallback` with a messageType (+ the recipient's data) and
    // this action retries a window-class failure with the firm's MAPPED
    // template — resolved from whatsapp_template_mappings, variables built
    // from templateVarsData, locale chain tried automatically — inside the
    // SAME quota charge. No caller churn: absent `fallback` behaves exactly
    // as before.
    fallback: v.optional(v.object({
      messageType: v.string(),               // AutomationMessageType
      templateVarsData: v.optional(v.object({
        tenantName: v.optional(v.string()),
        amount: v.optional(v.number()),
        totalPayable: v.optional(v.number()),
        serviceCharge: v.optional(v.number()),
        address: v.optional(v.string()),
        firmName: v.optional(v.string()),
        dueDate: v.optional(v.string()),
        messageText: v.optional(v.string()),
      })),
    })),
    // When a template-first send fails with a name+locale lookup miss,
    // automatically retry the other common English locales (default true).
    retryTemplateLocales: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; simulated?: boolean; error?: string; errorClass?: string; messageId?: string; usedTemplate?: boolean }> => {
    // Check and increment quota — type explicitly to avoid circular inference
    const quotaResult: { success: boolean; error?: string; limit?: number } = await ctx.runMutation(
      internal.myFunctions.incrementWhatsAppQuota,
      { firmId: args.firmId }
    );
    if (!quotaResult.success) {
      return { 
        success: false, 
        simulated: false, 
        errorClass: "quota_exceeded",
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
      return { success: false, simulated: true, errorClass: "not_configured", error: `WhatsApp not configured. Missing: ${missing}.` };
    }

    // Normalise phone to E.164 digits (no "+") for Meta's API.
    // Handles the shapes actually stored in the DB: "+234801...", "234801...",
    // "0801234..." (local NG), and "801234..." (local NG without leading 0).
    const normalised = normalisePhoneForMeta(args.to);
    if (!normalised) {
      return {
        success: false,
        simulated: false,
        errorClass: "invalid_phone",
        error: `Invalid WhatsApp recipient phone number: "${args.to}" — must be a valid phone in international format.`,
      };
    }

    // Raw Chakra send — one helper used by the first attempt AND every
    // retry (template/locale) so quota is charged once per logical message.
    const url = `https://api.chakrahq.com/v1/ext/plugin/whatsapp/${PLUGIN_ID}/api/${WA_VER}/${PHONE_ID}/messages`;
    const doSend = async (payload: any): Promise<{
      ok: boolean; httpStatus: number; data: any; raw: string;
      error?: string; errorClass?: string; messageId?: string;
    }> => {
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
        // those and hide the HTTP status.
        const raw = await response.text();
        let data: any = null;
        try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
        if (!response.ok || !data) {
          const parsed = extractWaError(data);
          const errText = parsed ?? (raw && raw.length > 0 ? raw.slice(0, 300) : null);
          console.error("[WhatsApp] Chakra API Error:", response.status, raw.slice(0, 1000));
          // 402 is Chakra's billing gate (template sends disabled on the
          // current plan) — classify it so the admin UI can show the upgrade
          // banner and disabled send instead of a cryptic raw error.
          const errorClass = classifyWhatsAppError(errText, response.status);
          return {
            ok: false, httpStatus: response.status, data, raw,
            errorClass,
            error: explainWhatsAppError(errText, response.status) ??
              `Chakra/WhatsApp gateway error (HTTP ${response.status})${errText ? `: ${errText}` : " — empty response body"}`,
          };
        }
        // STRICT success verification: a 200 from Chakra is NOT proof of
        // delivery. Meta's contract returns messages[0].id for every accepted
        // send; anything else is a failure so logs never claim a phantom send.
        const messageId = data?.messages?.[0]?.id;
        if (!messageId) {
          const parsed = extractWaError(data);
          console.error("[WhatsApp] Chakra 200 but no Meta message id — treating as failure:", raw.slice(0, 1000));
          return {
            ok: false, httpStatus: response.status, data, raw,
            errorClass: classifyWhatsAppError(parsed, response.status),
            error: (parsed && explainWhatsAppError(parsed, response.status)) ||
              "WhatsApp gateway accepted the request but returned no message id — message NOT delivered.",
          };
        }
        return { ok: true, httpStatus: response.status, data, raw, messageId };
      } catch (error: any) {
        console.error("[WhatsApp] Send failed:", error);
        // httpStatus 0 = the fetch itself threw (network/DNS/timeout) —
        // classified as service_unavailable, never a silent "unknown".
        return { ok: false, httpStatus: 0, data: null, raw: "", errorClass: "service_unavailable", error: explainWhatsAppError(error?.message || String(error), 0) };
      }
    };

    // ── Gateway health tracking (402 billing gate) ──────────────────────
    // A plan-upgrade/payment failure marks the firm's WhatsApp as blocked
    // (banner + disabled send in the admin UI); a successful send clears
    // it. Best-effort: health tracking must never break a send.
    const recordHealth = async (result: { success: boolean; errorClass?: string; error?: string }) => {
      try {
        const blocked =
          !result.success &&
          (result.errorClass === "plan_upgrade_required" || result.errorClass === "payment_issue");
        await ctx.runMutation(internal.communications.recordWhatsAppGatewayHealth, {
          firmId: args.firmId,
          blocked,
          errorClass: blocked ? result.errorClass : undefined,
          reason: blocked ? (result.error ?? "") : undefined,
        });
      } catch (e: any) {
        console.warn("[WhatsApp] gateway-health write failed:", e?.message || e);
      }
    };

    const templatePayload = (name: string, language: string, vars?: string[]) => ({
      messaging_product: "whatsapp",
      to: normalised,
      type: "template",
      template: {
        name,
        language: { code: language },
        components: vars?.length
          ? [{
              type: "body",
              parameters: vars.map(v => ({ type: "text", text: v })),
            }]
          : [],
      },
    });

    // ── SEND PATH 1: template-first (explicit templateName) ──────────────
    if (args.templateName) {
      const langs = [args.templateLanguage || "en", "en", "en_US", "en_GB"]
        .filter((l, i, a) => a.indexOf(l) === i);
      // Locale retry: try the requested locale; on a name+locale lookup
      // miss, walk the chain (unless the caller disabled it).
      const tryLocales = args.retryTemplateLocales === false ? [langs[0]] : langs;
      let last: Awaited<ReturnType<typeof doSend>> | null = null;
      for (const locale of tryLocales) {
        const attempt = await doSend(templatePayload(
          args.templateName, locale, args.templateVars
        ));
        if (attempt.ok) {
          const out = { success: true, simulated: false, messageId: attempt.messageId, usedTemplate: true };
          await recordHealth(out);
          return out;
        }
        last = attempt;
        // Only a name+language lookup miss justifies another locale.
        if (!isTemplateNotFoundError(attempt.error)) break;
      }
      const out = { success: false, simulated: false, error: last?.error, errorClass: last?.errorClass };
      await recordHealth(out);
      return out;
    }

    // ── SEND PATH 2: free-form first, template fallback on window errors ─
    const free = await doSend({
      messaging_product: "whatsapp",
      to: normalised,
      type: "text",
      text: { preview_url: false, body: args.messageText },
    });
    if (free.ok) {
      const out = { success: true, simulated: false, messageId: free.messageId };
      await recordHealth(out);
      return out;
    }

    // Window-class failure (resident hasn't replied in 24h) + a mapping for
    // this message type → retry with the firm's approved template. THIS is
    // the branch that makes automated reminders actually deliverable.
    if (args.fallback && isWhatsAppWindowError(free.error)) {
      const mapping = await resolveFirmTemplateMapping(ctx, args.firmId, args.fallback.messageType);
      if (mapping) {
        const vars = buildTemplateVarsForOrder(
          mapping.varOrder,
          args.fallback.templateVarsData ?? { messageText: args.messageText }
        );
        const langs = [mapping.templateLanguage || "en", "en", "en_US", "en_GB"]
          .filter((l, i, a) => a.indexOf(l) === i);
        let last: Awaited<ReturnType<typeof doSend>> | null = null;
        for (const locale of langs) {
          const attempt = await doSend(templatePayload(
            mapping.templateName, locale, vars.length ? vars : undefined
          ));
          if (attempt.ok) {
            const out = { success: true, simulated: false, messageId: attempt.messageId, usedTemplate: true };
            await recordHealth(out);
            return out;
          }
          last = attempt;
          if (!isTemplateNotFoundError(attempt.error)) break;
        }
        // Template retry failed — report the template error (the more
        // actionable one) but keep the original window explanation.
        const out = {
          success: false, simulated: false, usedTemplate: true,
          error: last?.error
            ? `${last.error} (free-form was rejected: ${free.error})`
            : free.error,
          errorClass: last?.errorClass ?? free.errorClass,
        };
        await recordHealth(out);
        return out;
      }
    }

    const out = { success: false, simulated: false, error: free.error, errorClass: free.errorClass };
    await recordHealth(out);
    return out;
  },
});

// ─── Template-fallback helpers (server twins of deliveryErrors.ts) ─────────

interface ServerFirmTemplateMapping {
  templateName: string;
  templateLanguage: string;
  varOrder?: string[];
}

/** Read the firm's mapping for a message type (actions read via runQuery). */
async function resolveFirmTemplateMapping(
  ctx: any,
  firmId: string,
  messageType: string
): Promise<ServerFirmTemplateMapping | null> {
  try {
    const doc = await ctx.runQuery(
      internal.whatsappTemplates.getFirmTemplateMappingInternal,
      { firmId, messageType }
    );
    if (!doc?.templateName) return null;
    return {
      templateName: String(doc.templateName),
      templateLanguage: String(doc.templateLanguage || "en"),
      varOrder: Array.isArray(doc.varOrder) ? doc.varOrder.map(String) : undefined,
    };
  } catch (e: any) {
    console.warn("[WhatsApp] mapping lookup failed:", e?.message || e);
    return null;
  }
}

/**
 * Build ordered template variable values from a varOrder + recipient data.
 * Mirrors buildVarsForOrder in src/utils/deliveryErrors.ts (the Convex
 * bundle can't import client modules — duplicated deliberately).
 */
export function buildTemplateVarsForOrder(
  order: string[] | undefined | null,
  r: {
    tenantName?: string; amount?: number; totalPayable?: number;
    serviceCharge?: number; address?: string; firmName?: string;
    dueDate?: string; messageText?: string;
  }
): string[] {
  const naira = (n?: number) => `₦${(n || 0).toLocaleString("en-NG")}`;
  if (!order || order.length === 0) {
    // Legacy default: [name, amount, address]
    return [
      r.tenantName || "Resident",
      (r.amount || 0).toLocaleString("en-NG"),
      r.address || "your unit",
    ];
  }
  return order.map((f) => {
    switch (f) {
      case "tenantName": return r.tenantName || "Resident";
      case "amount": return (r.amount || 0).toLocaleString("en-NG");
      case "totalPayable": return r.totalPayable != null ? r.totalPayable.toLocaleString("en-NG") : naira(r.amount);
      case "serviceCharge": return (r.serviceCharge || 0).toLocaleString("en-NG");
      case "address": return r.address || "your unit";
      case "firmName": return r.firmName || "Management";
      case "dueDate": return r.dueDate || "the due date";
      case "messageText": return r.messageText || "";
      default: return String(f);
    }
  });
}

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

// ─── Error classes: the machine-readable reason for every failed send ───────
//
// 2026-09-12 (Task 37 live test): the WhatsApp Live Test workflow proved the
// definitive root cause of every failed template send — Chakra returns HTTP
// 402 with "Template Message sending is disabled. You need to upgrade to a
// paid plan." A billing gate, not a code bug. These classes make that (and
// every other failure family) a first-class value stored on each failed
// message record, so the UI can show a mapped reason, a persistent admin
// banner with the Chakra billing link, and a disabled send button — instead
// of a raw provider string the user can't act on.

export type WhatsAppErrorClass =
  | "plan_upgrade_required" // 402 + "Template Message sending is disabled"
  | "payment_issue"         // 402 (other billing failures)
  | "auth_failed"           // 401/403 / code 190 / token problems
  | "rate_limited"          // 429
  | "service_unavailable"   // 5xx / network-level failures
  | "window"                // 24h customer-service window (131047)
  | "template_not_found"    // name+language lookup miss (132000-class)
  | "param_mismatch"        // template variable count/order mismatch
  | "recipient_invalid"     // Meta rejected the recipient's number (1310xx)
  | "quota_exceeded"        // app-side monthly send quota
  | "not_configured"        // missing CHAKRA_* environment variables
  | "invalid_phone"         // app-side phone normalisation failed
  | "unknown";

/**
 * The short, user-facing mapped reason for each error class. The message log
 * shows THIS by default; the raw provider string stays on the record behind
 * an admin-only "Details" toggle. Client twin (same keys) lives in
 * src/utils/deliveryErrors.ts.
 */
export const WHATSAPP_ERROR_CLASS_MESSAGES: Record<WhatsAppErrorClass, string> = {
  plan_upgrade_required: "WhatsApp plan upgrade required — Chakra billing. Template messages blocked.",
  payment_issue: "WhatsApp payment issue. Check Chakra + Meta Business billing.",
  auth_failed: "WhatsApp authentication failed. Check Chakra token.",
  rate_limited: "Rate limited. Retry in a few minutes.",
  service_unavailable: "WhatsApp service temporarily unavailable. Retrying…",
  window: "Outside the 24-hour WhatsApp window — an approved template is required for business-initiated messages.",
  template_not_found: "Template not found — the name or language doesn't match what's registered. Sync from Meta in Settings.",
  param_mismatch: "Template variables don't match what was sent (count/order). Check the variable order in Settings.",
  recipient_invalid: "WhatsApp rejected the recipient's number. Check the resident's phone in their record.",
  quota_exceeded: "Monthly WhatsApp limit reached. Upgrade your plan to continue sending automated messages.",
  not_configured: "WhatsApp is not configured on this deployment — CHAKRA_* environment variables are missing.",
  invalid_phone: "The recipient's phone number isn't a valid WhatsApp number.",
  unknown: "Unknown WhatsApp gateway error.",
};

/**
 * Map a provider error (text + optional HTTP status) to ONE error class.
 *
 * Status-based classes are checked FIRST — the 402 billing gate, auth,
 * rate-limit and 5xx verdicts come from the gateway's HTTP status line and
 * are more specific than any text matching. Text-only calls (no status)
 * fall through to the original text classes, so pre-existing callers and
 * stored error strings keep classifying correctly.
 */
export function classifyWhatsAppError(
  error: string | null | undefined,
  httpStatus?: number
): WhatsAppErrorClass {
  const e = (error || "").toLowerCase();
  // The billing gate is identifiable by text alone (Chakra's message is
  // unambiguous) so legacy records without a stored status classify too.
  const isPlanDisabledText =
    e.includes("template message sending is disabled") ||
    e.includes("upgrade to a paid plan");
  if (httpStatus === 402 || isPlanDisabledText) {
    return isPlanDisabledText ? "plan_upgrade_required" : "payment_issue";
  }
  if (httpStatus === 401 || httpStatus === 403) return "auth_failed";
  if (httpStatus === 429 || e.includes("rate limit")) return "rate_limited";
  // httpStatus 0 = the fetch itself threw (network/DNS/timeout).
  if (httpStatus === 0 || (httpStatus != null && httpStatus >= 500)) {
    return "service_unavailable";
  }
  if (/network|econnreset|etimedout|socket hang up|fetch failed|service unavailable/i.test(e)) {
    return "service_unavailable";
  }
  if (isWhatsAppWindowError(error)) return "window";
  if (isTemplateNotFoundError(error)) return "template_not_found";
  if (/param.*mismatch|incorrect.*param|number of parameters|placeholders|1320[0-9][0-9]/i.test(e)) {
    return "param_mismatch";
  }
  if (/\(code 190\)|access token|unauthorized|invalid.*token/i.test(e)) return "auth_failed";
  if (/\(code 1310(4[0-9]|5[0-9])\)|recipient|phone number.*not.*valid/i.test(e)) {
    return "recipient_invalid";
  }
  return "unknown";
}

/**
 * Append an actionable hint to WhatsApp send errors so users see WHY the
 * send failed and what to do, not just the provider's raw text.
 *
 * 2026-09-12: extended with the status-based classes (402 billing gate /
 * 401 / 403 / 429 / 5xx / network). The original five text classes keep
 * their exact messages — existing callers and tests are unchanged.
 */
export function explainWhatsAppError(
  error: string | null | undefined,
  httpStatus?: number
): string {
  if (!error) return "Unknown WhatsApp gateway error.";
  switch (classifyWhatsAppError(error, httpStatus)) {
    case "plan_upgrade_required":
      return `${error} — WhatsApp plan upgrade required: Chakra billing blocks template messages on the current plan. Upgrade at ${CHAKRA_WHATSAPP_BILLING_URL}`;
    case "payment_issue":
      return `${error} — WhatsApp payment issue. Check Chakra + Meta Business billing.`;
    case "auth_failed":
      return `${error} — WhatsApp authentication failed. Check the Chakra token: re-issue it in Chakra Chat (WhatsApp setup) and update CHAKRA_ACCESS_TOKEN in the Convex dashboard.`;
    case "rate_limited":
      return `${error} — Rate limited. Retry in a few minutes.`;
    case "service_unavailable":
      return `${error} — WhatsApp service temporarily unavailable. Retrying… If it persists, check the Chakra/Meta status.`;
    case "window":
      return `${error} — WhatsApp only delivers free-form messages within 24 hours of the resident's last reply. Business-initiated messages need an approved template (Settings → WhatsApp Templates). The resident can also message you first to open the 24-hour window.`;
    case "template_not_found":
      return `${error} — the template name or language doesn't match what's registered on this WhatsApp account. Open Settings → WhatsApp Templates and press "Sync from Meta" to see your exact approved template names, languages and variable counts, then map them to your message types.`;
    case "param_mismatch":
      return `${error} — the template's variables don't match what was sent (count/order). Check the variable order in Settings → WhatsApp Templates.`;
    case "recipient_invalid":
      return `${error} — WhatsApp rejected the recipient's number (not a WhatsApp user, or invalid format). Check the resident's phone in their record.`;
    default:
      return error;
  }
}

// ─── Gateway health: persistent 402-blocked state per firm ──────────────────
//
// Written by sendWhatsApp after every send: a plan-upgrade/payment failure
// marks the firm's WhatsApp BLOCKED (admin banner + disabled send in the
// UI); any successful send clears it. Lives on whatsapp_settings so the UI
// reads one row instead of scanning logs.

export const recordWhatsAppGatewayHealth = internalMutation({
  args: {
    firmId: v.string(),
    blocked: v.boolean(),
    errorClass: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("whatsapp_settings")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .first();
    if (args.blocked) {
      const patch = {
        gatewayBlockedClass: args.errorClass ?? "unknown",
        gatewayBlockedReason: (args.reason ?? "").slice(0, 300),
        gatewayBlockedAt: Date.now(),
      };
      if (existing) await ctx.db.patch(existing._id, patch);
      else await ctx.db.insert("whatsapp_settings", { firmId: args.firmId, ...patch });
    } else if (existing?.gatewayBlockedClass) {
      // Clear (Convex patch can't write undefined — "" is the clear value).
      await ctx.db.patch(existing._id, {
        gatewayBlockedClass: "",
        gatewayBlockedReason: "",
        gatewayBlockedAt: 0,
      });
    }
    return { success: true };
  },
});

// ─── Retry all failed (last 24h) ────────────────────────────────────────────

/**
 * Failed WhatsApp automation_logs from the last 24h for a firm (bounded).
 * Internal query — read by the retryFailedWhatsApp action.
 */
export const listFailedWhatsAppLogs = internalQuery({
  args: { firmId: v.string(), since: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("automation_logs")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .filter((q) =>
        q.and(
          q.eq(q.field("channel"), "whatsapp"),
          q.eq(q.field("status"), "failed"),
          q.gte(q.field("sentAt"), args.since)
        )
      )
      .take(50);
  },
});

/**
 * Best-effort recipient context for a retry: the unit/property record the
 * log points at (tenant name, rent, service charge, address) so the firm's
 * template variables fill with REAL values instead of placeholders.
 */
export const getLogRecipientContext = internalQuery({
  args: { propertyId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.propertyId) return null;
    try {
      const p: any = await ctx.db.get(args.propertyId as any);
      if (!p) return null;
      const rd = p.rentalDetails || {};
      // Item 2 (0-valid resolution): `|| undefined` used to swallow a REAL 0
      // (exempt unit) into a dropped template variable, which shifts param
      // counts and fails approved-template sends. 0 stays 0; only junk (NaN)
      // falls back to undefined.
      const scRaw = Number(rd.serviceChargeAmount ?? rd.serviceCharge ?? 0);
      return {
        tenantName: p.tenantName || undefined,
        rentAmount: Number(rd.rentAmount ?? p.rentAmount ?? 0) || undefined,
        serviceCharge: Number.isFinite(scRaw) ? scRaw : undefined,
        propertyAddress: p.propertyAddress || p.address || undefined,
      };
    } catch {
      return null;
    }
  },
});

/**
 * "Retry all failed (last 24h)" — re-routes every failed WhatsApp send from
 * the last 24 hours through the SAME sendWhatsApp helper (free-form first,
 * automatic approved-template fallback when Meta rejects with the 24h window
 * error — which IS "respecting the 24-hour window"). Each log row is updated
 * to the real outcome; a successful retry clears the stored failure reason.
 * Capped at 50 per invocation so a runaway loop can't flood the gateway.
 */
export const retryFailedWhatsApp = action({
  args: {
    firmId: v.string(),
    userEmail: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ attempted: number; succeeded: number; stillFailed: number; errors: string[] }> => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const since = Date.now() - 24 * 60 * 60 * 1000;
    const logs: any[] = await ctx.runQuery(internal.communications.listFailedWhatsAppLogs, {
      firmId: auth.firmId,
      since,
    });
    let attempted = 0;
    let succeeded = 0;
    let stillFailed = 0;
    const errors: string[] = [];
    for (const log of logs.slice(0, 50)) {
      attempted++;
      try {
        const context = log.unitId
          ? await ctx.runQuery(internal.communications.getLogRecipientContext, { propertyId: log.unitId })
          : null;
        const res: any = await ctx.runAction(api.communications.sendWhatsApp, {
          firmId: auth.firmId,
          to: log.recipient,
          messageText: log.messageContent || log.messagePreview || "",
          fallback: {
            messageType: log.messageType || "custom",
            templateVarsData: {
              tenantName: context?.tenantName || undefined,
              amount: context?.rentAmount,
              serviceCharge: context?.serviceCharge,
              address: context?.propertyAddress,
              messageText: log.messageContent || log.messagePreview || "",
            },
          },
        });
        if (res?.success) {
          succeeded++;
        } else {
          stillFailed++;
          if (res?.error) errors.push(String(res.error).slice(0, 200));
        }
        // Correct the log row to the REAL outcome (same mutation the
        // scheduled-message dispatcher uses).
        await ctx.runMutation(internal.sentry.updateAutomationLogStatus, {
          logId: log._id,
          status: res?.success ? "sent" : "failed",
          errorMessage: res?.success ? undefined : res?.error,
          errorClass: res?.success ? undefined : res?.errorClass,
          messageId: res?.messageId,
        });
      } catch (e: any) {
        stillFailed++;
        const msg = e?.message || "Retry failed";
        errors.push(msg.slice(0, 200));
        try {
          await ctx.runMutation(internal.sentry.updateAutomationLogStatus, {
            logId: log._id,
            status: "failed",
            errorMessage: msg,
            errorClass: "unknown",
          });
        } catch { /* best-effort log correction */ }
      }
    }
    return { attempted, succeeded, stillFailed, errors: errors.slice(0, 5) };
  },
});
