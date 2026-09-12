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
import { action, query, mutation, internalMutation, internalAction, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";
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
    autoMappedCount?: number;
  }> => {
    // Auth first — the synced rows land in this firm's registry.
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    return await syncTemplatesForFirm(ctx, auth.firmId);
  },
});

// ─── AUTO-MAPPING (keyword matching) ─────────────────────────────────
// The user's ask (2026-09-12): "can we not have the templates synced
// already??" — zero manual configuration for a real SaaS. After every
// sync, each message type WITHOUT a mapping gets one automatically: score
// each APPROVED template by keyword hits (name counts double — it's the
// strongest signal; body text single), pick the best, and build a default
// variable order sized to the template's {{n}} count. The mapping is
// marked autoMapped so the UI can invite review without nagging.
export const TYPE_KEYWORDS: Record<string, string[]> = {
  rent_reminder: ["rent", "rental", "reminder", "payment", "due"],
  late_notice: ["late", "overdue", "arrears", "default", "demand", "notice"],
  payment_receipt: ["receipt", "confirm", "received", "acknowledg", "paid", "payment"],
  service_charge_alert: ["service", "charge", "levy", "estate", "fee"],
  access_restriction: ["access", "restrict", "gate", "suspend", "deactivat"],
  penalty_notice: ["penalt", "fine", "surcharge", "fee"],
  lease_renewal: ["renew", "lease", "expir"],
  welcome_note: ["welcome", "onboard", "intro"],
  promotion: ["promo", "offer", "discount", "sale"],
  vendor_update: ["vendor", "contractor", "supplier"],
  general_announcement: ["announce", "notice", "update", "news", "circular", "general"],
  maintenance_update: ["maintain", "maintenance", "repair", "fix", "inspection", "work"],
};

// Sensible default slot order per type (sliced/padded to the template's
// variable count). Payment-flavoured types lead with the amount; the rest
// lead with the tenant's name.
const TYPE_DEFAULT_VARS: Record<string, string[]> = {
  rent_reminder: ["tenantName", "amount", "address"],
  late_notice: ["tenantName", "amount", "address"],
  payment_receipt: ["tenantName", "amount", "address"],
  service_charge_alert: ["tenantName", "serviceCharge", "address"],
  penalty_notice: ["tenantName", "amount", "dueDate"],
  access_restriction: ["tenantName", "address", "firmName"],
  lease_renewal: ["tenantName", "address", "dueDate"],
  welcome_note: ["tenantName", "address", "firmName"],
  promotion: ["tenantName", "firmName", "messageText"],
  vendor_update: ["firmName", "messageText", "tenantName"],
  general_announcement: ["tenantName", "firmName", "messageText"],
  maintenance_update: ["tenantName", "address", "firmName"],
};
const PAD_FIELDS = ["firmName", "dueDate", "address", "messageText"] as const;

export interface SuggestedMapping {
  messageType: string;
  templateName: string;
  templateLanguage: string;
  varOrder: string[];
  score: number;
}

/**
 * Score one template for one message type (name token hit = 2, body
 * token hit = 1). Token-based: names are split on non-alphanumerics and
 * a keyword matches when a TOKEN STARTS WITH it — "late" must match
 * "late"/"lates" but NOT the "late" buried inside "unrelated".
 */
