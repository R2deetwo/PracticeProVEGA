/**
 * WhatsApp Template Registry — sync the firm's REAL Meta-approved templates
 * into the app and store the per-message-type mapping.
 *
 * WHY THIS EXISTS (2026-09-12, user report: "my template is not the same as
 * what you have in the app; the Meta and PracticePro templates are not the
 * same"): the app previously hardcoded template names/variables
 * ("atrium_rent_reminder" + [name, amount, address]) that were GUESSES.
 * Meta matches templates by exact name + language, so any mismatch fails
 * the send. Now the app asks Meta (through the Chakra pass-through) for
 * the templates that actually exist on the account, stores them, and lets
 * the firm map each message type to one of them — with the variable order
 * chosen to match the template's placeholder count.
 *
 * Chakra API surface used (apidocs.chakrahq.com):
 *   GET /v1/ext/whatsapp-phone-number
 *        → { _data: [{ id, waba, displayPhoneNumber, ... }] }
 *        (team-scoped bearer; gives us the WABA id for our phone number)
 *   GET /v1/ext/whatsapp-business-account?pluginId=…
 *        → { _data: [{ id, name, ... }] } (fallback WABA discovery)
 *   GET /v1/ext/plugin/whatsapp/api/{ver}/{wabaId}/message_templates?limit=…
 *        → { data: [{ name, components, language, status, category, id }],
 *            paging: { cursors: { after } } }  (Meta pass-through)
 *
 * Error envelope (Chakra docs "Response Format"):
 *   { _data, _meta, _errors: ["..."] } — parsed by extractWaError in
 *   communications.ts; never surface "Unknown WhatsApp gateway error" again.
 */
import { action, query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requireFirmUser } from "./authHelpers";
import { extractWaError, explainWhatsAppError, normalisePhoneForMeta } from "./communications";

// ─── Env (same vars sendWhatsApp uses) ──────────────────────────────────────
function chakraCreds() {
  return {
    TOKEN: process.env.CHAKRA_ACCESS_TOKEN,
    PLUGIN_ID: process.env.CHAKRA_PLUGIN_ID,
    PHONE_ID: process.env.CHAKRA_PHONE_NUMBER_ID,
    WA_VER: process.env.CHAKRA_WA_API_VERSION || "v19.0",
  };
}

const CHAKRA_BASE = "https://api.chakrahq.com/v1/ext";

// ─── Types ───────────────────────────────────────────────────────────────────
export interface WhatsAppTemplateInfo {
  name: string;
  language: string;
  status: string;
  category?: string;
  bodyText?: string;
  variableCount?: number;
  metaId?: string;
}

/** Parse a Meta template list entry into the app-friendly shape. */
export function normalizeTemplate(raw: any): WhatsAppTemplateInfo | null {
  if (!raw || typeof raw.name !== "string") return null;
  const body = Array.isArray(raw.components)
    ? raw.components.find((c: any) => (c?.type || "").toUpperCase() === "BODY")
    : undefined;
  const bodyText = typeof body?.text === "string" ? body.text : undefined;
  let variableCount = 0;
  if (bodyText) {
    const slots = [...bodyText.matchAll(/\{\{(\d+)\}\}/g)].map((m) => parseInt(m[1], 10));
    variableCount = slots.length ? Math.max(...slots) : 0;
  }
  return {
    name: raw.name,
    language: String(raw.language || "en"),
    status: String(raw.status || "UNKNOWN"),
    category: raw.category ? String(raw.category) : undefined,
    bodyText,
    variableCount: bodyText ? variableCount : undefined,
    metaId: raw.id ? String(raw.id) : undefined,
  };
}

