/**
 * loginSpeedWelcomeEmail.test.ts — the login-modal speed / initial-load /
 * welcome-email deep-link round (2026-11-25), acceptance suite.
 *
 * The three owner-reported live issues, pinned to the real sources:
 *
 *   PART 1  login opens INSTANTLY on /vega and /atrium — the Login and
 *           Signup modals are eagerly bundled (a lazy chunk fetch was the
 *           5-10s three-bar skeleton stall), and the login header carries
 *           NO duplicate "LEGAL WORKFLOW AUTOMATION" microlabel under the
 *           tagline.
 *   PART 2  initial load on /vega and /atrium never flashes raw unstyled
 *           hub copy — the generated shells carry exactly one <title>
 *           (the generator's paired-tag bug that leaked "PracticePro
 *           Systems — Build Systems That Help Scale Your Business" into
 *           the <body> is dead), and the pre-paint phase is
 *           product-scoped (Vega white/blue, Atrium cream/green).
 *   PART 3  the welcome email carries ONE unified sign-in CTA per
 *           product (Vega blue / Atrium emerald / Komplete violet), the
 *           dead "Get Started in 3 Steps" multi-button block is retired,
 *           the CTA deep link (?login=) auto-opens the product-scoped
 *           login modal, and an unauthenticated deep-link clicker is
 *           PROMPTED to sign in instead of being stranded on the base
 *           site (parked handoff completes).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sendWelcomeEmail } from '../../convex/myFunctions';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolvePath(here, '../../convex/myFunctions.ts'))
    ? resolvePath(here, '../..')
    : process.cwd();
const read = (p: string) => readFileSync(resolvePath(repoRoot, p), 'utf8');

// ─── PART 1 — login opens instantly, no duplicate tagline ────────────────────

describe('PART 1 — login modal: instant render, clean header', () => {
    it('Login and Signup are EAGERLY imported in ModalLayer (no lazy chunk fetch → no skeleton stall)', () => {
        const layer = read('src/overlays/layers/ModalLayer.tsx');
        expect(layer).toContain("import Login from '../../components/auth/Login'");
        expect(layer).toContain("import Signup from '../../components/auth/Signup'");
        // The lazy-auth-modal pattern that produced the 5-10s stall is gone.
        expect(layer).not.toContain("lazyWithReload(() => import('../../components/auth/Login')");
        expect(layer).not.toContain("lazyWithReload(() => import('../../components/auth/Signup')");
    });

    it('the lazy-loading discipline for HEAVY modals is otherwise intact', () => {
        const layer = read('src/overlays/layers/ModalLayer.tsx');
        // Auth is the deliberate exception; the payload discipline
        // (heavy forms the user may never open stay lazy) survives.
        expect(layer).toContain('const DocumentForm = lazyWithReload');
        expect(layer).toContain('const MatterForm = lazyWithReload');
    });

    it('the login modal header has NO duplicate uppercase microlabel under the tagline', () => {
        const theme = read('src/components/auth/authTheme.tsx');
        const authHeader = theme.slice(theme.indexOf('export const AuthHeader'));
        // The rendered header block carries Mark + name + tagline only —
        // no uppercase mono label line under "Log in to Vega".
        expect(authHeader).toContain("mode === 'login' ? `Log in to ${theme.name}`");
        expect(authHeader).not.toMatch(/uppercase/);
        expect(authHeader).not.toMatch(/LEGAL WORKFLOW AUTOMATION/);

        const login = read('src/components/auth/Login.tsx');
        // Themed logins render the shared AuthHeader; the hub register
        // keeps its plain "Welcome Back" heading.
        expect(login).toContain('<AuthHeader theme={authTheme} mode="login" />');
        expect(login).not.toMatch(/LEGAL WORKFLOW AUTOMATION/);
    });

    it('both product sites open the login modal with their product theme', () => {
        expect(read('src/sites/vega/index.tsx')).toContain(
            "openModal('login', null, { productTheme: 'vega' })"
        );
        expect(read('src/sites/atrium/index.tsx')).toContain(
            "openModal('login', null, { productTheme: 'atrium' })"
        );
    });
});

// ─── PART 2 — initial load: no unstyled text flash on /vega & /atrium ────────

describe('PART 2 — initial load: product-scoped, never unstyled hub copy', () => {
    const shells: Record<string, string> = {
        vega: read('vega.html'),
        atrium: read('atrium.html'),
    };

    it('each product shell carries EXACTLY ONE <title> element (the stray-text leak is dead)', () => {
        for (const [name, html] of Object.entries(shells)) {
            const opens = html.match(/<title>/g)?.length ?? 0;
            const closes = html.match(/<\/title>/g)?.length ?? 0;
            expect(opens, `${name} <title> count`).toBe(1);
            expect(closes, `${name} </title> count`).toBe(1);
        }
    });

    it('the hub tagline text appears in NO product shell body (no top-left unstyled flash)', () => {
        for (const [name, html] of Object.entries(shells)) {
            expect(
                html.includes('Build Systems That Help Scale Your Business'),
                `${name} leaks the hub tagline as stray text`
            ).toBe(false);
        }
    });

    it('the titles are the product titles, not the hub title', () => {
        expect(shells.vega).toContain('<title>Vega — Legal Practice OS for Nigerian Law Firms | PracticePro</title>');
        expect(shells.atrium).toContain('<title>Atrium — Property Management OS for Nigerian Portfolios | PracticePro</title>');
        // The hub keeps its own title on the hub shell only.
        expect(read('index.html')).toContain(
            '<title>PracticePro Systems — Build Systems That Help Scale Your Business</title>'
        );
    });

    it('the generator replaces the WHOLE paired <title> element (root cause fixed, not patched)', () => {
        const gen = read('scripts/generate-product-pages.cjs');
        expect(gen).toContain('function replaceTag(html, prefix, newTag, paired = false)');
        // The title call opts into the paired (full-element) replacement.
        expect(gen).toContain("replaceTag(html, 'title', `  <title>${p.title}</title>`, true)");
        // Void tags (meta) keep the opening-tag-only contract.
        expect(gen).toContain("replaceTag(html, 'meta name=\"description\"'");
    });

    it('each product shell pre-paints its OWN product ground (html + boot overlay)', () => {
        // Vega: pristine white paper (.theme-vega) + Vega night blue on
        // the session-boot overlay — never the generic hub register.
        expect(shells.vega).toContain('html { background: #FFFFFF; }');
        expect(shells.vega).toContain('#pp-boot-overlay { background: #172554; }');
        // Atrium: the Well-Kept Estate cream + Atrium emerald.
        expect(shells.atrium).toContain('html { background: #FAF7F2; }');
        expect(shells.atrium).toContain('#pp-boot-overlay { background: #059669; }');
    });

    it('the pre-paint is head-only — the shells hydrate the same SPA entry', () => {
        for (const [name, html] of Object.entries(shells)) {
            expect(html, `${name} SPA entry`).toContain('<script type="module" src="/src/main.tsx"></script>');
            // And the shells remain generated (single source of truth).
            expect(html, `${name} generator marker`).toContain(
                'GENERATED by scripts/generate-product-pages.cjs'
            );
        }
    });
});

// ─── PART 3 — welcome email: one unified CTA, deep links complete ────────────

describe('PART 3 — welcome email: unified CTA + completing deep links', () => {
    const fns = read('convex/myFunctions.ts');
    const app = read('src/components/App.tsx');

    it('the multi-button "Get Started in 3 Steps" block is retired', () => {
        expect(fns).not.toContain('Get Started in 3 Steps');
        expect(fns).not.toContain('gettingStartedLinks');
        // The dead action deep links are gone from the email templates.
        expect(fns).not.toContain('matters?action=new_matter');
        expect(fns).not.toContain('properties?action=new_property');
    });

    it('ONE unified CTA per product, product-accented, pointing at the sign-in flow', () => {
        // Vega — Vega blue (#1E3A8A), matching the app's Vega auth emphasis.
        expect(fns).toContain("label: 'Sign In to Vega'");
        expect(fns).toContain('href: `${appDomain}/?app=vega&login=vega`');
        expect(fns).toContain("color: '#1E3A8A', // Vega blue");
        // Atrium — Atrium emerald.
        expect(fns).toContain("label: 'Sign In to Atrium'");
        expect(fns).toContain('href: `${appDomain}/?app=atrium&login=atrium`');
        expect(fns).toContain("color: '#059669', // Atrium emerald");
        // Komplete — the bundle's violet.
        expect(fns).toContain("label: 'Sign In to Komplete'");
        expect(fns).toContain('href: `${appDomain}/?app=komplete&login=komplete`');
        expect(fns).toContain("color: '#7C3AED', // Komplete violet");
    });

    it('the email keeps the honest secondary: Help Center + NDPA safeguard line', () => {
        expect(fns).toContain('Your data is encrypted with NDPA 2023-aligned safeguards.');
        // Learning Resources stays a muted secondary resource link.
        expect(fns).toContain('Learning Resources');
        expect(fns).toContain('it opens once you are signed in');
    });

    it('the property variant speaks Atrium copy (ARIA), not Vega copy', () => {
        expect(fns).toContain("${args.product === 'property' ? 'ARIA' : 'ALOA'}");
        expect(fns).toContain('your first Property, rent and service-charge runs');
    });

    it('App.tsx auto-opens the PRODUCT-SCOPED login modal for ?login= links', () => {
        expect(app).toContain("params.get('login')");
        expect(app).toContain("{ productTheme: 'vega' }");
        expect(app).toContain("{ productTheme: 'atrium' }");
        expect(app).toContain("openModal('login', null, loginContext)");
        // The param is consumed — stripped so a refresh can't re-fire it.
        expect(app).toContain('url.searchParams.delete(\'login\')');
        // Only unauthenticated clickers get the modal; signed-in clickers
        // ride the normal auth gates.
        expect(app).toContain('if (loginProduct) {\n            if (!isAuthenticated) {');
    });

    it('an unauthenticated deep-link clicker is PROMPTED to sign in (parked handoff completes)', () => {
        // The redirect effect parks the emailed deep link AND opens the
        // login modal — the post-login redirect then delivers the parked
        // destination. No more stranding on the bare base site.
        expect(app).toContain("sessionStorage.setItem('practicepro_pending_redirect', pendingPath)");
        const parkingBlock = app.slice(
            app.indexOf("sessionStorage.setItem('practicepro_pending_redirect', pendingPath)"),
            app.indexOf("navigate('/', { replace: true });", app.indexOf("'practicepro_pending_redirect', pendingPath"))
        );
        expect(parkingBlock).toContain("openModal('login')");
    });

    it('the parked-redirect + ?login= flows are both allowlist-guarded in emailActions', () => {
        const actions = read('src/utils/emailActions.ts');
        expect(actions).toContain("SAFE_ACTION_REDIRECTS: readonly string[]");
        expect(actions).toContain("'/matters?action=new_matter'");
        expect(actions).toContain("'/help' || path.startsWith('/help/')");
    });
});

// ─── PART 3b — the REAL handler emits the unified CTA (fixture-backed) ──────
// House pattern: invoke the actual internalAction handler with fetch mocked
// and a stub key, then assert the exact htmlContent Brevo would receive.

describe('PART 3b — sendWelcomeEmail handler emits one unified CTA (real handler)', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
    });

    const runHandler = async (product?: string) => {
        vi.stubEnv('PracticePro_Vega_Mailer', 'test-key');
        const captured: { url?: string; body?: any } = {};
        vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
            captured.url = url;
            captured.body = JSON.parse(String(init?.body));
            return { ok: true } as Response;
        }));
        await (sendWelcomeEmail as any)._handler({}, {
            email: 'lawyer@example.ng',
            product,
            name: 'Ada',
        });
        return captured;
    };

    it('Vega (legal): "Sign In to Vega" on Vega blue, ?app=vega&login=vega — no step buttons', async () => {
        const { body } = await runHandler('legal');
        const html: string = body.htmlContent;
        expect(body.subject).toBe('Welcome to PracticePro Vega!');
        expect(body.to[0].email).toBe('lawyer@example.ng');
        // The one unified CTA: label, destination, Vega blue.
        expect(html).toContain('Sign In to Vega &rarr;</a>');
        expect(html).toContain('https://practice-pro-vega.vercel.app/?app=vega&login=vega');
        expect(html).toContain('background-color:#1E3A8A');
        // The retired multi-button funnel is absent.
        expect(html).not.toContain('Get Started in 3 Steps');
        expect(html).not.toContain('Create your first Matter');
        expect(html).not.toContain('Meet ALOA');
        expect(html).not.toContain('matters?action=new_matter');
        // Honest secondary + safeguard line.
        expect(html).toContain('Learning Resources');
        expect(html).toContain('opens once you are signed in');
        expect(html).toContain('Your data is encrypted with NDPA 2023-aligned safeguards.');
        // ALOA is the assistant for the Vega variant.
        expect(html).toContain('ALOA — your built-in AI assistant');
    });

    it('Atrium (property): "Sign In to Atrium" on Atrium emerald, ?app=atrium&login=atrium', async () => {
        const { body } = await runHandler('property');
        const html: string = body.htmlContent;
        expect(body.subject).toBe('Welcome to PracticePro Atrium!');
        expect(html).toContain('Sign In to Atrium &rarr;</a>');
        expect(html).toContain('https://practice-pro-vega.vercel.app/?app=atrium&login=atrium');
        expect(html).toContain('background-color:#059669');
        // Atrium speaks Atrium copy.
        expect(html).toContain('ARIA — your built-in AI assistant');
        expect(html).toContain('your first Property');
        // Never the Vega CTA in the Atrium variant.
        expect(html).not.toContain('Sign In to Vega');
        expect(html).not.toContain('?app=vega');
    });

    it('Komplete (unified): its own CTA on the bundle violet', async () => {
        const { body } = await runHandler('unified');
        const html: string = body.htmlContent;
        expect(body.subject).toBe('Welcome to PracticePro Komplete!');
        expect(html).toContain('Sign In to Komplete &rarr;</a>');
        expect(html).toContain('https://practice-pro-vega.vercel.app/?app=komplete&login=komplete');
        expect(html).toContain('background-color:#7C3AED');
    });
});
