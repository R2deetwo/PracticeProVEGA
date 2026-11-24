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
//
// 2026-11-24 — TWO hardening rules (owner directive: "for the bank
// details, it should carry the firm's own default account from settings"):
//   1. A mapping requires at least ONE NAME-TOKEN hit. Body-only hits
//      proved too weak: the shared footer "Please use your property
//      address as the payment reference" matched the `payment` keyword,
//      so payment_receipt (and general_announcement) auto-mapped to
//      semantically wrong templates.
//   2. varOrder is BODY-AWARE: slots preceded by "Bank:" / "Account
//      Name:" / "Account Number:" / "… days overdue" / "Due Date:" /
//      "of NGN {{n}}" labels are pinned to bankName/accountName/
//      accountNumber/daysOverdue/dueDate/amount — never guessed from the
//      generic pad list. Before this, the six-slot atrium_rent_reminder
//      mapped [tenantName, amount, address, firmName, dueDate,
//      messageText] — so a resident's reminder read "Bank: <firm name>…
//      Account Number: <message text>". The bank slots now carry the
//      FIRM'S OWN DEFAULT ACCOUNT (Settings → Financial Configuration),
//      resolved at send time in communications.ts (fallback copy when
//      the firm has not set an account — never a fake number).
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
  // ── Vega (legal practice) message types — 2026-11-24. The templates are
  // created on the platform WABA by createVegaTemplates below; these
  // keyword sets let the auto-mapper pick them up per firm. court_reminder
  // is ALREADY a live server flow (proactive.ts schedules it for matters
  // with a nextAdjournedDate), so mapping it makes that flow
  // template-capable without any union/type change.
  court_reminder: ["court", "hearing", "case", "adjourn", "mention", "trial"],
  invoice_reminder: ["invoice", "bill", "payment"],
  document_ready: ["document", "ready", "prepared", "draft"],
  appointment_reminder: ["appointment", "consultation", "meeting"],
  engagement_followup: ["engagement", "follow", "consulted"],
};

// Sensible default slot order per type (sliced/padded to the template's
// variable count). Payment-flavoured types lead with the amount; the rest
// lead with the tenant's name.
export const TYPE_DEFAULT_VARS: Record<string, string[]> = {
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
  // ── Vega types — var orders mirror the vega_* template bodies created
  // by createVegaTemplates below (invoice_reminder's trailing bank slots
  // are pinned by the "Bank:/Account Name:/Account Number:" labels).
  court_reminder: ["tenantName", "messageText", "dueDate", "address"],
  invoice_reminder: ["tenantName", "messageText", "amount", "dueDate", "bankName", "accountName", "accountNumber"],
  document_ready: ["tenantName", "messageText"],
  appointment_reminder: ["tenantName", "dueDate", "messageText"],
  engagement_followup: ["tenantName"],
};
const PAD_FIELDS = ["firmName", "dueDate", "address", "messageText"] as const;

/** Fields that must NEVER be guessed into a varOrder by padding — bank
 * slots are only ever pinned by body-label inference (or a type's declared
 * defaults), and their VALUES are resolved at send time from the firm's
 * default account (Settings → Financial Configuration). */
const BANK_VAR_FIELDS = ["bankName", "accountName", "accountNumber"] as const;

