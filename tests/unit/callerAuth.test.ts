/**
 * R16 (plan Round 15) regression suite — STRICT caller verification.
 *
 * These lock in the identity cutover: every public Convex function resolves
 * its caller from the bearer session issued by verifyLogin. Email-only and
 * userId-only caller identity — the spoofable legacy convention (anyone who
 * knows a staff email could call the API as them) — is REJECTED while
 * STRICT_IDENTITY_MODE is on. If a future refactor weakens these guards,
 * this suite fails the build BEFORE deploy (tests.yml gates the deploy).
 *
 * The ctx is a minimal in-memory double of the Convex surface the guards
 * touch: db.get, db.query(table).withIndex(...).first() (users by
 * tokenIdentifier/email, sessions by tokenHash), and
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
import { sha256Hex } from "../../convex/sha256";

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

type SessionDoc = {
  tokenHash: string;
  userId: string;
  expiresAt: number;
  revokedAt?: number | null;
};

/**
 * In-memory users + sessions tables with the index shapes callerAuth
 * queries. `sessions` maps PLAINTEXT tokens to session rows; the mock
 * resolves by_tokenHash by hashing the presented token with the REAL
 * sha256 (the same code path production uses).
 */
function makeCtx(users: UserDoc[], opts: { sessionEmail?: string | null; sessions?: Record<string, SessionDoc> } = {}) {
  const byToken = new Map<string, UserDoc>();
  const byEmail = new Map<string, UserDoc>();
  const byId = new Map<string, UserDoc>();
  for (const u of users) {
    if (u.tokenIdentifier) byToken.set(u.tokenIdentifier.toLowerCase(), u);
    if (u.email) byEmail.set(u.email.toLowerCase(), u);
    byId.set(u._id, u);
  }
  const sessions = opts.sessions || {};
  const byTokenHash = new Map<string, SessionDoc>();
  for (const [plainToken, row] of Object.entries(sessions)) {
    byTokenHash.set(sha256Hex(plainToken), row);
  }
  const query = (table: string) => ({
    withIndex: (_name: string, pred: (q: any) => any) => {
      const probe: any = {
        eq: (field: string, value: any) => {
          const v = String(value).toLowerCase();
          const found =
            (table === "users" && field === "tokenIdentifier" && byToken.get(v)) ||
            (table === "users" && field === "email" && byEmail.get(v)) ||
            (table === "sessions" && field === "tokenHash" && byTokenHash.get(String(value))) ||
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
        opts.sessionEmail ? { email: opts.sessionEmail, subject: opts.sessionEmail } : null,
    },
  };
}

const FIRM = "firmA";
const OTHER_FIRM = "firmB";
const NOW = Date.now();

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

/** A live session for the given user, keyed by its plaintext token. */
const liveSession = (token: string, userId: string): Record<string, SessionDoc> => ({
  [token]: { tokenHash: sha256Hex(token), userId, expiresAt: NOW + 86_400_000 },
});

describe("resolveCaller — STRICT IDENTITY MODE (R16 cutover)", () => {
  it("resolves the caller from a VALID bearer session token", async () => {
    const ctx = makeCtx([admin], { sessions: liveSession("tok-admin", "u_admin") });
    const u = await resolveCaller(ctx, { sessionToken: "tok-admin" });
    expect(u._id).toBe("u_admin");
  });

  it("an INVALID session token throws — never falls through to caller-supplied email", async () => {
    const ctx = makeCtx([admin]);
    await expect(
      resolveCaller(ctx, { sessionToken: "dead-token", userEmail: "admin@firm.ng" })
    ).rejects.toThrow(/session token is invalid, expired, or revoked/);
  });

  it("a REVOKED session token is rejected (logout kills identity)", async () => {
    const ctx = makeCtx([admin], {
      sessions: { "tok-gone": { tokenHash: sha256Hex("tok-gone"), userId: "u_admin", expiresAt: NOW + 86_400_000, revokedAt: NOW - 1 } },
    });
    await expect(resolveCaller(ctx, { sessionToken: "tok-gone" })).rejects.toThrow(
      /session token is invalid, expired, or revoked/
    );
  });

  it("an EXPIRED session token is rejected", async () => {
    const ctx = makeCtx([admin], {
      sessions: { "tok-old": { tokenHash: sha256Hex("tok-old"), userId: "u_admin", expiresAt: NOW - 1 } },
    });
    await expect(resolveCaller(ctx, { sessionToken: "tok-old" })).rejects.toThrow(
      /session token is invalid, expired, or revoked/
    );
  });

  it("REJECTS email-only identity — the spoofable legacy path is closed (round 15 cutover)", async () => {
    const ctx = makeCtx([admin]);
    await expect(
      resolveCaller(ctx, { userEmail: "admin@firm.ng" })
    ).rejects.toThrow(/a verified session is required/);
  });

  it("REJECTS an unknown spoofed email the same way (no user-existence oracle)", async () => {
    const ctx = makeCtx([admin]);
    await expect(
      resolveCaller(ctx, { userEmail: "attacker@evil.ng" })
    ).rejects.toThrow(/a verified session is required/);
  });

  it("REJECTS userId-only identity (leaked ids are not possession proof)", async () => {
    const ctx = makeCtx([admin]);
    await expect(resolveCaller(ctx, { userId: "u_admin" })).rejects.toThrow(
      /a verified session is required/
    );
  });

  it("REJECTS when no identity is supplied at all (no anonymous fallback)", async () => {
    const ctx = makeCtx([admin]);
    await expect(resolveCaller(ctx, {})).rejects.toThrow(/a verified session is required/);
  });

  it("a valid session token outranks a caller-supplied spoofed email", async () => {
    const ctx = makeCtx([admin, tenant], { sessions: liveSession("tok-ten", "u_tenant") });
    // Attacker presents a valid token of the TENANT plus admin's email:
    // the session wins — they are the tenant, not the admin.
    const u = await resolveCaller(ctx, { sessionToken: "tok-ten", userEmail: "admin@firm.ng" });
    expect(u._id).toBe("u_tenant");
  });

  it("a Convex Auth session (if ever configured) still resolves by its email", async () => {
    const ctx = makeCtx([admin, tenant], { sessionEmail: "admin@firm.ng" });
    const u = await resolveCaller(ctx, {});
    expect(u._id).toBe("u_admin");
  });

  it("a Convex Auth identity matching NO users row is rejected", async () => {
    const ctx = makeCtx([admin], { sessionEmail: "ghost@nowhere.ng" });
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

describe("requireStaffCaller — portal roles blocked, firm must match (session identity)", () => {
  it("allows a staff caller with matching firm", async () => {
    const ctx = makeCtx([admin], { sessions: liveSession("tok-admin", "u_admin") });
    const u = await requireStaffCaller(ctx, {
      sessionToken: "tok-admin",
      firmId: FIRM,
    });
    expect(u.role).toBe("Admin");
  });

  it("REJECTS a portal user (Tenant) from staff endpoints", async () => {
    const ctx = makeCtx([tenant], { sessions: liveSession("tok-ten", "u_tenant") });
    await expect(
      requireStaffCaller(ctx, { sessionToken: "tok-ten", firmId: FIRM })
    ).rejects.toThrow(/Portal users do not have access/);
  });

  it("REJECTS a staff caller targeting another firm's data", async () => {
    const ctx = makeCtx([admin], { sessions: liveSession("tok-admin", "u_admin") });
    await expect(
      requireStaffCaller(ctx, { sessionToken: "tok-admin", firmId: OTHER_FIRM })
    ).rejects.toThrow(/different firm/);
  });

  it("when firmId is omitted, only identity is enforced (role + session)", async () => {
    const ctx = makeCtx([admin], { sessions: liveSession("tok-admin", "u_admin") });
    await expect(
      requireStaffCaller(ctx, { sessionToken: "tok-admin" })
    ).resolves.toBeTruthy();
  });

  it("REJECTS an email-only staff identity under strict mode", async () => {
    const ctx = makeCtx([admin]);
    await expect(
      requireStaffCaller(ctx, { userEmail: "admin@firm.ng", firmId: FIRM })
    ).rejects.toThrow(/a verified session is required/);
  });
});

describe("requirePortalCaller — staff blocked from portal endpoints (session identity)", () => {
  it("allows a Tenant portal user", async () => {
    const ctx = makeCtx([tenant], { sessions: liveSession("tok-ten", "u_tenant") });
    const u = await requirePortalCaller(ctx, { sessionToken: "tok-ten" });
    expect(u.role).toBe("Tenant");
  });

  it("REJECTS a staff user from portal self-service endpoints", async () => {
    const ctx = makeCtx([admin], { sessions: liveSession("tok-admin", "u_admin") });
    await expect(
      requirePortalCaller(ctx, { sessionToken: "tok-admin" })
    ).rejects.toThrow(/only available to portal users/);
  });

  it("REJECTS an email-only portal identity under strict mode", async () => {
    const ctx = makeCtx([tenant]);
    await expect(
      requirePortalCaller(ctx, { userEmail: "tenant@x.ng" })
    ).rejects.toThrow(/a verified session is required/);
  });
});

describe("requireFounderCaller — the Founder App admission rule (session identity)", () => {
  it("allows a Founder", async () => {
    const ctx = makeCtx([founder], { sessions: liveSession("tok-fdr", "u_founder") });
    const u = await requireFounderCaller(ctx, { sessionToken: "tok-fdr" });
    expect(u.role).toBe("Founder");
  });

  it("REJECTS an Admin (non-Founder staff) presenting a valid session", async () => {
    const ctx = makeCtx([admin], { sessions: liveSession("tok-admin", "u_admin") });
    await expect(
      requireFounderCaller(ctx, { sessionToken: "tok-admin" })
    ).rejects.toThrow(/Only Founders/);
  });

  it("REJECTS an anonymous caller", async () => {
    const ctx = makeCtx([founder]);
    await expect(requireFounderCaller(ctx, {})).rejects.toThrow(/Unauthenticated/);
  });

  it("REJECTS an email-only founder identity under strict mode", async () => {
    const ctx = makeCtx([founder]);
    await expect(
      requireFounderCaller(ctx, { userEmail: "founder@practicepro.ng" })
    ).rejects.toThrow(/a verified session is required/);
  });
});
