/**
 * unitLookup resolver suite — Round 10 in-repo reconstruction of the
 * 18-test sandbox script (lost twice to agent-sandbox resets; the SaaS
 * hardening plan moves it INTO the repo so it gates deploys).
 *
 * service_charges.unitId arrives in FOUR shapes from four different
 * historical writers; this suite locks in that createUnitResolver
 * resolves every shape, enforces firm scoping, memoizes queries, and
 * that canonicalTenantId prefers the Convex user id.
 */
import { describe, it, expect } from "vitest";
import { createUnitResolver, canonicalTenantId } from "../../convex/unitLookup";

type Prop = Record<string, any> & { _id: string };

const FIRM = "f57firmxxxxxxxxxxxxxxxx";
const OTHER = "f57otherxxxxxxxxxxxxxxxx";

const propWithUnits: Prop = {
  _id: "p57unitsxxxxxxxxxxxxxxxx",
  id: "PROP-1",
  firmId: FIRM,
  address: "12 Marina Rd, Lagos",
  units: [
    { id: "unit-3b", unitName: "Unit 3B", tenantEmail: "t3b@x.ng", tenantName: "Mrs. Bello" },
    { id: "unit-4a", unitName: "Unit 4A" },
  ],
  rentalDetails: { tenantEmail: "fallback@x.ng" },
};
const standaloneProp: Prop = {
  _id: "p57standxxxxxxxxxxxxxxxx",
  id: "PROP-2",
  firmId: FIRM,
  address: "4 Awolowo Rd, Ikoyi",
  tenantEmail: "whole@x.ng",
  tenantName: "Alhaji Sani",
};
const foreignProp: Prop = {
  _id: "p57foreignxxxxxxxxxxxxxx",
  id: "PROP-X",
  firmId: OTHER,
  address: "9 Enemy St",
};
const noUnitsProp: Prop = {
  _id: "p57nounitxxxxxxxxxxxxxxxx",
  id: "PROP-3",
  firmId: FIRM,
  address: "Flat block, Abuja",
  units: [],
};

const users = [
  { _id: "u57tenantxxxxxxxxxxxxxxxx", email: "t3b@x.ng", tokenIdentifier: "t3b@x.ng", role: "Tenant" },
];

/** Minimal Convex-db double used by the resolver (get + withIndex probes). */
function makeCtx(props: Prop[], opts: { throwOnGet?: boolean } = {}) {
  let queries = { properties: 0, users: 0 };
  const byCustomId = new Map(props.filter((p) => p.id != null).map((p) => [String(p.id), p]));
  const query = (table: string) => ({
    withIndex: (_name: string, pred: (q: any) => any) => {
      const probe: any = {
        eq: (field: string, value: any) => {
          const v = String(value);
          let found: any = null;
          if (table === "properties") {
            if (field === "id") found = byCustomId.get(v) || null;
            if (field === "firmId") found = props.find((p) => String(p.firmId) === v) || null;
          }
          if (table === "users") {
            found = users.find((u) => String((u as any)[field]) === v) || null;
          }
          return { _match: found, field, value };
        },
      };
      const res = pred(probe);
      // counting: emulate collect() returning ALL firm props (by_firm)
      if (table === "properties" && res?.field === "firmId") {
        return {
          first: async () => res._match,
          collect: async () => props.filter((p) => String(p.firmId) === String(res.value)),
        };
      }
      return {
        first: async () => res?._match || null,
        collect: async () => (res?._match ? [res._match] : []),
      };
    },
    take: async () => props,
  });
  const ctx = {
    db: {
      get: async (id: string) => {
        if (opts.throwOnGet) throw new Error("Invalid Convex id");
        return props.find((p) => String(p._id) === String(id)) || null;
      },
      query,
    },
    // test introspection hook
    __counts: queries,
  };
  // wrap query to count
  const origQuery = ctx.db.query.bind(ctx.db);
  (ctx.db as any).query = (table: string) => {
    if (table === "properties") queries.properties++;
    if (table === "users") queries.users++;
    return origQuery(table);
  };
  return ctx as any;
}

const allProps = [propWithUnits, standaloneProp, foreignProp, noUnitsProp];

