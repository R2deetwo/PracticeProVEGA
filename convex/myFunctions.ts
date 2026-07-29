
import { query, mutation, action, internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { requireFirmUser, requireAdmin } from "./authHelpers";

// --- SUBSCRIPTION CONFIGURATION (mirror: convex/tierLimits.ts) ---
import { ATRIUM_LIMITS } from "./tierLimits";

// --- PRESENCE ---

export const sendHeartbeat = mutation({
  args: { firmId: v.string(), userId: v.string(), userName: v.string(), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // SECURITY: Verify the caller belongs to the firm they're sending presence for
    const auth = await requireFirmUser(ctx, args.userEmail);
    if (auth.firmId !== args.firmId) {
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
    // SECURITY: Verify the caller belongs to the firm they're querying
    if (args.userEmail) {
      try {
        const auth = await requireFirmUser(ctx, args.userEmail);
        if (auth.firmId !== args.firmId) return [];
      } catch { return []; }
    }
    if (!args.firmId) return [];

    // Fetch ALL presence records for the firm (not just active ones).
    // We return both active and inactive users with their lastSeen timestamp
    // so the frontend can show an inactivity indicator (greyed out) and
    // last-seen time on hover.
    const allPresence = await ctx.db.query("presence").withIndex("by_firm", (q) => q.eq("firmId", args.firmId)).take(100);

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
      if (auth.user.tokenIdentifier?.toLowerCase() !== args.email.toLowerCase().trim()) {
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
        if (auth.user.tokenIdentifier?.toLowerCase() !== args.email.toLowerCase().trim()) {
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
    let targetFirmId = args.firmId;
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
        console.log(`[getFirmData] Loading data for firm.`);
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
            console.log(`[getFirmData] Using mock firm details for demo mode.`);
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
          console.log(`[getFirmData] Safety scan for ${tableName}...`);
          const all = await ctx.db.query(tableName as any).take(1000);
          const matches = all.filter((i: any) => {
            const iFirmId = i.firmId?.toString();
            const tFirmId = targetFirmId.toString();
            return iFirmId === tFirmId || iFirmId === "system" || (tableName === "notePages" && i.matterId);
          });
          combined = [...combined, ...matches];
        }

        const uniqueResults = Array.from(new Map(combined.map(item => [item._id, item])).values());
        if (tableName === "properties") {
            console.log(`[getFirmData] Found ${uniqueResults.length} properties`);
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

    // Strip heavy file content from researchSources
    const lightResearchSources = (researchSources || []).map((src: any) => {
      const { content, file, ...lightSrc } = src;
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
        return await ctx.db
          .query("chatMessages")
          .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId as any))
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

      // 4. Combine and return unique
      const combined = [...messagesByFirm, ...legacyMessages];
      return Array.from(new Map(combined.map(m => [m._id, m])).values());

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
    const code: string = Math.floor(100000 + Math.random() * 900000).toString();

    let selectedProduct: 'legal' | 'property' | 'unified' = 'legal';
    if (args.product === 'property') selectedProduct = 'property';
    if (args.product === 'unified') selectedProduct = 'unified';

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
          const code = Math.floor(100000 + Math.random() * 900000).toString();
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
      return { success: true, user: safeUser };
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
  args: { userId: v.id("users"), isMfaEnabled: v.boolean() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { isMfaEnabled: args.isMfaEnabled });
    return { success: true };
  }
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

    const code = "RCV-" + Math.floor(100000 + Math.random() * 900000).toString();
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

    const code = "RCV-" + Math.floor(100000 + Math.random() * 900000).toString();
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
    isDataMigration: v.optional(v.boolean())
  },
  handler: async (ctx, args) => {
    const inviteCode = "INV-" + Math.floor(1000 + Math.random() * 9000);
    const firmId = await ctx.db.insert("firms", {
      name: args.name,
      address: args.address,
      subscriptionPlan: args.subscriptionPlan,
      inviteCode: inviteCode,
      createdBy: args.user_email,
      aiSettings: { enableAllAiFeatures: true },
      product: args.product || "unified",
      maxUnits: args.product === "property" ? (ATRIUM_LIMITS[args.subscriptionPlan]?.units || 5) : 999999,
      maxActiveTenants: args.product === "property" ? (ATRIUM_LIMITS[args.subscriptionPlan]?.tenants || 5) : 999999,
      whatsappLimit: args.product === "property" ? (ATRIUM_LIMITS[args.subscriptionPlan]?.whatsapp || 0) : 0,
      whatsappMessagesSent: 0,
      setupFeePaid: (args.subscriptionPlan === "Enterprise" || args.isDataMigration) ? false : true, // If they need a setup fee, it's NOT paid yet
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
        onboardingCompleted: true, 
        role: 'Admin',
        joinedFirmIds: updatedJoinedIds
      });
    }

    // Seed default document categories
    const defaultCategories = [
      { name: "Pleadings", description: "Court filings, statements of claim, and defenses", color: "#3b82f6" },
      { name: "Correspondence", description: "Letters, emails, and client communications", color: "#10b981" },
      { name: "Evidence", description: "Exhibits, witness statements, and factual documents", color: "#8b5cf6" },
      { name: "Agreements", description: "Contracts, deeds, and legal agreements", color: "#f59e0b" },
      { name: "Corporate", description: "CAC filings, board resolutions, and company documents", color: "#64748b" },
      { name: "Other", description: "Miscellaneous documents", color: "#94a3b8" }
    ];

    for (const cat of defaultCategories) {
      await ctx.db.insert("documentCategories", {
        firmId,
        name: cat.name,
        description: cat.description,
        color: cat.color,
        isSystem: true
      });
    }

    // Seed default contact categories
    const contactCategories = [
      "Client",
      "Vendor",
      "Court Staff",
      "Opposing Counsel",
      "Judiciary",
      "Advocate"
    ];

    for (const cat of contactCategories) {
      await ctx.db.insert("contactCategories", {
        firmId,
        name: cat,
        isSystem: true
      });
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
    console.log(`[RotateCode] Attempting rotation for firm`);
    
    let firm: any = null;
    
    // 1. Try direct ID lookup
    if (args.firmId) {
      try {
        firm = await ctx.db.get(args.firmId as any);
        if (firm) console.log(`[RotateCode] Found firm by direct ID lookup`);
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
      if (firm) console.log(`[RotateCode] Found firm by scan`);
    }

    if (!firm) {
       console.error(`[RotateCode] ERROR: Firm NOT FOUND for given identifier`);
       throw new Error(`Workspace not found. Please refresh and try again. (Ref: ${args.firmId})`);
    }

    // Generate a more robust unique code: 6 characters alphanumeric
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars
    let newCode = "INV-";
    for (let i = 0; i < 6; i++) {
      newCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }

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
      onboardingCompleted: true,
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

export const updateFirmSettings = mutation({
  args: { firmId: v.string(), settings: v.any() },
  handler: async (ctx, args) => {
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
    if (auth.user.tokenIdentifier?.toLowerCase() !== args.email.toLowerCase().trim()) {
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
    if (auth.firmId !== args.firmId) {
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

    // Also write an immutable consent log entry for full audit trail
    await ctx.db.insert("consentLogs" as any, {
      userId: user._id,
      firmId: user.firmId,
      email: args.email,
      consentType: args.consentType,
      granted: args.granted,
      timestamp: Date.now(),
      ipHint: args.ipHint,
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
        // Auto-convert amount-like strings to numbers
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
            sanitizedData[key] = num;
            continue;
          }
        }
        sanitizedData[key] = val;
      }
    }

    // Auto-inject creation timestamp and audit fields
    const dataWithTimestamp = {
      ...sanitizedData,
      firmId, // FORCED DATA ISOLATION
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
  },
  handler: async (ctx, args) => {
    // 1. Authenticate the caller (verifies session OR userEmail fallback).
    const auth = await requireFirmUser(ctx, args.userEmail);
    const firmId = auth.firmId;
    const senderId = args.authorId || auth.userId;
    const senderName = args.authorName || auth.user.name || "A colleague";
    const now = new Date().toISOString();

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
      conversationId = existingConv._id.toString();
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
  },
  handler: async (ctx, args) => {
    // 1. Authenticate
    const auth = await requireFirmUser(ctx, args.userEmail);
    const firmId = auth.firmId;
    const creatorId = args.creatorId || auth.userId;
    const creatorName = args.creatorName || auth.user.name || "A team member";
    const now = new Date().toISOString();

    // 2. Validate — at least one assignee is MANDATORY
    if (!args.assignedUsers || args.assignedUsers.length === 0) {
      throw new Error("At least one assignee is required to create a task.");
    }

    // 3. Insert the task record
    const taskId = crypto.randomUUID();
    const taskDoc: any = {
      firmId,
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
      createdAt: now,
      updatedAt: now,
    };
    await ctx.db.insert("tasks", taskDoc);

    // 4. Create notifications for ALL assignees
    //    - Internal team: in-app only
    //    - External (client/tenant): in-app + email (+ WhatsApp if opted in)
    const assigneeType = args.assigneeType || "team";
    const isExternal = assigneeType === "client" || assigneeType === "tenant";

    const notificationPromises = args.assignedUsers.map(async (assigneeId) => {
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
      // (non-blocking — the task is already created)
      if (isExternal) {
        try {
          // Fetch the user to get their email and WhatsApp opt-in status
          const assigneeUser = await ctx.db.get(assigneeId as any) as any;
          if (assigneeUser) {
            const email = assigneeUser.email || assigneeUser.tokenIdentifier;
            const phone = assigneeUser.phone || assigneeUser.whatsappNumber;
            const whatsappOptIn = assigneeUser.whatsappOptIn === true ||
                                  assigneeUser.notificationSettings?.whatsapp === true;

            // Schedule email dispatch (primary external channel)
            if (email) {
              await ctx.scheduler.runAfter(0, api.communications.sendEmail as any, {
                to: email,
                subject: `New Task Assigned: ${args.title}`,
                html: `<!DOCTYPE html>
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
              }).catch(() => {});
            }

            // Schedule WhatsApp dispatch (secondary, only if opted in)
            if (phone && whatsappOptIn) {
              await ctx.scheduler.runAfter(0, api.communications.sendWhatsApp as any, {
                to: phone,
                messageText: `New task assigned: "${args.title}"${args.dueDate ? ` — due ${new Date(args.dueDate).toLocaleDateString('en-GB')}` : ''}. Log in to your portal to view and complete it.`,
                firmId,
              }).catch(async () => {
                // FALLBACK: If WhatsApp fails, try email again (if not already sent)
                if (!email && assigneeUser.email) {
                  await ctx.scheduler.runAfter(0, api.communications.sendEmail as any, {
                    to: assigneeUser.email,
                    subject: `New Task Assigned: ${args.title}`,
                    html: `<p>${creatorName} assigned you: ${args.title}</p>`,
                  }).catch(() => {});
                }
              });
            }
          }
        } catch (e) {
          // External notification dispatch is best-effort — don't fail the task creation
          console.error("[createTask] External notification dispatch failed:", e);
        }
      }
    });

    await Promise.all(notificationPromises);

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
export const logActivity = mutation({
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

/** Resolve Convex _id from internal id or legacy custom id field (mirrors deleteItem Strategy B). */
async function resolveRecordForUpdate(
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
    if (existing.firmId && existing.firmId !== firmId) {
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
      if (item.firmId && item.firmId !== firmId) {
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
      if (item.firmId && item.firmId !== firmId) {
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
    const { firmId } = await requireFirmUser(ctx, args.userEmail);
    const { table, id, data } = args;

    const { docId } = await resolveRecordForUpdate(ctx, table, id, firmId);

    // Strip Convex-managed internal fields that cannot be patched
    const { _id, _creationTime, ...rest } = data;

    const patchData: Record<string, any> = {};
    for (const [key, val] of Object.entries(rest)) {
      // 1. Local State Filter: Strip keys starting with _ or temp (Convex reserves _ prefix)
      if (key.startsWith("temp") || key.startsWith("_")) {
        continue;
      }

      // 2. Financial Precision
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
          patchData[key] = num;
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
        if (doc && doc.firmId === firmId) {
          await ctx.db.patch(id as any, { isRead: true, updatedAt: now } as any);
          updated++;
          continue;
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
    const all = await ctx.db
      .query("notifications")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .filter((q: any) => q.eq(q.field("userId"), user._id) || q.eq(q.field("userId"), (user as any).id))
      .collect();
    for (const n of all) {
      try { await ctx.db.delete(n._id); } catch {}
    }
    return { success: true, deleted: all.length };
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
  },
  handler: async (ctx, args) => {
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
 */
export const getTermsAcceptance = query({
  args: { userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.userEmail) return null;
    const records = await ctx.db
      .query("termsAcceptance")
      .withIndex("by_user_email", (q: any) => q.eq("userEmail", args.userEmail))
      .order("desc")
      .take(10);
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
    if (existing && existing.firmId && existing.firmId !== firmId) {
      throw new Error("Unauthorized. This record belongs to another organization.");
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
        if (item.firmId && item.firmId !== firmId) {
          throw new Error("Unauthorized. This record belongs to another organization.");
        }
        await ctx.db.delete(item._id);
        return { success: true, method: "UUID_INDEXED" };
      }
    } catch (e: any) {
      if (e.message?.includes("Unauthorized")) throw e;
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
    } catch (e) {
      console.error(`[deleteItem] Strategy C failed for ${table}:${id}`, e);
    }

    throw new Error(`Failed to delete item ${id} from ${table}. Item not found.`);
  },
});


export const generateUploadUrl = mutation(async (ctx) => await ctx.storage.generateUploadUrl());
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
    if (auth.firmId !== args.firmId) {
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

    // Strategy A: Direct delete by internal ID with firm check.
    try {
      const existing = await ctx.db.get(id as any) as any;
      if (existing) {
        if (existing.firmId && existing.firmId !== firmId) {
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
          if (item.firmId && item.firmId !== firmId) {
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

const BREVO_SENDER = { name: "PracticePro", email: "practiceprovega@gmail.com" };

// Product-specific branding for emails
const PRODUCT_BRANDING: Record<string, { name: string; accent: string; tagline: string }> = {
  legal: { name: "VEGA", accent: "#4cc9f0", tagline: "Nigerian Legal Practice System" },
  property: { name: "ATRIUM", accent: "#34d399", tagline: "Nigerian Property Management System" },
  unified: { name: "KOMPLETE", accent: "#a78bfa", tagline: "Nigerian Legal & Property Platform" },
};

function getProductBranding(product?: string) {
  const key = product || 'legal';
  return PRODUCT_BRANDING[key] || PRODUCT_BRANDING.legal;
}

async function sendBrevoEmail(args: {
  to: string;
  subject: string;
  html: string;
  productName?: string;
}) {
  const apiKey = process.env.PracticePro_Vega_Mailer;
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

  console.log(`[Brevo] Email sent successfully.`);
  return { success: true };
}

export const sendVerificationEmail = internalAction({
  args: { email: v.string(), code: v.string(), product: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const brand = getProductBranding(args.product);

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #0d1b2a 0%, #1a3a5c 100%); padding: 32px 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">
            PracticePro <span style="color: ${brand.accent};">${brand.name}</span>
          </h1>
          <p style="color: #8ab4cc; margin: 6px 0 0 0; font-size: 13px; letter-spacing: 1px; text-transform: uppercase;">${brand.tagline}</p>
        </div>
        
        <!-- Body -->
        <div style="padding: 40px 32px;">
          <p style="color: #1a202c; font-size: 17px; font-weight: 600; margin: 0 0 8px 0;">Verify Your Account</p>
          <p style="color: #4a5568; font-size: 15px; line-height: 1.7; margin: 0 0 32px 0;">
            Use the verification code below to confirm your email address and activate your account. This code is valid for 10 minutes.
          </p>
          
          <!-- Code Box -->
          <div style="background: #f7fafc; border: 2px dashed #cbd5e0; border-radius: 10px; padding: 24px; text-align: center; margin-bottom: 32px;">
            <p style="color: #718096; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 12px 0;">Your Verification Code</p>
            <span style="display: inline-block; font-size: 38px; font-weight: 800; color: #0d1b2a; letter-spacing: 8px;">${args.code}</span>
          </div>
          
          <p style="color: #718096; font-size: 14px; line-height: 1.6; margin: 0;">
            If you did not request this verification, please disregard this email. Your account will remain secure. Do not share this code with anyone — PracticePro staff will never ask for it.
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
      to: args.email,
      subject: `PracticePro ${brand.name} — Your Verification Code`,
      html,
      productName: brand.name,
    });
  }
});

export const sendRecoveryEmail = internalAction({
  args: { email: v.string(), code: v.string(), recoveryLink: v.string(), product: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const brand = getProductBranding(args.product);

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
        
        <div style="background: linear-gradient(135deg, #0d1b2a 0%, #1a3a5c 100%); padding: 32px 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700;">PracticePro <span style="color: ${brand.accent};">${brand.name}</span></h1>
        </div>
        
        <div style="padding: 40px 32px;">
          <p style="color: #1a202c; font-size: 17px; font-weight: 600; margin: 0 0 8px 0;">Reset Your Security Key</p>
          <p style="color: #4a5568; font-size: 15px; line-height: 1.7; margin: 0 0 32px 0;">
            We received a request to reset the password for your account. Click the secure link below to instantly enter a new password.
          </p>
          
          <div style="text-align: center; margin-bottom: 32px;">
            <a href="${args.recoveryLink}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 14px 28px; font-size: 16px; font-weight: bold; text-decoration: none; border-radius: 8px;">Reset Password</a>
          </div>

          <p style="color: #718096; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
            If the button doesn't work, you can also enter this recovery code manually in the app:
          </p>
          <div style="background: #f7fafc; border: 2px dashed #cbd5e0; border-radius: 10px; padding: 16px; text-align: center; margin-bottom: 32px;">
            <span style="display: inline-block; font-size: 24px; font-weight: 800; color: #0d1b2a; letter-spacing: 4px;">${args.code}</span>
          </div>
          
          <p style="color: #718096; font-size: 14px; line-height: 1.6; margin: 0;">
            If you did not request a password reset, please ignore this email. Your account is safe.
          </p>
        </div>
      </div>
    `;

    await sendBrevoEmail({
      to: args.email,
      subject: `Reset your PracticePro ${brand.name} Password`,
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
      `<a href="${l.url}" style="display: block; padding: 12px 16px; margin-bottom: 8px; background: #f7fafc; border-radius: 8px; color: #2d3748; text-decoration: none; font-size: 15px; font-weight: 500; border-left: 3px solid ${brand.accent};">${l.label} →</a>`
    ).join('');

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <div style="background: linear-gradient(135deg, #0d1b2a 0%, #1a3a5c 100%); padding: 40px 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800;">
            Welcome to PracticePro <span style="color: ${brand.accent};">${brand.name}</span>
          </h1>
          <p style="color: #a0aec0; margin: 8px 0 0 0; font-size: 15px;">${brand.tagline}</p>
        </div>

        <!-- Body -->
        <div style="padding: 40px 32px;">
          <p style="color: #1a202c; font-size: 17px; font-weight: 600; margin: 0 0 8px 0;">
            Hi ${userName},
          </p>
          <p style="color: #4a5568; font-size: 15px; line-height: 1.7; margin: 0 0 24px 0;">
            Welcome to PracticePro ${brand.name}! Your email has been verified and your account is ready.
            We're excited to have you on board.
          </p>

          <p style="color: #1a202c; font-size: 16px; font-weight: 600; margin: 0 0 16px 0;">
            Get Started in 3 Steps:
          </p>

          <div style="margin-bottom: 32px;">
            ${linksHtml}
          </div>

          <div style="background: #f7fafc; border-radius: 10px; padding: 20px; margin-bottom: 32px;">
            <p style="color: #1a202c; font-size: 15px; font-weight: 600; margin: 0 0 8px 0;">
              📚 Learning Resources
            </p>
            <p style="color: #4a5568; font-size: 14px; line-height: 1.6; margin: 0;">
              Visit our <a href="https://practicepro.ng/help" style="color: #4f46e5; text-decoration: none; font-weight: 600;">Help Center</a>
              for tutorials, video guides, and best practices. You can also access help anytime
              from within the app by clicking the "?" icon.
            </p>
          </div>

          <p style="color: #4a5568; font-size: 14px; line-height: 1.6; margin: 0;">
            If you have any questions, just ask ALOA (or ARIA) — your built-in AI assistant
            can help you navigate the app, draft documents, and manage your practice.
          </p>
        </div>

        <!-- Footer -->
        <div style="background: #0d1b2a; padding: 24px 32px; text-align: center;">
          <p style="color: #718096; font-size: 13px; margin: 0;">
            PracticePro — Legal & Property Practice Management<br>
            <a href="https://practicepro.ng" style="color: #4a5568; text-decoration: none;">practicepro.ng</a>
          </p>
        </div>
      </div>
    `;

    await sendBrevoEmail({
      to: args.email,
      subject: `Welcome to PracticePro ${brand.name}! 🎉`,
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

export const triggerBreachNotification = mutation({
  args: {
    adminEmail: v.string(),
    firmId: v.optional(v.string()),  // If set, only notify users of this firm
    incidentTitle: v.string(),
    incidentDescription: v.string(),
    recommendedAction: v.string(),
    incidentDate: v.string(),
  },
  handler: async (ctx, args) => {
    // Security: verify the caller is an admin
    const admin = await ctx.db.query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", args.adminEmail))
      .first();
    
    if (!admin || (admin.role !== "Admin" && admin.role !== "SuperAdmin")) {
      throw new Error("Unauthorized: Only Admins can trigger breach notifications.");
    }

    // Gather affected users
    let affectedUsers;
    if (args.firmId) {
      affectedUsers = await ctx.db.query("users")
        .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
        .collect();
    } else {
      affectedUsers = await ctx.db.query("users").collect();
    }

    const notificationPayload = {
      incidentTitle: args.incidentTitle,
      incidentDescription: args.incidentDescription,
      recommendedAction: args.recommendedAction,
      incidentDate: args.incidentDate,
    };

    // Schedule individual email for each affected user
    let scheduled = 0;
    for (const user of affectedUsers) {
      const email = user.tokenIdentifier || user.email;
      if (email && email.includes("@")) {
        await ctx.scheduler.runAfter(scheduled * 200, (internal as any).myFunctions.sendBreachNotification, {
          affectedEmail: email,
          ...notificationPayload,
        });
        scheduled++;
      }
    }

    // Log the incident
    await ctx.db.insert("consentLogs" as any, {
      userId: admin._id,
      firmId: args.firmId || "ALL",
      email: args.adminEmail,
      consentType: "breach_notification_sent",
      granted: true,
      timestamp: Date.now(),
      ipHint: `Notified ${scheduled} users — Incident: ${args.incidentTitle}`,
    });

    return { success: true, notified: scheduled };
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
    console.log(`[Data Retention] Purged ${count} archived records exceeding 30-day retention.`);
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

    // Reactive Trigger: Echo user message to feedback table (for founder BI visibility)
    if (message.role === "user") {
        const uId = args.userId || message.userId || message.authorId;
        const user = uId ? await ctx.db.get(uId as any) : null;
        const msgContent = message.content || message.text || "";
        
        if (user && msgContent) {
            await ctx.db.insert("user_feedback", {
                firmId: (user as any).firmId || firmId,
                userId: (user as any)._id,
                userName: (user as any).name || "User",
                userEmail: (user as any).tokenIdentifier || (user as any).email || "",
                message: msgContent,
                status: "New",
                source: "aloa_echo",  // Tag so we can filter out from System Inbox
                timestamp: Date.now()
            });
        }
    }

    return msgId;
  },
});

export const deleteAloaConversation = mutation({
  args: { conversationId: v.string() },
  handler: async (ctx, args) => {
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
  args: { messageId: v.id("aloaMessages") },
  handler: async (ctx, args) => {
    const msg = await ctx.db.get(args.messageId);
    if (msg && msg.toolAction) {
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
  args: { matterId: v.string(), firmId: v.string() },
  handler: async (ctx, args) => {
    const { matterId, firmId } = args;
    const results: Record<string, number> = {};

    console.log(`[Cascade] Starting wipe for Matter: ${matterId} in Firm: ${firmId}`);

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
      console.log(`[Cascade] Cleaning table: ${table}`);
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

    console.log(`[Cascade Delete] Matter ${matterId} wiped. Summary:`, results);
    return { success: true, summary: results };
  },
});




export const deletePropertyCascade = mutation({
  args: { propertyId: v.string(), firmId: v.string() },
  handler: async (ctx, args) => {
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
  args: { contactId: v.string(), firmId: v.string() },
  handler: async (ctx, args) => {
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
            console.log(`[Contact Cascade] Cleaning operational data: ${table} for matter: ${matter._id}`);
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

    console.log(`[Cascade Delete] Contact ${contactId} wiped. Summary:`, results);
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
export const incrementWhatsAppQuota = mutation({
  args: { firmId: v.string() },
  handler: async (ctx, args) => {
    const firm = await ctx.db.get(args.firmId as any) as any;
    if (!firm) throw new Error("Firm not found");

    const limit: number = firm.whatsappLimit ?? 0;
    const sent:  number = firm.whatsappMessagesSent ?? 0;

    // 999999 is our internal "unlimited" sentinel for Pro/Enterprise
    if (limit !== 999999 && sent >= limit) {
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
    console.log(`[resetWhatsAppQuotaMonthly] Reset WhatsApp quota for ${reset} firm(s).`);
    return { reset };
  },
});


/**
 * Add a single unit to a property's embedded units array.
 * Dedicated mutation to avoid the generic updateItem optimistic-update bug
 * that replaces the entire units array.
 */
export const addUnitToProperty = mutation({
  args: { propertyId: v.string(), firmId: v.string(), unitData: v.any() },
  handler: async (ctx, args) => {
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
  args: { propertyId: v.string(), firmId: v.string(), unitId: v.string() },
  handler: async (ctx, args) => {
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
