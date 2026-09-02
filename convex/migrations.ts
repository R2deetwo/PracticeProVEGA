
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { createUnitResolver, canonicalTenantId } from "./unitLookup";

export const runPhase1 = mutation({
  args: {},
  handler: async (ctx) => {
    const tables = ["firms", "matters", "properties", "users", "contacts", "tasks", "documents"];
    const results: Record<string, number> = {};

    for (const table of tables) {
      try {
        const records = await ctx.db.query(table as any).collect();
        let count = 0;
        for (const record of records) {
          const patch: any = {};
          
          if (!record.createdAt) patch.createdAt = new Date(record._creationTime).toISOString();
          if (!record.updatedAt) patch.updatedAt = new Date().toISOString();

          for (const [key, val] of Object.entries(record)) {
            if (typeof val === "string" && (
              key.toLowerCase().includes("amount") || 
              key.toLowerCase().includes("rate") || 
              key.toLowerCase().includes("price") || 
              key.toLowerCase().includes("balance") || 
              key.toLowerCase().includes("value") ||
              key.toLowerCase().includes("total")
            )) {
              const numValue = (val as string).replace(/[^\d.-]/g, '');
              const num = parseFloat(numValue);
              if (!isNaN(num) && num.toString() !== val) {
                patch[key] = num;
              }
            }
          }

          if (Object.keys(patch).length > 0) {
            await ctx.db.patch(record._id, patch);
            count++;
          }
        }
        results[table] = count;
      } catch (e) {
        console.error(`Migration failed for table ${table}:`, e);
        results[table] = -1;
      }
    }

    // Also include setDefaultProduct logic
    const firms = await ctx.db.query("firms").collect();
    let firmCount = 0;
    for (const firm of firms) {
      if (!firm.product) {
        await ctx.db.patch(firm._id, { product: "unified" });
        firmCount++;
      }
    }
    results["firms_product"] = firmCount;

    return results;
  },
});

export const setDefaultProduct = runPhase1; // Alias to make it work

// ─── PAGE-AUDIT ROUND 6: service-charge tenant backfill ────────────────────
//
// `service_charges.tenantId` was never populated by any writer (upsertService-
// Charge only stored it when a caller passed one — no caller ever did). Two
// load-bearing consumers silently depend on it:
//   • tenant-portal dues (portals.getTenantServiceCharges filters by
//     `sc.tenantId ∈ possibleTenantIds`) — rows without it are invisible;
//   • wallet auto-deduct (wallets.processAutoDeductions) — falls back to
//     `ctx.db.get(sc.unitId)`, which only resolves standalone-property ids,
//     so embedded/composite units are skipped entirely.
//
// This migration backfills `tenantId` on every row where it is empty, using
// the shared unit resolver (convex/unitLookup.ts): tenant email on the
// unit/property → Convex user _id (the id the portal and wallets key on),
// falling back to the raw stored tenant field. STRICTLY ADDITIVE:
//   • rows that already have a tenantId are never touched;
//   • rows whose unit cannot be resolved are left untouched and reported;
//   • safe to re-run any number of times (idempotent).
// The unitId field itself is intentionally NOT rewritten — `by_unit` index
// lookups (upsert dedupe) and the client-side bridge "tracked" check key on
// the existing shapes; consumers resolve all four shapes via unitLookup.

export const reportUnlinkedServiceCharges = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("service_charges").collect();
    // Resolver per firm (property list is memoized per resolver instance).
    const resolvers = new Map<string, ReturnType<typeof createUnitResolver>>();
    const getResolver = (firmId: string) => {
      let r = resolvers.get(firmId);
      if (!r) {
        r = createUnitResolver(ctx, firmId);
        resolvers.set(firmId, r);
      }
      return r;
    };

    const report: any[] = [];
    for (const sc of rows) {
      if (sc.tenantId) continue; // already linked — not a migration target
      const ref = await getResolver(sc.firmId).resolveUnit(sc.unitId);
      if (!ref) {
        report.push({ id: sc._id, unitId: sc.unitId, firmId: sc.firmId, resolvable: false });
        continue;
      }
      const tenant = await getResolver(sc.firmId).tenantFor(ref);
      const canonical = canonicalTenantId(tenant);
      report.push({
        id: sc._id,
        unitId: sc.unitId,
        firmId: sc.firmId,
        resolvable: true,
        match: ref.match,
        unitLabel: ref.label,
        tenantName: tenant.name,
        tenantEmail: tenant.email,
        candidateTenantId: canonical,
      });
    }
    return {
      totalRows: rows.length,
      alreadyLinked: rows.length - report.length,
      unlinked: report.length,
      detail: report,
    };
  },
});

export const backfillServiceChargeTenants = mutation({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("service_charges").collect();
    const resolvers = new Map<string, ReturnType<typeof createUnitResolver>>();
    const getResolver = (firmId: string) => {
      let r = resolvers.get(firmId);
      if (!r) {
        r = createUnitResolver(ctx, firmId);
        resolvers.set(firmId, r);
      }
      return r;
    };

    let alreadyLinked = 0;
    let linked = 0;
    let unresolved = 0;
    const unresolvedDetail: any[] = [];
    const linkedSample: any[] = [];

    for (const sc of rows) {
      if (sc.tenantId) {
        alreadyLinked++;
        continue;
      }
      const resolver = getResolver(sc.firmId);
      const ref = await resolver.resolveUnit(sc.unitId);
      if (!ref) {
        unresolved++;
        unresolvedDetail.push({ id: sc._id, unitId: sc.unitId, firmId: sc.firmId });
        continue;
      }
      const tenant = await resolver.tenantFor(ref);
      const canonical = canonicalTenantId(tenant);
      if (!canonical) {
        // Unit resolved but no tenant info on it — nothing safe to write.
        unresolved++;
        unresolvedDetail.push({ id: sc._id, unitId: sc.unitId, firmId: sc.firmId, reason: "no_tenant_on_unit" });
        continue;
      }
      if (!args.dryRun) {
        await ctx.db.patch(sc._id, { tenantId: canonical });
      }
      linked++;
      if (linkedSample.length < 50) {
        linkedSample.push({ id: sc._id, unitId: sc.unitId, tenantId: canonical, match: ref.match, tenantName: tenant.name });
      }
    }

    return {
      dryRun: args.dryRun === true,
      totalRows: rows.length,
      alreadyLinked,
      linked,
      unresolved,
      unresolvedDetail,
      linkedSample,
    };
  },
});