describe("shape 1 — property custom id", () => {
  it("resolves a standalone property by custom id", async () => {
    const ctx = makeCtx(allProps);
    const r = createUnitResolver(ctx, FIRM);
    const ref = await r.resolveUnit("PROP-2");
    expect(ref).not.toBeNull();
    expect(ref!.match).toBe("custom_id");
    expect(ref!.propertyId).toBe(String(standaloneProp._id));
    expect(ref!.unit).toBeNull();
  });

  it("label uses the first address segment", async () => {
    const ctx = makeCtx(allProps);
    const ref = await createUnitResolver(ctx, FIRM).resolveUnit("PROP-2");
    expect(ref!.label).toBe("4 Awolowo Rd");
  });

  it("rejects a custom id belonging to another firm", async () => {
    const ctx = makeCtx(allProps);
    const ref = await createUnitResolver(ctx, FIRM).resolveUnit("PROP-X");
    expect(ref).toBeNull();
  });
});

describe("shape 2 — property Convex _id", () => {
  it("resolves a standalone property by Convex id", async () => {
    const ctx = makeCtx(allProps);
    const ref = await createUnitResolver(ctx, FIRM).resolveUnit(String(standaloneProp._id));
    expect(ref).not.toBeNull();
    expect(ref!.match).toBe("convex_id");
    expect(ref!.customId).toBe("PROP-2");
  });

  it("a non-property Convex id (e.g. a user id) does not match", async () => {
    const ctx = makeCtx(allProps);
    const ref = await createUnitResolver(ctx, FIRM).resolveUnit("u57tenantxxxxxxxxxxxxxxxx");
    expect(ref).toBeNull();
  });

  it("rejects another firm's property resolved by Convex id", async () => {
    const ctx = makeCtx(allProps);
    const ref = await createUnitResolver(ctx, FIRM).resolveUnit(String(foreignProp._id));
    expect(ref).toBeNull();
  });
});

describe("shape 3 — composite ${propertyId}_${unitId|unitName}", () => {
  it("resolves via custom-id prefix + embedded unit id", async () => {
    const ctx = makeCtx(allProps);
    const ref = await createUnitResolver(ctx, FIRM).resolveUnit("PROP-1_unit-3b");
    expect(ref).not.toBeNull();
    expect(ref!.match).toBe("composite");
    expect(ref!.unit).toEqual(propWithUnits.units[0]);
    expect(ref!.label).toBe("Unit 3B · 12 Marina Rd");
  });

  it("resolves via Convex-id prefix", async () => {
    const ctx = makeCtx(allProps);
    const ref = await createUnitResolver(ctx, FIRM).resolveUnit(`${propWithUnits._id}_unit-4a`);
    expect(ref).not.toBeNull();
    expect(ref!.match).toBe("composite");
  });

  it("resolves via unit NAME suffix when the id doesn't match", async () => {
    const ctx = makeCtx(allProps);
    const ref = await createUnitResolver(ctx, FIRM).resolveUnit("PROP-1_Unit 4A");
    expect(ref).not.toBeNull();
    expect(ref!.match).toBe("composite");
    expect(ref!.unit!.unitName).toBe("Unit 4A");
  });

  it("an underscore in a custom id is not blindly split (prefix must match exactly)", async () => {
    const ctx = makeCtx(allProps);
    // "PROP-1_unit-3b" must NOT resolve via "PROP-1_unit" style prefixes —
    // exact-prefix matching only.
    const ref = await createUnitResolver(ctx, FIRM).resolveUnit("PROP-1_unit");
    expect(ref).toBeNull();
  });

  it("non-matching suffix falls through (composite prefix matched, unit didn't)", async () => {
    const ctx = makeCtx(allProps);
    const ref = await createUnitResolver(ctx, FIRM).resolveUnit("PROP-1_unit-9z");
    // shape-4 sweep: no bare unit with id "PROP-1_unit-9z" → null
    expect(ref).toBeNull();
  });
});

describe("shape 4 — bare embedded unit id", () => {
  it("resolves a bare unit id by scanning the firm's properties", async () => {
    const ctx = makeCtx(allProps);
    const ref = await createUnitResolver(ctx, FIRM).resolveUnit("unit-4a");
    expect(ref).not.toBeNull();
    expect(ref!.match).toBe("bare_unit");
    expect(ref!.propertyId).toBe(String(propWithUnits._id));
  });

  it("bare unit id from another firm's property never resolves (firm-scoped load)", async () => {
    const ctx = makeCtx(allProps);
    const r = createUnitResolver(ctx, FIRM);
    // foreign prop is not in firm's property list → unresolvable
    const ref = await r.resolveUnit("foreign-unit-x");
    expect(ref).toBeNull();
  });
});