// ─── SYNC: pull the firm's real templates from Meta ─────────────────────────
export const syncWhatsAppTemplates = action({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()), // accepted for signature-compat, ignored (bearer-only)
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    error?: string;
    templates?: WhatsAppTemplateInfo[];
    wabaId?: string;
    phoneDisplay?: string;
    pagesFetched?: number;
  }> => {
    // Auth first — the synced rows land in this firm's registry.
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const firmId = auth.firmId;

    const { TOKEN, PLUGIN_ID, PHONE_ID, WA_VER } = chakraCreds();
    if (!TOKEN || !PHONE_ID) {
      return {
        success: false,
        error: "WhatsApp gateway is not configured on this deployment (missing CHAKRA_ACCESS_TOKEN / CHAKRA_PHONE_NUMBER_ID in the Convex environment).",
      };
    }

    const headers = {
      "Authorization": `Bearer ${TOKEN}`,
      "Accept": "application/json",
    };

    // 1) Resolve the WABA id for our configured phone number.
    let wabaId: string | undefined;
    let phoneDisplay: string | undefined;
    try {
      const phoneRes = await fetch(`${CHAKRA_BASE}/whatsapp-phone-number`, { headers });
      const phoneRaw = await phoneRes.text();
      let phoneData: any = null;
      try { phoneData = phoneRaw ? JSON.parse(phoneRaw) : null; } catch { phoneData = null; }
      if (phoneData?._data && Array.isArray(phoneData._data)) {
        const mine = phoneData._data.find((p: any) => String(p.id) === String(PHONE_ID));
        if (mine?.waba) {
          wabaId = String(mine.waba);
          phoneDisplay = mine.displayPhoneNumber ? String(mine.displayPhoneNumber) : undefined;
        } else if (phoneData._data.length === 1) {
          // Only one number on the team — safe default even if ids drift.
          wabaId = String(phoneData._data[0].waba);
          phoneDisplay = phoneData._data[0].displayPhoneNumber ? String(phoneData._data[0].displayPhoneNumber) : undefined;
        }
      } else {
        const parsedErr = extractWaError(phoneData);
        if (!phoneRes.ok) {
          return {
            success: false,
            error: `Could not list WhatsApp phone numbers (HTTP ${phoneRes.status})${parsedErr ? `: ${parsedErr}` : phoneRaw ? `: ${phoneRaw.slice(0, 200)}` : ""}`,
          };
        }
      }
    } catch (e: any) {
      return { success: false, error: `Phone-number lookup failed: ${e?.message || e}` };
    }

    // 2) Fallback: list WABAs for the team (optionally filtered by plugin).
    if (!wabaId) {
      try {
        const url = PLUGIN_ID
          ? `${CHAKRA_BASE}/whatsapp-business-account?pluginId=${encodeURIComponent(PLUGIN_ID)}`
          : `${CHAKRA_BASE}/whatsapp-business-account`;
        const wabaRes = await fetch(url, { headers });
        const wabaRaw = await wabaRes.text();
        let wabaData: any = null;
        try { wabaData = wabaRaw ? JSON.parse(wabaRaw) : null; } catch { wabaData = null; }
        const list = Array.isArray(wabaData?._data) ? wabaData._data : [];
        const connected = list.find((w: any) => (w.chakraStatus || "").toUpperCase() === "CONNECTED") || list[0];
        if (connected?.id) wabaId = String(connected.id);
      } catch (e: any) {
        return { success: false, error: `WABA lookup failed: ${e?.message || e}` };
      }
    }

    if (!wabaId) {
      return {
        success: false,
        error: "Could not resolve the WhatsApp Business Account (WABA) for this gateway. Verify the Chakra plugin is connected and CHAKRA_PHONE_NUMBER_ID is correct.",
      };
    }

    // 3) Page through Meta's message_templates for the WABA.
    const templates: WhatsAppTemplateInfo[] = [];
    let pagesFetched = 0;
    let after: string | undefined;
    try {
      do {
        const url = `${CHAKRA_BASE}/plugin/whatsapp/api/${WA_VER}/${wabaId}/message_templates?limit=100${after ? `&after=${encodeURIComponent(after)}` : ""}`;
        const res = await fetch(url, { headers });
        const raw = await res.text();
        let data: any = null;
        try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
        if (!res.ok || !data) {
          const parsedErr = extractWaError(data);
          return {
            success: false,
            error: explainWhatsAppError(parsedErr) ||
              `Template listing failed (HTTP ${res.status})${raw ? `: ${raw.slice(0, 200)}` : ""}`,
          };
        }
        const page = Array.isArray(data?.data) ? data.data : [];
        for (const raw2 of page) {
          const t = normalizeTemplate(raw2);
          if (t) templates.push(t);
        }
        pagesFetched++;
        after = data?.paging?.cursors?.after;
        // Meta stops returning `next`/`after` on the last page; guard against
        // a server that echoes the same cursor forever.
        if (pagesFetched > 5) break;
      } while (after);
    } catch (e: any) {
      return { success: false, error: `Template listing request failed: ${e?.message || e}` };
    }

    // 4) Replace the firm's registry snapshot (upsert-style wholesale swap).
    await ctx.runMutation(internal.whatsappTemplates.replaceAllTemplates, {
      firmId,
      templates,
    });

    return { success: true, templates, wabaId, phoneDisplay, pagesFetched };
  },
});

