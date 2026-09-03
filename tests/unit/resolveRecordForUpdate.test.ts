/**
 * Round 9 regression suite — resolveRecordForUpdate ownership checks.
 *
 * THE BUG THIS LOCKS IN: every updateItem('firms', …) call — firm settings,
 * practice profile, bank accounts, integrations — failed with "Unauthorized.
 * This record belongs to another organization." because the generic
 * ownership check demanded a firmId field ON the firm document, and firm
 * documents are self-referential (they ARE the firm; they carry no firmId).
 * Users saw the "Failed to sync firm settings" toast, lost their wizard
 * state on revisit, and the Getting-Started checklist never ticked.
 *
 * Fix under test: firms-table ownership = String(existing._id) === firmId.
 * Also locked in: fail-closed on empty firmId (anonymous caller) for every
 * table, cross-firm rejection for normal tables, custom-id resolution via
 * by_custom_id index and via the take(500) fallback.
 */
import { describe, it, expect } from "vitest";
import { resolveRecordForUpdate } from "../../convex/myFunctions";

type Doc = Record<string, any> & { _id: string; _creationTime?: number };

/** Minimal Convex-db double: get + query(table).withIndex().first()/.collect()/.take() */
function makeCtx(docsByTable: Record<string, Doc[]>) {
  const flat = (table: string) => docsByTable[table] || [];
  const byCustomId = (table: string) =>
    new Map(flat(table).filter((d) => d.id != null).map((d) => [String(d.id), d]));
  const query = (table: string) => ({
    withIndex: (name: string, pred: (q: any) => any) => {
      // Emulate by_custom_id ("id") and by_firm ("firmId") index probes.
      const probe: any = {
        eq: (field: string, value: any) => {
          const v = String(value);
          let found: Doc | null = null;
          if (field === "id") found = byCustomId(table).get(v) || null;
          if (field === "firmId")
            found = flat(table).find((d) => String(d.firmId) === v) || null;
          return { _match: found, field, value };
        },
      };
      const res = pred(probe);
      return {
        first: async () => res?._match || null,
        collect: async () => (res?._match ? [res._match] : []),
      };
    },
    take: async () => flat(table),
  });
  return {
    db: {
      // db.get throws on non-Convex-id strings (UUIDs etc.) — mirror that.
      get: async (id: string) => {
        const s = String(id);
        if (!/^[a-z0-9]{20,}$/.test(s.replace(/[-_]/g, ""))) {
          throw new Error("Invalid Convex id");
        }
        for (const docs of Object.values(docsByTable)) {
          const hit = docs.find((d) => String(d._id) === s);
          if (hit) return hit;
        }
        return null;
      },
      query,
    },
  };
}

const FIRM = "f57firmxxxxxxxxxxxxxxxx";
const OTHER = "f57otherxxxxxxxxxxxxxxxx";

const firmDoc: Doc = {
  _id: FIRM,
  _creationTime: 1,
  name: "Prototypechigo LP",
  practiceProfile: null,
  settings: null,
  // NOTE: no firmId field — self-referential by design
};
const otherFirmDoc: Doc = { _id: OTHER, _creationTime: 2, name: "Other LP" };
const matterDoc: Doc = {
  _id: "m57matterxxxxxxxxxxxxxxxx",
  _creationTime: 3,
  id: "MAT-001",
  firmId: FIRM,
  title: "Adeniyi v. Zenith",
};
const foreignMatter: Doc = {
  _id: "m57foreignxxxxxxxxxxxxxx",
  _creationTime: 4,
  id: "MAT-999",
  firmId: OTHER,
  title: "Other firm's matter",
};
// "invoices" is NOT in INDEXED_CUSTOM_ID_TABLES → exercises take(500) path
const invoiceDoc: Doc = {
  _id: "i57invxxxxxxxxxxxxxxxxx",
  _creationTime: 5,
  id: "INV-17",
  firmId: FIRM,
  amount: 25000,
};

describe("ROUND 9 REGRESSION: firms table is self-referential", () => {
  it("a firm admin updating their OWN firm record succeeds (the round-9 bug: this used to throw)", async () => {
    const ctx = makeCtx({ firms: [firmDoc, otherFirmDoc] });
    const res = await resolveRecordForUpdate(ctx, "firms", FIRM, FIRM);
    expect(String(res.docId)).toBe(FIRM);
  });

  it("a firm admin CANNOT update another firm's record", async () => {
    const ctx = makeCtx({ firms: [firmDoc, otherFirmDoc] });
    await expect(
      resolveRecordForUpdate(ctx, "firms", OTHER, FIRM)
    ).rejects.toThrow(/another organization/);
  });
});

describe("fail-closed behavior (anonymous caller protection)", () => {
  it("empty firmId is rejected even when the record exists — fail CLOSED", async () => {
    const ctx = makeCtx({ firms: [firmDoc] });
    await expect(
      resolveRecordForUpdate(ctx, "firms", FIRM, "")
    ).rejects.toThrow(/Unauthenticated/);
  });

  it("normal table: empty firmId with existing doc also rejected", async () => {
    const ctx = makeCtx({ matters: [matterDoc] });
    await expect(
      resolveRecordForUpdate(ctx, "matters", String(matterDoc._id), "")
    ).rejects.toThrow(/Unauthenticated/);
  });
});

describe("normal-table ownership checks", () => {
  it("own-firm matter by Convex id succeeds", async () => {
    const ctx = makeCtx({ matters: [matterDoc, foreignMatter] });
    const res = await resolveRecordForUpdate(ctx, "matters", String(matterDoc._id), FIRM);
    expect(String(res.docId)).toBe(String(matterDoc._id));
  });

  it("cross-firm matter by Convex id is rejected", async () => {
    const ctx = makeCtx({ matters: [matterDoc, foreignMatter] });
    await expect(
      resolveRecordForUpdate(ctx, "matters", String(foreignMatter._id), FIRM)
    ).rejects.toThrow(/another organization/);
  });

  it("custom-id resolution via by_custom_id index (matters)", async () => {
    const ctx = makeCtx({ matters: [matterDoc, foreignMatter] });
    const res = await resolveRecordForUpdate(ctx, "matters", "MAT-001", FIRM);
    expect(String(res.docId)).toBe(String(matterDoc._id));
  });

  it("custom-id match on another firm's record is rejected", async () => {
    const ctx = makeCtx({ matters: [matterDoc, foreignMatter] });
    await expect(
      resolveRecordForUpdate(ctx, "matters", "MAT-999", FIRM)
    ).rejects.toThrow(/another organization/);
  });

  it("custom-id resolution via the take(500) fallback (invoices not indexed)", async () => {
    const ctx = makeCtx({ invoices: [invoiceDoc] });
    const res = await resolveRecordForUpdate(ctx, "invoices", "INV-17", FIRM);
    expect(String(res.docId)).toBe(String(invoiceDoc._id));
  });

  it("UUID-style id that is not a Convex id falls through to search, not crash", async () => {
    const ctx = makeCtx({ matters: [matterDoc] });
    // A UUID: db.get throws → indexed search finds nothing → not found
    await expect(
      resolveRecordForUpdate(ctx, "matters", "3f2b8c1e-uuid-style-id", FIRM)
    ).rejects.toThrow(/Record not found/);
  });

  it("a record that matches nothing throws Record not found", async () => {
    const ctx = makeCtx({ matters: [matterDoc] });
    await expect(
      resolveRecordForUpdate(ctx, "matters", "DOES-NOT-EXIST", FIRM)
    ).rejects.toThrow(/Record not found/);
  });
});