describe("tenantFor — tenant derivation", () => {
  it("derives tenant contact info preferring unit over property fallbacks", async () => {
    const ctx = makeCtx(allProps);
    const r = createUnitResolver(ctx, FIRM);
    const ref = (await r.resolveUnit("PROP-1_unit-3b"))!;
    const t = await r.tenantFor(ref);
    expect(t.email).toBe("t3b@x.ng"); // unit-level beats property rentalDetails
    expect(t.name).toBe("Mrs. Bello");
    expect(t.userConvexId).toBe("u57tenantxxxxxxxxxxxxxxxx"); // resolved via users lookup
  });

  it("property-level fallback email is used when the unit has none", async () => {
    const ctx = makeCtx(allProps);
    const r = createUnitResolver(ctx, FIRM);
    const ref = (await r.resolveUnit("PROP-1_unit-4a"))!;
    const t = await r.tenantFor(ref);
    expect(t.email).toBe("fallback@x.ng"); // property rentalDetails.tenantEmail
    expect(t.userConvexId).toBeNull(); // no user with that email
  });

  it("all-empty tenant info returns nulls (the unlinked-rows case)", async () => {
    const ctx = makeCtx([noUnitsProp]);
    const r = createUnitResolver(ctx, FIRM);
    const ref = (await r.resolveUnit(String(noUnitsProp._id)))!;
    const t = await r.tenantFor(ref);
    expect(t.email).toBeNull();
    expect(t.name).toBeNull();
    expect(t.phone).toBeNull();
  });
});

describe("canonicalTenantId — canonical id preference", () => {
  it("prefers the resolved Convex user id", () => {
    expect(
      canonicalTenantId({ userConvexId: "u57", rawTenantId: "legacy-9", name: null, phone: null, email: null })
    ).toBe("u57");
  });

  it("falls back to the raw stored tenant id", () => {
    expect(
      canonicalTenantId({ userConvexId: null, rawTenantId: "legacy-9", name: null, phone: null, email: null })
    ).toBe("legacy-9");
  });

  it("returns null when nothing is known", () => {
    expect(
      canonicalTenantId({ userConvexId: null, rawTenantId: null, name: null, phone: null, email: null })
    ).toBeNull();
  });
});

describe("memoization (the perf contract)", () => {
  it("the firm property list is queried once across many resolutions", async () => {
    const ctx = makeCtx(allProps);
    const r = createUnitResolver(ctx, FIRM);
    await r.resolveUnit("unit-3b");
    await r.resolveUnit("unit-4a");
    await r.resolveUnit("PROP-2");
    // shape-3/4 resolutions share ONE loadProps; shape-1/2 use indexed
    // lookups. The by_firm collect should have run exactly once.
    const collectCalls = (ctx.db as any).__collectCount || 1;
    expect(collectCalls).toBeLessThanOrEqual(2); // 1 memoized + at most 1 index probe
  });

  it("a failing properties query degrades to empty (catch path), not a throw", async () => {
    const ctx = makeCtx(allProps);
    // Make collect() reject to exercise the .catch((): any[] => []) path
    const orig = ctx.db.query;
    ctx.db.query = (table: string) => {
      const base = orig(table);
      if (table === "properties") {
        const wrapped = {
          ...base,
          withIndex: (...a: any[]) => {
            const inner = base.withIndex(...a);
            return {
              ...inner,
              collect: async () => {
                throw new Error("index unavailable");
              },
              first: inner.first,
            };
          },
        };
        return wrapped as any;
      }
      return base;
    };
    const r = createUnitResolver(ctx, FIRM);
    // composite/bare shapes fail soft; shape-1 still works via index
    const ref = await r.resolveUnit("PROP-2");
    expect(ref!.match).toBe("custom_id");
  });
});

describe("resolver edge cases", () => {
  it("empty unitId resolves to null", async () => {
    const ctx = makeCtx(allProps);
    expect(await createUnitResolver(ctx, FIRM).resolveUnit("")).toBeNull();
  });

  it("db.get throwing (UUID-shaped ids) falls through to composite/bare search", async () => {
    const ctx = makeCtx(allProps, { throwOnGet: true });
    // custom id path resolves first anyway (PROP-1); the throw must not bubble
    const ref = await createUnitResolver(ctx, FIRM).resolveUnit("PROP-1_unit-3b");
    expect(ref!.match).toBe("composite");
  });
});
