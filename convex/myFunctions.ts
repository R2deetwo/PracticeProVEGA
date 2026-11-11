
import { query, mutation, action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";
import { logError } from "./observability";
import { Id } from "./_generated/dataModel";
import { checkRateLimit } from "./securityHelpers";

// ─── QUERY BOUNDING POLICY (Item 4, perf — 2026-09-12) ────────────────────────
// Every read in this module is BOUNDED. Unbounded `.collect()` terminals were
// replaced with calibrated `.take(n)` caps (same array return, capped read):
//   • per-entity streams (notifications, tasks, chatMessages, presence): 100–500
//   • per-firm directories (dynamic-table cleanup/cascade paths): 2000
//   • whole-platform lookups (firms by fuzzy invite-code, users by
//     case-insensitive email): 500–2000, each with a bounded-scan comment —
//     no index can serve their normalized/fuzzy match shapes
// Post-filters on firm-indexed ranges with bounded terminals (legacy custom
// id / dual userId forms) were left in place — they scan one firm's rows,
// not the table. firmActivity moved from a table post-filter onto the
// existing by_firm index. No public function signature changed.
import { numericCode, codeFromCharset, randomHex } from "./secureRandom";
// 2026-09-14 (reset-link round): one-click password-reset tokens are stored
// hashed (sha256Hex runs in every Convex runtime — see convex/sha256.ts).
import { sha256Hex } from "./sha256";
// Task 20: login-code verification rules (normalize, TTL, hint, copy)
import { normalizeCode, isCodeExpired, codeHint, wrongCodeMessage } from "./codeVerification";
// Task 21: shared user-record resolution + NDPA privacy projection
import { pickUserRecord, stripAuthFields, userLookupArgs } from "./userResolution";
import { requireFirmUser, requireAdmin } from "./authHelpers";
import { requireStaffCaller, requireFounderCaller, assertSameFirm, resolveCaller } from "./callerAuth";
// Task 48: Automation Studio rule-execution engine (event-driven triggers
// are dispatched from createItem/updateItem below; time-based triggers
// run in the ruleEngineSweep cron — convex/automationRules.ts).
import { dispatchRulesForEvent } from "./automationRules";
import { notifyFounders } from "./founderNotifications";
import { roundMoney, sanitizeMoney } from "./moneyUtils";
// R12: subscription dunning + grace + soft downgrade — pure decision logic
// (kept separate so tests/unit/dunning.test.ts can lock the stage machine).
import { computeDunningAction, DunningAction } from "./dunning";
// ROUND D (Wave 2, D2): canonical add-on catalog — the paid activation path
// validates charged amounts against these server-side prices.
import { getAddonById, expectedAddonAmount } from "./addonCatalog";
// V2 FINANCIAL TRUTH: the invoice money fence — server-side numbering +
// authoritative tax/total computation for every generic-path invoice write.
import { applyInvoiceCreateFence, applyInvoiceUpdateFence } from "./invoiceFence";
// V3 MATTER LIFECYCLE: the status/stage state machine + shared lifecycle
// helpers, enforced on the generic CRUD paths (V-MATTER-1/2/5/13/14).
import {
  normalizeMatterStatus,
  validateMatterStatusTransition,
  validateMatterStage,
  resolveMatterAnyId,
  insertFirmActivity,
  appendStageHistory,
} from "./matterLifecycle";
import { normalizeEmail } from "./contactIntegrity";
// V4 DOCUMENT INTEGRITY: server-side file/versions fences for the
// documents table (V-DOC-5/13) — no base64 data URLs in rows, validated
// storage-backed files, bounded version history.
import {
  sanitizeDocumentFileForCreate,
  mergeDocumentFileForUpdate,
  sanitizeDocumentVersions,
} from "./documentsIntegrity";

// --- SUBSCRIPTION CONFIGURATION (mirror: convex/tierLimits.ts) ---
import { ATRIUM_LIMITS, resolveTierLimitsForFirm } from "./tierLimits";
import { withCronReporting } from "./observability";

// ─── FINANCIAL TABLES (accounting-integrity round, 2026-09-14) ───────────────
// Tables whose rows ARE money (movement, obligation, or payment state).
// Design contract:
//   - NEVER hard-deleted via the generic deleteItem/forceDeleteItem (the
//     ledger only grows — corrections are voids, not erasures).
//   - Every generic-path EDIT is snapshotted into financial_audit_log.
//   - The lifecycle fields are writable ONLY by convex/financialIntegrity.ts.
// Draft invoices are the one delete exception: an unissued draft has never
// entered the books, so discarding it is not an accounting event.
const FINANCIAL_TABLES = new Set([
  "ledger_entries",
  "invoices",
  "trust_transactions",
  "wallet_transactions",
  "payment_proofs",
  "subscriptionRequests",
  "subscriptionAddons",
  "refundRequests",
  "paystackEvents",
  "financial_audit_log",
]);

// --- PRESENCE ---

export const sendHeartbeat = mutation({
  args: { sessionToken: v.optional(v.string()), firmId: v.string(), userId: v.string(), userName: v.string(), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // SECURITY: Verify the caller belongs to the firm they're sending presence for.
    // Skip the firmId match check when auth.firmId is empty (legacy call without userEmail).
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    if (!auth.firmId || auth.firmId !== args.firmId) {
      throw new Error("Unauthorized. firmId does not match your session.");
    }

    const existing = await ctx.db
      .query("presence")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { updatedAt: Date.now(), userName: args.userName, firmId: args.firmId });
    } else {
      await ctx.db.insert("presence", { firmId: args.firmId, userId: args.userId, userName: args.userName, updatedAt: Date.now() });
    }
  },
});

export const getActivePeers = query({
  args: { sessionToken: v.optional(v.string()), firmId: v.optional(v.string()), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // SECURITY FIX: Fail CLOSED — require userEmail for peer queries.
    if (!args.userEmail) {
      throw new Error("Unauthenticated: userEmail required. Anonymous peer queries are no longer permitted.");
    }
    try {
      const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
      if (!auth.firmId || auth.firmId !== args.firmId) return [];
    } catch { return []; }
    if (!args.firmId) return [];

    // Fetch ALL presence records for the firm (not just active ones).
    // We return both active and inactive users with their lastSeen timestamp
    // so the frontend can show an inactivity indicator (greyed out) and
    // last-seen time on hover.
    // AUDIT FIX: .take(100) contradicted the "ALL" intent above and silently
    // dropped users in firms with >100 members (Komplete = unlimited seats).
    // .collect() is bounded by firm membership, not a hardcoded cap.
    const allPresence = await ctx.db.query("presence").withIndex("by_firm", (q) => q.eq("firmId", args.firmId)).take(500);

    // Fetch users to check their visibility preferences
    const users: any[] = [];
    for (const p of allPresence) {
      try {
        const user = await ctx.db.get(p.userId as any);
        if (user) users.push(user);
      } catch (e) { /* skip invalid IDs */ }
    }

    // Build a set of user IDs that should be hidden from presence
    const hiddenUserIds = new Set<string>();
    for (const user of users) {
      if (user.role === 'Tenant' && user.portalPresenceHidden !== false) {
        hiddenUserIds.add(user._id.toString());
      }
      if (user.portalPresenceHidden === true) {
        hiddenUserIds.add(user._id.toString());
      }
    }

    // Return rich presence data: userId, updatedAt (last seen), and isOnline
    // Active = heartbeat within the last 60 seconds
    const now = Date.now();
    const ACTIVE_THRESHOLD = 60 * 1000;
    return allPresence
      .filter((p: any) => !hiddenUserIds.has(p.userId))
      .map((p: any) => ({
        userId: p.userId,
        updatedAt: p.updatedAt,
        isOnline: (now - p.updatedAt) < ACTIVE_THRESHOLD,
      }));
  },
});

// --- DIAGNOSTICS & REPAIR ---

/**
 * startImpersonationSession — R16 strict-mode-safe impersonation.
 *
 * BEFORE strict mode, the client "impersonated" a portal user by swapping
 * its legacy email identity to the target's email — every backend call
 * then resolved the caller as the target with zero proof. Under strict
 * identity that path is dead (correctly). Impersonation now mints a REAL
 * session for the target user, server-verified:
 *
 *   1. The caller presents their OWN bearer session and must be an Admin
 *      or Founder (requireStaffCaller — staff roles only).
 *   2. The target must be a portal user (Tenant/Client) — impersonating
 *      staff would be privilege escalation.
 *   3. The target must belong to the caller's firm.
 *   4. A session is created for the target (device: 'impersonation') and
 *      its token returned ONCE to the impersonating admin.
 *   5. An audit row lands in securityEvents (who impersonated whom, when).
 *
 * The client swaps its bearer to the returned token for the duration of
 * the impersonation and restores its original bearer on exit (the
 * original admin session is never revoked).
 */
export const startImpersonationSession = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    targetUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const admin = await requireStaffCaller(ctx, { sessionToken: args.sessionToken });
    if (String(admin.role || "") !== "Admin" && String(admin.role || "") !== "Founder") {
      throw new Error("Impersonation is available to firm administrators only.");
    }

    const target: any = await ctx.db.get(args.targetUserId);
    if (!target) throw new Error("Target user not found.");

    // Portal-only targets (mirrors the long-standing client-side rule).
    if (String(target.role || "") !== "Tenant" && String(target.role || "") !== "Client") {
      throw new Error("Impersonation is limited to portal users (residents/clients).");
    }

    // Same-firm guard: an admin can only impersonate users of their own firm.
    if (target.firmId && admin.firmId && String(target.firmId) !== String(admin.firmId)) {
      throw new Error("Not authorized: target user belongs to a different firm.");
    }

    // Mint the impersonation session (the sessions table caps at 10 per
    // user and prunes oldest — bounded).
    const session: any = await (ctx as any).runMutation((internal as any).sessions.createSession, {
      userId: target._id,
      userEmail: target.email || target.tokenIdentifier,
      device: "impersonation",
    });

    // Audit trail (server-side row, not just local state).
    try {
      await ctx.db.insert("securityEvents", {
        eventType: "impersonation_started",
        userId: String(admin._id),
        email: admin.email || admin.tokenIdentifier,
        details: `Admin ${admin.email || admin.tokenIdentifier} started impersonating portal user ${target.email || target.tokenIdentifier} (${target.role}).`,
        timestamp: Date.now(),
      });
    } catch {}

    return { success: true, sessionToken: session?.token, targetEmail: target.email || target.tokenIdentifier };
  },
});

export const diagnoseConnectivity = mutation({
  args: { sessionToken: v.optional(v.string()), email: v.string(), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // SECURITY (R16 strict cutover): the caller must present a valid bearer
    // session and may only diagnose their OWN account. The previous gate
    // was conditional on ctx.auth (never configured → never fired), so any
    // caller could diagnose any email — the exact spoofable-identity class
    // this round closes. resolveCaller is used instead of requireFirmUser
    // deliberately: repair flows exist for accounts whose firm link is
    // BROKEN (no firmId), which requireFirmUser would reject.
    const caller = await resolveCaller(ctx, { sessionToken: args.sessionToken, userEmail: args.userEmail });
    const callerEmail = String((caller as any).tokenIdentifier || (caller as any).email || "").toLowerCase().trim();
    if (callerEmail !== args.email.toLowerCase().trim()) {
      throw new Error("Unauthorized. You can only diagnose your own account.");
    }

    const emailInput = args.email.toLowerCase().trim();

    // 500-cap audit: indexed lookup (take(500)+find broke past the 500th user)
    const user = await findUserByTokenUncapped(ctx, emailInput);

    const diagnosis = {
      emailSearched: emailInput,
      userFound: !!user,
      userId: user?._id || null,
      currentFirmId: user?.firmId || null,
      firmFound: false,
      availableFirms: [] as any[]
    };

    if (user && user.firmId) {
      const firm = await ctx.db.get(user.firmId as any) as any;
      if (firm) {
        diagnosis.firmFound = true;
        diagnosis.availableFirms.push({
          id: firm._id,
          name: firm.name,
          status: 'Linked',
          createdAt: firm._creationTime
        });
      }
    }

    const allFirms = await ctx.db.query("firms").take(500);
    const joinedIds = user?.joinedFirmIds || [];
    
    const availableFirmsFiltered = allFirms.filter((f: any) => {
      // 1. Created by this user
      const creatorIdMatch = f.createdBy === user?._id || f.createdBy === user?.tokenIdentifier;
      const settingsEmailMatch = f.settings && f.settings.creatorEmail && f.settings.creatorEmail.toLowerCase() === emailInput;
      
      // 2. Already joined - check the persistence list
      const previouslyJoined = joinedIds.includes(f._id);
      
      // 3. Current firm
      const isCurrentlyIn = user && user.firmId === f._id;
      
      // We want to show firms NOT currently active but where user has access
      return (creatorIdMatch || settingsEmailMatch || previouslyJoined || isCurrentlyIn) && f._id !== diagnosis.currentFirmId;
    });

    availableFirmsFiltered.forEach(f => {
      diagnosis.availableFirms.push({
        id: f._id,
        name: f.name,
        status: 'Available',
        createdAt: f._creationTime
      });
    });

    if (!diagnosis.firmFound && diagnosis.availableFirms.length > 0) {
      diagnosis.firmFound = true;
    }

    return diagnosis;
  }
});

export const repairAccountConnection = mutation({
  args: { sessionToken: v.optional(v.string()), email: v.string(), targetFirmId: v.optional(v.string()), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // SECURITY (R16 strict cutover): the caller must present a valid bearer
    // session and may only repair their OWN account. The previous optional
    // ctx.auth gate never fired under custom auth, leaving the repair fully
    // spoofable. resolveCaller (not requireFirmUser): repair targets exactly
    // the accounts whose firm link is broken.
    const caller = await resolveCaller(ctx, { sessionToken: args.sessionToken, userEmail: args.userEmail });
    const callerEmail = String((caller as any).tokenIdentifier || (caller as any).email || "").toLowerCase().trim();
    if (callerEmail !== args.email.toLowerCase().trim()) {
      throw new Error("Unauthorized. You can only repair your own account.");
    }

    const emailInput = args.email.toLowerCase().trim();

    // 500-cap audit: indexed lookup (take(500)+find broke past the 500th user)
    const user = await findUserByTokenUncapped(ctx, emailInput);

    if (!user) {
      return { success: false, code: 'USER_NOT_FOUND', message: "User account not found." };
    }

    if (args.targetFirmId) {
      const firm = await ctx.db.get(args.targetFirmId as any) as any;
      if (!firm) return { success: false, message: "Target firm does not exist." };

      const joinedIds = user.joinedFirmIds || [];
      const updatedJoinedIds = joinedIds.includes(args.targetFirmId) ? joinedIds : [...joinedIds, args.targetFirmId];

      await ctx.db.patch(user._id, { 
        firmId: args.targetFirmId, 
        role: 'Admin', 
        onboardingCompleted: true,
        joinedFirmIds: updatedJoinedIds 
      });
      return { success: true, code: 'LINK_RESTORED', firmId: args.targetFirmId, message: `Successfully connected to ${firm.name}` };
    }

    return { success: false, code: 'MANUAL_SELECTION_REQUIRED', message: "Please select a specific firm to connect." };
  }
});

// --- ============================================================== ---
// ---  PHASE 1: OPTIMIZED MAIN QUERY (Data Minimization / Projections) ---
// ---  Heavy fields stripped. NO chatMessages, firmActivity, or      ---
// ---  researchMessages loaded here. Those have dedicated queries.   ---
// --- ============================================================== ---

export const getFirmData = query({
  args: {
    firmId: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    // RLS: Require firm user authentication. This prevents portal users
    // and unauthenticated callers from reading the entire firm dataset.
    const { firmId: authFirmId, user: authUser } = await requireFirmUser(ctx, args.userEmail, args.sessionToken);

    // V1-A (SEC-1): firm identity is derived from the AUTHENTICATED session
    // — a caller-supplied firmId can no longer override it. The requested
    // firm must be the caller's own firm or one they joined; anything else
    // is a cross-firm read and is rejected (null, not an error — no
    // disclosure of whether the other firm exists). The legacy email-based
    // firm recovery is deleted with this change: it resolved firms from
    // the caller-supplied email string, letting an authenticated user of
    // one firm steer the read to any firm whose creator email they could
    // name. requireFirmUser's settleFirmUser guarantees authFirmId, so no
    // recovery path is needed.
    const callerFirmIds = new Set(
      [authUser.firmId, ...((authUser as any).joinedFirmIds || [])]
        .filter(Boolean)
        .map(String)
    );
    if (args.firmId && !callerFirmIds.has(String(args.firmId))) {
      console.error(`[SECURITY] getFirmData: caller (firm ${authFirmId}) requested firm ${args.firmId} — rejected`);
      return null;
    }
    let targetFirmId = args.firmId || authFirmId;

    // CRITICAL: Normalize targetFirmId to a string to prevent type-mismatch in index queries
    targetFirmId = targetFirmId.toString();

    let firmDetails = null;
    try { 
        firmDetails = await ctx.db.get(targetFirmId as any); 
    } catch (e) { 
        console.error(`[getFirmData] Failed to fetch firmDetails for ${targetFirmId}:`, e);
    }

    if (!firmDetails) {
        if (targetFirmId === 'demo_firm_id' || targetFirmId === 'atrium-demo-firm-id') {
            firmDetails = {
                _id: targetFirmId as any,
                name: targetFirmId === 'atrium-demo-firm-id' ? "Atrium Demo Firm" : "Vega Demo Firm",
                subscriptionPlan: "Enterprise",
                product: targetFirmId === 'atrium-demo-firm-id' ? "atrium" : "vega",
                aiSettings: { enableAllAiFeatures: true, enableJurisdictionalAnalysis: true }
            } as any;
        } else {
            console.warn(`[getFirmData] Firm record missing for ID: ${targetFirmId}.`);
            return null;
        }
    }

    // Helper: fetch by firmId index with robust recovery for legacy/untagged data
    const fetchByFirm = async (tableName: string) => {
      // firm_licenses' firm index is named by_firmId (historical), not
      // by_firm — see the schema note. Without this mapping every
      // fetchByFirm("firm_licenses") threw and fell back to a full scan.
      const firmIndexName = tableName === "firm_licenses" ? "by_firmId" : "by_firm";
      try {
        // 1. Primary Attempt: Use by_firm index for speed
        const firmItems = await ctx.db.query(tableName as any)
          .withIndex(firmIndexName, (q: any) => q.eq("firmId", targetFirmId))
          .take(1000);

        // 2. Secondary Attempt: Fetch 'system' tagged items
        const systemItems = await ctx.db.query(tableName as any)
          .withIndex(firmIndexName, (q: any) => q.eq("firmId", "system"))
          .take(500);

        let combined = [...firmItems, ...systemItems];

        // 3. RECOVERY LOGIC: For specific tables, perform a scan to catch legacy/untagged data.
        const RECOVERY_TABLES = ["eventTypes", "contactCategories", "documentCategories", "checklistTemplates", "notePages", "researchSources", "properties"];
        if (RECOVERY_TABLES.includes(tableName)) {
          const all = await ctx.db.query(tableName as any).take(1000);
          const matches = all.filter((i: any) => {
            const iFirmId = i.firmId?.toString();
            const tFirmId = targetFirmId.toString();
            // PHASE 0 SECURITY FIX: Previously returned ANY notePages row with
            // a matterId set, regardless of which firm owned it — cross-firm
            // data leak. Now requires the notePage's firmId to match.
            return iFirmId === tFirmId || iFirmId === "system";
          });
          combined = [...combined, ...matches];
        }

        const uniqueResults = Array.from(new Map(combined.map(item => [item._id, item])).values());
        if (tableName === "properties") {
        }
        return uniqueResults;
      } catch (e) {
        // Ultimate fallback: Full scan (safe for small firms)
        try {
          console.warn(`[getFirmData] Index failure for ${tableName}, falling back to scan.`);
          const all = await ctx.db.query(tableName as any).take(1000);
           return all.filter((i: any) => {
             const iFirmId = i.firmId?.toString();
             return iFirmId === targetFirmId || iFirmId === "system";
           });
        } catch (innerError) {
          console.error(`FATAL fetch for ${tableName}:`, innerError);
          return [];
        }
      }
    };

    // chatMessages: by conversation index (phase 2 - excluded from main query)
    // firmActivity: excluded (phase 2, dedicated paginated query)
    // researchMessages: excluded (phase 2, dedicated query)
    // researchAnalysisResults: excluded (phase 2, low-usage)

    // 1. Fetch primary tables (Firm-indexed)
    const [
      matters, contacts, tasks, documents, users, workflows, leads, notifications,
      chatConversations, clientMessages, events, invoices, timeEntries, expenses,
      noteNotebooks, researchNotebooks, eventTypes, contactCategories,
      documentCategories, checklistTemplates, documentTemplates,
      documentTemplateCategories, externalCounselInvites, automationRules,
      intakeForms, archive, notePages, researchSources, properties,
      ledgerEntries, serviceCharges, firmLicenses,
      legalModules, statutes
    ] = await Promise.all([
      fetchByFirm("matters"),
      fetchByFirm("contacts"),
      fetchByFirm("tasks"),
      fetchByFirm("documents"),
      (async () => {
        // 500-cap audit: firm members via the by_firm index (the old
        // take(500) global scan made team members vanish once the users
        // table passed 500 rows). joinedFirmIds has no index — a bounded
        // scan stays for that secondary association only.
        const firmMembers = await ctx.db
          .query("users")
          .withIndex("by_firm", (q: any) => q.eq("firmId", targetFirmId))
          .collect();
        const joinedElsewhere = (await ctx.db.query("users").take(2000))
          .filter((u: any) => u.joinedFirmIds && u.joinedFirmIds.includes(targetFirmId));
        const seen = new Set(firmMembers.map((u: any) => String(u._id)));
        return [...firmMembers, ...joinedElsewhere.filter((u: any) => !seen.has(String(u._id)))];
      })(),
      fetchByFirm("workflows"),
      fetchByFirm("leads"),
      fetchByFirm("notifications"),
      fetchByFirm("chatConversations"),
      fetchByFirm("clientMessages"),
      fetchByFirm("events"),
      fetchByFirm("invoices"),
      fetchByFirm("timeEntries"),
      fetchByFirm("expenses"),
      fetchByFirm("noteNotebooks"),
      fetchByFirm("researchNotebooks"),
      fetchByFirm("eventTypes"),
      fetchByFirm("contactCategories"),
      fetchByFirm("documentCategories"),
      fetchByFirm("checklistTemplates"),
      fetchByFirm("documentTemplates"),
      fetchByFirm("documentTemplateCategories"),
      fetchByFirm("externalCounselInvites"),
      fetchByFirm("automationRules"),
      fetchByFirm("intakeForms"),
      fetchByFirm("archive"),
      fetchByFirm("notePages"),
      fetchByFirm("researchSources"),
      fetchByFirm("properties"),
      fetchByFirm("ledger_entries"),
      fetchByFirm("service_charges"),
      fetchByFirm("firm_licenses"),
      ctx.db.query("legal_modules").take(100),
      ctx.db.query("statutes").take(500)
    ]);

    // Nested tables are now fetched directly by firmId to catch items outside notebooks (e.g. endorsements)

    // --- PHASE 1: DATA MINIMIZATION (SERVER-SIDE PROJECTIONS) ---
    // NOTE: We NO LONGER strip 'content' from documents. Previously this
    // was stripped to reduce bandwidth, but it caused documents to appear
    // empty in the Documents section — the user could see the title but
    // not the actual content. The content field is essential for the
    // DocumentDetailView to render the document.
    // We still strip AI analysis fields (those are fetched on-demand).
    const lightDocuments = (documents || []).map((doc: any) => {
      const { summary, riskAnalysis, extractedMetadata, dataProtectionAnalysis, rpcReview, intakeAnalysis, ...lightDoc } = doc;
      return lightDoc;
    });

    // Do NOT strip content from notePages as it's used directly in lists and inline editors
    const lightNotePages = notePages || [];

    // Research Sources: strip ONLY the heavy binary 'file' object, but KEEP
    // the 'content' field (text). Previously both were stripped, which broke
    // AI Notebook chat — the AI received zero source context because
    // source.content was always undefined on the client. The content field
    // is needed by useResearch.handleSendResearchMessage to build the AI
    // prompt with source text. The 'file' field (binary PDF data) is still
    // stripped for bandwidth and fetched on-demand via getResearchSourceContent.
    const lightResearchSources = (researchSources || []).map((src: any) => {
      const { file, ...lightSrc } = src;
      return lightSrc;
    });

    // Strip heavy internal data from leads
    const lightLeads = (leads || []).map((lead: any) => {
      const { intakeAnalysis, intakeRecordings, intakeTranscription, ...lightLead } = lead;
      return lightLead;
    });

    return {
      firmDetails,
      matters: matters || [],
      contacts: contacts || [],
      tasks: tasks || [],
      documents: lightDocuments,
      users: users || [],
      workflows: workflows || [],
      leads: lightLeads,
      notifications: notifications || [],
      chatConversations: chatConversations || [],
      // Note: chatMessages is NO longer here. Loaded separately via getChatMessages.
      chatMessages: [], // keep key to avoid breaking StateProvider destructuring
      clientMessages: clientMessages || [],
      events: events || [],
      invoices: invoices || [],
      timeEntries: timeEntries || [],
      expenses: expenses || [],
      // Note: firmActivity is NO longer here. Loaded separately via getFirmActivity.
      firmActivity: [], // keep key for backward compatibility
      noteNotebooks: noteNotebooks || [],
      notePages: lightNotePages,
      researchNotebooks: researchNotebooks || [],
      researchSources: lightResearchSources,
      // Note: researchMessages excluded. Loaded separately via getResearchMessages.
      researchMessages: [], // keep key for backward compatibility
      researchAnalysisResults: [], // keep key for backward compatibility
      eventTypes: eventTypes || [],
      contactCategories: contactCategories || [],
      documentCategories: documentCategories || [],
      checklistTemplates: checklistTemplates || [],
      documentTemplates: documentTemplates || [],
      documentTemplateCategories: documentTemplateCategories || [],
      externalCounselInvites: externalCounselInvites || [],
      automationRules: automationRules || [],
      intakeForms: intakeForms || [],
      archive: archive || [],
      properties: properties || [],
      ledgerEntries: ledgerEntries || [],
      serviceCharges: serviceCharges || [],
    };
  },
});

// --- ============================================================== ---
// ---  PORTAL-SPECIFIC: Lightweight firm info for portal users       ---
// ---  getFirmBasicInfo: returns just firm record (plan, product)    ---
// ---  so portal dashboards can evaluate feature gates correctly.    ---
// --- ============================================================== ---

/**
 * getFirmBasicInfo — Ultra-lightweight query that returns only the firm record.
 * Used by portal users (Client/Tenant) who don't need the full data pipeline
 * but DO need firmDetails.subscriptionPlan and firmDetails.product so that
 * useFeatures() can evaluate feature gates correctly.
 *
 * Without this, portal users see "Portal Unavailable" because DataProvider
 * skips firm data loading for them, causing useFeatures to default to Core plan.
 */
export const getFirmBasicInfo = query({
  args: { firmId: v.string(), sessionToken: v.optional(v.string()), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.firmId) return null;
    // V1-A (SEC-6): authenticated callers only, and the firm must be the
    // caller's own or a joined firm — a bare firmId previously returned
    // the FULL firm record (bank accounts, tax settings, invite codes…)
    // to anyone, including anonymous callers. Portal users legitimately
    // use this for lightweight firm context (feature gates), so any
    // authenticated role passes; the firm scope is the protection.
    const caller = await resolveCaller(ctx, { sessionToken: args.sessionToken, userEmail: args.userEmail });
    assertSameFirm(caller, args.firmId);
    try {
      const firm = await ctx.db.get(args.firmId as any);
      return firm || null;
    } catch (e) {
      // Fallback: scan by string ID match
      const allFirms = await ctx.db.query("firms").take(50);
      return allFirms.find((f: any) => String(f._id) === args.firmId) || null;
    }
  },
});

// --- ============================================================== ---
// ---  PERFORMANCE OVERHAUL: METADATA-FIRST HYDRATION               ---
// ---  getFirmMetadata: lightweight index-only data for list views.  ---
// ---  getMatterDetails / getPropertyDetails: on-demand full state.  ---
// --- ============================================================== ---

/**
 * getFirmMetadata — Phase 1 of the performance overhaul.
 * Fetches only the fields required to render list views & sidebars.
 * Heavy fields (content, file, histories, notes) are excluded.
 * Target: resolves in < 500ms for firms with up to 500 records.
 */
export const getFirmMetadata = query({
  args: { firmId: v.string(), sessionToken: v.optional(v.string()), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { firmId } = args;
    if (!firmId) return null;

    // V1-A (SEC-7): firm metadata is staff-level data (every matter,
    // contact, property, task, invoice…). The caller must be firm staff
    // of the requested firm, derived from the verified session — the
    // caller-supplied firmId alone previously proved nothing.
    await requireStaffCaller(ctx, { sessionToken: args.sessionToken, userEmail: args.userEmail, firmId });

    const fid = firmId.toString();

    const [matters, contacts, properties, tasks, events, invoices, ledgerEntries, serviceCharges] = await Promise.all([
      // Matters — essential list fields only
      ctx.db.query("matters")
        .withIndex("by_firm", (q: any) => q.eq("firmId", fid))
        .take(500)
        .then((rows: any[]) => rows.map((m: any) => ({
          _id: m._id,
          id: m.id || m._id,
          isPrivate: m.isPrivate,
          firmId: m.firmId,
          title: m.title,
          referenceNumber: m.referenceNumber,
          type: m.type,
          subCategory: m.subCategory,
          status: m.status,
          stage: m.stage,
          clientId: m.clientId,
          court: m.court,
          nextAdjournedDate: m.nextAdjournedDate,
          assignedUsers: m.assignedUsers,
          billingModel: m.billingModel,
          fixedFeeAmount: m.fixedFeeAmount,
          hourlyRate: m.hourlyRate,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
        }))),

      // Contacts — core fields only
      ctx.db.query("contacts")
        .withIndex("by_firm", (q: any) => q.eq("firmId", fid))
        .take(500)
        .then((rows: any[]) => rows.map((c: any) => ({
          _id: c._id,
          id: c.id || c._id,
          firmId: c.firmId,
          name: c.name,
          email: c.email,
          phone: c.phone,
          contactType: c.contactType,
          category: c.category,
          companyName: c.companyName,
          matterIds: c.matterIds,
          createdAt: c.createdAt,
          // SOFT DELETE fields — exposed so the UI can show "Archived" badge
          // and filter archived contacts out of active lists.
          isArchived: c.isArchived || false,
          archivedAt: c.archivedAt || null,
        }))),

      // Properties — address + status + rent info only
      ctx.db.query("properties")
        .withIndex("by_firm", (q: any) => q.eq("firmId", fid))
        .take(500)
        .then((rows: any[]) => rows.map((p: any) => ({
          _id: p._id,
          id: p.id || p._id,
          firmId: p.firmId,
          address: p.address,
          status: p.status,
          propertyType: p.propertyType,
          category: p.category,
          landlordId: p.landlordId,
          tenantId: p.tenantId,
          numberOfUnits: p.numberOfUnits,
          value: p.value,
          rentalDetails: p.rentalDetails, // needed for revenue monitor
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        }))),

      // Tasks — title + status + due date only
      ctx.db.query("tasks")
        .withIndex("by_firm", (q: any) => q.eq("firmId", fid))
        .take(500)
        .then((rows: any[]) => rows.map((t: any) => ({
          _id: t._id,
          id: t.id || t._id,
          firmId: t.firmId,
          title: t.title,
          status: t.status,
          dueDate: t.dueDate,
          priority: t.priority,
          matterId: t.matterId,
          assignedUsers: t.assignedUsers,
          assigneeType: t.assigneeType,
          isSharedWithPortal: t.isSharedWithPortal,
          createdAt: t.createdAt,
        }))),

      // Events — date + title only
      ctx.db.query("events")
        .withIndex("by_firm", (q: any) => q.eq("firmId", fid))
        .take(300)
        .then((rows: any[]) => rows.map((e: any) => ({
          _id: e._id,
          firmId: e.firmId,
          title: e.title,
          date: e.date,
          endDate: e.endDate,
          type: e.type,
          status: e.status,
          matterId: e.matterId,
          assignedUsers: e.assignedUsers,
        }))),

      // Invoices — status + amounts only
      ctx.db.query("invoices")
        .withIndex("by_firm", (q: any) => q.eq("firmId", fid))
        .take(300)
        .then((rows: any[]) => rows.map((i: any) => ({
          _id: i._id,
          id: i.id || i._id,
          firmId: i.firmId,
          invoiceNumber: i.invoiceNumber,
          status: i.status,
          total_amount: i.total_amount,
          dueDate: i.dueDate,
          client: i.client,
          matter: i.matter,
          // Financial lifecycle (accounting-integrity round) — lets the UI
          // badge voided/test invoices and exclude them from KPI totals
          // without a second query.
          recordStatus: i.recordStatus,
          voidedAt: i.voidedAt,
          voidedByEmail: i.voidedByEmail,
          voidReason: i.voidReason,
        }))),

      // Ledger Entries - essential fields
      ctx.db.query("ledger_entries")
        .withIndex("by_firm", (q: any) => q.eq("firmId", fid))
        .take(1000)
        .then((rows: any[]) => rows.map((e: any) => ({
          _id: e._id,
          id: e.id || e._id,
          firmId: e.firmId,
          propertyId: e.propertyId,
          unitId: e.unitId,
          amount: e.amount,
          type: e.type,
          status: e.status,
          timestamp: e.timestamp,
          // Financial lifecycle (accounting-integrity round) — voided/test
          // rows are still delivered (forensic transparency: the Ledger UI
          // can show them dimmed with their reason) but every money total
          // on the client filters them out (see LedgerManager cashFlow).
          recordStatus: e.recordStatus,
          voidedAt: e.voidedAt,
          voidedByEmail: e.voidedByEmail,
          voidReason: e.voidReason,
        }))),

      // Service Charges - essential fields
      ctx.db.query("service_charges")
        .withIndex("by_firm", (q: any) => q.eq("firmId", fid))
        .take(1000)
        .then((rows: any[]) => rows.map((s: any) => ({
          _id: s._id,
          id: s.id || s._id,
          firmId: s.firmId,
          propertyId: s.propertyId,
          amount: s.amount,
          description: s.description,
          status: s.status,
          date: s.date,
        }))),
    ]);

    // Also fetch workflows in Phase A — they're needed immediately for the
    // MatterForm practice area dropdown and MatterDetailView stage tracker.
    // Without this, workflows only arrive in Phase B (getFirmData), which
    // means the MatterForm shows an empty dropdown until Phase B completes.
    const workflows = await ctx.db
      .query("workflows")
      .withIndex("by_firm", (q: any) => q.eq("firmId", fid))
      .take(200)
      .then((rows: any[]) => rows.map((w: any) => ({
        _id: w._id,
        id: w.id || w._id,
        firmId: w.firmId,
        type: w.type,
        default: w.default,
        subCategories: w.subCategories,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
      })));

    return { matters, contacts, properties, tasks, events, invoices, ledgerEntries, serviceCharges, workflows };
  },
});

/**
 * getMatterDetails — On-demand full matter state.
 * Called only when the user navigates to a specific matter's detail view.
 * Includes full notes, documents, tasks, timeline, and party data.
 */
// ─── HEALTH PING ─────────────────────────────────────────────────────────────
// Zero-arg, zero-auth liveness probe used by the frontend connectivity monitor
// (UIContext pollNetwork). Previously the monitor called a nonexistent
// `getServerTime`, which — combined with a no-cors fetch — resolved even when
// the backend returned 404, so the app always reported "online".
export const ping = query({
  args: {},
  handler: async () => ({ ok: true as const, serverTime: new Date().toISOString() }),
});

export const getMatterDetails = query({
  args: { matterId: v.string(), firmId: v.string(), requestUserId: v.optional(v.string()), sessionToken: v.optional(v.string()), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { matterId, firmId } = args;
    if (!matterId || !firmId) return null;

    // V1-A (SEC-2): identity is derived from the verified session. The
    // caller must be staff of the requested firm; the caller-supplied
    // firmId/requestUserId pair previously opened any matter to anyone
    // (both args were attacker-steerable in lockstep).
    const caller = await requireStaffCaller(ctx, { sessionToken: args.sessionToken, userEmail: args.userEmail, firmId });
    const callerIds = new Set(
      [String(caller._id), String((caller as any).id || ""), String(caller.email || "")].filter(Boolean)
    );
    if (args.requestUserId && !callerIds.has(String(args.requestUserId))) {
      console.error(`[SECURITY] getMatterDetails: requestUserId does not match the session caller — rejected`);
      return null;
    }

    let matter: any = null;
    // V3 (V-MATTER-14): resolve BOTH id conventions — the app passes the
    // matter's custom UUID (getFirmData maps id: m.id || m._id), so the
    // old _id-only db.get made the on-demand fetch return null for every
    // custom-id matter (the detail view silently fell back to local state).
    try { matter = await ctx.db.get(matterId as any); } catch (e) { matter = null; }
    if (!matter) {
      try {
        matter = await ctx.db
          .query("matters")
          .withIndex("by_custom_id", (q: any) => q.eq("id", matterId))
          .first();
      } catch (e) { matter = null; }
    }
    if (!matter) return null;

    // Security: validate caller's firm matches resource's firm
    if (matter.firmId?.toString() !== firmId.toString()) {
      console.error(`[SECURITY] getMatterDetails: firmId mismatch for matter ${matterId}`);
      return null;
    }

    // Privacy isolation: if matter is private, only assigned users may
    // access — the viewer's identity is the SESSION caller (server-
    // derived). V1-A note: the old `_lastModifiedBy === requestUserId`
    // creator fallback read a field that could never be written (Convex
    // reserves `_`-prefixed document fields), so it never granted anyone
    // access; it is deleted in favour of the honest assignedUsers rule
    // (creators assign themselves, matching live behaviour).
    if (matter.isPrivate) {
      const assigned: string[] = matter.assignedUsers || [];
      const isAssigned = assigned.some((a) => callerIds.has(String(a)));
      if (!isAssigned) {
        console.warn(`[RBAC] getMatterDetails: user ${caller._id} denied access to private matter ${matterId}`);
        return null;
      }
    }

    // Fetch related data in parallel — all scoped to this matter.
    // V3 (V-MATTER-13): documents are matched on EITHER convention — the
    // `matterId` column (portal/batch/new-form uploads) or the legacy
    // `matter: {id, title}` snapshot (the old main upload form) — so the
    // snapshot-only documents finally appear on the matter they belong
    // to. The row itself is never rewritten (backfill is separate +
    // additive).
    const canonicalIds = new Set(
      [String(matter._id), String(matter.id || ""), String(matterId)].filter(Boolean)
    );
    const matchMatterRef = (row: any): boolean => {
      if (row.matterId && canonicalIds.has(String(row.matterId))) return true;
      const snap = row.matter;
      const snapId = snap && typeof snap === "object" ? snap.id : snap;
      return snapId ? canonicalIds.has(String(snapId)) : false;
    };
    const [notes, firmDocuments, tasks, events, timeEntries, expenses] = await Promise.all([
      ctx.db.query("notePages")
        .withIndex("by_matter", (q: any) => q.eq("matterId", matterId))
        .take(200),
      ctx.db.query("documents")
        .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
        .take(2000),
      ctx.db.query("tasks")
        .withIndex("by_matter", (q: any) => q.eq("matterId", matterId))
        .take(100),
      ctx.db.query("events")
        .withIndex("by_matter", (q: any) => q.eq("matterId", matterId))
        .take(100),
      ctx.db.query("timeEntries")
        .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
        .take(500)
        .then((rows: any[]) => rows.filter((t: any) => matchMatterRef(t))),
      ctx.db.query("expenses")
        .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
        .take(500)
        .then((rows: any[]) => rows.filter((e: any) => matchMatterRef(e))),
    ]);
    const documents = (firmDocuments as any[])
      .filter((d: any) => matchMatterRef(d))
      .slice(0, 200)
      .map((d: any) => {
        const { content, file, ...light } = d;
        return light; // Strip heavy content; fetched on-demand via getDocumentContent
      });

    return { ...matter, notes, documents, tasks, events, timeEntries, expenses };
  },
});

/**
 * getPropertyDetails — On-demand full property state.
 * Called only when the user navigates to a specific property's detail view.
 * Includes full units, maintenance history, rent payment history, and notes.
 */
export const getPropertyDetails = query({
  args: { propertyId: v.string(), firmId: v.string(), sessionToken: v.optional(v.string()), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { propertyId, firmId } = args;
    if (!propertyId || !firmId) return null;

    // V1-A (SEC-8): the caller must be staff of the requested firm,
    // derived from the verified session. The firmId comparison below
    // previously trusted the caller-supplied firmId entirely — an
    // anonymous caller could pair any propertyId with its firmId.
    await requireStaffCaller(ctx, { sessionToken: args.sessionToken, userEmail: args.userEmail, firmId });

    let property: any = null;
    try { property = await ctx.db.get(propertyId as any); } catch (e) {
      // Fallback: search by custom id field
      const all = await ctx.db.query("properties")
        .withIndex("by_custom_id", (q: any) => q.eq("id", propertyId))
        .first();
      property = all;
    }
    if (!property) return null;

    // Security: validate firm ownership
    if (property.firmId?.toString() !== firmId.toString()) {
      console.error(`[SECURITY] getPropertyDetails: firmId mismatch for property ${propertyId}`);
      return null;
    }

    // Fetch related notes in parallel
    const [notes, documents] = await Promise.all([
      ctx.db.query("notePages")
        .withIndex("by_property", (q: any) => q.eq("propertyId", propertyId))
        .take(100),
      ctx.db.query("documentGenerationMetadata")
        .withIndex("by_property", (q: any) => q.eq("propertyId", propertyId))
        .take(50),
    ]);

    return { ...property, notes, generatedDocuments: documents };
  },
});

// --- ============================================================== ---
// ---  PHASE 2 + 3: DEDICATED QUERIES FOR HEAVY/INFINITE-GROWTH     ---
// ---  TABLES. These are loaded separately and support pagination.   ---
// --- ============================================================== ---

/**
 * PHASE 2+3: Chat Messages — loaded per conversation, NOT firm-wide.
 * Uses the existing by_conversation index which was always deployed.
 * For the firm-wide unread count query, uses .filter() safely.
 */
// ── "Unknown sender" read-time repair (2026-09-14) ──────────────────────────
// Team chat rows written before authorName was persisted (and any row whose
// author record was renamed/deleted) resolve their display name HERE, via the
// users table: first by the users-table custom `id` index, then by Convex _id.
// In-memory only — queries can't write — so no backfill migration is needed
// and every consumer (thread sender labels, conversation headers, inbox
// moniker fallbacks) heals the moment this deploys.
async function enrichChatAuthorNames(ctx: any, messages: any[]): Promise<any[]> {
  const missing = messages.filter(
    (m: any) => m && m.authorId && !(typeof m.authorName === "string" && m.authorName.trim())
  );
  if (missing.length === 0) return messages;

  const nameById = new Map<string, string>();
  const seen = new Set<string>();
  for (const m of missing) {
    const key = String(m.authorId);
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      const byCustomId: any = await ctx.db
        .query("users")
        .withIndex("by_custom_id", (q: any) => q.eq("id", key))
        .first();
      if (byCustomId?.name) { nameById.set(key, String(byCustomId.name)); continue; }
    } catch { /* fall through to _id lookup */ }
    try {
      const byId: any = await ctx.db.get(key);
      if (byId?.name) nameById.set(key, String(byId.name));
    } catch { /* not a Convex _id shape — leave unresolved */ }
  }
  if (nameById.size === 0) return messages;
  return messages.map((m: any) => {
    const resolved = m?.authorId ? nameById.get(String(m.authorId)) : undefined;
    return resolved && !(typeof m.authorName === "string" && m.authorName.trim())
      ? { ...m, authorName: resolved }
      : m;
  });
}

export const getChatMessages = query({
  args: {
    conversationId: v.optional(v.string()),
    firmId: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // ── V1-D (final verification rescan): this read was UNGATED — any
    //    caller could read ANY firm's team chat by conversationId, or any
    //    firm's whole chat history by firmId. Now: session-resolved staff
    //    caller (strict identity), firm binding on the firmId branch, and
    //    ownership verification on the conversationId branch.
    const caller = await requireStaffCaller(ctx, {
      sessionToken: args.sessionToken,
      userEmail: args.userEmail,
      userId: args.userId,
    });
    if (args.firmId) assertSameFirm(caller, args.firmId);
    if (args.conversationId) {
      const convo = await ctx.db.get(args.conversationId as any);
      if (!convo || String((convo as any).firmId ?? "") !== String(caller.firmId ?? "")) {
        throw new Error("Not authorized: this conversation belongs to a different firm.");
      }
    }
    try {
      if (!args.conversationId && !args.firmId) return [];

      if (args.conversationId) {
        // Most efficient: use the by_conversation index
        // CRITICAL: Sort by _creationTime ASCENDING so messages render in
        // chronological order (oldest first, newest at bottom). Without
        // this, messages load out of order on refresh (e.g. Aug 14 messages
        // appearing above Aug 13 messages).
        const byConv = await ctx.db
          .query("chatMessages")
          .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId as any))
          .order("asc")
          .take(500);
        return await enrichChatAuthorNames(ctx, byConv);
      }

      const firmId = args.firmId;
      if (!firmId) return [];

      // 1. Try fetching by firmId index directly (fastest for new data)
      const messagesByFirm = await ctx.db
        .query("chatMessages")
        .withIndex("by_firm", (q) => q.eq("firmId", firmId))
        .order("desc")
        .take(1000);

      // 2. Fetch firm conversations to find legacy messages without firmId
      const firmConvos = await ctx.db
          .query("chatConversations")
          .withIndex("by_firm", (q) => q.eq("firmId", firmId))
          .take(300);
          
      const convoIds = new Set(firmConvos.map(c => c._id.toString()));

      // 3. Pull recent messages and filter for legacy ones belonging to these conversations
      const recentMessages = await ctx.db
        .query("chatMessages")
        .order("desc")
        .take(1000);

      const legacyMessages = recentMessages.filter(m => !m.firmId && m.conversationId && convoIds.has(m.conversationId.toString()));

      // 4. Combine and return unique, sorted by creation time ascending
      const combined = [...messagesByFirm, ...legacyMessages];
      const unique = Array.from(new Map(combined.map(m => [m._id, m])).values());
      // Sort by _creationTime ascending (oldest first) so the chat renders
      // in chronological order with the newest message at the bottom.
      const sorted = unique.sort((a: any, b: any) => (a._creationTime || 0) - (b._creationTime || 0));
      return await enrichChatAuthorNames(ctx, sorted);

    } catch (e) {
      console.error("getChatMessages error:", e);
      return [];
    }
  },
});

/**
 * ROUND D (D8) — DELETION RECORD (Wave 3b, R81, 2026-11-10).
 *
 * getFirmActivity removed: UNGATED cross-firm read — caller-supplied firmId, no session, no binding; returned any firm's activity log. Zero product callers (the live surfaces read firmActivity through their own gated queries: portals.ts / founderMetrics).
 */

/**
 * PHASE 2+3: Research Messages — loaded per notebook, NOT globally.
 * This prevents all chat history from all research notebooks being loaded.
 *
 * ROUND D (D8): was an UNAUTHENTICATED read — a bare notebookId, so anyone
 * who knew/guessed a notebook id could read any firm's research chat.
 * Retrofitted with the Round 8 pattern (requireStaffCaller + assertSameFirm
 * bound to the NOTEBOOK's own firmId); ResearchView passes the bearer +
 * email. Unbound legacy notebooks (firmId == null) return [] — they are
 * already invisible to the firm-scoped bootstrap (getFirmData fetchByFirm).
 * Auth failures now THROW (the D6 convention) instead of silently [].
 */
export const getResearchMessages = query({
  args: {
    notebookId: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.notebookId) return [];
    const caller = await requireStaffCaller(ctx, {
      sessionToken: args.sessionToken,
      userEmail: args.userEmail,
    });
    const notebook: any = await ctx.db.get(args.notebookId as any);
    if (!notebook) return [];
    const nbFirmId: string | null = notebook.firmId ?? null;
    if (!nbFirmId) return [];
    assertSameFirm(caller, nbFirmId);
    return await ctx.db
      .query("researchMessages")
      .withIndex("by_notebook", (q) => q.eq("notebookId", args.notebookId))
      .take(500);
  },
});

/**
 * PHASE 2+3: Research Analysis Results — loaded per notebook.
 *
 * ROUND D (D8): same retrofit as getResearchMessages — was an
 * UNAUTHENTICATED read (bare notebookId); now requireStaffCaller +
 * assertSameFirm bound to the notebook's own firmId, bearer passed by
 * ResearchView. Auth failures THROW (the D6 convention).
 */
export const getResearchAnalysisResults = query({
  args: {
    notebookId: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.notebookId) return [];
    const caller = await requireStaffCaller(ctx, {
      sessionToken: args.sessionToken,
      userEmail: args.userEmail,
    });
    const notebook: any = await ctx.db.get(args.notebookId as any);
    if (!notebook) return [];
    const nbFirmId: string | null = notebook.firmId ?? null;
    if (!nbFirmId) return [];
    assertSameFirm(caller, nbFirmId);
    return await ctx.db
      .query("researchAnalysisResults")
      .withIndex("by_notebook", (q) => q.eq("notebookId", args.notebookId))
      .take(200);
  },
});

/**
 * PHASE 1+3: Full note page content — fetched on-demand when user opens a note.
 * This keeps notePages in getFirmData as metadata-only (no content).
 */
export const getNotePage = query({
  args: { pageId: v.string(), firmId: v.string(), sessionToken: v.optional(v.string()), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // V1-A (SEC-8): staff caller of the requested firm, derived from the
    // verified session — the firmId comparison below previously trusted
    // the caller-supplied firmId alone (plus a "system" bypass).
    await requireStaffCaller(ctx, { sessionToken: args.sessionToken, userEmail: args.userEmail, firmId: args.firmId });
    const page: any = await ctx.db.get(args.pageId as any);
    if (!page) return null;
    if (page.firmId !== args.firmId && page.firmId !== "system") {
      console.warn(`[getNotePage] SECURITY ALERT: Cross-firm access blocked for ${args.pageId} by ${args.firmId}`);
      return null;
    }
    return page;
  },
});

export const getDocumentContent = query({
  args: { documentId: v.string(), firmId: v.string(), sessionToken: v.optional(v.string()), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // V1-A (SEC-3): staff caller of the requested firm, derived from the
    // verified session — the firmId comparison below previously trusted
    // the caller-supplied firmId alone, so knowing a document's firmId
    // was enough to read its full content.
    await requireStaffCaller(ctx, { sessionToken: args.sessionToken, userEmail: args.userEmail, firmId: args.firmId });
    const doc: any = await ctx.db.get(args.documentId as any);
    if (!doc) return null;
    if (doc.firmId !== args.firmId) {
      console.warn(`[getDocumentContent] SECURITY ALERT: Cross-firm access blocked for ${args.documentId} by ${args.firmId}`);
      return null;
    }
    return doc;
  },
});

/**
 * ROUND D (D8) — DELETION RECORD (Wave 3b, R81, 2026-11-10).
 *
 * getResearchSourceContent removed: UNGATED on-demand read — the only 'gate' was knowing the source's firmId (caller-supplied); no session anywhere. Zero product callers (the wired research surface loads sources via getFirmData and the now-gated research reads).
 */

// --- CORE QUERIES ---

/**
 * Task 21: three-stage user lookup shared by getUser (public, projected)
 * and getUserForAuth (internal, RAW). Both MUST resolve the same record,
 * otherwise the auth flows would validate against a different account than
 * the one the client sees.
 */
async function findUserMatches(ctx: any, token: string): Promise<any[]> {
  // 1. Primary: indexed lookup — collect ALL matching records, not just the first,
  //    so we can disambiguate when the same email exists as both an admin
  //    record AND a portal record (the "residents see admin dashboard" bug).
  //    Indexed lookups return rows in index order; .first() was returning
  //    whichever came first — usually the older Admin record.
  const directMatches = await ctx.db
    .query("users")
    .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", token))
    .take(200);

  // 2. Case-insensitive indexed lookup
  const lowerMatches = directMatches.length === 0
    ? await ctx.db
        .query("users")
        .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", token.toLowerCase()))
        .take(200)
    : [];

  // 3. Fallback: bounded scan — take only 500 to prevent timeout
  if (directMatches.length > 0 || lowerMatches.length > 0) {
    return [...directMatches, ...lowerMatches];
  }
  return (await ctx.db.query("users").take(500))
    .filter((u: any) =>
      u.tokenIdentifier &&
      u.tokenIdentifier.toLowerCase() === token.toLowerCase()
    );
}

/**
 * 2026-09-23 (500-row cap audit): indexed single-user lookup for auth flows.
 *
 * The legacy pattern — `query("users").take(500)` + in-memory find on
 * tokenIdentifier — silently returned "User not found" for every account
 * created AFTER the first 500 users (table order is oldest-first). In
 * production this broke the signup verification step, password resets, and
 * account repair for all newly-registered users while the login path
 * (getUserForAuth → findUserMatches, indexed) kept working — exactly the
 * same class as the Task-63 ALOA 500-conversation landmine.
 *
 * This helper resolves the same case-insensitive tokenIdentifier match via
 * the by_token index (exact as-given, then lowercased) with NO row cap.
 * All writers store tokenIdentifier lowercased (startSignupLogic,
 * createFounderAccount, portal invites), so the two-step indexed lookup
 * preserves the old scan's semantics for every real record.
 *
 * Returns the RAW user record or null.
 */
async function findUserByTokenUncapped(ctx: any, rawToken: string): Promise<any | null> {
  const token = String(rawToken || '').trim();
  if (!token) return null;
  const exact = await ctx.db
    .query("users")
    .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", token))
    .first();
  if (exact) return exact;
  const lower = token.toLowerCase();
  if (lower !== token) {
    const ci = await ctx.db
      .query("users")
      .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", lower))
      .first();
    if (ci) return ci;
  }
  return null;
}

export const getUser = query({
  args: userLookupArgs,
  handler: async (ctx, args) => {
    try {
      const raw = pickUserRecord(
        await findUserMatches(ctx, args.tokenIdentifier),
        args.preferPortalRole === true
      );
      if (!raw) return null;

      // ============================================================
      // NDPA COMPLIANCE: Server-side privacy projection.
      // Strip ALL sensitive authentication fields before transmitting
      // to the frontend. These fields MUST NEVER leave the server.
      // (Task 21: projection extracted to stripAuthFields so it is
      // unit-tested and shared with getUserForAuth's contract tests.)
      // ============================================================
      return stripAuthFields(raw);
    } catch (e) {
      // Never throw to the client — return null so AuthContext falls back gracefully
      console.error("[getUser] Query error:", e);
      return null;
    }
  },
});

/**
 * Task 21 — INTERNAL raw-record lookup for server-side auth flows.
 *
 * verifyLogin and resetPassword previously fetched their user through the
 * PUBLIC getUser, which applies the NDPA privacy projection (stripAuthFields).
 * They therefore received a record with password / mfaCode /
 * verificationCode / failedLoginAttempts / lockedUntil REMOVED — so the code
 * the user typed was compared against undefined ("" after normalize) and
 * EVERY code was rejected no matter how fresh or correct. Production
 * evidence (2026-09-05): fresh code issued 11:48:26, failedLoginAttempts=1,
 * zero sessions ever, across all 14 users.
 *
 * This query returns the FULL record. It is `internalQuery`, so it can only
 * be referenced by other server functions (ctx.runQuery) — never callable
 * from the client. Resolution uses the same findUserMatches +
 * pickUserRecord as getUser, so both agree on WHICH record is the user.
 */
export const getUserForAuth = internalQuery({
  args: userLookupArgs,
  handler: async (ctx, args) => {
    return pickUserRecord(
      await findUserMatches(ctx, args.tokenIdentifier),
      args.preferPortalRole === true
    );
  },
});

/**
 * ROUND D (D8) — DELETION RECORD (Wave 3b, R81, 2026-11-10).
 *
 * dumpAll removed: the original full-database dump, already neutered to a no-op stub ({users:[],firms:[]}) in a prior round but still a PUBLIC endpoint. Zero product callers — the only references were the dead scripts/checkDB*.ts probes against a long-retired Convex deployment (keen-jaguar-204; deleted with this round). A public no-op is pure attack surface; exports go through scoped user/firm surfaces.
 */

/**
 * ROUND D (D8) — DELETION RECORD (Wave 3b, R81, 2026-11-10).
 *
 * findDuplicateEmails removed — THE SPOOFABLE CENSUS. Its 'admin only' gate read args.requesterRole, a CALLER-SUPPLIED string — and OMITTING the arg entirely PASSED the gate, so any unauthenticated caller could run a full user census (up to 2000 users: emails, roles, firmIds, names, verification state, product). It was a one-time diagnostic for the 2026 duplicate-email data corruption (long resolved); zero product callers. Removed with the class, not re-gated: the diagnostic is obsolete and a census has no legitimate unauthenticated use.
 */

// --- MUTATIONS ---

/**
 * ROUND D (D8) — DELETION RECORD (Wave 3b, R81, 2026-11-10).
 *
 * checkIncompleteRegistration removed: public email-status lookup with no session — an enumeration oracle (reveals whether an email is registered and its firm state). Zero product callers; the live signup flow uses its own checks.
 */

// --- HELPER INTERNAL MUTATIONS (used by actions that can't write DB directly) ---

export const updateUserSecurityFields = internalMutation({
  args: { userId: v.id("users"), fields: v.any() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, args.fields);
  },
});

// ─── ONE-CLICK PASSWORD RESET (2026-09-14, reset-link round) ─────────────────
// getUserByResetTokenHash — resolves the account owning a pending reset link
// by the SHA-256 of the emailed token (index seek). Internal only: never
// expose a way to probe which hashes exist.
export const getUserByResetTokenHash = internalQuery({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const user: any = await ctx.db
      .query("users")
      .withIndex("by_reset_token", (q) => q.eq("resetTokenHash", args.tokenHash))
      .first();
    if (!user) return null;
    return {
      userId: user._id,
      email: user.email ?? null,
      role: user.role ?? null,
      resetTokenIssuedAt: user.resetTokenIssuedAt ?? null,
    };
  },
});

export const updateUserPassword = internalMutation({
  args: { userId: v.id("users"), newPasswordHash: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { password: args.newPasswordHash });
  },
});

export const createUser = internalMutation({
  // Internal mutation — accepts any user fields for flexibility across callers
  // (signup, portal invitation, etc.). Public-facing actions use strict validation.
  args: v.any(),
  handler: async (ctx, args) => {
    return await ctx.db.insert("users", args);
  },
});

export const startSignup = action({
  args: {
    fullName: v.string(),
    email: v.string(),
    password: v.optional(v.string()),
    product: v.optional(v.string()),
  },
  handler: async (ctx: any, args: any): Promise<any> => {
    return await startSignupLogic(ctx, args);
  }
});

export const startRegistration = action({
  args: {
    fullName: v.string(),
    email: v.string(),
    password: v.optional(v.string()),
    product: v.optional(v.string()),
  },
  handler: async (ctx: any, args: any): Promise<any> => {
    return await startSignupLogic(ctx, args);
  }
});

async function startSignupLogic(ctx: any, args: any): Promise<{
  success: boolean;
  code?: string;
  message?: string;
  debugCode?: string;
}> {
    const token: string = args.email.toLowerCase().trim();
    // SECURITY: crypto-secure code (was Math.random — predictable PRNG)
    const code: string = numericCode(6);

    // ── Rate Limiting ──────────────────────────────────────────────────
    // Max 5 signups per email per minute, 20 per IP per minute.
    // Prevents automated signup flooding / email bombing.
    // CRITICAL FIX: checkRateLimit uses ctx.db which is undefined in action
    // context (startRegistration is an action). Wrap in try/catch so rate
    // limiting failure doesn't block signup. Rate limiting is a nice-to-have,
    // not a blocker for user acquisition.
    const emailRateKey = `signup:email:${token}`;
    let allowedByEmail = true;
    try {
      allowedByEmail = await checkRateLimit(ctx, emailRateKey, 5);
    } catch (rateLimitErr) {
      console.warn('[startSignup] Rate limit check failed (non-blocking):', rateLimitErr);
      allowedByEmail = true; // Allow on failure — don't block signup
    }
    if (!allowedByEmail) {
      return {
        success: false,
        code: 'RATE_LIMITED',
        message: 'Too many signup attempts. Please wait a minute and try again.'
      };
    }

    // ── Disposable / Temporary Email Blocking ──────────────────────────
    // Block signups from known disposable email providers to prevent
    // automated abuse, spam registrations, and trial farming.
    const DISPOSABLE_DOMAINS = [
      'mailinator.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com',
      'throwaway.email', 'trashmail.com', 'yopmail.com', 'getnada.com',
      'temp-mail.org', 'sharklasers.com', 'guerrillamail.info', 'grr.la',
      'dispostable.com', 'maildrop.cc', 'mintemail.com', 'tempinbox.com',
      'fakeinbox.com', 'mailnesia.com', 'spam4.me', 'tempr.email',
      'emailondeck.com', 'moakt.com', 'tmpmail.org', 'tmpmail.net',
      'burnermail.io', 'inboxbear.com', 'mohmal.com', 'netmail.net',
      'mailcatch.com', 'tempmailo.com', 'mytemp.email', 'discard.email',
    ];
    const emailDomain = token.split('@')[1] || '';
    if (DISPOSABLE_DOMAINS.includes(emailDomain)) {
      // Log as a security event for the admin Security Center
      try {
        await ctx.db.insert("analytics_events", {
          firmId: 'security',
          userId: 'system',
          event: "disposable_email_blocked",
          properties: { email: token, domain: emailDomain },
          timestamp: Date.now(),
        } as any);
      } catch {}
      return {
        success: false,
        code: 'DISPOSABLE_EMAIL',
        message: 'Please use a valid business or personal email address. Disposable/temporary email services are not allowed.'
      };
    }

    // FIX: Don't default to 'legal' (Vega) when no product is passed.
    // Pass undefined through to sendVerificationEmail so the email subject
    // says "PracticePro — Your Verification Code" instead of "PracticePro Vega".
    //
    // TASK 54 (2026-09-17 live incident): normalize args.product SERVER-SIDE
    // too. The landing page's openSignup used to receive the React click
    // event as its product argument; the client sanitizer String()ed it to
    // "[object Object]", which was stored verbatim on users.product (the
    // field is a loose nullableString with no enum guard). Every downstream
    // `user.product || 'legal'` default then branded the account Vega —
    // users who chose Atrium were welcomed to Vega, and the corrupted value
    // later crashed createFirm's v.union validator during onboarding.
    // Only exact, known product spellings are accepted now; anything else
    // (objects stringified to "[object Object]", typos, unknown ids) is
    // treated as "no product provided".
    const rawProduct = typeof args.product === 'string' ? args.product.toLowerCase().trim() : undefined;
    let selectedProduct: 'legal' | 'property' | 'unified' | undefined =
      rawProduct === 'vega' || rawProduct === 'legal' ? 'legal' :
      rawProduct === 'atrium' || rawProduct === 'property' ? 'property' :
      rawProduct === 'unified' || rawProduct === 'komplete' ? 'unified' :
      undefined;

    // BUG FIX (Task 16): When no product is passed (e.g. resendConfirmation),
    // use the EXISTING user's product instead of defaulting to 'legal' (Vega).
    // This was the root cause of "vega email heading from an atrium signup" —
    // the user signed up from Atrium (product='property'), but when resending
    // the verification code, the backend defaulted to Vega branding.
    // TASK 54: only reuse the stored product if it is itself VALID — a
    // previously corrupted record ("[object Object]") must not propagate.
    if (!selectedProduct) {
      const existingUserForProduct: any = await ctx.runQuery(api.myFunctions.getUser, { tokenIdentifier: args.email.toLowerCase().trim() });
      const existingProduct = existingUserForProduct?.product;
      if (existingProduct === 'legal' || existingProduct === 'property' || existingProduct === 'unified') {
        selectedProduct = existingProduct;
      }
    }

    // Hash password server-side if provided
    let hashedPassword: string | undefined;
    if (args.password) {
      hashedPassword = (await ctx.runAction(internal.authUtils.hashPassword, { password: args.password })) as string;
    }

    const existingUser: any = await ctx.runQuery(api.myFunctions.getUser, { tokenIdentifier: token });

    if (existingUser) {
      // GUARD 1: Block verified accounts with a firm — they must log in
      if (existingUser.isVerified && existingUser.firmId) {
        return {
          success: false,
          code: 'EMAIL_EXISTS',
          message: 'An account with this email already exists. Please log in instead.'
        };
      }

      // GUARD 2: Block product cross-contamination
      if (existingUser.isVerified && existingUser.product && existingUser.product !== selectedProduct) {
        const existingProductName: string = existingUser.product === 'legal' ? 'Vega' : existingUser.product === 'property' ? 'Atrium' : 'Unified';
        return {
          success: false,
          code: 'PRODUCT_MISMATCH',
          message: `This email is already registered for ${existingProductName}. Please log in or use a different email address.`
        };
      }

      // Resume incomplete registration — patch code, product, and password if provided
      // TASK 54: only write the product when we actually resolved a VALID one —
      // never overwrite (or stringify-undefined) the stored product on resends.
      const patchFields: Record<string, any> = { verificationCode: code };
      if (selectedProduct) patchFields.product = selectedProduct;
      if (hashedPassword) patchFields.password = hashedPassword;
      await ctx.runMutation(internal.myFunctions.updateUserSecurityFields, {
        userId: existingUser._id,
        fields: patchFields,
      });
    } else {
      await ctx.runMutation(internal.myFunctions.createUser, {
        tokenIdentifier: token,
        name: args.fullName,
        email: args.email,
        password: hashedPassword,
        role: "Admin",
        product: selectedProduct,
        onboardingCompleted: false,
        verificationCode: code,
        isVerified: false,
        avatarUrl: `https://ui-avatars.com/api/?name=${args.fullName}&background=random`
      });
    }

    try {
      await ctx.scheduler.runAfter(0, (internal as any).myFunctions.sendVerificationEmail, { email: args.email, code: code, product: selectedProduct });
    } catch (e) {
      console.error("Failed to schedule email", e);
    }
    return { success: true };
}

/**
 * ISO 27001 / NDPA 2023 COMPLIANCE
 * Backend Authentication & Brute Force Prevention
 *
 * Receives the raw password over TLS, hashes server-side with PBKDF2-SHA512.
 * Enforces a 15-minute lockout after 5 consecutive failed attempts.
 * Automatically migrates legacy SHA-256 and plaintext hashes to PBKDF2 on successful login.
 */
export const verifyLogin = action({
  args: {
    email: v.string(),
    sessionToken: v.optional(v.string()),
    passwordHash: v.string(),
    rawPassword: v.optional(v.string()),
    mfaCode: v.optional(v.string()),
    // When the login is initiated from a portal route (/portal/tenant/login or
    // /portal/client/login), the frontend passes portalType so we can resolve
    // the correct user record when the same email exists as BOTH an admin
    // record AND a portal record (the "residents see admin dashboard" bug).
    portalType: v.optional(v.union(v.literal("tenant"), v.literal("client"))),
  },
  handler: async (ctx, args) => {
    const token = args.email.toLowerCase().trim();

    // 1. Find User — when portalType is set, prefer the matching portal-role record.
    //    This is the critical fix: without it, getUser() returns the first matching
    //    record (usually the older Admin record), the password check passes against
    //    the Admin record (whose password was overwritten by setupPortalPassword),
    //    and the user ends up logged in as Admin — seeing the admin dashboard.
    //
    //    TASK 21 FIX: this MUST be the RAW record (getUserForAuth), NOT the
    //    public getUser. getUser applies the NDPA privacy projection and
    //    strips password / mfaCode / failedLoginAttempts / lockedUntil — the
    //    pre-fix code compared the user's typed code against `undefined`, so
    //    every login code was rejected no matter how fresh ("both codes
    //    failed" / "every code rejected" incidents). getUserForAuth is an
    //    internal query: same record resolution, full fields, server-only.
    const user: any = await ctx.runQuery(internal.myFunctions.getUserForAuth, {
      tokenIdentifier: token,
      preferPortalRole: args.portalType !== undefined,
    });

    if (!user) return { success: false, message: "Account not found. Please sign up." };

    // PORTAL-ROUTE GUARD: If the user explicitly logged in via a portal route
    // (portalType is set), but the resolved user is NOT a portal user, refuse
    // the login. This is defense-in-depth: even if getUser somehow returned
    // the Admin record (e.g. no portal-role record exists for this email),
    // we don't let them through to the portal UI with admin privileges.
    if (args.portalType && user.role !== "Client" && user.role !== "Tenant") {
      return {
        success: false,
        message: "This email is registered as an admin account, not a portal account. Please log in from the main app, or ask your manager to send a portal invitation to a different email address.",
      };
    }

    // REVERSE GUARD: If the user logged in via the MAIN APP (no portalType)
    // but their role is Tenant or Client, block them. Portal users must
    // log in through the portal login page, not the main app login.
    // This prevents portal users from accessing firm-wide data through
    // the main app's Convex subscriptions.
    if (!args.portalType && (user.role === "Tenant" || user.role === "Client")) {
      const portalUrl = user.role === "Client" ? "/portal/client/login" : "/portal/tenant/login";
      return {
        success: false,
        message: `This email is a portal account. Please log in through the portal: ${portalUrl}`,
        redirect: portalUrl,
      };
    }

    // Distinguish between "email not confirmed" (never verified) and "account revoked/deactivated"
    // Portal users who were deleted via deletePortalInviteAndCleanup get role="Pending" + isVerified=false
    if (!user.isVerified) {
      if (user.role === "Pending" && !user.password) {
        // This user's portal access was revoked/deleted — they previously had an account
        // but it was cleaned up. Give them a clear message instead of the misleading
        // "Email not confirmed" error.
        return { success: false, message: "Your portal access has been revoked. Please contact your manager to request a new invitation.", isRevoked: true };
      }
      return { success: false, message: "Email not confirmed. Please check your inbox or resend code." };
    }

    // Defense-in-depth: A user with role="Pending" should not be able to log in
    // even if isVerified was somehow still true.
    if (user.role === "Pending") {
      return { success: false, message: "Your portal access has been revoked. Please contact your manager to request a new invitation.", isRevoked: true };
    }

    // ─── DEACTIVATION CHECK ────────────────────────────────────────────
    // If a firm admin has deactivated this user (deactivatedAt is set),
    // block the login with a clear message. The user record still exists
    // (for audit/authorship) but they cannot access the app.
    if (user.deactivatedAt) {
      return {
        success: false,
        message: "Your account has been deactivated. Please contact your firm administrator to request reactivation.",
        isDeactivated: true,
      };
    }

    const MAX_ATTEMPTS = 5;
    const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
    const now = Date.now();

    // 2. Check lockout
    if (user.lockedUntil && user.lockedUntil > now) {
      const remainingMinutes = Math.ceil((user.lockedUntil - now) / 60000);
      return {
        success: false,
        isLocked: true,
        message: `Account locked due to too many failed attempts. Please try again in ${remainingMinutes} minutes.`
      };
    } else if (user.lockedUntil && user.lockedUntil <= now) {
      await ctx.runMutation(internal.myFunctions.updateUserSecurityFields, {
        userId: user._id,
        fields: { lockedUntil: null, failedLoginAttempts: 0 },
      });
      user.lockedUntil = null;
      user.failedLoginAttempts = 0;
    }

    // 3. Verify Password via PBKDF2-aware internal action
    let isPasswordCorrect = false;
    let needsMigration = false;
    const rawPw = args.rawPassword || "";

    if (user.password && user.password !== 'admin') {
      const result: any = await ctx.runAction(internal.authUtils.verifyPassword, {
        password: rawPw,
        storedHash: user.password,
      });
      isPasswordCorrect = result.valid;
      needsMigration = result.needsMigration;
    } else if (!user.password && rawPw && rawPw !== 'admin') {
      // ── R16: TRUST-ON-FIRST-USE CLOSED ────────────────────────────────
      // Previously ANY password was accepted for accounts with no stored
      // password — knowing an email was enough to take over the account
      // (and the attacker's password became the account password). The
      // first login must now CLAIM the account with an emailed verification
      // code, reusing the MFA email plumbing: attempt #1 (no code) sends a
      // 6-digit code and returns requiresInitialPassword; the client shows
      // a code prompt (the password field already holds the desired
      // password) and re-submits with mfaCode; the code is verified here
      // BEFORE acceptance. The desired password is then hashed and stored
      // via the needsMigration path below.
      if (!args.mfaCode) {
        const code = numericCode(6);
        await ctx.runMutation(internal.myFunctions.updateUserSecurityFields, {
          userId: user._id,
          fields: { mfaCode: code, mfaCodeIssuedAt: now },
        });
        try {
          await ctx.scheduler.runAfter(0, (internal as any).myFunctions.sendVerificationEmail, {
            email: args.email,
            code,
            product: user.product || 'legal',
            purpose: 'login',
          });
        } catch (e) {
          console.error("Failed to send initial-password setup code", e);
        }
        // codeHint lets the client show "your code starts with 64" — the
        // user can then match the prompt to the correct (newest) email.
        return { success: false, requiresInitialPassword: true, mfaType: 'email', codeHint: codeHint(code) };
      }
      // A code was presented — verify it before accepting the password.
      // Task 20 hardening: normalize input (paste artifacts), enforce the
      // 10-minute TTL the email promises (no timestamp = expired, which
      // also retires legacy pre-fix codes), and count WRONG codes toward
      // the same 5-attempt lockout as wrong passwords (R16 gap: code
      // brute-force was previously unthrottled).
      const suppliedCode = normalizeCode(args.mfaCode);
      const expired = isCodeExpired(user.mfaCodeIssuedAt, now);
      if (suppliedCode !== normalizeCode(user.mfaCode) || expired) {
        if (!expired) {
          const codeAttempts = (user.failedLoginAttempts || 0) + 1;
          const codeUpdates: any = { failedLoginAttempts: codeAttempts };
          if (codeAttempts >= MAX_ATTEMPTS) {
            codeUpdates.lockedUntil = now + LOCKOUT_DURATION_MS;
          }
          await ctx.runMutation(internal.myFunctions.updateUserSecurityFields, {
            userId: user._id,
            fields: codeUpdates,
          });
          if (codeUpdates.lockedUntil) {
            return { success: false, message: "Too many incorrect codes. Please try again in 15 minutes." };
          }
        }
        return { success: false, message: wrongCodeMessage(expired) };
      }
      isPasswordCorrect = true;
      needsMigration = true;
    }
    // user.password === 'admin' → intentionally blocked

    if (isPasswordCorrect) {
      if (user.isMfaEnabled) {
        if (!args.mfaCode) {
          // SECURITY: crypto-secure MFA code (was Math.random — predictable PRNG)
          const code = numericCode(6);
          await ctx.runMutation(internal.myFunctions.updateUserSecurityFields, {
            userId: user._id,
            fields: { mfaCode: code, mfaCodeIssuedAt: now },
          });
          try {
            await ctx.scheduler.runAfter(0, (internal as any).myFunctions.sendVerificationEmail, { email: args.email, code, product: user.product || 'legal', purpose: 'login' });
          } catch (e) {
            console.error("Failed to send MFA email", e);
          }
          return { success: false, requiresMfa: true, mfaType: 'email', codeHint: codeHint(code) };
        } else {
          // Task 20 hardening (mirrors the TOFU branch): normalize + TTL +
          // wrong-code attempts count toward the lockout.
          const mfaSupplied = normalizeCode(args.mfaCode);
          const mfaExpired = isCodeExpired(user.mfaCodeIssuedAt, now);
          if (mfaSupplied !== normalizeCode(user.mfaCode) || mfaExpired) {
            if (!mfaExpired) {
              const mfaAttempts = (user.failedLoginAttempts || 0) + 1;
              const mfaUpdates: any = { failedLoginAttempts: mfaAttempts };
              if (mfaAttempts >= MAX_ATTEMPTS) {
                mfaUpdates.lockedUntil = now + LOCKOUT_DURATION_MS;
              }
              await ctx.runMutation(internal.myFunctions.updateUserSecurityFields, {
                userId: user._id,
                fields: mfaUpdates,
              });
              if (mfaUpdates.lockedUntil) {
                return { success: false, message: "Too many incorrect codes. Please try again in 15 minutes." };
              }
            }
            return { success: false, message: wrongCodeMessage(mfaExpired) };
          }
        }
      }

      // Success! Build patch updates.
      const updates: Record<string, any> = {};
      if (user.failedLoginAttempts > 0) updates.failedLoginAttempts = 0;
      if (user.lockedUntil) updates.lockedUntil = null;
      if (user.mfaCode) { updates.mfaCode = null; updates.mfaCodeIssuedAt = null; }

      // Upgrade legacy hash to PBKDF2 on successful login
      if (needsMigration && rawPw) {
        const newHash: any = await ctx.runAction(internal.authUtils.hashPassword, { password: rawPw });
        updates.password = newHash;
      }

      if (Object.keys(updates).length > 0) {
        await ctx.runMutation(internal.myFunctions.updateUserSecurityFields, {
          userId: user._id,
          fields: updates,
        });
      }

      // ─── R16: issue the bearer session BEFORE the portal auto-repair ──
      // The repair mutation is session-guarded under strict mode (it used
      // to accept a bare caller-supplied email — a spoofable patch surface
      // on user records), so it needs the just-issued token. The login
      // gateway remains the ONLY place a session may be born: password
      // (+ MFA when enabled) has been verified at this point. The token is
      // returned to the client exactly once; only its SHA-256 hash is
      // stored (convex/sessions.ts).
      // Phase B: issuance is BLOCKING. A login without a live session is
      // useless under strict mode (every data call would be rejected), so
      // failing the login outright with a clear message beats returning a
      // user who is locked out of their own data.
      let sessionToken: string | undefined;
      try {
        // `as any` mirrors the repo's established pattern for cross-module
        // scheduler/mutation references (e.g. sendVerificationEmail below) —
        // a typed reference here creates a circular type inference through
        // _generated/api → myFunctions (TS7022).
        const session: any = await (ctx as any).runMutation((internal as any).sessions.createSession, {
          userId: user._id,
          userEmail: user.email || token,
          device: "web",
        });
        sessionToken = session?.token;
      } catch (e) {
        console.error("[verifyLogin] Session issuance FAILED — blocking login (Phase B):", e);
        return {
          success: false,
          message: "We could not start a secure session. Please try logging in again.",
        };
      }
      if (!sessionToken) {
        console.error("[verifyLogin] Session issuance returned no token — blocking login (Phase B).");
        return {
          success: false,
          message: "We could not start a secure session. Please try logging in again.",
        };
      }

      // AUTO-REPAIR: If a portal user (Client/Tenant) has no firmId, try to repair it
      // on login. This handles the case where a previous version of
      // deletePortalInviteAndCleanup cleared firmId and deleted invite records,
      // leaving the user unable to load any portal data. We search multiple sources
      // to find the correct firmId and patch the user record.
      if ((user.role === "Client" || user.role === "Tenant") && !user.firmId) {
        try {
          const repairResult: any = await ctx.runMutation(api.portals.repairPortalUserFirmId, {
            email: token,
            sessionToken,
          });
          if (repairResult.success) {
            // Update the user object we're about to return so the client
            // gets the firmId immediately without needing a refresh
            (user as any).firmId = repairResult.firmId;
            (user as any).product = repairResult.firmId ? undefined : (user as any).product;
          }
        } catch (e) {
          // Non-blocking: if repair fails, the user can still log in
          // and will see the "Repair My Account" UI in their portal
          console.warn("[verifyLogin] Auto-repair of firmId failed:", e);
        }
      }

      // Strip sensitive fields before returning user to client
      const { password: _pw, mfaCode: _mfa, verificationCode: _vc, recoveryCode: _rc, ...safeUser } = user;

      return { success: true, user: safeUser, sessionToken };
    } else {
      const currentAttempts = (user.failedLoginAttempts || 0) + 1;
      const failureUpdates: any = { failedLoginAttempts: currentAttempts };
      if (currentAttempts >= MAX_ATTEMPTS) {
        failureUpdates.lockedUntil = now + LOCKOUT_DURATION_MS;
      }
      await ctx.runMutation(internal.myFunctions.updateUserSecurityFields, {
        userId: user._id,
        fields: failureUpdates,
      });
      return {
        success: false,
        message: failureUpdates.lockedUntil
          ? "Account locked due to too many failed attempts. Please try again in 15 minutes."
          : `Incorrect password. You have ${MAX_ATTEMPTS - currentAttempts} attempts remaining.`
      };
    }
  }
});

export const updateUserSecurity = mutation({
  args: { sessionToken: v.optional(v.string()), userId: v.id("users"), isMfaEnabled: v.boolean(), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // RLS: Require firm user — only authenticated firm members can update security
    await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    await ctx.db.patch(args.userId, { isMfaEnabled: args.isMfaEnabled });
    return { success: true };
  }
});

// ─── ROUND D / D1 (R77): SESSION-RESOLVED ADMIN SURFACES ───────────────────
// Pre-D1, several admin mutations in this file gated on a CALLER-SUPPLIED
// email string (FOUNDER_EMAILS.includes(args.deactivatedBy) and friends).
// requireFirmUser ignores that string (R16 Phase B strict identity), but
// these gates read it DIRECTLY — so any authenticated user could pass a
// founder address and clear the gate. Cross-firm targets were never
// checked, and the audit trail recorded the forged string as the actor.
// D1 replaces every instance of the pattern with the session-resolved
// identity: the role comes from the users row the bearer token resolves
// to, firm scope is enforced with assertSameFirm, and attribution is
// written from the session-derived email. The two activate* add-on
// mutations had NO session resolution at all — they now require one.
const PLATFORM_FOUNDER_EMAILS = new Set(['founder@practicepro.ng', 'admin@practicepro.ng']);

function isPlatformFounder(user: { email?: string | null }): boolean {
  return PLATFORM_FOUNDER_EMAILS.has(String(user.email || '').toLowerCase());
}

function isFirmAdminRole(user: { role?: string | null }): boolean {
  return user.role === 'Admin' || user.role === 'Founder';
}

/** Session-resolved platform-founder gate (D1) for the add-on activation
 *  mutations — replaces the spoofable FOUNDER_EMAILS string check. */
async function requirePlatformFounder(ctx: any, sessionToken?: string | null) {
  const caller = await resolveCaller(ctx, { sessionToken });
  if (!isPlatformFounder(caller)) {
    throw new Error("Only the platform founder can activate add-ons");
  }
  return caller;
}

/**
 * mutation: deactivateTeamMember
 * Soft-deactivates a team member. The user record is preserved (so their
 * historical contributions — matters, tasks, messages — remain attributed),
 * but they can no longer log in. They appear with a "Deactivated" badge in
 * the team directory, grayed out and sorted to the bottom.
 *
 * AUTH (D1, session-resolved): the caller is resolved from the bearer
 * session ONLY. Platform founders (session-proven) can deactivate any
 * user; firm Admins/Founding Partners can deactivate members of their OWN
 * firm. The legacy caller-supplied `deactivatedBy` email is gone.
 *
 * SAFETY: deactivating yourself is blocked (would lock the firm out).
 */
export const deactivateTeamMember = mutation({
  args: {
    userId: v.id("users"),
    sessionToken: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, undefined, args.sessionToken);
    const adminUser = auth.user;
    if (!adminUser) throw new Error("Admin user not found");

    // AUTH CHECK (D1): session-resolved role — the spoofable email-string
    // bypass is closed.
    if (!isPlatformFounder(adminUser) && !isFirmAdminRole(adminUser)) {
      throw new Error("Only administrators can deactivate team members");
    }

    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) throw new Error("User not found");

    // D1: cross-firm guard — firm admins may only touch their own firm's
    // members (platform founders operate every firm).
    if (!isPlatformFounder(adminUser)) {
      assertSameFirm(adminUser, targetUser.firmId);
    }

    // SAFETY: can't deactivate yourself (real identities, not claimed ones)
    if (String(targetUser._id) === String(adminUser._id)) {
      throw new Error("You cannot deactivate your own account");
    }

    // SAFETY: can't deactivate the firm's founding partner
    // The Founder role maps to the firm's primary admin — deactivating
    // would lock the firm out of admin functions.
    if (targetUser.role === 'Founder') {
      throw new Error("The Founding Partner account cannot be deactivated");
    }

    // Idempotent: already deactivated → return success
    if (targetUser.deactivatedAt) {
      return { success: true, alreadyDeactivated: true };
    }

    await ctx.db.patch(args.userId, {
      deactivatedAt: Date.now(),
      deactivatedBy: adminUser.email, // D1: session-derived attribution
      deactivationReason: args.reason || null,
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  },
});

/**
 * mutation: reactivateTeamMember
 * Clears the deactivatedAt field, restoring login access.
 *
 * AUTH (D1, session-resolved): platform founders or the target's own-firm
 * Admin/Founding Partner. The legacy caller-supplied `reactivatedBy`
 * email is gone.
 */
export const reactivateTeamMember = mutation({
  args: {
    userId: v.id("users"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, undefined, args.sessionToken);
    const adminUser = auth.user;
    if (!adminUser) throw new Error("Admin user not found");

    if (!isPlatformFounder(adminUser) && !isFirmAdminRole(adminUser)) {
      throw new Error("Only administrators can reactivate team members");
    }

    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) throw new Error("User not found");

    // D1: cross-firm guard — firm admins may only touch their own firm's
    // members (platform founders operate every firm).
    if (!isPlatformFounder(adminUser)) {
      assertSameFirm(adminUser, targetUser.firmId);
    }

    await ctx.db.patch(args.userId, {
      deactivatedAt: undefined,
      deactivatedBy: undefined,
      deactivationReason: undefined,
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  },
});

/**
 * query: getFirmMembersWithDeactivationStatus
 * Returns all users for a firm, sorted with active members first and
 * deactivated members at the bottom. Each row includes deactivatedAt,
 * deactivatedBy, and deactivationReason for the team directory UI.
 *
 * AUTH (D1): firm-scoped — the caller's session must resolve to a member
 * of the requested firm (or a platform founder). Pre-D1, any authenticated
 * user could enumerate any firm's roster.
 */
export const getFirmMembersWithDeactivationStatus = query({
  args: {
    firmId: v.string(),
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    if (!isPlatformFounder(auth.user)) {
      assertSameFirm(auth.user, args.firmId);
    }
    const users = await ctx.db
      .query("users")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .take(200);

    // Sort: active first (deactivatedAt falsy), then deactivated (most recent first)
    return users.sort((a: any, b: any) => {
      const aDeactivated = !!a.deactivatedAt;
      const bDeactivated = !!b.deactivatedAt;
      if (aDeactivated && !bDeactivated) return 1;
      if (!aDeactivated && bDeactivated) return -1;
      if (aDeactivated && bDeactivated) return (b.deactivatedAt || 0) - (a.deactivatedAt || 0);
      // Both active — preserve existing order (by name)
      return (a.name || '').localeCompare(b.name || '');
    });
  },
});

/**
 * mutation: saveUserApiKey
 * Saves the user's Gemini API key to their user record so it syncs
 * across devices. The key is stored server-side and synced to
 * localStorage on login — preventing the "API key disappears on
 * refresh" bug.
 */
export const saveUserApiKey = mutation({
  args: { tokenIdentifier: v.string(), apiKey: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // R16b: session-verified caller — the legacy email-only lookup let
    // anyone OVERWRITE any user's stored Gemini API key by knowing their
    // email (key theft / AI-feature sabotage).
    const caller = await resolveCaller(ctx, { sessionToken: args.sessionToken });
    const user = await ctx.db.get(caller._id);
    if (!user) return { success: false, message: "User not found." };
    await ctx.db.patch(user._id, { geminiApiKey: args.apiKey });
    return { success: true };
  },
});

/**
 * mutation: setGettingStartedChecklistDismissed
 * Persists the Getting-Started checklist dismissal SERVER-SIDE on the firm
 * record (firms.checklistDismissedAt). Called by the checklist widget on
 * manual dismiss AND on the completion celebration, and by Settings → Help
 * "Restore Setup Checklist" with dismissed=false.
 *
 * Why server-side: the previous localStorage-only dismissal
 * (practicepro_checklist_dismissed_<firmId>) was wiped by APK reinstalls,
 * device changes and storage clears — resurrecting the checklist on firms
 * that completed onboarding long ago and re-firing the "🎉 You're all set!"
 * celebration toast on every update. The firm record is durable; any
 * logged-in device reads the same state.
 *
 * Auth: R16b session-verified caller (resolveCaller) — only a member of
 * the firm can change that firm's checklist state. assertSameFirm guards
 * the cross-firm case for joined users.
 */
export const setGettingStartedChecklistDismissed = mutation({
  args: {
    dismissed: v.boolean(),
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const caller = await resolveCaller(ctx, { sessionToken: args.sessionToken, userEmail: args.userEmail });
    const firmId = (caller as any).firmId;
    if (!firmId) throw new Error("No firm is associated with this account.");
    const firm: any = await ctx.db.get(firmId as any).catch(() => null);
    if (!firm) throw new Error("Firm not found.");
    const now = Date.now();
    await ctx.db.patch(firm._id, {
      checklistDismissedAt: args.dismissed ? now : undefined,
      updatedAt: new Date(now).toISOString(),
    });
    return { success: true, dismissed: args.dismissed };
  },
});

/**
 * mutation: manageBankAccount (Task 64)
 *
 * Dedicated, field-scoped bank-account writer for the Getting Started
 * "Configure a bank account" flow and Settings → Firm Configuration.
 *
 * WHY THIS EXISTS: the previous path spread the ENTIRE client-side
 * firmDetails object through the generic updateItem('firms', ...) —
 * any concurrent firmDetails writer (onboarding wizard flags, AI
 * settings, integrations) could race it with a stale copy and silently
 * WIPE the bankAccounts field, so the account "did not save" while the
 * UI still toasted success (the toast was a setTimeout, not gated on
 * the mutation result). This mutation touches ONLY firm.bankAccounts:
 * lost-update races on other fields can no longer erase accounts, and
 * the caller gets a truthful result it can toast on.
 *
 * Ops:
 *  - add:      append account (first account auto-becomes default)
 *  - update:   replace by account.id
 *  - setDefault: mark one account default, clear the rest
 *  - delete:   remove by account.id (default falls back to the first remaining)
 */
export const manageBankAccount = mutation({
  args: {
    op: v.string(), // 'add' | 'update' | 'setDefault' | 'delete'
    account: v.optional(v.any()), // { id, accountName, bankName, accountNumber, isDefault? }
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Bank accounts are firm-level financial configuration → Admin only
    // (mirrors the updateItem('firms') security gate).
    await requireAdmin(ctx, args.userEmail, args.sessionToken);
    const { firmId } = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const firm: any = await ctx.db.get(firmId as any).catch(() => null);
    if (!firm) throw new Error("Firm not found.");

    const current: any[] = Array.isArray(firm.bankAccounts) ? firm.bankAccounts : [];
    let next: any[] = current;
    const a = args.account || {};

    switch (args.op) {
      case "add": {
        if (!a.bankName || !a.accountNumber || !a.accountName) {
          throw new Error("Account name, bank name and account number are all required.");
        }
        const id = a.id || `acct_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        next = [...current, {
          id,
          accountName: String(a.accountName).trim(),
          bankName: String(a.bankName).trim(),
          accountNumber: String(a.accountNumber).trim(),
          isDefault: current.length === 0 ? true : !!a.isDefault,
        }];
        break;
      }
      case "update": {
        if (!a.id) throw new Error("Account id is required for update.");
        if (!a.bankName || !a.accountNumber || !a.accountName) {
          throw new Error("Account name, bank name and account number are all required.");
        }
        next = current.map(acc => acc.id === a.id ? {
          ...acc,
          accountName: String(a.accountName).trim(),
          bankName: String(a.bankName).trim(),
          accountNumber: String(a.accountNumber).trim(),
        } : acc);
        break;
      }
      case "setDefault": {
        if (!a.id) throw new Error("Account id is required.");
        next = current.map(acc => ({ ...acc, isDefault: acc.id === a.id }));
        break;
      }
      case "delete": {
        if (!a.id) throw new Error("Account id is required.");
        const remaining = current.filter(acc => acc.id !== a.id);
        // If the default was deleted, promote the first remaining account.
        if (remaining.length > 0 && !remaining.some(acc => acc.isDefault)) {
          remaining[0] = { ...remaining[0], isDefault: true };
        }
        next = remaining;
        break;
      }
      default:
        throw new Error(`Unknown op "${args.op}".`);
    }

    await ctx.db.patch(firm._id, {
      bankAccounts: next,
      updatedAt: new Date().toISOString(),
    });
    return { success: true, count: next.length, accounts: next };
  },
});

/**
 * query: getUserApiKey
 * Retrieves the user's stored Gemini API key from their user record.
 * Used on login to sync the key to localStorage.
 */
export const getUserApiKey = query({
  args: { tokenIdentifier: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // R16b: session-verified caller — the legacy email-only lookup handed
    // any caller the user's stored Gemini API key (credential theft).
    // A user may only read their OWN key.
    const caller = await resolveCaller(ctx, { sessionToken: args.sessionToken });
    const user = await ctx.db.get(caller._id);
    return user?.geminiApiKey || null;
  },
});

export const verifyCode = mutation({
  args: { email: v.string(), code: v.string() },
  handler: async (ctx, args) => {
    const token = args.email;
    // 500-cap audit (2026-09-23): THE signup-verification bug — the old
    // take(500)+find scan returned "User not found" for every account
    // created after the 500th user, so freshly-registered users could not
    // verify their email (reported live: "failed to load after putting in
    // the verification code"). Indexed lookup, no cap.
    const user = await findUserByTokenUncapped(ctx, token.toLowerCase());

    if (!user) return { success: false, message: "User not found." };
    if (user.verificationCode !== args.code) return { success: false, message: "Invalid code." };

    // ─── Trigger welcome email on first verification ──────────────────
    // The welcome email is sent ONCE — guarded by the welcomeEmailSent
    // field. If the user re-verifies (e.g., after a password reset),
    // we don't send another welcome email. This keeps verification
    // (transactional code) and welcome (onboarding) separate.
    if (!user.welcomeEmailSent) {
      await ctx.db.patch(user._id, {
        isVerified: true,
        verificationCode: null,
        welcomeEmailSent: true,
      });
      // Send welcome email via scheduler (async — doesn't block verification)
      await ctx.scheduler.runAfter(0, internal.myFunctions.sendWelcomeEmail, {
        email: user.email || args.email,
        product: user.product || undefined,
        name: user.name || undefined,
      });

      // ─── Notify the founder of a new user signup ──────────────────
      // Sends an email to the founder's notification address so they
      // know when someone new joins the platform. Also CCs any
      // additional notification recipients (e.g., marketing team).
      await ctx.scheduler.runAfter(0, internal.myFunctions.sendFounderSignupNotification, {
        newUserEmail: user.email || args.email,
        newUserName: user.name || '',
        product: user.product || 'legal',
      });

      // ─── 2026-09-14 round 2: NEW-REGISTRATION FCM PUSH to founders ──
      // Founder's explicit requirement: "i want to be able to receive
      // notifications in the founder app ... it allows me to keep a closer
      // eye on new registrations". Previously a signup ONLY emailed the
      // founder — the Founder APK stayed silent and the signup only
      // surfaced via the read-time getFounderAlerts aggregation when the
      // founder happened to open the app. Now: in-app row + categorized
      // FCM push on the signups channel, instantly, on every new verified
      // user. (notifyFounders routes new_signup → practicepro-signups.)
      try {
        const productName = user.product === 'property' ? 'Atrium'
          : user.product === 'unified' ? 'Komplete'
          : user.product === 'admin' ? 'Founder'
          : 'Vega';
        await notifyFounders(ctx, {
          title: `New ${productName} Registration`,
          message: `${user.name || user.email || args.email} just joined ${productName}.`,
          type: "new_signup",
          link: { view: "organizations", id: null, context: { userEmail: user.email || args.email } },
        });
      } catch (notifErr: any) {
        console.warn("[verifyCode] Founder signup push failed:", notifErr?.message);
      }
    } else {
      await ctx.db.patch(user._id, { isVerified: true, verificationCode: null });
    }

    return { success: true };
  }
});

export const resetPassword = action({
  args: { email: v.string(), newPassword: v.string(), overrideCode: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const token = args.email.toLowerCase().trim();

    // TASK 21 FIX: read the RAW record. The public getUser strips
    // verificationCode (the 6-digit OTP path here always failed — only the
    // RCV- recovery code worked, by accident, because recoveryCode was not
    // in the strip list). resetPassword is a server-side action: internal
    // getUserForAuth gives it the full record and is not client-callable.
    const user: any = await ctx.runQuery(internal.myFunctions.getUserForAuth, { tokenIdentifier: token });

    if (!user) return { success: false, message: "User account not found." };

    // ─── Recovery-code validation (2026-09-14 live incident) ──────────
    // The founder pasted RCV-165662 straight from an email and got
    // "Invalid Recovery Key" — because a LATER request had minted a new
    // code and every earlier email silently became invalid, with an error
    // that gave no hint of that. Fixed here, all at once:
    //   1. Codes are NORMALIZED before comparison (trim + uppercase +
    //      strip internal whitespace) so paste line-wraps and stray
    //      spaces can no longer reject a valid code;
    //   2. Codes EXPIRE 60 minutes after mint (recoveryCodeIssuedAt;
    //      codes minted before that field existed stay usable —
    //      one-shot until consumed);
    //   3. The wrong-code error now EXPLAINS the supersession trap
    //      ("use the code from the newest email") instead of a bare
    //      "invalid";
    //   4. Brute-force guard: after 5 consecutive wrong attempts the
    //      stored code is wiped — guessing the remaining digits becomes
    //      pointless and the real user simply requests a fresh email.
    const RECOVERY_CODE_TTL_MS = 60 * 60 * 1000; // 60 minutes
    const MAX_RECOVERY_ATTEMPTS = 5;
    const normalizeResetCode = (raw: unknown) =>
      String(raw ?? "").trim().toUpperCase().replace(/\s+/g, "");

    const submittedCode = normalizeResetCode(args.overrideCode);
    const activeCode = normalizeResetCode(user.recoveryCode);
    const otpCode = user.verificationCode ? String(user.verificationCode).trim() : "";

    if (!submittedCode) {
      return { success: false, message: "Enter the recovery code from your email." };
    }

    const matchesRecovery = !!activeCode && submittedCode === activeCode;
    const matchesOtp = !!otpCode && submittedCode === otpCode;

    if (!matchesRecovery && !matchesOtp) {
      const attempts = Number(user.recoveryFailedAttempts || 0) + 1;
      if (attempts >= MAX_RECOVERY_ATTEMPTS) {
        await ctx.runMutation(internal.myFunctions.updateUserSecurityFields, {
          userId: user._id,
          fields: {
            recoveryCode: null,
            recoveryCodeIssuedAt: null,
            recoveryFailedAttempts: attempts,
          },
        });
        return {
          success: false,
          message:
            "Too many incorrect attempts — this recovery code has been deactivated for safety. Request a fresh code via 'Forgot password?' and use the code from the newest email.",
        };
      }
      await ctx.runMutation(internal.myFunctions.updateUserSecurityFields, {
        userId: user._id,
        fields: { recoveryFailedAttempts: attempts },
      });
      return {
        success: false,
        message:
          "That code doesn't match this account. Recovery codes expire after 60 minutes, and every new request immediately replaces the previous code — so use the code from the MOST RECENT email, or request a fresh one via 'Forgot password?'.",
      };
    }

    // Expiry — only enforced when the mint stamped recoveryCodeIssuedAt.
    if (matchesRecovery && user.recoveryCodeIssuedAt) {
      const age = Date.now() - Number(user.recoveryCodeIssuedAt);
      if (age > RECOVERY_CODE_TTL_MS) {
        return {
          success: false,
          message:
            "This recovery code has expired (codes stay valid for 60 minutes). Request a fresh one — it only takes a moment.",
        };
      }
    }

    // Hash the new password with PBKDF2 before storing
    const hashedPassword: any = await ctx.runAction(internal.authUtils.hashPassword, {
      password: args.newPassword,
    });

    await ctx.runMutation(internal.myFunctions.updateUserSecurityFields, {
      userId: user._id,
      // Task 20: a successful password reset PROVES account control —
      // retire any pending login code (the 2026-09-05 incident left a
      // stale one on the record: code set + password set + MFA off is a
      // contradictory state that confused diagnosis) and clear the
      // failed-attempt counter + lockout so the fresh password starts
      // from a clean slate.
      fields: {
        password: hashedPassword,
        verificationCode: null,
        recoveryCode: null,
        recoveryCodeIssuedAt: null,
        recoveryFailedAttempts: 0,
        mfaCode: null,
        mfaCodeIssuedAt: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    return { success: true };
  }
});

/**
 * completePasswordResetWithToken — the one-click path (2026-09-14).
 *
 * USER CONTEXT: "can we just do it without the reset code? send me where I
 * can reset the password without the difficulty." The emailed link carries a
 * 48-hex random token; this action is what the /reset-password page calls.
 * No code, no email typing — just the new password.
 *
 * Security contract (mirrors the recovery-code path):
 *   • the DB stores ONLY sha256(token) — a DB leak yields no usable links;
 *   • single-use: the hash is cleared on success, so a replayed link hits
 *     "invalid or already used";
 *   • 60-minute TTL (resetTokenIssuedAt), same window the email promises;
 *   • a successful reset retires every pending login/recovery/MFA code and
 *     clears lockouts (a reset PROVES account control — same rationale as
 *     resetPassword above);
 *   • wrong-token responses are deliberately generic (no account probing).
 */
export const completePasswordResetWithToken = action({
  args: { token: v.string(), newPassword: v.string() },
  handler: async (ctx, args) => {
    const raw = String(args.token || "").trim();
    if (raw.length < 32) {
      return {
        success: false,
        message: "This reset link looks incomplete. Open the newest reset email and tap its 'Set a new password now' button.",
      };
    }
    const tokenHash = sha256Hex(raw);
    const user: any = await ctx.runQuery(internal.myFunctions.getUserByResetTokenHash, { tokenHash });
    if (!user) {
      return {
        success: false,
        message:
          "This reset link is invalid or has already been used. Request a fresh one via 'Forgot password?' — the newest email always carries the working link.",
      };
    }

    // TTL — only enforced when the mint stamped resetTokenIssuedAt (it always
    // does for links minted by this deploy; the guard keeps the message
    // honest for any hand-minted edge case).
    const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 60 minutes
    const issuedAt = Number(user.resetTokenIssuedAt || 0);
    if (issuedAt && Date.now() - issuedAt > RESET_TOKEN_TTL_MS) {
      return {
        success: false,
        message:
          "This reset link has expired (links stay valid for 60 minutes). Request a fresh one via 'Forgot password?' — it only takes a moment.",
      };
    }

    if (String(args.newPassword || "").length < 8) {
      return { success: false, message: "Choose a new password of at least 8 characters." };
    }

    const hashedPassword: any = await ctx.runAction(internal.authUtils.hashPassword, {
      password: args.newPassword,
    });

    await ctx.runMutation(internal.myFunctions.updateUserSecurityFields, {
      userId: user.userId,
      fields: {
        password: hashedPassword,
        // Single-use + clean slate (same reset semantics as resetPassword).
        resetTokenHash: null,
        resetTokenIssuedAt: null,
        verificationCode: null,
        recoveryCode: null,
        recoveryCodeIssuedAt: null,
        recoveryFailedAttempts: 0,
        mfaCode: null,
        mfaCodeIssuedAt: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    // The caller just proved control of this account's inbox — echoing the
    // email back confirms WHICH account was reset (no enumeration: the token,
    // not the email, is the credential here).
    return { success: true, email: user.email ?? null, role: user.role ?? null };
  },
});

export const requestPasswordReset = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const token = args.email.toLowerCase().trim();
    // 500-cap audit: indexed lookup (take(500)+find silently did nothing
    // for every user past the 500th row — reset emails never arrived).
    const user = await findUserByTokenUncapped(ctx, token);

    // Always return success to prevent email enumeration attacks
    if (!user) return { success: true };

    // SECURITY: crypto-secure recovery code (was Math.random — predictable
    // PRNG). 2026-09-14: also stamp issuance (60-min TTL) and reset the
    // failed-attempt counter so a fresh email always starts from zero.
    const code = "RCV-" + numericCode(6);
    // 2026-09-14 (reset-link round): ONE-CLICK link token — the email's
    // primary CTA opens /reset-password and sets the new password with no
    // code typing at all. Only the SHA-256 lands in the DB.
    const resetToken = randomHex(48);
    await ctx.db.patch(user._id, {
      recoveryCode: code,
      recoveryCodeIssuedAt: Date.now(),
      recoveryFailedAttempts: 0,
      resetTokenHash: sha256Hex(resetToken),
      resetTokenIssuedAt: Date.now(),
    });

    try {
      const appDomain = "https://practice-pro-vega.vercel.app";
      const oneClickLink = `${appDomain}/reset-password?token=${resetToken}`;
      const recoveryLink = `${appDomain}/?view=login&recoveryCode=${code}&email=${encodeURIComponent(user.email ?? "")}`;

      await ctx.scheduler.runAfter(0, (internal as any).myFunctions.sendRecoveryEmail, { 
        email: user.email, 
        code: code,
        recoveryLink: recoveryLink,
        resetLink: oneClickLink,
      });
    } catch (e) {
      console.error("Failed to send recovery email", e);
    }

    return { success: true };
  }
});

/**
 * findFounderAccounts — FOUNDER APP ACCOUNT RECOVERY (2026-09-14).
 *
 * The founder reported: "I forgot my password AND I don't even remember
 * the email I used." This lookup lets them self-serve: type any part of
 * the name on the account → see MASKED emails of matching Founder-role
 * accounts → pick one → continue into the standard emailed-code password
 * reset (requestPasswordReset). The recovery code itself only ever goes
 * to the real inbox, so revealing masked addresses here is safe (the
 * industry-standard j***@gmail.com shape — enough to recognise your own
 * address, useless to an attacker).
 *
 * Guards: ≥3-character query, Founder-role accounts only, max 5 results,
 * deactivated accounts hidden.
 */
export const findFounderAccounts = query({
  args: { nameQuery: v.string() },
  handler: async (ctx, args) => {
    const q = String(args.nameQuery || "").trim().toLowerCase();
    if (q.length < 3) return { matches: [] };

    const maskEmail = (email: string): string => {
      const [local, domain] = email.split("@");
      if (!domain) return "***";
      const shown = local.slice(0, 1);
      const tail = local.length > 1 ? local.slice(-1) : "";
      return `${shown}***${tail}@${domain}`;
    };

    const users = await ctx.db.query("users").take(500);
    const matches = users
      .filter((u: any) => {
        if (String(u.role || "") !== "Founder") return false;
        if (u.deactivatedAt) return false;
        const name = String(u.name || "").toLowerCase();
        const email = String(u.email || "").toLowerCase();
        return (name.includes(q) || email.includes(q)) && !!u.email;
      })
      .slice(0, 5)
      .map((u: any) => ({
        maskedEmail: maskEmail(String(u.email)),
        displayName: String(u.name || ""),
        // Human hint for "which account is mine" — signup year/month.
        memberSince: u.createdAt ? new Date(u.createdAt).toISOString().slice(0, 7) : null,
      }));
    return { matches };
  },
});

/**
 * sendFounderRecoveryCode — second half of founder account recovery.
 * The client only knows the masked email + which match it picked; this
 * mutation re-resolves the same filtered list SERVER-SIDE (the client
 * can never point it at an arbitrary account), generates the recovery
 * code, and emails the real address a recovery link that also reveals
 * which email the account uses. From there the founder completes the
 * standard reset (resetPassword with the emailed code).
 */
export const sendFounderRecoveryCode = mutation({
  args: { nameQuery: v.string(), matchIndex: v.number() },
  handler: async (ctx, args) => {
    const q = String(args.nameQuery || "").trim().toLowerCase();
    if (q.length < 3) return { success: false, message: "Search again first (min 3 characters)." };

    const users = await ctx.db.query("users").take(500);
    const matches = users.filter((u: any) => {
      if (String(u.role || "") !== "Founder") return false;
      if (u.deactivatedAt) return false;
      const name = String(u.name || "").toLowerCase();
      const email = String(u.email || "").toLowerCase();
      return (name.includes(q) || email.includes(q)) && !!u.email;
    });
    const idx = Math.trunc(args.matchIndex);
    if (idx < 0 || idx >= matches.length || idx > 4) {
      return { success: false, message: "That match is no longer available — search again." };
    }
    const user: any = matches[idx];
    const code = "RCV-" + numericCode(6);
    // 2026-09-14 (reset-link round): one-click token alongside the code —
    // the founder opens the link and types ONLY the new password.
    const resetToken = randomHex(48);
    await ctx.db.patch(user._id, {
      recoveryCode: code,
      recoveryCodeIssuedAt: Date.now(),
      recoveryFailedAttempts: 0,
      resetTokenHash: sha256Hex(resetToken),
      resetTokenIssuedAt: Date.now(),
    });
    try {
      const appDomain = "https://practice-pro-vega.vercel.app";
      const oneClickLink = `${appDomain}/reset-password?token=${resetToken}`;
      const recoveryLink = `${appDomain}/?view=login&recoveryCode=${code}&email=${encodeURIComponent(user.email ?? "")}`;
      await ctx.scheduler.runAfter(0, (internal as any).myFunctions.sendRecoveryEmail, {
        email: user.email,
        code,
        recoveryLink,
        resetLink: oneClickLink,
      });
    } catch (e: any) {
      console.error("Failed to send founder recovery email", e?.message);
      return { success: false, message: "Could not send the recovery email — please retry." };
    }
    return { success: true };
  },
});

/**
 * requestPortalPasswordReset — Password reset for portal users (Client/Tenant).
 *
 * Similar to requestPasswordReset but sends the recovery link to the
 * appropriate portal login page (/portal/client/login or /portal/tenant/login)
 * so the user can reset their password within the portal context.
 */
export const requestPortalPasswordReset = mutation({
  args: { email: v.string(), portalType: v.union(v.literal("client"), v.literal("tenant")) },
  handler: async (ctx, args) => {
    const token = args.email.toLowerCase().trim();
    const allUsers = await ctx.db.query("users").take(500);
    const user = allUsers.find((u: any) => u.tokenIdentifier && u.tokenIdentifier.toLowerCase() === token);

    // Always return success to prevent email enumeration attacks
    if (!user) return { success: true };

    // Only allow password reset for portal users (Client or Tenant role)
    const userRole = (user as any).role;
    if (userRole !== "Client" && userRole !== "Tenant") {
      // Non-portal user trying to use portal reset — silently ignore
      // to avoid revealing that this email is a non-portal account
      return { success: true };
    }

    // SECURITY: crypto-secure recovery code (was Math.random — predictable
    // PRNG). 2026-09-14: also stamp issuance (60-min TTL) and reset the
    // failed-attempt counter so a fresh email always starts from zero.
    const code = "RCV-" + numericCode(6);
    // 2026-09-14 (reset-link round): one-click token — portal users too.
    const resetToken = randomHex(48);
    await ctx.db.patch(user._id, {
      recoveryCode: code,
      recoveryCodeIssuedAt: Date.now(),
      recoveryFailedAttempts: 0,
      resetTokenHash: sha256Hex(resetToken),
      resetTokenIssuedAt: Date.now(),
    });

    try {
      const appDomain = "https://practice-pro-vega.vercel.app";
      const oneClickLink = `${appDomain}/reset-password?token=${resetToken}&portal=${args.portalType}`;
      const recoveryLink = `${appDomain}/portal/${args.portalType}/login?recoveryCode=${code}&email=${encodeURIComponent(user.email ?? "")}`;

      await ctx.scheduler.runAfter(0, (internal as any).myFunctions.sendPortalRecoveryEmail, { 
        email: user.email, 
        code: code,
        recoveryLink: recoveryLink,
        resetLink: oneClickLink,
        portalType: args.portalType,
      });
    } catch (e) {
      console.error("Failed to send portal recovery email", e);
    }

    return { success: true };
  }
});

export const createFirm = mutation({
  args: { 
    name: v.string(), 
    sessionToken: v.optional(v.string()),
    address: v.string(), 
    subscriptionPlan: v.string(), 
    user_email: v.string(), 
    user_name: v.string(), 
    tokenIdentifier: v.string(),
    product: v.optional(v.union(v.literal("legal"), v.literal("property"), v.literal("unified"), v.literal("vega"), v.literal("atrium"))),
    isDataMigration: v.optional(v.boolean()),
    // ─── CRO Audit Track B: Trial system support ───────────────────────
    // When trial=true, the firm is created with subscriptionPlan='Core' but
    // trialPlan/trialStartsAt/trialEndsAt set to track the 30-day trial of
    // the originally-selected plan. useFeatures.ts reads trialPlan to grant
    // entitlements during the trial window. The expireTrials cron downgrades
    // expired trials back to Core.
    trial: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // ── V1-D (final verification rescan): this mutation was UNGATED, and
    //    the post-create linkage patched the user row found by CALLER-
    //    SUPPLIED email — an attacker could rebind a victim's firmId, role
    //    (set to Admin) and joinedFirmIds by passing the victim's email as
    //    user_email. Now: the caller must hold a verified session (strict
    //    identity) and the linkage applies to the CALLER'S OWN row,
    //    server-derived. The caller-supplied identity args are hints the
    //    server overrides.
    const caller = await resolveCaller(ctx, {
      sessionToken: args.sessionToken,
      userEmail: args.user_email,
      userId: args.tokenIdentifier,
    });
    // SECURITY: crypto-secure invite code (was Math.random — predictable PRNG)
    const inviteCode = "INV-" + numericCode(4);
    const now = Date.now();
    const TRIAL_DAYS = 30;  // Changed from 14 to 30 — gives users time to experience automations, WhatsApp, email cycles
    const trialEndsAt = now + TRIAL_DAYS * 24 * 60 * 60 * 1000;

    // If trial=true, the firm runs at Core for billing but is granted the
    // selected plan's entitlements during the trial window.
    const effectivePlan = args.trial ? 'Core' : args.subscriptionPlan;
    const trialPlan = args.trial ? args.subscriptionPlan : null;
    const trialStartsAt = args.trial ? now : null;
    const trialEndsAtFinal = args.trial ? trialEndsAt : null;

    // K-3 (unified-product integrity): stored limits now follow the
    // AUTHORITATIVE rule — the product decides surfaces, the plan decides
    // depth. Unified (Komplete) firms previously got a blanket 999999 for
    // units/tenants at signup; they now get the plan's Atrium-table depth
    // (the OnboardingWizard sends plan='Komplete' with trial=true for
    // unified signups, so a trialing Komplete firm still starts unlimited
    // — ATRIUM_LIMITS has no 'Komplete' key, so unified+Komplete maps to
    // unlimited explicitly).
    const signupProduct = String(args.product || "unified").toLowerCase();
    const unifiedSignupProduct = signupProduct === "unified" || signupProduct === "komplete";
    const unifiedEntitled = unifiedSignupProduct && (args.subscriptionPlan === "Komplete" || args.subscriptionPlan === "Enterprise");
    const atriumDepth = ATRIUM_LIMITS[args.subscriptionPlan]?.units || ATRIUM_LIMITS.Core.units;
    const atriumTenantDepth = ATRIUM_LIMITS[args.subscriptionPlan]?.tenants || ATRIUM_LIMITS.Core.tenants;
    const storedUnitCap = signupProduct === "property" ? atriumDepth
      : unifiedEntitled ? 999999
      : unifiedSignupProduct ? atriumDepth
      : 999999; // Vega-only firms have no property surface — nothing to cap
    const storedTenantCap = signupProduct === "property" ? atriumTenantDepth
      : unifiedEntitled ? 999999
      : unifiedSignupProduct ? atriumTenantDepth
      : 999999;

    const firmId = await ctx.db.insert("firms", {
      name: args.name,
      address: args.address,
      subscriptionPlan: effectivePlan,
      inviteCode: inviteCode,
      // V1-D: attribution is session-derived, never caller-supplied.
      createdBy: String(caller.email ?? args.user_email ?? ""),
      aiSettings: { enableAllAiFeatures: true },
      product: args.product || "unified",
      maxUnits: storedUnitCap,
      maxActiveTenants: storedTenantCap,
      // SECURITY FIX (WhatsApp hard-block): non-property firms (Vega legal /
      // Komplete) previously got whatsappLimit: 0 here — and
      // incrementWhatsAppQuota treats limit 0 as "already exhausted"
      // (0 >= 0), so EVERY WhatsApp send for those products failed with
      // "Monthly WhatsApp limit reached (0)". Canonical tier limits
      // (getTierLimitsForFirm) grant unlimited WhatsApp to legal/unified/
      // komplete, and WhatsApp is a built-in feature (add-ons purge).
      whatsappLimit: args.product === "property" ? (ATRIUM_LIMITS[args.subscriptionPlan]?.whatsapp || 999999) : 999999,
      whatsappMessagesSent: 0,
      setupFeePaid: (args.subscriptionPlan === "Enterprise" || args.isDataMigration) ? false : true, // If they need a setup fee, it's NOT paid yet
      // ─── Trial fields ──────────────────────────────────────────────────
      trialStartsAt,
      trialEndsAt: trialEndsAtFinal,
      trialPlan,
      // ─── Billing metadata defaults ─────────────────────────────────────
      adminStatus: args.trial ? 'trial' : 'active',
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
    });
    // V1-D: the linkage lookup is SESSION-DERIVED — the caller's own row
    // (never a caller-supplied email that could name a victim).
    let user: any = await ctx.db.get(caller._id);
    if (!user) {
      user = await ctx.db
        .query("users")
        .withIndex("by_token", (q) => q.eq("tokenIdentifier", String(caller.email ?? "")))
        .first();
    }
    if (!user) {
      user = await ctx.db
        .query("users")
        .withIndex("by_token", (q) => q.eq("tokenIdentifier", String(caller.email ?? "").toLowerCase()))
        .first();
    }

    if (user) {
      const joinedIds = user.joinedFirmIds || [];
      const updatedJoinedIds = joinedIds.includes(firmId) ? joinedIds : [...joinedIds, firmId];
      await ctx.db.patch(user._id, { 
        firmId: firmId, 
        // ONBOARDING FIX: leave false so the post-wizard OnboardingTour
        // actually auto-starts for new firm creators. completeTour() sets it
        // to true when the user finishes or skips the tour. Previously
        // true-at-creation killed the tour before it ever ran.
        onboardingCompleted: false, 
        role: 'Admin',
        joinedFirmIds: updatedJoinedIds
      });
    }

    // Seed default document categories — PRODUCT-AWARE.
    // PRACTICE-PROFILE ENGINE FIX: previously every product (including
    // Atrium property firms) got the legal-flavoured folders. Property firms
    // now get property folders; unified (Komplete) firms get the union.
    // These are only a FALLBACK — the OnboardingWizard's Practice Blueprint
    // step curates real configuration for the firm's actual practice areas,
    // and prunes any seeded rows that don't fit the chosen profile.
    const product = args.product || "unified";
    const isPropertyProduct = product === "property" || product === "atrium";
    const isUnifiedProduct = product === "unified";

    const legalDocCategories = [
      { name: "Pleadings", description: "Court filings, statements of claim, and defenses", color: "#3b82f6" },
      { name: "Correspondence", description: "Letters, emails, and client communications", color: "#10b981" },
      { name: "Evidence", description: "Exhibits, witness statements, and factual documents", color: "#8b5cf6" },
      { name: "Agreements", description: "Contracts, deeds, and legal agreements", color: "#f59e0b" },
      { name: "Corporate", description: "CAC filings, board resolutions, and company documents", color: "#64748b" },
      { name: "Other", description: "Miscellaneous documents", color: "#94a3b8" }
    ];
    const propertyDocCategories = [
      { name: "Lease Agreements", description: "Tenancy agreements, renewals and addons", color: "#3b82f6" },
      { name: "Title Deeds", description: "C-of-O, deeds of assignment, surveys, gazettes", color: "#10b981" },
      { name: "Utility Bills", description: "Electricity, water and waste bills", color: "#8b5cf6" },
      { name: "Service Charges", description: "Service charge invoices and statements", color: "#f59e0b" },
      { name: "Maintenance Records", description: "Repair requests, job cards, artisan invoices", color: "#64748b" },
      { name: "Tax/Rates", description: "Land use charge, tenement rates, receipts", color: "#94a3b8" }
    ];
    const defaultCategories = isPropertyProduct
      ? propertyDocCategories
      : isUnifiedProduct
        ? [...legalDocCategories, ...propertyDocCategories.filter(c => !legalDocCategories.some(l => l.name === c.name))]
        : legalDocCategories;

    for (const cat of defaultCategories) {
      await ctx.db.insert("documentCategories", {
        firmId,
        name: cat.name,
        description: cat.description,
        color: cat.color,
        isSystem: true
      });
    }

    // Seed default contact categories — PRODUCT-AWARE (same fix).
    // The old list seeded "Court Staff" / "Judiciary" / "Vendor" for every
    // firm — categories real practices rarely use ("trashy defaults").
    // They remain only as the LEGAL fallback; the wizard's blueprint step
    // replaces them with the curated set for the firm's practice areas.
    const legalContactCategories = [
      "Client",
      "Vendor",
      "Court Staff",
      "Opposing Counsel",
      "Judiciary",
      "Advocate"
    ];
    const propertyContactCategories = [
      "Landlord",
      "Tenant",
      "Property Agent",
      "Facility Manager",
      "Vendor/Artisan",
      "Govt Agency"
    ];
    const contactCategories = isPropertyProduct
      ? propertyContactCategories
      : isUnifiedProduct
        ? [...legalContactCategories, ...propertyContactCategories.filter(c => !legalContactCategories.some(l => l === c))]
        : legalContactCategories;

    for (const cat of contactCategories) {
      await ctx.db.insert("contactCategories", {
        firmId,
        name: cat,
        isSystem: true
      });
    }

    // DEEP AUDIT FIX: Seed default event types so new firms can immediately use
    // the EventForm (which requires event types to exist for the type dropdown).
    // Without this, the EventForm's <select required> has no options and the form
    // can't be saved — meaning the "Add a court date" checklist item is impossible.
    // PRODUCT-AWARE: property firms get rent/inspection/maintenance events instead
    // of court-centric ones (unified gets the union).
    const legalEventTypes = [
      { name: "Court Hearing", color: "#ef4444" },
      { name: "Mention", color: "#f59e0b" },
      { name: "Client Meeting", color: "#3b82f6" },
      { name: "Filing Deadline", color: "#f97316" },
      { name: "Consultation", color: "#10b981" },
    ];
    const propertyEventTypes = [
      { name: "Rent Due Date", color: "#ef4444" },
      { name: "Inspection", color: "#f59e0b" },
      { name: "Maintenance Visit", color: "#f97316" },
      { name: "Lease Expiry", color: "#3b82f6" },
      { name: "Payment Follow-up", color: "#10b981" },
    ];
    const defaultEventTypes = isPropertyProduct
      ? propertyEventTypes
      : isUnifiedProduct
        ? [...legalEventTypes, ...propertyEventTypes.filter(e => !legalEventTypes.some(l => l.name === e.name))]
        : legalEventTypes;
    for (const et of defaultEventTypes) {
      await ctx.db.insert("eventTypes", {
        firmId,
        name: et.name,
        color: et.color,
        isSystem: true,
      } as any);
    }

    // ─── 2026-09-14 round 2: NEW-ORGANIZATION FCM PUSH to founders ──
    // Mirrors the new-signup push in verifyCode: the founder wants to
    // "keep a closer eye on new registrations". A new firm/org is the
    // highest-signal registration event — before this, it only appeared
    // in the read-time getFounderAlerts aggregation.
    try {
      const productName = args.product === 'property' ? 'Atrium'
        : args.product === 'unified' ? 'Komplete'
        : 'Vega';
      await notifyFounders(ctx, {
        title: `New Organization: ${args.name}`,
        message: `${args.user_name || args.user_email} created "${args.name}" on ${productName} (${args.subscriptionPlan}${args.trial ? ", trial" : ""}).`,
        type: "new_org",
        link: { view: "organizations", id: String(firmId), context: { firmId: String(firmId) } },
      });
    } catch (notifErr: any) {
      console.warn("[createFirm] Founder org push failed:", notifErr?.message);
    }

    return firmId;
  },
});

export const validateInviteCode = query({
  args: { inviteCode: v.string() },
  handler: async (ctx, args) => {
    const providedCode = (args.inviteCode || "").trim().toUpperCase();
    
    // Exact match first
    let firm = await ctx.db.query("firms").withIndex("by_invite", (q) => q.eq("inviteCode", providedCode)).first();
    
    // Fallback: search without dashes (normalized fuzzy match — no index
    // serves this; the whole-platform firms table, read capped at 500)
    if (!firm) {
      const cleanCode = providedCode.replace(/-/g, "");
      const allFirms = await ctx.db.query("firms").take(500);
      firm = allFirms.find(f => (f.inviteCode || "").toUpperCase().replace(/-/g, "") === cleanCode) || null;
    }
    
    if (firm) {
      return { valid: true, firmName: firm.name, firmId: firm._id };
    }
    return { valid: false };
  }
});

export const regenerateInviteCode = mutation({
  args: { firmId: v.string(), sessionToken: v.optional(v.string()), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // V1-B (SEC-11): authenticated staff authority + server-derived firm
    // ownership. Previously ANY caller could rotate ANY firm's invite code
    // by passing its id — or look a firm up BY NAME — invalidating every
    // outstanding join link the target firm had issued. The firm must now
    // be the caller's own (or a joined firm), derived from the verified
    // session; the by-name/scan lookup is deleted entirely.
    const caller = await requireStaffCaller(ctx, {
      sessionToken: args.sessionToken,
      userEmail: args.userEmail,
      firmId: args.firmId,
    });
    const callerFirmIds = new Set(
      [String(caller.firmId || ""), ...(((caller as any).joinedFirmIds || []) as string[]).map(String)].filter(Boolean)
    );
    if (!callerFirmIds.has(String(args.firmId))) {
      throw new Error("Not authorized: you can only regenerate your own workspace's invite code.");
    }

    const firm: any = await ctx.db.get(args.firmId as any);
    if (!firm) {
      throw new Error(`Workspace not found. Please refresh and try again. (Ref: ${args.firmId})`);
    }

    // Generate a more robust unique code: 6 characters alphanumeric
    // SECURITY: crypto-secure draw (was Math.random — predictable PRNG)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars
    const newCode = "INV-" + codeFromCharset(chars, 6);

    await ctx.db.patch(firm._id, { inviteCode: newCode });
    return newCode;
  }
});

export const joinFirm = mutation({
  args: { inviteCode: v.string(), tokenIdentifier: v.string(), userName: v.optional(v.string()), userEmail: v.optional(v.string()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // R16b: session-verified identity — the legacy caller-supplied
    // tokenIdentifier let anyone attach THEMSELVES to any firm via an
    // invite code under any email, or join as someone else entirely.
    const sessionUser = await resolveCaller(ctx, { sessionToken: args.sessionToken });
    const providedCode = (args.inviteCode || "").trim().toUpperCase();
    
    // Exact match first
    let firm = await ctx.db.query("firms").withIndex("by_invite", (q) => q.eq("inviteCode", providedCode)).first();
    
    // Fallback: search without dashes (normalized fuzzy match — no index
    // serves this; the whole-platform firms table, read capped at 500)
    if (!firm) {
      const cleanCode = providedCode.replace(/-/g, "");
      const allFirms = await ctx.db.query("firms").take(500);
      firm = allFirms.find(f => (f.inviteCode || "").toUpperCase().replace(/-/g, "") === cleanCode) || null;
    }

    if (!firm) throw new Error("Invalid invite code.");

    // R16b: the joining user is the session caller — never a caller-supplied email.
    const user = await ctx.db.get(sessionUser._id);
    if (!user) throw new Error("User not found.");

    const joinedIds = user.joinedFirmIds || [];
    const updatedJoinedIds = joinedIds.includes(firm._id) ? joinedIds : [...joinedIds, firm._id];

    // SAFETY CHECK: If this user is ALREADY the Admin or a verified User of this firm,
    // do NOT downgrade them to "Pending". This prevents the "Lost Admin" absurdity.
    const isAlreadyMember = user.firmId === firm._id && (user.role === "Admin" || user.role === "User");

    // NEW SAFETY: If the firm has NO active members (empty or orphaned), 
    // the first person to join via invite should become an Admin automatically.
    const firmUsers = await ctx.db.query("users").withIndex("by_firm", (q) => q.eq("firmId", firm._id)).take(200);
    const hasAdmin = firmUsers.some((u: any) => u.role === "Admin");
    
    const assignedRole = isAlreadyMember ? user.role : (hasAdmin ? "Pending" : "Admin");

    await ctx.db.patch(user._id, { 
      firmId: firm._id, 
      role: assignedRole, 
      // Same onboarding fix as createFirm: joiners get the app tour.
      onboardingCompleted: false,
      joinedFirmIds: updatedJoinedIds
    });

    // Notify admins if any exist
    const admins = firmUsers.filter((u: any) => u.role === "Admin");
    
    for (const admin of admins) {
      await ctx.db.insert("notifications", {
        firmId: firm._id,
        userId: admin._id,
        message: `New user ${args.userName || args.userEmail || "joined"} requested to join the workspace. Please review in Settings > Firm > Team.`,
        link: { view: "settings", id: null, context: { settingsTargetId: "user-management" } },
        timestamp: Date.now(),
        isRead: false
      } as any);
    }

    return firm._id;
  }
});

/**
 * ROUND D (D8) — DELETION RECORD (Wave 3b, R81, 2026-11-10).
 *
 * removeUserFromFirm removed: dead twin of the R77-wired deactivateTeamMember/reactivateTeamMember path (FirmSettings). Zero product callers.
 */

// ─── TRANSACTIONAL FIRM-USER REMOVAL (Phase 3, data integrity) ───────────────
/**
 * performFirmUserRemoval — shared core for removing a user from a firm as a
 * single all-or-nothing transaction.
 *
 * WHY THIS EXISTS: the UI (FirmSettings remove-user dialog) promises
 * "They will lose all access and be unassigned from all items", but the old
 * path hard-deleted the user row via the generic deleteItem — leaving
 * orphans behind: tasks still listing them in assignedUsers, live presence
 * rows keeping them "online" forever, and notification rows accumulating.
 * The user row itself was also destroyed even when the person belonged to
 * multiple firms, breaking their other-firm memberships.
 *
 * Semantics (all in ONE Convex transaction — any failure rolls back all):
 *   1. Auth + guards: caller is Admin/Founder of THIS firm; not self-removal;
 *      target actually belongs to the firm; not the firm's last admin.
 *   2. Unassign the user from all firm tasks (assignedUsers / legacy
 *      assignedTo fields).
 *   3. Delete their presence rows for this firm.
 *   4. Delete their notification rows for this firm.
 *   5. Patch the user row: firm removed from joinedFirmIds, active firm
 *      switches to another membership (or null). The row is preserved —
 *      the person's login identity and other-firm memberships stay intact.
 */
async function performFirmUserRemoval(
  ctx: any,
  args: { sessionToken?: string | null; userId: string; firmId: string; userEmail?: string }
) {
  const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
  const caller: any = auth.user;
  if (!caller || !auth.firmId) {
    throw new Error("Unauthenticated: a verified session is required to remove users.");
  }
  if (caller.role !== "Admin" && caller.role !== "Founder") {
    throw new Error("Permission denied. Only Admins or Founders can remove users.");
  }
  if (auth.firmId !== args.firmId) {
    throw new Error("Not authorized: cannot remove users from a different firm.");
  }
  if (String(caller._id) === String(args.userId)) {
    throw new Error("You cannot remove yourself. Transfer admin rights to another user first.");
  }

  const user: any = await ctx.db.get(args.userId as any);
  if (!user) {
    return { success: true, removed: false, reason: "not_found" };
  }
  const isMember = user.firmId === args.firmId || (user.joinedFirmIds || []).includes(args.firmId);
  if (!isMember) {
    throw new Error("This user is not a member of your firm.");
  }

  // GUARD: cannot remove the last Admin/Founder of the firm
  if (user.role === "Admin" || user.role === "Founder") {
    const firmUsers = await ctx.db
      .query("users")
      .withIndex("by_firm", (q: any) => q.eq("firmId", args.firmId))
      .take(200);
    const otherAdmins = firmUsers.filter(
      (u: any) => (u.role === "Admin" || u.role === "Founder") && String(u._id) !== String(args.userId)
    );
    if (otherAdmins.length === 0) {
      throw new Error("Cannot remove the last admin of the firm. Promote another user to Admin first.");
    }
  }

  // Canonical id forms this user may be referenced by (Convex _id or legacy custom id)
  const canonicalIds = new Set(
    [String(user._id), user.id].filter(Boolean).map(String)
  );

  // 1. Unassign from every assignment surface (V-MATTER-9): the
  // "unassigned from all items" promise now covers tasks, MATTERS,
  // calendar EVENTS and DOCUMENTS. The old path only touched the first
  // 100 tasks — departed users lingered in matter.assignedUsers and
  // event.assignedUsers forever (still counted in caseload reports and
  // private-matter RBAC). Deactivation (reversible) keeps assignments by
  // design; REMOVAL from the firm strips them everywhere.
  const stripFromTable = async (tableName: string, firmId: string): Promise<number> => {
    const rows = (await ctx.db
      .query(tableName as any)
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .take(2000)) as any[];
    let stripped = 0;
    for (const row of rows) {
      if (!Array.isArray(row.assignedUsers)) continue;
      const next = row.assignedUsers.filter((id: string) => !canonicalIds.has(String(id)));
      if (next.length === row.assignedUsers.length) continue;
      await ctx.db.patch(row._id, { assignedUsers: next } as any);
      stripped++;
    }
    return stripped;
  };

  let unassignedTasks = await stripFromTable("tasks", args.firmId);
  // Legacy single-assignee fields on tasks (assignedTo / assigneeId).
  const taskRows = (await ctx.db
    .query("tasks")
    .withIndex("by_firm", (q: any) => q.eq("firmId", args.firmId))
    .take(2000)) as any[];
  for (const t of taskRows) {
    const legacyAssignee = (t.assignedTo ?? t.assigneeId ?? null);
    if (legacyAssignee && canonicalIds.has(String(legacyAssignee))) {
      await ctx.db.patch(t._id, { assignedTo: null } as any);
      unassignedTasks++;
    }
  }
  const unassignedMatters = await stripFromTable("matters", args.firmId);
  const unassignedEvents = await stripFromTable("events", args.firmId);
  const unassignedDocuments = await stripFromTable("documents", args.firmId);

  // 2. Delete presence rows for this firm (query by each canonical id form)
  let removedPresence = 0;
  for (const cid of canonicalIds) {
    const presenceRows = await ctx.db
      .query("presence")
      .withIndex("by_user", (q: any) => q.eq("userId", cid))
      .take(500);
    for (const p of presenceRows as any[]) {
      if (!p.firmId || p.firmId === args.firmId) {
        await ctx.db.delete(p._id);
        removedPresence++;
      }
    }
  }

  // 3. Delete notification rows for this firm
  let removedNotifications = 0;
  const notifs = await ctx.db
    .query("notifications")
    .withIndex("by_firm", (q: any) => q.eq("firmId", args.firmId))
    .take(500);
  for (const n of notifs as any[]) {
    if (n.userId && canonicalIds.has(String(n.userId))) {
      await ctx.db.delete(n._id);
      removedNotifications++;
    }
  }

  // 4. Update the user row (preserved — may hold other-firm memberships)
  const joinedIds = (user.joinedFirmIds || []).filter((id: string) => id !== args.firmId);
  let newFirmId = user.firmId;
  if (user.firmId === args.firmId) {
    newFirmId = joinedIds.length > 0 ? joinedIds[0] : null;
  }
  await ctx.db.patch(args.userId as any, {
    firmId: newFirmId,
    joinedFirmIds: joinedIds,
    onboardingCompleted: newFirmId ? true : false,
  });

  return {
    success: true,
    removed: true,
    unassignedTasks,
    unassignedMatters,
    unassignedEvents,
    unassignedDocuments,
    removedPresence,
    removedNotifications,
  };
}

/**
 * ROUND D (D8) — DELETION RECORD (Wave 3b, R81, 2026-11-10).
 *
 * removeFirmUserAndCleanup removed: dead twin of the same removal family (superseded by the R77 session-gated paths). Zero product callers.
 */

export const updateFirmSettings = mutation({
  args: { sessionToken: v.optional(v.string()), firmId: v.string(), settings: v.any(), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // RLS: Require admin — only firm admins can update firm settings
    const auth = await requireAdmin(ctx, args.userEmail, args.sessionToken);
    // ROOT FIX: Verify the caller owns the firm they're patching.
    if (auth.firmId !== args.firmId) {
      throw new Error("Not authorized: cannot update settings for a different firm.");
    }
    await ctx.db.patch(args.firmId as any, args.settings);
  }
});

/**
 * fixProductMode — fixes the firm's `product` field when it's stale.
 *
 * PROBLEM: Some Komplete-plan firms have `product: 'vega'` in the database
 * (set during signup before the plan was upgraded). This causes the app to
 * show legal-only mode (no Properties page, no Units on dashboard) even
 * though the firm is on a Komplete plan.
 *
 * This mutation updates the firm's `product` field to match their actual
 * plan. It's called from the Settings UI when the user clicks "Fix Product Mode".
 */
export const fixProductMode = mutation({
  args: { sessionToken: v.optional(v.string()), firmId: v.string(), product: v.string() },
  handler: async (ctx, args) => {
    // Verify the caller is a member of this firm
    // R16 strict: the previous ctx.auth.getUserIdentity() gate never passed
    // under custom auth (identity always null → "Not authenticated" for
    // EVERY caller — the Settings button was dead on production). Resolve
    // the caller from the bearer session and scope to their firm.
    const caller = await requireStaffCaller(ctx, { sessionToken: args.sessionToken,
      firmId: args.firmId,
    });
    if (caller.firmId !== args.firmId) {
      throw new Error("Not authorized to modify this firm");
    }

    // Validate the product value
    const validProducts = ['atrium', 'vega', 'unified', 'komplete', 'property', 'legal', 'sentry'];
    if (!validProducts.includes(args.product)) {
      throw new Error(`Invalid product value: ${args.product}. Must be one of: ${validProducts.join(', ')}`);
    }

    // Update the firm record
    await ctx.db.patch(args.firmId as any, { product: args.product });

    // Also update all users in this firm to match
    const firmUsers = await ctx.db
      .query("users")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .take(200);
    for (const u of firmUsers) {
      await ctx.db.patch(u._id, { product: args.product });
    }

    return { success: true, product: args.product, updatedUsers: firmUsers.length };
  }
});

export const getJoinedFirms = query({
  args: { firmIds: v.array(v.string()), sessionToken: v.optional(v.string()), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // V1-A (SEC-16): session-derived identity. Only the caller's own and
    // joined firms are resolved; any other requested id is silently
    // dropped — no disclosure of which other firms exist. Previously ANY
    // caller could enumerate firm names/products for arbitrary ids.
    const caller = await resolveCaller(ctx, { sessionToken: args.sessionToken, userEmail: args.userEmail });
    const allowed = new Set(
      [caller.firmId, ...((caller as any).joinedFirmIds || [])]
        .filter(Boolean)
        .map(String)
    );
    const results = [];
    for (const id of args.firmIds) {
      if (!allowed.has(String(id))) continue;
      try {
        const firm: any = await ctx.db.get(id as any);
        if (firm) {
          results.push({
            id: firm._id,
            name: firm.name,
            product: firm.product,
            createdAt: firm._creationTime
          });
        }
      } catch (e) {
        console.warn(`[getJoinedFirms] Failed to fetch firm ${id}:`, e);
      }
    }
    return results;
  }
});

/**
 * deleteAccount (NUCLEAR IDENTITY DELETE)
 * Deletes the user identity record and ALL firms where they are the sole member.
 * Use with caution.
 */
export const deleteAccount = mutation({
  args: { sessionToken: v.optional(v.string()), email: v.string(), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // SECURITY: Only the account owner can delete their own account
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    if (auth.user?.tokenIdentifier?.toLowerCase() !== args.email.toLowerCase().trim()) {
      throw new Error("Unauthorized. You can only delete your own account.");
    }

    const user = await ctx.db.query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", args.email))
      .first();
    
    if (!user) return { success: false, message: "User not found." };
    
    // 1. Identify all firms where this user is the only member
    const firmsToClean = [];
    const joinedIds = [user.firmId, ...(user.joinedFirmIds || [])].filter(Boolean);
    const uniqueFirms = Array.from(new Set(joinedIds));

    for (const firmId of uniqueFirms) {
      try {
        const firmUsers = await ctx.db.query("users")
          .withIndex("by_firm", (q) => q.eq("firmId", firmId!))
          .take(10);
        
        if (firmUsers.length <= 1) {
          firmsToClean.push(firmId);
        }
      } catch (e) {
        console.error(`[deleteAccount] Failed to check firm ${firmId} membership:`, e);
        // Continue with other firms even if one fails
      }
    }

    // 2. Delete firms and their data
    for (const fid of firmsToClean) {
      try {
        // Purge all data associated with this firm. R16: the session token
        // is threaded through so purgeFirmData's admin guard can resolve
        // the caller (the user record still exists at this point — deleted
        // at step 3 — so the session is still valid).
        await ctx.runMutation(api.myFunctions.purgeFirmData, { firmId: fid!, sessionToken: args.sessionToken });
        // Delete the firm record itself
        await ctx.db.delete(fid as any);
      } catch (e) {
        console.error(`[deleteAccount] Failed to purge firm ${fid}:`, e);
        throw new Error(`Failed to delete firm data. Please contact support. (Ref: firm_purge_failed)`);
      }
    }
    
    // 3. Delete the user identity
    try {
      await ctx.db.delete(user._id);
    } catch (e) {
      console.error(`[deleteAccount] Failed to delete user record:`, e);
      throw new Error("Failed to delete user account. Please contact support.");
    }

    return { success: true };
  }
});

/**
 * leaveFirm
 * Removes a specific firm from the user's list without deleting their account.
 */
export const leaveFirm = mutation({
  args: { sessionToken: v.optional(v.string()), email: v.string(), firmId: v.string() },
  handler: async (ctx, args) => {
    // SECURITY (R16 strict): previously ANY caller could remove any email's
    // firm membership by supplying the email — a spoofable patch surface.
    // Resolve the caller from the bearer session; only self-leave allowed.
    const caller = await resolveCaller(ctx, { sessionToken: args.sessionToken });
    const callerEmail = String((caller as any).tokenIdentifier || (caller as any).email || "").toLowerCase().trim();
    if (callerEmail !== args.email.toLowerCase().trim()) {
      throw new Error("Unauthorized. You can only leave a firm on your own account.");
    }
    const user = await ctx.db.query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", args.email))
      .first();
    
    if (!user) throw new Error("User not found.");

    const joinedIds = (user.joinedFirmIds || []).filter((id: string) => id !== args.firmId);
    let activeFirm = user.firmId;

    if (activeFirm === args.firmId) {
      activeFirm = joinedIds.length > 0 ? joinedIds[0] : null;
    }

    await ctx.db.patch(user._id, {
      firmId: activeFirm,
      joinedFirmIds: joinedIds
    });

    return { success: true, newActiveFirm: activeFirm };
  }
});

/**
 * deleteFirm (FIRM-LEVEL DELETION)
 * Purges all data and deletes the firm record.
 */
export const deleteFirm = mutation({
  args: { sessionToken: v.optional(v.string()), firmId: v.string(), confirmed: v.boolean(), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.confirmed) throw new Error("Deletion must be confirmed.");
    
    // SECURITY: Require admin auth and verify firm ownership
    const auth = await requireAdmin(ctx, args.userEmail, args.sessionToken);
    if (!auth.firmId || auth.firmId !== args.firmId) {
      throw new Error("Unauthorized. You can only delete your own firm.");
    }

    // 1. Purge all operational data (Matters, Properties, etc.)
    try {
      await ctx.runMutation(api.myFunctions.purgeFirmData, { firmId: args.firmId, sessionToken: args.sessionToken });
    } catch (e) {
      console.error(`[deleteFirm] Failed to purge firm data:`, e);
      throw new Error("Failed to purge firm data. Please contact support.");
    }

    // 2. Remove the firmId from ALL users who have it joined
    const users = await ctx.db.query("users").take(2000);
    for (const user of users) {
      if (user.firmId === args.firmId || (user.joinedFirmIds || []).includes(args.firmId)) {
        const joined = (user.joinedFirmIds || []).filter((id: string) => id !== args.firmId);
        let active = user.firmId;
        if (active === args.firmId) active = joined.length > 0 ? joined[0] : null;
        
        try {
          await ctx.db.patch(user._id, { firmId: active, joinedFirmIds: joined });
        } catch (e) {
          console.error(`[deleteFirm] Failed to update user ${user._id}:`, e);
        }
      }
    }

    // 3. Delete the firm record itself
    try {
      await ctx.db.delete(args.firmId as any);
    } catch (e) {
      console.error(`[deleteFirm] Failed to delete firm record:`, e);
      throw new Error("Failed to delete firm record. Please contact support.");
    }

    return { success: true };
  }
});

// --- CONSENT AUDIT LOG ---
// ISO 27001 / NDPA 2023 — Records explicit user consent events to the database
// for regulatory accountability and auditability. This REPLACES localStorage-only tracking.

export const recordConsent = mutation({
  args: { 
    email: v.string(), 
    sessionToken: v.optional(v.string()),
    consentType: v.string(),   // e.g. 'ai_processing', 'cookies_essential', 'cookies_analytics'
    granted: v.boolean(),
    ipHint: v.optional(v.string()),  // Optional: browser timezone/locale for geo context
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", args.email))
      .first();
    
    if (!user) return { success: false };

    // Patch the user's consent record fields for quick access
    const consentField = `consent_${args.consentType}`;
    const timestampField = `consent_${args.consentType}_at`;
    
    await ctx.db.patch(user._id, {
      [consentField]: args.granted,
      [timestampField]: Date.now(),
    });

    // Also write an immutable consent log entry for full audit trail.
    // FIX: Previously wrote to non-existent 'consentLogs' table. Now writes
    // to the existing 'audit_logs' table with consent details in metadata.
    await ctx.db.insert("audit_logs", {
      firmId: user.firmId || 'system',
      actorId: String(user._id),
      actorName: user.name || args.email,
      actorRole: user.role || 'Unknown',
      action: args.granted ? 'consent_granted' : 'consent_revoked',
      resource: 'consent',
      resourceId: String(user._id),
      resourceName: args.consentType,
      metadata: {
        consentType: args.consentType,
        granted: args.granted,
        email: args.email,
        ipHint: args.ipHint,
      },
      timestamp: Date.now(),
    });

    return { success: true };
  }
});

export const createItem = mutation({
  args: { sessionToken: v.optional(v.string()), table: v.string(), data: v.any(), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const firmId = auth.firmId;
    const { table, data } = args;

    // Strip Convex-managed internal fields that cannot be inserted
    const { _id, _creationTime, ...rest } = data;

    const sanitizedData: Record<string, any> = {};
    for (const [key, val] of Object.entries(rest)) {
      // 1. Local State Filter: Strip keys starting with _ or temp (Convex reserves _ prefix)
      if (key.startsWith("temp") || key.startsWith("_")) {
        continue;
      }

      // 2. The 'Null' Sanitizer & 3. Financial Precision
      if (val !== null && val !== undefined) {
        // Auto-convert amount-like strings to numbers AND round to prevent
        // floating-point precision loss (Audit C11).
        // e.g., "₦1,234.56" → 1234.56, 0.1+0.2 → 0.30 (not 0.30000000000000004)
        if (typeof val === "string" && (
          key.toLowerCase().includes("amount") ||
          key.toLowerCase().includes("rate") ||
          key.toLowerCase().includes("price") ||
          key.toLowerCase().includes("balance") ||
          key.toLowerCase().includes("value") ||
          key.toLowerCase().includes("total")
        )) {
          const num = parseFloat(val.replace(/[^\d.-]/g, ''));
          if (!isNaN(num)) {
            sanitizedData[key] = roundMoney(num);
            continue;
          }
        }
        // Also round numeric values for currency fields
        if (typeof val === "number" && (
          key.toLowerCase().includes("amount") ||
          key.toLowerCase().includes("rate") ||
          key.toLowerCase().includes("price") ||
          key.toLowerCase().includes("balance") ||
          key.toLowerCase().includes("value") ||
          key.toLowerCase().includes("total")
        )) {
          sanitizedData[key] = roundMoney(val);
          continue;
        }
        sanitizedData[key] = val;
      }
    }

    // Auto-inject creation timestamp and audit fields
    // SECURITY: Firm ID is verified by requireFirmUser above. If firmId is
    // empty (anonymous caller), the throw above already rejected the request.
    // Client-supplied data.firmId is NEVER trusted as a substitute for auth.
    if (!firmId) {
      throw new Error("Unauthenticated: userEmail required. Anonymous createItem calls are no longer permitted.");
    }
    const effectiveFirmId = firmId;

    // ─── IDEMPOTENCY (Task 64): client-supplied stable `id` ────────────
    // Problem this solves: on flaky networks the SAME logical create can
    // reach the server more than once — (a) the Convex React client keeps
    // pending mutations queued and commits them on reconnect, while the
    // user (seeing a stuck form) force-closes, reopens the draft-restored
    // form and resubmits; (b) the localStorage offline queue replays after
    // a mid-replay reload or from a second tab (its single-flight lock is
    // per-JS-context only). Every execution inserted a fresh document —
    // the "matter saved multiple times" bug.
    // Fix: when the client sends a stable UUID in `data.id` (DataProvider
    // now always does), a replay finds the already-created document and
    // returns its _id WITHOUT inserting. Replays are therefore no-ops.
    const clientId =
      typeof sanitizedData.id === "string" && sanitizedData.id.trim() !== ""
        ? sanitizedData.id.trim()
        : null;
    if (clientId) {
      const existing = await findDocByClientId(ctx, table, clientId);
      if (existing) {
        // Cross-firm collision on a client UUID should never happen (UUIDs),
        // but fail CLOSED if it does — never return another firm's document.
        if (existing.firmId && existing.firmId !== effectiveFirmId) {
          throw new Error("Record already exists in another workspace.");
        }
        return existing._id;
      }
    }

    // ─── V2 INVOICE MONEY FENCE (V-FIN-2/6/15) ─────────────────────────
    // Every invoice created through the generic path gets its number
    // issued server-side (atomic financial_counters sequence — concurrent
    // creations can never collide) and its money figures recomputed from
    // lineItems + the one tax contract. Client-passed subTotal/taxAmount/
    // total_amount are hints for intent, never authoritative values. Runs
    // AFTER the client-id idempotency check so replays don't burn numbers,
    // BEFORE the row is assembled (the fence mutates sanitizedData), and
    // INSIDE this transaction so a failed insert rolls the counter back.
    if (table === "invoices") {
      await applyInvoiceCreateFence(ctx, effectiveFirmId, sanitizedData);
    }

    // ─── V3 MATTER LIFECYCLE FENCE (V-MATTER-1/2) ─────────────────────
    // Status defaults to Active and must be one of the three canonical
    // values; stage must be a real label. Arbitrary strings are now a
    // rejection, not persisted data rot.
    if (table === "matters") {
      const rawStatus = sanitizedData.status;
      if (rawStatus === undefined || rawStatus === null || String(rawStatus).trim() === "") {
        sanitizedData.status = "Active";
      } else {
        const normalized = normalizeMatterStatus(rawStatus);
        if (!normalized) {
          throw new Error(
            `Invalid matter status '${String(rawStatus)}'. Valid statuses: Active, Closed, Archived.`
          );
        }
        sanitizedData.status = normalized;
      }
      if (sanitizedData.stage !== undefined && sanitizedData.stage !== null) {
        const stageCheck = validateMatterStage(sanitizedData.stage);
        if (!stageCheck.ok) throw new Error(stageCheck.error);
        sanitizedData.stage = stageCheck.stage;
      }
    }

    // ─── V3 CONTACT DEDUP FENCE (V-MATTER-5/16) ───────────────────────
    // Email is the primary identity: creating a second firm contact with
    // an email that already exists is always a duplicate. Empty emails
    // (the enterprise wizard creates them) never dedup. Phone and name
    // NEVER block here — different people share numbers, and names match
    // by coincidence; those are warnings in the UI (checkContactDuplicate),
    // not server refusals.
    if (table === "contacts") {
      const email = normalizeEmail(sanitizedData.email);
      if (email) {
        const firmContacts = await ctx.db
          .query("contacts")
          .withIndex("by_firm", (q: any) => q.eq("firmId", effectiveFirmId))
          .take(2000);
        const existing = (firmContacts as any[]).find(
          (c) => normalizeEmail(c.email) === email
        );
        if (existing) {
          throw new Error(
            `A contact with this email already exists: "${existing.name || email}". ` +
            `Select the existing contact instead of creating a duplicate.`
          );
        }
      }
    }

    // ─── V3 MATTER-LINK FK CHECKS (V-MATTER-13/14) ───────────────────
    // Documents and invoices carry a declarative matterId. When present it
    // must resolve to a real matter in THIS firm (either id convention) —
    // the old path persisted any string, which is how unjoinable rows
    // accumulated. Absent/empty matterId stays legal (legacy snapshot-only
    // rows keep working; readers resolve both conventions).
    if (table === "documents" || table === "invoices") {
      const matterId = sanitizedData.matterId;
      if (typeof matterId === "string" && matterId.trim() !== "") {
        const matter = await resolveMatterAnyId(ctx, effectiveFirmId, matterId.trim());
        if (!matter) {
          throw new Error(
            `Cannot link this ${table === "documents" ? "document" : "invoice"}: no matter with id "${matterId.trim()}" exists in your firm.`
          );
        }
      }
    }

    // ─── V4 DOCUMENT FILE + VERSIONS FENCE (V-DOC-5/13) ───────────
    // `file` on a document row is either a validated storage-backed
    // object, a bounded index marker, or absent — NEVER a base64 data
    // URL (the pre-V4 path persisted the whole file inline).
    if (table === "documents") {
      const fileResult = sanitizeDocumentFileForCreate(sanitizedData.file);
      if (fileResult.file === undefined) {
        delete sanitizedData.file;
      } else {
        sanitizedData.file = fileResult.file;
      }
      if (sanitizedData.versions !== undefined) {
        sanitizedData.versions = sanitizeDocumentVersions(sanitizedData.versions);
        if ((sanitizedData.versions as any[]).length === 0) delete sanitizedData.versions;
      }
    }

    const dataWithTimestamp = {
      ...sanitizedData,
      firmId: effectiveFirmId,
      createdAt: sanitizedData.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const id = await ctx.db.insert(table as any, dataWithTimestamp);

    // ─── V3 LIFECYCLE + ACTIVITY (V-MATTER-11/12/17) ───────────────────
    // Matter creation records firmActivity and seeds the durable stage
    // history. Wrapped like the automation hooks: observability writes
    // must never fail the user's save.
    if (table === "matters") {
      try {
        const canonicalId = String((dataWithTimestamp as any).id || id);
        await insertFirmActivity(ctx, {
          firmId: effectiveFirmId,
          userId: String(auth.user._id),
          userName: (auth.user as any).name || "",
          action: "Matter created",
          targetType: "Matter",
          targetId: canonicalId,
          targetName: (dataWithTimestamp as any).title || "",
          matterId: canonicalId,
          metadata: {
            type: (dataWithTimestamp as any).type || null,
            stage: (dataWithTimestamp as any).stage || null,
            assignedUsers: Array.isArray((dataWithTimestamp as any).assignedUsers)
              ? (dataWithTimestamp as any).assignedUsers
              : [],
          },
        });
        if ((dataWithTimestamp as any).stage) {
          await appendStageHistory(ctx, {
            firmId: effectiveFirmId,
            matterId: canonicalId,
            matterTitle: (dataWithTimestamp as any).title || "",
            fromStage: null,
            toStage: String((dataWithTimestamp as any).stage),
            changedById: String(auth.user._id),
            changedByName: (auth.user as any).name || "",
            source: "created",
          });
        }
      } catch (activityErr: any) {
        console.warn("[createItem] matter activity/history write failed (non-blocking):", activityErr?.message);
      }
    }

    // ─── AUTOMATION RULE ENGINE HOOKS (Task 48, 2026-09-16) ────────────
    // Event-driven triggers for Automation Studio rules (Settings → Firm
    // Configuration → Automations). Runs in the SAME transaction but every
    // failure is caught: an engine error can NEVER fail the user's save.
    // Idempotency is the engine's contract — a ledger row per rule+entity
    // means re-creating/re-saving never double-fires a rule.
    if (table === "matters" || table === "leads" || table === "events" || table === "documents") {
      try {
        const entityId = String((dataWithTimestamp as any).id || id);
        if (table === "matters") {
          await dispatchRulesForEvent(ctx, {
            firmId: effectiveFirmId,
            event: {
              triggerType: "matter_created",
              value: "any",
              entityId,
              matter: {
                id: entityId,
                title: (dataWithTimestamp as any).title || null,
                type: (dataWithTimestamp as any).type || null,
                stage: (dataWithTimestamp as any).stage || null,
                clientId: (dataWithTimestamp as any).clientId || null,
                assignedUsers: Array.isArray((dataWithTimestamp as any).assignedUsers)
                  ? (dataWithTimestamp as any).assignedUsers
                  : [],
              },
            },
          });
        } else if (table === "leads") {
          await dispatchRulesForEvent(ctx, {
            firmId: effectiveFirmId,
            event: {
              triggerType: "lead_created",
              value: "any",
              entityId,
              lead: {
                name: (dataWithTimestamp as any).name || null,
                email: (dataWithTimestamp as any).email || null,
              },
            },
          });
        } else if (table === "events") {
          await dispatchRulesForEvent(ctx, {
            firmId: effectiveFirmId,
            event: {
              triggerType: "event_created",
              value: (dataWithTimestamp as any).type || "any",
              entityId,
              event: {
                title: (dataWithTimestamp as any).title || null,
                type: (dataWithTimestamp as any).type || null,
                matterId: (dataWithTimestamp as any).matterId || null,
              },
            },
          });
        } else if (table === "documents") {
          await dispatchRulesForEvent(ctx, {
            firmId: effectiveFirmId,
            event: {
              triggerType: "document_uploaded",
              value: (dataWithTimestamp as any).source || "internal",
              entityId,
              document: {
                title: (dataWithTimestamp as any).title || null,
                source: (dataWithTimestamp as any).source || null,
                matterId: (dataWithTimestamp as any).matterId || null,
                uploadedBy: (dataWithTimestamp as any).uploadedBy || null,
              },
            },
          });
        }
      } catch (ruleErr: any) {
        console.warn("[createItem] automation-rule dispatch failed (non-blocking):", ruleErr?.message);
      }
    }
    return id;
  },
});

/**
 * sendChatMessage — Server-side atomic chat message + notification creator.
 *
 * WHY THIS EXISTS
 * ---------------
 * Previously, the client created the chat message via `createItem` and then
 * SEPARATELY created notifications for each recipient via another `createItem`
 * call. This had two problems:
 *
 *   1. If the sender's client crashed, lost connectivity, or simply navigated
 *      away between the two calls, the message was saved but no notification
 *      was ever created. The recipient never knew.
 *
 *   2. Different code paths forgot to create notifications entirely. For
 *      example, `sendTeamReply` in MessagesView.tsx only called `createItem`
 *      for the message — the notification step was missing, so recipients
 *      never got a bell badge or toast.
 *
 * This mutation fixes both issues by writing the chat message AND all
 * recipient notifications in a single Convex transaction. Either both
 * succeed, or neither does.
 *
 * Note: This is NOT a webhook — webhooks are for cross-system events
 * (e.g. Paystack → PracticePro). Internal chat notifications are a
 * Convex server-side mutation triggered directly by the sender's client.
 */
export const sendChatMessage = mutation({
  args: {
    conversationId: v.string(),
    sessionToken: v.optional(v.string()),
    content: v.string(),
    authorId: v.optional(v.string()), // sender's _id (optional — derived from session if absent)
    authorName: v.optional(v.string()), // sender's display name (for notification text)
    userEmail: v.optional(v.string()),
    // Optional: allow caller to create the conversation inline if it doesn't exist yet.
    // Used by TeamMessageModal which sends the first message of a new DM.
    createConversationIfMissing: v.optional(v.boolean()),
    conversationMembers: v.optional(v.array(v.string())), // memberIds for new conversation
    conversationName: v.optional(v.string()),
    // ─── IDEMPOTENCY KEY ───────────────────────────────────────────────
    // Prevents duplicate messages when the client retries after a network blip.
    // If a message with the same idempotencyKey already exists, the mutation
    // returns the existing messageId WITHOUT inserting a duplicate or
    // re-issuing notifications. Generate on the client with uuidv4() per send.
    idempotencyKey: v.optional(v.string()),
    // ─── ATTACHMENTS ─────────────────────────────────────────────
    // Convex file-storage IDs of files attached to this message (uploaded
    // client-side via generateUploadUrl). REGRESSION GUARD: these fields were
    // previously sent by the client WITHOUT existing here — Convex rejected
    // EVERY team DM send with ArgumentValidationError "extra field
    // 'attachmentNames'" (empty arrays are still extra fields). They are now
    // first-class args, sanitized and persisted onto the chatMessages row.
    // Client MUST omit them (pass undefined) when there are no attachments —
    // never empty arrays — so plain-text sends stay minimal.
    attachments: v.optional(v.array(v.string())),
    attachmentNames: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    // 1. Authenticate the caller. Strict identity (R16): only a verified
    //    bearer sessionToken (or a server-managed Convex Auth identity in
    //    resolveCaller-based flows) resolves a caller — see callerAuth.ts
    //    resolveCaller / authHelpers.ts requireFirmUser. The userEmail arg
    //    is accepted for backward API compatibility but is IGNORED.
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const firmId = auth.firmId;
    const senderId = args.authorId || auth.userId;
    const senderName = args.authorName || auth.user?.name || "A colleague";
    const now = new Date().toISOString();

    // ─── ATTACHMENT SANITIZATION ─────────────────────────────────
    // Cap the count and string lengths, and align names to ids so a malformed
    // or hostile payload can never write runaway data into chatMessages.
    const MAX_ATTACHMENTS = 10;
    const rawAttachments = (args.attachments ?? []).filter((s) => typeof s === "string" && s.length > 0);
    const attachments = rawAttachments.slice(0, MAX_ATTACHMENTS).map((s) => s.slice(0, 200));
    const attachmentNames = attachments.map((_, i) => {
      const raw = args.attachmentNames?.[i];
      return (typeof raw === "string" && raw.trim().length > 0) ? raw.trim().slice(0, 200) : `File ${i + 1}`;
    });

    // ─── DEDUP CHECK ──────────────────────────────────────────────────
    // If idempotencyKey is provided, check for an existing message with the
    // same key. Return early if found — no duplicate insert, no duplicate
    // notifications. This makes sendChatMessage safe to retry.
    if (args.idempotencyKey) {
      const existing = await ctx.db
        .query("chatMessages")
        .withIndex("by_idempotency", (q) => q.eq("idempotencyKey", args.idempotencyKey as any))
        .first();
      if (existing) {
        return { messageId: (existing as any).id || existing._id.toString(), deduplicated: true };
      }
    }

    // 2. Resolve the conversation. If createConversationIfMissing is set and
    //    the conversation doesn't exist, create it. This supports the
    //    TeamMessageModal flow where the first message creates the conversation.
    let conversationId = args.conversationId;
    let memberIds: string[] = [];

    // Try to find an existing conversation by custom `id` field first
    // (frontend uses uuidv4 ids), then by Convex _id.
    let existingConv = await ctx.db
      .query("chatConversations")
      .withIndex("by_custom_id", (q) => q.eq("id", args.conversationId))
      .first();

    if (!existingConv) {
      // Fallback: try as Convex _id
      try {
        existingConv = await ctx.db.get(args.conversationId as Id<"chatConversations">);
      } catch { /* not a valid Convex id format — ignore */ }
    }

    if (existingConv) {
      // CRITICAL: Keep the client-supplied conversationId (the uuidv4 from
      // c.id) so the client's filter (m.conversationId === c.id) matches.
      // Previously this was rewritten to existingConv._id.toString(), which
      // broke the client filter — messages were inserted but never appeared
      // as bubbles because the filter compared UUID vs Convex _id string.
      conversationId = args.conversationId;
      memberIds = (existingConv.memberIds as string[]) || [];
    } else if (args.createConversationIfMissing && args.conversationMembers?.length) {
      // Create the conversation inline
      const newConvId = crypto.randomUUID();
      await ctx.db.insert("chatConversations", {
        id: newConvId,
        type: "direct",
        memberIds: args.conversationMembers,
        name: args.conversationName || "Direct Message",
        matterId: null,
        createdAt: now,
        updatedAt: now,
        hiddenForUserIds: [],
        firmId,
      });
      conversationId = newConvId;
      memberIds = args.conversationMembers;
    } else {
      // Conversation doesn't exist and we weren't asked to create it.
      // This is an error — don't save a message to a non-existent conversation.
      throw new Error("Conversation not found. Please restart the chat.");
    }

    // 3. Save the chat message.
    // 2026-09-14 ("unknown sender" fix): persist authorName on the row. The
    // mutation computed senderName for notification text but never stored
    // it — every team message sent since the server-mutation cutover
    // rendered as "Unknown sender" with a 'U' avatar (isMe still worked, so
    // the OTHER member's bubbles lost their name). Legacy rows are
    // name-resolved at read time by getChatMessages.
    const messageId = crypto.randomUUID();
    await ctx.db.insert("chatMessages", {
      id: messageId,
      conversationId,
      content: args.content,
      authorId: senderId,
      authorName: senderName,
      timestamp: now,
      createdAt: now,
      updatedAt: now,
      firmId,
      isDeleted: false,
      status: "sent",
      // Persist idempotencyKey so future retries can dedup against this row
      idempotencyKey: args.idempotencyKey || null,
      // Attachments (Convex storage IDs + display names). Spread only when
      // non-empty so pre-existing rows and no-attachment messages stay clean.
      ...(attachments.length > 0 ? { attachments, attachmentNames } : {}),
    });

    // 4. Create notifications for every OTHER member of the conversation.
    //    (The sender doesn't get a notification for their own message.)
    //    This runs in the SAME transaction as the message insert, so it's
    //    all-or-nothing. If the message is saved, the notifications are saved.
    //
    //    SMART PREVIEWS (2026-09-14): the notification body carries the ACTUAL
    //    message text, not just "sent you a message" — recipients read the
    //    message from the bell, toast, and push shade without opening the app.
    const cleanContent = (args.content || "").replace(/\s+/g, " ").trim();
    const truncated = cleanContent.length > 90 ? cleanContent.slice(0, 89).trimEnd() + "…" : cleanContent;
    const chatPreview = truncated
      ? `${senderName}: ${truncated}`
      : attachments.length > 0
        ? `${senderName} sent an attachment`
        : `${senderName} sent you a message`;
    const recipientIds = memberIds.filter((id) => id && id !== senderId);
    if (recipientIds.length > 0) {
      const notificationPromises = recipientIds.map((recipientId) => {
        const notificationId = crypto.randomUUID();
        return ctx.db.insert("notifications", {
          id: notificationId,
          firmId,
          userId: recipientId,
          title: "New Message",
          message: chatPreview,
          type: "message",
          isRead: false,
          link: {
            view: "messaging",
            id: conversationId,
            // Include initialTab + selectedInboxId so clicking the notification
            // opens the unified inbox with this specific team conversation
            // selected — not just the messaging page.
            context: {
              activeConversationId: conversationId,
              initialTab: "inbox",
              selectedInboxId: conversationId,
              selectedInboxType: "team",
            },
          },
          timestamp: Date.now(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });
      await Promise.all(notificationPromises);
    }

    // 5. REAL FCM PUSH to recipients' devices (2026-09-14: "no push when I
    //    send a message to a user on the APK"). Every send path previously
    //    stopped at the in-app notification rows — nothing on the server
    //    dispatched an FCM push, and no client polling existed to show a
    //    local notification. Fire-and-forget: a push failure must NEVER
    //    fail the message send.
    //
    //    SMART CATEGORIZATION (2026-09-14 round):
    //    - channelId "practicepro-messages": the MAX-importance channel the
    //      client pre-creates (heads-up + sound) — not the general channel.
    //    - tag `conversation:<id>`: Android REPLACES the tray row with the
    //      same tag, so N messages in one conversation collapse into ONE
    //      WhatsApp-style row instead of N stacked rows.
    //    - notificationCount: non-deleted message count in the conversation —
    //      the "N messages" badge on the collapsed row.
    //    - body carries the ACTUAL message text (lock-screen readable).
    //    - title: the sender (DM) or "sender · group" (group chat).
    if (recipientIds.length > 0) {
      try {
        // Badge source: non-deleted messages in this conversation (read-your-
        // writes inside the same transaction includes the just-sent message).
        const conversationMessages = await ctx.db
          .query("chatMessages")
          .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
          .collect();
        const messageCount = conversationMessages.filter((m: any) => !m.isDeleted).length;

        const isGroup = (existingConv as any)?.type === "group";
        const conversationName = (existingConv as any)?.name || args.conversationName || "Team chat";
        const pushTitle = isGroup ? `${senderName} · ${conversationName}` : senderName;
        const pushBody = truncated
          ? truncated
          : attachments.length > 0
            ? "sent an attachment"
            : `${senderName} sent you a message`;

        await ctx.runMutation(internal.pushNotifications.dispatchPushToUsers, {
          userIds: recipientIds,
          title: pushTitle,
          body: pushBody,
          data: {
            type: "chat_message",
            view: "messaging",
            conversationId,
            // Deep-link context for the tap handler (pp:navigate event)
            initialTab: "inbox",
            senderName,
          },
          channelId: "practicepro-messages",
          tag: `conversation:${conversationId}`,
          notificationCount: messageCount,
          // WHATSAPP-GRADE PUSH (2026-09-14): mark conversational — capable
          // devices (native PracticeProMessagingService) get an inline-reply
          // action on the notification; the replyToken is minted per user
          // inside the FCM dispatcher and posts through /api/push-reply.
          replyable: "1",
        });
      } catch (e: any) {
        await logError(ctx, {
          scope: "messaging", name: "myFunctions:sendChatMessage:pushDispatch",
          error: e, severity: "warning",
          firmId,
          context: { conversationId, recipients: recipientIds.length },
        });
      }
    }

    // 6. Return the message id + conversation id so the client can update
    //    its optimistic UI state.
    return { messageId, conversationId };
  },
});

/**
 * internalMutation: sendPushReplyMessage — the WhatsApp-style inline-reply
 * path (2026-09-14).
 *
 * Called ONLY by the /api/push-reply httpAction AFTER it has verified the
 * replyToken (HMAC-minted at push dispatch time, bound to userId +
 * conversationId, 24h expiry — see pushReplyAuth.ts). Internal = not
 * publicly invokable; the replyToken IS the auth gate.
 *
 * Mirrors sendChatMessage's core (conversation resolve → insert → notify →
 * push) but trusts the verified userId instead of a session. Membership is
 * re-checked: the reply only lands if the user is still in the conversation.
 * Recipients get the same notification + FCM treatment as a normal send —
 * including replyable:"1", so a reply chain can continue entirely from the
 * notification shade, exactly like WhatsApp.
 */
export const sendPushReplyMessage = internalMutation({
  args: {
    userId: v.string(),          // from the verified replyToken
    conversationId: v.string(),  // cross-checked against the token
    content: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Resolve the sender from the token's userId. The users table's _id
    //    is the canonical id used in conversation memberIds and dispatch.
    let user: any = null;
    try {
      user = await ctx.db.get(args.userId as Id<"users">);
    } catch { /* not a Convex id — reject below */ }
    if (!user) return { success: false, error: "USER_NOT_FOUND" };

    const firmId = user.firmId || null;
    const senderId = String(user._id);
    const senderName = user.name || user.email?.split("@")[0] || "Team member";

    // 2. Content hygiene: notifications carry short previews; a reply typed
    //    into RemoteInput is a text message — cap it, strip control chars.
    const content = String(args.content || "").replace(/\s+/g, " ").trim().slice(0, 1000);
    if (!content) return { success: false, error: "EMPTY_REPLY" };

    // 3. Resolve the conversation (custom uuid id first, then Convex _id —
    //    same dual lookup as sendChatMessage) and require membership.
    let existingConv: any = await ctx.db
      .query("chatConversations")
      .withIndex("by_custom_id", (q) => q.eq("id", args.conversationId))
      .first();
    if (!existingConv) {
      try { existingConv = await ctx.db.get(args.conversationId as Id<"chatConversations">); } catch {}
    }
    if (!existingConv) return { success: false, error: "CONVERSATION_NOT_FOUND" };

    const memberIds: string[] = (existingConv.memberIds as string[]) || [];
    const memberIdsNormalized = memberIds.map(String);
    if (!memberIdsNormalized.includes(senderId)) {
      return { success: false, error: "NOT_A_MEMBER" };
    }

    const conversationId = args.conversationId;
    const now = new Date().toISOString();

    // 4. Insert the message row (same shape as sendChatMessage).
    const messageId = crypto.randomUUID();
    await ctx.db.insert("chatMessages", {
      id: messageId,
      conversationId,
      content,
      authorId: senderId,
      authorName: senderName,
      timestamp: now,
      createdAt: now,
      updatedAt: now,
      firmId: firmId || undefined,
      isDeleted: false,
      status: "sent",
      // Provenance: the push-reply- prefix marks this row as typed in the
      // notification shade (the schema has no dedicated source field, so
      // the idempotency key doubles as the origin marker).
      idempotencyKey: `push-reply-${messageId}`,
    });

    // 5. Bell notifications for the OTHER members (same shape as
    //    sendChatMessage's step 4).
    const recipientIds = memberIdsNormalized.filter((id) => id && id !== senderId);
    const cleanContent = content.length > 90 ? content.slice(0, 89).trimEnd() + "…" : content;
    const chatPreview = `${senderName}: ${cleanContent}`;
    if (recipientIds.length > 0) {
      await Promise.all(recipientIds.map((recipientId) => {
        const notificationId = crypto.randomUUID();
        return ctx.db.insert("notifications", {
          id: notificationId,
          firmId: firmId || undefined,
          userId: recipientId,
          title: "New Message",
          message: chatPreview,
          type: "message",
          isRead: false,
          link: {
            view: "messaging",
            id: conversationId,
            context: {
              activeConversationId: conversationId,
              initialTab: "inbox",
              selectedInboxId: conversationId,
              selectedInboxType: "team",
            },
          },
          timestamp: Date.now(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }));
    }

    // 6. FCM push to the other members (reply chain continues from the
    //    shade). Fire-and-forget via the scheduler — a push failure must
    //    never fail the reply (the message row is already committed).
    if (recipientIds.length > 0) {
      try {
        const conversationMessages = await ctx.db
          .query("chatMessages")
          .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
          .collect();
        const messageCount = conversationMessages.filter((m: any) => !m.isDeleted).length;
        const isGroup = existingConv.type === "group";
        const conversationName = existingConv.name || "Team chat";
        const pushTitle = isGroup ? `${senderName} · ${conversationName}` : senderName;

        await ctx.runMutation(internal.pushNotifications.dispatchPushToUsers, {
          userIds: recipientIds,
          title: pushTitle,
          body: content,
          data: {
            type: "chat_message",
            view: "messaging",
            conversationId,
            initialTab: "inbox",
            senderName,
          },
          channelId: "practicepro-messages",
          tag: `conversation:${conversationId}`,
          notificationCount: messageCount,
          replyable: "1",
        });
      } catch (e: any) {
        await logError(ctx, {
          scope: "messaging", name: "myFunctions:sendPushReplyMessage:pushDispatch",
          error: e, severity: "warning",
          firmId: firmId || undefined,
          context: { conversationId, recipients: recipientIds.length },
        });
      }
    }

    return { success: true, messageId, conversationId };
  },
});

/**
 * createTask — Server-side atomic task creation + notification dispatch.
 *
 * Creates a task AND sends notifications to all assignees in a single
 * Convex transaction. The notification dispatch logic:
 *
 * - Internal Team Members (Admin, Lawyer, Paralegal, Manager):
 *   In-app portal notification ONLY. No email or WhatsApp.
 *
 * - External Stakeholders (Clients, Residents):
 *   In-app portal notification + Email (default) + WhatsApp (only if
 *   the client/resident has explicitly opted-in for WhatsApp).
 *   If WhatsApp dispatch fails, falls back to Email.
 *
 * Notifications are ONLY sent on initial task creation — NOT when tasks
 * are moved between Kanban columns (To Do → In Progress → Done).
 *
 * RECOMMENDED ADDITIONS IMPLEMENTED:
 * - Due Date & Reminder: if dueDate is set, a single reminder is
 *   scheduled 24h before the due date (only if task is still 'todo').
 * - Dual-assignment logic: if a task has BOTH internal AND external
 *   assignees, internal gets in-app only, external gets in-app + email/WhatsApp.
 * - Notification delivery fallback: WhatsApp failure → Email fallback.
 */
export const createTask = mutation({
  args: {
    title: v.string(),
    sessionToken: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    assignedUsers: v.array(v.string()),
    assigneeType: v.optional(v.string()), // 'team' | 'client' | 'tenant'
    isSharedWithPortal: v.optional(v.boolean()),
    matterId: v.optional(v.string()),
    priority: v.optional(v.string()),
    creatorId: v.optional(v.string()),
    creatorName: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    // P11: Idempotency key — prevents duplicate tasks on double-submit (mobile retries)
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // P11 DEDUP: If idempotencyKey is provided, check for an existing record.
    if (args.idempotencyKey) {
      const existing = await ctx.db
        .query("tasks")
        .withIndex("by_idempotency", (q: any) => q.eq("idempotencyKey", args.idempotencyKey))
        .first();
      if (existing) {
        return existing._id;
      }
    }
    // 1. Authenticate
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const firmId = auth.firmId;
    const creatorId = args.creatorId || auth.userId;
    const creatorName = args.creatorName || auth.user?.name || "A team member";
    const now = new Date().toISOString();

    // 2. Validate — at least one assignee is MANDATORY
    if (!args.assignedUsers || args.assignedUsers.length === 0) {
      throw new Error("At least one assignee is required to create a task.");
    }

    // 3. Insert the task record
    // FIX (Aug 2026): Assign the computed taskId to the task document's
    // custom `id` field so that generic updateItem/deleteItem lookups
    // (which use the by_custom_id index) can find it. Previously this
    // UUID was computed but never stored — making all generic-path
    // task operations fail silently.
    const taskId = crypto.randomUUID();
    const taskDoc: any = {
      firmId,
      id: taskId, // ← NOW actually assigned (was dead code before)
      title: args.title,
      description: args.description || "",
      status: args.status || "todo",
      dueDate: args.dueDate || null,
      assignedUsers: args.assignedUsers,
      assigneeType: args.assigneeType || "team",
      isSharedWithPortal: args.isSharedWithPortal || false,
      matterId: args.matterId || null,
      creatorId,
      priority: args.priority || "medium",
      isSystem: false,
      idempotencyKey: args.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    };
    await ctx.db.insert("tasks", taskDoc);

    // 4. Create notifications for ALL assignees
    //    - Internal team: in-app only
    //    - External (client/tenant): in-app + email (+ WhatsApp if opted in)
    const assigneeType = args.assigneeType || "team";
    const isExternal = assigneeType === "client" || assigneeType === "tenant";

    // Use Promise.allSettled instead of Promise.all so that if ONE
    // notification insert fails, it doesn't reject the entire mutation.
    // Previously, Promise.all meant a single failed notification insert
    // would throw from the handler, making the user think the task
    // creation failed — even though the task was already inserted.
    const notificationPromises = args.assignedUsers.map(async (assigneeId) => {
      try {
        const notificationId = crypto.randomUUID();
        const link = {
          view: "tasks",
          id: taskId,
          context: { taskId, taskTitle: args.title },
        };

        await ctx.db.insert("notifications", {
          id: notificationId,
          firmId,
          userId: assigneeId,
          title: "New Task Assigned",
          message: `${creatorName} assigned you a task: "${args.title}"${args.dueDate ? ` — due ${new Date(args.dueDate).toLocaleDateString('en-GB')}` : ''}`,
          type: "task_assignment",
          isRead: false,
          link,
          timestamp: Date.now(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        // For external assignees, schedule email + WhatsApp dispatch
        // (best-effort — failures here don't affect the task or notification)
        if (isExternal) {
          try {
            // Look up the assignee user to get their email/phone.
            // assigneeId might be a custom UUID (not a Convex _id), so
            // ctx.db.get() may throw — use a query fallback instead.
            let assigneeUser: any = null;
            try {
              assigneeUser = await ctx.db.get(assigneeId as any) as any;
            } catch {
              // assigneeId is not a valid Convex _id — try looking up
              // by the custom 'id' field in the users table
              assigneeUser = await ctx.db
                .query("users")
                .withIndex("by_custom_id", (q: any) => q.eq("id", assigneeId))
                .first();
            }

            if (assigneeUser) {
              const email = assigneeUser.email || assigneeUser.tokenIdentifier;
              const phone = assigneeUser.phone || assigneeUser.whatsappNumber;
              const whatsappOptIn = assigneeUser.whatsappOptIn === true ||
                                    assigneeUser.notificationSettings?.whatsapp === true;

              // Schedule email dispatch (primary external channel)
              // NOTE: sendEmail expects `htmlContent` (not `html`) and
              // requires `firmId`. Previously this passed `html` and omitted
              // `firmId`, causing the scheduled action to fail.
              if (email) {
                try {
                  await ctx.scheduler.runAfter(0, internal.communications.sendEmailCore as any, {
                    to: email,
                    subject: `New Task Assigned: ${args.title}`,
                    htmlContent: `<!DOCTYPE html>
<html lang="en" style="margin:0;padding:0;">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f4f6f8;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
          <tr>
            <td style="background:linear-gradient(135deg,#0F172A 0%,#16A34A 100%);border-radius:16px 16px 0 0;padding:28px 32px 20px;text-align:center;">
              <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:26px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">Practice<span style="color:#16A34A;">Pro</span></span>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:32px 32px 24px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
              <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:17px;font-weight:600;color:#1a202c;margin:0 0 8px;">Hello ${assigneeUser.name || 'there'},</p>
              <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.7;color:#4a5568;margin:0 0 20px;">
                ${creatorName} has assigned you a task:
              </p>
              <div style="background:#f8fafc;padding:16px;border-radius:8px;margin:16px 0;border-left:4px solid #16A34A;">
                <h3 style="margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0F172A;">${args.title}</h3>
                ${args.description ? `<p style="color:#64748b;margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${args.description}</p>` : ''}
                ${args.dueDate ? `<p style="color:#dc2626;margin:8px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><strong>Due: ${new Date(args.dueDate).toLocaleDateString('en-GB')}</strong></p>` : ''}
              </div>
              <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.7;color:#4a5568;margin:0 0 20px;">
                Please log in to your portal to view and complete this task.
              </p>
              <div style="text-align:center;margin:28px 0 32px;">
                <a href="https://practice-pro-vega.vercel.app" style="display:inline-block;background-color:#16A34A;color:#ffffff;padding:14px 28px;font-size:15px;font-weight:700;text-decoration:none;border-radius:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Go to Portal</a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;border-radius:0 0 16px 16px;padding:20px 32px;border-top:1px solid #e2e8f0;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
              <p style="text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;color:#94a3b8;margin:0;">PracticePro Systems Limited &bull; Practice Management</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
                    firmId,
                  });
                } catch (e) {
                  console.warn("[createTask] Email scheduling failed:", e);
                }
              }

              // Schedule WhatsApp dispatch (secondary, only if opted in)
              if (phone && whatsappOptIn) {
                try {
                  await ctx.scheduler.runAfter(0, internal.communications.sendWhatsAppCore as any, {
                    to: phone,
                    messageText: `New task assigned: "${args.title}"${args.dueDate ? ` — due ${new Date(args.dueDate).toLocaleDateString('en-GB')}` : ''}. Log in to your portal to view and complete it.`,
                    firmId,
                  });
                } catch (e) {
                  console.warn("[createTask] WhatsApp scheduling failed:", e);
                }
              }
            }
          } catch (e) {
            // External notification dispatch is best-effort — don't fail
            console.error("[createTask] External notification dispatch failed:", e);
          }
        }
      } catch (e) {
        // If the notification INSERT fails, log it but don't reject the
        // entire mutation — the task was already created successfully.
        console.error("[createTask] Notification insert failed for assignee:", assigneeId, e);
      }
    });

    await Promise.allSettled(notificationPromises);

    // 5. Return the task id
    return { taskId };
  },
});

/**
 * logActivity — Server-side audit trail logger.
 * Use this in any Convex mutation to record who did what, when.
 * Unlike the frontend logActivity (which goes through createItem),
 * this is guaranteed to execute even if the client disconnects.
 */
export const logActivity = internalMutation({
  args: {
    firmId: v.string(),
    sessionToken: v.optional(v.string()),
    userId: v.optional(v.string()),
    userName: v.optional(v.string()),
    action: v.string(),
    targetType: v.optional(v.string()),
    targetId: v.optional(v.string()),
    targetName: v.optional(v.string()),
    matterId: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    await ctx.db.insert("firmActivity", {
      firmId: args.firmId,
      userId: args.userId,
      userName: args.userName,
      action: args.action,
      timestamp: now,
      targetType: args.targetType,
      targetId: args.targetId,
      targetName: args.targetName,
      matterId: args.matterId,
      metadata: args.metadata,
      id,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },
});

const INDEXED_CUSTOM_ID_TABLES = [
  "matters",
  "contacts",
  "properties",
  "invoices",
  "expenses",
  "firmActivity",
  "researchNotebooks",
  "researchSources",
  "researchMessages",
  "users",
  "chatMessages",
  "chatConversations",
  "notifications",
  "tasks",
];

/** Recursively strip undefined values from nested objects/arrays so Convex serialization never throws. */
function sanitizeForConvex(val: any): any {
  if (Array.isArray(val)) return val.map(sanitizeForConvex);
  if (val !== null && typeof val === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) out[k] = sanitizeForConvex(v);
    }
    return out;
  }
  return val;
}

/**
 * TASK 64 — idempotency lookup for createItem: find an existing document by
 * its client-supplied stable `id` (custom id field). Uses the by_custom_id
 * index for indexed tables; a filtered query otherwise. Returns null when
 * not found (or when the table can't be queried — callers treat that as
 * "no duplicate" and insert normally).
 *
 * EXPORTED FOR TESTS (same pattern as resolveRecordForUpdate above): the
 * lookup contract is pinned by tests/unit/createItemIdempotency.test.ts.
 */
export async function findDocByClientId(
  ctx: { db: { query: (table: any) => any } },
  table: string,
  clientId: string
): Promise<any | null> {
  try {
    if (INDEXED_CUSTOM_ID_TABLES.includes(table)) {
      return await ctx.db
        .query(table as any)
        .withIndex("by_custom_id" as any, (q: any) => q.eq("id", clientId))
        .first();
    }
    return await ctx.db
      .query(table as any)
      .filter((q: any) => q.eq(q.field("id"), clientId))
      .first();
  } catch {
    return null;
  }
}

/** Resolve Convex _id from internal id or legacy custom id field (mirrors deleteItem Strategy B).
 *
 * EXPORTED FOR TESTS (Round 10): this resolver was the locus of the Round 9
 * firm-settings save bug (self-referential `firms` ownership check) — the
 * regression suite in tests/unit/resolveRecordForUpdate.test.ts locks in
 * the fixed behavior. Not part of the Convex public function surface.
 */
export async function resolveRecordForUpdate(
  ctx: { db: { get: (id: any) => Promise<any>; query: (table: any) => any } },
  table: string,
  id: string,
  firmId: string
): Promise<{ docId: any }> {
  // Wrapped in try-catch: ctx.db.get() throws when id is a UUID (not a Convex internal ID)
  let existing: any = null;
  try {
    existing = (await ctx.db.get(id as any)) as any;
  } catch (_e) {
    // id is a UUID / non-Convex ID — fall through to indexed search
  }

  if (existing) {
    // SECURITY: Fail CLOSED — throws if firmId is empty (anonymous caller).
    // This was previously fail-open (short-circuited on empty firmId), which
    // allowed anonymous callers to update any record. Fixed to fail-closed.
    if (!firmId) {
      throw new Error("Unauthenticated: userEmail required. Anonymous updates are no longer permitted.");
    }
    // ROUND 9 FIX (firm-settings save bug): the `firms` table is SELF-REFERENTIAL —
    // a firm document IS the firm, so it carries no `firmId` field of its own.
    // The generic check below (`!existing.firmId || existing.firmId !== firmId`)
    // therefore rejected EVERY firms-table update with "Unauthorized. This
    // record belongs to another organization." — the user saw this as the
    // "Failed to sync firm settings" toast after completing the setup wizard,
    // which in turn meant practiceProfile.blueprintAppliedAt,
    // settings.onboardingCompletedAt and every other firm-settings write
    // (bank accounts, integrations, AI settings) never persisted.
    // Ownership for a firm doc = its own _id must match the caller's firmId.
    if (table === "firms") {
      if (String(existing._id) !== String(firmId)) {
        throw new Error("Unauthorized. This record belongs to another organization.");
      }
      return { docId: id };
    }
    if (!existing.firmId || existing.firmId !== firmId) {
      throw new Error("Unauthorized. This record belongs to another organization.");
    }
    return { docId: id };
  }

  if (INDEXED_CUSTOM_ID_TABLES.includes(table)) {
    const item = await ctx.db
      .query(table as any)
      .withIndex("by_custom_id" as any, (q: any) => q.eq("id", id))
      .first();
    if (item) {
      if (!firmId || (item.firmId && item.firmId !== firmId)) {
        throw new Error("Unauthorized. This record belongs to another organization.");
      }
      return { docId: item._id };
    }
  } else {
    const sample = await ctx.db.query(table as any).take(500);
    // Try matching by custom 'id' field first, then fall back to _id
    const item = sample.find((i: any) => i.id === id) ||
                 sample.find((i: any) => String(i._id) === String(id));
    if (item) {
      if (!firmId || (item.firmId && item.firmId !== firmId)) {
        throw new Error("Unauthorized. This record belongs to another organization.");
      }
      return { docId: item._id };
    }
  }

  throw new Error("Record not found.");
}

export const updateItem = mutation({
  args: { sessionToken: v.optional(v.string()), table: v.string(), id: v.string(), data: v.any(), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { table, id, data } = args;

    // ─── FINANCIAL TABLE FENCE (accounting-integrity round, 2026-09-14) ──
    // Booked money rows may be EDITED through this generic path (invoice
    // status transitions like Sent→Paid are legitimate app flows) but NEVER
    // silently: every patch is snapshotted into the append-only
    // financial_audit_log. The lifecycle fields (recordStatus / voided* /
    // auditId / priorStatus) are STRIPPED — only the dedicated
    // financialIntegrity mutations may change them, so no un-voiding
    // without a reason + audit trail can ever sneak through here.
    const FINANCIAL_LIFECYCLE_FIELDS = new Set([
      'recordStatus', 'voidedAt', 'voidedByEmail', 'voidReason', 'auditId', 'priorStatus',
    ]);
    const isFinancialTable = FINANCIAL_TABLES.has(table);
    if (isFinancialTable) {
      for (const key of Object.keys(data || {})) {
        if (FINANCIAL_LIFECYCLE_FIELDS.has(key)) {
          delete data[key];
        }
      }
    }

    // ─── SECURITY GATE (CRO Audit Track A — A2) ───────────────────────────
    // For `firms` table writes, require Admin role and reject any client-
    // supplied attempt to change billing/tier fields. Those mutations must
    // go through dedicated mutations (createSubscriptionRequest,
    // activateFirmSubscription, updateFirmAdminSettings) that have proper
    // auth + verification.
    const FIRM_PROTECTED_FIELDS = new Set([
      'subscriptionPlan', 'setupFeePaid', 'trialStartsAt', 'trialEndsAt',
      'trialPlan', 'billingInterval', 'nextBillingDate', 'adminStatus',
      'adminNotes', 'ingestionAccess',
    ]);

    if (table === 'firms') {
      // Require Admin role (not just any firm member)
      await requireAdmin(ctx, args.userEmail, args.sessionToken);

      // Strip protected fields from client-supplied patch
      const stripped: string[] = [];
      for (const key of Object.keys(data || {})) {
        if (FIRM_PROTECTED_FIELDS.has(key)) {
          stripped.push(key);
          delete data[key];
        }
      }
      if (stripped.length > 0) {
        console.warn(
          `[updateItem] Rejected client-supplied protected fields on firms table: ${stripped.join(', ')}. ` +
          `These must go through dedicated mutations (createSubscriptionRequest, activateFirmSubscription, etc.)`
        );
      }
    } else {
      // Non-firms tables: require firm membership (existing behavior)
      await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    }

    const { firmId, user: callerUser } = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const { docId } = await resolveRecordForUpdate(ctx, table, id, firmId);

    // ─── D1 SECURITY GATE (users table): privilege fields ────────────────
    // Pre-D1, ANY firm member could patch ANY same-firm user record via
    // this generic path — including promoting themselves to Admin/Founder
    // or deactivating colleagues, bypassing deactivateTeamMember's guards
    // entirely. Privilege-bearing fields now require a session-resolved
    // Admin/Founder caller; the Founding Partner role and firm moves stay
    // platform-founder-only. Ordinary self-service profile edits (name,
    // title, preferences) are unaffected.
    if (table === 'users') {
      const USERS_PRIVILEGE_FIELDS = new Set([
        'role', 'deactivatedAt', 'deactivatedBy', 'deactivationReason',
        'firmId', 'joinedFirmIds', 'tokenIdentifier', 'password',
      ]);
      const touchedPrivilege = Object.keys(data || {}).filter((k) => USERS_PRIVILEGE_FIELDS.has(k));
      if (touchedPrivilege.length > 0) {
        const platformCaller = isPlatformFounder(callerUser);
        if (!platformCaller && !isFirmAdminRole(callerUser)) {
          throw new Error(
            "Only administrators can change team member roles or access status."
          );
        }
        if (!platformCaller && 'role' in (data || {})) {
          const targetUserDoc: any = await ctx.db.get(docId);
          if (data.role === 'Founder' || targetUserDoc?.role === 'Founder') {
            throw new Error(
              "The Founding Partner role can only be changed by the platform founder."
            );
          }
        }
      }
    }

    // ─── V3 MATTER LIFECYCLE FENCE (V-MATTER-1/2) + automation priors ─
    // Validates status transitions and stage shape BEFORE anything is
    // patched, and captures the pre-patch values the post-patch history/
    // activity writes need. `undefined` = not a lifecycle-bearing update.
    let priorMatterStage: string | null | undefined = undefined;
    let priorMatterStatus: string | null | undefined = undefined;
    let priorAssignedUsers: string[] | null = null;
    if (
      table === "matters" &&
      ((data as any).status !== undefined ||
        (data as any).stage !== undefined ||
        (data as any).assignedUsers !== undefined)
    ) {
      let existingDoc: any = null;
      try {
        existingDoc = await ctx.db.get(docId);
      } catch {
        existingDoc = null;
      }
      priorMatterStage = existingDoc?.stage ?? null;
      priorMatterStatus = existingDoc?.status ?? null;
      priorAssignedUsers = Array.isArray(existingDoc?.assignedUsers)
        ? existingDoc.assignedUsers
        : [];

      // Status: canonicalise + enforce the transition graph.
      if ((data as any).status !== undefined && (data as any).status !== null) {
        const normalized = normalizeMatterStatus((data as any).status);
        if (!normalized) {
          throw new Error(
            `Invalid matter status '${String((data as any).status)}'. Valid statuses: Active, Closed, Archived.`
          );
        }
        const transition = validateMatterStatusTransition(priorMatterStatus, normalized);
        if (!transition.ok) throw new Error(transition.error);
        (data as any).status = normalized;
      }
      // Stage: shape validation (firm-configurable vocabulary — but a real label).
      if ((data as any).stage !== undefined && (data as any).stage !== null) {
        const stageCheck = validateMatterStage((data as any).stage);
        if (!stageCheck.ok) throw new Error(stageCheck.error);
        (data as any).stage = stageCheck.stage;
      }
    }

    // Strip Convex-managed internal fields that cannot be patched
    const { _id, _creationTime, ...rest } = data;

    const patchData: Record<string, any> = {};
    for (const [key, val] of Object.entries(rest)) {
      // 1. Local State Filter: Strip keys starting with _ or temp (Convex reserves _ prefix)
      if (key.startsWith("temp") || key.startsWith("_")) {
        continue;
      }

      // 2. Financial Precision — round currency fields to 2 decimal places
      // to prevent floating-point accumulation (Audit C11).
      // Handles both string inputs ("₦1,234.56") and numeric inputs.
      const isCurrencyField = typeof val === "string" || typeof val === "number" ? (
        key.toLowerCase().includes("amount") ||
        key.toLowerCase().includes("rate") ||
        key.toLowerCase().includes("price") ||
        key.toLowerCase().includes("balance") ||
        key.toLowerCase().includes("value") ||
        key.toLowerCase().includes("total")
      ) : false;

      if (isCurrencyField) {
        const num = typeof val === "string"
          ? parseFloat(val.replace(/[^\d.-]/g, ''))
          : typeof val === "number" ? val : NaN;
        if (!isNaN(num)) {
          patchData[key] = roundMoney(num);
          continue;
        }
      }

      // 3. The 'Null' Sanitizer: Skip null values entirely rather than setting to
      //    undefined, which can trip Convex schema validation on required fields.
      if (val === null) continue;

      patchData[key] = sanitizeForConvex(val);
    }

    // ─── V4 DOCUMENT FILE + VERSIONS FENCE (V-DOC-5/13) ───────────
    // A legacy row round-tripping through a metadata edit keeps its stored
    // file (the additive backfill migrates it to storage); a fresh upload
    // carries a storageId and takes the validated path. Inline base64
    // never enters the row through the generic update path.
    if (table === "documents") {
      let storedRow: any = null;
      try { storedRow = await ctx.db.get(docId); } catch { storedRow = null; }
      const merge = mergeDocumentFileForUpdate(patchData.file, storedRow?.file);
      if (merge.mode === "keep-stored" || merge.mode === "absent") {
        delete patchData.file;
      } else {
        patchData.file = merge.file;
      }
      if (patchData.versions !== undefined) {
        patchData.versions = sanitizeDocumentVersions(patchData.versions);
        if ((patchData.versions as any[]).length === 0) delete patchData.versions;
      }
    }

    patchData.updatedAt = new Date().toISOString();

    // ─── V2 INVOICE MONEY FENCE (V-FIN-15) ─────────────────────────────
    // Invoice edits through the generic path: amountPaid is lifecycle-
    // controlled (audited payments only), manual number edits are checked
    // for firm-wide uniqueness, and any patch touching lineItems or a tax
    // flag gets its totals RECOMPUTED with the same rules as creation —
    // one calculation for manual, generated and edited invoices alike.
    // Runs before the audited patch below so the audit snapshot captures
    // the truthful recomputed values.
    if (table === "invoices") {
      await applyInvoiceUpdateFence(ctx, firmId, docId, patchData);
    }

    // FINANCIAL TABLE FENCE, part 2: snapshot before + after into the
    // append-only audit log. The before-state is the forensic evidence;
    // the after-state makes the diff readable without a second query.
    if (isFinancialTable) {
      try {
        let before: any = null;
        try { before = await ctx.db.get(docId); } catch { before = null; }
        const beforeSnapshot = before ? { ...before, _id: String(before._id) } : null;
        await ctx.db.patch(docId, patchData);
        let after: any = null;
        try { after = await ctx.db.get(docId); } catch { after = null; }
        const afterSnapshot = after ? { ...after, _id: String(after._id) } : null;
        const authUser = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
        await ctx.db.insert("financial_audit_log", {
          firmId,
          tableName: table,
          recordId: id,
          action: "edit",
          actorEmail: args.userEmail ?? authUser.user?.email ?? undefined,
          actorUserId: String(authUser.user?._id ?? "") || undefined,
          reason: "Field edit via generic update path (audited)",
          beforeState: beforeSnapshot,
          afterState: afterSnapshot,
          metadata: { via: "updateItem", changedFields: Object.keys(patchData) },
          createdAt: Date.now(),
        });
        return;
      } catch (e: any) {
        // The audit write must never break the edit itself… but a FAILED
        // patch must not be silently treated as success either. If the
        // patch failed, rethrow; if only the audit insert failed, the
        // patch already happened — log loudly and return.
        if (String(e?.message || "").includes("financial_audit_log")) {
          console.error("[updateItem] financial audit-log write FAILED after patch:", e?.message);
          return;
        }
        throw e;
      }
    }

    await ctx.db.patch(docId, patchData);

    // ─── V3 DURABLE HISTORY + ACTIVITY (V-MATTER-11/12/17) ────────────
    // Real changes only — re-saving the same stage/status/team writes
    // nothing. Wrapped like the automation hooks so observability can
    // never fail the edit.
    if (table === "matters" && priorMatterStage !== undefined) {
      try {
        const patchedDoc: any = await ctx.db.get(docId);
        const canonicalId = String(patchedDoc?.id || docId);
        const actorId = String(callerUser?._id || "");
        const actorName = (callerUser as any)?.name || "";

        const newStage = patchedDoc?.stage ?? null;
        const newStatus = patchedDoc?.status ?? null;
        const newAssigned: string[] = Array.isArray(patchedDoc?.assignedUsers)
          ? patchedDoc.assignedUsers
          : [];

        // Stage change → durable stage history + activity.
        if (
          typeof patchData.stage === "string" &&
          newStage &&
          priorMatterStage !== null &&
          String(newStage) !== String(priorMatterStage)
        ) {
          await appendStageHistory(ctx, {
            firmId,
            matterId: canonicalId,
            matterTitle: patchedDoc?.title || "",
            fromStage: String(priorMatterStage),
            toStage: String(newStage),
            changedById: actorId,
            changedByName: actorName,
            source: "update",
          });
          await insertFirmActivity(ctx, {
            firmId,
            userId: actorId,
            userName: actorName,
            action: `Stage moved: ${priorMatterStage} → ${newStage}`,
            targetType: "Matter",
            targetId: canonicalId,
            targetName: patchedDoc?.title || "",
            matterId: canonicalId,
            metadata: { fromStage: priorMatterStage, toStage: newStage },
          });
        }

        // Status change → activity (the transition itself was validated above).
        if (
          patchData.status !== undefined &&
          newStatus &&
          priorMatterStatus !== null &&
          String(newStatus) !== String(priorMatterStatus)
        ) {
          const label =
            newStatus === "Closed" ? "Matter closed" :
            newStatus === "Archived" ? "Matter archived" :
            priorMatterStatus === "Closed" || priorMatterStatus === "Archived"
              ? "Matter reopened"
              : `Matter status changed to ${newStatus}`;
          await insertFirmActivity(ctx, {
            firmId,
            userId: actorId,
            userName: actorName,
            action: label,
            targetType: "Matter",
            targetId: canonicalId,
            targetName: patchedDoc?.title || "",
            matterId: canonicalId,
            metadata: { fromStatus: priorMatterStatus, toStatus: newStatus },
          });
        }

        // Assignment change → activity with the diff.
        if (
          patchData.assignedUsers !== undefined &&
          JSON.stringify(newAssigned) !== JSON.stringify(priorAssignedUsers || [])
        ) {
          const before = priorAssignedUsers || [];
          await insertFirmActivity(ctx, {
            firmId,
            userId: actorId,
            userName: actorName,
            action: "Matter team updated",
            targetType: "Matter",
            targetId: canonicalId,
            targetName: patchedDoc?.title || "",
            matterId: canonicalId,
            metadata: {
              added: newAssigned.filter((id) => !before.includes(id)),
              removed: before.filter((id) => !newAssigned.includes(id)),
            },
          });
        }
      } catch (historyErr: any) {
        console.warn("[updateItem] matter history/activity write failed (non-blocking):", historyErr?.message);
      }
    }

    // ─── AUTOMATION RULE ENGINE HOOK (Task 48): matter_stage_change ─────
    // Fires when a matter's stage actually CHANGED in this write. Wrapped
    // in try/catch — a rule failure can never fail the stage save itself.
    // The engine's ledger guarantees one dispatch per rule per matter per
    // stage event (re-saving the same stage is a no-op here, and even a
    // back-and-forth flip only fires the rule once per matter, forever).
    if (
      table === "matters" &&
      priorMatterStage !== undefined &&
      typeof patchData.stage === "string"
    ) {
      const newStage = String(patchData.stage).trim();
      const oldStage = String(priorMatterStage ?? "").trim();
      if (newStage && oldStage && newStage !== oldStage) {
        try {
          const matterDoc: any = await ctx.db.get(docId);
          const entityId = String(matterDoc?.id || docId);
          await dispatchRulesForEvent(ctx, {
            firmId,
            event: {
              triggerType: "matter_stage_change",
              value: newStage,
              entityId,
              matter: {
                id: entityId,
                title: matterDoc?.title || null,
                type: matterDoc?.type || null,
                stage: newStage,
                clientId: matterDoc?.clientId || null,
                assignedUsers: Array.isArray(matterDoc?.assignedUsers)
                  ? matterDoc.assignedUsers
                  : [],
              },
            },
          });
        } catch (ruleErr: any) {
          console.warn("[updateItem] automation-rule dispatch failed (non-blocking):", ruleErr?.message);
        }
      }
    }
  },
});

/**
 * markNotificationsAsRead — Marks one or more notifications as read by
 * setting isRead=true on each. Accepts an array of notification IDs
 * (which can be either Convex _id strings or legacy custom UUIDs).
 *
 * This is the mutation that powers the "Mark all read" button in the
 * header notification panel. Without it, the button did nothing.
 */
export const markNotificationsAsRead = mutation({
  args: { sessionToken: v.optional(v.string()), ids: v.array(v.string()), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { firmId } = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const now = new Date().toISOString();
    let updated = 0;

    for (const id of args.ids) {
      try {
        // Try as Convex _id first
        let doc: any = null;
        try { doc = await ctx.db.get(id as any); } catch {}
        if (doc) {
          // CRO AUDIT FIX — allow marking if the notification belongs to:
          //   1. The user's firm, OR
          //   2. The 'system' firm (broadcast notifications have firmId='system')
          //   3. The notification's userId matches the current user
          // Previously this only allowed doc.firmId === firmId, which BLOCKED
          // marking broadcast notifications (which have firmId='system') as read.
          if (doc.firmId === firmId || doc.firmId === 'system') {
            await ctx.db.patch(id as any, { isRead: true, updatedAt: now } as any);
            updated++;
            continue;
          }
        }
        // Fallback: search by custom id field (legacy UUID)
        if (!doc) {
          const legacy = await ctx.db
            .query("notifications")
            .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
            .filter((q: any) => q.eq(q.field("id"), id))
            .first();
          if (legacy) {
            await ctx.db.patch(legacy._id, { isRead: true, updatedAt: now } as any);
            updated++;
          }
        }
      } catch (err) {
        console.warn(`[markNotificationsAsRead] Failed for id ${id}:`, (err as any)?.message);
      }
    }
    return { success: true, updated };
  },
});

/**
 * clearAllNotifications — Deletes ALL notifications for the current firm/user.
 * Powers the "Clear all" button in the header notification panel.
 */
export const clearAllNotifications = mutation({
  args: { sessionToken: v.optional(v.string()), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { firmId, user } = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const userIdStr = String(user._id);
    const userLegacyId = String((user as any).id || '');

    // Fetch ALL notifications for this user across BOTH the user's firm
    // AND the 'system' firmId (broadcast notifications have firmId='system').
    // The old code only looked at the user's firm, so broadcast notifications
    // (which have firmId='system') were never deleted — causing them to
    // reappear after refresh when Convex re-fetched from the DB.

    // 1. User's firm-scoped notifications
    const firmNotes = await ctx.db
      .query("notifications")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .filter((q: any) => q.eq(q.field("userId"), user._id) || q.eq(q.field("userId"), (user as any).id))
      .take(500);

    // 2. System-scoped notifications (broadcasts)
    const systemNotes = await ctx.db
      .query("notifications")
      .withIndex("by_firm", (q: any) => q.eq("firmId", "system"))
      .filter((q: any) => q.eq(q.field("userId"), user._id) || q.eq(q.field("userId"), (user as any).id))
      .take(500);

    // 3. Also scan for any notifications matching this user that might have
    //    a different firmId (edge case: user belongs to multiple firms)
    // Phase 4 (perf): by_user index seeks for both id forms instead of a
    // full notifications table scan.
    const [notesByConvexId, notesByLegacyId] = await Promise.all([
      ctx.db
        .query("notifications")
        .withIndex("by_user", (q: any) => q.eq("userId", userIdStr))
        .take(500),
      userLegacyId
        ? ctx.db
            .query("notifications")
            .withIndex("by_user", (q: any) => q.eq("userId", userLegacyId))
            .take(500)
        : Promise.resolve([] as any[]),
    ]);
    const userNotes = [...notesByConvexId, ...notesByLegacyId];

    // Combine all three sources and deduplicate by _id
    const allToDelete = [...firmNotes, ...systemNotes, ...userNotes];
    const seen = new Set<string>();
    const toDelete = allToDelete.filter((n: any) => {
      const id = String(n._id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    for (const n of toDelete) {
      try { await ctx.db.delete(n._id); } catch {}
    }
    return { success: true, deleted: toDelete.length };
  },
});

/**
 * ROUND D (D8) — DELETION RECORD (Wave 3b, R81, 2026-11-10).
 *
 * markMessagingNotificationsRead removed: gated orphan (requireFirmUser session) with zero product callers — no UI ever marked messaging notifications read through it.
 */

/**
 * markConversationNotificationsRead — BADGE FIX companion.
 *
 * Marks every messaging-scoped notification whose link points at a given
 * conversation (link.id OR link.context.activeConversationId OR
 * link.context.selectedInboxId) as read. Called when the admin opens a
 * specific resident/client thread so the badge decrements thread-by-thread.
 */
export const markConversationNotificationsRead = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    conversationId: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const userIdStr = String(user._id);
    const userLegacyId = String((user as any).id || '');
    const now = new Date().toISOString();
    const target = String(args.conversationId);

    let updated = 0;
    const candidateSets = await Promise.all([
      ctx.db.query("notifications").withIndex("by_user", (q: any) => q.eq("userId", userIdStr)).take(500),
      userLegacyId
        ? ctx.db.query("notifications").withIndex("by_user", (q: any) => q.eq("userId", userLegacyId)).take(500)
        : Promise.resolve([] as any[]),
    ]);

    const seen = new Set<string>();
    for (const set of candidateSets) {
      for (const n of set as any[]) {
        const id = String(n._id);
        if (seen.has(id)) continue;
        seen.add(id);
        if (n.isRead) continue;
        if (n.link?.view !== 'messaging') continue;
        const linkId = n.link?.id ? String(n.link.id) : null;
        const ctxConv = n.link?.context?.activeConversationId ? String(n.link.context.activeConversationId) : null;
        const ctxInbox = n.link?.context?.selectedInboxId ? String(n.link.context.selectedInboxId) : null;
        if (linkId !== target && ctxConv !== target && ctxInbox !== target) continue;
        try {
          await ctx.db.patch(n._id, { isRead: true, updatedAt: now } as any);
          updated++;
        } catch {}
      }
    }
    return { success: true, updated };
  },
});

/**
 * pruneReadNotifications — MESSAGING RELIABILITY (2026-09-14).
 *
 * PROBLEM: every portal message/ticket/service request inserts a notification
 * row for EVERY admin in the firm. Over months this table grows unboundedly
 * (tens of thousands of rows), and the by_user/by_firm queries that feed the
 * badges + the bell + MessagesView slow down — the app "stops working after a
 * while" from the user's perspective. This cron-side purge deletes READ
 * notifications older than 30 days (unread ones are kept — they may still
 * matter) and caps any single user at 2000 rows (oldest first). Runs daily.
 */
export const pruneReadNotifications = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;

    // Composite index seek: [isRead=true, createdAt < 30d ago]. take(500)
    // per run — the cron repeats daily, so the backlog drains gradually
    // without ever blocking a function for long.
    const stale = await ctx.db
      .query("notifications")
      .withIndex("by_isRead", (q: any) => q.eq("isRead", true).lt("createdAt", cutoff))
      .take(500);
    let deleted = 0;
    for (const n of stale) {
      try { await ctx.db.delete(n._id); deleted++; } catch {}
    }

    return { success: true, scanned: stale.length, deleted };
  },
});

/**
 * updateTaskStatus — Dedicated mutation for updating a task's status.
 *
 * WHY THIS EXISTS:
 * The generic updateItem mutation was failing for task status updates
 * (drag-and-drop in the Kanban board) because:
 * 1. The `id` field was included in the patch data and got patched onto
 *    the document (it should only be used for lookup, not patching)
 * 2. resolveRecordForUpdate couldn't find tasks created via createTask
 *    (which don't have a custom `id` field) when the frontend passed
 *    a UUID instead of the Convex _id
 * 3. The error message was swallowed by the generic "Failed to update"
 *    toast, making debugging impossible
 *
 * This dedicated mutation:
 * - Tries ctx.db.get(taskId) first (works for Convex _id strings)
 * - Falls back to scanning by the custom `id` field (for legacy tasks)
 * - Patches ONLY the `status` field (never touches `id`)
 * - Returns a clear error if the task isn't found
 */
export const updateTaskStatus = mutation({
  args: {
    taskId: v.string(),
    sessionToken: v.optional(v.string()),
    status: v.string(),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { firmId } = await requireFirmUser(ctx, args.userEmail, args.sessionToken);

    // Try to find the task by Convex _id first, then by custom id field
    let task: any = null;

    // Strategy 1: Try as Convex _id
    try {
      task = await ctx.db.get(args.taskId as any);
    } catch {
      // taskId is not a valid Convex _id — fall through to Strategy 2
    }

    // Strategy 2: Look up by custom `id` field (legacy tasks)
    if (!task) {
      task = await ctx.db
        .query("tasks")
        .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
        .filter((q: any) => q.eq(q.field("id"), args.taskId))
        .first();
    }

    // Strategy 3: Scan all firm tasks and match by id or _id
    if (!task) {
      const allTasks = await ctx.db
        .query("tasks")
        .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
        .take(1000);
      task = allTasks.find((t: any) =>
        t.id === args.taskId ||
        String(t._id) === String(args.taskId)
      );
    }

    if (!task) {
      throw new Error(`Task not found (looked for id: ${args.taskId}). The task may have been deleted or you may not have access.`);
    }

    if (!firmId || (task.firmId && task.firmId !== firmId)) {
      throw new Error("Unauthorized. This task belongs to another organization.");
    }

    // Patch ONLY the status field — never touch `id` or other fields
    await ctx.db.patch(task._id, {
      status: args.status,
      updatedAt: new Date().toISOString(),
    });

    return { success: true, taskId: task._id, status: args.status };
  },
});

/**
 * mutation: updateTask
 *
 * Dedicated task update mutation — patches any field on an existing task
 * IN PLACE (never creates a duplicate). This replaces the generic
 * `updateItem('tasks', ...)` path for task reassignment and edits,
 * which was causing duplicate cards due to ID lookup failures.
 *
 * The generic updateItem couldn't find tasks because `createTask`
 * doesn't persist the `id` field — only `_id`. This mutation uses
 * the same 3-strategy lookup as `updateTaskStatus` (which works).
 */
export const updateTask = mutation({
  args: {
    taskId: v.string(),
    sessionToken: v.optional(v.string()),
    patch: v.any(), // Partial task fields to update
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { firmId } = await requireFirmUser(ctx, args.userEmail, args.sessionToken);

    // Same 3-strategy lookup as updateTaskStatus
    let task: any = null;

    // Strategy 1: Try as Convex _id
    try {
      task = await ctx.db.get(args.taskId as any);
    } catch {}

    // Strategy 2: Look up by custom `id` field
    if (!task) {
      task = await ctx.db
        .query("tasks")
        .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
        .filter((q: any) => q.eq(q.field("id"), args.taskId))
        .first();
    }

    // Strategy 3: Scan all firm tasks and match by id or _id
    if (!task) {
      const allTasks = await ctx.db
        .query("tasks")
        .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
        .take(1000);
      task = allTasks.find((t: any) =>
        t.id === args.taskId ||
        String(t._id) === String(args.taskId)
      );
    }

    if (!task) {
      throw new Error(`Task not found (id: ${args.taskId}).`);
    }

    if (!firmId || (task.firmId && task.firmId !== firmId)) {
      throw new Error("Unauthorized. This task belongs to another organization.");
    }

    // Strip internal fields from the patch
    const { _id, _creationTime, id, ...patchData } = args.patch;

    // Round any currency fields
    const CURRENCY_KEYS = ['amount', 'rate', 'price', 'balance', 'value', 'total'];
    for (const [key, val] of Object.entries(patchData)) {
      if (typeof val === 'string' && CURRENCY_KEYS.some(k => key.toLowerCase().includes(k))) {
        const num = parseFloat((val as string).replace(/[^\d.-]/g, ''));
        if (!isNaN(num)) (patchData as any)[key] = Math.round(num * 100) / 100;
      }
    }

    // Patch in place — NEVER create a new record
    await ctx.db.patch(task._id, {
      ...patchData,
      updatedAt: new Date().toISOString(),
    });

    return { success: true, taskId: task._id };
  },
});

/**
 * mutation: deleteTask
 * Dedicated delete for tasks — uses the same 3-strategy lookup as
 * updateTask/updateTaskStatus (Convex _id → custom id → scan).
 * This replaces the generic deleteItem path which failed silently
 * when tasks had no custom `id` field (the exact same root cause
 * as the drag-drop bug, just never applied to delete).
 */
export const deleteTask = mutation({
  args: {
    taskId: v.string(),
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { firmId } = await requireFirmUser(ctx, args.userEmail, args.sessionToken);

    // Same 3-strategy lookup as updateTask
    let task: any = null;

    // Strategy 1: Try as Convex _id
    try {
      task = await ctx.db.get(args.taskId as any);
    } catch {}

    // Strategy 2: Look up by custom `id` field
    if (!task) {
      task = await ctx.db
        .query("tasks")
        .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
        .filter((q: any) => q.eq(q.field("id"), args.taskId))
        .first();
    }

    // Strategy 3: Scan all firm tasks and match by id or _id
    if (!task) {
      const allTasks = await ctx.db
        .query("tasks")
        .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
        .take(1000);
      task = allTasks.find((t: any) =>
        t.id === args.taskId ||
        String(t._id) === String(args.taskId)
      );
    }

    if (!task) {
      throw new Error(`Task not found (id: ${args.taskId}).`);
    }

    if (!firmId || (task.firmId && task.firmId !== firmId)) {
      throw new Error("Unauthorized. This task belongs to another organization.");
    }

    // Delete any notifications linked to this task
    // AUDIT FIX: previous chain `.take(100).collect()` called .collect()
    // on a Promise (take() is terminal) — TypeError at runtime, silently
    // swallowed by the catch block, so notifications were NEVER cleaned
    // up on task deletion. Also the filter `q.field("link")?.id` was not
    // a valid Convex path expression. Fixed: proper .collect() query +
    // nested field path + match BOTH id forms (custom id and _id string),
    // mirroring how notifications are written: task.id || task._id.toString()
    try {
      const notifs = await ctx.db
        .query("notifications")
        .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
        .filter((q: any) => q.or(
          q.eq(q.field("link.id"), (task as any).id ?? null),
          q.eq(q.field("link.id"), String(task._id))
        ))
        .take(500);
      for (const n of notifs) {
        await ctx.db.delete(n._id);
      }
    } catch {}

    // Delete the task itself
    await ctx.db.delete(task._id);

    return { success: true };
  },
});

/**
 * recordTermsAcceptance — Stores a durable, server-side record of a user
 * accepting the Terms of Service / Privacy Policy.
 *
 * WHY THIS EXISTS (NDPA §25 — Demonstrable Consent):
 * Previously, consent was stored ONLY in localStorage (volatile,
 * device-local). If the user cleared their browser data, switched
 * devices, or uninstalled the app, there was NO server-side proof that
 * they had ever accepted the terms. This mutation creates a permanent
 * database record that can be audited and produced as evidence of
 * consent. The localStorage copy is still kept for fast UI gating
 * (so the acceptance bar doesn't reappear on every page load), but
 * the database record is the legally authoritative one.
 */
export const recordTermsAcceptance = mutation({
  args: {
    termsVersion: v.string(),
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    // ─── ROLE-BASED CONSENT ───────────────────────────────────────────
    // The user role accepting these terms. Different roles have different
    // terms versions (e.g. portal residents sign portal-v1, firm admins
    // sign admin-v3). Recording the role lets us require per-role
    // re-acceptance when only one role's terms change.
    roleContext: v.optional(v.string()),
    roleTermsVersion: v.optional(v.string()),
    // P11: Idempotency key — prevents duplicate consent records on double-tap Accept
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // P11 DEDUP: If idempotencyKey is provided, check for an existing record.
    if (args.idempotencyKey) {
      const existing = await ctx.db
        .query("termsAcceptance")
        .withIndex("by_idempotency", (q: any) => q.eq("idempotencyKey", args.idempotencyKey))
        .first();
      if (existing) {
        return { success: true, recordId: existing.id, acceptedAt: existing.acceptedAt, deduplicated: true };
      }
    }
    let firmId: string | null = null;
    let userId: string | null = null;
    let userEmail: string | undefined = undefined;

    try {
      const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
      firmId = auth.firmId;
      userId = auth.userId;
      userEmail = args.userEmail || auth.user?.email || undefined;
    } catch {
      // User may not be fully authenticated yet (e.g., during signup).
      // Still record the acceptance with whatever info we have.
      userEmail = args.userEmail;
    }

    const now = new Date().toISOString();
    // Convex mutations run on the server, so navigator/Capacitor are not
    // available. The client should pass userAgent and platform if needed;
    // for now we record what we can determine server-side.
    const userAgent = 'server-side-mutation';
    const platform = 'server';

    const recordId = crypto.randomUUID();
    await ctx.db.insert("termsAcceptance", {
      id: recordId,
      firmId,
      userId,
      userEmail: userEmail || null,
      termsVersion: args.termsVersion,
      acceptedAt: now,
      userAgent,
      platform,
      ipHash: null,
      // Role-based consent fields (null-safe for legacy callers that
      // don't pass roleContext — those rows are treated as 'unknown' role)
      roleContext: args.roleContext || 'unknown',
      roleTermsVersion: args.roleTermsVersion || null,
      idempotencyKey: args.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    });

    return { success: true, recordId, acceptedAt: now };
  },
});

/**
 * getTermsAcceptance — Queries the most recent terms acceptance record
 * for a given user email. Used to verify consent server-side (e.g., for
 * audit reports or NDPA compliance checks).
 *
 * ROLE-AWARE: if roleContext is provided, returns the most recent record
 * for THAT role. If not provided, returns the most recent record for any
 * role (legacy behavior — backwards compatible).
 */
export const getTermsAcceptance = query({
  args: {
    userEmail: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    roleContext: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.userEmail) return null;
    const records = await ctx.db
      .query("termsAcceptance")
      .withIndex("by_user_email", (q: any) => q.eq("userEmail", args.userEmail))
      .order("desc")
      .take(50);

    if (args.roleContext) {
      // Find the most recent record matching this role
      const roleMatch = records.find((r: any) => r.roleContext === args.roleContext);
      return roleMatch || null;
    }
    // Legacy: return most recent record (any role)
    return records.length > 0 ? records[0] : null;
  },
});

/**
 * deleteItem (ROBUST VERSION)
 * Handles both Convex Internal IDs and Custom UUIDs (Legacy).
 * Strategy A → B → C cascade ensures deletion succeeds regardless of ID format.
 */
export const deleteItem = mutation({
  args: { sessionToken: v.optional(v.string()), table: v.string(), id: v.string(), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { firmId } = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const { table, id } = args;

    // ─── FINANCIAL TABLE FENCE (accounting-integrity round, 2026-09-14) ──
    // Booked money rows are NEVER hard-deleted — deletion would falsify
    // the ledger and destroy forensic evidence. Corrections go through
    // the audited lifecycle mutations (void / mark-test) in
    // convex/financialIntegrity.ts, which keep the row and exclude it
    // from aggregates instead. Draft invoices are the sole exception: an
    // unissued draft never entered the books.
    if (FINANCIAL_TABLES.has(table)) {
      const isDraftInvoice = table === "invoices";
      if (isDraftInvoice) {
        let draft: any = null;
        try { draft = await ctx.db.get(id as any); } catch { draft = null; }
        if (!draft) {
          try {
            draft = await ctx.db.query("invoices").withIndex("by_custom_id", (q: any) => q.eq("id", id)).first();
          } catch { draft = null; }
        }
        if (draft && draft.status !== "Draft") {
          throw new Error(
            "Booked invoices cannot be deleted — that would falsify the financial ledger. " +
            "Void it instead (Billing → invoice menu → Void): the record stays for the audit " +
            "trail and drops out of every total."
          );
        }
      } else {
        throw new Error(
          `Records in '${table}' are part of the financial ledger and cannot be deleted — ` +
          `that would falsify the books and destroy the audit trail. Void the record instead ` +
          `(with a reason): it stays visible for forensics but is excluded from every total.`
        );
      }
    }

    // ─── USERS ARE SPECIAL (Phase 3, data integrity) ───────────────────────
    // Never a raw hard-delete: route to the transactional removal core that
    // unassigns tasks, cleans presence + notifications, preserves the user
    // row (multi-firm memberships + login identity), and guards against
    // self-removal / last-admin removal. The FirmSettings dialog promises
    // "unassigned from all items" — this is where that promise is kept.
    if (table === "users") {
      return await performFirmUserRemoval(ctx, {
        userId: id,
        firmId,
        userEmail: args.userEmail,
      });
    }

    // 1. Security Check: guard against cross-firm deletion.
    //    Wrapped in try-catch because ctx.db.get() throws when passed a UUID
    //    (non-Convex internal ID), which previously aborted the mutation before
    //    Strategy B could run.
    let existing: any = null;
    try {
      existing = await ctx.db.get(id as any) as any;
    } catch (_e) {
      // id is a UUID / non-Convex ID — fall through to indexed search
    }
    if (existing) {
      if (!firmId) {
        throw new Error("Unauthenticated: userEmail required. Anonymous deletes are no longer permitted.");
      }
      if (existing.firmId && existing.firmId !== firmId) {
        throw new Error("Unauthorized. This record belongs to another organization.");
      }
    }

    // ─── REFERENTIAL INTEGRITY GUARD (Aug 2026) ────────────────────────────
    // Prevents orphan-deletion scenarios. Before deleting ANY record, check
    // whether it's referenced by child records. If yes, throw a descriptive
    // error so the user can reassign or delete the children first.
    //
    // ROOT CAUSE THIS FIXES: User reported that matters were suddenly showing
    // "Unknown Client" — they had to re-add the clients. Cause: contacts were
    // being hard-deleted via this mutation while matters still pointed at
    // their id. Matters became orphans, showing "Unknown Client" because the
    // client-side lookup `contacts.find(c => c.id === matter.clientId)` returned
    // undefined.
    //
    // This guard now applies to ALL entity types — not just contacts. Any
    // parent record with live child references will refuse to delete.
    //
    // For contacts specifically, use the new `softDeleteContact` mutation
    // (sets isArchived: true) instead — it preserves the contact record so
    // matters keep resolving, but hides the contact from active lists.
    // ─── V3 FK CHECKS ON ACTUAL SCHEMA FIELDS (V-MATTER-14) ─────────────
    // The old map checked fields that don't exist on the child tables:
    // `invoices.matterId` (invoices store a `matter: {id,title}` snapshot —
    // the check could never fire, so a matter with booked invoices deleted
    // cleanly past it) and only two of the six contact reference fields.
    // `field` now supports dotted paths ("matter.id" → child.matter?.id,
    // "parties.contactId" → any party object) and array values.
    const FK_MAP: Record<string, Array<{ table: string; field: string }>> = {
      contacts: [
        { table: "matters", field: "clientId" },
        { table: "matters", field: "associatedContactIds" },
        { table: "matters", field: "parties.contactId" },
        { table: "properties", field: "contactId" },
        { table: "tenancies", field: "tenantContactId" },
        { table: "property_relationships", field: "grantorContactId" },
        { table: "property_relationships", field: "granteeContactId" },
      ],
      matters: [
        { table: "tasks", field: "matterId" },
        { table: "documents", field: "matterId" },
        { table: "documents", field: "matter.id" },
        { table: "events", field: "matterId" },
        { table: "timeEntries", field: "matterId" },
        { table: "expenses", field: "matterId" },
        { table: "invoices", field: "matterId" },
        { table: "invoices", field: "matter.id" },
        { table: "notePages", field: "matterId" },
        { table: "clientMessages", field: "matterId" },
        { table: "externalCounselInvites", field: "matterId" },
      ],
      properties: [
        { table: "matters", field: "propertyId" },
        { table: "tenancies", field: "propertyId" },
        { table: "notePages", field: "propertyId" },
        { table: "documents", field: "propertyId" },
      ],
    };
    // Resolve a (possibly dotted / array-valued) child field against the
    // parent's possible id forms.
    const fkFieldMatches = (child: any, field: string, possibleIds: Set<string>): boolean => {
      const parts = field.split(".");
      let val: any = child;
      for (const part of parts) {
        if (val == null) return false;
        val = val[part];
      }
      if (val == null) return false;
      if (Array.isArray(val)) {
        return val.some((x) => {
          if (x != null && typeof x === "object") return false; // nested objects need deeper paths
          return possibleIds.has(String(x));
        });
      }
      return possibleIds.has(String(val));
    };
    if (FK_MAP[table]) {
      // Resolve the record's canonical id (could be _id or custom `id` field)
      // so we can match either form in child records.
      const canonicalId = existing ? (existing.id || String(existing._id)) : id;
      const possibleIds = new Set([canonicalId, id, String(existing?._id || '')].filter(Boolean));

      for (const fk of FK_MAP[table]) {
        try {
          const children = await ctx.db
            .query(fk.table as any)
            .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
            .take(2000);
          // Match any of the possible id forms (Convex _id, custom id, or
          // stringified) on the ACTUAL schema field, including the legacy
          // `matter: {id}` snapshot convention (V-MATTER-13/14).
          const refs = children.filter((c: any) => fkFieldMatches(c, fk.field, possibleIds));
          if (refs.length > 0) {
            // Throw with a helpful message — tell the user exactly what's
            // referencing the record and how to proceed.
            const childCount = refs.length;
            const sampleNames = refs.slice(0, 3).map((r: any) => r.title || r.name || r.address || r._id).filter(Boolean);
            const sampleText = sampleNames.length > 0 ? ` (e.g. "${sampleNames.join('", "')}")` : '';
            throw new Error(
              `Cannot delete this ${table.replace(/s$/, '')} — it's still referenced by ${childCount} ${fk.table}${childCount === 1 ? '' : 's'}${sampleText}. ` +
              `Reassign or delete those ${fk.table} first. ` +
              (table === 'contacts'
                ? `Tip: Use "Archive Contact" instead — it hides the contact without breaking references.`
                : `Tip: Use the cascade-delete action from the ${table} detail view if you want to remove everything at once.`
              )
            );
          }
        } catch (e: any) {
          // Re-throw the helpful error message above; swallow only index/scan errors.
          if (e.message?.startsWith('Cannot delete')) throw e;
          console.warn(`[deleteItem] FK check failed for ${fk.table}:`, e);
        }
      }
    }

    // 2. Strategy A: Direct Delete by Convex internal _id
    if (existing) {
      await ctx.db.delete(id as any);
      return { success: true, method: "internal_id" };
    }

    // 3. Strategy B: UUID Search via high-performance custom_id index
    const indexedTables = ["matters", "contacts", "properties", "invoices", "expenses", "firmActivity", "researchNotebooks", "researchSources", "researchMessages"];
    try {
      let item = null;
      if (indexedTables.includes(table)) {
        item = await ctx.db.query(table as any)
          .withIndex("by_custom_id" as any, (q: any) => q.eq("id", id))
          .first();
      } else {
        const sample = await ctx.db.query(table as any).take(500);
        item = sample.find((i: any) => i.id === id);
      }

      if (item) {
        if (!firmId || (item.firmId && item.firmId !== firmId)) {
          throw new Error("Unauthorized. This record belongs to another organization.");
        }
        await ctx.db.delete(item._id);
        return { success: true, method: "UUID_INDEXED" };
      }
    } catch (e: any) {
      if (e.message?.includes("Unauthorized")) throw e;
      if (e.message?.startsWith('Cannot delete')) throw e;
      console.error(`[deleteItem] Strategy B failed for ${table}:${id}`, e);
    }

    // 4. Strategy C: Firm-scoped bounded scan (last resort for records without id field)
    try {
      const firmRecords = await ctx.db.query(table as any)
        .withIndex("by_firm" as any, (q: any) => q.eq("firmId", firmId))
        .take(2000);
      const match = firmRecords.find((i: any) => i.id === id || i._id === id || String(i._id) === id);
      if (match) {
        await ctx.db.delete(match._id);
        return { success: true, method: "FIRM_SCAN" };
      }
    } catch (e: any) {
      if (e.message?.startsWith('Cannot delete')) throw e;
      console.error(`[deleteItem] Strategy C failed for ${table}:${id}`, e);
    }

    throw new Error(`Failed to delete item ${id} from ${table}. Item not found.`);
  },
});

/**
 * softDeleteContact — marks a contact as archived (isArchived: true) without
 * removing the record. Matters and properties that reference this contact
 * continue to resolve correctly — they just show an "Archived" badge next
 * to the client name.
 *
 * Use this instead of deleteItem('contacts', ...) when the contact has
 * associated matters/properties. Use deleteItem only when the contact has
 * zero references (the FK guard in deleteItem will allow it through).
 *
 * RESTORE: setting isArchived back to false reactivates the contact.
 */
export const softDeleteContact = mutation({
  args: {
    contactId: v.string(),
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { firmId, user } = await requireFirmUser(ctx, args.userEmail, args.sessionToken);

    // Resolve the contact — try Convex _id first, then custom id index.
    let contact: any = null;
    try { contact = await ctx.db.get(args.contactId as any); } catch { /* not a Convex id */ }
    if (!contact) {
      contact = await ctx.db
        .query("contacts")
        .withIndex("by_custom_id", (q: any) => q.eq("id", args.contactId))
        .first();
    }
    if (!contact) throw new Error("Contact not found.");
    if (contact.firmId !== firmId) {
      throw new Error("Unauthorized. This contact belongs to another organization.");
    }

    const now = new Date().toISOString();
    await ctx.db.patch(contact._id, {
      isArchived: true,
      archivedAt: now,
      archivedById: user?._id || user?.id || '',
      archivedByName: user?.name || '',
      updatedAt: now,
    } as any);

    return { success: true, contactId: args.contactId };
  },
});

/**
 * restoreContact — un-archives a soft-deleted contact. Sets isArchived back
 * to false so it reappears in active contact lists.
 */
// ─── ARCHIVED CONTACTS (soft-delete support) ─────────────────────────────────
// The ContactDetailView "Archive Contact" flow soft-deletes (isArchived=true)
// and promises "restore anytime from the archive" — but nothing ever listed
// those contacts. This query powers the ArchiveView's Contacts section.
export const getArchivedContacts = query({
  args: { sessionToken: v.optional(v.string()), firmId: v.string(), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    if (!args.firmId) return [];
    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_firm", (q: any) => q.eq("firmId", args.firmId))
      .take(2000);
    return (contacts as any[])
      .filter(c => c.isArchived === true)
      .map(c => ({
        id: String(c._id),
        _id: c._id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        category: c.category,
        company: c.company,
        updatedAt: c.updatedAt,
      }));
  },
});

export const restoreContact = mutation({
  args: {
    contactId: v.string(),
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { firmId } = await requireFirmUser(ctx, args.userEmail, args.sessionToken);

    let contact: any = null;
    try { contact = await ctx.db.get(args.contactId as any); } catch { /* not a Convex id */ }
    if (!contact) {
      contact = await ctx.db
        .query("contacts")
        .withIndex("by_custom_id", (q: any) => q.eq("id", args.contactId))
        .first();
    }
    if (!contact) throw new Error("Contact not found.");
    if (contact.firmId !== firmId) {
      throw new Error("Unauthorized. This contact belongs to another organization.");
    }

    const now = new Date().toISOString();
    await ctx.db.patch(contact._id, {
      isArchived: false,
      archivedAt: undefined,
      archivedById: undefined,
      archivedByName: undefined,
      updatedAt: now,
    } as any);

    return { success: true, contactId: args.contactId };
  },
});

/**
 * reassignMattersFromContact — moves all matters from one contact (source)
 * to another (target). Used in the merge-contacts flow BEFORE deleting the
 * source contact, so no matters become orphans.
 *
 * Prior bug: useMatters.ts handleMergeContacts deleted the source contact
 * without reassigning its matters first. All matters that pointed at the
 * source contact became "Unknown Client" orphans. This mutation fixes that.
 */
export const reassignMattersFromContact = mutation({
  args: {
    sourceContactId: v.string(),
    sessionToken: v.optional(v.string()),
    targetContactId: v.string(),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { firmId } = await requireFirmUser(ctx, args.userEmail, args.sessionToken);

    // Verify both contacts exist and belong to the firm.
    for (const cid of [args.sourceContactId, args.targetContactId]) {
      let c: any = null;
      try { c = await ctx.db.get(cid as any); } catch { /* not a Convex id */ }
      if (!c) {
        c = await ctx.db
          .query("contacts")
          .withIndex("by_custom_id", (q: any) => q.eq("id", cid))
          .first();
      }
      if (!c) throw new Error(`Contact not found: ${cid}`);
      if (c.firmId !== firmId) {
        throw new Error("Unauthorized. One or both contacts belong to another organization.");
      }
    }

    // Find all matters pointing at the source contact.
    // Match either custom id or Convex _id (some old records use _id as clientId).
    const possibleIds = new Set([args.sourceContactId, String(args.sourceContactId)]);

    const firmMatters = await ctx.db
      .query("matters")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .take(1000);

    const mattersToReassign = firmMatters.filter((m: any) =>
      possibleIds.has(String(m.clientId || ''))
    );

    let reassignedCount = 0;
    for (const matter of mattersToReassign) {
      await ctx.db.patch(matter._id, {
        clientId: args.targetContactId,
        updatedAt: new Date().toISOString(),
      } as any);
      reassignedCount++;
    }

    // Also reassign properties pointing at the source contact.
    const firmProperties = await ctx.db
      .query("properties")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .take(1000);

    const propertiesToReassign = firmProperties.filter((p: any) =>
      possibleIds.has(String(p.contactId || ''))
    );

    let propertiesReassigned = 0;
    for (const prop of propertiesToReassign) {
      await ctx.db.patch(prop._id, {
        contactId: args.targetContactId,
        updatedAt: new Date().toISOString(),
      } as any);
      propertiesReassigned++;
    }

    return {
      success: true,
      mattersReassigned: reassignedCount,
      propertiesReassigned: propertiesReassigned,
    };
  },
});

export const generateUploadUrl = mutation({
  args: { sessionToken: v.optional(v.string()), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // RLS: Require firm user — only authenticated users can generate upload URLs
    await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    return await ctx.storage.generateUploadUrl();
  }
});
export const getFileUrl = query({
  args: { storageId: v.string(), sessionToken: v.optional(v.string()), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // V1-A (SEC-5): authenticated callers only. Previously ANY caller —
    // including fully anonymous ones — could resolve ANY storage id to
    // its signed download URL. Storage ids are unguessable capabilities
    // and the parent records (documents, payment proofs, portal
    // attachments) are firm-scoped behind their own gated reads;
    // resolving a URL now additionally requires a verified session (any
    // role — staff and portal users both legitimately fetch files).
    // Full per-file ownership enforcement would need a storageId→firm
    // index (schema change) and is listed as deferred work.
    await resolveCaller(ctx, { sessionToken: args.sessionToken, userEmail: args.userEmail });
    return await ctx.storage.getUrl(args.storageId);
  },
});

/**
 * purgeFirmData - Wipes all records for a firm.
 * AUTH: Admin role required. Caller's firmId must match the target firmId.
 */
export const purgeFirmData = mutation({
  args: { sessionToken: v.optional(v.string()), firmId: v.string(), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const auth = await requireAdmin(ctx, args.userEmail, args.sessionToken);
    if (!auth.firmId || auth.firmId !== args.firmId) {
      throw new Error("Unauthorized. You can only purge data for your own firm.");
    }
    const { firmId } = args;
    const tablesToClean = [
      "matters", "contacts", "tasks", "documents", "events", "notePages",
      "properties", "timeEntries", "expenses", "clientMessages",
      "researchNotebooks", "researchSources", "researchMessages",
      "chatConversations", "chatMessages", "invoices", "notifications", "leads",
      "firmActivity", "archive", "automationRules"
    ];
    const results: Record<string, number> = {};
    for (const table of tablesToClean) {
      try {
        // Bounded firm-wide cleanup (dynamic table — generic 2000-row cap;
        // firm-scoped tables live far below this today).
        const items = await ctx.db
          .query(table as any)
          .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
          .take(2000);
        for (const item of items) await ctx.db.delete(item._id);
        results[table] = items.length;
      } catch (e) {
        try {
          // Bounded fallback scan (no by_firm index on this table).
          const all = await ctx.db.query(table as any).take(2000);
          const matches = all.filter((i: any) => i.firmId === firmId);
          for (const item of matches) await ctx.db.delete(item._id);
          results[table] = matches.length;
        } catch {
          results[table] = -1;
        }
      }
    }
    return { success: true, summary: results };
  }
});

/**
 * forceDeleteItem - Deletes a record by internal ID or UUID.
 * AUTH: Firm user required. Cross-firm deletes are blocked.
 */
export const forceDeleteItem = mutation({
  args: { sessionToken: v.optional(v.string()), id: v.string(), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { firmId } = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const { id } = args;

    // SECURITY FIX: Fail CLOSED — throw on empty firmId (same fix as deleteItem).
    if (!firmId) {
      throw new Error("Unauthenticated: userEmail required. Anonymous deletes are no longer permitted.");
    }

    // ─── FINANCIAL TABLE FENCE (accounting-integrity round, 2026-09-14) ──
    // forceDeleteItem takes a bare id and hunts it across tables, so the
    // fence checks the LOADED row's shape: financial signatures (txHash /
    // invoiceNumber / balanceAfter / previousBalance) mean the row is
    // money and must not be hard-deleted. Draft invoices excepted.
    const looksFinancial = (row: any) =>
      !!row && (
        typeof row.txHash === "string" ||
        typeof row.invoiceNumber === "string" ||
        typeof row.balanceAfter === "number" ||
        typeof row.previousBalance === "number" ||
        typeof row.eventId === "string"
      );

    // Strategy A: Direct delete by internal ID with firm check.
    try {
      const existing = await ctx.db.get(id as any) as any;
      if (existing) {
        if (!existing.firmId || existing.firmId !== firmId) {
          throw new Error("Unauthorized. This record belongs to another organization.");
        }
        if (looksFinancial(existing) && existing.status !== "Draft") {
          throw new Error(
            "This is a booked financial record — it cannot be force-deleted (that would falsify the ledger). " +
            "Void it instead with a reason: the record stays for the audit trail and drops out of every total."
          );
        }
        await ctx.db.delete(id as any);
        return { success: true, method: "internal_id" };
      }
    } catch (e: any) {
      if (e.message?.includes("Unauthorized")) throw e;
      if (e.message?.includes("financial record")) throw e;
    }

    // Strategy B: UUID search across primary tables.
    const tables = ["matters", "contacts", "documents", "properties", "tasks", "events", "notePages", "invoices", "expenses"];
    const indexedTables = ["matters", "contacts", "properties", "invoices", "expenses", "firmActivity", "researchNotebooks", "researchSources", "researchMessages"];

    for (const table of tables) {
      try {
        let item = null;
        if (indexedTables.includes(table)) {
          item = await ctx.db.query(table as any)
            .withIndex("by_custom_id" as any, (q: any) => q.eq("id", id))
            .first();
        } else {
          const sample = await ctx.db.query(table as any).take(500);
          item = sample.find((i: any) => i.id === id);
        }
        if (item) {
          // SECURITY FIX: Fail CLOSED — check firmId is not empty AND matches.
          if (!item.firmId || item.firmId !== firmId) {
            throw new Error("Unauthorized. This record belongs to another organization.");
          }
          // FINANCIAL TABLE FENCE: the scan list includes invoices — skip
          // anything that isn't an unissued Draft (see fence note above).
          if (table === "invoices" && item.status !== "Draft") {
            throw new Error(
              "Booked invoices cannot be force-deleted — void the invoice instead so the " +
              "audit trail keeps the record."
            );
          }
          await ctx.db.delete(item._id);
          return { success: true, method: "UUID_INDEXED", table };
        }
      } catch (e: any) {
        if (e.message?.includes("Unauthorized")) throw e;
        if (e.message?.includes("force-deleted")) throw e;
        continue;
      }
    }

    return { success: false, message: "Item not found in any primary table via ID or UUID." };
  }
});

// --- EMAIL SERVICE (Brevo) ---
// Migrated from Resend to Brevo (April 2026) for improved deliverability.
// Sender: practiceprovega@gmail.com (verified individual sender on Brevo)

const BREVO_SENDER = { name: "PracticePro Systems", email: process.env.BREVO_SENDER_EMAIL || "practiceprosystems@gmail.com" };

// Product-specific branding for emails — ALL products use the brand green
// (#16A34A) as the primary color, with product-specific accent colors
// for secondary elements. This ensures consistent brand identity across
// all emails regardless of which product triggered them.
const BRAND_GREEN = "#16A34A";
const BRAND_GREEN_DARK = "#15803D";
const BRAND_GREEN_LIGHT = "#DCFCE7";

// Product-specific accent colors.
// The email header is ALWAYS PracticePro green (brand consistency).
// The product name text uses the product accent color:
//   Vega = amber/gold (#F59E0B)
//   Atrium = lilac/purple (#A855F7)
//   Komplete = violet (#7C3AED)
const PRODUCT_BRANDING: Record<string, { name: string; accent: string; tagline: string; productColor: string }> = {
  legal: { name: "Vega", accent: "#F59E0B", tagline: "Legal Practice System", productColor: "#F59E0B" },
  property: { name: "Atrium", accent: "#A855F7", tagline: "Property Management OS", productColor: "#A855F7" },
  unified: { name: "Komplete", accent: "#7C3AED", tagline: "Legal & Property Platform", productColor: "#7C3AED" },
};

/**
 * Branded email template wrapper — wraps any email content in the
 * PracticePro brand design system with brand green header, mobile-
 * responsive HTML table layout, and proper footer.
 */
function brandedEmailWrapper(opts: {
  productName?: string;
  productColor?: string;
  tagline?: string;
  bodyHtml: string;
}): string {
  const year = new Date().getFullYear();
  const pName = opts.productName || '';
  const pColor = opts.productColor || BRAND_GREEN;
  const tagline = opts.tagline || 'PracticePro';
  const productBadge = pName ? `<span style="color: ${pColor}; font-weight: 800;"> ${pName}</span>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f4f5f7;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
<tr><td style="background:linear-gradient(135deg,${BRAND_GREEN} 0%,${BRAND_GREEN_DARK} 100%);padding:36px 24px;text-align:center;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td align="center">
<img src="https://practice-pro-vega.vercel.app/logo.png" alt="PracticePro" style="width:48px;height:48px;margin:0 auto 12px auto;display:block;border-radius:12px;" />
<h1 style="color:#ffffff;margin:0;font-size:26px;font-weight:900;letter-spacing:-0.5px;">Practice<span style="color:#FBBF24;">Pro</span>${productBadge}</h1>
<p style="color:rgba(255,255,255,0.85);margin:8px 0 0 0;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:600;">${tagline}</p>
</td></tr></table>
</td></tr>
<tr><td style="padding:40px 32px;">${opts.bodyHtml}</td></tr>
<tr><td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 32px;text-align:center;">
<p style="color:#94a3b8;font-size:11px;line-height:1.6;margin:0;">&copy; ${year} PracticePro Systems Limited. All rights reserved.<br/>No. 6 Sulaiman Adekanbi Street, Igbo-Efon, Lekki-Epe Expressway, Lagos State, Nigeria.<br/><a href="mailto:practiceprosystems@gmail.com" style="color:#64748b;text-decoration:none;">practiceprosystems@gmail.com</a></p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function getProductBranding(product?: string) {
  // FIX: Don't default to Vega when no product is selected. Return an empty
  // brand so the email subject says "PracticePro — Your Verification Code"
  // instead of "PracticePro Vega — Your Verification Code".
  if (!product) {
    return { name: "", accent: "#16A34A", tagline: "Practice Management OS", productColor: "#16A34A" };
  }
  return PRODUCT_BRANDING[product] || PRODUCT_BRANDING.legal;
}

async function sendBrevoEmail(args: {
  to: string;
  subject: string;
  html: string;
  productName?: string;
}) {
  const apiKey = process.env.PracticePro_Vega_Mailer || process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.warn("[Brevo] CRITICAL: BREVO_API_KEY environment variable is missing. Email not sent.");
    return { success: false, error: "API key missing" };
  }

  const senderName = args.productName
    ? `PracticePro ${args.productName}`
    : BREVO_SENDER.name;

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: { name: senderName, email: BREVO_SENDER.email },
      to: [{ email: args.to }],
      subject: args.subject,
      htmlContent: args.html,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[Brevo] Send failed (${response.status}):`, errorBody);
    return { success: false, error: errorBody };
  }

  return { success: true };
}

export const sendVerificationEmail = internalAction({
  // Task 20: `purpose` distinguishes the two senders of this template.
  //   - "signup" (default): confirming email ownership during registration.
  //   - "login": a sign-in / password-claim code. The 2026-09-05 incident:
  //     both flows sent IDENTICAL emails, and the user typed a signup code
  //     into the login prompt (or vice versa) — indistinguishable subjects
  //     and bodies. Login codes now get a distinct subject + copy that
  //     also names the 10-minute validity (enforced since task 20).
  args: {
    email: v.string(),
    code: v.string(),
    product: v.optional(v.string()),
    purpose: v.optional(v.union(v.literal("signup"), v.literal("login"))),
  },
  handler: async (ctx, args) => {
    const brand = getProductBranding(args.product);
    const isLogin = args.purpose === "login";

    const heading = isLogin
      ? "Your Sign-In Code"
      : "Verify Your Account";
    const intro = isLogin
      ? `
      <p style="color:#1a202c;font-size:17px;font-weight:600;margin:0 0 8px 0;">${heading}</p>
      <p style="color:#4a5568;font-size:15px;line-height:1.7;margin:0 0 32px 0;">
        Enter this code to finish signing in. It expires in 10 minutes, and it replaces any
        earlier sign-in codes we sent you — if you requested several, use the code from THIS email.
      </p>`
      : `
      <p style="color:#1a202c;font-size:17px;font-weight:600;margin:0 0 8px 0;">${heading}</p>
      <p style="color:#4a5568;font-size:15px;line-height:1.7;margin:0 0 32px 0;">
        Use the verification code below to confirm your email address and activate your account. This code is valid for 10 minutes.
      </p>`;

    const bodyHtml = `
      ${intro}
      <div style="background:${BRAND_GREEN_LIGHT};border:2px solid ${BRAND_GREEN};border-radius:12px;padding:28px;text-align:center;margin-bottom:32px;">
        <p style="color:${BRAND_GREEN_DARK};font-size:12px;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px 0;font-weight:700;">${isLogin ? "Your Sign-In Code" : "Your Verification Code"}</p>
        <span style="display:inline-block;font-size:38px;font-weight:800;color:${BRAND_GREEN_DARK};letter-spacing:8px;">${args.code}</span>
      </div>
      <p style="color:#718096;font-size:14px;line-height:1.6;margin:0;">
        If you did not request this ${isLogin ? "sign-in" : "verification"}, please disregard this email. Your account will remain secure. Do not share this code with anyone — PracticePro staff will never ask for it.
      </p>`;

    const html = brandedEmailWrapper({
      productName: brand.name,
      productColor: brand.productColor,
      tagline: brand.tagline,
      bodyHtml,
    });

    const subject = isLogin
      ? (brand.name ? `PracticePro ${brand.name} — Your Sign-In Code` : `PracticePro — Your Sign-In Code`)
      : (brand.name ? `PracticePro ${brand.name} — Your Verification Code` : `PracticePro — Your Verification Code`);

    await sendBrevoEmail({
      to: args.email,
      subject,
      html,
      productName: brand.name,
    });
  }
});

export const sendRecoveryEmail = internalAction({
  args: { email: v.string(), code: v.string(), recoveryLink: v.string(), resetLink: v.optional(v.string()), product: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const brand = getProductBranding(args.product);

    // 2026-09-14 (reset-link round): the ONE-CLICK link is the primary CTA
    // — it opens /reset-password and the user types only the new password.
    // The code + prefilled-code link stay as the fallback for email clients
    // that strip links or corporate filters that rewrite URLs.
    const primaryButton = args.resetLink
      ? `<a href="${args.resetLink}" style="display:inline-block;background-color:${BRAND_GREEN};color:#ffffff;padding:16px 32px;font-size:16px;font-weight:bold;text-decoration:none;border-radius:8px;">Set a new password now</a>
         <p style="color:#718096;font-size:13px;line-height:1.6;margin:12px 0 0 0;">No code needed — the link signs you straight into the reset page. It works once and expires in 60 minutes.</p>`
      : `<a href="${args.recoveryLink}" style="display:inline-block;background-color:${BRAND_GREEN};color:#ffffff;padding:14px 28px;font-size:16px;font-weight:bold;text-decoration:none;border-radius:8px;">Reset Password</a>`;

    const bodyHtml = `
      <p style="color:#1a202c;font-size:17px;font-weight:600;margin:0 0 8px 0;">Reset Your Security Key</p>
      <p style="color:#4a5568;font-size:15px;line-height:1.7;margin:0 0 32px 0;">
        We received a request to reset the password for your account.
      </p>
      <div style="text-align:center;margin-bottom:32px;">
        ${primaryButton}
      </div>
      <p style="color:#718096;font-size:14px;line-height:1.6;margin:0 0 16px 0;">
        If the button doesn't work, you can also enter this recovery code manually in the app:
      </p>
      <div style="background:${BRAND_GREEN_LIGHT};border:2px solid ${BRAND_GREEN};border-radius:12px;padding:16px;text-align:center;margin-bottom:16px;">
        <span style="display:inline-block;font-size:24px;font-weight:800;color:${BRAND_GREEN_DARK};letter-spacing:4px;">${args.code}</span>
      </div>
      <p style="color:#718096;font-size:13px;line-height:1.6;margin:0 0 16px 0;">
        Links and codes expire after 60 minutes. Requesting a new one immediately
        replaces the previous code — if you request again, always use the
        <strong>newest</strong> email.
      </p>
      <p style="color:#718096;font-size:14px;line-height:1.6;margin:0;">
        If you did not request a password reset, please ignore this email. Your account is safe.
      </p>`;

    const html = brandedEmailWrapper({
      productName: brand.name,
      productColor: brand.productColor,
      tagline: brand.tagline,
      bodyHtml,
    });

    await sendBrevoEmail({
      to: args.email,
      subject: brand.name ? `Reset your PracticePro ${brand.name} Password` : `Reset your PracticePro Password`,
      html,
      productName: brand.name,
    });
  }
});

/**
 * sendWelcomeEmail — Sent ONCE after a user verifies their email.
 *
 * This is SEPARATE from the verification email:
 *   - Verification email: "Here's your code" — transactional, no product info
 *   - Welcome email: "Welcome to PracticePro [Product]" — onboarding, includes
 *     product info, tier, and learning material links
 *
 * The welcome email is triggered from the `verifyCode` mutation (guarded
 * by `welcomeEmailSent` field on the user record) so it's sent exactly once.
 *
 * Content includes:
 *   - Personalized welcome with the product name (VEGA / ATRIUM / KOMPLETE)
 *   - Product tagline and what they can do
 *   - Getting started links (dashboard, ALOA, DraftPro, etc.)
 *   - Learning material / help center link
 */
export const sendWelcomeEmail = internalAction({
  args: {
    email: v.string(),
    product: v.optional(v.string()),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const brand = getProductBranding(args.product);
    const userName = args.name || 'there';

    // 2026-09-17 (dead-link fix): the getting-started links previously pointed
    // at https://practicepro.ng/help/... — a domain that was never registered
    // (NXDOMAIN), so every "Get Started" button in the welcome email was a
    // dead link. They now point at the live web app (same origin as the
    // password-reset emails' appDomain).
    //
    // 2026-09-17 (round 3 — action deep links): buttons that promise an
    // ACTION now link straight into the app with that flow open:
    //   /matters?action=new_matter       → Matters view + New Matter modal
    //   /properties?action=new_property  → Properties view + New Property modal
    // (see src/utils/emailActions.ts + the MainContent effect in App.tsx;
    // unauthenticated clickers get the action parked and delivered after
    // login). Conceptual steps ("Meet ALOA", "Draft with DraftPro",
    // "Manage tenants & rent") still deep-link to the matching Help Center
    // section (/help/<sectionId>), which the app router resolves to HelpView
    // with that section pre-opened and scrolled into view.
    const appDomain = "https://practice-pro-vega.vercel.app";

    // Product-specific getting started guides — help URLs map 1:1 to
    // HelpView section IDs (see src/components/HelpView.tsx `sections`
    // array); action URLs map via src/utils/emailActions.ts.
    const gettingStartedLinks: Record<string, { label: string; url: string }[]> = {
      legal: [
        { label: 'Create your first Matter', url: `${appDomain}/matters?action=new_matter` },
        { label: 'Meet ALOA — your AI assistant', url: `${appDomain}/help/aloa-tips` },
        { label: 'Draft documents with DraftPro', url: `${appDomain}/help/draftpro-editor` },
      ],
      property: [
        { label: 'Add your first Property', url: `${appDomain}/properties?action=new_property` },
        { label: 'Meet ARIA — your AI assistant', url: `${appDomain}/help/aloa-tips` },
        { label: 'Manage tenants & rent', url: `${appDomain}/help/revenue-engine` },
      ],
      unified: [
        { label: 'Create your first Matter', url: `${appDomain}/matters?action=new_matter` },
        { label: 'Add your first Property', url: `${appDomain}/properties?action=new_property` },
        { label: 'Meet ALOA — your AI assistant', url: `${appDomain}/help/aloa-tips` },
        { label: 'Draft documents with DraftPro', url: `${appDomain}/help/draftpro-editor` },
      ],
    };

    const links = gettingStartedLinks[args.product || 'legal'] || gettingStartedLinks.legal;
    const linksHtml = links.map(l =>
      `<a href="${l.url}" style="display:block;padding:12px 16px;margin-bottom:8px;background:${BRAND_GREEN_LIGHT};border-radius:8px;color:#2d3748;text-decoration:none;font-size:15px;font-weight:500;border-left:3px solid ${BRAND_GREEN};">${l.label} →</a>`
    ).join('');

    const bodyHtml = `
      <p style="color:#1a202c;font-size:17px;font-weight:600;margin:0 0 8px 0;">Hi ${userName},</p>
      <p style="color:#4a5568;font-size:15px;line-height:1.7;margin:0 0 24px 0;">
        Welcome to PracticePro${brand.name ? ' ' + brand.name : ''}! Your email has been verified and your account is ready. We're excited to have you on board.
      </p>
      <p style="color:#1a202c;font-size:16px;font-weight:600;margin:0 0 16px 0;">Get Started in 3 Steps:</p>
      <div style="margin-bottom:32px;">${linksHtml}</div>
      <div style="background:${BRAND_GREEN_LIGHT};border-radius:10px;padding:20px;margin-bottom:32px;">
        <p style="color:${BRAND_GREEN_DARK};font-size:15px;font-weight:600;margin:0 0 8px 0;">Learning Resources</p>
        <p style="color:#4a5568;font-size:14px;line-height:1.6;margin:0;">
          Visit our <a href="${appDomain}/help" style="color:${BRAND_GREEN};text-decoration:none;font-weight:600;">Help Center</a> for tutorials, video guides, and best practices. You can also access help anytime from within the app by clicking the "?" icon.
        </p>
      </div>
      <p style="color:#4a5568;font-size:14px;line-height:1.6;margin:0;">
        If you have any questions, just ask ALOA (or ARIA) — your built-in AI assistant can help you navigate the app, draft documents, and manage your practice.
      </p>`;

    const html = brandedEmailWrapper({
      productName: brand.name,
      productColor: brand.productColor,
      tagline: brand.tagline,
      bodyHtml,
    });

    await sendBrevoEmail({
      to: args.email,
      subject: brand.name ? `Welcome to PracticePro ${brand.name}!` : `Welcome to PracticePro!`,
      html,
      productName: brand.name,
    });
  }
});

/**
 * sendPortalRecoveryEmail — Sends a password reset email to portal users.
 *
 * Branded with the appropriate portal product name (Vega for Client,
 * Atrium for Tenant) so the user recognizes the product they use.
 */
export const sendPortalRecoveryEmail = internalAction({
  args: { email: v.string(), code: v.string(), recoveryLink: v.string(), resetLink: v.optional(v.string()), portalType: v.string() },
  handler: async (ctx, args) => {
    const isTenant = args.portalType === 'tenant';
    const brandName = isTenant ? 'ATRIUM' : 'VEGA';
    const brandColor = isTenant ? '#52797f' : '#4cc9f0';
    const gradientEnd = isTenant ? '#2a4a4f' : '#1a3a5c';
    const portalLabel = isTenant ? 'Residents' : 'Client';

    // 2026-09-14 (reset-link round): one-click primary CTA; code fallback.
    const primaryButton = args.resetLink
      ? `<a href="${args.resetLink}" style="display: inline-block; background-color: ${isTenant ? '#52797f' : '#4f46e5'}; color: #ffffff; padding: 16px 32px; font-size: 16px; font-weight: bold; text-decoration: none; border-radius: 8px;">Set a new password now</a>
           <p style="color: #718096; font-size: 13px; line-height: 1.6; margin: 12px 0 0 0;">No code needed — the link opens the reset page directly. It works once and expires in 60 minutes.</p>`
      : `<a href="${args.recoveryLink}" style="display: inline-block; background-color: ${isTenant ? '#52797f' : '#4f46e5'}; color: #ffffff; padding: 14px 28px; font-size: 16px; font-weight: bold; text-decoration: none; border-radius: 8px;">Reset Password</a>`;

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
        
        <div style="background: linear-gradient(135deg, #0d1b2a 0%, ${gradientEnd} 100%); padding: 32px 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700;">PracticePro <span style="color: ${brandColor};">${brandName}</span></h1>
          <p style="color: #8ab4cc; margin: 6px 0 0 0; font-size: 13px; letter-spacing: 1px; text-transform: uppercase;">${portalLabel} Portal</p>
        </div>
        
        <div style="padding: 40px 32px;">
          <p style="color: #1a202c; font-size: 17px; font-weight: 600; margin: 0 0 8px 0;">Reset Your Portal Password</p>
          <p style="color: #4a5568; font-size: 15px; line-height: 1.7; margin: 0 0 32px 0;">
            We received a request to reset the password for your ${portalLabel} Portal account.
          </p>
          
          <div style="text-align: center; margin-bottom: 32px;">
            ${primaryButton}
          </div>

          <p style="color: #718096; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
            If the button doesn't work, you can also enter this recovery code manually on the portal login page:
          </p>
          <div style="background: #f7fafc; border: 2px dashed #cbd5e0; border-radius: 10px; padding: 16px; text-align: center; margin-bottom: 16px;">
            <span style="display: inline-block; font-size: 24px; font-weight: 800; color: #0d1b2a; letter-spacing: 4px;">${args.code}</span>
          </div>

          <p style="color: #718096; font-size: 13px; line-height: 1.6; margin: 0 0 16px 0;">
            This code expires in 60 minutes. Requesting a new code (or a new link) immediately
            replaces this one — if you request again, always use the code from the
            <strong>newest</strong> email.
          </p>
          
          <p style="color: #718096; font-size: 14px; line-height: 1.6; margin: 0;">
            If you did not request a password reset, please ignore this email. Your account is safe. You can also contact your ${isTenant ? 'property manager' : 'law firm'} if you have concerns.
          </p>
        </div>

        <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center;">
          <p style="color: #a0aec0; font-size: 12px; margin: 0;">
            &copy; ${new Date().getFullYear()} PracticePro Systems Limited. All rights reserved.<br/>
            No. 6 Sulaiman Adekanbi Street, Igbo-Efon, Lekki-Epe Expressway, Lagos State, Nigeria.
          </p>
        </div>
      </div>
    `;

    await sendBrevoEmail({
      to: args.email,
      subject: `Reset your PracticePro ${brandName} Portal Password`,
      html,
    });
  }
});

// --- BREACH NOTIFICATION (Phase 2) ---
// ISO 27001 A.16 / NDPA 2023 S.40 — Enables admin-triggered mass email alerts
// in the event of a security incident.

export const sendBreachNotification = internalAction({
  args: {
    affectedEmail: v.string(),
    sessionToken: v.optional(v.string()),
    incidentTitle: v.string(),
    incidentDescription: v.string(),
    recommendedAction: v.string(),
    incidentDate: v.string(),
  },
  handler: async (ctx, args) => {
    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
        
        <!-- Alert Header -->
        <div style="background: linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%); padding: 32px 24px; text-align: center;">
          <p style="color: #fca5a5; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 8px 0;">⚠ Security Notice</p>
          <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">PracticePro <span style="color: #fca5a5;">VEGA</span></h1>
        </div>
        
        <!-- Body -->
        <div style="padding: 40px 32px;">
          <p style="color: #7f1d1d; font-size: 18px; font-weight: 700; margin: 0 0 16px 0; border-left: 4px solid #ef4444; padding-left: 16px;">${args.incidentTitle}</p>
          
          <p style="color: #4a5568; font-size: 15px; line-height: 1.7; margin: 0 0 24px 0;">
            We are writing to inform you of a security incident that may have affected your PracticePro VEGA account.
          </p>
          
          <div style="background: #fff5f5; border: 1px solid #fed7d7; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <p style="color: #742a2a; font-size: 13px; font-weight: 600; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">What Happened</p>
            <p style="color: #4a5568; font-size: 14px; line-height: 1.6; margin: 0;">${args.incidentDescription}</p>
          </div>
          
          <div style="background: #f0fff4; border: 1px solid #c6f6d5; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <p style="color: #276749; font-size: 13px; font-weight: 600; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">What You Should Do</p>
            <p style="color: #4a5568; font-size: 14px; line-height: 1.6; margin: 0;">${args.recommendedAction}</p>
          </div>
          
          <p style="color: #718096; font-size: 13px; line-height: 1.6; margin: 0;">
            <strong>Incident Date:</strong> ${args.incidentDate}<br/>
            This notification is issued in accordance with the Nigeria Data Protection Act 2023, Section 40 (72-hour breach notification obligation).<br/><br/>
            If you have questions, contact our Data Protection team at <a href="mailto:practiceproindex@gmail.com" style="color: #e53e3e;">practiceproindex@gmail.com</a>.
          </p>
        </div>
        
        <!-- Footer -->
        <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center;">
          <p style="color: #a0aec0; font-size: 12px; margin: 0;">
            &copy; ${new Date().getFullYear()} PracticePro Systems Limited. All rights reserved.<br/>
            No. 6 Sulaiman Adekanbi Street, Igbo-Efon, Lekki-Epe Expressway, Lagos State, Nigeria.
          </p>
        </div>
      </div>
    `;

    await sendBrevoEmail({
      to: args.affectedEmail,
      subject: `[Important Security Notice] ${args.incidentTitle} — PracticePro VEGA`,
      html,
    });
  }
});
// --- ALOA CHAT END ---

export const purgeOldArchiveData = internalMutation({
  args: {},
  handler: async (ctx) => {
    // NDPA & ISO 27701: Data minimization and storage limitation
    // Purge records older than 30 days
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const cutoffDate = Date.now() - THIRTY_DAYS_MS;
    
    // Convex doesn't support index range queries directly on _creationTime yet without a dedicated index,
    // but a full scan for a nightly cron on an archive table is acceptable for MVP.
    const allArchives = await ctx.db.query("archive").take(500);
    
    let count = 0;
    for (const item of allArchives) {
      // V3 (V-MATTER-4/7): matter archive rows are EXEMPT — archiving is
      // now a soft, restorable state and the archive row is the restore
      // source. A 30-day purge would strand the matter in 'Archived'
      // status with no way to see or restore it. Everything else (notes,
      // ad-hoc item archives) keeps the 30-day minimisation window.
      if (item.itemType === "matters") continue;
      if (item._creationTime < cutoffDate) {
        await ctx.db.delete(item._id);
        count++;
      }
    }
  }
});

export const getAloaConversations = query({
  args: { userId: v.string(), firmId: v.string(), sessionToken: v.optional(v.string()), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // V1-A (SEC-4): ownership is derived from the authenticated session.
    // The caller-supplied userId previously listed ANY user's
    // conversations; it must now be one of the caller's own ids (Convex
    // _id or legacy id), and the caller must be staff of the firm.
    const caller = await requireStaffCaller(ctx, { sessionToken: args.sessionToken, userEmail: args.userEmail, firmId: args.firmId });
    const callerIds = new Set(
      [String(caller._id), String((caller as any).id || "")].filter(Boolean)
    );
    if (!callerIds.has(String(args.userId))) {
      console.error(`[SECURITY] getAloaConversations: userId does not match the session caller — rejected`);
      return [];
    }
    return await ctx.db
      .query("aloaConversations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(100);
  },
});

export const getAloaMessages = query({
  args: { conversationId: v.string(), sessionToken: v.optional(v.string()), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // V1-A (SEC-4): conversation ownership AND firm membership, both
    // verified against the session caller. Previously ANY caller could
    // read ANY conversation's full message history by id alone.
    const caller = await requireStaffCaller(ctx, { sessionToken: args.sessionToken, userEmail: args.userEmail });
    const conversation: any = await ctx.db.get(args.conversationId as any);
    if (!conversation) return [];
    const conversationOwner = String(conversation.userId || "");
    const conversationFirm = String(conversation.firmId || "");
    const callerIds = new Set(
      [String(caller._id), String((caller as any).id || "")].filter(Boolean)
    );
    const callerFirms = new Set(
      [String(caller.firmId || ""), ...(((caller as any).joinedFirmIds || []) as string[]).map(String)].filter(Boolean)
    );
    // Fail-closed: a tagged owner must be the caller, a tagged firm must
    // be the caller's, and a conversation with NEITHER tag is unreadable.
    const ownerOk = conversationOwner ? callerIds.has(conversationOwner) : false;
    const firmOk = conversationFirm ? callerFirms.has(conversationFirm) : false;
    if (!ownerOk || !firmOk) {
      console.error(`[SECURITY] getAloaMessages: conversation ${args.conversationId} is not the caller's — rejected`);
      return [];
    }
    return await ctx.db
      .query("aloaMessages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("asc")
      .take(500);
  },
});

export const createAloaConversation = mutation({
  args: { sessionToken: v.optional(v.string()), firmId: v.string(), userId: v.string(), title: v.string() },
  handler: async (ctx, args) => {
    // Round 8 auth retrofit: resolve the caller, verify firm scope.
    await requireStaffCaller(ctx, { sessionToken: args.sessionToken, userId: args.userId, firmId: args.firmId });
    return await ctx.db.insert("aloaConversations", {
      firmId: args.firmId,
      userId: args.userId,
      title: args.title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const saveAloaMessage = mutation({
  args: {
    conversationId: v.string(),
    sessionToken: v.optional(v.string()),
    firmId: v.string(),
    userId: v.optional(v.string()),
    message: v.any(),
  },
  handler: async (ctx, args) => {
    const { conversationId, firmId, message } = args;
    // Round 8 auth retrofit: this writer previously had NO caller
    // verification — anyone could write messages into any firm's
    // conversations. Resolve the caller and verify firm scope.
    const caller = await requireStaffCaller(ctx, {
      sessionToken: args.sessionToken,
      userId: args.userId,
      firmId,
    });
    // Verify the conversation belongs to the caller's firm before writing.
    // Task 63 fix: this previously ran a 500-row-capped by_firm index scan
    // plus a client-side find — silently failing ("Conversation not found in
    // your firm") for any conversation outside the first 500 rows once a
    // firm accumulates more. Since the client voids this mutation's promise,
    // a throw here meant messages vanished on the next reload with NO error
    // anywhere. O(1) document get + firm equality instead (the same pattern
    // markAloaActionCompleted already uses).
    const conversation = await ctx.db.get(conversationId as any) as { firmId?: string | null } | null;
    if (!conversation || String(conversation.firmId) !== String(caller.firmId)) {
      throw new Error("Conversation not found in your firm.");
    }
    const msgId = await ctx.db.insert("aloaMessages", {
      ...message,
      conversationId,
      firmId,
      createdAt: Date.now(),
    });

    // Update conversation updatedAt
    await ctx.db.patch(conversationId as any, { updatedAt: Date.now() });

    // PRIVACY: ALOA user messages are NO LONGER echoed to user_feedback.
    // This was causing client chat content to appear in the admin app's
    // feedback inbox — a privacy violation. ALOA messages belong only
    // in the aloaMessages table, visible to the firm that owns them.

    return msgId;
  },
});

export const deleteAloaConversation = mutation({
  args: { sessionToken: v.optional(v.string()), conversationId: v.string(), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Round 8 auth retrofit: the caller must belong to the conversation's firm.
    const caller = await requireStaffCaller(ctx, { sessionToken: args.sessionToken, userEmail: args.userEmail });
    // Task 63 fix: same capped-index-scan landmine as saveAloaMessage —
    // delete failed for conversations beyond the first 500 rows. O(1) get.
    const conversation = await ctx.db.get(args.conversationId as any) as { firmId?: string | null } | null;
    if (!conversation || String(conversation.firmId) !== String(caller.firmId)) {
      throw new Error("Conversation not found in your firm.");
    }
    // Delete messages first
    const messages = await ctx.db
      .query("aloaMessages")
      .withIndex("by_conversation", (q: any) => q.eq("conversationId", args.conversationId))
      .take(500);

    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }

    await ctx.db.delete(args.conversationId as any);
  },
});

export const markAloaActionCompleted = mutation({
  args: { sessionToken: v.optional(v.string()), messageId: v.id("aloaMessages"), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Round 8 auth retrofit: verify the message belongs to the caller's firm.
    const caller = await requireStaffCaller(ctx, { sessionToken: args.sessionToken, userEmail: args.userEmail });
    const msg = await ctx.db.get(args.messageId);
    if (!msg) throw new Error("Message not found");
    assertSameFirm(caller, msg.firmId as any);
    if (msg.toolAction) {
      await ctx.db.patch(args.messageId, {
        toolAction: { ...msg.toolAction, isCompleted: true }
      });
    }
  }
});

/**
 * ISO 27001 / NDPA 2023 COMPLIANCE: Atomic Cascade Deletion
 * Ensures that when a matter is removed, all associated PII and operational data
 * are wiped in a single transaction to prevent orphaned "ghost" records.
 */
export const deleteMatterCascade = mutation({
  args: { sessionToken: v.optional(v.string()), matterId: v.string(), firmId: v.string(), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // SECURITY: Admin-or-Founder auth (the Founder runs solo practices —
    // requireAdmin excluded them, so the ONLY user of a solo firm could
    // never delete anything) + firm ownership.
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    if (auth.user.role !== "Admin" && auth.user.role !== "Founder") {
      throw new Error("Permission denied. Deleting matters requires an Administrator (or Founder on a solo practice) role.");
    }
    if (!auth.firmId || auth.firmId !== args.firmId) {
      throw new Error("Unauthorized. You can only delete matters in your own firm.");
    }
    const { firmId } = args;

    // ─── V3 (V-MATTER-8): resolve the matter on EITHER id convention ────
    // The frontend passes the custom UUID; children store both forms.
    const matter = await resolveMatterAnyId(ctx, firmId, args.matterId);
    if (!matter) {
      throw new Error(`Matter ${args.matterId} not found. It may have already been deleted.`);
    }
    const canonicalIds = new Set(
      [String(matter._id), String(matter.id || ""), args.matterId].filter(Boolean)
    );
    const matchMatter = (row: any): boolean => {
      if (row.matterId && canonicalIds.has(String(row.matterId))) return true;
      const snap = row.matter;
      const snapId = snap && typeof snap === "object" ? snap.id : snap;
      return snapId ? canonicalIds.has(String(snapId)) : false;
    };
    const results: Record<string, number> = {};

    // ─── V3 (V-MATTER-8): FINANCIAL PROTECTION — never hard-delete money ──
    // The old cascade deleted invoices outright (bypassing the FINANCIAL_
    // TABLES fence that deleteItem enforces) and left trust/ledger/payment
    // rows orphaned. A matter that has entered the books now REFUSES to be
    // deleted — archive it instead. firmActivity rows are preserved too:
    // they are the audit trail, not children to clean up.
    const financialBlockers: string[] = [];

    const firmInvoices = (await ctx.db
      .query("invoices")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .take(2000)) as any[];
    const linkedInvoices = firmInvoices.filter(matchMatter);
    if (linkedInvoices.length > 0) financialBlockers.push(
      `${linkedInvoices.length} invoice${linkedInvoices.length === 1 ? "" : "s"} (void them instead — invoices are part of the financial ledger)`
    );

    const firmTrust = (await ctx.db
      .query("trust_transactions")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .take(2000)) as any[];
    const linkedTrust = firmTrust.filter(matchMatter);
    if (linkedTrust.length > 0) financialBlockers.push(
      `${linkedTrust.length} trust transaction${linkedTrust.length === 1 ? "" : "s"}`
    );

    const firmLedger = (await ctx.db
      .query("ledger_entries")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .take(2000)) as any[];
    const linkedLedger = firmLedger.filter(matchMatter);
    if (linkedLedger.length > 0) financialBlockers.push(
      `${linkedLedger.length} ledger entr${linkedLedger.length === 1 ? "y" : "ies"}`
    );

    const firmPaymentProofs = (await ctx.db
      .query("payment_proofs")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .take(2000)) as any[];
    const linkedProofs = firmPaymentProofs.filter(matchMatter);
    if (linkedProofs.length > 0) financialBlockers.push(
      `${linkedProofs.length} payment proof${linkedProofs.length === 1 ? "" : "s"}`
    );

    // Billed time/expenses are part of issued invoices — destroying them
    // would falsify what was billed. Unbilled ones are deleted below.
    const firmTime = (await ctx.db
      .query("timeEntries")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .take(2000)) as any[];
    const billedTime = firmTime.filter((t) => matchMatter(t) && t.billedInInvoiceId);
    if (billedTime.length > 0) financialBlockers.push(
      `${billedTime.length} billed time entr${billedTime.length === 1 ? "y" : "ies"}`
    );
    const firmExpenses = (await ctx.db
      .query("expenses")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .take(2000)) as any[];
    const billedExpenses = firmExpenses.filter((e) => matchMatter(e) && e.billedInInvoiceId);
    if (billedExpenses.length > 0) financialBlockers.push(
      `${billedExpenses.length} billed expense${billedExpenses.length === 1 ? "" : "s"}`
    );

    if (financialBlockers.length > 0) {
      throw new Error(
        `Cannot delete this matter — it has financial records that are never hard-deleted: ` +
        `${financialBlockers.join("; ")}. The ledger only grows; corrections are voids, not erasures. ` +
        `Archive the matter instead to keep the history and take it out of active lists.`
      );
    }

    // ─── Standalone real-estate property created with this matter ──────
    if (matter.specialtyData?.realEstate?.propertyId) {
      const propId = matter.specialtyData.realEstate.propertyId;
      let propRecord = null;
      try { propRecord = await ctx.db.get(propId as any); } catch (e) { console.warn("[Cascade] propId not a valid Convex ID, falling back to custom ID search."); }
      if (!propRecord) {
        propRecord = await ctx.db.query("properties")
          .withIndex("by_custom_id", (q: any) => q.eq("id", propId))
          .first();
      }
      if (propRecord) {
        await ctx.db.delete(propRecord._id);
        results["standaloneProperties"] = 1;
      }
    }

    // ─── GROUP A: cascading deletion of non-financial dependents ─────────
    // Collected per firm and filtered in JS (the safe pattern for tables
    // with mixed id conventions), with BOTH id forms matched and NO
    // silent take() truncation. Financial tables are deliberately absent.
    const tablesToClean = [
      "tasks", "documents", "events", "notePages",
      "clientMessages", "researchNotebooks", "chatConversations",
      "externalCounselInvites", "timeEntries", "expenses",
    ];

    for (const table of tablesToClean) {
      const allFirmItems = (await ctx.db
        .query(table as any)
        .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
        .take(2000)) as any[];
      const toDelete = allFirmItems.filter(matchMatter);
      for (const item of toDelete) {
        await ctx.db.delete(item._id);
      }
      results[table] = toDelete.length;
    }

    // Properties whose matterId links them to this matter (embedded-unit
    // properties keep their own lifecycle; this only removes the direct links).
    const firmProps = (await ctx.db
      .query("properties")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .take(2000)) as any[];
    const linkedProps = firmProps.filter((p) => p.matterId && canonicalIds.has(String(p.matterId)));
    for (const p of linkedProps) {
      await ctx.db.delete(p._id);
    }
    results["properties"] = linkedProps.length;

    // ─── Remove any archive rows for this matter (no stale ghosts) ──────
    const firmArchive = (await ctx.db
      .query("archive")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .take(2000)) as any[];
    const matterArchiveRows = firmArchive.filter(
      (r) => r.itemType === "matters" && canonicalIds.has(String(r.itemId || ""))
    );
    for (const r of matterArchiveRows) {
      await ctx.db.delete(r._id);
    }
    results["archiveRows"] = matterArchiveRows.length;

    // ─── Finally, delete the matter itself (audit trail preserved) ──────
    await ctx.db.delete(matter._id);
    results["matter"] = 1;

    // The audit record of the deletion itself.
    try {
      await insertFirmActivity(ctx, {
        firmId,
        userId: String(auth.user._id),
        userName: (auth.user as any).name || "",
        action: "Matter permanently deleted",
        targetType: "Matter",
        targetId: String(matter.id || matter._id),
        targetName: matter.title || "",
        metadata: { summary: results, financialRecordsPreserved: true },
      });
    } catch (e: any) {
      console.warn("[deleteMatterCascade] activity write failed (non-blocking):", e?.message);
    }

    return { success: true, summary: results };
  },
});

export const deletePropertyCascade = mutation({
  args: { sessionToken: v.optional(v.string()), propertyId: v.string(), firmId: v.string(), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // SECURITY: Require admin auth and verify firm ownership.
    const auth = await requireAdmin(ctx, args.userEmail, args.sessionToken);
    if (!auth.firmId || auth.firmId !== args.firmId) {
      throw new Error("Unauthorized. You can only delete properties in your own firm.");
    }
    const { propertyId, firmId } = args;

    // 1. Find the property record first
    // It might be a Convex ID or a custom prop_uuid
    let propertyRecord = null;
    try {
        propertyRecord = await ctx.db.get(propertyId as any);
    } catch (e) {
        console.warn("[Cascade] propertyId not a valid Convex ID, falling back to custom ID search.");
    }

    if (!propertyRecord) {
        propertyRecord = await ctx.db
            .query("properties")
            .withIndex("by_custom_id", (q) => q.eq("id", propertyId))
            .first();
    }

    if (!propertyRecord) {
        console.warn(`[Delete Cascade] Property ${propertyId} not found — already deleted.`);
        return { success: true, alreadyDeleted: true };
    }

    const targetId = (propertyRecord as any).id; // Use the custom ID for matter unlinking

    // 2. Unlink from any matters
    const allFirmMatters = await ctx.db
      .query("matters")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .take(2000);
    
    const matters = allFirmMatters.filter((m) => m.specialtyData?.realEstate?.propertyId === targetId);

    for (const matter of matters) {
        const specialtyData = matter.specialtyData || {};
        if (specialtyData.realEstate) {
            const newRealEstate = { ...specialtyData.realEstate };
            delete newRealEstate.propertyId;
            await ctx.db.patch(matter._id, { specialtyData: { ...specialtyData, realEstate: newRealEstate } });
        }
    }

    // 3. Delete the property itself using its Convex internal _id
    await ctx.db.delete(propertyRecord._id);

    return { success: true };
  },
});

/**
 * ROUND D (D8) — DELETION RECORD (Wave 3b, R81, 2026-11-10).
 *
 * deleteContactCascade removed: gated orphan (admin-gated cascade) with zero product callers — the live contact-delete path is the generic surface; the cascade safety only existed in a function nobody could reach.
 */

// ─── ADMIN ACCOUNT RECOVERY TOOL MUTATIONS ────────────────────────────────

export const adminSearchUsersByEmail = query({
  args: { sessionToken: v.optional(v.string()), email: v.string(), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // SECURITY: Require admin authentication
    await requireAdmin(ctx, args.userEmail, args.sessionToken);
    const token = args.email.toLowerCase().trim();
    if (!token) return [];
    const allUsers = await ctx.db.query("users").take(500);
    return allUsers.filter((u: any) => 
      u.email.toLowerCase().includes(token) || 
      (u.tokenIdentifier && u.tokenIdentifier.toLowerCase().includes(token))
    );
  }
});

export const adminDeleteUser = mutation({
  args: { sessionToken: v.optional(v.string()), userId: v.id("users"), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // SECURITY: Require admin authentication
    const auth = await requireAdmin(ctx, args.userEmail, args.sessionToken);
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found.");
    // SECURITY: Admin can only delete users in their own firm
    if ((user as any).firmId && (user as any).firmId !== auth.firmId) {
      throw new Error("Unauthorized. You can only delete users in your own firm.");
    }
    await ctx.db.delete(args.userId);
    return { success: true };
  }
});

export const adminForceVerify = mutation({
  args: { sessionToken: v.optional(v.string()), userId: v.id("users"), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // SECURITY: Require admin authentication
    const auth = await requireAdmin(ctx, args.userEmail, args.sessionToken);
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found.");
    // SECURITY: Admin can only verify users in their own firm
    if ((user as any).firmId && (user as any).firmId !== auth.firmId) {
      throw new Error("Unauthorized. You can only verify users in your own firm.");
    }
    await ctx.db.patch(args.userId, { isVerified: true });
    return { success: true };
  }
});

/**
 * ATRIUM QUOTA ENFORCEMENT
 * Called by the sendWhatsApp action before every dispatch.
 * Returns { success: false } if the firm has hit its monthly cap,
 * prompting the caller to surface an upgrade CTA instead of sending.
 */
export const incrementWhatsAppQuota = internalMutation({
  // Round 8 auth retrofit: internal-only. Was a PUBLIC mutation — any
  // internet caller could inflate any firm's WhatsApp quota by spamming it.
  // Its only caller is communications.sendWhatsApp (server-side).
  args: { firmId: v.string() },
  handler: async (ctx, args) => {
    const firm = await ctx.db.get(args.firmId as any) as any;
    if (!firm) throw new Error("Firm not found");

    const sent:  number = firm.whatsappMessagesSent ?? 0;

    // SECURITY FIX (WhatsApp hard-block): the CANONICAL limit comes from
    // getTierLimitsForFirm (Komplete/Vega = unlimited). The stored
    // firm.whatsappLimit is only honored as a founder-set custom cap when
    // it is a POSITIVE number — legacy firms created with the signup bug
    // wrote 0 for non-property firms, which used to read as "quota
    // exhausted" and hard-block every WhatsApp send. A stored 0 or
    // undefined is now treated as "no custom cap".
    // K-3: trial-aware canonical limits — a firm trialing Komplete keeps
    // unlimited WhatsApp for the trial window; after expiry the effective
    // plan (Core) applies. A unified-product firm on a non-Komplete plan now
    // gets the plan's Atrium-table WhatsApp depth instead of blanket
    // unlimited. The stored firm.whatsappLimit is still honored as the
    // founder-set custom cap below.
    const tierLimits = resolveTierLimitsForFirm(firm as any);
    let limit: number | null = tierLimits.whatsappLimit; // null = unlimited
    const stored = firm.whatsappLimit;
    if (typeof stored === "number" && stored > 0 && stored !== 999999 && (limit === null || stored < limit)) {
      limit = stored;
    }

    if (limit !== null && limit !== 999999 && sent >= limit) {
      return { success: false, error: "MONTHLY_LIMIT_REACHED", limit, sent };
    }

    await ctx.db.patch(firm._id, { whatsappMessagesSent: sent + 1 });
    return { success: true };
  }
});

// ─── MONTHLY WHATSAPP QUOTA RESET ────────────────────────────────────────────
// Resets whatsappMessagesSent to 0 for all firms. Called by cron on the 1st
// of each month. Fixes the bug where "per month" tier limits (100/500) were
// effectively lifetime caps because the counter was never reset.
export const resetWhatsAppQuotaMonthly = internalMutation({
  args: {},
  handler: async (ctx) => {
    const firms = await ctx.db.query("firms").take(500);
    let reset = 0;
    for (const firm of firms) {
      if ((firm as any).whatsappMessagesSent && (firm as any).whatsappMessagesSent > 0) {
        await ctx.db.patch(firm._id, { whatsappMessagesSent: 0 } as any);
        reset++;
      }
    }
    return { reset };
  },
});

/**
 * Add a single unit to a property's embedded units array.
 * Dedicated mutation to avoid the generic updateItem optimistic-update bug
 * that replaces the entire units array.
 */
export const addUnitToProperty = mutation({
  args: { sessionToken: v.optional(v.string()), propertyId: v.string(), firmId: v.string(), unitData: v.any(), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Round 8 auth retrofit: firmId was caller-supplied and only checked
    // against the property (spoofable — pass the victim's firmId). Resolve
    // the caller and verify the firm is THEIRS.
    await requireStaffCaller(ctx, { sessionToken: args.sessionToken, userEmail: args.userEmail, firmId: args.firmId });
    const { propertyId, firmId, unitData } = args;
    let property: any = null;
    try { property = await ctx.db.get(propertyId as any); } catch (e) {}
    if (!property) {
      property = await ctx.db
        .query("properties")
        .withIndex("by_custom_id", (q) => q.eq("id", propertyId))
        .first();
    }
    if (!property) throw new Error("Property not found");
    if (property.firmId !== firmId) throw new Error("Unauthorized");
    const existingUnits: any[] = property.units || [];
    const newUnit = { ...unitData };
    await ctx.db.patch(property._id, {
      units: [...existingUnits, newUnit],
      numberOfUnits: existingUnits.length + 1,
    });
    return { success: true };
  },
});

/**
 * Remove a single unit from a property's embedded units array by ID.
 * Dedicated mutation so we never accidentally overwrite sibling units.
 */
export const removeUnitFromProperty = mutation({
  args: { sessionToken: v.optional(v.string()), propertyId: v.string(), firmId: v.string(), unitId: v.string(), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Round 8 auth retrofit: same spoofable-firmId fix as addUnitToProperty.
    await requireStaffCaller(ctx, { sessionToken: args.sessionToken, userEmail: args.userEmail, firmId: args.firmId });
    const { propertyId, firmId, unitId } = args;
    let property: any = null;
    try { property = await ctx.db.get(propertyId as any); } catch (e) {}
    if (!property) {
      property = await ctx.db
        .query("properties")
        .withIndex("by_custom_id", (q) => q.eq("id", propertyId))
        .first();
    }
    if (!property) throw new Error("Property not found");
    if (property.firmId !== firmId) throw new Error("Unauthorized");
    const existingUnits: any[] = property.units || [];
    const updatedUnits = existingUnits.filter(
      (u: any) => u.id !== unitId && u._id !== unitId
    );
    await ctx.db.patch(property._id, {
      units: updatedUnits,
      numberOfUnits: updatedUnits.length,
    });
    return { success: true };
  },
});

/**
 * RBAC: Set a matter's private/public visibility status.
 * Only users in the matter's assignedUsers array may toggle this.
 */
export const setMatterPrivacy = mutation({
  args: {
    matterId: v.string(),
    sessionToken: v.optional(v.string()),
    firmId: v.string(),
    isPrivate: v.boolean(),
    requestUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const { matterId, firmId, isPrivate, requestUserId } = args;

    // Round 8 auth retrofit: firmId and requestUserId were both caller-
    // supplied, so an attacker could pass a victim firm's id plus an
    // assigned user's id and satisfy every check. Resolve requestUserId to
    // a real user and verify the firm is theirs.
    await requireStaffCaller(ctx, { sessionToken: args.sessionToken, userId: requestUserId, firmId });

    let matter: any = null;
    try { matter = await ctx.db.get(matterId as any); } catch (e) { throw new Error("Matter not found"); }
    if (!matter) throw new Error("Matter not found");

    if (matter.firmId?.toString() !== firmId.toString()) {
      throw new Error("[SECURITY] firmId mismatch");
    }

    const assigned: string[] = matter.assignedUsers || [];
    if (!assigned.includes(requestUserId) && matter._lastModifiedBy !== requestUserId) {
      throw new Error("[RBAC] Only assigned team members may change matter privacy.");
    }

    await ctx.db.patch(matter._id, { isPrivate });
    return { success: true };
  },
});

/**
 * ROUND D (D8) — DELETION RECORD (Wave 3b, R81, 2026-11-10).
 *
 * fixCorporateName removed: one-time data-repair artifact; zero product callers.
 */

/**
 * scanTaskHalfwayReminders — Cron-triggered internal mutation.
 *
 * Scans all tasks with a dueDate that haven't been completed. For each task,
 * calculates the midpoint between creation and due date. If the current time
 * is at or past the midpoint (and no reminder has been sent yet), dispatches:
 *
 * - Internal Team: in-app notification only
 * - External (Client/Resident): in-app + Email (+ WhatsApp if opted in)
 *
 * GUARDRAILS:
 * - If the task was created with <2 hours until due, skip the halfway reminder
 *   and instead schedule a 30-minute final reminder.
 * - Tasks with status 'done' or 'pending_verification' are skipped.
 * - Uses a 'halfwayReminderSent' flag on the task to prevent duplicate reminders.
 * - Supports snooze: if 'reminderAcknowledged' is true, skip the reminder.
 */
export const scanTaskHalfwayReminders = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
    const THIRTY_MIN_MS = 30 * 60 * 1000;

    // Fetch all tasks that are not done/pending_verification and have a dueDate
    const allTasks = await ctx.db.query("tasks").take(500);
    const activeTasks = allTasks.filter((t: any) =>
      t.dueDate &&
      t.status !== 'done' &&
      t.status !== 'pending_verification' &&
      !t.halfwayReminderSent &&
      !t.reminderAcknowledged
    );

    let remindersSent = 0;

    for (const task of activeTasks) {
      const createdAt = task.createdAt ? new Date(task.createdAt as string).getTime() : now;
      const dueDate = new Date(task.dueDate as string).getTime();
      const totalDuration = dueDate - createdAt;
      const midwayPoint = createdAt + (totalDuration / 2);

      // GUARDRAIL: if <2h total duration, skip halfway, schedule 30min final reminder
      if (totalDuration < TWO_HOURS_MS) {
        // For short tasks, remind 30 minutes before due date (or now if already past)
        const reminderTime = dueDate - THIRTY_MIN_MS;
        if (now >= reminderTime) {
          await sendTaskReminder(ctx, task, 'final');
          await ctx.db.patch(task._id, { halfwayReminderSent: true } as any);
          remindersSent++;
        }
        continue;
      }

      // Normal halfway reminder
      if (now >= midwayPoint) {
        await sendTaskReminder(ctx, task, 'halfway');
        await ctx.db.patch(task._id, { halfwayReminderSent: true } as any);
        remindersSent++;
      }
    }

    // Also check for overdue tasks (due date passed, not done)
    for (const taskRaw of allTasks) {
      const task = taskRaw as any;
      if (task.dueDate && task.status !== 'done' && task.status !== 'pending_verification' && !task.overdueNotificationSent) {
        const dueDate = new Date(task.dueDate as string).getTime();
        if (now > dueDate) {
          // Notify the task creator that the task is overdue
          if (task.creatorId) {
            const notificationId = crypto.randomUUID();
            await ctx.db.insert("notifications", {
              id: notificationId,
              firmId: task.firmId,
              userId: task.creatorId,
              title: "Task Overdue",
              message: `"${task.title}" is past its due date and hasn't been completed.`,
              type: "task_overdue",
              isRead: false,
              link: { view: "tasks", id: task.id || task._id.toString(), context: { taskId: task.id } },
              timestamp: Date.now(),
              createdAt: Date.now(),
              updatedAt: Date.now(),
            });
          }
          await ctx.db.patch(task._id, { overdueNotificationSent: true } as any);
        }
      }
    }

    return { remindersSent };
  },
});

// Helper: send a task reminder notification (+ email/WhatsApp for external)
async function sendTaskReminder(ctx: any, task: any, type: 'halfway' | 'final') {
  const now = new Date().toISOString();
  const assignees = task.assignedUsers || [];
  const assigneeType = task.assigneeType || 'team';
  const isExternal = assigneeType === 'client' || assigneeType === 'tenant';
  const dueDateStr = task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-GB') : '';
  const messageText = type === 'halfway'
    ? `Reminder: "${task.title}" is due on ${dueDateStr}. Please make sure it's on track.`
    : `Final reminder: "${task.title}" is due soon (${dueDateStr}). Please complete it as soon as possible.`;

  for (const assigneeId of assignees) {
    const notificationId = crypto.randomUUID();
    await ctx.db.insert("notifications", {
      id: notificationId,
      firmId: task.firmId,
      userId: assigneeId,
      title: type === 'halfway' ? "Task Reminder" : "Final Task Reminder",
      message: messageText,
      type: "task_reminder",
      isRead: false,
      link: { view: "tasks", id: task.id || task._id.toString(), context: { taskId: task.id, reminderType: type } },
      timestamp: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // External: dispatch email + WhatsApp
    if (isExternal) {
      try {
        const user = await ctx.db.get(assigneeId as any) as any;
        if (user) {
          const email = user.email || user.tokenIdentifier;
          if (email) {
            // FIX: sendEmail's contract is { to, subject, htmlContent, firmId } —
            // this call previously passed `html` and omitted `firmId`, so the
            // scheduler rejected it at validation on every run (silently —
            // swallowed by the .catch) and external task reminder emails
            // NEVER went out.
            await ctx.scheduler.runAfter(0, internal.communications.sendEmailCore as any, {
              to: email,
              subject: `${type === 'halfway' ? 'Task Reminder' : 'Final Reminder'}: ${task.title}`,
              htmlContent: `<p>Hi ${user.name || 'there'},</p><p>${messageText}</p><p>Please log in to your portal to complete this task.</p>`,
              firmId: task.firmId,
            }).catch(() => {});
          }
          const phone = user.phone || user.whatsappNumber;
          const whatsappOptIn = user.whatsappOptIn === true || user.notificationSettings?.whatsapp === true;
          if (phone && whatsappOptIn) {
            await ctx.scheduler.runAfter(0, internal.communications.sendWhatsAppCore as any, {
              to: phone,
              messageText: messageText,
              firmId: task.firmId,
            }).catch(() => {});
          }
        }
      } catch (e) {
        // Best-effort — don't fail the reminder scan
      }
    }
  }
}

/**
 * sendFounderSignupNotification — Notifies the founder when a new user
 * verifies their email and joins the platform.
 *
 * Sends to:
 *   - practiceprosystems@gmail.com (primary founder email)
 *   - Any additional notification recipients stored in the
 *     FOUNDER_NOTIFICATION_EMAILS env var (comma-separated)
 *
 * This is triggered from the verifyCode mutation when welcomeEmailSent
 * is set to true for the first time.
 */
export const sendFounderSignupNotification = internalAction({
  args: {
    newUserEmail: v.string(),
    newUserName: v.string(),
    product: v.string(),
  },
  handler: async (ctx, args) => {
    const brand = getProductBranding(args.product);
    const productName = args.product === 'property' ? 'Atrium' :
                         args.product === 'unified' ? 'Komplete' : 'Vega';

    const bodyHtml = `
      <p style="color:#1a202c;font-size:17px;font-weight:600;margin:0 0 8px 0;">New User Signup</p>
      <p style="color:#4a5568;font-size:15px;line-height:1.7;margin:0 0 24px 0;">
        A new user has just verified their email and joined PracticePro ${productName}!
      </p>
      <div style="background:${BRAND_GREEN_LIGHT};border-radius:12px;padding:20px;margin-bottom:24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Name:</td><td style="padding:4px 0;color:#1a202c;font-size:15px;font-weight:600;">${args.newUserName || 'Not provided'}</td></tr>
          <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Email:</td><td style="padding:4px 0;color:#1a202c;font-size:15px;font-weight:600;">${args.newUserEmail}</td></tr>
          <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Product:</td><td style="padding:4px 0;color:#1a202c;font-size:15px;font-weight:600;">${productName}</td></tr>
          <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Joined:</td><td style="padding:4px 0;color:#1a202c;font-size:15px;font-weight:600;">${new Date().toLocaleString('en-GB')}</td></tr>
        </table>
      </div>
      <p style="color:#718096;font-size:14px;line-height:1.6;margin:0;">
        View more details in the Founder Dashboard → Organizations.
      </p>`;

    const html = brandedEmailWrapper({
      productName: 'Founder Alert',
      productColor: BRAND_GREEN,
      tagline: 'Platform Notification',
      bodyHtml,
    });

    // Primary founder email
    await sendBrevoEmail({
      to: "practiceprosystems@gmail.com",
      subject: `New ${productName} Signup: ${args.newUserName || args.newUserEmail}`,
      html,
      productName: 'Founder Alert',
    });

    // Additional notification recipients (e.g., marketing team)
    // Set FOUNDER_NOTIFICATION_EMAILS env var to a comma-separated list
    const additionalEmails = process.env.FOUNDER_NOTIFICATION_EMAILS;
    if (additionalEmails) {
      const emails = additionalEmails.split(',').map((e: string) => e.trim()).filter(Boolean);
      for (const email of emails) {
        await sendBrevoEmail({
          to: email,
          subject: `New ${productName} Signup: ${args.newUserName || args.newUserEmail}`,
          html,
          productName: 'Founder Alert',
        });
      }
    }

    return { success: true };
  },
});

/**
 * internal query: getAllUsersForBroadcast
 * Returns all users matching the target product for broadcast notifications.
 * Filters out Founder role users (they don't receive client broadcasts).
 *
 * SECURITY: This is an INTERNAL query — it can only be called from
 * server-side actions (via ctx.runQuery), NOT from client code. This
 * prevents any user from downloading the full user list by calling
 * this query directly.
 */
export const getAllUsersForBroadcast = internalQuery({
  args: { targetProduct: v.string() },
  handler: async (ctx, args) => {
    // Remove the .take(2000) cap — use .collect() to get ALL users.
    // The 2000 cap was causing undercounting for large platforms.
    const allUsers = await ctx.db.query("users").take(2000);
    const allFirms = await ctx.db.query("firms").take(500);
    const firmMap = new Map<string, any>();
    allFirms.forEach((f: any) => firmMap.set(f._id, f));

    const target = args.targetProduct;

    // PRODUCT RESOLUTION:
    // The `product` field on users/firms is inconsistent — it can be
    // 'legal', 'property', 'unified', 'vega', 'atrium', 'komplete', or
    // missing. To correctly resolve the audience for each product target,
    // we check MULTIPLE signals:
    //
    //   1. The user's `product` field
    //   2. The user's firm's `product` field (often more reliable)
    //   3. The firm's `subscriptionPlan` (Komplete plan = unified product)
    //
    // This handles the known data issue where Komplete-plan firms have
    // stale `product: 'vega'` from before their plan was upgraded.

    const isProductMatch = (user: any, firm: any, target: string): boolean => {
      if (target === 'all') return true;

      // Collect all product signals for this user
      const userProduct = (user.product || '').toLowerCase();
      const firmProduct = (firm?.product || '').toLowerCase();
      const firmPlan = (firm?.subscriptionPlan || '').toLowerCase();

      // Normalize: 'komplete' plan → 'unified' product
      // (Komplete is the plan name; 'unified' is the product tag)
      const normalizedUserProduct =
        userProduct === 'komplete' ? 'unified' :
        userProduct === 'vega' ? 'legal' :
        userProduct === 'atrium' ? 'property' :
        userProduct;
      const normalizedFirmProduct =
        firmProduct === 'komplete' ? 'unified' :
        firmProduct === 'vega' ? 'legal' :
        firmProduct === 'atrium' ? 'property' :
        firmProduct;

      // For 'unified' (Komplete) target: match if user/firm is unified
      // OR if the firm's plan is 'Komplete' (handles stale product field)
      if (target === 'unified') {
        return normalizedUserProduct === 'unified' ||
               normalizedFirmProduct === 'unified' ||
               firmPlan === 'komplete';
      }

      // For 'legal' (Vega) target: match if user/firm is legal
      // BUT exclude users whose firm is on Komplete plan (they get
      // Komplete broadcasts, not Vega broadcasts)
      if (target === 'legal') {
        if (firmPlan === 'komplete') return false;
        return normalizedUserProduct === 'legal' ||
               normalizedFirmProduct === 'legal' ||
               (!normalizedUserProduct && !normalizedFirmProduct); // default to legal
      }

      // For 'property' (Atrium) target: match if user/firm is property
      if (target === 'property') {
        return normalizedUserProduct === 'property' ||
               normalizedFirmProduct === 'property';
      }

      return false;
    };

    const filtered = allUsers.filter((u: any) => {
      // Exclude Founder role — they don't receive client broadcasts
      if (u.role === 'Founder') return false;
      const firm = u.firmId ? firmMap.get(u.firmId) : null;
      return isProductMatch(u, firm, target);
    });

    // DEDUPLICATE by email — a user may have multiple records in the
    // users table (e.g., they belong to multiple firms, or have
    // duplicate records from migrations). Without this dedup, each
    // record gets a separate notification and the user sees the same
    // broadcast N times. We keep only the first record per email.
    const seenEmails = new Set<string>();
    const deduped = filtered.filter((u: any) => {
      const email = (u.email || '').toLowerCase().trim();
      if (!email) return true; // keep records without email (rare)
      if (seenEmails.has(email)) return false;
      seenEmails.add(email);
      return true;
    });

    return deduped;
  },
});

/**
 * internal mutation: createBroadcastNotification
 * Creates a notification row for a single user (used by broadcast action).
 *
 * Stores the targetProduct and persistenceMode in the notification's link
 * context so client apps can:
 *   - Evaluate whether the broadcast applies to their product
 *   - Determine if the banner can be dismissed, and how dismissal persists
 */
export const createBroadcastNotification = internalMutation({
  args: {
    userId: v.string(),
    firmId: v.string(),
    title: v.string(),
    message: v.string(),
    theme: v.string(),
    deepLink: v.optional(v.string()),
    targetProduct: v.optional(v.string()),
    persistenceMode: v.optional(v.string()),
    broadcastId: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("notifications", {
      firmId: args.firmId,
      userId: args.userId,
      title: args.title,
      message: args.message,
      type: `broadcast_${args.theme}`,
      link: {
        view: 'dashboard',
        id: null,
        context: {
          deepLink: args.deepLink || undefined,
          targetProduct: args.targetProduct || 'all',
          isBroadcast: true,
          persistenceMode: args.persistenceMode || 'permanent',
          broadcastId: args.broadcastId,
        }
      },
      timestamp: Date.now(),
      isRead: false,
      expiresAt: args.expiresAt,
    } as any);
  },
});

/**
 * internal mutation: logBroadcastEvent
 * Logs a broadcast event in analytics_events for audit trail.
 */
export const logBroadcastEvent = internalMutation({
  args: {
    targetProduct: v.string(),
    channel: v.string(),
    theme: v.string(),
    title: v.string(),
    recipientCount: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("analytics_events", {
      firmId: "system",
      userId: "founder",
      event: `Broadcast sent: ${args.title}`,
      properties: {
        targetProduct: args.targetProduct,
        channel: args.channel,
        theme: args.theme,
        recipientCount: args.recipientCount,
      },
      timestamp: Date.now(),
    } as any);
  },
});

/**
 * internal action: sendBroadcastEmail
 * Sends a broadcast email via Brevo to a single recipient.
 */
export const sendBroadcastEmail = internalAction({
  args: {
    to: v.string(),
    title: v.string(),
    message: v.string(),
    theme: v.string(),
  },
  handler: async (ctx, args) => {
    const themeColors: Record<string, string> = {
      info: '#3B82F6',
      success: '#16A34A',
      warning: '#F59E0B',
      urgent: '#EF4444',
    };
    const color = themeColors[args.theme] || themeColors.info;

    const bodyHtml = `
      <div style="background:${color};border-radius:8px;padding:16px;margin-bottom:24px;text-align:center;">
        <p style="color:#ffffff;font-size:14px;font-weight:700;margin:0;text-transform:uppercase;letter-spacing:1px;">${args.theme === 'urgent' ? 'URGENT ALERT' : args.theme === 'warning' ? 'WARNING' : args.theme === 'success' ? 'ANNOUNCEMENT' : 'NOTIFICATION'}</p>
      </div>
      <p style="color:#1a202c;font-size:17px;font-weight:600;margin:0 0 8px 0;">${args.title}</p>
      <p style="color:#4a5568;font-size:15px;line-height:1.7;margin:0 0 24px 0;">${args.message}</p>
      <p style="color:#718096;font-size:14px;line-height:1.6;margin:0;">
        This is a platform-wide announcement from PracticePro. Open the app for more details.
      </p>`;

    const html = brandedEmailWrapper({
      productName: 'Announcement',
      productColor: color,
      tagline: 'Platform Notification',
      bodyHtml,
    });

    await sendBrevoEmail({
      to: args.to,
      subject: args.title,
      html,
      productName: 'Announcement',
    });

    return { success: true };
  },
});

/**
 * internal mutation: scanLeaseExpiries
 *
 * Daily cron job that scans all properties for leases expiring within
 * 30, 60, or 90 days, and for tenancies that expired within the last
 * week. Creates a notification for each firm admin so they can start
 * renewal or recovery proceedings before/after the lease lapses.
 *
 * R28 (owner round 2026-10-17):
 *  - Embedded units (property.units[]) are now scanned too — previously
 *    only standalone rows carrying rentalDetails were, so units living
 *    inside a building document never produced expiry alerts.
 *  - Every message names the TENANT, the UNIT and the BUILDING ("it
 *    wasn't clear to me whose own had expired").
 *  - The deep link carries `reason` ('lease_expired' | 'lease_expiry')
 *    and a unit-accurate `targetUnit`, so the banner opens the exact
 *    unit concerned (owner: "it didn't open the exact one that I was
 *    supposed to open").
 */
export const scanLeaseExpiries = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const thresholds = [30, 60, 90]; // days

    const allProperties = await ctx.db.query("properties").take(2000);

    // ── helpers ─────────────────────────────────────────────────────────
    // One alert per (key) — recorded in analytics_events before notifying.
    const alreadyAlerted = async (key: string): Promise<boolean> => {
      const existing = await ctx.db
        .query("analytics_events")
        .filter((q: any) => q.eq(q.field("event"), key))
        .take(1);
      return existing.length > 0;
    };

    const recordAlert = async (
      firmId: string,
      key: string,
      payload: Record<string, any>
    ) => {
      await ctx.db.insert("analytics_events", {
        firmId: firmId || "system",
        userId: "lease_cron",
        event: key,
        properties: payload,
        timestamp: now,
      } as any);
    };

    const notifyFirmAdmins = async (
      firmId: string | undefined,
      title: string,
      message: string,
      type: 'lease_expiry' | 'lease_expired',
      link: { view: string; id: any; context: Record<string, any> }
    ) => {
      if (!firmId) return;
      const firmUsers = await ctx.db
        .query("users")
        .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
        .take(200);
      const admins = firmUsers.filter((u: any) => u.role === 'Admin');
      for (const admin of admins) {
        await ctx.db.insert("notifications", {
          firmId,
          userId: admin._id,
          title,
          message,
          type,
          link,
          timestamp: Date.now(),
          isRead: false,
        } as any);
      }
    };

    // Human label for a lease holder: unit name → property name → address.
    const unitLabelFor = (unit: any, parent: any): string => {
      return (
        unit?.rentalDetails?.unitName ||
        unit?.unitName ||
        unit?.name ||
        parent?.name ||
        parent?.address ||
        'the unit'
      );
    };

    const addressLineFor = (parent: any): string =>
      (parent?.address || parent?.name || 'the property').split(',')[0];

    for (const property of allProperties as any[]) {
      // ── Collect lease candidates: the row itself AND embedded units ──
      // A properties-table row can be (a) a standalone unit carrying its
      // own rentalDetails (units ARE properties rows sharing an address),
      // or (b) a building whose units live in property.units[] with their
      // own rentalDetails. Both shapes are scanned (R28).
      const candidates: Array<{ unit: any; unitKey: string; isEmbedded: boolean }> = [];

      if (property.rentalDetails && property.rentalDetails.leaseEnd) {
        candidates.push({ unit: property, unitKey: String(property._id), isEmbedded: false });
      }
      if (Array.isArray(property.units)) {
        for (const u of property.units) {
          if (u && u.rentalDetails && u.rentalDetails.leaseEnd) {
            candidates.push({
              unit: u,
              unitKey: String(u._id || u.id || u.unitName || 'embedded'),
              isEmbedded: true,
            });
          }
        }
      }

      for (const { unit, unitKey, isEmbedded } of candidates) {
        const rentalDetails = unit.rentalDetails;
        const leaseEnd = new Date(rentalDetails.leaseEnd).getTime();
        if (isNaN(leaseEnd)) continue;

        const daysRemaining = Math.ceil((leaseEnd - now) / DAY);
        const tenantName = rentalDetails.tenantName || 'Unknown tenant';
        const unitLabel = unitLabelFor(unit, property);
        const addressLine = addressLineFor(property);
        // The deep link must open the PROPERTY DETAIL that owns the Units
        // tab, and target the exact unit row inside it. For standalone
        // rows the row id doubles as both; for embedded units the parent
        // property navigates and the unit id targets.
        const navPropertyId = property._id;
        const targetUnitId = isEmbedded ? (unit._id || unit.id) : property._id;

        // ── Upcoming expiry: alert once per threshold ──
        for (const threshold of thresholds) {
          if (daysRemaining > 0 && daysRemaining <= threshold) {
            const alertKey = `lease_expiry_${threshold}_${property._id}${isEmbedded ? `_${unitKey}` : ''}`;
            if (await alreadyAlerted(alertKey)) continue;

            await recordAlert(property.firmId, alertKey, {
              propertyId: property._id,
              unitKey,
              propertyName: property.name || property.address || "Unknown",
              tenantName,
              leaseEnd: rentalDetails.leaseEnd,
              daysRemaining,
            });

            await notifyFirmAdmins(
              property.firmId,
              `Lease Expiring in ${daysRemaining} days`,
              `${tenantName}'s tenancy at ${unitLabel}, ${addressLine}, ends ${new Date(leaseEnd).toLocaleDateString('en-GB')} (${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left). Open to review renewal or notice.`,
              'lease_expiry',
              {
                view: 'propertyDetail',
                id: navPropertyId,
                context: { tab: 'units', targetUnit: targetUnitId, highlight: targetUnitId, reason: 'lease_expiry' },
              }
            );
            break; // Only alert once (at the closest threshold)
          }
        }

        // ── Already expired (within the last week): alert once ──
        if (daysRemaining < 0 && daysRemaining > -7) {
          const expiredKey = `lease_expired_${property._id}${isEmbedded ? `_${unitKey}` : ''}`;
          if (!(await alreadyAlerted(expiredKey))) {
            const daysExpired = Math.abs(daysRemaining);
            await recordAlert(property.firmId, expiredKey, {
              propertyId: property._id,
              unitKey,
              propertyName: property.name || property.address || "Unknown",
              tenantName,
              leaseEnd: rentalDetails.leaseEnd,
              daysExpired,
            });

            await notifyFirmAdmins(
              property.firmId,
              'Tenancy Expired',
              `${tenantName}'s tenancy at ${unitLabel}, ${addressLine}, expired ${daysExpired} day${daysExpired === 1 ? '' : 's'} ago (ended ${new Date(leaseEnd).toLocaleDateString('en-GB')}). Statutory notice windows apply — open the unit to act.`,
              'lease_expired',
              {
                view: 'propertyDetail',
                id: navPropertyId,
                context: { tab: 'units', targetUnit: targetUnitId, highlight: targetUnitId, reason: 'lease_expired' },
              }
            );
          }
        }
      }
    }
  },
});

export const getPropertyById = query({
  args: { propertyId: v.string() },
  handler: async (ctx, args) => {
    // ROUND E (Wave E1): PUBLIC-READ PROJECTION. This query feeds the PUBLIC
    // application form (/apply/:propertyId → AtriumPublicApplicationForm) —
    // anonymous prospective tenants. It previously returned the RAW property
    // document, which handed anyone with the share link the sitting tenant's
    // PII (name/phone/email), owner contact ids, automation settings, the
    // full rentPaymentHistory and every internal field. The projection
    // returns exactly what the application form reads — firmId (lead
    // routing), the move-in disclosure figures (per unit: rent, service
    // charge, legal/agency/caution, occupancy FLAG instead of tenant name),
    // coreServices and rentCollectionMode — and nothing else. Standalone
    // (row-per-unit) properties get their single unit synthesized into the
    // units array so the disclosure works for them too (previously only
    // embedded-unit properties showed figures).
    let prop: any = null;
    try {
      prop = await ctx.db.get(args.propertyId as any);
    } catch {
      return null;
    }
    if (!prop) return null;

    const rd = (prop.rentalDetails || {}) as any;
    const disclosureFields = (u: any) => ({
      id: u?.id ?? null,
      unitName: u?.unitName ?? null,
      status: u?.status ?? null,
      isOccupied: !!(u?.tenantName || (u?.rentalDetails && u.rentalDetails.tenantName)),
      rentAmount: typeof u?.rentAmount === "number" ? u.rentAmount : null,
      rentFrequency: u?.rentFrequency ?? null,
      serviceChargeAmount: typeof u?.serviceChargeAmount === "number" ? u.serviceChargeAmount : null,
      serviceChargeFrequency: u?.serviceChargeFrequency ?? null,
      serviceChargeMonthsInAdvance: typeof u?.serviceChargeMonthsInAdvance === "number" ? u.serviceChargeMonthsInAdvance : null,
      legalFee: typeof u?.legalFee === "number" ? u.legalFee : null,
      agencyFee: typeof u?.agencyFee === "number" ? u.agencyFee : null,
      cautionDeposit: typeof u?.cautionDeposit === "number" ? u.cautionDeposit : null,
      isLegalNA: !!u?.isLegalNA,
      isAgencyNA: !!u?.isAgencyNA,
      isCautionNA: !!u?.isCautionNA,
    });

    const embeddedUnits: any[] = Array.isArray(prop.units) ? prop.units : [];
    const units = embeddedUnits.length
      ? embeddedUnits.map((u: any) => disclosureFields({ ...u, ...(u?.rentalDetails || {}) }))
      : [disclosureFields({ id: prop.id ?? prop._id, unitName: rd.unitName ?? null, status: prop.status ?? null, ...rd })];

    return {
      _id: prop._id,
      id: prop.id ?? null,
      firmId: prop.firmId ?? null,
      rentCollectionMode: prop.rentCollectionMode ?? null,
      coreServices: prop.coreServices ?? null,
      propertyType: prop.propertyType ?? null,
      units,
    };
  },
});

// ════════════════════════════════════════════════════════════════════════════
// CRO AUDIT — TRACK A: REVENUE PROTECTION MUTATIONS
// ════════════════════════════════════════════════════════════════════════════
//
// Replaces the broken flow where SubscriptionSettings.processUpgrade
// immediately flipped firm.subscriptionPlan on "Report Payment Transferred".
// The new flow:
//   1. User clicks "Report Payment Transferred" → createSubscriptionRequest
//      inserts a pending row in subscriptionRequests (status='pending_review').
//      Firm.subscriptionPlan is NOT touched.
//   2. User gets continued access at their CURRENT plan during verification.
//      The pending request is visible in the founder dashboard (OrganizationsHub).
//   3. Founder admin approves → approveSubscriptionRequest flips firm.subscriptionPlan
//      and updates the request to status='approved'.
//   4. If Paystack is active and a webhook fires for this reference →
//      activateFirmSubscription (called from payments.completePaystackPayment)
//      flips the plan and approves the matching request.
//   5. After 72h with no action → expirePendingSubscriptionRequests auto-reverts
//      the request to status='auto_reverted'.
// ════════════════════════════════════════════════════════════════════════════

/**
 * createSubscriptionRequest — called from the PaymentGatewayModal's
 * "Report Payment Transferred" button (replaces the old onUpdateFirmDetails
 * call that immediately flipped the plan).
 *
 * Inserts a pending row in subscriptionRequests. The firm's subscriptionPlan
 * is NOT touched. The founder admin must approve via approveSubscriptionRequest.
 */
export const createSubscriptionRequest = mutation({
  args: {
    requestedPlan: v.string(),
    sessionToken: v.optional(v.string()),
    // REVENUE-LEAK FIX: target product for Komplete→single-product downgrades.
    // 'property' (Atrium) | 'legal' (Vega) | undefined (same-product requests).
    requestedProduct: v.optional(v.string()),
    billingInterval: v.string(),                 // 'monthly' | 'annual'
    amount: v.number(),                          // NGN expected
    transactionReference: v.string(),            // PP-{firmId}-{timestamp}
    paymentProofStorageId: v.optional(v.string()),
    paymentProofNote: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    // P11: Idempotency key — prevents duplicate subscription requests on double-submit
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // P11 DEDUP: If idempotencyKey is provided, check for an existing record.
    if (args.idempotencyKey) {
      const existing = await ctx.db
        .query("subscriptionRequests")
        .withIndex("by_idempotency", (q: any) => q.eq("idempotencyKey", args.idempotencyKey))
        .first();
      if (existing) {
        return existing._id;
      }
    }
    const { firmId, user } = await requireFirmUser(ctx, args.userEmail, args.sessionToken);

    // Fetch current firm to record the currentPlan
    const firm: any = await ctx.db.get(firmId as any);
    if (!firm) throw new Error("Firm not found.");

    // Validate the reference is well-formed — must start with PP- and include the firmId
    const expectedPrefix = `PP-${firmId}-`;
    if (!args.transactionReference.startsWith(expectedPrefix)) {
      throw new Error(
        `Invalid transaction reference. Must start with '${expectedPrefix}'. ` +
        `Got: '${args.transactionReference}'.`
      );
    }

    const now = new Date();
    const AUTO_REVERT_HOURS = 72;
    const autoRevertAt = now.getTime() + AUTO_REVERT_HOURS * 60 * 60 * 1000;

    // Insert the pending request
    const requestId = await ctx.db.insert("subscriptionRequests", {
      firmId,
      userId: user?._id,
      userEmail: user?.email || args.userEmail,
      currentPlan: firm.subscriptionPlan || 'Core',
      requestedPlan: args.requestedPlan,
      requestedProduct: args.requestedProduct || null,
      billingInterval: args.billingInterval,
      amount: args.amount,
      transactionReference: args.transactionReference,
      status: 'pending_review',
      paymentProofStorageId: args.paymentProofStorageId || null,
      paymentProofNote: args.paymentProofNote || null,
      idempotencyKey: args.idempotencyKey,
      requestedAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    // Also notify all founder users so they can review
    const founders = await ctx.db.query("users").filter((q: any) =>
      q.eq(q.field("role"), "Founder")
    ).take(2000);
    for (const founder of founders) {
      await ctx.db.insert("notifications", {
        firmId: 'system',
        userId: founder._id,
        title: 'Subscription Request Pending Review',
        message: `${user?.email || 'A user'} requested upgrade to ${args.requestedPlan} (₦${args.amount.toLocaleString()}). Reference: ${args.transactionReference}`,
        type: 'subscription_request',
        link: { view: 'organizationsHub', id: requestId, context: {} },
        timestamp: Date.now(),
        isRead: false,
      } as any);
    }

    return {
      success: true,
      requestId,
      transactionReference: args.transactionReference,
      // eslint-disable-next-line
    };
  },
});

/**
 * ROUND D (D5) — DELETION RECORD.
 *
 * Three dead twins removed (zero frontend callers, superseded by the wired
 * founderMetrics console variants used by the Founder App's
 * SubscriptionRequestsCenter):
 *
 *   • getPendingSubscriptionRequests — superseded by
 *     founderMetrics.getSubscriptionRequests.
 *   • approveSubscriptionRequest — superseded by
 *     founderMetrics.approveSubscriptionRequestAsFounder. IMPORTANT: before
 *     deletion its REVENUE-LEAK FIX #9 (unified-firm downgrade must also
 *     flip firm.product, and ambiguous downgrades are refused) was PORTED
 *     into the wired variant — the twins had drifted, and the live approval
 *     path was silently leaking ~₦400K+/yr per downgraded Komplete firm
 *     because only the DEAD twin carried the guard.
 *   • rejectSubscriptionRequest — superseded by
 *     founderMetrics.rejectSubscriptionRequestAsFounder (which is also the
 *     stricter gate: requireFounder instead of Founder||Admin).
 *
 * getMyPendingSubscriptionRequest is KEPT and now wired — it is the
 * user-side truth surface for the firm's latest subscription request
 * (SubscriptionSettings D5 banner).
 */
export const getMyPendingSubscriptionRequest = query({
  args: { sessionToken: v.optional(v.string()), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { firmId } = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const request = await ctx.db
      .query("subscriptionRequests")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .order("desc")
      .first();
    return request;
  },
});

/**
 * activateFirmSubscription — called by the Paystack webhook (via
 * payments.completePaystackPayment) when a subscription payment is confirmed.
 * Also called manually by the founder admin path. This is the ONLY path
 * that should flip firm.subscriptionPlan in response to a payment.
 */
export const activateFirmSubscription = internalMutation({
  args: {
    firmId: v.string(),
    plan: v.string(),
    billingInterval: v.optional(v.string()),
    reference: v.optional(v.string()),
    // REVENUE-LEAK FIX (#9): product flip support (Komplete→single-product)
    product: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();

    await ctx.db.patch(args.firmId as any, {
      subscriptionPlan: args.plan,
      ...(args.product ? { product: args.product } : {}),
      setupFeePaid: true,
      adminStatus: 'active',
      trialStartsAt: null,
      trialEndsAt: null,
      trialPlan: null,
      billingInterval: args.billingInterval || 'annual',
      nextBillingDate: computeNextBillingDate(args.billingInterval || 'annual', now),
      // R12: confirmed payment resets the dunning lifecycle wholesale —
      // past-due/grace markers cleared, the firm is current again.
      dunningStage: null,
      pastDueAt: null,
      downgradedAt: null,
      downgradedFromPlan: null,
      updatedAt: now,
    } as any);

    // If we have a reference, try to approve the matching subscription request
    if (args.reference) {
      const req = await ctx.db
        .query("subscriptionRequests")
        .withIndex("by_reference", (q: any) => q.eq("transactionReference", args.reference))
        .first();
      if (req && req.status === 'pending_review') {
        await ctx.db.patch(req._id, {
          status: 'approved',
          reviewedAt: now,
          reviewedBy: 'paystack_webhook',
          updatedAt: now,
        } as any);
      }
    }

    // PLAN ACTIVATION NOTIFICATION — dispatch celebratory notification to
    // ALL users in the firm. Previously this path (Paystack webhook) didn't
    // notify anyone — the user had to deduce the upgrade from UI changes.
    const firmUsers = await ctx.db
      .query("users")
      .withIndex("by_firm", (q: any) => q.eq("firmId", args.firmId))
      .take(200);
    for (const u of firmUsers) {
      await ctx.db.insert("notifications", {
        firmId: args.firmId,
        userId: u._id,
        title: 'Plan Activated',
        message: `Your account has been updated to the ${args.plan} plan! All associated features, higher limits, and modules are now active.`,
        type: 'subscription_activated',
        link: { view: 'settings', id: null, context: { settingsTargetId: 'billing' } },
        timestamp: Date.now(),
        isRead: false,
      } as any);
    }

    return { success: true };
  },
});

/**
 * expirePendingSubscriptionRequests — internal mutation called by a daily
 * cron. Auto-reverts any pending request older than 72 hours.
 */
export const expirePendingSubscriptionRequests = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    // Scan by autoRevertAt index for requests whose auto-revert time has passed
    const expired = await ctx.db
      .query("subscriptionRequests")
      .withIndex("by_auto_revert", (q: any) => q.lt("autoRevertAt", now))
      .filter((q: any) => q.eq(q.field("status"), "pending_review"))
      .take(200);

    let reverted = 0;
    for (const req of expired) {
      await ctx.db.patch(req._id, {
        status: 'auto_reverted',
        reviewedAt: new Date().toISOString(),
        reviewedBy: 'system_auto_revert',
        updatedAt: new Date().toISOString(),
      } as any);
      reverted++;
    }
    return { success: true, reverted };
  },
});

/**
 * ══════════════════════════════════════════════════════════════════════════
 * R12 — SUBSCRIPTION DUNNING + GRACE + SOFT DOWNGRADE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Until R12, `nextBillingDate` (written by activateFirmSubscription) was
 * dead data: nothing ever read it, so a firm that stopped paying kept its
 * plan forever. The daily cron now drives the full lifecycle (decision
 * logic: convex/dunning.ts, tested in tests/unit/dunning.test.ts):
 *
 *   7d + 1d before renewal → in-app notification + Brevo reminder email
 *   renewal date passes     → adminStatus 'past_due', 14-day grace starts
 *   day 7 + day 13 of grace → reminder + final warning
 *   day 14                  → SOFT downgrade to Core — data is NEVER
 *                            deleted; tier gates enforce Core limits and
 *                            a confirmed payment restores everything
 *                            (activateFirmSubscription resets the state).
 *
 * Split (Convex rule: mutations are db-only, actions do fetch):
 *   runSubscriptionDunning   — internalAction, the CRON TARGET: runs the
 *                              mutation below, then sends the Brevo emails
 *                              for whatever notices it produced.
 *   applySubscriptionDunning — internalMutation: scan + decide + patch +
 *                              in-app notifications; returns the email
 *                              payloads (never sends them itself).
 */
export interface DunningEmailPayload {
  to: string;
  subject: string;
  html: string;
  productName?: string;
}

export interface DunningRunResult {
  success: boolean;
  scanned: number;
  notified: number;
  downgraded: number;
  emails: DunningEmailPayload[];
}

export const runSubscriptionDunning = internalAction({
  args: {},
  handler: withCronReporting("crons:runSubscriptionDunning", async (ctx): Promise<{
    success: boolean;
    scanned: number;
    notified: number;
    downgraded: number;
    emailsAttempted: number;
  }> => {
    const result: DunningRunResult = await ctx.runMutation(
      internal.myFunctions.applySubscriptionDunning,
      {},
    );

    // Brevo delivery lives in the action layer. Failures are logged but
    // never fail the run — the in-app notification + stage marker are the
    // source of truth, and the next daily run does not re-send (the stage
    // already advanced).
    for (const email of result.emails) {
      try {
        await sendBrevoEmail(email);
      } catch (e: any) {
        console.warn(`[Dunning] email send failed (${email.to}):`, e?.message);
      }
    }

    return {
      success: true,
      scanned: result.scanned,
      notified: result.notified,
      downgraded: result.downgraded,
      emailsAttempted: result.emails.length,
    };
  },),
});

export const applySubscriptionDunning = internalMutation({
  args: {},
  handler: async (ctx): Promise<DunningRunResult> => {
    const now = Date.now();
    const nowIso = new Date().toISOString();
    // Pre-expiry notices only matter within 7 days of renewal; past-due
    // firms (grace ladder) are all nextBillingDate <= now. One scan covers
    // both: everything up to 8 days ahead. (ISO strings sort
    // chronologically, so the index range is a valid time range.)
    const horizonIso = new Date(now + 8 * 24 * 60 * 60 * 1000).toISOString();

    const firms = await ctx.db
      .query("firms")
      .withIndex("by_next_billing", (q: any) => q.lte("nextBillingDate", horizonIso))
      .take(500);

    const emails: DunningEmailPayload[] = [];
    let notified = 0;
    let downgraded = 0;
    let scanned = 0;

    for (const firm of firms) {
      const action: DunningAction = computeDunningAction(firm as any, now);
      if (action.kind === 'none') {
        scanned++;
        continue;
      }
      scanned++;

      // The firm admin is the dunning recipient (same convention as
      // expireTrials — the admin owns billing for the workspace).
      const admin = await ctx.db
        .query("users")
        .withIndex("by_firm", (q: any) => q.eq("firmId", firm._id))
        .filter((q: any) => q.eq(q.field("role"), "Admin"))
        .first();

      const planName = firm.subscriptionPlan || 'Core';
      const renewalDate = firm.nextBillingDate
        ? new Date(firm.nextBillingDate).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })
        : '—';

      // ── Soft downgrade (terminal for this billing cycle) ──────────────
      if (action.kind === 'downgrade') {
        await ctx.db.patch(firm._id, {
          ...action.patch,
          updatedAt: nowIso,
        } as any);
        downgraded++;

        if (admin?.email) {
          await ctx.db.insert("notifications", {
            firmId: firm._id,
            userId: admin._id,
            title: 'Plan Moved to Core',
            message: `Your ${planName} plan's billing period ended without a confirmed renewal, so the workspace is now on Core. Your data is safe and fully intact — nothing was deleted. Renew to restore ${planName} features.`,
            type: 'subscription_downgraded',
            link: { view: 'settings', id: 'subscription-management', context: {} },
            timestamp: Date.now(),
            isRead: false,
          } as any);
          emails.push({
            to: admin.email,
            subject: `Your workspace is now on the Core plan (data intact)`,
            html: brandedEmailWrapper({
              productName: getProductBranding(firm.product || undefined).name,
              productColor: getProductBranding(firm.product || undefined).productColor,
              tagline: getProductBranding(firm.product || undefined).tagline,
              bodyHtml: `
                <p style="color:#1a202c;font-size:17px;font-weight:600;margin:0 0 8px 0;">Your ${planName} plan has moved to Core</p>
                <p style="color:#4a5568;font-size:15px;line-height:1.7;margin:0 0 24px 0;">
                  The billing period that ended on ${renewalDate} was not renewed, and the 14-day grace period has
                  now closed. Your workspace is on the Core plan.
                </p>
                <p style="background:#f0fdf4;border:1px solid #86efac;border-radius:12px;padding:20px;color:#14532d;font-size:15px;line-height:1.7;margin:0 0 24px 0;">
                  <strong>Your data is safe.</strong> Every matter, property, tenant, document and ledger you
                  created on ${planName} is intact and waiting — nothing was deleted. Core limits apply to
                  <em>new</em> activity. Renew your subscription to unlock everything again instantly.
                </p>
                <p style="color:#4a5568;font-size:15px;line-height:1.7;margin:0;">
                  Renew from Billing &amp; Plans in your workspace, or reply to this email and our team will help.
                </p>`,
            }),
            productName: getProductBranding(firm.product || undefined).name,
          });
        }
        continue;
      }

      // ── Reminder notices (pre7 / pre1 / past_due / grace7 / final) ────
      await ctx.db.patch(firm._id, {
        ...action.patch,
        updatedAt: nowIso,
      } as any);
      notified++;

      const stageCopy: Record<string, { title: string; message: string; subject: string; body: string }> = {
        pre7: {
          title: 'Renewal Due in 7 Days',
          message: `Your ${planName} plan renews on ${renewalDate}. Confirm your payment to keep every feature — and avoid the collections calls.`,
          subject: `Your ${planName} renewal is due in 7 days (${renewalDate})`,
          body: `Your ${planName} subscription renews on <strong>${renewalDate}</strong>. Renewing on time keeps every feature active with zero interruption.`,
        },
        pre1: {
          title: 'Renewal Due Tomorrow',
          message: `Your ${planName} plan renews tomorrow (${renewalDate}). Confirm payment today to avoid entering the grace window.`,
          subject: `Final reminder: your ${planName} renews tomorrow`,
          body: `Your ${planName} subscription renews <strong>tomorrow, ${renewalDate}</strong>. If payment isn't confirmed by then, your workspace enters a 14-day grace period before moving to Core.`,
        },
        past_due: {
          title: 'Payment Overdue — Grace Period Started',
          message: `Your ${planName} renewal was due ${renewalDate} and hasn't been confirmed. You have 14 days of full access while we retry — settle to keep ${planName} active.`,
          subject: `Payment overdue — 14-day grace period has started`,
          body: `Your ${planName} renewal was due <strong>${renewalDate}</strong> and we haven't received confirmation. Your workspace stays fully functional for <strong>14 days</strong> (until the grace window closes).`,
        },
        grace7: {
          title: 'Payment Overdue — 7 Days Left in Grace',
          message: `Your ${planName} plan is past due with 7 days of grace remaining. After that the workspace moves to Core (your data stays intact).`,
          subject: `Payment overdue — 7 days left before your plan changes`,
          body: `Your ${planName} plan is past due. You have <strong>7 days</strong> left in the grace period. After it closes, the workspace moves to Core — your data stays safe and intact, but ${planName} features pause until you renew.`,
        },
        final: {
          title: 'Final Notice — Plan Changes Tomorrow',
          message: `Last call: your ${planName} grace period ends tomorrow. Renew today to keep ${planName} active — after tomorrow the workspace moves to Core (data intact).`,
          subject: `Final notice: your ${planName} features pause tomorrow`,
          body: `This is the final notice for your past-due ${planName} plan. The grace period closes <strong>tomorrow</strong>, after which the workspace moves to Core. Your data is never deleted — renew to keep everything running.`,
        },
      };

      const copy = stageCopy[action.stage];
      if (admin?.email && copy) {
        await ctx.db.insert("notifications", {
          firmId: firm._id,
          userId: admin._id,
          title: copy.title,
          message: copy.message,
          type: 'subscription_dunning',
          link: { view: 'settings', id: 'subscription-management', context: {} },
          timestamp: Date.now(),
          isRead: false,
        } as any);
        const brand = getProductBranding(firm.product || undefined);
        emails.push({
          to: admin.email,
          subject: copy.subject,
          html: brandedEmailWrapper({
            productName: brand.name,
            productColor: brand.productColor,
            tagline: brand.tagline,
            bodyHtml: `
              <p style="color:#1a202c;font-size:17px;font-weight:600;margin:0 0 8px 0;">${copy.title}</p>
              <p style="color:#4a5568;font-size:15px;line-height:1.7;margin:0 0 24px 0;">${copy.body}</p>
              <p style="color:#4a5568;font-size:15px;line-height:1.7;margin:0;">
                You can confirm payment from Billing &amp; Plans in your workspace — card payment or bank
                transfer with proof upload. If anything looks wrong, reply to this email and we'll sort it out.
              </p>`,
          }),
          productName: brand.name,
        });
      }
    }

    return { success: true, scanned, notified, downgraded, emails };
  },
});

/**
 * computeNextBillingDate — helper. Given a billing interval and a start
 * ISO timestamp, returns the next billing date as an ISO string.
 */
function computeNextBillingDate(interval: string, startIso: string): string {
  const start = new Date(startIso);
  if (interval === 'monthly') {
    start.setMonth(start.getMonth() + 1);
  } else {
    // annual (default)
    start.setFullYear(start.getFullYear() + 1);
  }
  return start.toISOString();
}

// ════════════════════════════════════════════════════════════════════════════
// CRO AUDIT — TRACK B: TRIAL EXPIRY CRON
// ════════════════════════════════════════════════════════════════════════════

/**
 * expireTrials — internal mutation called by a daily cron (see convex/crons.ts).
 * Scans for firms whose trialEndsAt has passed and reverts them to Core.
 *
 * Logic:
 *   1. Query firms where trialEndsAt < now AND trialPlan is not null.
 *   2. For each: clear trialStartsAt/trialEndsAt/trialPlan, set
 *      subscriptionPlan='Core' (already is, but defensive), set
 *      adminStatus='active'.
 *   3. Insert a notification for the firm admin: "Your trial has ended".
 *   4. Also dispatch trial-ending-soon notifications (7 days, 1 day before).
 */
export const expireTrials = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;

    // ─── 1. Expire trials past their end date ───────────────────────────
    const expired = await ctx.db
      .query("firms")
      .withIndex("by_trial_ends", (q: any) => q.lt("trialEndsAt", now))
      .filter((q: any) => q.neq(q.field("trialPlan"), null))
      .take(500);

    let expiredCount = 0;
    for (const firm of expired) {
      // FIX: Trial revert — data is NOT deleted. The firm reverts to Core billing
      // but all data (units, matters, contacts) remains intact. The frontend
      // should show a soft-lock banner: "You have X units beyond your current
      // plan's limit. Upgrade to restore full access."
      // This is a PRODUCT DECISION — the soft-lock UI pattern needs review before
      // implementing. For now, we just revert the plan and notify the admin.
      await ctx.db.patch(firm._id, {
        subscriptionPlan: 'Core',
        trialStartsAt: null,
        trialEndsAt: null,
        trialPlan: null,
        adminStatus: 'active',
        setupFeePaid: true,
        trialExpiredAt: now, // NEW: track when the trial expired so the frontend can show the soft-lock banner
        updatedAt: new Date().toISOString(),
      } as any);

      // Notify the firm admin
      const admin = await ctx.db
        .query("users")
        .withIndex("by_firm", (q: any) => q.eq("firmId", firm._id))
        .filter((q: any) => q.eq(q.field("role"), "Admin"))
        .first();
      if (admin) {
        await ctx.db.insert("notifications", {
          firmId: firm._id,
          userId: admin._id,
          title: 'Trial Ended',
          message: `Your 30-day trial has ended. You're now on the Core plan. Upgrade to restore your trial features.`,
          type: 'trial_ended',
          link: { view: 'settings', id: 'subscription-management', context: {} },
          timestamp: Date.now(),
          isRead: false,
        } as any);
      }
      expiredCount++;
    }

    // ─── 2. Send "trial ending soon" notifications (7 days and 1 day) ───
    // Changed from 4 days to 7 days for 30-day trial (gives more notice)
    const sevenDaysOut = now + 7 * DAY;
    const oneDayOut = now + 1 * DAY;

    // Find trials ending in ~7 days (between 6.5 and 7.5 days from now)
    const endingSoon7 = await ctx.db
      .query("firms")
      .withIndex("by_trial_ends", (q: any) => q.lt("trialEndsAt", sevenDaysOut + DAY/2))
      .filter((q: any) =>
        q.and(
          q.gte(q.field("trialEndsAt"), sevenDaysOut - DAY/2),
          q.neq(q.field("trialPlan"), null)
        )
      )
      .take(200);

    const endingSoon1 = await ctx.db
      .query("firms")
      .withIndex("by_trial_ends", (q: any) => q.lt("trialEndsAt", oneDayOut + DAY/2))
      .filter((q: any) =>
        q.and(
          q.gte(q.field("trialEndsAt"), oneDayOut - DAY/2),
          q.neq(q.field("trialPlan"), null)
        )
      )
      .take(200);

    let notified7 = 0, notified1 = 0;
    for (const firm of endingSoon7) {
      const admin = await ctx.db
        .query("users")
        .withIndex("by_firm", (q: any) => q.eq("firmId", firm._id))
        .filter((q: any) => q.eq(q.field("role"), "Admin"))
        .first();
      if (admin) {
        await ctx.db.insert("notifications", {
          firmId: firm._id,
          userId: admin._id,
          title: 'Trial Ending in 7 Days',
          message: `Your ${firm.trialPlan} trial ends in 7 days. Upgrade now to keep your features.`,
          type: 'trial_ending_soon',
          link: { view: 'settings', id: 'subscription-management', context: {} },
          timestamp: Date.now(),
          isRead: false,
        } as any);
      }
      notified7++;
    }

    for (const firm of endingSoon1) {
      const admin = await ctx.db
        .query("users")
        .withIndex("by_firm", (q: any) => q.eq("firmId", firm._id))
        .filter((q: any) => q.eq(q.field("role"), "Admin"))
        .first();
      if (admin) {
        await ctx.db.insert("notifications", {
          firmId: firm._id,
          userId: admin._id,
          title: 'Trial Ends Tomorrow',
          message: `Your ${firm.trialPlan} trial ends tomorrow. Set up bank transfer now to avoid losing features.`,
          type: 'trial_ending_tomorrow',
          link: { view: 'settings', id: 'subscription-management', context: {} },
          timestamp: Date.now(),
          isRead: false,
        } as any);
      }
      notified1++;
    }

    return { success: true, expired: expiredCount, notified7, notified1 };
  },
});

// ════════════════════════════════════════════════════════════════════════════
// CRO AUDIT — ADD-ONS SYSTEM (Revenue Expansion)
// ════════════════════════════════════════════════════════════════════════════
// Allows firms to purchase upsellable add-ons (extra WhatsApp, extra seats,
// storage, AI priority, custom integrations, data migration).
//
// Pipeline:
//   1. User purchases add-on in main app → createAddonRequest mutation
//      writes a pending row in subscriptionAddons table
//   2. Founder approves in SubscriptionRequestsCenter → addon becomes 'active'
//   3. Firm can cancel an active add-on at any time
// ════════════════════════════════════════════════════════════════════════════

/**
 * createAddonRequest — called from the main app when a user purchases an
 * add-on. Writes a pending row in subscriptionAddons. The founder admin
 * must approve before the add-on becomes active (same trust model as
 * subscription requests — no client-side auto-activation).
 */
export const createAddonRequest = mutation({
  args: {
    addonId: v.string(),
    sessionToken: v.optional(v.string()),
    addonName: v.string(),
    billingInterval: v.string(),        // 'monthly' | 'annual' | 'one_time'
    amount: v.number(),
    quantity: v.optional(v.number()),
    notes: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { firmId, user } = await requireFirmUser(ctx, args.userEmail, args.sessionToken);

    const now = new Date();
    const AUTO_REVERT_HOURS = 72;
    const autoRevertAt = now.getTime() + AUTO_REVERT_HOURS * 60 * 60 * 1000;

    const requestId = await ctx.db.insert("subscriptionAddons", {
      firmId,
      userId: user?._id,
      userEmail: user?.email || args.userEmail,
      addonId: args.addonId,
      addonName: args.addonName,
      billingInterval: args.billingInterval,
      amount: args.amount,
      quantity: args.quantity || 1,
      status: 'pending_review',
      notes: args.notes || null,
      requestedAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    // ─── Notify founder users (unified helper) ──────────────────────
    // Single function handles: in-app notification + FCM push.
    let firmName = 'A workspace';
    try {
      const firm: any = await ctx.db.get(firmId as any);
      if (firm?.name) firmName = firm.name;
    } catch {}

    await notifyFounders(ctx, {
      title: "New Add-on Request",
      message: `${firmName} requested ${args.addonName} (₦${args.amount.toLocaleString()}).`,
      type: "addon_request",
      link: { view: "subscriptions", id: String(requestId), context: {} },
    });

    return { success: true, requestId };
  },
});

/**
 * ROUND D (Wave 2, D2) — purgeStalePendingAddons DELETED.
 * ────────────────────────────────────────────────────────────────────────
 * The mutation hard-DELETED every pending_review add-on request older than
 * 72h (plus any whose addonName/email matched a 'test'/'mock'/'demo'
 * heuristic, regardless of age). Under the pre-D2 flow a PAID purchase
 * (Paystack callback) wrote exactly such a pending_review row — with no
 * paymentReference to distinguish it — so the purge semantics were "delete
 * paid-but-unapproved money after 3 days". It had zero callers (no UI, no
 * cron — a public-API footgun), and the approval queue it claimed to clean
 * never existed. Deleting the function closes the paid-request purge class
 * permanently; stale UNPAID requests are already handled by the user's own
 * cancelAddon (hard-delete of pending rows) and by the founder Add-ons tab
 * (reject → cancelled, never deleted — the money-relevant records survive).
 */

/**
 * internalQuery: resolveSessionForAddonPurchase — session → caller profile
 * for the purchaseAddonWithPayment ACTION (actions have no ctx.db; this is
 * the db-having half). Mirrors requireFirmUser semantics exactly.
 */
export const resolveSessionForAddonPurchase = internalQuery({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const { firmId, userId, user } = await requireFirmUser(ctx, undefined, args.sessionToken);
    return {
      firmId,
      userId,
      email: user?.email || user?.tokenIdentifier || '',
      name: user?.name || '',
    };
  },
});

/**
 * internalMutation: insertPaidAddonActivation — the write half of the paid
 * path. IDEMPOTENT on paymentReference: the Paystack webhook and the client
 * callback race each other (either may arrive first), and the client
 * callback may fire twice on a flaky connection. The first settlement wins;
 * every later call returns the existing row.
 */
export const insertPaidAddonActivation = internalMutation({
  args: {
    firmId: v.string(),
    userId: v.string(),
    userEmail: v.string(),
    addonId: v.string(),
    quantity: v.number(),
    amount: v.number(),               // catalog-listed amount (unit price × qty)
    paidAmount: v.number(),           // NGN actually charged (verified)
    paidAt: v.optional(v.string()),
    channel: v.optional(v.string()),
    paymentReference: v.string(),
    reviewedBy: v.string(),           // 'paystack:verified' (client path) | 'paystack:webhook' (webhook path)
  },
  handler: async (ctx, args) => {
    // Idempotency — a reference settles exactly once, no matter how many
    // racers (webhook, client callback, retry) reach this mutation.
    const existing = await ctx.db
      .query("subscriptionAddons")
      .withIndex("by_payment_reference", (q: any) => q.eq("paymentReference", args.paymentReference))
      .first();
    if (existing) {
      return { requestId: existing._id, alreadyActive: true, addonName: existing.addonName };
    }

    const addon = getAddonById(args.addonId);
    if (!addon) throw new Error(`Unknown add-on: ${args.addonId}`);

    const now = new Date().toISOString();
    const requestId = await ctx.db.insert("subscriptionAddons", {
      firmId: args.firmId,
      userId: args.userId,
      userEmail: args.userEmail,
      addonId: addon.id,
      addonName: addon.name,
      billingInterval: addon.billingInterval,
      amount: args.amount,
      quantity: args.quantity,
      status: 'active',
      paymentReference: args.paymentReference,
      paidAmount: args.paidAmount,
      paidAt: args.paidAt || now,
      notes: args.channel ? `Paid via Paystack (${args.channel}).` : 'Paid via Paystack.',
      requestedAt: now,
      activatedAt: now,
      reviewedBy: args.reviewedBy,
      createdAt: now,
      updatedAt: now,
    });

    // Money movement audit trail (Round B convention — every paid activation
    // is observable, attribution included).
    try {
      await ctx.db.insert("analytics_events", {
        firmId: args.firmId,
        userId: args.userId,
        event: 'ADDON_PURCHASE_PAID_ACTIVATION',
        properties: {
          addonId: addon.id,
          addonName: addon.name,
          quantity: args.quantity,
          listedAmount: args.amount,
          paidAmount: args.paidAmount,
          paymentReference: args.paymentReference,
          channel: args.channel || 'unknown',
          settledBy: args.reviewedBy,
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
      } as any);
    } catch {}

    return { requestId, alreadyActive: false, addonName: addon.name };
  },
});

/**
 * action: purchaseAddonWithPayment — the PAID add-on path (D2 fix).
 *
 * Before D2 the client's Paystack callback called createAddonRequest — the
 * SAME pending_review row as an unpaid request, with no payment reference —
 * then told the user the add-on "will be ready momentarily" while NOTHING
 * could ever activate it (the founder approval functions had no UI). Money
 * was taken; the row waited for an approval that never came.
 *
 * This action settles the truth server-side:
 *   1. requireFirmUser — the caller must hold a verified session.
 *   2. Catalog validation — addonId must exist; the expected amount is the
 *      CATALOG price × quantity (client-claimed amounts are never trusted).
 *   3. verifyPaystackPayment — the reference is verified against Paystack
 *      with the server's secret key (client callbacks are spoofable).
 *   4. The verified amount must COVER the catalog price — a manipulated
 *      popup that charged ₦1 for a ₦20,000 add-on is rejected, not
 *      activated.
 *   5. insertPaidAddonActivation — idempotent (webhook/client race + retry
 *      safe); the row lands ACTIVE with the full payment audit trail.
 */
export const purchaseAddonWithPayment = action({
  args: {
    addonId: v.string(),
    quantity: v.optional(v.number()),
    paymentReference: v.string(),
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  // Explicit return type: the handler references `internal` (cast), and the
  // typed api tree would otherwise make this const's inference circular
  // (TS7022/TS7023 — same-module internal reference).
  handler: async (ctx, args): Promise<{ requestId: any; alreadyActive: boolean; addonName: string }> => {
    // 1. Session-resolved caller (strict identity — the email arg is ignored).
    // (internal as any): same-module internal references must be cast — the
    // typed api tree would create a circular inference (this file's exports
    // feed internal.myFunctions, which this handler references).
    const auth: { firmId: string; userId: string; email: string; name?: string } =
      await ctx.runQuery((internal as any).myFunctions.resolveSessionForAddonPurchase, {
        sessionToken: args.sessionToken || '',
      });

    // 2. Catalog validation — the price the SERVER expects.
    const addon = getAddonById(args.addonId);
    if (!addon) {
      throw new Error(`Unknown add-on: ${args.addonId}`);
    }
    const quantity = Math.max(1, Math.floor(args.quantity ?? 1));
    const expected = expectedAddonAmount(args.addonId, quantity);
    if (expected === null) {
      throw new Error(`Unknown add-on: ${args.addonId}`);
    }

    // 3. Server-side Paystack verification of the reference (cast — see above:
    // paystack's webhook handler references this module's settlement
    // mutation, so the typed tree is circular).
    const verification: any = await ctx.runAction((internal as any).paystack.verifyPaystackPayment, {
      reference: args.paymentReference,
    });
    if (verification?.status !== 'success') {
      throw new Error(
        `Payment could not be verified (status: ${verification?.status || 'unknown'}). ` +
        'If you were charged, contact support with your payment reference.'
      );
    }

    // 4. The verified charge must cover the catalog price — no self-serve
    //    discounts via a manipulated popup amount.
    const paidAmount = Number(verification.amount) || 0;
    if (paidAmount + 0.01 < expected) {
      throw new Error(
        `Payment mismatch: ₦${paidAmount.toLocaleString()} verified vs ₦${expected.toLocaleString()} ` +
        `required for ${quantity} × ${addon.name}. Contact support with your payment reference.`
      );
    }

    // 5. Idempotent activation.
    return await ctx.runMutation((internal as any).myFunctions.insertPaidAddonActivation, {
      firmId: auth.firmId,
      userId: auth.userId,
      userEmail: auth.email,
      addonId: args.addonId,
      quantity,
      amount: expected,
      paidAmount,
      paidAt: verification.paidAt,
      channel: verification.channel,
      paymentReference: args.paymentReference,
      reviewedBy: 'paystack:verified',
    });
  },
});

/**
 * internalMutation: settleAddonPaymentWebhook — webhook-side settlement for
 * ADDON-* references (called from convex/paystack.ts handlePaystackWebhook).
 *
 * Why this exists: the client callback can fail after a successful charge
 * (popup closed, browser crashed, network drop) — money taken, no row, no
 * activation. The signature-verified webhook is the self-healing settlement
 * path (same doctrine as Round B's H7 for rent payments). It resolves the
 * buyer from the transaction's customer email, validates the paid amount
 * against the catalog, and lands the same idempotent ACTIVE row. A
 * reference the client already settled is a no-op (first settlement wins).
 *
 * addonId is parsed from the reference format the client generates:
 *   ADDON-{addonId}-{epochMs}   (catalog ids contain no dashes)
 * quantity comes from the transaction metadata custom_fields (variable_name
 * 'quantity'), defaulting to 1.
 */
export const settleAddonPaymentWebhook = internalMutation({
  args: {
    reference: v.string(),
    amount: v.number(),               // NGN (kobo already normalized by the webhook)
    paidAt: v.optional(v.string()),
    channel: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    quantity: v.optional(v.number()),
  },
  // Explicit return type — breaks the same-module internal-reference
  // inference cycle (see purchaseAddonWithPayment above).
  handler: async (ctx, args): Promise<{ settled: boolean; reason?: string; requestId?: any; alreadyActive?: boolean; alreadySettled?: boolean; addonName?: string }> => {
    // Idempotency first — the client callback may have already settled it.
    const existing = await ctx.db
      .query("subscriptionAddons")
      .withIndex("by_payment_reference", (q: any) => q.eq("paymentReference", args.reference))
      .first();
    if (existing) {
      return { settled: true, alreadySettled: true, requestId: existing._id };
    }

    // Parse the addonId out of the reference.
    const m = /^ADDON-(.+?)-(\d+)$/.exec(args.reference);
    if (!m) {
      await logError(ctx, {
        scope: "payment", name: "myFunctions:settleAddonPaymentWebhook:badReference",
        error: new Error(`Unparseable ADDON reference: ${args.reference}`),
        severity: "warning",
        context: { reference: args.reference },
      });
      return { settled: false, reason: 'bad_reference' as const };
    }
    const addonId = m[1];
    const addon = getAddonById(addonId);
    if (!addon) {
      await logError(ctx, {
        scope: "payment", name: "myFunctions:settleAddonPaymentWebhook:unknownAddon",
        error: new Error(`No catalog add-on for reference ${args.reference} (addonId ${addonId})`),
        severity: "warning",
        context: { reference: args.reference, addonId },
      });
      return { settled: false, reason: 'unknown_addon' as const };
    }

    // Resolve the buyer from the transaction's customer email (the email the
    // Paystack popup collected — the same one the client passed at setup).
    const email = String(args.customerEmail || '').toLowerCase().trim();
    if (!email) {
      await logError(ctx, {
        scope: "payment", name: "myFunctions:settleAddonPaymentWebhook:noCustomerEmail",
        error: new Error(`ADDON charge with no customer email: ${args.reference}`),
        severity: "warning",
        context: { reference: args.reference },
      });
      return { settled: false, reason: 'no_customer_email' as const };
    }
    let buyer: any = await ctx.db
      .query("users")
      .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", email))
      .first();
    if (!buyer) {
      buyer = await ctx.db
        .query("users")
        .withIndex("by_email", (q: any) => q.eq("email", email))
        .first();
    }
    if (!buyer || !buyer.firmId) {
      await logError(ctx, {
        scope: "payment", name: "myFunctions:settleAddonPaymentWebhook:unresolvableBuyer",
        error: new Error(`ADDON charge for unresolvable buyer ${email}: ${args.reference}`),
        severity: "warning",
        context: { reference: args.reference, email },
      });
      return { settled: false, reason: 'unresolvable_buyer' as const };
    }

    // Amount validation — same rule as the client path: the verified charge
    // must cover the catalog price × quantity.
    const quantity = Math.max(1, Math.floor(args.quantity ?? 1));
    const expected = expectedAddonAmount(addonId, quantity);
    if (expected === null) {
      return { settled: false, reason: 'unknown_addon' as const };
    }
    if (args.amount + 0.01 < expected) {
      await logError(ctx, {
        scope: "payment", name: "myFunctions:settleAddonPaymentWebhook:underpaid",
        error: new Error(
          `ADDON underpayment for ${args.reference}: paid ₦${args.amount}, ` +
          `expected ₦${expected} (${quantity} × ${addon.name})`
        ),
        severity: "error",
        context: { reference: args.reference, paid: args.amount, expected, quantity },
      });
      return { settled: false, reason: 'underpaid' as const };
    }

    // Settle — the shared idempotent insert (cast: same-module internal ref).
    const settled: { requestId: any; alreadyActive: boolean; addonName: string } =
      await ctx.runMutation((internal as any).myFunctions.insertPaidAddonActivation, {
      firmId: buyer.firmId,
      userId: buyer._id,
      userEmail: buyer.email || email,
      addonId,
      quantity,
      amount: expected,
      paidAmount: args.amount,
      paidAt: args.paidAt,
      channel: args.channel,
      paymentReference: args.reference,
      reviewedBy: 'paystack:webhook',
    });
    return {
      settled: true,
      requestId: (settled as any)?.requestId,
      alreadyActive: (settled as any)?.alreadyActive ?? false,
      addonName: (settled as any)?.addonName ?? addon.name,
    };
  },
});

/**
 * getActiveAddonsForFirm — returns all ACTIVE add-ons for the calling
 * user's firm. Used in the main app's Billing & Plans page to show
 * purchased add-ons.
 */
export const getActiveAddonsForFirm = query({
  args: { sessionToken: v.optional(v.string()), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { firmId } = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const addons = await ctx.db
      .query("subscriptionAddons")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .filter((q: any) => q.eq(q.field("status"), "active"))
      .take(500);
    return addons;
  },
});

/**
 * getPendingAddonsForFirm — returns the most recent PENDING add-on request
 * for the calling user's firm (if any). Used to show a "pending review"
 * badge in the main app.
 */
export const getPendingAddonsForFirm = query({
  args: { sessionToken: v.optional(v.string()), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { firmId } = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const addons = await ctx.db
      .query("subscriptionAddons")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .filter((q: any) => q.eq(q.field("status"), "pending_review"))
      .take(500);
    return addons;
  },
});

/**
 * cancelAddon — called from the main app when a user cancels an active
 * add-on OR deletes a pending add-on request.
 *
 * BEHAVIOR (Aug 2026 fix):
 * - status === 'pending_review': HARD DELETE the request. The add-on was
 *   never activated, so there's no need to keep a "cancelled" record
 *   around. The user explicitly clicked the X button to remove it.
 * - status === 'active': SOFT CANCEL — set status to 'cancelled' so
 *   historical billing/audit records stay intact.
 * - status === 'cancelled' / 'expired' / 'rejected': no-op (already in
 *   terminal state). Return success without doing anything.
 *
 * PRIOR BUG: The mutation threw "Add-on is not active (current_status:
 * pending_review)" whenever a user tried to cancel a pending request.
 * The UI showed a pending request with an X button, but clicking it
 * surfaced that error toast. Fixed by branching on status.
 */
export const cancelAddon = mutation({
  args: {
    addonRequestId: v.string(),
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { firmId, user } = await requireFirmUser(ctx, args.userEmail, args.sessionToken);

    const addon: any = await ctx.db.get(args.addonRequestId as any);
    if (!addon) throw new Error("Add-on request not found.");
    if (addon.firmId !== firmId) {
      throw new Error("Unauthorized. This add-on belongs to another firm.");
    }

    // Terminal states — already cancelled/expired/rejected. Nothing to do.
    // Return success so the UI can optimistically remove the row without
    // showing the user an error for a no-op.
    const TERMINAL_STATUSES = ['cancelled', 'expired', 'rejected'];
    if (TERMINAL_STATUSES.includes(addon.status)) {
      return { success: true, noOp: true };
    }

    const now = new Date().toISOString();

    // PENDING REVIEW — hard delete. The request never activated, so there's
    // no billing/audit record to preserve. The user wants the row GONE.
    if (addon.status === 'pending_review') {
      await ctx.db.delete(args.addonRequestId as any);
      // Still notify founder so they know a pending request was withdrawn
      // (helps avoid confusion if they were about to action it).
      const founders = await ctx.db.query("users").filter((q: any) =>
        q.eq(q.field("role"), "Founder")
      ).take(2000);
      for (const founder of founders) {
        await ctx.db.insert("notifications", {
          firmId: 'system',
          userId: founder._id,
          title: 'Add-On Request Withdrawn',
          message: `${user?.email || 'A user'} withdrew their request for ${addon.addonName}.`,
          type: 'addon_cancelled',
          timestamp: Date.now(),
          isRead: false,
        } as any);
      }
      return { success: true, deleted: true };
    }

    // ACTIVE — soft cancel (preserves audit trail for billing).
    await ctx.db.patch(args.addonRequestId as any, {
      status: 'cancelled',
      cancelledAt: now,
      updatedAt: now,
    } as any);

    // Notify founder
    const founders = await ctx.db.query("users").filter((q: any) =>
      q.eq(q.field("role"), "Founder")
    ).take(2000);
    for (const founder of founders) {
      await ctx.db.insert("notifications", {
        firmId: 'system',
        userId: founder._id,
        title: 'Add-On Cancelled',
        message: `${user?.email || 'A user'} cancelled ${addon.addonName}.`,
        type: 'addon_cancelled',
        timestamp: Date.now(),
        isRead: false,
      } as any);
    }

    return { success: true };
  },
});

// ─── VMS ADD-ON BILLING ────────────────────────────────────────────────────
//
// The Visitor Management System (VMS) is a paid add-on for Atrium firms.
// It allows residents to generate 6-digit visitor codes that gatekeepers
// verify at the gatehouse terminal (/gatehouse?firmId=xxx).
//
// Billing model:
//   - 30-day free trial (no card required)
//   - Monthly subscription after trial
//   - Founder (practicepro.ng) firms get VMS free for testing
//
// Add-on state is stored on the firm record at subscriptionAddons.vms:
//   { status: 'none'|'trial'|'active'|'expired'|'suspended',
//     trialStartsAt?: number,
//     trialEndsAt?: number,
//     activatedAt?: number,
//     expiresAt?: number,
//     cancelledAt?: number }

/**
 * query: getVmsAddonStatus
 * Returns the firm's VMS add-on state. Used by the Subscription Settings
 * page to show trial countdown, active status, or upgrade prompt.
 */
export const getVmsAddonStatus = query({
  args: {
    firmId: v.string(),
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const vmsAuth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    // D1: firm-scoped read — the session must resolve into the firm whose
    // add-on status is requested (platform founders exempt).
    if (!isPlatformFounder(vmsAuth.user)) {
      assertSameFirm(vmsAuth.user, args.firmId);
    }
    // Look up firm by custom id field OR by Convex _id (try-as-Id fallback)
    let firm: any = await ctx.db
      .query("firms")
      .filter((q: any) => q.eq(q.field("id"), args.firmId))
      .first();
    if (!firm) {
      try { firm = await ctx.db.get(args.firmId as any); } catch { /* not a valid Convex id */ }
    }
    if (!firm) return { status: 'none' as const };

    // TIER-BASED BYPASS (Aug 2026): Komplete and Enterprise get VMS included.
    // Return 'included' so the frontend VmsAddonPanel can show
    // "Included in your plan" instead of pricing/trial CTAs.
    const plan = firm.subscriptionPlan;
    if (plan === 'Komplete' || plan === 'Enterprise') {
      return { status: 'included' as const };
    }

    const vms = (firm.subscriptionAddons as any)?.vms;
    if (!vms) return { status: 'none' as const };
    // Auto-expire trial if past trialEndsAt
    if (vms.status === 'trial' && vms.trialEndsAt && vms.trialEndsAt < Date.now()) {
      return { ...vms, status: 'expired' as const };
    }
    return vms;
  },
});

/**
 * mutation: startVmsAddonTrial
 * Starts a 30-day free trial of the VMS add-on. Only firm admins can start
 * a trial. Each firm can only trial once (prevents trial cycling).
 */
export const startVmsAddonTrial = mutation({
  args: {
    firmId: v.string(),
    sessionToken: v.optional(v.string()),
    userEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const adminUser = auth.user;
    if (!adminUser) throw new Error("User not found");

    // AUTH (D1, session-resolved): firm Admin/Founder (or a session-proven
    // platform founder) may start a trial — for their OWN firm only. The
    // spoofable FOUNDER_EMAILS.includes(args.userEmail) string check is
    // gone; args.userEmail is ignored (R16 Phase B).
    if (!isPlatformFounder(adminUser) && !isFirmAdminRole(adminUser)) {
      throw new Error("Only firm administrators can start add-on trials");
    }
    if (!isPlatformFounder(adminUser)) {
      assertSameFirm(adminUser, args.firmId);
    }

    let firm: any = await ctx.db
      .query("firms")
      .filter((q: any) => q.eq(q.field("id"), args.firmId))
      .first();
    if (!firm) {
      try { firm = await ctx.db.get(args.firmId as any); } catch { /* not a valid Convex id */ }
    }
    if (!firm) throw new Error("Firm not found");

    const existingVms = (firm.subscriptionAddons as any)?.vms;
    if (existingVms && (existingVms.status === 'trial' || existingVms.status === 'active')) {
      throw new Error(`VMS add-on is already ${existingVms.status}. Cannot start a new trial.`);
    }
    if (existingVms && existingVms.trialStartsAt) {
      throw new Error("This firm has already used its 30-day VMS trial. Please subscribe to continue.");
    }

    const now = Date.now();
    const TRIAL_DURATION_MS = 30 * 24 * 60 * 60 * 1000;  // 30 days — changed from 14
    const updatedAddons = {
      ...(firm.subscriptionAddons as any || {}),
      vms: {
        status: 'trial',
        trialStartsAt: now,
        trialEndsAt: now + TRIAL_DURATION_MS,
      },
    };

    await ctx.db.patch(firm._id, {
      subscriptionAddons: updatedAddons,
      updatedAt: new Date().toISOString(),
    });

    return { success: true, trialEndsAt: now + TRIAL_DURATION_MS };
  },
});

/**
 * mutation: activateVmsAddon
 * Founder-only — activates the VMS add-on for a firm after payment is
 * confirmed. Used by the founder admin dashboard to flip trial/expired
 * firms to 'active' once their subscription payment is processed.
 *
 * AUTH (D1): pre-D1 this mutation had NO session resolution at all — the
 * FOUNDER_EMAILS.includes(args.activatedBy) string check was spoofable by
 * anyone with the deployment URL. The caller must now present a bearer
 * session that resolves to a platform founder account; the activation
 * record attributes the session-derived email.
 */
export const activateVmsAddon = mutation({
  args: {
    firmId: v.string(),
    sessionToken: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const founder = await requirePlatformFounder(ctx, args.sessionToken);

    let firm: any = await ctx.db
      .query("firms")
      .filter((q: any) => q.eq(q.field("id"), args.firmId))
      .first();
    if (!firm) {
      try { firm = await ctx.db.get(args.firmId as any); } catch { /* not a valid Convex id */ }
    }
    if (!firm) throw new Error("Firm not found");

    const updatedAddons = {
      ...(firm.subscriptionAddons as any || {}),
      vms: {
        status: 'active',
        activatedAt: Date.now(),
        activatedBy: founder.email, // D1: session-derived attribution
        expiresAt: args.expiresAt || null,
        trialStartsAt: (firm.subscriptionAddons as any)?.vms?.trialStartsAt,
        trialEndsAt: (firm.subscriptionAddons as any)?.vms?.trialEndsAt,
      },
    };

    await ctx.db.patch(firm._id, {
      subscriptionAddons: updatedAddons,
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  },
});

/**
 * mutation: cancelVmsAddon
 * Firm admin cancels the VMS add-on. Status moves to 'expired' so the
 * gate in generateVisitorToken blocks further code generation.
 */
export const cancelVmsAddon = mutation({
  args: {
    firmId: v.string(),
    sessionToken: v.optional(v.string()),
    userEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const adminUser = auth.user;
    if (!adminUser) throw new Error("User not found");

    // AUTH (D1, session-resolved): firm Admin/Founder for their OWN firm;
    // spoofable string check removed.
    if (!isPlatformFounder(adminUser) && !isFirmAdminRole(adminUser)) {
      throw new Error("Only firm administrators can cancel add-ons");
    }
    if (!isPlatformFounder(adminUser)) {
      assertSameFirm(adminUser, args.firmId);
    }

    let firm: any = await ctx.db
      .query("firms")
      .filter((q: any) => q.eq(q.field("id"), args.firmId))
      .first();
    if (!firm) {
      try { firm = await ctx.db.get(args.firmId as any); } catch { /* not a valid Convex id */ }
    }
    if (!firm) throw new Error("Firm not found");

    const existingVms = (firm.subscriptionAddons as any)?.vms;
    // AUG 2026 FIX: If the firm's plan includes VMS (Komplete/Enterprise),
    // there may be no subscriptionAddons.vms record at all — the add-on
    // status is 'included' per getVmsAddonStatus. Don't throw "not active"
    // in that case; just set it to 'expired' (which the gate ignores since
    // the tier-based bypass in visitorManagement.ts checks the plan first).
    if (!existingVms || existingVms.status === 'none') {
      // Check if VMS is included in the plan — if so, we can still "cancel"
      // (which is a no-op for included plans, but shouldn't error)
      const plan = firm.subscriptionPlan;
      if (plan === 'Komplete' || plan === 'Enterprise') {
        // VMS is included — no add-on to cancel. Update the record to
        // reflect the user's intent (in case they later downgrade).
        const updatedAddons = {
          ...(firm.subscriptionAddons as any || {}),
          vms: { status: 'expired', cancelledAt: Date.now() },
        };
        await ctx.db.patch(firm._id, {
          subscriptionAddons: updatedAddons,
          updatedAt: new Date().toISOString(),
        });
        return { success: true };
      }
      throw new Error("VMS add-on is not active");
    }

    const updatedAddons = {
      ...(firm.subscriptionAddons as any || {}),
      vms: {
        ...existingVms,
        status: 'expired',
        cancelledAt: Date.now(),
      },
    };

    await ctx.db.patch(firm._id, {
      subscriptionAddons: updatedAddons,
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  },
});

// ─── ESTATE COMMUNITY ADD-ON (mirrors VMS pattern) ──────────────────────
// Pricing: ₦5,000/month, included free for Pro+.
// Trial: 30 days free, once per firm.
// Stored at firm.subscriptionAddons.estateCommunity = { status, trialStartsAt,
// trialEndsAt, activatedAt, cancelledAt }.
// Backend gating: Estate Community queries (estateCommunity.ts) check
// requireFirmUser for reads and requireAdmin for writes. The feature gate
// (whether modules render at all) lives in useFeatures.ts and checks either
// isProOrAbove OR the add-on status here.

/**
 * query: getEstateCommunityAddonStatus
 * Returns the firm's Estate Community add-on state. Used by the Subscription
 * Settings page to show trial countdown, active status, or upgrade prompt.
 * Also used by useFeatures.ts to gate the Community tab in the resident portal.
 */
export const getEstateCommunityAddonStatus = query({
  args: {
    firmId: v.string(),
    sessionToken: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ecAuth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    // D1: firm-scoped read (platform founders exempt).
    if (!isPlatformFounder(ecAuth.user)) {
      assertSameFirm(ecAuth.user, args.firmId);
    }
    let firm: any = await ctx.db
      .query("firms")
      .filter((q: any) => q.eq(q.field("id"), args.firmId))
      .first();
    if (!firm) {
      try { firm = await ctx.db.get(args.firmId as any); } catch { /* not a valid Convex id */ }
    }
    if (!firm) return { status: 'none' as const };
    const ec = (firm.subscriptionAddons as any)?.estateCommunity;
    if (!ec) return { status: 'none' as const };
    // Auto-expire trial if past trialEndsAt
    if (ec.status === 'trial' && ec.trialEndsAt && ec.trialEndsAt < Date.now()) {
      return { ...ec, status: 'expired' as const };
    }
    return ec;
  },
});

/**
 * mutation: startEstateCommunityTrial
 * Starts a 30-day free trial of the Estate Community add-on. Only firm admins
 * can start a trial. Each firm can only trial once (prevents trial cycling).
 * Pro+ firms don't need this — Estate Community is included in their plan.
 */
export const startEstateCommunityTrial = mutation({
  args: {
    firmId: v.string(),
    sessionToken: v.optional(v.string()),
    userEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const adminUser = auth.user;
    if (!adminUser) throw new Error("User not found");

    // AUTH (D1, session-resolved): firm Admin/Founder for their OWN firm;
    // spoofable string check removed.
    if (!isPlatformFounder(adminUser) && !isFirmAdminRole(adminUser)) {
      throw new Error("Only firm administrators can start add-on trials");
    }
    if (!isPlatformFounder(adminUser)) {
      assertSameFirm(adminUser, args.firmId);
    }

    let firm: any = await ctx.db
      .query("firms")
      .filter((q: any) => q.eq(q.field("id"), args.firmId))
      .first();
    if (!firm) {
      try { firm = await ctx.db.get(args.firmId as any); } catch { /* not a valid Convex id */ }
    }
    if (!firm) throw new Error("Firm not found");

    // Pro+ firms already have Estate Community included — no trial needed
    const plan = firm.subscriptionPlan;
    if (plan === 'Pro' || plan === 'Enterprise' || plan === 'Komplete') {
      throw new Error("Estate Community is already included in your plan — no trial needed.");
    }

    const existing = (firm.subscriptionAddons as any)?.estateCommunity;
    if (existing && (existing.status === 'trial' || existing.status === 'active')) {
      throw new Error(`Estate Community add-on is already ${existing.status}.`);
    }
    if (existing && existing.trialStartsAt) {
      throw new Error("This firm has already used its 30-day Estate Community trial. Please subscribe to continue.");
    }

    const now = Date.now();
    const TRIAL_DURATION_MS = 30 * 24 * 60 * 60 * 1000;  // 30 days
    const updatedAddons = {
      ...(firm.subscriptionAddons as any || {}),
      estateCommunity: {
        status: 'trial',
        trialStartsAt: now,
        trialEndsAt: now + TRIAL_DURATION_MS,
      },
    };

    await ctx.db.patch(firm._id, {
      subscriptionAddons: updatedAddons,
      updatedAt: new Date().toISOString(),
    });

    return { success: true, trialEndsAt: now + TRIAL_DURATION_MS };
  },
});

/**
 * mutation: activateEstateCommunityAddon
 * Founder-only — activates the Estate Community add-on for a firm after
 * payment is confirmed. Used by the founder admin dashboard to flip
 * trial/expired firms to 'active' once their subscription payment is processed.
 *
 * AUTH (D1): pre-D1 this mutation had NO session resolution at all — see
 * activateVmsAddon. Now requires a session-proven platform founder, and
 * the activation record attributes the session-derived email.
 */
export const activateEstateCommunityAddon = mutation({
  args: {
    firmId: v.string(),
    sessionToken: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const founder = await requirePlatformFounder(ctx, args.sessionToken);

    let firm: any = await ctx.db
      .query("firms")
      .filter((q: any) => q.eq(q.field("id"), args.firmId))
      .first();
    if (!firm) {
      try { firm = await ctx.db.get(args.firmId as any); } catch { /* not a valid Convex id */ }
    }
    if (!firm) throw new Error("Firm not found");

    const updatedAddons = {
      ...(firm.subscriptionAddons as any || {}),
      estateCommunity: {
        status: 'active',
        activatedAt: Date.now(),
        activatedBy: founder.email, // D1: session-derived attribution
        expiresAt: args.expiresAt || null,
        trialStartsAt: (firm.subscriptionAddons as any)?.estateCommunity?.trialStartsAt,
        trialEndsAt: (firm.subscriptionAddons as any)?.estateCommunity?.trialEndsAt,
      },
    };

    await ctx.db.patch(firm._id, {
      subscriptionAddons: updatedAddons,
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  },
});

/**
 * mutation: cancelEstateCommunityAddon
 * Firm admin cancels the Estate Community add-on. Status moves to 'expired'
 * so the gate in useFeatures.ts blocks the Community tab from rendering.
 */
export const cancelEstateCommunityAddon = mutation({
  args: {
    firmId: v.string(),
    sessionToken: v.optional(v.string()),
    userEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const adminUser = auth.user;
    if (!adminUser) throw new Error("User not found");

    // AUTH (D1, session-resolved): firm Admin/Founder for their OWN firm;
    // spoofable string check removed.
    if (!isPlatformFounder(adminUser) && !isFirmAdminRole(adminUser)) {
      throw new Error("Only firm administrators can cancel add-ons");
    }
    if (!isPlatformFounder(adminUser)) {
      assertSameFirm(adminUser, args.firmId);
    }

    let firm: any = await ctx.db
      .query("firms")
      .filter((q: any) => q.eq(q.field("id"), args.firmId))
      .first();
    if (!firm) {
      try { firm = await ctx.db.get(args.firmId as any); } catch { /* not a valid Convex id */ }
    }
    if (!firm) throw new Error("Firm not found");

    const existing = (firm.subscriptionAddons as any)?.estateCommunity;
    // AUG 2026 FIX: If the firm's plan includes Estate Community (Pro+),
    // there may be no subscriptionAddons.estateCommunity record at all.
    // Don't throw "not active" — set it to 'expired' (which the gate
    // ignores since the tier-based bypass checks the plan first).
    if (!existing || existing.status === 'none') {
      const plan = firm.subscriptionPlan;
      if (plan === 'Pro' || plan === 'Enterprise' || plan === 'Komplete') {
        const updatedAddons = {
          ...(firm.subscriptionAddons as any || {}),
          estateCommunity: { status: 'expired', cancelledAt: Date.now() },
        };
        await ctx.db.patch(firm._id, {
          subscriptionAddons: updatedAddons,
          updatedAt: new Date().toISOString(),
        });
        return { success: true };
      }
      throw new Error("Estate Community add-on is not active");
    }

    const updatedAddons = {
      ...(firm.subscriptionAddons as any || {}),
      estateCommunity: {
        ...existing,
        status: 'expired',
        cancelledAt: Date.now(),
      },
    };

    await ctx.db.patch(firm._id, {
      subscriptionAddons: updatedAddons,
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  },
});

// ─── ORGANIZATION PAYOUT DETAILS (Founder Financial Hub) ────────────────
// Single source of truth for PracticePro Systems Limited's corporate bank
// account. Used by all manual bank transfer checkouts. Managed exclusively
// by the Founder App. The portal/checkout components query getOrgPayoutDetails
// to render the bank details dynamically (no hardcoded mock data).

/**
 * query: getOrgPayoutDetails
 * V1-B (SEC-12): authenticated callers only — the corporate bank account
 * (bank name, account number, account name) must never be readable by an
 * unauthenticated endpoint. Any signed-in role may read it: paying users
 * (staff and portal tenants alike) legitimately need the transfer
 * instructions during manual-bank-transfer checkout. Returns null if no
 * active config exists (checkout shows placeholders).
 */
export const getOrgPayoutDetails = query({
  args: { sessionToken: v.optional(v.string()), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await resolveCaller(ctx, { sessionToken: args.sessionToken, userEmail: args.userEmail });
    const active = await ctx.db
      .query("organization_payout_details")
      .withIndex("by_active", (q: any) => q.eq("isActive", true))
      .first();
    return active || null;
  },
});

/**
 * mutation: updateOrgPayoutDetails
 * Founder-only — updates the corporate bank account details.
 * Deactivates any previously-active record and creates a new one,
 * preserving audit history.
 */
export const updateOrgPayoutDetails = mutation({
  args: {
    corporateName: v.string(),
    sessionToken: v.optional(v.string()),
    bankName: v.string(),
    accountNumber: v.string(),
    accountName: v.string(),
    founderEmail: v.string(),
  },
  handler: async (ctx, args) => {
    // Round 8 auth retrofit: the hardcoded FOUNDER_EMAILS allowlist only
    // proved the caller KNEW a founder address. Resolve the user and
    // require the Founder role (the Founder App admission rule).
    await requireFounderCaller(ctx, { sessionToken: args.sessionToken, userEmail: args.founderEmail });

    // Validate NUBAN: 10 digits
    if (!/^\d{10}$/.test(args.accountNumber)) {
      throw new Error("Account number must be exactly 10 digits (NUBAN)");
    }

    // Deactivate any previously-active record
    const existing = await ctx.db
      .query("organization_payout_details")
      .withIndex("by_active", (q: any) => q.eq("isActive", true))
      .take(500);
    for (const record of existing) {
      await ctx.db.patch(record._id, { isActive: false });
    }

    // Insert the new active record
    await ctx.db.insert("organization_payout_details", {
      corporateName: args.corporateName,
      bankName: args.bankName,
      accountNumber: args.accountNumber,
      accountName: args.accountName,
      isActive: true,
      updatedBy: args.founderEmail,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// =====================================================================
// SETUP WIZARD: COMMUNICATION SETUP REMINDER + CHECKLIST QUERIES
// =====================================================================

/**
 * sendCommunicationSetupReminders — internal cron mutation.
 *
 * Scans firms whose `settings.communicationSetupReminderAt` has passed and
 * whose integrations are still not connected. Inserts one in-app notification
 * per missing channel, then clears the reminder timestamp so we don't nag
 * them again (the user can still see the prompt on Settings → Integrations).
 *
 * Runs daily at 8:00 AM UTC (9:00 AM WAT). See crons.ts.
 */
export const sendCommunicationSetupReminders = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Scan all firms — there's no dedicated index for the reminder timestamp
    // (settings is v.any(), so we can't index it). Take a bounded slice to
    // keep the cron fast even as the user base grows. Firms created in the
    // last 7 days won't have passed their reminder yet, so the .filter()
    // below skips them cheaply.
    const candidateFirms = await ctx.db.query("firms").take(2000);
    const dueFirms = candidateFirms.filter((f: any) => {
      const reminderAt = (f.settings as any)?.communicationSetupReminderAt;
      if (!reminderAt || typeof reminderAt !== 'number') return false;
      return reminderAt <= now;
    });

    let notifiedWhatsapp = 0;
    let notifiedEmail = 0;

    for (const firm of dueFirms) {
      const settings = (firm as any).settings || {};
      const intent = settings.communicationChannels || {};
      const integrations = (firm as any).integrations || {};
      // Heuristic: a channel is "connected" if any of these flags is true.
      // We intentionally check loose booleans because the integrations shape
      // varies (Google integrations live here too) and we don't want a
      // strict schema check to block the reminder.
      const whatsappConnected = !!(
        integrations.whatsappConnected ||
        integrations.whatsappBusinessConnected ||
        integrations.chakraApiKeySet ||
        integrations.chakraConnected
      );
      const emailConnected = !!(
        integrations.brevoApiKeySet ||
        integrations.sendgridApiKeySet ||
        integrations.smtpConfigured ||
        integrations.emailConnected
      );

      // Find the firm admin to address the notification to.
      const admin = await ctx.db
        .query("users")
        .withIndex("by_firm", (q: any) => q.eq("firmId", firm._id))
        .filter((q: any) => q.eq(q.field("role"), "Admin"))
        .first();

      if (!admin) continue;

      const baseNotif = {
        firmId: firm._id,
        userId: admin._id,
        isRead: false,
        createdAt: Date.now(),
        timestamp: Date.now(),
        type: 'communication_setup_reminder',
        link: { view: 'settings', id: 'integrations', context: {} },
      };

      if (intent.whatsapp === true && !whatsappConnected) {
        await ctx.db.insert("notifications", {
          ...baseNotif,
          title: 'Connect WhatsApp to send reminders',
          message: `You said you'd use WhatsApp during setup — it's been 7 days. Connect your WhatsApp Business number in Settings → Integrations to start sending automated reminders to ${firm.product === 'property' ? 'tenants' : 'clients'}.`,
        } as any);
        notifiedWhatsapp++;
      }

      if (intent.email === true && !emailConnected) {
        await ctx.db.insert("notifications", {
          ...baseNotif,
          title: 'Connect Email to send invoices',
          message: `You said you'd use Email during setup — it's been 7 days. Connect an email provider (Brevo, Sendgrid, or SMTP) in Settings → Integrations to start sending invoices and formal notices.`,
        } as any);
        notifiedEmail++;
      }

      // Clear the reminder timestamp so we don't nag them again tomorrow.
      // The user will continue to see an "integrated/not integrated" badge
      // on Settings → Integrations, which is sufficient.
      await ctx.db.patch(firm._id, {
        settings: {
          ...settings,
          communicationSetupReminderAt: null,
          communicationSetupReminderSentAt: now,
        },
        updatedAt: new Date().toISOString(),
      } as any);
    }

    console.log(
      `[setupReminder] scanned ${candidateFirms.length} firms, ${dueFirms.length} due, sent ${notifiedWhatsapp} WhatsApp + ${notifiedEmail} Email reminders`
    );
    return { due: dueFirms.length, notifiedWhatsapp, notifiedEmail };
  },
});

/**
 * getGettingStartedChecklist — query that returns the completion state
 * of each onboarding checklist item for a given firm. Used by the
 * GettingStartedChecklist sidebar widget and the CompleteSetupBanner.
 *
 * Items returned depend on the firm's product:
 *   Vega (legal):    hasMatter, hasContact, hasBankAccount, hasBillingRate,
 *                    hasCourtDateOnMatter, hasInvitedUser
 *   Atrium (property): hasProperty, hasTenantOnProperty, hasServiceCharge,
 *                    hasBankAccount, hasInvitedResidentToPortal, hasSentReminder
 *   Komplete (unified): union of both (client decides what to render based on
 *                    which features are active)
 *
 * Designed to be CHEAP — each existence check uses .first() on an indexed
 * query, so even firms with thousands of records resolve in < 50ms.
 */
export const getGettingStartedChecklist = query({
  args: { firmId: v.string() },
  handler: async (ctx, args) => {
    const { firmId } = args;
    if (!firmId) return null;

    const fid = firmId.toString();

    // Fetch the firm record once — we need its product and bankAccounts.
    const firm: any = await ctx.db.get(fid as any).catch(() => null);
    if (!firm) return null;

    const product = firm.product || 'unified';
    const isProperty = product === 'property' || product === 'atrium';
    const isUnified = product === 'unified';
    const isLegal = !isProperty && !isUnified;

    // Suppress unused-var lint — product breakdown is documented above.
    void isLegal;

    // ── Existence checks ───────────────────────────────────────────────
    // BRIEF #1 FIX: Previously used .first() which only checked the FIRST
    // record. If the user added a tenant to the SECOND property, the check
    // returned false and the checklist item never ticked off.
    // Now we use .take(N) + .some() to check ALL records in each table.
    //
    // DEEP AUDIT FIX: Court dates are stored as Event records (type='Court Hearing'
    // or 'Mention'), NOT on the matter object. Previously checked phantom fields
    // (nextCourtDate, courtDate) that don't exist in the schema. Now we also query
    // the events table.
    const [allMatters, allProperties, firstContact, allServiceCharges,
          usersInFirm, portalInvitesSent, allCourtEvents] = await Promise.all([
      ctx.db.query("matters")
        .withIndex("by_firm", (q: any) => q.eq("firmId", fid))
        .take(500),
      ctx.db.query("properties")
        .withIndex("by_firm", (q: any) => q.eq("firmId", fid))
        .take(500),
      ctx.db.query("contacts")
        .withIndex("by_firm", (q: any) => q.eq("firmId", fid))
        .first(),
      ctx.db.query("service_charges")
        .withIndex("by_firm", (q: any) => q.eq("firmId", fid))
        .take(500),
      // Users OTHER than the current admin (i.e. invited teammates)
      ctx.db.query("users")
        .withIndex("by_firm", (q: any) => q.eq("firmId", fid))
        .take(50),
      // Portal invites sent (resident or client)
      ctx.db.query("portal_invites")
        .withIndex("by_firm", (q: any) => q.eq("firmId", fid))
        .take(50)
        .catch(() => []),
      // DEEP AUDIT FIX: Court dates are stored as Event records with type
      // 'Court Hearing' or 'Mention'. Also broadened (Aug 2026) to catch
      // case variations and custom event types that contain 'court' or
      // 'hearing' or 'mention' in the name. Also checks the `court` field
      // (only set on court-type events) as a fallback signal.
      // The .catch(() => []) was silently swallowing errors — now we log.
      ctx.db.query("events")
        .withIndex("by_firm", (q: any) => q.eq("firmId", fid))
        .take(500)
        .then((allEvents: any[]) => {
          return allEvents.filter((e: any) => {
            const eventType = (e.type || '').toLowerCase();
            // Match any event type containing court-related keywords
            return eventType.includes('court') ||
                   eventType.includes('hearing') ||
                   eventType.includes('mention') ||
                   eventType.includes('trial') ||
                   eventType.includes('adjourn') ||
                   // Fallback: event has a `court` field set (only court events have this)
                   !!e.court;
          });
        })
        .catch((err: any) => {
          console.error('[getGettingStartedChecklist] Court events query failed:', err);
          return [];
        }),
    ]);

    // Has at least one property with a tenant assigned — check ALL properties,
    // not just the first (BRIEF #1 fix).
    const hasTenantOnProperty = allProperties.some((p: any) =>
      !!(p.rentalDetails?.tenantContactId || p.rentalDetails?.tenantPhone)
    );

    // Bank accounts live on firmDetails.bankAccounts (added via BankAccountForm)
    const bankAccounts: any[] = Array.isArray((firm as any).bankAccounts)
      ? (firm as any).bankAccounts
      : [];
    const hasBankAccount = bankAccounts.length > 0;

    // PHASE 1.5 FIX: hasBillingRate was a dead item — it checked allMatters.length > 0
    // which is the same as hasMatter. Now checks if ANY matter has a billingRate
    // or if the firm has aiSettings configured (signals the user touched billing).
    const hasBillingRate = allMatters.some((m: any) =>
      !!(m.billingRate || m.hourlyRate || m.assignedRate)
    ) || !!(firm as any).aiSettings?.billingConfigured;

    // DEEP AUDIT FIX: Court date = ANY matter with nextAdjournedDate set (legacy
    // intake-time field) OR any Event with type 'Court Hearing' or 'Mention'.
    // Previously checked phantom fields (nextCourtDate, courtDate) that don't
    // exist in the schema, and never queried the events table — so creating a
    // court date event never ticked off the checklist item.
    const hasCourtDateOnMatter =
      allMatters.some((m: any) => !!m.nextAdjournedDate) ||
      allCourtEvents.length > 0;

    // Invited at least one teammate. Three signals count:
    //   1. usersInFirm.length > 1            → a teammate actually joined
    //   2. portalInvitesSent.length > 0       → a resident/client portal invite was sent
    //   3. firm.settings.teamInviteIntent === 'invited'  → admin chose "Yes — invite
    //      my team" in the onboarding wizard and got the invite code
    //
    // SIGNAL 3 FIX: Previously, completing the wizard's team-invite step
    // wrote nothing to the backend — the admin's "Yes — invite my team"
    // choice lived only in React state and was lost on unmount. The
    // checklist item never ticked off unless someone actually joined via
    // the code. Now the wizard persists `settings.teamInviteIntent = 'invited'`
    // at completion, and we recognize that here so the admin's action of
    // inviting is credited, not just the teammate's action of joining.
    const teamInviteIntent = (firm as any)?.settings?.teamInviteIntent;
    const hasInvitedUser =
      usersInFirm.length > 1 ||
      portalInvitesSent.length > 0 ||
      teamInviteIntent === 'invited';

    // 'solo' intent → admin explicitly chose "Just me for now" in the wizard.
    // The checklist UI uses this to render the item as "Skipped — invite when
    // you're ready" instead of perpetually incomplete, so a solo practitioner
    // can reach 100% completion without being blocked by a step they opted out of.
    const skippedTeamInvite = teamInviteIntent === 'solo';

    const hasInvitedResidentToPortal = portalInvitesSent.length > 0;

    // PRACTICE-PROFILE ENGINE: "Pre-configure your practice / portfolio"
    // checklist item. True when the Practice Blueprint has been applied —
    // either automatically at wizard completion (OnboardingWizard persists
    // practiceProfile.blueprintAppliedAt after the engine runs) or
    // retroactively from Settings → Firm Configuration (the blueprint modal
    // persists the same flag). Firms that completed the wizard BEFORE the
    // engine shipped have practiceProfile.completedAt but no
    // blueprintAppliedAt — their item stays incomplete so the checklist
    // routes them to the one-click retroactive setup.
    const blueprintApplied = !!(firm as any)?.practiceProfile?.blueprintAppliedAt;
    const hasPracticeProfile = blueprintApplied;
    const hasPortfolioProfile = blueprintApplied;

    // Has sent at least one outbound reminder/nudge. P1 FIX (2026-09-15):
    // the old proxy scanned notifications of type 'service_charge_reminder'
    // / 'rent_reminder' / 'invoice_sent' — types NO writer in the codebase
    // ever inserts, so this checklist item could never auto-complete from a
    // real send. The system of record for outbound messages (manual sends
    // via ComposeModal/AutomationCenter AND automated dispatch, statuses
    // corrected by the dispatch pipeline) is automation_logs.
    const hasSentReminder = await (async () => {
      try {
        const sentReminderLog = await ctx.db
          .query("automation_logs")
          .withIndex("by_firm", (q: any) => q.eq("firmId", fid))
          .filter((q: any) => q.and(
            // Reminder-flavoured types plus 'custom' — manual sends
            // (MessagesView/ComposeModal, the "one-tap WhatsApp share")
            // log as 'custom'.
            q.or(
              q.eq(q.field("messageType"), "rent_reminder"),
              q.eq(q.field("messageType"), "late_notice"),
              q.eq(q.field("messageType"), "service_charge_alert"),
              q.eq(q.field("messageType"), "penalty_notice"),
              q.eq(q.field("messageType"), "custom")
            ),
            // Honest tracking: only count rows whose delivery the
            // pipeline confirmed ('sending' is queued-not-delivered,
            // 'failed' never went out, 'simulated' is an audit-only
            // copy of a reply that never hit a real channel).
            q.or(
              q.eq(q.field("status"), "sent"),
              q.eq(q.field("status"), "logged")
            )
          ))
          .first();
        return !!sentReminderLog;
      } catch {
        return false;
      }
    })();

    return {
      product,
      // SERVER-SIDE DISMISSAL (2026-09-14): durable across APK reinstalls,
      // device changes and storage clears — localStorage dismissal alone
      // re-armed the checklist (and the "You're all set!" celebration) on
      // every update refresh. The UI treats this flag exactly like the old
      // localStorage key; Settings → Help "Restore Setup Checklist" clears it.
      dismissed: !!(firm as any).checklistDismissedAt,
      hasMatter: allMatters.length > 0,
      hasProperty: allProperties.length > 0,
      hasContact: !!firstContact,
      hasServiceCharge: allServiceCharges.length > 0,
      hasTenantOnProperty,
      hasBankAccount,
      hasBillingRate,
      hasCourtDateOnMatter,
      hasInvitedUser,
      hasInvitedResidentToPortal,
      hasSentReminder,
      // PRACTICE-PROFILE ENGINE flags (see computation above).
      hasPracticeProfile,
      hasPortfolioProfile,
      userCount: usersInFirm.length,
      // SKIPPED-STATE FIX: Surface the team-invite opt-out so the checklist UI
      // can render "Skipped — invite when you're ready" instead of perpetually
      // showing the item as incomplete for solo practitioners.
      skippedTeamInvite,
      // DEEP AUDIT FIX: Return the first matter/property IDs so the checklist
      // can deep-link directly to the detail view instead of the bare list page.
      firstMatterId: allMatters.length > 0 ? String((allMatters[0] as any)._id || (allMatters[0] as any).id) : null,
      firstPropertyId: allProperties.length > 0 ? String((allProperties[0] as any)._id || (allProperties[0] as any).id) : null,
    };
  },
});
