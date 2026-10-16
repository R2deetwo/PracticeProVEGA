#!/usr/bin/env python3
"""R28 — rewrite convex scanLeaseExpiries:
- scan BOTH standalone unit rows (rentalDetails on the property row) AND
  embedded units (property.units[].rentalDetails) — embedded units were
  never scanned before;
- name the TENANT, the UNIT and the BUILDING in every message (owner:
  "it wasn't clear to me whose own had expired");
- deep link carries a `reason` ('lease_expired' | 'lease_expiry') and a
  unit-accurate targetUnit so the app opens the exact unit (owner: "it
  didn't open the exact one that I was supposed to open");
- back-compatible dedup keys for standalone rows (no duplicate alerts).
"""
import re, sys

P = 'convex/myFunctions.ts'
src = open(P).read()

START = src.index('/**\n * internal mutation: scanLeaseExpiries')
END_MARK = "export const getPropertyById = query({"
END = src.index(END_MARK)

new_fn = '''/**
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

'''

src = src[:START] + new_fn + src[END:]
open(P, 'w').write(src)
print('scanLeaseExpiries rewritten. Old span replaced:', END - START, 'chars →', len(new_fn), 'chars')
