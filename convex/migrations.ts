
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { createUnitResolver, canonicalTenantId } from "./unitLookup";

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

// ─── NOTIFICATION TIMESTAMP NORMALIZATION (2026-09-08) ─────────────────────
//
// The `notifications` table historically mixed timestamp representations:
// 34 writers emitted ISO strings, one (proactive.ts) wrote a NUMBER hidden
// behind an `as any` cast, and the schema declared all three time fields
// (timestamp / createdAt / updatedAt) as strings. The sibling table
// `app_notifications` has always used epoch-ms numbers, and the unified
// messaging model (src/messaging/model.ts) canonicalized on epoch ms — so
// numbers are now the app-wide convention.
//
// All 35 writers were fixed to emit Date.now() and the schema was flipped
// to nullableNumber. This migration converts the EXISTING rows:
//   • string values → parsed to epoch ms (numeric strings and ISO dates
//     both handled; unparseable values fall back to _creationTime);
//   • missing `timestamp` → filled from the document's _creationTime;
//   • idempotent — rows whose fields are already numbers are never touched.
//
// Run via dashboard or `npx convex run migrations:backfillNotificationTimestamps`
// (dryRun defaults to true; pass {dryRun:false} to write).

function toEpochMsOrNull(value: any, fallback: number | null): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    if (/^\d{10,}$/.test(value.trim())) return parseInt(value.trim(), 10);
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
}

export const reportNotificationTimestamps = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("notifications").collect();
    let numericRows = 0;
    let stringRows = 0;
    let missingTimestamp = 0;
    let unparseable = 0;
    const sample: any[] = [];
    for (const n of rows as any[]) {
      const ts = n.timestamp;
      const created = n.createdAt;
      const updated = n.updatedAt;
      const hasString = [ts, created, updated].some((x) => typeof x === "string");
      const allNumeric = [ts, created, updated].every((x) => x == null || typeof x === "number");
      if (hasString) {
        stringRows++;
        // would it parse?
        const creation = typeof n._creationTime === "number" ? n._creationTime : null;
        if (toEpochMsOrNull(ts, creation) === null && ts != null) unparseable++;
        if (sample.length < 50) sample.push({ id: n._id, timestamp: ts, createdAt: created, updatedAt: updated });
      } else if (allNumeric) {
        numericRows++;
      }
      if (ts == null) missingTimestamp++;
    }
    return {
      totalRows: rows.length,
      rowsAlreadyNumeric: numericRows,
      rowsWithStringValues: stringRows,
      rowsMissingTimestamp: missingTimestamp,
      unparseableValues: unparseable,
      stringSample: sample,
    };
  },
});

export const backfillNotificationTimestamps = mutation({
  args: { dryRun: v.optional(v.boolean()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("notifications").collect();
    let converted = 0;
    let alreadyNumeric = 0;
    let filledFromCreationTime = 0;
    let skipped = 0;
    let patched = 0;
    const changes: any[] = [];

    for (const n of rows as any[]) {
      if (args.limit && patched >= args.limit) break;
      const creation = typeof n._creationTime === "number" ? n._creationTime : Date.now();
      const patch: any = {};
      const fields = (["timestamp", "createdAt", "updatedAt"] as const);
      let touched = false;

      for (const field of fields) {
        const value = n[field];
        if (typeof value === "number") continue; // already canonical
        if (value == null) {
          // Only `timestamp` is load-bearing for display/sort — fill it;
          // leave absent createdAt/updatedAt absent rather than inventing.
          if (field === "timestamp") {
            patch.timestamp = creation;
            filledFromCreationTime++;
            touched = true;
          }
          continue;
        }
        const ms = toEpochMsOrNull(value, field === "timestamp" ? creation : null);
        if (ms != null) {
          patch[field] = ms;
          touched = true;
          if (typeof value === "string") converted++;
        } else {
          skipped++;
        }
      }

      if (!touched) {
        alreadyNumeric++;
        continue;
      }
      if (args.dryRun !== false) {
        if (changes.length < 50) changes.push({ id: n._id, ...patch });
      } else {
        await ctx.db.patch(n._id, patch);
        patched++;
        if (changes.length < 50) changes.push({ id: n._id, ...patch });
      }
    }

    return {
      dryRun: args.dryRun !== false,
      totalRows: rows.length,
      rowsConverted: converted,
      rowsFilledFromCreationTime: filledFromCreationTime,
      rowsAlreadyNumeric: alreadyNumeric,
      rowsPatched: patched,
      valuesUnparseable: skipped,
      sampleChanges: changes,
    };
  },
});
