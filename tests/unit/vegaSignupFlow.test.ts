/**
 * vegaSignupFlow.test.ts — the product-scoped signup/onboarding round
 * (2026-11-25), acceptance suite.
 *
 * The brief, exercised against the REAL handlers and the REAL classifier
 * where possible (the Round A/B/F/G house pattern: fixture-backed ctx,
 * `(fn as any)._handler(ctx, args)`, zero reimplementation of the code
 * under test) and source-pinned where behavior is React markup:
 *
 *   PART 1  the false demo funnel is gone (no LeadCaptureModal, no
 *           "View Live Demo" CTA, no bait-and-switch copy)
 *   PART 2  /vega Get Started → Vega — Legal OS pre-selected; Komplete is
 *           never a choice during basic signup (chooser = Vega + Atrium,
 *           the "Change" product chip is retired)
 *   PART 3  the signup modal is compact (no fixed viewport heights; the
 *           shared ModalShell caps at 90vh with internal scroll only as
 *           the safety net)
 *   PART 4  the post-OTP race is dead: getFirmActivityFeed returns [] for
 *           a verified-but-firmless user (real handler), the query is
 *           client-gated on firmId, ONBOARDING_REQUIRED classifies as
 *           onboarding (0 auto-retries), and the [CONVEX Q(...)] transport
 *           prefix can no longer disguise a server error as a dead network
 *   PART 5  recovery accents: Vega blue inside /vega & ?app=vega, Atrium
 *           green for Atrium; post-OTP redirect lands the firmless user in
 *           the OnboardingWizard
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getFirmActivityFeed } from '../../convex/matterLifecycle';
import { hashSessionToken } from '../../convex/sessions';
import {
  classifyConvexError,
  RETRY_POLICIES,
  retryDelayFor,
} from '../../src/utils/errorRecovery';
// Pure resolver — importing the boundary module is safe in node (the React
// tree only renders in the app).
import { resolveRecoveryAccent } from '../../src/components/ConvexErrorBoundary';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolvePath(here, '../../convex/matterLifecycle.ts'))
    ? resolvePath(here, '../..')
    : process.cwd();
const read = (p: string) => readFileSync(resolvePath(repoRoot, p), 'utf8');

// ─── Fixture-backed mock ctx (Round A/B/F/G harness, compact form) ──────────
type Row = Record<string, any>;

function makeCtx(tables: Record<string, Row[]>) {
  const chainFor = (rows: Row[]) => {
    const chain: any = {
      first: async () => rows[0] ?? null,
      unique: async () => rows[0] ?? null,
      collect: async () => rows,
      take: async (n: number) => rows.slice(0, n),
      order: () => chain,
      filter: () => chain,
    };
    return chain;
  };
  const db: any = {
    query: (table: string) => ({
      withIndex: (_name: string, fn: (q: any) => any) => {
        const conds: Array<[string, any]> = [];
        const q: any = { eq: (field: string, value: any) => { conds.push([field, value]); return q; } };
        fn(q);
        const rows = (tables[table] ?? []).filter((r) =>
            conds.every(([f, v]) => String(r[f]) === String(v)));
        return chainFor(rows);
      },
      filter: (fn: any) => chainFor((tables[table] ?? []).filter(() => true)),
      order: () => chainFor(tables[table] ?? []),
      collect: async () => tables[table] ?? [],
      take: async (n: number) => (tables[table] ?? []).slice(0, n),
      first: async () => (tables[table] ?? [])[0] ?? null,
    }),
    get: async (id: any) => {
      for (const rows of Object.values(tables)) {
        const hit = rows.find((r) => String(r._id) === String(id));
        if (hit) return hit;
      }
      return null;
    },
    insert: async (table: string, value: any) => {
      const _id = `${table}_${(tables[table] ?? []).length + 1}_${Math.random().toString(36).slice(2, 7)}`;
      (tables[table] = tables[table] ?? []).push({ _id, ...value });
      return _id as any;
    },
    patch: async (id: any, patch: any) => {
      for (const rows of Object.values(tables)) {
        const hit = rows.find((r) => String(r._id) === String(id));
        if (hit) { Object.assign(hit, patch); return null; }
      }
      return null;
    },
    delete: async () => null,
  };
  return {
    ctx: {
      db,
      runMutation: vi.fn(),
      runAction: vi.fn(),
      runQuery: vi.fn(),
      scheduler: { runAfter: vi.fn() },
      auth: { getUserIdentity: async () => null },
    },
    tables,
  };
}

const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;
// Session fixtures — plain tokens hashed the way the server stores them.
const TOKEN_LAWYER = 'tok-lawyer-aaaa';
const TOKEN_PORTAL = 'tok-portal-bbbb';
const TOKEN_FIRMLESS = 'tok-firmless-cccc'; // the JUST-VERIFIED user — no firm yet

function baseTables(): Record<string, Row[]> {
  return {
    users: [
      { _id: 'u_lawyer', id: 'u_lawyer', name: 'Ada Lawyer', email: 'ada@firm.ng', role: 'Admin', firmId: 'firm-1' },
      { _id: 'u_portal', id: 'u_portal', name: 'Tunde Tenant', email: 'tunde@res.ng', role: 'Tenant', firmId: 'firm-1' },
      // The fresh-user race fixture: OTP verified, session minted, but the
      // OnboardingWizard has NOT created the workspace yet (no firmId).
      { _id: 'u_fresh', id: 'u_fresh', name: 'New User', email: 'new@firm.ng', role: 'Admin' },
    ],
    sessions: [
      { _id: 's_1', tokenHash: hashSessionToken(TOKEN_LAWYER), userId: 'u_lawyer', expiresAt: NOW + DAY, revokedAt: null },
      { _id: 's_2', tokenHash: hashSessionToken(TOKEN_PORTAL), userId: 'u_portal', expiresAt: NOW + DAY, revokedAt: null },
      { _id: 's_3', tokenHash: hashSessionToken(TOKEN_FIRMLESS), userId: 'u_fresh', expiresAt: NOW + DAY, revokedAt: null },
    ],
    suspendedUsers: [],
    firmActivity: [
      { _id: 'fa_1', firmId: 'firm-1', userId: 'u_lawyer', userName: 'Ada Lawyer', action: 'matter.created', timestamp: NOW - 5000, targetType: 'matter', targetId: 'm_1', targetName: 'Adebayo v State' },
      { _id: 'fa_2', firmId: 'firm-1', userId: 'u_lawyer', userName: 'Ada Lawyer', action: 'invoice.sent', timestamp: NOW - 9000, targetType: 'invoice', targetId: 'inv_1', targetName: 'INV-001' },
    ],
    securityEvents: [],
  };
}

// ─── PART 4a: getFirmActivityFeed — safety for unsettled accounts ────────────

describe('getFirmActivityFeed (real handler) — the post-OTP race is dead', () => {
  it('a verified-but-firmless user (mid-onboarding) gets [], not an exception', async () => {
    const { ctx } = makeCtx(baseTables());
    const result = await (getFirmActivityFeed as any)._handler(ctx, {
      sessionToken: TOKEN_FIRMLESS,
      limit: 100,
    });
    expect(result).toEqual([]);
  });

  it('a firm user with a valid session still gets the real feed', async () => {
    const { ctx } = makeCtx(baseTables());
    const result = await (getFirmActivityFeed as any)._handler(ctx, {
      sessionToken: TOKEN_LAWYER,
      limit: 100,
    });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
    // newest-first
    expect(result[0].action).toBe('matter.created');
    expect(result[0].targetName).toBe('Adebayo v State');
  });

  it('an invalid/unknown token still throws the honest Unauthenticated error', async () => {
    const { ctx } = makeCtx(baseTables());
    await expect(
      (getFirmActivityFeed as any)._handler(ctx, { sessionToken: 'not-a-real-token' })
    ).rejects.toThrow(/Unauthenticated/i);
  });

  it('a portal role touching the firm feed still throws the permission error', async () => {
    const { ctx } = makeCtx(baseTables());
    await expect(
      (getFirmActivityFeed as any)._handler(ctx, { sessionToken: TOKEN_PORTAL })
    ).rejects.toThrow(/Portal users do not have access/i);
  });

  it('the firmless guard did NOT neuter requireFirmUser — the marker is live server-side', () => {
    const src = read('convex/authHelpers.ts');
    expect(src).toContain('ONBOARDING_REQUIRED');
    expect(src).toContain('not associated with an active firm');
  });

  it('the client gates the query on firmId — no premature call leaves the browser', () => {
    const src = read('src/contexts/DataProvider.tsx');
    expect(src).toContain('shouldLoadFirmActivityFeed = !!currentUser?.firmId');
    expect(src).toContain('matterLifecycle.getFirmActivityFeed');
  });
});

// ─── PART 4b: classification — UNAUTHENTICATED vs ONBOARDING_REQUIRED ───────

describe('classifyConvexError — the fresh-user race classifies as onboarding', () => {
  // VERBATIM the shape the client saw on /?app=vega after OTP verification:
  // the transport prefix + the firmless rejection. With the marker it must
  // be onboarding (route to setup), never "Connection interrupted".
  const RACE_MESSAGE =
    'Error: [CONVEX Q(matterLifecycle:getFirmActivityFeed)] [Request ID: 77f01] ' +
    'Server Error Uncaught Error: ONBOARDING_REQUIRED: User account not found ' +
    'or not associated with an active firm.';

  it('the exact race message classifies as onboarding, not connection', () => {
    const t = classifyConvexError(RACE_MESSAGE);
    expect(t.category).toBe('onboarding');
    expect(t.title).toBe('Set up your workspace');
    expect(t.title.toLowerCase()).not.toContain('connection');
  });

  it('onboarding NEVER auto-retries — retrying cannot create a workspace', () => {
    expect(RETRY_POLICIES.onboarding.maxAutoRetries).toBe(0);
    expect(retryDelayFor(RETRY_POLICIES.onboarding, 0)).toBeNull();
  });

  it('the bare marker (no transport prefix) also classifies as onboarding', () => {
    expect(classifyConvexError('ONBOARDING_REQUIRED: no firm').category).toBe('onboarding');
  });

  it('the [CONVEX Q(...)] prefix alone no longer fabricates a connection error', () => {
    // The root misclassification that produced the false "Connection
    // interrupted / Reconnecting... (Attempt 2/5)" loop: ANY server-thrown
    // error wrapped in the transport prefix read as a dead network. A
    // server error with no transport vocabulary now classifies by CONTENT.
    expect(
      classifyConvexError('[CONVEX Q(a:b)] Server Error Uncaught Error: something failed').category
    ).not.toBe('connection');
  });

  it('genuine transport failures still classify as connection', () => {
    expect(classifyConvexError('[CONVEX Q(a:b)] Connection lost while streaming').category).toBe('connection');
    expect(classifyConvexError('WebSocket closed before handshake completed').category).toBe('connection');
    expect(classifyConvexError('Network request failed').category).toBe('connection');
    expect(classifyConvexError('TypeError: failed to fetch').category).toBe('connection');
  });

  it('the original incident message (Unauthenticated) still classifies as auth', () => {
    const msg =
      'Error: [CONVEX Q(sentry:getInboundMessages)] [Request ID: 3a018cfd68b594e6] ' +
      'Server Error Uncaught Error: Unauthenticated: a verified session is required. ' +
      'Please sign in again.';
    expect(classifyConvexError(msg).category).toBe('auth');
  });
});

// ─── PART 4c: recovery accents — Vega blue inside vega, Atrium green ─────────

describe('resolveRecoveryAccent — the recovery surface wears the active product', () => {
  const withLocation = (pathname: string, search: string, fn: () => void) => {
    const g = globalThis as any;
    const prev = g.window;
    g.window = { location: { pathname, search, href: `https://app${pathname}${search}` } };
    try { fn(); } finally { if (prev === undefined) delete g.window; else g.window = prev; }
  };

  it('/vega resolves to the Vega accent', () => {
    withLocation('/vega', '', () => expect(resolveRecoveryAccent()).toBe('vega'));
  });

  it('/?app=vega (the in-app URL) resolves to the Vega accent', () => {
    withLocation('/', '?app=vega', () => expect(resolveRecoveryAccent()).toBe('vega'));
  });

  it('/atrium and ?app=atrium resolve to the Atrium accent', () => {
    withLocation('/atrium', '', () => expect(resolveRecoveryAccent()).toBe('atrium'));
    withLocation('/messaging', '?app=atrium', () => expect(resolveRecoveryAccent()).toBe('atrium'));
  });

  it('no window (tests/native fallback) resolves to hub', () => {
    const g = globalThis as any;
    const prev = g.window;
    delete g.window;
    try { expect(resolveRecoveryAccent()).toBe('hub'); } finally {
      if (prev !== undefined) g.window = prev;
    }
  });

  it('the boundary carries the Vega-blue button class and the onboarding recoverable state', () => {
    const src = read('src/components/ConvexErrorBoundary.tsx');
    expect(src).toContain('bg-[#1E3A8A]');
    expect(src).toContain('hover:bg-[#1E40AF]');
    expect(src).toContain('Continue Setup');
    expect(src).toContain("category === 'onboarding'");
  });
});

// ─── PART 1/2/3: the signup funnel sources ──────────────────────────────────

describe('product-scoped signup — sources', () => {
  const vegaSite = read('src/sites/vega/index.tsx');
  const atriumSite = read('src/sites/atrium/index.tsx');
  const signup = read('src/components/auth/Signup.tsx');
  const authTheme = read('src/components/auth/authTheme.tsx');
  const signupOpener = read('src/sites/shared/useSignupOpener.ts');

  it('/vega and /atrium each scope their signup to their own product', () => {
    expect(vegaSite).toContain("useSignupOpener('vega')");
    expect(atriumSite).toContain("useSignupOpener('atrium')");
  });

  it('the Vega signup modal is the honest funnel: header, tagline, fields, checkboxes, Create Account', () => {
    // Header + subtitle come from the themed AuthHeader.
    expect(authTheme).toContain('`Create your ${theme.name} workspace`');
    expect(authTheme).toContain('Legal workflow automation for Nigerian law firms.');
    // The duplicate mono tagline is retired (no microlabel property on the
    // theme definition, no microlabel render in the header).
    expect(authTheme).not.toContain('microlabel:');
    // The form's own trust line + primary action.
    expect(signup).toContain('Your data is encrypted with NDPA 2023-aligned safeguards.');
    expect(signup).toContain("isLoading ? 'Processing...' : isMigrationUser ? 'Create Account & Restore →' : 'Create Account'");
  });

  it('no Komplete choice during basic signup — the chooser offers Vega and Atrium only', () => {
    // No Komplete card in the chooser…
    expect(signup).not.toContain('Komplet <span');
    expect(signup).not.toContain("setSelectedProduct('unified')");
    // …and Vega + Atrium cards are present.
    expect(signup).toContain("setSelectedProduct('legal')");
    expect(signup).toContain("setSelectedProduct('property')");
  });

  it('no cross-product switcher on the product-scoped form — the chip and Change control are retired', () => {
    expect(signup).not.toContain('>Change</button>');
    expect(signup).not.toContain('PracticePro {PRODUCT_DISPLAY_NAMES[selectedProduct]}');
    // The Back control only renders for the chooser (hub) path —
    // product-scoped entries have none.
    expect(signup).toContain('viaChooser && !isMigrationUser');
  });

  it('the signup modal follows the effective product, not the page it was opened from', () => {
    // "Explore Komplete" on /vega must NOT brand the modal Vega.
    expect(signupOpener).toContain("selected === 'legal' ? 'vega'");
    expect(signupOpener).toContain("selected === 'property' ? 'atrium'");
    expect(signupOpener).toContain("'hub'");
  });

  it('the onboarding wizard offers no Komplete pill on its fallback product switcher', () => {
    const wizard = read('src/components/modals/OnboardingWizard.tsx');
    expect(wizard).toContain("(['legal', 'property'] as ProductMode[])");
    expect(wizard).not.toContain("(['legal', 'property', 'unified'] as ProductMode[])");
  });

  it('the modal fits standard viewports — no fixed viewport heights; the shared shell caps at 90vh', () => {
    const shell = read('src/overlays/primitives/ModalShell.tsx');
    expect(shell).toContain('sm:max-h-[90vh]');
    expect(shell).toContain('overflow-y-auto');
    expect(signup).not.toContain('h-[100vh]');
    expect(signup).not.toContain('h-screen');
    expect(signup).not.toContain('min-h-screen');
  });

  it('post-OTP: the session mint and the firmless → OnboardingWizard routing are pinned', () => {
    const authContext = read('src/contexts/AuthContext.tsx');
    const app = read('src/components/App.tsx');
    // R17/P0: verification mints a REAL bearer session immediately.
    expect(authContext).toContain('const minted = await login(email, password);');
    // A firmless (verified) user is routed to the wizard — never the
    // dashboard with firm-scoped queries mid-flight.
    expect(app).toContain("if (currentUser && !isPortalUserRole && (!currentUser.firmId || wizardInProgress)");
    expect(app).toContain('<OnboardingWizard onComplete=');
  });
});
