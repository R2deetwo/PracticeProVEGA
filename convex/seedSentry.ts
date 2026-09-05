import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireFounderCaller } from "./callerAuth";

// R16 strict identity: this seed now requires the founder's BEARER SESSION
// (email-only identity is rejected server-side). Invocation:
//   1. Log in as the founder (verifyLogin) to obtain a session token.
//   2. npx convex run seedSentry:seedDemo '{"sessionToken":"<token>"}'
// Round 8 auth retrofit: Founder-only ops tool. Was a
// fully unauthenticated no-args mutation that DELETED + re-inserted rows.
export const seedDemo = mutation({
  args: { sessionToken: v.optional(v.string()), founderEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireFounderCaller(ctx, { sessionToken: args.sessionToken, userEmail: args.founderEmail });
    const firmId = "atrium-demo-firm-id";
    
    // Clear existing to avoid duplicates if run multiple times
    const existingCharges = await ctx.db.query("service_charges").withIndex("by_firm", q => q.eq("firmId", firmId)).collect();
    for (const c of existingCharges) await ctx.db.delete(c._id);
    
    const existingLedger = await ctx.db.query("ledger_entries").withIndex("by_firm", q => q.eq("firmId", firmId)).collect();
    for (const l of existingLedger) await ctx.db.delete(l._id);

    const existingLeads = await ctx.db.query("leads_pipeline").withIndex("by_firm", q => q.eq("firmId", firmId)).collect();
    for (const l of existingLeads) await ctx.db.delete(l._id);

    const unitId1 = "unit-101";
    const unitId2 = "unit-205";
    
    // insert service charge
    await ctx.db.insert("service_charges", {
      firmId,
      unitId: unitId1,
      tenantId: "tenant-A",
      category: "Diesel",
      amount: 150000,
      cycle: "Monthly",
      nextDueDate: Date.now() - 18 * 86400000, // 18 days ago
      isDefaulter: true,
      daysOverdue: 18,
    });

    await ctx.db.insert("service_charges", {
      firmId,
      unitId: unitId2,
      tenantId: "tenant-B",
      category: "Security",
      amount: 45000,
      cycle: "Monthly",
      nextDueDate: Date.now() + 5 * 86400000,
      isDefaulter: false,
    });

    // insert ledger
    await ctx.db.insert("ledger_entries", {
      firmId,
      unitId: unitId1,
      amount: 150000,
      type: "service_charge",
      status: "defaulted",
      timestamp: Date.now(),
      txHash: "TX-DEMO-1",
      description: "Diesel Payment Default",
    });

    await ctx.db.insert("ledger_entries", {
      firmId,
      unitId: unitId1,
      amount: 2500000,
      type: "rent",
      status: "cleared",
      timestamp: Date.now() - 30 * 86400000,
      txHash: "TX-DEMO-2",
      description: "Annual Rent - Cleared",
    });

    await ctx.db.insert("ledger_entries", {
      firmId,
      unitId: unitId2,
      amount: 45000,
      type: "service_charge",
      status: "pending",
      timestamp: Date.now(),
      txHash: "TX-DEMO-3",
      description: "Security Fee Pending",
    });

    // pipeline
    await ctx.db.insert("leads_pipeline", {
      firmId,
      unitId: "unit-301",
      applicantName: "Chidi Okafor",
      contactInfo: "08012345678",
      stage: "Vetted",
      vettingScore: 88,
      proposedRent: 3000000,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await ctx.db.insert("leads_pipeline", {
      firmId,
      unitId: "unit-402",
      applicantName: "Amina Bello",
      contactInfo: "amina@example.com",
      stage: "Inquiry",
      proposedRent: 2500000,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    
    return "Seeded demo data for Revenue Engine!";
  }
});
