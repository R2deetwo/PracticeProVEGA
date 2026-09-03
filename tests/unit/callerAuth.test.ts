/**
 * Round 8 regression suite — the strict caller-verification guards.
 *
 * These lock in the auth retrofit that closed the authless-attack-surface
 * class: every live public Convex writer verifies its caller via
 * convex/callerAuth.ts. If a future refactor weakens these guards, this
 * suite fails the build BEFORE deploy (tests.yml gates convex-deploy.yml).
 *
 * The ctx is a minimal in-memory double of the Convex database surface
 * the guards touch: db.get, db.query(table).withIndex(...).first(), and
 * auth.getUserIdentity — exactly the interface callerAuth consumes.
 */
import { describe, it, expect } from "vitest";
import {
  resolveCaller,
  requireStaffCaller,
  requirePortalCaller,
  requireFounderCaller,
  assertSameFirm,
} from "../../convex/callerAuth";

type UserDoc = {
  _id: string;
  _creationTime?: number;
  email?: string | null;
  tokenIdentifier?: string | null;
  firmId?: string | null;
  role?: string | null;
  joinedFirmIds?: string[];
  deactivatedAt?: number | null;
};

/** In-memory users table with the index shapes callerAuth queries. */
function makeCtx(users: UserDoc[], sessionEmail?: string | null) {
  const byToken = new Map<string, UserDoc>();
  const byEmail = new Map<string, UserDoc>();
  const byId = new Map<string, UserDoc>();
  for (const u of users) {
    if (u.tokenIdentifier) byToken.set(u.tokenIdentifier.toLowerCase(), u);
    if (u.email) byEmail.set(u.email.toLowerCase(), u);
    byId.set(u._id, u);
  }
  const query = (table: string) => ({
    withIndex: (_name: string, pred: (q: any) => any) => {
      // The guards use q.eq("tokenIdentifier", e) / q.eq("email", e) —
      // emulate the index by resolving the predicate against our maps.
      const probe: any = {
        eq: (field: string, value: any) => {
          const v = String(value).toLowerCase();
          const found =
            (table === "users" && field === "tokenIdentifier" && byToken.get(v)) ||
            (table === "users" && field === "email" && byEmail.get(v)) ||
            null;
          return { _match: found, field, value };
        },
      };
      const res = pred(probe);
      return {
        first: async () => res?._match || null,
        collect: async () => (res?._match ? [res._match] : []),
      };
    },
    filter: () => ({ first: async () => null, collect: async () => [] }),
    take: async () => [] as UserDoc[],
  });
  return {
    db: {
      get: async (id: string) => byId.get(String(id)) || null,
      query,
    },
    auth: {
      getUserIdentity: async () =>
        sessionEmail ? { email: sessionEmail, subject: sessionEmail } : null,
    },
  };
}

const FIRM = "firmA";
const OTHER_FIRM = "firmB";

const admin: UserDoc = {
  _id: "u_admin",
  email: "admin@firm.ng",
  tokenIdentifier: "admin@firm.ng",
  firmId: FIRM,
  role: "Admin",
};
const tenant: UserDoc = {
  _id: "u_tenant",
  email: "tenant@x.ng",
  tokenIdentifier: "tenant@x.ng",
  firmId: FIRM,
  role: "Tenant",
};
const founder: UserDoc = {
  _id: "u_founder",
  email: "founder@practicepro.ng",
  tokenIdentifier: "founder@practicepro.ng",
  firmId: FIRM,
  role: "Founder",
};
const joinedMember: UserDoc = {
  _id: "u_joined",
  email: "joined@firm.ng",
  tokenIdentifier: "joined@firm.ng",
  firmId: FIRM,
  role: "Lawyer",
  joinedFirmIds: [OTHER_FIRM],
};