export function scoreTemplateForType(
  t: { name: string; bodyText?: string },
  messageType: string
): number {
  const kws = TYPE_KEYWORDS[messageType];
  if (!kws) return 0;
  const nameTokens = t.name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const bodyTokens = (t.bodyText || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  let score = 0;
  for (const k of kws) {
    if (nameTokens.some((w) => w.startsWith(k))) score += 2;
    else if (bodyTokens.some((w) => w.startsWith(k))) score += 1;
  }
  return score;
}

/** Default variable order for a type, sized to the template's slot count. */
export function defaultVarOrderFor(messageType: string, variableCount?: number): string[] {
  const base = TYPE_DEFAULT_VARS[messageType] || ["tenantName", "address", "firmName"];
  if (variableCount == null || variableCount <= 0) return [...base];
  const order: string[] = [];
  for (const f of base) { if (order.length >= variableCount) break; order.push(f); }
  for (const f of PAD_FIELDS) {
    if (order.length >= variableCount) break;
    if (!order.includes(f)) order.push(f);
  }
  return order;
}

/**
 * Pure auto-mapping suggestion: for each message type with keywords that
 * has no existing mapping, pick the best-scoring APPROVED template.
 * Tie-break: fewer variables (fewer slots to mismatch), then stable order.
 * Exported for tests — saveSettingsAndAutoMap below is what writes rows.
 */
export function suggestMappings(
  templates: WhatsAppTemplateInfo[],
  alreadyMappedTypes: Iterable<string>
): SuggestedMapping[] {
  const mapped = new Set(alreadyMappedTypes);
  const approved = templates.filter((t) => String(t.status).toUpperCase() === "APPROVED");
  const out: SuggestedMapping[] = [];
  for (const type of Object.keys(TYPE_KEYWORDS)) {
    if (mapped.has(type)) continue;
    let best: { t: WhatsAppTemplateInfo; score: number } | null = null;
    for (const t of approved) {
      const score = scoreTemplateForType(t, type);
      if (score <= 0) continue;
      if (
        !best ||
        score > best.score ||
        (score === best.score &&
          (t.variableCount ?? 3) < (best.t.variableCount ?? 3))
      ) {
        best = { t, score };
      }
    }
    if (best) {
      out.push({
        messageType: type,
        templateName: best.t.name,
        templateLanguage: best.t.language,
        varOrder: defaultVarOrderFor(type, best.t.variableCount),
        score: best.score,
      });
    }
  }
  return out;
}

/**
 * Core sync, callable by the authenticated action above AND the daily cron
 * below (which iterates every firm). Pulls templates → stores the registry
// → writes the whatsapp_settings snapshot (real phone, WABA — this is how
// the UI stops showing placeholder numbers) → auto-maps any message type
// that has no mapping yet. Failures are caught and recorded on the firm's
// settings row so the UI can show exactly why the last sync failed.
 */
async function syncTemplatesForFirm(ctx: any, firmId: string): Promise<{
  success: boolean;
  error?: string;
  templates?: WhatsAppTemplateInfo[];
  wabaId?: string;
  phoneDisplay?: string;
  pagesFetched?: number;
  autoMappedCount?: number;
}> {
  try {
    return await syncTemplatesInner(ctx, firmId);
  } catch (syncErr: any) {
    try {
      await ctx.runMutation(internal.whatsappTemplates.recordSyncFailure, {
        firmId,
        error: String(syncErr?.message || syncErr).slice(0, 500),
      });
    } catch { /* settings write is best-effort */ }
    return { success: false, error: String(syncErr?.message || syncErr) };
  }
}

/** The raw sync steps (throws on failure — syncTemplatesForFirm catches). */
async function syncTemplatesInner(ctx: any, firmId: string) {
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

    // 4) Replace the firm's registry snapshot (upsert-style wholesale swap),
    //    write the connection snapshot (real phone, WABA), and auto-map any
    //    message type that still has no mapping.
    await ctx.runMutation(internal.whatsappTemplates.replaceAllTemplates, {
      firmId,
      templates,
    });
    const approvedCount = templates.filter((t) => String(t.status).toUpperCase() === "APPROVED").length;
    const autoMappedCount = await ctx.runMutation(internal.whatsappTemplates.saveSettingsAndAutoMap, {
      firmId,
      wabaId,
      phoneDisplay,
      phoneId: PHONE_ID,
      templateCount: templates.length,
      approvedCount,
      templates: templates.map((t) => ({
        name: t.name,
        language: t.language,
        status: t.status,
        category: t.category,
        bodyText: t.bodyText,
        variableCount: t.variableCount,
        metaId: t.metaId,
      })),
    });

    return { success: true, templates, wabaId, phoneDisplay, pagesFetched, autoMappedCount };
}

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

// ─── Settings snapshot + auto-mapping (internal) ────────────────────────────
// Written at the end of every successful sync. The whatsapp_settings row is
// what the settings UI renders instead of placeholder phone numbers, and the
// auto-mappings make template sends work out of the box.
export const saveSettingsAndAutoMap = internalMutation({
  args: {
    firmId: v.string(),
    wabaId: v.optional(v.string()),
    phoneDisplay: v.optional(v.string()),
    phoneId: v.optional(v.string()),
    templateCount: v.number(),
    approvedCount: v.number(),
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
  handler: async (ctx, args): Promise<number> => {
    const now = Date.now();
    const existingSettings = await ctx.db
      .query("whatsapp_settings")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .first();
    const patch = {
      firmId: args.firmId,
      wabaId: args.wabaId,
      phoneDisplay: args.phoneDisplay,
      phoneId: args.phoneId,
      templateCount: args.templateCount,
      approvedCount: args.approvedCount,
      lastSyncAt: now,
      lastSyncSuccessAt: now,
      // "" clears a previous failure (Convex patch can't write undefined).
      lastSyncError: "" as string,
    };
    if (existingSettings) await ctx.db.patch(existingSettings._id, patch);
    else await ctx.db.insert("whatsapp_settings", patch);

    // Auto-map only types that have NO mapping yet — manual mappings are
    // never overwritten (the firm's explicit choice always wins).
    const existingMappings = await ctx.db
      .query("whatsapp_template_mappings")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();
    const suggestions = suggestMappings(args.templates, existingMappings.map((m) => m.messageType));
    for (const s of suggestions) {
      await ctx.db.insert("whatsapp_template_mappings", {
        firmId: args.firmId,
        messageType: s.messageType,
        templateName: s.templateName,
        templateLanguage: s.templateLanguage,
        varOrder: sanitizeVarOrder(s.varOrder),
        autoMapped: true,
        updatedBy: "system_auto_map",
        createdAt: now,
        updatedAt: now,
      });
    }
    return suggestions.length;
  },
});

// Record a sync failure on the settings row (best-effort diagnostics —
// the UI shows this instead of a dead-end "please try again").
export const recordSyncFailure = internalMutation({
  args: { firmId: v.string(), error: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("whatsapp_settings")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { lastSyncAt: now, lastSyncError: args.error });
    } else {
      await ctx.db.insert("whatsapp_settings", {
        firmId: args.firmId,
        lastSyncAt: now,
        lastSyncError: args.error,
      });
    }
    return { success: true };
  },
});