// ─── BODY-AWARE SLOT INFERENCE ─────────────────────────────────────────────
// The firm's real Meta templates label their payment slots inline
// ("Pay to:\nBank: {{6}}\nAccount Name: {{7}}\nAccount Number: {{8}}").
// Parsing those labels pins each slot to the right app field instead of
// padding with firmName/dueDate/messageText — the 2026-11-24 fix for
// bank slots carrying the wrong data.
export const BODY_SLOT_PATTERNS: { pattern: RegExp; field: string }[] = [
  { pattern: /bank\s*name\s*:\s*\{\{(\d+)\}\}/i, field: "bankName" },
  { pattern: /bank\s*:\s*\{\{(\d+)\}\}/i, field: "bankName" },
  { pattern: /account\s*name\s*:\s*\{\{(\d+)\}\}/i, field: "accountName" },
  { pattern: /account\s*number\s*:\s*\{\{(\d+)\}\}/i, field: "accountNumber" },
  { pattern: /\{\{(\d+)\}\}\s*days?\s+overdue/i, field: "daysOverdue" },
  { pattern: /due\s*date\s*:\s*\{\{(\d+)\}\}/i, field: "dueDate" },
  { pattern: /(?:of|is)\s+(?:NGN|₦|N)\s*\{\{(\d+)\}\}/i, field: "amount" },
  { pattern: /your\s+\{\{(\d+)\}\}\s+of\b/i, field: "paymentKind" },
  { pattern: /\bfor\s+\{\{(\d+)\}\}/i, field: "address" },
];

/** slot number (1-based) → field name, for every labeled slot found. */
export function inferLabeledSlots(bodyText?: string): Record<number, string> {
  const out: Record<number, string> = {};
  if (!bodyText) return out;
  for (const { pattern, field } of BODY_SLOT_PATTERNS) {
    const m = bodyText.match(pattern);
    if (m) {
      const slot = parseInt(m[1], 10);
      if (!Number.isNaN(slot) && slot > 0) out[slot] = field;
    }
  }
  return out;
}

/**
 * Body-aware default variable order for a (messageType, template) pair:
 * labeled slots are pinned exactly, the remaining positions are filled
 * left-to-right from the type's defaults (then pad fields). Bank fields
 * only ever enter via labels or the type's declared defaults — never via
 * padding. Always returns exactly `variableCount` entries so a template
 * send can never ship fewer params than the body has slots.
 */
export function varOrderForTemplate(
  messageType: string,
  template: { variableCount?: number; bodyText?: string }
): string[] {
  const labeled = inferLabeledSlots(template.bodyText);
  const count = template.variableCount ?? 0;
  const size = count > 0
    ? count
    : Math.max(
        ...Object.keys(labeled).map(Number),
        (TYPE_DEFAULT_VARS[messageType] || ["tenantName", "address", "firmName"]).length,
        0,
      );
  if (size <= 0) return [];

  const base = TYPE_DEFAULT_VARS[messageType] || ["tenantName", "address", "firmName"];
  const candidates = [...base, ...PAD_FIELDS, "messageText"].filter(
    (f, i, a) => a.indexOf(f) === i && !(BANK_VAR_FIELDS as readonly string[]).includes(f)
  );

  const order: string[] = new Array(size).fill("");
  for (const [slot, field] of Object.entries(labeled)) {
    const idx = Number(slot) - 1;
    if (idx >= 0 && idx < size) order[idx] = field;
  }
  let ci = 0;
  for (let i = 0; i < size; i++) {
    if (order[i]) continue;
    while (ci < candidates.length && order.includes(candidates[ci])) ci++;
    order[i] = ci < candidates.length ? candidates[ci] : "messageText";
    ci++;
  }
  return order;
}

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
  return nameTokenHits(t, messageType) * 2 + bodyTokenHits(t, messageType);
}

/** How many keywords hit the template NAME tokens (the strong signal). */
export function nameTokenHits(
  t: { name: string; bodyText?: string },
  messageType: string
): number {
  const kws = TYPE_KEYWORDS[messageType];
  if (!kws) return 0;
  const nameTokens = t.name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  let hits = 0;
  for (const k of kws) {
    if (nameTokens.some((w) => w.startsWith(k))) hits++;
  }
  return hits;
}