// ─── Registry swap (internal — only syncWhatsAppTemplates calls it) ─────────
export const replaceAllTemplates = internalMutation({
  args: {
    firmId: v.string(),
    templates: v.array(v.object({
      name: v.string(),
      language: v.string(),
      status: v.string(),
      category: v.optional(v.string()),
      bodyText: v.optional(v.string()),
      variableCount: v.optional(v.number()),
      metaId: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("whatsapp_templates")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();
    await Promise.all(existing.map((doc) => ctx.db.delete(doc._id)));
    const now = Date.now();
    await Promise.all(args.templates.map((t) => ctx.db.insert("whatsapp_templates", {
      firmId: args.firmId,
      ...t,
      syncedAt: now,
    })));
    return { stored: args.templates.length };
  },
});

// ─── READ: templates registry + mappings ────────────────────────────────────
export const getWhatsAppTemplates = query({
  args: { sessionToken: v.optional(v.string()), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const docs = await ctx.db
      .query("whatsapp_templates")
      .withIndex("by_firm", (q) => q.eq("firmId", auth.firmId))
      .collect();
    return docs.sort((a, b) =>
      a.name === b.name ? a.language.localeCompare(b.language) : a.name.localeCompare(b.name)
    );
  },
});

export const getWhatsAppTemplateMappings = query({
  args: { sessionToken: v.optional(v.string()), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    return await ctx.db
      .query("whatsapp_template_mappings")
      .withIndex("by_firm", (q) => q.eq("firmId", auth.firmId))
      .collect();
  },
});

// ─── WRITE: save the per-message-type mapping ───────────────────────────────
const VAR_ORDER_FIELDS = [
  "tenantName", "amount", "totalPayable", "serviceCharge",
  "address", "firmName", "dueDate", "messageText",
] as const;
type VarOrderField = (typeof VAR_ORDER_FIELDS)[number];

function sanitizeVarOrder(varOrder: string[] | undefined): VarOrderField[] | undefined {
  if (!varOrder) return undefined;
  const cleaned = varOrder.filter((f): f is VarOrderField =>
    (VAR_ORDER_FIELDS as readonly string[]).includes(f)
  );
  return cleaned.length ? [...cleaned] : undefined;
}

export const saveWhatsAppTemplateMapping = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    messageType: v.string(),
    templateName: v.string(),
    templateLanguage: v.string(),
    varOrder: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const existing = await ctx.db
      .query("whatsapp_template_mappings")
      .withIndex("by_firm_type", (q) => q.eq("firmId", auth.firmId).eq("messageType", args.messageType))
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        templateName: args.templateName,
        templateLanguage: args.templateLanguage,
        varOrder: sanitizeVarOrder(args.varOrder),
        updatedBy: auth.userId,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("whatsapp_template_mappings", {
        firmId: auth.firmId,
        messageType: args.messageType,
        templateName: args.templateName,
        templateLanguage: args.templateLanguage,
        varOrder: sanitizeVarOrder(args.varOrder),
        updatedBy: auth.userId,
        createdAt: now,
        updatedAt: now,
      });
    }
    return { success: true };
  },
});

export const deleteWhatsAppTemplateMapping = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    messageType: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const existing = await ctx.db
      .query("whatsapp_template_mappings")
      .withIndex("by_firm_type", (q) => q.eq("firmId", auth.firmId).eq("messageType", args.messageType))
      .first();
    if (existing) await ctx.db.delete(existing._id);
    return { success: true };
  },
});

// ─── DIAGNOSTIC: send a test template and return the RAW provider response ──
// The UI shows the exact provider text — if Meta rejects the name, language,
// params or recipient, the reason is displayed verbatim instead of being
// swallowed into "Unknown WhatsApp gateway error".
export const testWhatsAppTemplate = action({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    templateName: v.string(),
    templateLanguage: v.string(),
    testPhone: v.string(),          // the admin's own WhatsApp number
    templateVars: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    httpStatus?: number;
    rawResponse?: string;
    error?: string;
    messageId?: string;
  }> => {
    await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const { TOKEN, PLUGIN_ID, PHONE_ID, WA_VER } = chakraCreds();
    if (!TOKEN || !PLUGIN_ID || !PHONE_ID) {
      return { success: false, error: "WhatsApp gateway not configured (missing Chakra env vars)." };
    }
    const to = normalisePhoneForMeta(args.testPhone);
    if (!to) {
      return { success: false, error: `"${args.testPhone}" is not a valid phone number — use international format, e.g. +2348012345678.` };
    }
    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: args.templateName,
        language: { code: args.templateLanguage || "en" },
        components: args.templateVars?.length
          ? [{ type: "body", parameters: args.templateVars.map((t) => ({ type: "text", text: t })) }]
          : [],
      },
    };
    const url = `${CHAKRA_BASE}/plugin/whatsapp/${PLUGIN_ID}/api/${WA_VER}/${PHONE_ID}/messages`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Authorization": `Bearer ${TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const raw = await res.text();
      let data: any = null;
      try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
      const messageId = data?.messages?.[0]?.id;
      const parsedErr = data ? extractWaError(data) : null;
      return {
        success: res.ok && !!messageId,
        httpStatus: res.status,
        rawResponse: raw.slice(0, 2000),
        error: res.ok && messageId ? undefined : (explainWhatsAppError(parsedErr) || (raw ? raw.slice(0, 300) : `HTTP ${res.status} with empty body`)),
        messageId,
      };
    } catch (e: any) {
      return { success: false, error: `Request failed: ${e?.message || e}` };
    }
  },
});
