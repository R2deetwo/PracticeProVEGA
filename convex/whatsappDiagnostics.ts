/**
 * WhatsApp Live Diagnostics — CI-driven "prove it works" module.
 *
 * WHY (2026-09-12, user directive — verbatim): "WhatsApp is NOT closed. Do a
 * live test send from production to a real phone. Log the raw Chakra
 * request/response. Also check: env (sandbox vs prod), token validity, sender
 * approval, sandbox list, templates, daily limit. Paste raw output. If the
 * test fails, reopen — original issue was messages not sending, not
 * templates."
 *
 * TRUST MODEL: this is an INTERNAL action + INTERNAL query. Internal
 * functions cannot be called by clients (the browser bundle has no reference
 * to them), so an anonymous caller can never trigger a WhatsApp send. The
 * only invocation paths are:
 *   1. CI:  npx convex run internal.whatsappDiagnostics.liveSendDiagnostic --prod
 *           (authenticated with the production deploy key — admin trust)
 *   2. Backend code via runAction / runQuery
 *
 * SECURITY: credential VALUES are never returned — only presence + length.
 * Raw request bodies logged below contain no secrets; the Authorization
 * header value is never echoed into any output.
 *
 * CHECKLIST COVERAGE (the user's remark, item by item):
 *   env (sandbox vs prod)  → phoneNumbers[].accountMode (LIVE | SANDBOX)
 *   token validity         → every call's HTTP status; 401 = invalid/expired
 *   sender approval        → status/chakraStatus/verifiedName/nameStatus
 *   sandbox list           → accountMode + the send's own Meta error if the
 *                            recipient is not allowlisted (code 131047)
 *   templates              → live message_templates listing + local registry
 *   daily limit            → messagingLimitTier + throughput on the number
 */
import { internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { extractWaError, explainWhatsAppError, normalisePhoneForMeta } from "./communications";
import { normalizeTemplate, WhatsAppTemplateInfo } from "./whatsappTemplates";

// ─── Env (same vars sendWhatsApp uses; local copy — not exported elsewhere) ─
function chakraCreds() {
  return {
    TOKEN: process.env.CHAKRA_ACCESS_TOKEN,
    PLUGIN_ID: process.env.CHAKRA_PLUGIN_ID,
    PHONE_ID: process.env.CHAKRA_PHONE_NUMBER_ID,
    WA_VER: process.env.CHAKRA_WA_API_VERSION || "v19.0",
  };
}

const CHAKRA_BASE = "https://api.chakrahq.com/v1/ext";

const RAW_SLICE = 2000;

/** Never leak a credential value — presence + shape only. */
function describeEnv() {
  const { TOKEN, PLUGIN_ID, PHONE_ID, WA_VER } = chakraCreds();
  return {
    chakraAccessToken: TOKEN ? { present: true, length: TOKEN.length } : { present: false },
    chakraPluginId: PLUGIN_ID ? { present: true, length: PLUGIN_ID.length } : { present: false },
    chakraPhoneNumberId: PHONE_ID ? { present: true, length: PHONE_ID.length } : { present: false },
    waApiVersion: WA_VER,
  };
}

/**
 * Build representative variable values for a test send, sized to the
 * template's placeholder count. If a failed message's templateData exists
 * (the real recipient/amount/address), use those values so the test is an
 * exact reproduction instead of a synthetic one.
 */
export function buildTestVars(
  variableCount: number,
  templateData?: Record<string, any> | null,
): string[] {
  const fromData = [
    String(templateData?.tenantName ?? ""),
    templateData?.amount != null ? String(templateData.amount) : "",
    templateData?.totalPayable != null ? String(templateData.totalPayable) : "",
    templateData?.serviceCharge != null ? String(templateData.serviceCharge) : "",
    String(templateData?.address ?? ""),
    String(templateData?.firmName ?? ""),
    String(templateData?.dueDate ?? ""),
  ].filter((s) => s.length > 0);

  const fallback = [
    "Diagnostic Test",
    "1000",
    "1250",
    "250",
    "Test Property Address",
    "PracticePro",
    "2026-09-13",
  ];
  const out: string[] = [];
  for (let i = 0; i < variableCount; i++) {
    out.push(fromData[i] ?? fallback[i % fallback.length]);
  }
  return out;
}

// ─── DB STATE DUMP (internal query — no network, pure read) ─────────────────
export const dumpWhatsAppState = internalQuery({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("whatsapp_settings").collect();
    const mappings = await ctx.db.query("whatsapp_template_mappings").take(100);
    const templates = await ctx.db.query("whatsapp_templates").take(300);

    // Recent WhatsApp scheduled messages — the queue + outcomes.
    const recentScheduled = (await ctx.db
      .query("scheduled_messages")
      .withIndex("by_scheduled")
      .order("desc")
      .take(200))
      .filter((m: any) => m.channel === "whatsapp")
      .slice(0, 15)
      .map((m: any) => ({
        firmId: m.firmId,
        messageType: m.messageType,
        status: m.status,
        scheduledFor: m.scheduledFor,
        sentAt: m.sentAt ?? null,
        recipientPhone: m.recipientPhone ?? null,
        recipientName: m.recipientName ?? null,
        failureReason: m.failureReason ? String(m.failureReason).slice(0, 300) : null,
        hasTemplateData: !!m.templateData,
        templateData: m.templateData ?? null,   // exact-repro vars for the live test
        isAutomation: !!m.isAutomation,
      }));

    // Recent WhatsApp-adjacent captured errors.
    const recentErrors = (await ctx.db
      .query("error_events")
      .withIndex("by_timestamp")
      .order("desc")
      .take(100))
      .filter((e: any) => /whatsapp|chakra|template|portal|message/i.test(`${e.name} ${e.message}`))
      .slice(0, 10)
      .map((e: any) => ({
        scope: e.scope,
        name: e.name,
        message: String(e.message).slice(0, 300),
        severity: e.severity,
        timestamp: e.timestamp,
      }));

    return {
      whatsappSettings: settings.map((s: any) => ({
        firmId: s.firmId,
        wabaId: s.wabaId ?? null,
        phoneDisplay: s.phoneDisplay ?? null,
        phoneId: s.phoneId ?? null,
        templateCount: s.templateCount ?? null,
        approvedCount: s.approvedCount ?? null,
        lastSyncAt: s.lastSyncAt ?? null,
        lastSyncSuccessAt: s.lastSyncSuccessAt ?? null,
        lastSyncError: s.lastSyncError ? String(s.lastSyncError).slice(0, 400) : null,
      })),
      templateMappings: mappings.map((m: any) => ({
        firmId: m.firmId,
        messageType: m.messageType,
        templateName: m.templateName,
        templateLanguage: m.templateLanguage,
        varOrder: m.varOrder ?? null,
        autoMapped: !!m.autoMapped,
        updatedAt: m.updatedAt,
      })),
      localTemplateRegistry: templates.map((t: any) => ({
        firmId: t.firmId,
        name: t.name,
        language: t.language,
        status: t.status,
        category: t.category ?? null,
        variableCount: t.variableCount ?? null,
        bodyText: t.bodyText ? String(t.bodyText).slice(0, 200) : null,
        syncedAt: t.syncedAt,
      })),
      recentScheduledWhatsappMessages: recentScheduled,
      recentWhatsappErrorEvents: recentErrors,
    };
  },
});