/** How many keywords hit the template BODY tokens (the weak signal). */
function bodyTokenHits(
  t: { name: string; bodyText?: string },
  messageType: string
): number {
  const kws = TYPE_KEYWORDS[messageType];
  if (!kws) return 0;
  const bodyTokens = (t.bodyText || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  let hits = 0;
  for (const k of kws) {
    if (bodyTokens.some((w) => w.startsWith(k))) hits++;
  }
  return hits;
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
      // 2026-11-24: a NAME-token hit is REQUIRED for eligibility.
      // Body-only hits matched shared footers ("payment reference") and
      // produced semantically wrong mappings.
      if (nameTokenHits(t, type) === 0) continue;
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
        // Body-aware order: labeled slots (Bank:/Account Name:/Account
        // Number:/days overdue/…) are pinned so bank slots carry the
        // firm's default account at send time.
        varOrder: varOrderForTemplate(type, best.t),
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

/**
 * The firm's DEFAULT bank account (Settings → Financial Configuration):
 * the account flagged isDefault, falling back to the first listed
 * account. Returns null when the firm has not set ANY account — callers
 * then use the honest "contact the office" fallback copy instead of a
 * fake number (2026-11-24 owner directive: "for the bank details, it
 * should carry the firm's own default account from settings … what
 * happens if they have not set the account?").
 */
export const getFirmDefaultBankAccountInternal = internalQuery({
  args: { firmId: v.string() },
  handler: async (ctx, args): Promise<{ bankName: string; accountName: string; accountNumber: string } | null> => {
    const firm: any = await ctx.db.get(args.firmId as any).catch(() => null);
    const accounts: any[] = Array.isArray(firm?.bankAccounts) ? firm.bankAccounts : [];
    const acct = accounts.find((a: any) => a && a.isDefault) || accounts[0] || null;
    if (!acct || !acct.accountNumber) return null;
    return {
      bankName: String(acct.bankName || ""),
      accountName: String(acct.accountName || firm?.name || ""),
      accountNumber: String(acct.accountNumber || ""),
    };
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
  // 2026-11-24 — the payment-slot fields (bank details carry the firm's
  // own default account from Settings → Financial Configuration;
  // paymentKind = "rent"/"service charge"/"invoice" style label;
  // daysOverdue = the "{{n}} days overdue" slot on late templates).
  "bankName", "accountName", "accountNumber", "paymentKind", "daysOverdue",
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

// ─── VEGA WHATSAPP TEMPLATES — created directly via the API ────────────────
// Owner directive (2026-11-24): "for the vega templates, try to create them
// directly via the API on my account." The platform WABA (all firms share
// it) had exactly three APPROVED templates — all Atrium/property. Vega
// (legal practice) had NONE, so every business-initiated legal WhatsApp
// flow outside the 24-hour window (court reminders, invoice chasers,
// document-ready notes) had no template to fall back on and failed with
// Meta error 131047.
//
// The definitions below are POSTed to Meta through the Chakra pass-through
// (same surface the sync reads from) by createVegaTemplates. Meta reviews
// new templates (status PENDING → APPROVED/REJECTED); the daily
// syncAllFirms cron then lands them in every firm's registry and the
// auto-mapper (TYPE_KEYWORDS above) maps the Vega message types — the
// court_reminder flow in proactive.ts becomes template-capable with zero
// manual configuration.
//
// House style mirrors the approved Atrium bodies ("Hello {{1}}, …"), and
// the invoice reminder carries the same "Pay to: Bank/Account Name/
// Account Number" block so the body-aware slot inference pins those slots
// to the FIRM'S OWN default bank account.

export interface VegaTemplateDef {
  name: string;
  category: "UTILITY" | "MARKETING";
  bodyText: string;
  /** The message type the auto-mapper should map it to. */
  messageType: string;
  /** Sample values per {{n}} slot, in order — Meta's create payload
   * requires example.body_text for BODY components with variables, and
   * the automated reviewer evaluates them (round 1 created without
   * examples and every template was auto-REJECTED). */
  exampleVars: string[];
}

export const VEGA_TEMPLATE_DEFS: VegaTemplateDef[] = [
  {
    name: "vega_invoice_reminder",
    category: "UTILITY",
    messageType: "invoice_reminder",
    // House style = the APPROVED atrium_rent_reminder shape (same "Pay to:"
    // block, same payment-reference footer). Round 1 (2026-11-24) lessons:
    //   - no firm name as a VARIABLE ("from {{4}}") — Meta rejects templates
    //     where the sender identity is a fill-in slot;
    //   - transactional phrasing only ("This is a reminder that…", matching
    //     the approved atrium_late_reminder) — Meta's July-2025 auto-
    //     categorizer classifies by TEXT, and a payment reminder it reads as
    //     promotional gets filed MARKETING and rejected;
    //   - example.body_text is required for variable review.
    bodyText:
      "Hello {{1}},\n\n" +
      "This is a reminder that your invoice {{2}} of NGN {{3}} is due on {{4}}.\n\n" +
      "Pay to:\nBank: {{5}}\nAccount Name: {{6}}\nAccount Number: {{7}}\n\n" +
      "Please use the invoice number as your payment reference. Thank you.",
    exampleVars: ["Tunde Adeyemi", "INV-2026-089", "1,400,000", "15 December 2026", "Providus Bank", "Acme Chambers", "0123456789"],
  },
  {
    name: "vega_court_reminder",
    category: "UTILITY",
    messageType: "court_reminder",
    // Round 1 failed HTTP 400 (code 100) — the em dash in the closing
    // signature. ASCII-only closings now (the approved atrium bodies are
    // ASCII-only too).
    bodyText:
      "Hello {{1}},\n\n" +
      "This is a reminder that the next hearing in {{2}} comes up on {{3}} at {{4}}.\n\n" +
      "Please be seated before the case is called. Kindly reach out if you need copies of the processes before the date.\n\n" +
      "Thank you.",
    exampleVars: ["Tunde Adeyemi", "Adeyemi v. Kola", "15 December 2026", "Lagos High Court, Ikeja"],
  },
  {
    name: "vega_document_ready",
    category: "UTILITY",
    messageType: "document_ready",
    bodyText:
      "Hello {{1}},\n\n" +
      "Your {{2}} has been prepared and is ready for your review in your client portal.\n\n" +
      "Kindly review and revert with any comments or approvals.\n\n" +
      "Thank you.",
    exampleVars: ["Tunde Adeyemi", "Tenancy Agreement"],
  },
  {
    name: "vega_appointment_reminder",
    category: "UTILITY",
    messageType: "appointment_reminder",
    bodyText:
      "Hello {{1}},\n\n" +
      "This is a reminder of your consultation on {{2}} at {{3}}.\n\n" +
      "If you need to reschedule, kindly reply to this message.\n\n" +
      "Thank you.",
    exampleVars: ["Tunde Adeyemi", "15 December 2026", "10:00 AM at our office"],
  },
  {
    name: "vega_engagement_followup",
    category: "MARKETING",
    messageType: "engagement_followup",
    // Round 1 was auto-REJECTED with "meeting with {{2}}" (firm name as a
    // variable — same sender-identity rule as the invoice template).
    bodyText:
      "Hello {{1}},\n\n" +
      "Thank you for meeting with us. If you would like us to proceed with your matter, simply reply to this message and we will send the next steps and our engagement terms.\n\n" +
      "We look forward to working with you.",
    exampleVars: ["Tunde Adeyemi"],
  },
];

/**
 * Create the Vega templates on the platform WABA, directly through the
 * Chakra pass-through (Meta Graph: POST /{waba-id}/message_templates).
 *
 * INTERNAL action — invocable only with the production deploy key (the
 * same admin trust as whatsappDiagnostics), never from a client. The
 * Chakra token itself never leaves the Convex environment.
 *
 * Idempotent: names that already exist on the account are skipped
 * (reported as "exists" with their live status). dryRun=true lists what
 * WOULD be created without POSTing.
 */
export const createVegaTemplates = internalAction({
  args: {
    dryRun: v.optional(v.boolean()),
    names: v.optional(v.array(v.string())), // subset filter
    // INSPECT mode: GET each vega_* template by name (single-template
    // fetches include Meta's rejected_reason, the bulk listing does not)
    // and return status + reason without creating anything.
    inspect: v.optional(v.boolean()),
    // Graph API version override for creation (defaults to the deployment's
    // CHAKRA_WA_API_VERSION, currently v19.0). Chakra's own docs create
    // with v24.0; pass e.g. "v24.0" to match.
    apiVersion: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    wabaId?: string;
    results: Array<{
      name: string;
      outcome: "created" | "exists" | "failed" | "dry_run";
      httpStatus?: number;
      status?: string; // Meta template status when known
      error?: string;
    }>;
  }> => {
    const { TOKEN, PLUGIN_ID, PHONE_ID } = chakraCreds();
    const WA_VER = args.apiVersion || process.env.CHAKRA_WA_API_VERSION || "v19.0";
    if (!TOKEN || !PHONE_ID) {
      return {
        success: false,
        results: [{ name: "*", outcome: "failed", error: "WhatsApp gateway not configured (missing CHAKRA_ACCESS_TOKEN / CHAKRA_PHONE_NUMBER_ID)." }],
      };
    }
    const headers = {
      "Authorization": `Bearer ${TOKEN}`,
      "Accept": "application/json",
      "Content-Type": "application/json",
    };

    // 1) Resolve the WABA id (same discovery as the sync).
    let wabaId: string | undefined;
    try {
      const phoneRes = await fetch(`${CHAKRA_BASE}/whatsapp-phone-number`, { headers });
      const phoneRaw = await phoneRes.text();
      let phoneData: any = null;
      try { phoneData = phoneRaw ? JSON.parse(phoneRaw) : null; } catch { phoneData = null; }
      const list = Array.isArray(phoneData?._data) ? phoneData._data : [];
      const mine = list.find((p: any) => String(p.id) === String(PHONE_ID)) || list[0];
      if (mine?.waba) wabaId = String(mine.waba);
    } catch (e: any) {
      return { success: false, results: [{ name: "*", outcome: "failed", error: `Phone-number lookup failed: ${e?.message || e}` }] };
    }
    if (!wabaId) {
      return { success: false, results: [{ name: "*", outcome: "failed", error: "Could not resolve the WABA id for the configured phone number." }] };
    }

    // 2) List existing template names (idempotency check + live status).
    const existing = new Map<string, string>(); // name(lowercased) → status
    try {
      let after: string | undefined;
      let pages = 0;
      do {
        const url = `${CHAKRA_BASE}/plugin/whatsapp/api/${WA_VER}/${wabaId}/message_templates?limit=100${after ? `&after=${encodeURIComponent(after)}` : ""}`;
        const res = await fetch(url, { headers });
        const raw = await res.text();
        let data: any = null;
        try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
        if (!res.ok || !data) break;
        for (const t of (Array.isArray(data?.data) ? data.data : [])) {
          if (t?.name) existing.set(String(t.name).toLowerCase(), String(t.status || "UNKNOWN"));
        }
        after = data?.paging?.cursors?.after;
        pages++;
      } while (after && pages < 5);
    } catch { /* listing is best-effort — creation still attempts */ }

    const defs = VEGA_TEMPLATE_DEFS.filter(
      (d) => !args.names?.length || args.names.includes(d.name)
    );

    // 2b) INSPECT mode: per-template GET (rejected_reason included).
    if (args.inspect) {
      const details: Array<{ name: string; found: boolean; status?: string; category?: string; rejectedReason?: string; error?: string }> = [];
      for (const def of defs) {
        try {
          const url = `${CHAKRA_BASE}/plugin/whatsapp/api/${WA_VER}/${wabaId}/message_templates?name=${encodeURIComponent(def.name)}`;
          const res = await fetch(url, { headers });
          const raw = await res.text();
          let data: any = null;
          try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
          const row = Array.isArray(data?.data) && data.data[0] ? data.data[0] : data;
          if (row?.name) {
            details.push({
              name: def.name, found: true,
              status: String(row.status || "UNKNOWN"),
              category: row.category ? String(row.category) : undefined,
              rejectedReason: row.rejected_reason ? String(row.rejected_reason) : undefined,
            });
          } else {
            const parsedErr = data ? extractWaError(data) : null;
            details.push({ name: def.name, found: false, error: parsedErr || (raw ? raw.slice(0, 200) : `HTTP ${res.status}`) });
          }
        } catch (e: any) {
          details.push({ name: def.name, found: false, error: `Request failed: ${e?.message || e}` });
        }
      }
      return { success: true, wabaId, results: details as any };
    }

    // 3) POST each missing template through the pass-through.
    const results: Array<{ name: string; outcome: "created" | "exists" | "failed" | "dry_run"; httpStatus?: number; status?: string; error?: string }> = [];
    for (const def of defs) {
      const existingStatus = existing.get(def.name.toLowerCase());
      if (existingStatus && existingStatus.toUpperCase() !== "REJECTED") {
        results.push({ name: def.name, outcome: "exists", status: existingStatus });
        continue;
      }
      // A REJECTED template occupies the name but is unusable. Delete it
      // first (best-effort through the pass-through) so the corrected body
      // can be recreated under the same name.
      if (existingStatus) {
        try {
          const delUrl = `${CHAKRA_BASE}/plugin/whatsapp/api/${WA_VER}/${wabaId}/message_templates?name=${encodeURIComponent(def.name)}`;
          await fetch(delUrl, { method: "DELETE", headers });
        } catch { /* best-effort — the POST below reports if the name is still taken */ }
      }
      if (args.dryRun) {
        results.push({ name: def.name, outcome: "dry_run" });
        continue;
      }
      const payload = {
        name: def.name,
        language: "en",
        category: def.category,
        parameter_format: "POSITIONAL",
        components: [{
          type: "BODY",
          text: def.bodyText,
          // Meta requires sample values for variable review (round-1
          // creates without examples were all auto-REJECTED).
          ...(def.exampleVars.length ? { example: { body_text: [def.exampleVars] } } : {}),
        }],
      };
      try {
        const url = `${CHAKRA_BASE}/plugin/whatsapp/api/${WA_VER}/${wabaId}/message_templates`;
        const res = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });
        const raw = await res.text();
        let data: any = null;
        try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
        const parsedErr = data ? extractWaError(data) : null;
        // Success shapes: Meta returns { id, status, category } (older) or
        // { data: [{ id, status }] }; Chakra may wrap in _data.
        const created = data?.id || data?._data?.id || data?.data?.[0]?.id;
        if (res.ok && created) {
          results.push({
            name: def.name, outcome: "created", httpStatus: res.status,
            status: String(data?.status || data?._data?.status || data?.data?.[0]?.status || "PENDING"),
            // What Meta actually classified it as (its July-2025 auto-
            // categorizer may override the declared category).
            category: String(data?.category || data?._data?.category || data?.data?.[0]?.category || def.category),
          } as any);
        } else {
          results.push({
            name: def.name,
            outcome: "failed",
            httpStatus: res.status,
            error: explainWhatsAppError(parsedErr) || (raw ? raw.slice(0, 300) : `HTTP ${res.status} with empty body`),
          });
        }
      } catch (e: any) {
        results.push({ name: def.name, outcome: "failed", error: `Request failed: ${e?.message || e}` });
      }
    }

    return { success: results.every((r) => r.outcome !== "failed"), wabaId, results };
  },
});

// ─── REMAP: repair the pre-2026-11-24 auto-mapped varOrders ────────────────
// Every firm's auto-mapped rows were written with the OLD pad-field logic:
// the bank slots of atrium_rent_reminder / atrium_late_reminder /
// atrium_service_charge_reminder carried firmName/dueDate/messageText (and
// the late template shipped 6 params for 8 slots — a guaranteed Meta param
// mismatch). This one-time internal action converges every firm to exactly
// what a fresh sync would produce under the new rules:
//   • autoMapped rows are deleted and re-suggested from the live registry
//     (body-aware varOrders, name-hit requirement);
//   • MANUAL mappings (updatedBy a real user) are NEVER touched.
export const remapAutoMappedTemplates = internalAction({
  args: {},
  handler: async (ctx, _args) => {
    const firmIds: string[] = await ctx.runQuery(internal.whatsappTemplates.listFirmIds, {});
    let firmsTouched = 0, rowsDeleted = 0, rowsInserted = 0;
    const errors: string[] = [];
    for (const firmId of firmIds) {
      try {
        const registry: any[] = await ctx.runQuery(internal.whatsappTemplates.getFirmTemplatesInternal, { firmId });
        const mappings: any[] = await ctx.runQuery(internal.whatsappTemplates.getFirmMappingsInternal, { firmId });
        const manualTypes = new Set<string>();
        const autoRows: any[] = [];
        for (const m of mappings) {
          if (m.autoMapped) autoRows.push(m);
          else manualTypes.add(String(m.messageType));
        }
        if (autoRows.length === 0 && registry.length > 0) {
          // Still worth suggesting — a firm that never auto-mapped (or whose
          // mappings were all manual-deleted) gets the fresh suggestions too.
        }
        const deleted = await ctx.runMutation(internal.whatsappTemplates.deleteAutoMappings, { firmId });
        const suggestions = suggestMappings(
          registry.map((t: any) => ({
            name: t.name,
            language: t.language,
            status: t.status,
            category: t.category,
            bodyText: t.bodyText,
            variableCount: t.variableCount,
            metaId: t.metaId,
          })),
          manualTypes,
        );
        let inserted = 0;
        if (suggestions.length) {
          inserted = await ctx.runMutation(internal.whatsappTemplates.insertAutoMappings, {
            firmId,
            mappings: suggestions.map((s) => ({
              messageType: s.messageType,
              templateName: s.templateName,
              templateLanguage: s.templateLanguage,
              varOrder: sanitizeVarOrder(s.varOrder),
            })),
          });
        }
        if (deleted > 0 || inserted > 0) firmsTouched++;
        rowsDeleted += deleted;
        rowsInserted += inserted;
      } catch (e: any) {
        errors.push(`${firmId}: ${e?.message || e}`);
      }
    }
    return { success: errors.length === 0, firms: firmIds.length, firmsTouched, rowsDeleted, rowsInserted, errors: errors.slice(0, 5) };
  },
});

/** Registry + mapping readers for the remap action (internal, firm-scoped). */
export const getFirmTemplatesInternal = internalQuery({
  args: { firmId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("whatsapp_templates")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();
  },
});

export const getFirmMappingsInternal = internalQuery({
  args: { firmId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("whatsapp_template_mappings")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();
  },
});

export const deleteAutoMappings = internalMutation({
  args: { firmId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("whatsapp_template_mappings")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .filter((q) => q.eq(q.field("autoMapped"), true))
      .collect();
    await Promise.all(rows.map((r) => ctx.db.delete(r._id)));
    return rows.length;
  },
});

export const insertAutoMappings = internalMutation({
  args: {
    firmId: v.string(),
    mappings: v.array(v.object({
      messageType: v.string(),
      templateName: v.string(),
      templateLanguage: v.string(),
      // Same literal union as the schema's varOrder (sanitizeVarOrder
      // guarantees membership before this is called).
      varOrder: v.optional(v.array(v.union(
        v.literal("tenantName"), v.literal("amount"), v.literal("totalPayable"),
        v.literal("serviceCharge"), v.literal("address"), v.literal("firmName"),
        v.literal("dueDate"), v.literal("messageText"), v.literal("bankName"),
        v.literal("accountName"), v.literal("accountNumber"),
        v.literal("paymentKind"), v.literal("daysOverdue"),
      ))),
    })),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const m of args.mappings) {
      await ctx.db.insert("whatsapp_template_mappings", {
        firmId: args.firmId,
        messageType: m.messageType,
        templateName: m.templateName,
        templateLanguage: m.templateLanguage,
        varOrder: m.varOrder,
        autoMapped: true,
        updatedBy: "system_auto_map",
        createdAt: now,
        updatedAt: now,
      });
    }
    return args.mappings.length;
  },
});