// ─── Internal read helpers for actions ──────────────────────────────────────
// Actions read the db via ctx.runQuery (ctx.db isn't available in actions).
export const getFirmTemplateMappingInternal = internalQuery({
  args: { firmId: v.string(), messageType: v.string() },
  handler: async (ctx, args) => {
    return (await ctx.db
      .query("whatsapp_template_mappings")
      .withIndex("by_firm_type", (q) => q.eq("firmId", args.firmId).eq("messageType", args.messageType))
      .first()) ?? null;
  },
});

export const listFirmIds = internalQuery({
  args: {},
  handler: async (ctx) => {
    const firms = await ctx.db.query("firms").collect();
    return firms.map((f) => String(f._id));
  },
});

// ─── READ: connection snapshot for the settings UI ─────────────────────────
export const getWhatsAppSettings = query({
  args: { sessionToken: v.optional(v.string()), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    return (await ctx.db
      .query("whatsapp_settings")
      .withIndex("by_firm", (q) => q.eq("firmId", auth.firmId))
      .first()) ?? null;
  },
});

// ─── CRON: keep every firm's registry + mappings fresh, daily ───────────────
// "can we not have the templates synced already??" — yes. Runs before the
// morning reminder crons so a template approved yesterday is already mapped
// when today's reminders go out. The Chakra gateway is platform-level (all
// firms share the WABA), so every firm gets the same registry snapshot.
export const syncAllFirms = internalAction({
  args: {},
  handler: async (ctx, _args) => {
    // Actions read the db via runQuery (ctx.db isn't available in actions).
    const firmIds: string[] = await ctx.runQuery(internal.whatsappTemplates.listFirmIds, {});
    let ok = 0, failed = 0;
    const errors: string[] = [];
    for (const firmId of firmIds) {
      try {
        const res = await syncTemplatesForFirm(ctx, firmId);
        if (res.success) ok++; else { failed++; if (res.error) errors.push(`${firmId}: ${res.error}`); }
      } catch (e: any) {
        failed++;
        errors.push(`${firmId}: ${e?.message || e}`);
      }
    }
    if (errors.length) console.warn("[syncAllFirms] failures:", errors.slice(0, 5));
    return { ok, failed, errors: errors.slice(0, 5) };
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