// ─── LIVE DIAGNOSTIC (internal action — network + optional send) ────────────
export const liveSendDiagnostic = internalAction({
  args: {
    testPhone: v.optional(v.string()),
    sendTest: v.optional(v.boolean()),
    templateName: v.optional(v.string()),
    templateLanguage: v.optional(v.string()),
    templateVars: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args): Promise<any> => {
    const startedAt = Date.now();
    const { TOKEN, PLUGIN_ID, PHONE_ID, WA_VER } = chakraCreds();
    const headers = {
      "Authorization": `Bearer ${TOKEN ?? ""}`,
      "Accept": "application/json",
      "Content-Type": "application/json",
    };

    const result: any = {
      _meta: {
        ranAt: new Date(startedAt).toISOString(),
        checksRequested: [
          "env", "token validity", "sender approval", "sandbox/prod mode",
          "templates", "daily limit tier", ...(args.sendTest ? ["LIVE TEST SEND"] : []),
        ],
      },
      env: describeEnv(),
    };

    if (!TOKEN || !PHONE_ID) {
      result.fatal = "WhatsApp gateway not configured (missing CHAKRA_ACCESS_TOKEN / CHAKRA_PHONE_NUMBER_ID).";
      return result;
    }

    // ── 1) Phone numbers: env mode, sender approval, quality, limit tier ──
    let phoneInfo: any[] = [];
    try {
      const phoneUrl = PLUGIN_ID
        ? `${CHAKRA_BASE}/whatsapp-phone-number?pluginId=${encodeURIComponent(PLUGIN_ID)}`
        : `${CHAKRA_BASE}/whatsapp-phone-number`;
      const res = await fetch(phoneUrl, { headers });
      const raw = await res.text();
      let data: any = null;
      try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
      phoneInfo = Array.isArray(data?._data) ? data._data : [];
      result.phoneNumbers = {
        httpStatus: res.status,
        tokenValid: res.status !== 401,
        rawResponse: raw.slice(0, RAW_SLICE),
        parsed: phoneInfo.map((p: any) => ({
          id: String(p.id),
          waba: p.waba ? String(p.waba) : null,
          displayPhoneNumber: p.displayPhoneNumber ?? null,
          verifiedName: p.verifiedName ?? null,
          status: p.status ?? null,
          chakraStatus: p.chakraStatus ?? null,
          accountMode: p.accountMode ?? null,          // LIVE vs SANDBOX
          qualityScore: p.qualityScore?.score ?? null,
          messagingLimitTier: p.messagingLimitTier ?? null,  // daily limit
          codeVerificationStatus: p.codeVerificationStatus ?? null,
          nameStatus: p.nameStatus ?? null,
          platformType: p.platformType ?? null,
          throughput: p.throughput?.level ?? null,
        })),
        configuredPhoneIdMatches: phoneInfo.some((p: any) => String(p.id) === String(PHONE_ID)),
      };
    } catch (e: any) {
      result.phoneNumbers = { error: `Request failed: ${e?.message || e}` };
    }

    // ── 2) Plugin config (webhook wiring, WABAs attached to the plugin) ──
    if (PLUGIN_ID) {
      try {
        const res = await fetch(`${CHAKRA_BASE}/plugin/whatsapp/${PLUGIN_ID}/config`, { headers });
        const raw = await res.text();
        result.pluginConfig = { httpStatus: res.status, rawResponse: raw.slice(0, RAW_SLICE) };
      } catch (e: any) {
        result.pluginConfig = { error: `Request failed: ${e?.message || e}` };
      }
    }

    // ── 3) Templates: live listing straight from Meta (via Chakra) ──
    let wabaId: string | undefined;
    const mine = phoneInfo.find((p: any) => String(p.id) === String(PHONE_ID)) || phoneInfo[0];
    if (mine?.waba) wabaId = String(mine.waba);
    let liveTemplates: WhatsAppTemplateInfo[] = [];
    if (wabaId) {
      try {
        const url = `${CHAKRA_BASE}/plugin/whatsapp/api/${WA_VER}/${wabaId}/message_templates?limit=100`;
        const res = await fetch(url, { headers });
        const raw = await res.text();
        let data: any = null;
        try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
        const page = Array.isArray(data?.data) ? data.data : [];
        liveTemplates = page.map((t: any) => normalizeTemplate(t)).filter(Boolean) as WhatsAppTemplateInfo[];
        result.liveTemplates = {
          httpStatus: res.status,
          wabaId,
          count: liveTemplates.length,
          parsed: liveTemplates.map((t) => ({
            name: t.name, language: t.language, status: t.status,
            category: t.category ?? null, variableCount: t.variableCount ?? null,
          })),
          rawResponse: raw.slice(0, RAW_SLICE),
        };
      } catch (e: any) {
        result.liveTemplates = { wabaId, error: `Request failed: ${e?.message || e}` };
      }
    } else {
      result.liveTemplates = { skipped: "WABA id could not be resolved from the phone-number listing." };
    }

    // ── 4) DB state: settings, mappings, local registry, recent sends ──
    const dbState = await ctx.runQuery(internal.whatsappDiagnostics.dumpWhatsAppState, {});
    result.dbState = dbState;

    // ── 5) Optional LIVE TEST SEND to a real phone ──
    if (args.sendTest && args.testPhone) {
      const to = normalisePhoneForMeta(args.testPhone);
      if (!to) {
        result.testSend = { error: `"${args.testPhone}" is not a valid phone number for Meta (use international format, e.g. +2348012345678).` };
      } else {
        // Template resolution: explicit arg → firm mapping (rent_reminder) →
        // first APPROVED template from the LIVE listing.
        let templateName = args.templateName;
        let templateLanguage = args.templateLanguage;
        let resolution = "explicit-arg";
        if (!templateName) {
          const mapping = (dbState.templateMappings || []).find(
            (m: any) => m.messageType === "rent_reminder",
          );
          if (mapping) {
            templateName = mapping.templateName;
            templateLanguage = mapping.templateLanguage;
            resolution = `firm-mapping (rent_reminder)`;
          } else {
            const approved = liveTemplates.find((t) => t.status === "APPROVED");
            if (approved) {
              templateName = approved.name;
              templateLanguage = approved.language;
              resolution = "first-approved-live-template";
            }
          }
        }
        if (!templateName) {
          result.testSend = { error: "No template available to test with (no explicit arg, no firm mapping, no APPROVED live template)." };
        } else {
          // Exact-repro vars: reuse the newest failed/scheduled message data
          // for this recipient if it exists.
          const repro = (dbState.recentScheduledWhatsappMessages || []).find(
            (m: any) => m.recipientPhone && normalisePhoneForMeta(m.recipientPhone) === to && m.templateData,
          );
          const liveMatch = liveTemplates.find(
            (t) => t.name === templateName && t.language === (templateLanguage || t.language),
          );
          const templateVars =
            args.templateVars && args.templateVars.length
              ? args.templateVars
              : buildTestVars(liveMatch?.variableCount ?? 1, repro?.templateData ?? null);

          const payload = {
            messaging_product: "whatsapp",
            to,
            type: "template",
            template: {
              name: templateName,
              language: { code: templateLanguage || "en" },
              components: templateVars.length
                ? [{ type: "body", parameters: templateVars.map((t) => ({ type: "text", text: t })) }]
                : [],
            },
          };
          const url = `${CHAKRA_BASE}/plugin/whatsapp/${PLUGIN_ID}/api/${WA_VER}/${PHONE_ID}/messages`;
          const requestLog = {
            method: "POST",
            url,
            headers: { "Authorization": "Bearer [REDACTED]", "Content-Type": "application/json" },
            body: payload,
          };
          try {
            const res = await fetch(url, {
              method: "POST",
              headers,
              body: JSON.stringify(payload),
            });
            const raw = await res.text();
            let data: any = null;
            try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
            const messageId = data?.messages?.[0]?.id;
            const parsedErr = data ? extractWaError(data) : null;
            result.testSend = {
              request: requestLog,
              httpStatus: res.status,
              rawResponse: raw.slice(0, RAW_SLICE),
              success: res.ok && !!messageId,
              messageId: messageId ?? null,
              parsedError: parsedErr ?? null,
              explainedError:
                res.ok && messageId
                  ? null
                  : explainWhatsAppError(parsedErr) ||
                    (raw ? raw.slice(0, 300) : `HTTP ${res.status} with empty body`),
              templateResolution: {
                how: resolution,
                name: templateName,
                language: templateLanguage ?? "en",
                varsSent: templateVars,
                varsSource: args.templateVars ? "explicit-arg" : repro ? "exact-repro-from-scheduled-message" : "generated-test-values",
              },
            };
          } catch (e: any) {
            result.testSend = {
              request: requestLog,
              error: `Request failed: ${e?.message || e}`,
              templateResolution: { how: resolution, name: templateName, language: templateLanguage ?? "en" },
            };
          }
        }
      }
    } else if (args.sendTest && !args.testPhone) {
      result.testSend = { skipped: "sendTest=true but no testPhone provided." };
    } else {
      result.testSend = { skipped: "sendTest not requested — read-only diagnostic." };
    }

    result._meta.durationMs = Date.now() - startedAt;
    return result;
  },
});