describe("resolveCaller — the strict no-anonymous-fallback resolver", () => {
  it("resolves via caller-supplied email (legacy tokenIdentifier convention)", async () => {
    const ctx = makeCtx([admin]);
    const u = await resolveCaller(ctx, { userEmail: "Admin@Firm.ng" });
    expect(u._id).toBe("u_admin"); // case-insensitive + trimmed
  });

  it("resolves via the users.by_email index when tokenIdentifier diverged", async () => {
    const drifted: UserDoc = { ...admin, tokenIdentifier: "legacy-token" };
    const ctx = makeCtx([drifted]);
    const u = await resolveCaller(ctx, { userEmail: "admin@firm.ng" });
    expect(u._id).toBe("u_admin");
  });

  it("resolves via caller-supplied userId (Convex _id)", async () => {
    const ctx = makeCtx([admin]);
    const u = await resolveCaller(ctx, { userId: "u_admin" });
    expect(u._id).toBe("u_admin");
  });

  it("a Convex Auth session takes precedence and resolves by its email", async () => {
    const ctx = makeCtx([admin, tenant], "admin@firm.ng");
    const u = await resolveCaller(ctx, {});
    expect(u._id).toBe("u_admin");
  });

  it("REJECTS an unknown email (spoofed identity — round 8's core fix)", async () => {
    const ctx = makeCtx([admin]);
    await expect(
      resolveCaller(ctx, { userEmail: "attacker@evil.ng" })
    ).rejects.toThrow(/Unauthenticated/);
  });

  it("REJECTS when no identity is supplied at all (no anonymous fallback)", async () => {
    const ctx = makeCtx([admin]);
    await expect(resolveCaller(ctx, {})).rejects.toThrow(/Unauthenticated/);
  });

  it("session identity that matches NO users row is rejected", async () => {
    const ctx = makeCtx([admin], "ghost@nowhere.ng");
    await expect(resolveCaller(ctx, {})).rejects.toThrow(/Unauthenticated/);
  });
});

describe("assertSameFirm — firm-scope enforcement", () => {
  it("allows the caller's own firm", () => {
    expect(() => assertSameFirm(admin, FIRM)).not.toThrow();
  });

  it("allows a firm the caller joined (joinedFirmIds)", () => {
    expect(() => assertSameFirm(joinedMember, OTHER_FIRM)).not.toThrow();
  });

  it("REJECTS a different firm (cross-firm data access)", () => {
    expect(() => assertSameFirm(admin, OTHER_FIRM)).toThrow(/different firm/);
  });

  it("REJECTS a missing firm context", () => {
    expect(() => assertSameFirm(admin, undefined)).toThrow(/Missing firm/);
  });
});

describe("requireStaffCaller — portal roles blocked, firm must match", () => {
  it("allows a staff caller with matching firm", async () => {
    const ctx = makeCtx([admin]);
    const u = await requireStaffCaller(ctx, {
      userEmail: "admin@firm.ng",
      firmId: FIRM,
    });
    expect(u.role).toBe("Admin");
  });

  it("REJECTS a portal user (Tenant) from staff endpoints", async () => {
    const ctx = makeCtx([tenant]);
    await expect(
      requireStaffCaller(ctx, { userEmail: "tenant@x.ng", firmId: FIRM })
    ).rejects.toThrow(/Portal users do not have access/);
  });

  it("REJECTS a staff caller targeting another firm's data", async () => {
    const ctx = makeCtx([admin]);
    await expect(
      requireStaffCaller(ctx, { userEmail: "admin@firm.ng", firmId: OTHER_FIRM })
    ).rejects.toThrow(/different firm/);
  });

  it("when firmId is omitted, only identity is enforced (role + existence)", async () => {
    const ctx = makeCtx([admin]);
    await expect(
      requireStaffCaller(ctx, { userEmail: "admin@firm.ng" })
    ).resolves.toBeTruthy();
  });
});

describe("requirePortalCaller — staff blocked from portal endpoints", () => {
  it("allows a Tenant portal user", async () => {
    const ctx = makeCtx([tenant]);
    const u = await requirePortalCaller(ctx, { userEmail: "tenant@x.ng" });
    expect(u.role).toBe("Tenant");
  });

  it("REJECTS a staff user from portal self-service endpoints", async () => {
    const ctx = makeCtx([admin]);
    await expect(
      requirePortalCaller(ctx, { userEmail: "admin@firm.ng" })
    ).rejects.toThrow(/only available to portal users/);
  });
});

describe("requireFounderCaller — the Founder App admission rule", () => {
  it("allows a Founder", async () => {
    const ctx = makeCtx([founder]);
    const u = await requireFounderCaller(ctx, {
      userEmail: "founder@practicepro.ng",
    });
    expect(u.role).toBe("Founder");
  });

  it("REJECTS an Admin (non-Founder staff)", async () => {
    const ctx = makeCtx([admin]);
    await expect(
      requireFounderCaller(ctx, { userEmail: "admin@firm.ng" })
    ).rejects.toThrow(/Only Founders/);
  });

  it("REJECTS an anonymous caller", async () => {
    const ctx = makeCtx([founder]);
    await expect(requireFounderCaller(ctx, {})).rejects.toThrow(
      /Unauthenticated/
    );
  });
});
