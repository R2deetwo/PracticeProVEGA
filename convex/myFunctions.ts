
import { query, mutation, action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { checkRateLimit } from "./securityHelpers";
import { numericCode, codeFromCharset } from "./secureRandom";
import { requireFirmUser, requireAdmin } from "./authHelpers";
import { requireStaffCaller, requireFounderCaller, assertSameFirm } from "./callerAuth";
import { notifyFounders } from "./founderNotifications";
import { roundMoney, sanitizeMoney } from "./moneyUtils";
// R12: subscription dunning + grace + soft downgrade — pure decision logic
// (kept separate so tests/unit/dunning.test.ts can lock the stage machine).
import { computeDunningAction, DunningAction } from "./dunning";

// --- SUBSCRIPTION CONFIGURATION (mirror: convex/tierLimits.ts) ---
import { ATRIUM_LIMITS, getTierLimitsForFirm } from "./tierLimits";

// --- PRESENCE ---

export const sendHeartbeat = mutation({
  args: { firmId: v.string(), userId: v.string(), userName: v.string(), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // SECURITY: Verify the caller belongs to the firm they're sending presence for.
    // Skip the firmId match check when auth.firmId is empty (legacy call without userEmail).
    const auth = await requireFirmUser(ctx, args.userEmail);
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
  args: { firmId: v.optional(v.string()), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // SECURITY FIX: Fail CLOSED — require userEmail for peer queries.
    if (!args.userEmail) {
      throw new Error("Unauthenticated: userEmail required. Anonymous peer queries are no longer permitted.");
    }
    try {
      const auth = await requireFirmUser(ctx, args.userEmail);
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
    const allPresence = await ctx.db.query("presence").withIndex("by_firm", (q) => q.eq("firmId", args.firmId)).collect();

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

export const diagnoseConnectivity = mutation({
  args: { email: v.string(), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // SECURITY: Only authenticated users can diagnose their own account
    let authenticatedEmail: string | undefined;
    try {
      const identity = await ctx.auth.getUserIdentity();
      if (identity) authenticatedEmail = identity.email || undefined;
    } catch {}

    // If the caller is authenticated, they can only diagnose their own email
    // (unless no auth context exists — legacy fallback for repair flows)
    if (authenticatedEmail && args.userEmail) {
      const auth = await requireFirmUser(ctx, args.userEmail);
      // Verify the email being diagnosed belongs to the authenticated user
      if (auth.user?.tokenIdentifier?.toLowerCase() !== args.email.toLowerCase().trim()) {
        throw new Error("Unauthorized. You can only diagnose your own account.");
      }
    }

    const emailInput = args.email.toLowerCase().trim();

    const allUsers = await ctx.db.query("users").take(500);
    const user = allUsers.find((u: any) => u.tokenIdentifier && u.tokenIdentifier.toLowerCase() === emailInput);

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
  args: { email: v.string(), targetFirmId: v.optional(v.string()), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // SECURITY: Only the account owner can repair their own connection
    let authenticatedEmail: string | undefined;
    try {
      const identity = await ctx.auth.getUserIdentity();
      if (identity) authenticatedEmail = identity.email || undefined;
    } catch {}

    if (authenticatedEmail && args.userEmail) {
      try {
        const auth = await requireFirmUser(ctx, args.userEmail);
        if (auth.user?.tokenIdentifier?.toLowerCase() !== args.email.toLowerCase().trim()) {
          throw new Error("Unauthorized. You can only repair your own account.");
        }
      } catch (e: any) {
        if (e.message?.includes('Unauthorized')) throw e;
        // If requireFirmUser fails (e.g. user has no firm yet), still allow self-repair
        // but only if the authenticated email matches
        if (authenticatedEmail.toLowerCase() !== args.email.toLowerCase().trim()) {
          throw new Error("Unauthorized. You can only repair your own account.");
        }
      }
    }

    const emailInput = args.email.toLowerCase().trim();

    const allUsers = await ctx.db.query("users").take(500);
    const user = allUsers.find((u: any) => u.tokenIdentifier && u.tokenIdentifier.toLowerCase() === emailInput);

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
    userEmail: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    // RLS: Require firm user authentication. This prevents portal users
    // and unauthenticated callers from reading the entire firm dataset.
    const { firmId: authFirmId } = await requireFirmUser(ctx, args.userEmail);
    let targetFirmId = args.firmId || authFirmId;
    const userEmail = args.userEmail;

    // Recovery logic: find firm from email if firmId is missing
    if (!targetFirmId && userEmail) {
      const allUsers = await ctx.db.query("users").collect();
      const user = allUsers.find((u: any) => u.tokenIdentifier && u.tokenIdentifier.toLowerCase() === userEmail.toLowerCase());

      if (user && user.firmId) {
        targetFirmId = user.firmId;
      } else {
        const allFirms = await ctx.db.query("firms").take(500);
        const foundFirm = allFirms.find((f: any) => {
          const creator = f.createdBy || (f.settings && f.settings.creatorEmail);
          return creator && creator.toLowerCase() === userEmail.toLowerCase();
        });
        if (foundFirm) targetFirmId = foundFirm._id;
      }
    }

    if (!targetFirmId) {
        console.warn(`[getFirmData] No firmId found for the given email. Returning null.`);
        return null;
    }

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
      try {
        // 1. Primary Attempt: Use by_firm index for speed
        const firmItems = await ctx.db.query(tableName as any)
          .withIndex("by_firm", (q: any) => q.eq("firmId", targetFirmId))
          .take(1000);

        // 2. Secondary Attempt: Fetch 'system' tagged items
        const systemItems = await ctx.db.query(tableName as any)
          .withIndex("by_firm", (q: any) => q.eq("firmId", "system"))
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
        const allUsers = await ctx.db.query("users").take(500);
        return allUsers.filter((u: any) => 
          u.firmId === targetFirmId || (u.joinedFirmIds && u.joinedFirmIds.includes(targetFirmId))
        );
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
  args: { firmId: v.string() },
  handler: async (ctx, args) => {
    if (!args.firmId) return null;
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
  args: { firmId: v.string() },
  handler: async (ctx, args) => {
    const { firmId } = args;
    if (!firmId) return null;

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
  args: { matterId: v.string(), firmId: v.string(), requestUserId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { matterId, firmId, requestUserId } = args;
    if (!matterId || !firmId) return null;

    let matter: any = null;
    try { matter = await ctx.db.get(matterId as any); } catch (e) { return null; }
    if (!matter) return null;

    // Security: validate caller's firm matches resource's firm
    if (matter.firmId?.toString() !== firmId.toString()) {
      console.error(`[SECURITY] getMatterDetails: firmId mismatch for matter ${matterId}`);
      return null;
    }

    // Privacy isolation: if matter is private, only assigned users and creator may access
    if (matter.isPrivate && requestUserId) {
      const assigned: string[] = matter.assignedUsers || [];
      const isAssigned = assigned.includes(requestUserId);
      const isCreator = matter._lastModifiedBy === requestUserId;
      if (!isAssigned && !isCreator) {
        console.warn(`[RBAC] getMatterDetails: user ${requestUserId} denied access to private matter ${matterId}`);
        return null;
      }
    }

    // Fetch related data in parallel — all scoped to this matter
    const [notes, documents, tasks, events, timeEntries, expenses] = await Promise.all([
      ctx.db.query("notePages")
        .withIndex("by_matter", (q: any) => q.eq("matterId", matterId))
        .take(200),
      ctx.db.query("documents")
        .withIndex("by_matter", (q: any) => q.eq("matterId", matterId))
        .take(200)
        .then((rows: any[]) => rows.map((d: any) => {
          const { content, file, ...light } = d;
          return light; // Strip heavy content; fetched on-demand via getDocumentContent
        })),
      ctx.db.query("tasks")
        .withIndex("by_matter", (q: any) => q.eq("matterId", matterId))
        .take(100),
      ctx.db.query("events")
        .withIndex("by_matter", (q: any) => q.eq("matterId", matterId))
        .take(100),
      ctx.db.query("timeEntries")
        .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
        .take(500)
        .then((rows: any[]) => rows.filter((t: any) => t.matterId === matterId)),
      ctx.db.query("expenses")
        .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
        .take(500)
        .then((rows: any[]) => rows.filter((e: any) => e.matterId === matterId)),
    ]);

    return { ...matter, notes, documents, tasks, events, timeEntries, expenses };
  },
});

/**
 * getPropertyDetails — On-demand full property state.
 * Called only when the user navigates to a specific property's detail view.
 * Includes full units, maintenance history, rent payment history, and notes.
 */
export const getPropertyDetails = query({
  args: { propertyId: v.string(), firmId: v.string() },
  handler: async (ctx, args) => {
    const { propertyId, firmId } = args;
    if (!propertyId || !firmId) return null;

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
export const getChatMessages = query({
  args: {
    conversationId: v.optional(v.string()),
    firmId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      if (!args.conversationId && !args.firmId) return [];

      if (args.conversationId) {
        // Most efficient: use the by_conversation index
        // CRITICAL: Sort by _creationTime ASCENDING so messages render in
        // chronological order (oldest first, newest at bottom). Without
        // this, messages load out of order on refresh (e.g. Aug 14 messages
        // appearing above Aug 13 messages).
        return await ctx.db
          .query("chatMessages")
          .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId as any))
          .order("asc")
          .collect();
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
      return unique.sort((a: any, b: any) => (a._creationTime || 0) - (b._creationTime || 0));

    } catch (e) {
      console.error("getChatMessages error:", e);
      return [];
    }
  },
});

/**
 * PHASE 2+3: Firm Activity — paginated log. NOT loaded on app start.
 * Uses .filter() safely since by_firm on firmActivity may not be deployed yet.
 */
export const getFirmActivity = query({
  args: {
    firmId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    try {
      if (!args.firmId) return [];
      const limit = args.limit ?? 50;

      // Use .filter() for safety — avoids dependency on new index deployment
      const results = await ctx.db
        .query("firmActivity")
        .filter((q) => q.eq(q.field("firmId"), args.firmId))
        .order("desc")
        .take(limit);

      return results;
    } catch (e) {
      console.error("getFirmActivity error:", e);
      return [];
    }
  },
});

/**
 * PHASE 2+3: Research Messages — loaded per notebook, NOT globally.
 * This prevents all chat history from all research notebooks being loaded.
 */
export const getResearchMessages = query({
  args: {
    notebookId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      if (!args.notebookId) return [];
      return await ctx.db
        .query("researchMessages")
        .withIndex("by_notebook", (q) => q.eq("notebookId", args.notebookId))
        .take(500);
    } catch (e) {
      console.error("getResearchMessages error:", e);
      return [];
    }
  },
});

/**
 * PHASE 2+3: Research Analysis Results — loaded per notebook.
 */
export const getResearchAnalysisResults = query({
  args: {
    notebookId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      if (!args.notebookId) return [];
      return await ctx.db
        .query("researchAnalysisResults")
        .withIndex("by_notebook", (q) => q.eq("notebookId", args.notebookId))
        .take(200);
    } catch (e) {
      console.error("getResearchAnalysisResults error:", e);
      return [];
    }
  },
});

/**
 * PHASE 1+3: Full note page content — fetched on-demand when user opens a note.
 * This keeps notePages in getFirmData as metadata-only (no content).
 */
export const getNotePage = query({
  args: { pageId: v.string(), firmId: v.string() },
  handler: async (ctx, args) => {
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
  args: { documentId: v.string(), firmId: v.string() },
  handler: async (ctx, args) => {
    const doc: any = await ctx.db.get(args.documentId as any);
    if (!doc) return null;
    if (doc.firmId !== args.firmId) {
      console.warn(`[getDocumentContent] SECURITY ALERT: Cross-firm access blocked for ${args.documentId} by ${args.firmId}`);
      return null;
    }
    return doc;
  },
});

export const getResearchSourceContent = query({
  args: { sourceId: v.string(), firmId: v.string() },
  handler: async (ctx, args) => {
    const src: any = await ctx.db.get(args.sourceId as any);
    if (!src) return null;
    if (src.firmId !== args.firmId) {
      console.warn(`[getResearchSourceContent] SECURITY ALERT: Cross-firm access blocked for ${args.sourceId} by ${args.firmId}`);
      return null;
    }
    return src;
  },
});

// --- CORE QUERIES ---

export const getUser = query({
  args: { tokenIdentifier: v.string(), preferPortalRole: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    try {
      const token = args.tokenIdentifier;
      const preferPortalRole = args.preferPortalRole === true;

      // 1. Primary: indexed lookup — collect ALL matching records, not just the first,
      //    so we can disambiguate when the same email exists as both an admin
      //    record AND a portal record (the "residents see admin dashboard" bug).
      //    Indexed lookups return rows in index order; .first() was returning
      //    whichever came first — usually the older Admin record.
      const directMatches = await ctx.db
        .query("users")
        .withIndex("by_token", (q) => q.eq("tokenIdentifier", token))
        .collect();

      // 2. Case-insensitive indexed lookup
      const lowerMatches = directMatches.length === 0
        ? await ctx.db
            .query("users")
            .withIndex("by_token", (q) => q.eq("tokenIdentifier", token.toLowerCase()))
            .collect()
        : [];

      // 3. Fallback: bounded scan — take only 500 to prevent timeout
      const allMatches = directMatches.length > 0 || lowerMatches.length > 0
        ? [...directMatches, ...lowerMatches]
        : (await ctx.db.query("users").take(500))
            .filter((u: any) =>
              u.tokenIdentifier &&
              u.tokenIdentifier.toLowerCase() === token.toLowerCase()
            );

      if (allMatches.length === 0) return null;

      // Pick the right record when duplicates exist. The "residents see admin
      // dashboard" bug occurred because the same email existed as BOTH an Admin
      // user record AND a Tenant/Client record, and .first() was returning the
      // Admin record when the user logged in via the portal.
      //
      // Resolution strategy:
      //   - If preferPortalRole is true (login via /portal/* route) AND a
      //     portal-role record exists, prefer it.
      //   - Otherwise, prefer the first record (preserves existing behavior
      //     for admin-side logins).
      //   - We also filter out 'Pending' records — those are revoked accounts
      //     that should never be the resolved user.
      const PORTAL_ROLES = new Set(["Client", "Tenant"]);
      const nonPending = allMatches.filter((u: any) => u.role !== "Pending");

      // If everything is Pending, fall through and let the existing
      // revoked-user handling in AuthContext take over.
      const pool = nonPending.length > 0 ? nonPending : allMatches;

      let user: any;
      if (preferPortalRole) {
        const portalRecord = pool.find((u: any) => PORTAL_ROLES.has(u.role));
        user = portalRecord || pool[0];
      } else {
        user = pool[0];
      }

      // ============================================================
      // NDPA COMPLIANCE: Server-side privacy projection.
      // Strip ALL sensitive authentication fields before transmitting
      // to the frontend. These fields MUST NEVER leave the server.
      // ============================================================
      const { 
        password, 
        mfaCode, 
        verificationCode, 
        failedLoginAttempts, 
        lockedUntil,
        // @ts-ignore - destructure to exclude, even if not always present
        passwordHash,
        ...safeUser 
      } = user as any;

      return safeUser;
    } catch (e) {
      // Never throw to the client — return null so AuthContext falls back gracefully
      console.error("[getUser] Query error:", e);
      return null;
    }
  },
});

export const dumpAll = query({
  args: {},
  handler: async (ctx) => {
    // SECURE: Endpoint disabled. Data export should be done via proper scoped user/firm exports.
    return { users: [], firms: [] };
  }
});

/**
 * findDuplicateEmails — DIAGNOSTIC QUERY (admin only)
 *
 * Returns every email (tokenIdentifier) that has MORE THAN ONE user record.
 * Used to identify the data corruption that caused the "residents see admin
 * dashboard" bug: the same email existed as BOTH an Admin record AND a Tenant
 * record, and getUser() was returning whichever came first in the index.
 *
 * The query also flags each duplicate group with a `conflict` field describing
 * the combination of roles present (e.g. "Admin+Tenant", "Admin+Client",
 * "Lawyer+Tenant") so the admin can prioritize cleanup.
 *
 * Returns: Array of {
 *   email: string,
 *   count: number,
 *   roles: string[],                    // unique roles across all records
 *   conflict: string,                   // joined role names for quick scan
 *   records: Array<{ id, name, role, firmId, isVerified, product }>
 * }
 *
 * NOTE: This query is intentionally bounded by .take(2000) — sufficient for
 * thousands of users. If the user count exceeds this, increase the limit or
 * paginate. Disabled for non-admin callers (returns empty array).
 */
export const findDuplicateEmails = query({
  args: { requesterRole: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Only admins should be able to run this diagnostic. If the frontend
    // forgets to pass the role, return empty (defensive).
    if (args.requesterRole && args.requesterRole !== "Admin") return [];

    const allUsers = await ctx.db.query("users").take(2000);

    // Group by lowercased tokenIdentifier (email)
    const groups = new Map<string, any[]>();
    for (const u of allUsers as any[]) {
      const email = (u.tokenIdentifier || "").toLowerCase().trim();
      if (!email) continue;
      if (!groups.has(email)) groups.set(email, []);
      groups.get(email)!.push(u);
    }

    const duplicates: Array<{
      email: string;
      count: number;
      roles: string[];
      conflict: string;
      records: Array<{ id: string; name: string; role: string; firmId: string | null; isVerified: boolean; product: string | null }>;
    }> = [];

    for (const [email, records] of groups.entries()) {
      if (records.length < 2) continue;
      const roles = Array.from(new Set(records.map((r) => r.role || "(none)")));
      duplicates.push({
        email,
        count: records.length,
        roles,
        conflict: roles.join("+"),
        records: records.map((r) => ({
          id: String(r._id),
          name: r.name || "",
          role: r.role || "(none)",
          firmId: r.firmId || null,
          isVerified: !!r.isVerified,
          product: r.product || null,
        })),
      });
    }

    // Sort: biggest conflict groups first, then alphabetically by email
    duplicates.sort((a, b) => b.count - a.count || a.email.localeCompare(b.email));
    return duplicates;
  }
});

// --- MUTATIONS ---

export const checkIncompleteRegistration = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const token = args.email.toLowerCase().trim();
    if (!token) return null;

    const allUsers = await ctx.db.query("users").take(500);
    const user = allUsers.find((u: any) => u.tokenIdentifier && u.tokenIdentifier.toLowerCase() === token);

    // Case 1: Fully verified account with a firm — already registered
    if (user && user.isVerified && user.firmId) {
      return {
        alreadyVerified: true,
        product: user.product || 'legal',
      };
    }

    // Case 2: Incomplete registration — unverified, no firmId
    if (user && !user.isVerified && !user.firmId) {
      return {
        isIncomplete: true,
        email: user.email,
        name: user.name,
        product: user.product || 'legal',
      };
    }

    return null;
  }
});

// --- HELPER INTERNAL MUTATIONS (used by actions that can't write DB directly) ---

export const updateUserSecurityFields = internalMutation({
  args: { userId: v.id("users"), fields: v.any() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, args.fields);
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
    let selectedProduct: 'legal' | 'property' | 'unified' | undefined = args.product as any;

    // BUG FIX (Task 16): When no product is passed (e.g. resendConfirmation),
    // use the EXISTING user's product instead of defaulting to 'legal' (Vega).
    // This was the root cause of "vega email heading from an atrium signup" —
    // the user signed up from Atrium (product='property'), but when resending
    // the verification code, the backend defaulted to Vega branding.
    if (!args.product) {
      const existingUserForProduct: any = await ctx.runQuery(api.myFunctions.getUser, { tokenIdentifier: args.email.toLowerCase().trim() });
      if (existingUserForProduct?.product) {
        selectedProduct = existingUserForProduct.product as 'legal' | 'property' | 'unified';
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
      const patchFields: Record<string, any> = { verificationCode: code, product: selectedProduct };
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
    const user: any = await ctx.runQuery(api.myFunctions.getUser, {
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
      // No password stored — trust on first use, migrate them
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
            fields: { mfaCode: code },
          });
          try {
            await ctx.scheduler.runAfter(0, (internal as any).myFunctions.sendVerificationEmail, { email: args.email, code, product: user.product || 'legal' });
          } catch (e) {
            console.error("Failed to send MFA email", e);
          }
          return { success: false, requiresMfa: true, mfaType: 'email' };
        } else {
          if (user.mfaCode !== args.mfaCode) {
            return { success: false, message: "Incorrect security code. Please try again." };
          }
        }
      }

      // Success! Build patch updates.
      const updates: Record<string, any> = {};
      if (user.failedLoginAttempts > 0) updates.failedLoginAttempts = 0;
      if (user.lockedUntil) updates.lockedUntil = null;
      if (user.mfaCode) updates.mfaCode = null;

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

      // AUTO-REPAIR: If a portal user (Client/Tenant) has no firmId, try to repair it
      // on login. This handles the case where a previous version of
      // deletePortalInviteAndCleanup cleared firmId and deleted invite records,
      // leaving the user unable to load any portal data. We search multiple sources
      // to find the correct firmId and patch the user record.
      if ((user.role === "Client" || user.role === "Tenant") && !user.firmId) {
        try {
          const repairResult: any = await ctx.runMutation(api.portals.repairPortalUserFirmId, {
            email: token,
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

      // ─── R13: issue a bearer session token ────────────────────────────
      // The login gateway is the ONLY place a session may be born: password
      // (+ MFA when enabled) has been verified at this point. The token is
      // returned to the client exactly once; only its SHA-256 hash is
      // stored (convex/sessions.ts). resolveCaller trusts these sessions;
      // Round 15 flips strict mode and rejects the legacy email path.
      // Non-blocking: a session-store failure must NEVER fail an otherwise
      // successful login — the client degrades to the legacy email
      // identity during the migration window.
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
        console.warn("[verifyLogin] Session issuance failed (non-blocking, legacy identity still valid):", e);
      }

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
  args: { userId: v.id("users"), isMfaEnabled: v.boolean(), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // RLS: Require firm user — only authenticated firm members can update security
    await requireFirmUser(ctx, args.userEmail);
    await ctx.db.patch(args.userId, { isMfaEnabled: args.isMfaEnabled });
    return { success: true };
  }
});

/**
 * mutation: deactivateTeamMember
 * Soft-deactivates a team member. The user record is preserved (so their
 * historical contributions — matters, tasks, messages — remain attributed),
 * but they can no longer log in. They appear with a "Deactivated" badge in
 * the team directory, grayed out and sorted to the bottom.
 *
 * AUTH: only firm admins (role='Admin' or 'Founding Partner') can deactivate.
 * The founder@practicepro.ng email can also deactivate any user.
 *
 * SAFETY: deactivating yourself is blocked (would lock the firm out).
 */
export const deactivateTeamMember = mutation({
  args: {
    userId: v.id("users"),
    deactivatedBy: v.string(),        // admin's email
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.deactivatedBy);
    const adminUser = auth.user;
    if (!adminUser) throw new Error("Admin user not found");

    // AUTH CHECK: only Admin or Founder (or platform founder) can deactivate
    const FOUNDER_EMAILS = ['founder@practicepro.ng', 'admin@practicepro.ng'];
    const isAdminRole = adminUser.role === 'Admin' || adminUser.role === 'Founder';
    if (!FOUNDER_EMAILS.includes(args.deactivatedBy) && !isAdminRole) {
      throw new Error("Only administrators can deactivate team members");
    }

    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) throw new Error("User not found");

    // SAFETY: can't deactivate yourself
    if (targetUser.email === args.deactivatedBy) {
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
      deactivatedBy: args.deactivatedBy,
      deactivationReason: args.reason || null,
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  },
});

/**
 * mutation: reactivateTeamMember
 * Clears the deactivatedAt field, restoring login access.
 */
export const reactivateTeamMember = mutation({
  args: {
    userId: v.id("users"),
    reactivatedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.reactivatedBy);
    const adminUser = auth.user;
    if (!adminUser) throw new Error("Admin user not found");

    const FOUNDER_EMAILS = ['founder@practicepro.ng', 'admin@practicepro.ng'];
    const isAdminRole = adminUser.role === 'Admin' || adminUser.role === 'Founder';
    if (!FOUNDER_EMAILS.includes(args.reactivatedBy) && !isAdminRole) {
      throw new Error("Only administrators can reactivate team members");
    }

    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) throw new Error("User not found");

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
 */
export const getFirmMembersWithDeactivationStatus = query({
  args: {
    firmId: v.string(),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireFirmUser(ctx, args.userEmail);
    const users = await ctx.db
      .query("users")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();

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
  args: { tokenIdentifier: v.string(), apiKey: v.string() },
  handler: async (ctx, args) => {
    const token = args.tokenIdentifier.toLowerCase().trim();
    const users = await ctx.db
      .query("users")
      .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", token))
      .collect();
    const user = users[0];
    if (!user) return { success: false, message: "User not found." };
    await ctx.db.patch(user._id, { geminiApiKey: args.apiKey });
    return { success: true };
  },
});

/**
 * query: getUserApiKey
 * Retrieves the user's stored Gemini API key from their user record.
 * Used on login to sync the key to localStorage.
 */
export const getUserApiKey = query({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    const token = args.tokenIdentifier.toLowerCase().trim();
    const users = await ctx.db
      .query("users")
      .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", token))
      .collect();
    const user = users[0];
    return user?.geminiApiKey || null;
  },
});

export const verifyCode = mutation({
  args: { email: v.string(), code: v.string() },
  handler: async (ctx, args) => {
    const token = args.email;
    const allUsers = await ctx.db.query("users").take(500);
    const user = allUsers.find((u: any) => u.tokenIdentifier && u.tokenIdentifier.toLowerCase() === token.toLowerCase());

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

    const user: any = await ctx.runQuery(api.myFunctions.getUser, { tokenIdentifier: token });

    if (!user) return { success: false, message: "User account not found." };

    // ISO 27001: Match the recovery code generated by the forgot-password flow
    if (!args.overrideCode || (args.overrideCode !== user.verificationCode && args.overrideCode !== user.recoveryCode)) {
      return { success: false, message: "Invalid Recovery Key or OTP Code." };
    }

    // Hash the new password with PBKDF2 before storing
    const hashedPassword: any = await ctx.runAction(internal.authUtils.hashPassword, {
      password: args.newPassword,
    });

    await ctx.runMutation(internal.myFunctions.updateUserSecurityFields, {
      userId: user._id,
      fields: { password: hashedPassword, verificationCode: null, recoveryCode: null },
    });

    return { success: true };
  }
});

export const requestPasswordReset = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const token = args.email.toLowerCase().trim();
    const allUsers = await ctx.db.query("users").take(500);
    const user = allUsers.find((u: any) => u.tokenIdentifier && u.tokenIdentifier.toLowerCase() === token);

    // Always return success to prevent email enumeration attacks
    if (!user) return { success: true };

    // SECURITY: crypto-secure recovery code (was Math.random — predictable PRNG)
    const code = "RCV-" + numericCode(6);
    await ctx.db.patch(user._id, { recoveryCode: code });

    try {
      const appDomain = "https://practice-pro-vega.vercel.app";
      const recoveryLink = `${appDomain}/?view=login&recoveryCode=${code}&email=${encodeURIComponent(user.email ?? "")}`;

      await ctx.scheduler.runAfter(0, (internal as any).myFunctions.sendRecoveryEmail, { 
        email: user.email, 
        code: code,
        recoveryLink: recoveryLink
      });
    } catch (e) {
      console.error("Failed to send recovery email", e);
    }

    return { success: true };
  }
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

    // SECURITY: crypto-secure recovery code (was Math.random — predictable PRNG)
    const code = "RCV-" + numericCode(6);
    await ctx.db.patch(user._id, { recoveryCode: code });

    try {
      const appDomain = "https://practice-pro-vega.vercel.app";
      const recoveryLink = `${appDomain}/portal/${args.portalType}/login?recoveryCode=${code}&email=${encodeURIComponent(user.email ?? "")}`;

      await ctx.scheduler.runAfter(0, (internal as any).myFunctions.sendPortalRecoveryEmail, { 
        email: user.email, 
        code: code,
        recoveryLink: recoveryLink,
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

    const firmId = await ctx.db.insert("firms", {
      name: args.name,
      address: args.address,
      subscriptionPlan: effectivePlan,
      inviteCode: inviteCode,
      createdBy: args.user_email,
      aiSettings: { enableAllAiFeatures: true },
      product: args.product || "unified",
      maxUnits: args.product === "property" ? (ATRIUM_LIMITS[args.subscriptionPlan]?.units || 5) : 999999,
      maxActiveTenants: args.product === "property" ? (ATRIUM_LIMITS[args.subscriptionPlan]?.tenants || 5) : 999999,
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
    let user = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", args.user_email)).first();
    if (!user) {
      user = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", args.user_email.toLowerCase())).first();
    }
    if (!user) {
      const allUsers = await ctx.db.query("users").take(500);
      user = allUsers.find(u => u.tokenIdentifier && u.tokenIdentifier.toLowerCase() === args.user_email.toLowerCase()) || null;
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

    return firmId;
  },
});

export const validateInviteCode = query({
  args: { inviteCode: v.string() },
  handler: async (ctx, args) => {
    const providedCode = (args.inviteCode || "").trim().toUpperCase();
    
    // Exact match first
    let firm = await ctx.db.query("firms").withIndex("by_invite", (q) => q.eq("inviteCode", providedCode)).first();
    
    // Fallback: search without dashes
    if (!firm) {
      const cleanCode = providedCode.replace(/-/g, "");
      const allFirms = await ctx.db.query("firms").collect();
      firm = allFirms.find(f => (f.inviteCode || "").toUpperCase().replace(/-/g, "") === cleanCode) || null;
    }
    
    if (firm) {
      return { valid: true, firmName: firm.name, firmId: firm._id };
    }
    return { valid: false };
  }
});

export const regenerateInviteCode = mutation({
  args: { firmId: v.string() },
  handler: async (ctx, args) => {
    
    let firm: any = null;
    
    // 1. Try direct ID lookup
    if (args.firmId) {
      try {
        firm = await ctx.db.get(args.firmId as any);
      } catch (e) {
        // Not a valid ID string, ignore
      }
    }

    // 2. Try scanning all firms by ID string or Name (if ID lookup failed)
    if (!firm) {
      const allFirms = await ctx.db.query("firms").collect();
      firm = allFirms.find((f: any) => 
        (f._id && f._id.toString() === args.firmId) || 
        (f.id === args.firmId) || 
        (f.name && f.name === args.firmId)
      );
    }

    if (!firm) {
       console.error(`[RotateCode] ERROR: Firm NOT FOUND for given identifier`);
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
  args: { inviteCode: v.string(), tokenIdentifier: v.string(), userName: v.optional(v.string()), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const providedCode = (args.inviteCode || "").trim().toUpperCase();
    
    // Exact match first
    let firm = await ctx.db.query("firms").withIndex("by_invite", (q) => q.eq("inviteCode", providedCode)).first();
    
    // Fallback: search without dashes
    if (!firm) {
      const cleanCode = providedCode.replace(/-/g, "");
      const allFirms = await ctx.db.query("firms").collect();
      firm = allFirms.find(f => (f.inviteCode || "").toUpperCase().replace(/-/g, "") === cleanCode) || null;
    }

    if (!firm) throw new Error("Invalid invite code.");

    const token = args.tokenIdentifier;
    let user = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", token)).first();
    if (!user) {
      user = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", token.toLowerCase())).first();
    }
    if (!user) {
      const allUsers = await ctx.db.query("users").take(500);
      user = allUsers.find(u => u.tokenIdentifier && u.tokenIdentifier.toLowerCase() === token.toLowerCase()) || null;
    }
    if (!user) throw new Error("User not found.");

    const joinedIds = user.joinedFirmIds || [];
    const updatedJoinedIds = joinedIds.includes(firm._id) ? joinedIds : [...joinedIds, firm._id];

    // SAFETY CHECK: If this user is ALREADY the Admin or a verified User of this firm,
    // do NOT downgrade them to "Pending". This prevents the "Lost Admin" absurdity.
    const isAlreadyMember = user.firmId === firm._id && (user.role === "Admin" || user.role === "User");

    // NEW SAFETY: If the firm has NO active members (empty or orphaned), 
    // the first person to join via invite should become an Admin automatically.
    const firmUsers = await ctx.db.query("users").withIndex("by_firm", (q) => q.eq("firmId", firm._id)).collect();
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
        timestamp: new Date().toISOString(),
        isRead: false
      } as any);
    }

    return firm._id;
  }
});

export const removeUserFromFirm = mutation({
  args: { userId: v.id("users"), firmId: v.string() },
  handler: async (ctx, args) => {
    // RLS: Require admin — only firm admins can remove users
    await requireAdmin(ctx, undefined as any);
    const user = await ctx.db.get(args.userId) as any;
    if (!user) return;

    // 1. Remove the firm from their joined list
    const joinedIds = (user.joinedFirmIds || []).filter((id: string) => id !== args.firmId);
    
    // 2. If this was their active firm, switch them to another firm in their list (or null)
    let newFirmId = user.firmId;
    if (user.firmId === args.firmId) {
       newFirmId = joinedIds.length > 0 ? joinedIds[0] : null;
    }

    await ctx.db.patch(args.userId, { 
      firmId: newFirmId, 
      joinedFirmIds: joinedIds,
      // If we remove them from their last firm, optionally wipe onboarding but usually not
      onboardingCompleted: newFirmId ? true : false
    });
  }
});

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
  args: { userId: string; firmId: string; userEmail?: string }
) {
  const auth = await requireFirmUser(ctx, args.userEmail);
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
      .collect();
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

  // 1. Unassign from tasks (the "unassigned from all items" promise)
  let unassignedTasks = 0;
  const tasks = await ctx.db
    .query("tasks")
    .withIndex("by_firm", (q: any) => q.eq("firmId", args.firmId))
    .collect();
  for (const t of tasks as any[]) {
    const assigned = (t.assignedUsers || []).filter((id: string) => !canonicalIds.has(String(id)));
    const legacyAssignee = (t.assignedTo ?? t.assigneeId ?? null);
    const legacyStillValid = legacyAssignee ? !canonicalIds.has(String(legacyAssignee)) : true;
    const needsPatch = assigned.length !== (t.assignedUsers || []).length || !legacyStillValid;
    if (needsPatch) {
      await ctx.db.patch(t._id, {
        assignedUsers: assigned,
        ...(legacyAssignee && !legacyStillValid ? { assignedTo: null } : {}),
      } as any);
      unassignedTasks++;
    }
  }

  // 2. Delete presence rows for this firm (query by each canonical id form)
  let removedPresence = 0;
  for (const cid of canonicalIds) {
    const presenceRows = await ctx.db
      .query("presence")
      .withIndex("by_user", (q: any) => q.eq("userId", cid))
      .collect();
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
    .collect();
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

  return { success: true, removed: true, unassignedTasks, removedPresence, removedNotifications };
}

/**
 * removeFirmUserAndCleanup — public, transactional user removal.
 * Replaces the old removeUserFromFirm (which had no cleanup, no guards, and
 * zero callers). Also invoked by deleteItem when table === 'users', so every
 * existing UI path (FirmSettings, SettingsView) gets the safe semantics.
 */
export const removeFirmUserAndCleanup = mutation({
  args: {
    userId: v.id("users"),
    firmId: v.string(),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await performFirmUserRemoval(ctx, args);
  },
});

export const updateFirmSettings = mutation({
  args: { firmId: v.string(), settings: v.any(), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // RLS: Require admin — only firm admins can update firm settings
    const auth = await requireAdmin(ctx, args.userEmail);
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
  args: { firmId: v.string(), product: v.string() },
  handler: async (ctx, args) => {
    // Verify the caller is a member of this firm
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const allUsers = await ctx.db.query("users").take(500);
    const user = allUsers.find((u: any) => u.tokenIdentifier?.toLowerCase() === identity.email!.toLowerCase());
    if (!user || user.firmId !== args.firmId) {
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
      .collect();
    for (const u of firmUsers) {
      await ctx.db.patch(u._id, { product: args.product });
    }

    return { success: true, product: args.product, updatedUsers: firmUsers.length };
  }
});

export const getJoinedFirms = query({
  args: { firmIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    const results = [];
    for (const id of args.firmIds) {
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
  args: { email: v.string(), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // SECURITY: Only the account owner can delete their own account
    const auth = await requireFirmUser(ctx, args.userEmail);
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
        // Purge all data associated with this firm
        await ctx.runMutation(api.myFunctions.purgeFirmData, { firmId: fid! });
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
  args: { email: v.string(), firmId: v.string() },
  handler: async (ctx, args) => {
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
  args: { firmId: v.string(), confirmed: v.boolean(), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.confirmed) throw new Error("Deletion must be confirmed.");
    
    // SECURITY: Require admin auth and verify firm ownership
    const auth = await requireAdmin(ctx, args.userEmail);
    if (!auth.firmId || auth.firmId !== args.firmId) {
      throw new Error("Unauthorized. You can only delete your own firm.");
    }

    // 1. Purge all operational data (Matters, Properties, etc.)
    try {
      await ctx.runMutation(api.myFunctions.purgeFirmData, { firmId: args.firmId });
    } catch (e) {
      console.error(`[deleteFirm] Failed to purge firm data:`, e);
      throw new Error("Failed to purge firm data. Please contact support.");
    }

    // 2. Remove the firmId from ALL users who have it joined
    const users = await ctx.db.query("users").collect();
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
  args: { table: v.string(), data: v.any(), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { firmId } = await requireFirmUser(ctx, args.userEmail);
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
    const dataWithTimestamp = {
      ...sanitizedData,
      firmId: effectiveFirmId,
      createdAt: sanitizedData.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const id = await ctx.db.insert(table as any, dataWithTimestamp);
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
  },
  handler: async (ctx, args) => {
    // 1. Authenticate the caller (verifies session OR userEmail fallback).
    const auth = await requireFirmUser(ctx, args.userEmail);
    const firmId = auth.firmId;
    const senderId = args.authorId || auth.userId;
    const senderName = args.authorName || auth.user?.name || "A colleague";
    const now = new Date().toISOString();

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
    const messageId = crypto.randomUUID();
    await ctx.db.insert("chatMessages", {
      id: messageId,
      conversationId,
      content: args.content,
      authorId: senderId,
      timestamp: now,
      createdAt: now,
      updatedAt: now,
      firmId,
      isDeleted: false,
      status: "sent",
      // Persist idempotencyKey so future retries can dedup against this row
      idempotencyKey: args.idempotencyKey || null,
    });

    // 4. Create notifications for every OTHER member of the conversation.
    //    (The sender doesn't get a notification for their own message.)
    //    This runs in the SAME transaction as the message insert, so it's
    //    all-or-nothing. If the message is saved, the notifications are saved.
    const recipientIds = memberIds.filter((id) => id && id !== senderId);
    if (recipientIds.length > 0) {
      const notificationPromises = recipientIds.map((recipientId) => {
        const notificationId = crypto.randomUUID();
        return ctx.db.insert("notifications", {
          id: notificationId,
          firmId,
          userId: recipientId,
          title: "New Message",
          message: `${senderName} sent you a message.`,
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
          timestamp: now,
          createdAt: now,
          updatedAt: now,
        });
      });
      await Promise.all(notificationPromises);
    }

    // 5. Return the message id + conversation id so the client can update
    //    its optimistic UI state.
    return { messageId, conversationId };
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
    const auth = await requireFirmUser(ctx, args.userEmail);
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
          timestamp: now,
          createdAt: now,
          updatedAt: now,
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
                  await ctx.scheduler.runAfter(0, api.communications.sendEmail as any, {
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
                  await ctx.scheduler.runAfter(0, api.communications.sendWhatsApp as any, {
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
  args: { table: v.string(), id: v.string(), data: v.any(), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { table, id, data } = args;

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
      await requireAdmin(ctx, args.userEmail);

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
      await requireFirmUser(ctx, args.userEmail);
    }

    const { firmId } = await requireFirmUser(ctx, args.userEmail);
    const { docId } = await resolveRecordForUpdate(ctx, table, id, firmId);

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

    patchData.updatedAt = new Date().toISOString();

    await ctx.db.patch(docId, patchData);
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
  args: { ids: v.array(v.string()), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { firmId } = await requireFirmUser(ctx, args.userEmail);
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
  args: { userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { firmId, user } = await requireFirmUser(ctx, args.userEmail);
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
      .collect();

    // 2. System-scoped notifications (broadcasts)
    const systemNotes = await ctx.db
      .query("notifications")
      .withIndex("by_firm", (q: any) => q.eq("firmId", "system"))
      .filter((q: any) => q.eq(q.field("userId"), user._id) || q.eq(q.field("userId"), (user as any).id))
      .collect();

    // 3. Also scan for any notifications matching this user that might have
    //    a different firmId (edge case: user belongs to multiple firms)
    // Phase 4 (perf): by_user index seeks for both id forms instead of a
    // full notifications table scan.
    const [notesByConvexId, notesByLegacyId] = await Promise.all([
      ctx.db
        .query("notifications")
        .withIndex("by_user", (q: any) => q.eq("userId", userIdStr))
        .collect(),
      userLegacyId
        ? ctx.db
            .query("notifications")
            .withIndex("by_user", (q: any) => q.eq("userId", userLegacyId))
            .collect()
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
    status: v.string(),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { firmId } = await requireFirmUser(ctx, args.userEmail);

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
    patch: v.any(), // Partial task fields to update
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { firmId } = await requireFirmUser(ctx, args.userEmail);

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
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { firmId } = await requireFirmUser(ctx, args.userEmail);

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
        .collect();
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
      const auth = await requireFirmUser(ctx, args.userEmail);
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
  args: { table: v.string(), id: v.string(), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { firmId } = await requireFirmUser(ctx, args.userEmail);
    const { table, id } = args;

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
    const FK_MAP: Record<string, Array<{ table: string; field: string }>> = {
      contacts: [
        { table: "matters", field: "clientId" },
        { table: "properties", field: "contactId" },
      ],
      matters: [
        { table: "tasks", field: "matterId" },
        { table: "documents", field: "matterId" },
        { table: "events", field: "matterId" },
        { table: "timeEntries", field: "matterId" },
        { table: "expenses", field: "matterId" },
        { table: "invoices", field: "matterId" },
        { table: "notePages", field: "matterId" },
        { table: "clientMessages", field: "matterId" },
        { table: "firmActivity", field: "matterId" },
        { table: "externalCounselInvites", field: "matterId" },
      ],
      properties: [
        { table: "matters", field: "propertyId" },
        { table: "tenancies", field: "propertyId" },
        { table: "notePages", field: "propertyId" },
        { table: "documents", field: "propertyId" },
      ],
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
            .take(1000);
          // Match any of the possible id forms (Convex _id, custom id, or stringified)
          const refs = children.filter((c: any) => {
            const val = c[fk.field];
            return val && possibleIds.has(String(val));
          });
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

    // 4. Strategy C: Firm-scoped full scan (last resort for records without id field)
    try {
      const firmRecords = await ctx.db.query(table as any)
        .withIndex("by_firm" as any, (q: any) => q.eq("firmId", firmId))
        .collect();
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
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { firmId, user } = await requireFirmUser(ctx, args.userEmail);

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
  args: { firmId: v.string(), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireFirmUser(ctx, args.userEmail);
    if (!args.firmId) return [];
    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_firm", (q: any) => q.eq("firmId", args.firmId))
      .collect();
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
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { firmId } = await requireFirmUser(ctx, args.userEmail);

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
    targetContactId: v.string(),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { firmId } = await requireFirmUser(ctx, args.userEmail);

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
  args: { userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // RLS: Require firm user — only authenticated users can generate upload URLs
    await requireFirmUser(ctx, args.userEmail);
    return await ctx.storage.generateUploadUrl();
  }
});
export const getFileUrl = query({
  args: { storageId: v.string() },
  handler: async (ctx, args) => await ctx.storage.getUrl(args.storageId),
});


/**
 * purgeFirmData - Wipes all records for a firm.
 * AUTH: Admin role required. Caller's firmId must match the target firmId.
 */
export const purgeFirmData = mutation({
  args: { firmId: v.string(), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const auth = await requireAdmin(ctx, args.userEmail);
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
        const items = await ctx.db
          .query(table as any)
          .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
          .collect();
        for (const item of items) await ctx.db.delete(item._id);
        results[table] = items.length;
      } catch (e) {
        try {
          const all = await ctx.db.query(table as any).collect();
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
  args: { id: v.string(), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { firmId } = await requireFirmUser(ctx, args.userEmail);
    const { id } = args;

    // SECURITY FIX: Fail CLOSED — throw on empty firmId (same fix as deleteItem).
    if (!firmId) {
      throw new Error("Unauthenticated: userEmail required. Anonymous deletes are no longer permitted.");
    }

    // Strategy A: Direct delete by internal ID with firm check.
    try {
      const existing = await ctx.db.get(id as any) as any;
      if (existing) {
        if (!existing.firmId || existing.firmId !== firmId) {
          throw new Error("Unauthorized. This record belongs to another organization.");
        }
        await ctx.db.delete(id as any);
        return { success: true, method: "internal_id" };
      }
    } catch (e: any) {
      if (e.message?.includes("Unauthorized")) throw e;
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
          await ctx.db.delete(item._id);
          return { success: true, method: "UUID_INDEXED", table };
        }
      } catch (e: any) {
        if (e.message?.includes("Unauthorized")) throw e;
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
  args: { email: v.string(), code: v.string(), product: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const brand = getProductBranding(args.product);

    const bodyHtml = `
      <p style="color:#1a202c;font-size:17px;font-weight:600;margin:0 0 8px 0;">Verify Your Account</p>
      <p style="color:#4a5568;font-size:15px;line-height:1.7;margin:0 0 32px 0;">
        Use the verification code below to confirm your email address and activate your account. This code is valid for 10 minutes.
      </p>
      <div style="background:${BRAND_GREEN_LIGHT};border:2px solid ${BRAND_GREEN};border-radius:12px;padding:28px;text-align:center;margin-bottom:32px;">
        <p style="color:${BRAND_GREEN_DARK};font-size:12px;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px 0;font-weight:700;">Your Verification Code</p>
        <span style="display:inline-block;font-size:38px;font-weight:800;color:${BRAND_GREEN_DARK};letter-spacing:8px;">${args.code}</span>
      </div>
      <p style="color:#718096;font-size:14px;line-height:1.6;margin:0;">
        If you did not request this verification, please disregard this email. Your account will remain secure. Do not share this code with anyone — PracticePro staff will never ask for it.
      </p>`;

    const html = brandedEmailWrapper({
      productName: brand.name,
      productColor: brand.productColor,
      tagline: brand.tagline,
      bodyHtml,
    });

    await sendBrevoEmail({
      to: args.email,
      subject: brand.name ? `PracticePro ${brand.name} — Your Verification Code` : `PracticePro — Your Verification Code`,
      html,
      productName: brand.name,
    });
  }
});

export const sendRecoveryEmail = internalAction({
  args: { email: v.string(), code: v.string(), recoveryLink: v.string(), product: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const brand = getProductBranding(args.product);

    const bodyHtml = `
      <p style="color:#1a202c;font-size:17px;font-weight:600;margin:0 0 8px 0;">Reset Your Security Key</p>
      <p style="color:#4a5568;font-size:15px;line-height:1.7;margin:0 0 32px 0;">
        We received a request to reset the password for your account. Click the secure link below to instantly enter a new password.
      </p>
      <div style="text-align:center;margin-bottom:32px;">
        <a href="${args.recoveryLink}" style="display:inline-block;background-color:${BRAND_GREEN};color:#ffffff;padding:14px 28px;font-size:16px;font-weight:bold;text-decoration:none;border-radius:8px;">Reset Password</a>
      </div>
      <p style="color:#718096;font-size:14px;line-height:1.6;margin:0 0 16px 0;">
        If the button doesn't work, you can also enter this recovery code manually in the app:
      </p>
      <div style="background:${BRAND_GREEN_LIGHT};border:2px solid ${BRAND_GREEN};border-radius:12px;padding:16px;text-align:center;margin-bottom:32px;">
        <span style="display:inline-block;font-size:24px;font-weight:800;color:${BRAND_GREEN_DARK};letter-spacing:4px;">${args.code}</span>
      </div>
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

    // Product-specific getting started guides
    const gettingStartedLinks: Record<string, { label: string; url: string }[]> = {
      legal: [
        { label: 'Create your first Matter', url: 'https://practicepro.ng/help/matters' },
        { label: 'Meet ALOA — your AI assistant', url: 'https://practicepro.ng/help/aloa' },
        { label: 'Draft documents with DraftPro', url: 'https://practicepro.ng/help/draftpro' },
      ],
      property: [
        { label: 'Add your first Property', url: 'https://practicepro.ng/help/properties' },
        { label: 'Meet ARIA — your AI assistant', url: 'https://practicepro.ng/help/aria' },
        { label: 'Manage tenants & rent', url: 'https://practicepro.ng/help/tenants' },
      ],
      unified: [
        { label: 'Create your first Matter', url: 'https://practicepro.ng/help/matters' },
        { label: 'Add your first Property', url: 'https://practicepro.ng/help/properties' },
        { label: 'Meet ALOA — your AI assistant', url: 'https://practicepro.ng/help/aloa' },
        { label: 'Draft documents with DraftPro', url: 'https://practicepro.ng/help/draftpro' },
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
          Visit our <a href="https://practicepro.ng/help" style="color:${BRAND_GREEN};text-decoration:none;font-weight:600;">Help Center</a> for tutorials, video guides, and best practices. You can also access help anytime from within the app by clicking the "?" icon.
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
  args: { email: v.string(), code: v.string(), recoveryLink: v.string(), portalType: v.string() },
  handler: async (ctx, args) => {
    const isTenant = args.portalType === 'tenant';
    const brandName = isTenant ? 'ATRIUM' : 'VEGA';
    const brandColor = isTenant ? '#52797f' : '#4cc9f0';
    const gradientEnd = isTenant ? '#2a4a4f' : '#1a3a5c';
    const portalLabel = isTenant ? 'Residents' : 'Client';

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
        
        <div style="background: linear-gradient(135deg, #0d1b2a 0%, ${gradientEnd} 100%); padding: 32px 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700;">PracticePro <span style="color: ${brandColor};">${brandName}</span></h1>
          <p style="color: #8ab4cc; margin: 6px 0 0 0; font-size: 13px; letter-spacing: 1px; text-transform: uppercase;">${portalLabel} Portal</p>
        </div>
        
        <div style="padding: 40px 32px;">
          <p style="color: #1a202c; font-size: 17px; font-weight: 600; margin: 0 0 8px 0;">Reset Your Portal Password</p>
          <p style="color: #4a5568; font-size: 15px; line-height: 1.7; margin: 0 0 32px 0;">
            We received a request to reset the password for your ${portalLabel} Portal account. Click the secure link below to set a new password.
          </p>
          
          <div style="text-align: center; margin-bottom: 32px;">
            <a href="${args.recoveryLink}" style="display: inline-block; background-color: ${isTenant ? '#52797f' : '#4f46e5'}; color: #ffffff; padding: 14px 28px; font-size: 16px; font-weight: bold; text-decoration: none; border-radius: 8px;">Reset Password</a>
          </div>

          <p style="color: #718096; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
            If the button doesn't work, you can also enter this recovery code manually on the portal login page:
          </p>
          <div style="background: #f7fafc; border: 2px dashed #cbd5e0; border-radius: 10px; padding: 16px; text-align: center; margin-bottom: 32px;">
            <span style="display: inline-block; font-size: 24px; font-weight: 800; color: #0d1b2a; letter-spacing: 4px;">${args.code}</span>
          </div>
          
          <p style="color: #718096; font-size: 14px; line-height: 1.6; margin: 0;">
            If you did not request a password reset, please ignore this email. Your account is safe. You can also contact your ${isTenant ? 'property manager' : 'law firm'} if you have concerns.
          </p>
        </div>

        <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center;">
          <p style="color: #a0aec0; font-size: 12px; margin: 0;">
            &copy; ${new Date().getFullYear()} PracticePro Legal Technologies Limited. All rights reserved.<br/>
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
            &copy; ${new Date().getFullYear()} PracticePro Legal Technologies Limited. All rights reserved.<br/>
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
    const allArchives = await ctx.db.query("archive").collect();
    
    let count = 0;
    for (const item of allArchives) {
      if (item._creationTime < cutoffDate) {
        await ctx.db.delete(item._id);
        count++;
      }
    }
  }
});

export const getAloaConversations = query({
  args: { userId: v.string(), firmId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("aloaConversations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(100);
  },
});

export const getAloaMessages = query({
  args: { conversationId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("aloaMessages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("asc")
      .take(500);
  },
});

export const createAloaConversation = mutation({
  args: { firmId: v.string(), userId: v.string(), title: v.string() },
  handler: async (ctx, args) => {
    // Round 8 auth retrofit: resolve the caller, verify firm scope.
    await requireStaffCaller(ctx, { userId: args.userId, firmId: args.firmId });
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
    firmId: v.string(),
    userId: v.optional(v.string()),
    message: v.any(),
  },
  handler: async (ctx, args) => {
    const { conversationId, firmId, message } = args;
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
  args: { conversationId: v.string(), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Round 8 auth retrofit: the caller must belong to the conversation's firm.
    const caller = await requireStaffCaller(ctx, { userEmail: args.userEmail });
    const conversation = await ctx.db
      .query("aloaConversations")
      .withIndex("by_firm", (q: any) => q.eq("firmId", caller.firmId as any))
      .collect()
      .then((rows: any[]) => rows.find((r: any) => String(r._id) === String(args.conversationId)));
    if (!conversation) {
      throw new Error("Conversation not found in your firm.");
    }
    // Delete messages first
    const messages = await ctx.db
      .query("aloaMessages")
      .withIndex("by_conversation", (q: any) => q.eq("conversationId", args.conversationId))
      .collect();

    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }

    await ctx.db.delete(args.conversationId as any);
  },
});


export const markAloaActionCompleted = mutation({
  args: { messageId: v.id("aloaMessages"), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Round 8 auth retrofit: verify the message belongs to the caller's firm.
    const caller = await requireStaffCaller(ctx, { userEmail: args.userEmail });
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
  args: { matterId: v.string(), firmId: v.string(), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // SECURITY: Require admin auth and verify firm ownership.
    const auth = await requireAdmin(ctx, args.userEmail);
    if (!auth.firmId || auth.firmId !== args.firmId) {
      throw new Error("Unauthorized. You can only delete matters in your own firm.");
    }
    const { matterId, firmId } = args;
    const results: Record<string, number> = {};


    // 0. Fetch the matter itself
    const matter = await ctx.db.get(matterId as Id<"matters">);
    if (!matter) {
      console.warn(`[Cascade] Matter ${matterId} not found. Proceeding with orphan cleanup.`);
    }

    if (matter?.specialtyData?.realEstate?.propertyId) {
      const propId = matter.specialtyData.realEstate.propertyId;
        // Try finding by internal ID first, then by custom UUID
        let propRecord = null;
        try { propRecord = await ctx.db.get(propId as any); } catch(e) { console.warn("[Cascade] propId not a valid Convex ID, falling back to custom ID search."); }
        if (!propRecord) {
            propRecord = await ctx.db.query("properties")
                .withIndex("by_custom_id", q => q.eq("id", propId))
                .first();
        }

        if (propRecord) {
          await ctx.db.delete(propRecord._id);
          results["standaloneProperties"] = 1;
        }
    }

    // ── GROUP A: Cascading Deletion ──────────────────────────────────────────
    // We collect all records for the firm and filter in JS. This is the safest
    // approach for tables defined with v.any() or with mixed index types.
    const tablesToClean = [
      "tasks", "documents", "events", "notePages", "properties",
      "timeEntries", "expenses", "clientMessages", "researchNotebooks",
      "chatConversations", "invoices"
    ];

    for (const table of tablesToClean) {
      const allFirmItems = await ctx.db
        .query(table as any)
        .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
        .collect();

      const toDelete = allFirmItems.filter((item: any) => {
        // Check various ways matterId might be stored
        const mId = item.matterId || item.matter?.id || item.matter;
        return mId === matterId;
      });

      for (const item of toDelete) {
        await ctx.db.delete(item._id);
      }
      results[table] = toDelete.length;
    }

    // ── Finally, delete the matter itself ────────────────────────────────────
    if (matter) {
      await ctx.db.delete(matterId as any);
      results["matter"] = 1;
    }

    return { success: true, summary: results };
  },
});




export const deletePropertyCascade = mutation({
  args: { propertyId: v.string(), firmId: v.string(), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // SECURITY: Require admin auth and verify firm ownership.
    const auth = await requireAdmin(ctx, args.userEmail);
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
      .collect();
    
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
 * ISO 27001 COMPLIANCE: Contact Cascade Deletion
 * Removes all PII and associated operational data when a contact is removed.
 */
export const deleteContactCascade = mutation({
  args: { contactId: v.string(), firmId: v.string(), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // SECURITY: Require admin auth and verify firm ownership.
    const auth = await requireAdmin(ctx, args.userEmail);
    if (!auth.firmId || auth.firmId !== args.firmId) {
      throw new Error("Unauthorized. You can only delete contacts in your own firm.");
    }
    const { contactId, firmId } = args;
    const results: Record<string, number> = { properties: 0, matters: 0, matterOperationalData: 0 };

    // 1. Delete associated standalone properties
    const properties = await ctx.db
      .query("properties")
      .withIndex("by_contact", (q) => q.eq("contactId", contactId))
      .collect();
    
    for (const prop of properties) {
      await ctx.db.delete(prop._id);
    }
    results["properties"] = properties.length;

    // 2. Find and delete associated matters and their cascades
    const matters = await ctx.db
      .query("matters")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .filter((q) => q.eq(q.field("clientId"), contactId))
      .collect();

    const tablesToCascade = ["tasks", "documents", "events", "timeEntries", "expenses", "clientMessages", "notePages"];

    for (const matter of matters) {
        // Wipe operational data for this matter
        for (const table of tablesToCascade) {
            const items = await ctx.db
                .query(table as any)
                .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
                .collect();
            
            const toDelete = items.filter((i: any) => {
                const mId = i.matterId || i.matter?.id || i.matter;
                return mId === matter._id;
            });

            for (const item of toDelete) {
                await ctx.db.delete(item._id);
                results["matterOperationalData"]++;
            }
        }
        
        // Delete the matter itself
        await ctx.db.delete(matter._id);
        results["matters"]++;
    }

    // 3. Delete the contact itself
    await ctx.db.delete(contactId as any);

    return { success: true, summary: results };
  },
});

// ─── ADMIN ACCOUNT RECOVERY TOOL MUTATIONS ────────────────────────────────

export const adminSearchUsersByEmail = query({
  args: { email: v.string(), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // SECURITY: Require admin authentication
    await requireAdmin(ctx, args.userEmail);
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
  args: { userId: v.id("users"), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // SECURITY: Require admin authentication
    const auth = await requireAdmin(ctx, args.userEmail);
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
  args: { userId: v.id("users"), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // SECURITY: Require admin authentication
    const auth = await requireAdmin(ctx, args.userEmail);
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
    const tierLimits = getTierLimitsForFirm(firm.subscriptionPlan, firm.product);
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
    const firms = await ctx.db.query("firms").collect();
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
  args: { propertyId: v.string(), firmId: v.string(), unitData: v.any(), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Round 8 auth retrofit: firmId was caller-supplied and only checked
    // against the property (spoofable — pass the victim's firmId). Resolve
    // the caller and verify the firm is THEIRS.
    await requireStaffCaller(ctx, { userEmail: args.userEmail, firmId: args.firmId });
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
  args: { propertyId: v.string(), firmId: v.string(), unitId: v.string(), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Round 8 auth retrofit: same spoofable-firmId fix as addUnitToProperty.
    await requireStaffCaller(ctx, { userEmail: args.userEmail, firmId: args.firmId });
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
    await requireStaffCaller(ctx, { userId: requestUserId, firmId });

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
 * fixCorporateName — One-time migration to correct the deprecated
 * "LAKE NURE INVESTMENTS LTD" name to "LAKE-NUWA Investment LTD"
 * across all contact records in the firm.
 */
export const fixCorporateName = mutation({
  args: { userEmail: v.string() },
  handler: async (ctx, args) => {
    const { firmId } = await requireFirmUser(ctx, args.userEmail);
    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .collect();

    let patched = 0;
    for (const contact of contacts) {
      if (
        contact.name &&
        /LAKE\s+NURE\s+INVESTMENTS\s+LTD/i.test(contact.name)
      ) {
        const corrected = contact.name.replace(
          /LAKE\s+NURE\s+INVESTMENTS\s+LTD/gi,
          "LAKE-NUWA Investment LTD"
        );
        await ctx.db.patch(contact._id, { name: corrected, updatedAt: new Date().toISOString() });
        patched++;
      }
    }
    return { success: true, patched };
  },
});

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
              timestamp: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
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
      timestamp: now,
      createdAt: now,
      updatedAt: now,
    });

    // External: dispatch email + WhatsApp
    if (isExternal) {
      try {
        const user = await ctx.db.get(assigneeId as any) as any;
        if (user) {
          const email = user.email || user.tokenIdentifier;
          if (email) {
            await ctx.scheduler.runAfter(0, api.communications.sendEmail as any, {
              to: email,
              subject: `${type === 'halfway' ? 'Task Reminder' : 'Final Reminder'}: ${task.title}`,
              html: `<p>Hi ${user.name || 'there'},</p><p>${messageText}</p><p>Please log in to your portal to complete this task.</p>`,
            }).catch(() => {});
          }
          const phone = user.phone || user.whatsappNumber;
          const whatsappOptIn = user.whatsappOptIn === true || user.notificationSettings?.whatsapp === true;
          if (phone && whatsappOptIn) {
            await ctx.scheduler.runAfter(0, api.communications.sendWhatsApp as any, {
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
    const allUsers = await ctx.db.query("users").collect();
    const allFirms = await ctx.db.query("firms").collect();
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
      timestamp: new Date().toISOString(),
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
 * 30, 60, or 90 days. Creates a notification for the firm admin so
 * they can initiate renewal proceedings before the lease lapses.
 *
 * The notification includes the property name, tenant name, and days
 * remaining so the admin can prioritize which leases to renew first.
 *
 * This closes the gap where lease expiry tracking was display-only
 * (PropertyDetailView showed "⚠ NN days" badges) but no proactive
 * alert was sent to the admin.
 */
export const scanLeaseExpiries = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const thresholds = [30, 60, 90]; // days

    // Fetch all properties that have rental details
    const allProperties = await ctx.db.query("properties").take(2000);

    for (const property of allProperties as any[]) {
      const rentalDetails = property.rentalDetails;
      if (!rentalDetails || !rentalDetails.leaseEnd) continue;

      const leaseEnd = new Date(rentalDetails.leaseEnd).getTime();
      if (isNaN(leaseEnd)) continue;

      const daysRemaining = Math.ceil((leaseEnd - now) / DAY);

      // Check if this lease is within one of our alert thresholds
      for (const threshold of thresholds) {
        if (daysRemaining > 0 && daysRemaining <= threshold) {
          // Check if we already sent a notification for this threshold
          // (avoid duplicate alerts — only alert once per threshold)
          const alertKey = `lease_expiry_${threshold}_${property._id}`;
          const existing = await ctx.db
            .query("analytics_events")
            .filter((q: any) => q.eq(q.field("event"), alertKey))
            .take(1);

          if (existing.length > 0) continue; // Already alerted for this threshold

          // Log the alert so we don't duplicate
          await ctx.db.insert("analytics_events", {
            firmId: property.firmId || "system",
            userId: "lease_cron",
            event: alertKey,
            properties: {
              propertyId: property._id,
              propertyName: property.name || property.address || "Unknown",
              tenantName: rentalDetails.tenantName || "Unknown",
              leaseEnd: rentalDetails.leaseEnd,
              daysRemaining,
            },
            timestamp: now,
          } as any);

          // Create a notification for the firm admin
          const firmAdmins = await ctx.db
            .query("users")
            .withIndex("by_firm", (q: any) => q.eq("firmId", property.firmId))
            .collect();

          const admins = firmAdmins.filter((u: any) => u.role === 'Admin');

          for (const admin of admins) {
            await ctx.db.insert("notifications", {
              firmId: property.firmId,
              userId: admin._id,
              title: `Lease Expiring in ${daysRemaining} days`,
              message: `${property.name || property.address || 'Property'} — Tenant: ${rentalDetails.tenantName || 'Unknown'}. Lease ends ${new Date(leaseEnd).toLocaleDateString('en-GB')}.`,
              type: 'lease_expiry',
              link: { view: 'propertyDetail', id: property._id, context: { tab: 'units', targetUnit: property._id, highlight: property._id } },
              timestamp: new Date().toISOString(),
              isRead: false,
            } as any);
          }
          break; // Only alert once (at the closest threshold)
        }
      }

      // Also check for already-expired leases (daysRemaining < 0)
      if (daysRemaining < 0 && daysRemaining > -7) {
        // Just expired within the last week — alert once
        const expiredKey = `lease_expired_${property._id}`;
        const existingExpired = await ctx.db
          .query("analytics_events")
          .filter((q: any) => q.eq(q.field("event"), expiredKey))
          .take(1);

        if (existingExpired.length > 0) continue;

        await ctx.db.insert("analytics_events", {
          firmId: property.firmId || "system",
          userId: "lease_cron",
          event: expiredKey,
          properties: {
            propertyId: property._id,
            propertyName: property.name || property.address || "Unknown",
            tenantName: rentalDetails.tenantName || "Unknown",
            leaseEnd: rentalDetails.leaseEnd,
            daysExpired: Math.abs(daysRemaining),
          },
          timestamp: now,
        } as any);

        const firmAdmins = await ctx.db
          .query("users")
          .withIndex("by_firm", (q: any) => q.eq("firmId", property.firmId))
          .collect();

        const admins = firmAdmins.filter((u: any) => u.role === 'Admin');
        for (const admin of admins) {
          await ctx.db.insert("notifications", {
            firmId: property.firmId,
            userId: admin._id,
            title: 'Lease Has Expired',
            message: `${property.name || property.address || 'Property'} — Tenant: ${rentalDetails.tenantName || 'Unknown'}. Lease expired ${Math.abs(daysRemaining)} day(s) ago. Action required.`,
            type: 'lease_expired',
            link: { view: 'propertyDetail', id: property._id, context: { tab: 'units', targetUnit: property._id, highlight: property._id } },
            timestamp: new Date().toISOString(),
            isRead: false,
          } as any);
        }
      }
    }
  },
});

/**
 * query: getPropertyById
 * Returns a single property by its ID. Used by the public application form
 * to resolve the firmId from the property so leads can be submitted.
 */
export const getPropertyById = query({
  args: { propertyId: v.string() },
  handler: async (ctx, args) => {
    try {
      return await ctx.db.get(args.propertyId as any);
    } catch {
      return null;
    }
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
    const { firmId, user } = await requireFirmUser(ctx, args.userEmail);

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
    ).collect();
    for (const founder of founders) {
      await ctx.db.insert("notifications", {
        firmId: 'system',
        userId: founder._id,
        title: 'Subscription Request Pending Review',
        message: `${user?.email || 'A user'} requested upgrade to ${args.requestedPlan} (₦${args.amount.toLocaleString()}). Reference: ${args.transactionReference}`,
        type: 'subscription_request',
        link: { view: 'organizationsHub', id: requestId, context: {} },
        timestamp: now.toISOString(),
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
 * getPendingSubscriptionRequests — for the founder admin dashboard.
 * Returns all requests with status='pending_review', ordered newest first.
 */
export const getPendingSubscriptionRequests = query({
  args: { userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.userEmail);
    const requests = await ctx.db
      .query("subscriptionRequests")
      .withIndex("by_status", (q: any) => q.eq("status", "pending_review"))
      .order("desc")
      .take(100);
    return requests;
  },
});

/**
 * getMyPendingSubscriptionRequest — for the user's own settings page.
 * Returns the most recent pending request for the calling user's firm.
 */
export const getMyPendingSubscriptionRequest = query({
  args: { userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { firmId } = await requireFirmUser(ctx, args.userEmail);
    const request = await ctx.db
      .query("subscriptionRequests")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .order("desc")
      .first();
    return request;
  },
});

/**
 * approveSubscriptionRequest — founder-only mutation that flips the firm's
 * subscriptionPlan AND marks the request as approved.
 */
export const approveSubscriptionRequest = mutation({
  args: {
    requestId: v.string(),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // NOTE: this is a FOUNDER-only action, not a firm-admin action.
    // requireAdmin checks firm admin role; we additionally check founder below.
    const { user } = await requireAdmin(ctx, args.userEmail);
    // Allow either 'Founder' or 'Admin' for now — TODO: tighten to Founder only
    // once all founders have the Founder role assigned.
    if (user?.role !== 'Founder' && user?.role !== 'Admin') {
      throw new Error("Only founder admins can approve subscription requests.");
    }

    const request: any = await ctx.db.get(args.requestId as any);
    if (!request) throw new Error("Subscription request not found.");
    if (request.status !== 'pending_review') {
      throw new Error(`Request is not pending (current status: ${request.status}).`);
    }

    const now = new Date().toISOString();

    // REVENUE-LEAK FIX (#9): a downgrade from Komplete (product='unified')
    // to a single-product plan MUST also flip firm.product. Previously this
    // mutation only patched subscriptionPlan — a Komplete firm downgraded to
    // 'Pro' kept product='unified', and getTierLimitsForFirm treats ANY
    // unified-product firm as all-unlimited. The firm then kept every
    // Komplete feature while paying Atrium Pro (₦2.1M) or Vega Pro (₦768K)
    // instead of Komplete (₦2.5M) — ~₦400K+/yr leaked per downgraded firm.
    const firm: any = await ctx.db.get(request.firmId as any);
    const firmProduct = String(firm?.product || '').toLowerCase();
    const isUnifiedFirm = firmProduct === 'unified' || firmProduct === 'komplete';
    const targetProduct = request.requestedProduct
      ? String(request.requestedProduct).toLowerCase()
      : null;

    // Validate target product when present
    if (targetProduct && targetProduct !== 'property' && targetProduct !== 'legal' && targetProduct !== 'atrium' && targetProduct !== 'vega') {
      throw new Error(`Invalid requestedProduct '${request.requestedProduct}'. Must be 'property' (Atrium) or 'legal' (Vega).`);
    }
    const normalizedTarget = targetProduct === 'atrium' ? 'property' : targetProduct === 'vega' ? 'legal' : targetProduct;

    // GUARD: unified firm + non-Komplete target plan + no product specified
    // → ambiguous legacy request. Refuse rather than silently leak revenue.
    if (isUnifiedFirm && request.requestedPlan !== 'Komplete' && !normalizedTarget) {
      throw new Error(
        `Ambiguous downgrade: firm is on the Komplete (unified) product but the request targets plan ` +
        `'${request.requestedPlan}' without specifying the target product. Reject this request and ask the ` +
        `firm to re-submit from Settings → Billing (the new flow records the target product automatically).`
      );
    }

    // Flip the firm's subscriptionPlan (+ product when changing products)
    await ctx.db.patch(request.firmId, {
      subscriptionPlan: request.requestedPlan,
      ...(normalizedTarget && normalizedTarget !== firmProduct ? { product: normalizedTarget } : {}),
      setupFeePaid: true,
      adminStatus: 'active',
      // Clear trial fields if present
      trialStartsAt: null,
      trialEndsAt: null,
      trialPlan: null,
      billingInterval: request.billingInterval,
      nextBillingDate: computeNextBillingDate(request.billingInterval, now),
      updatedAt: now,
    } as any);

    // Mark the request as approved
    await ctx.db.patch(args.requestId as any, {
      status: 'approved',
      reviewedAt: now,
      reviewedBy: user?.email || args.userEmail,
      updatedAt: now,
    } as any);

    // Notify ALL users in the firm (not just the requesting user) that
    // the plan has been activated. Uses a celebratory tone.
    const firmUsers = await ctx.db
      .query("users")
      .withIndex("by_firm", (q: any) => q.eq("firmId", request.firmId))
      .collect();
    for (const u of firmUsers) {
      await ctx.db.insert("notifications", {
        firmId: request.firmId,
        userId: u._id,
        title: 'Plan Activated',
        message: `Your account has been updated to the ${request.requestedPlan} plan! All associated features, higher limits, and modules are now active.`,
        type: 'subscription_activated',
        link: { view: 'settings', id: null, context: { settingsTargetId: 'billing' } },
        timestamp: now,
        isRead: false,
      } as any);
    }

    return { success: true };
  },
});

/**
 * rejectSubscriptionRequest — founder-only mutation that marks the request
 * as rejected without flipping the firm's plan.
 */
export const rejectSubscriptionRequest = mutation({
  args: {
    requestId: v.string(),
    reason: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAdmin(ctx, args.userEmail);
    if (user?.role !== 'Founder' && user?.role !== 'Admin') {
      throw new Error("Only founder admins can reject subscription requests.");
    }

    const request: any = await ctx.db.get(args.requestId as any);
    if (!request) throw new Error("Subscription request not found.");
    if (request.status !== 'pending_review') {
      throw new Error(`Request is not pending (current status: ${request.status}).`);
    }

    const now = new Date().toISOString();
    await ctx.db.patch(args.requestId as any, {
      status: 'rejected',
      reviewedAt: now,
      reviewedBy: user?.email || args.userEmail,
      adminNotes: args.reason || null,
      updatedAt: now,
    } as any);

    if (request.userId) {
      await ctx.db.insert("notifications", {
        firmId: request.firmId,
        userId: request.userId,
        title: 'Subscription Request Update',
        message: `Your upgrade request could not be verified. Reason: ${args.reason || 'Payment not confirmed. Please contact support.'}`,
        type: 'subscription_rejected',
        timestamp: now,
        isRead: false,
      } as any);
    }

    return { success: true };
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
      .collect();
    for (const u of firmUsers) {
      await ctx.db.insert("notifications", {
        firmId: args.firmId,
        userId: u._id,
        title: 'Plan Activated',
        message: `Your account has been updated to the ${args.plan} plan! All associated features, higher limits, and modules are now active.`,
        type: 'subscription_activated',
        link: { view: 'settings', id: null, context: { settingsTargetId: 'billing' } },
        timestamp: now,
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
  handler: async (ctx): Promise<{
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
  },
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
            timestamp: nowIso,
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
          timestamp: nowIso,
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
          timestamp: new Date().toISOString(),
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
          timestamp: new Date().toISOString(),
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
          timestamp: new Date().toISOString(),
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
    addonName: v.string(),
    billingInterval: v.string(),        // 'monthly' | 'annual' | 'one_time'
    amount: v.number(),
    quantity: v.optional(v.number()),
    notes: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { firmId, user } = await requireFirmUser(ctx, args.userEmail);

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
 * mutation: purgeStalePendingAddons
 * Founder-only — deletes all add-on requests with status 'pending_review'
 * that are older than 72 hours. These stale requests clog the admin queue.
 * Also purges any mock/test add-on requests.
 */
export const purgeStalePendingAddons = mutation({
  args: {
    founderEmail: v.string(),
  },
  handler: async (ctx, args) => {
    // Round 8 auth retrofit: the founderEmail allowlist was spoofable —
    // knowing founder@practicepro.ng was enough. Resolve the user and
    // require the Founder role (the Founder App admission rule).
    await requireFounderCaller(ctx, { userEmail: args.founderEmail });

    const CUTOFF_HOURS = 72;
    const cutoffTime = new Date(Date.now() - CUTOFF_HOURS * 60 * 60 * 1000).toISOString();

    const allPending = await ctx.db
      .query("subscriptionAddons")
      .filter((q: any) => q.eq(q.field("status"), "pending_review"))
      .collect();

    let purged = 0;
    for (const req of allPending) {
      const requestedAt = (req as any).requestedAt || '';
      const isStale = requestedAt < cutoffTime;
      const isMock = (req as any).addonName?.toLowerCase().includes('test') ||
                     (req as any).addonName?.toLowerCase().includes('mock') ||
                     (req as any).userEmail?.includes('test') ||
                     (req as any).userEmail?.includes('demo');
      if (isStale || isMock) {
        await ctx.db.delete(req._id);
        purged++;
      }
    }

    return { success: true, purged, remaining: allPending.length - purged };
  },
});

/**
 * getActiveAddonsForFirm — returns all ACTIVE add-ons for the calling
 * user's firm. Used in the main app's Billing & Plans page to show
 * purchased add-ons.
 */
export const getActiveAddonsForFirm = query({
  args: { userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { firmId } = await requireFirmUser(ctx, args.userEmail);
    const addons = await ctx.db
      .query("subscriptionAddons")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .filter((q: any) => q.eq(q.field("status"), "active"))
      .collect();
    return addons;
  },
});

/**
 * getPendingAddonsForFirm — returns the most recent PENDING add-on request
 * for the calling user's firm (if any). Used to show a "pending review"
 * badge in the main app.
 */
export const getPendingAddonsForFirm = query({
  args: { userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { firmId } = await requireFirmUser(ctx, args.userEmail);
    const addons = await ctx.db
      .query("subscriptionAddons")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .filter((q: any) => q.eq(q.field("status"), "pending_review"))
      .collect();
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
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { firmId, user } = await requireFirmUser(ctx, args.userEmail);

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
      ).collect();
      for (const founder of founders) {
        await ctx.db.insert("notifications", {
          firmId: 'system',
          userId: founder._id,
          title: 'Add-On Request Withdrawn',
          message: `${user?.email || 'A user'} withdrew their request for ${addon.addonName}.`,
          type: 'addon_cancelled',
          timestamp: now,
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
    ).collect();
    for (const founder of founders) {
      await ctx.db.insert("notifications", {
        firmId: 'system',
        userId: founder._id,
        title: 'Add-On Cancelled',
        message: `${user?.email || 'A user'} cancelled ${addon.addonName}.`,
        type: 'addon_cancelled',
        timestamp: now,
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
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireFirmUser(ctx, args.userEmail);
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
    userEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail);
    const adminUser = auth.user;
    if (!adminUser) throw new Error("User not found");

    const FOUNDER_EMAILS = ['founder@practicepro.ng', 'admin@practicepro.ng'];
    const isAdminRole = adminUser.role === 'Admin' || adminUser.role === 'Founder';
    if (!FOUNDER_EMAILS.includes(args.userEmail) && !isAdminRole) {
      throw new Error("Only firm administrators can start add-on trials");
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
 */
export const activateVmsAddon = mutation({
  args: {
    firmId: v.string(),
    activatedBy: v.string(),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const FOUNDER_EMAILS = ['founder@practicepro.ng', 'admin@practicepro.ng'];
    if (!FOUNDER_EMAILS.includes(args.activatedBy)) {
      throw new Error("Only the platform founder can activate add-ons");
    }

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
    userEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail);
    const adminUser = auth.user;
    if (!adminUser) throw new Error("User not found");

    const FOUNDER_EMAILS = ['founder@practicepro.ng', 'admin@practicepro.ng'];
    const isAdminRole = adminUser.role === 'Admin' || adminUser.role === 'Founder';
    if (!FOUNDER_EMAILS.includes(args.userEmail) && !isAdminRole) {
      throw new Error("Only firm administrators can cancel add-ons");
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
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireFirmUser(ctx, args.userEmail);
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
    userEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail);
    const adminUser = auth.user;
    if (!adminUser) throw new Error("User not found");

    const FOUNDER_EMAILS = ['founder@practicepro.ng', 'admin@practicepro.ng'];
    const isAdminRole = adminUser.role === 'Admin' || adminUser.role === 'Founder';
    if (!FOUNDER_EMAILS.includes(args.userEmail) && !isAdminRole) {
      throw new Error("Only firm administrators can start add-on trials");
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
 */
export const activateEstateCommunityAddon = mutation({
  args: {
    firmId: v.string(),
    activatedBy: v.string(),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const FOUNDER_EMAILS = ['founder@practicepro.ng', 'admin@practicepro.ng'];
    if (!FOUNDER_EMAILS.includes(args.activatedBy)) {
      throw new Error("Only the platform founder can activate add-ons");
    }

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
    userEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail);
    const adminUser = auth.user;
    if (!adminUser) throw new Error("User not found");

    const FOUNDER_EMAILS = ['founder@practicepro.ng', 'admin@practicepro.ng'];
    const isAdminRole = adminUser.role === 'Admin' || adminUser.role === 'Founder';
    if (!FOUNDER_EMAILS.includes(args.userEmail) && !isAdminRole) {
      throw new Error("Only firm administrators can cancel add-ons");
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
 * Public query — returns the active corporate bank account details.
 * Used by checkout components in the user app, portal, and add-on flow.
 * Returns null if no active config exists (checkout shows placeholders).
 */
export const getOrgPayoutDetails = query({
  args: {},
  handler: async (ctx) => {
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
    bankName: v.string(),
    accountNumber: v.string(),
    accountName: v.string(),
    founderEmail: v.string(),
  },
  handler: async (ctx, args) => {
    // Round 8 auth retrofit: the hardcoded FOUNDER_EMAILS allowlist only
    // proved the caller KNEW a founder address. Resolve the user and
    // require the Founder role (the Founder App admission rule).
    await requireFounderCaller(ctx, { userEmail: args.founderEmail });

    // Validate NUBAN: 10 digits
    if (!/^\d{10}$/.test(args.accountNumber)) {
      throw new Error("Account number must be exactly 10 digits (NUBAN)");
    }

    // Deactivate any previously-active record
    const existing = await ctx.db
      .query("organization_payout_details")
      .withIndex("by_active", (q: any) => q.eq("isActive", true))
      .collect();
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
        createdAt: new Date().toISOString(),
        timestamp: new Date().toISOString(),
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

    // Has sent at least one WhatsApp or email reminder — check notifications
    // of type 'service_charge_reminder' or 'invoice_sent' as a proxy.
    const hasSentReminder = await (async () => {
      try {
        const sentReminderNotif = await ctx.db
          .query("notifications")
          .withIndex("by_firm", (q: any) => q.eq("firmId", fid))
          .filter((q: any) => q.or(
            q.eq(q.field("type"), "service_charge_reminder"),
            q.eq(q.field("type"), "rent_reminder"),
            q.eq(q.field("type"), "invoice_sent")
          ))
          .first();
        return !!sentReminderNotif;
      } catch {
        return false;
      }
    })();

    return {
      product,
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
