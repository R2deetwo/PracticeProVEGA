/**
 * R73 — "the silk pass": source-contract tests for the smoothness +
 * load-time work. Owner direction (verbatim shape): "it is glitchy and
 * slow and we need to ensure that the sites are as silky smooth as
 * possible to use always."
 *
 * Two halves:
 *   1. RUNTIME — the marketing pages' animation/scroll machinery stops
 *      fighting the main thread: the ribbon canvas paints at ~30fps
 *      (identical sway, half the cost), the four liquid seams share ONE
 *      batched rAF pass (measure-all-then-paint-all — no per-seam forced
 *      layouts), the site scroll listener is passive + rAF-throttled and
 *      only re-renders when the active section actually changes, the
 *      docked marquee runs on its own compositor layer, one-shot reveal
 *      layers are RELEASED after the reveal (no forever-layers), the
 *      blur(7px) reveal leg is mobile-only-off, and the fixed navs blur
 *      at md instead of xl.
 *   2. LOAD — a logged-out visitor to /, /vega or /atrium previously
 *      downloaded ~7.4MB of eager JS (the whole app: entry 3.1MB +
 *      module-settings 1.2MB + vendor-pdf 1.1MB + editor/atrium/research/
 *      ai…). The app-only views are now lazyWithReload chunks, the
 *      marketing router is its own warmed chunk, jspdf/pdfjs/@google
 *      load on first use, and the per-view manual chunks are retired
 *      (they hoisted the shared core, which dragged them all eager).
 *      Eager set after: ~2.7MB (entry + react/convex/icons/css).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (...p: string[]) => readFileSync(join(__dirname, '..', '..', ...p), 'utf8');

describe('R73 runtime: the ribbon canvas frame cap (HeroRibbons.tsx)', () => {
    const comp = read('src', 'components', 'HeroRibbons.tsx');

    it('paints at most once per 33ms while ticking every rAF, accumulating skipped time', () => {
        expect(comp).toContain('const FRAME_MIN_MS = 33');
        expect(comp).toContain('acc += dt');
        expect(comp).toContain('t += acc');
        // the rAF still reschedules every frame (resume/pause timing unchanged)
        expect(comp).toContain('raf = requestAnimationFrame(tick);');
    });

    it('keeps the R55-pinned contract strings intact (dt clamp, resume guard)', () => {
        expect(comp).toContain('Math.min((now - last) / 1000, 0.1)');
        expect(comp).toContain('!raf && !reduce && visible && !document.hidden');
    });

    it('skips drawing on a zero-sized canvas', () => {
        expect(comp).toContain('if (W > 0 && H > 0) draw();');
    });
});

describe('R73 runtime: the shared seam pass (MarqueeSection.tsx)', () => {
    const sec = read('src', 'sites', 'hub', 'sections', 'MarqueeSection.tsx');

    it('all seams share ONE rAF pass — measure every seam, then paint every seam', () => {
        expect(sec).toContain('const seamJobs = new Set<SeamJob>()');
        expect(sec).toContain('seamJobs.forEach((job) => job.measure());');
        expect(sec).toContain('seamJobs.forEach((job) => job.paint(now));');
    });

    it('seams join/leave the shared pass via IntersectionObserver (off-screen = free)', () => {
        expect(sec).toContain('seamJobs.add(job);');
        expect(sec).toContain('seamJobs.delete(job);');
    });

    it('the R72 docked marquee strip is untouched (h-12, hairline, navy)', () => {
        expect(sec).toContain('relative h-12 overflow-hidden border-t border-white/10 bg-[#050B18]');
    });
});

describe('R73 runtime: the scroll listener (useSiteScroll.ts)', () => {
    const hook = read('src', 'sites', 'shared', 'useSiteScroll.ts');

    it('is passive and rAF-throttled (one pass per painted frame)', () => {
        expect(hook).toContain("addEventListener('scroll', handleScroll, { passive: true })");
        expect(hook).toContain('if (!raf) raf = requestAnimationFrame(update);');
    });

    it('only re-renders when the active section actually changes', () => {
        expect(hook).toContain('setActiveSection((prev) => (prev === section ? prev : section))');
    });
});

describe('R73 runtime: the CSS pass (index.css)', () => {
    const css = read('src', 'index.css');

    it('the marquee track is pinned to its own compositor layer', () => {
        expect(css).toMatch(/\.w7-marquee-track \{[^}]*will-change: transform;/s);
    });

    it('one-shot reveal layers are released after the reveal (vega + hub)', () => {
        expect(css).toMatch(/\[data-vg-reveal\]\.vg-in \{[^}]*will-change: auto;/s);
        expect(css).toMatch(/\.w9-reveal\.is-visible \{[^}]*will-change: auto;/s);
        expect(css).toMatch(/\.w9-reveal-stagger\.is-visible > \* \{[^}]*will-change: auto;/s);
    });

    it('the blur(7px) reveal leg is dropped below lg (phones keep rise+fade)', () => {
        expect(css).toContain('@media (max-width: 1023.98px)');
        expect(css).toMatch(/\.w9-reveal,[^}]*transition-property: opacity, transform;/s);
    });
});

describe('R73 runtime: fixed nav blur (three shells)', () => {
    it('vega / hub / atrium navs blur at md, not xl', () => {
        expect(read('src', 'sites', 'vega', 'VegaShell.tsx')).not.toContain('backdrop-blur-xl');
        expect(read('src', 'sites', 'atrium', 'AtriumShell.tsx')).not.toContain('backdrop-blur-xl');
        const hub = read('src', 'sites', 'hub', 'HubShell.tsx');
        expect(hub).not.toContain('backdrop-blur-xl');
        expect(hub).toContain('backdrop-blur-md');
    });
});

describe('R73 load: the app-only views are lazy (App.tsx)', () => {
    const app = read('src', 'components', 'App.tsx');

    it('every app-only view is a lazyWithReload chunk', () => {
        for (const v of [
            'Dashboard', 'ContactsView', 'TasksView', 'DocumentList', 'CalendarView',
            'BillingView', 'BillingMonitorView', 'ComplianceView', 'SettingsView',
            'MessagesView', 'NotesView', 'HelpView', 'ArchiveView', 'SecurityAccessView',
            'PropertyManagerView', 'PropertyDetailView', 'MatterDetailView',
            'ContactDetailView', 'DocumentDetailView', 'InvoiceDetailView',
            'ReceiptDetailView', 'AtriumPublicApplicationForm', 'AloaPanel',
            'TenantPortal', 'ClientDashboard', 'ClientMatterDetailView', 'MatterList',
            'OnboardingWizard', 'DockedModal',
        ]) {
            expect(app).toContain(`const ${v} = lazyWithReload(`);
        }
    });

    it('no static imports remain for those views (the eager-load killer)', () => {
        for (const line of [
            "import Dashboard from './Dashboard'",
            "import SettingsView from './settings/SettingsView'",
            "import { NotesView } from './NotesView'",
            "import { MatterDetailView } from './details/MatterDetailView'",
            "import PropertyManagerView from './PropertyManagerView'",
            "import { AtriumPublicApplicationForm }",
            "import { LandingPage } from './LandingPage'",
            "import { FounderDashboard } from './FounderDashboard'",
            "import AloaPanel from './aloa/AloaPanel'",
            "import TenantPortal from './tenant/TenantPortal'",
        ]) {
            expect(app).not.toContain(line);
        }
    });

    it('the marketing router is its own chunk, warmed at module evaluation', () => {
        expect(app).toContain("const LandingPage = lazyWithReload(() => import('./LandingPage')");
        expect(app).toContain("void import('./LandingPage');");
    });

    it('the dead FounderDashboard import is gone (founder APK only)', () => {
        expect(app).not.toContain("import { FounderDashboard } from './FounderDashboard'");
    });
});

describe('R73 load: heavy libraries load on first use', () => {
    it('reportGenerator: jspdf + autotable via one cached dynamic import, async exports', () => {
        const svc = read('src', 'services', 'reportGenerator.ts');
        expect(svc).toContain("import('jspdf')");
        expect(svc).toContain("import('jspdf-autotable')");
        expect(svc).toContain('const ensurePdfLibs = () => {');
        expect(svc).not.toContain("import jsPDF from 'jspdf'");
    });

    it('attachmentProcessor: pdfjs loads on first extraction (worker configured then)', () => {
        const util = read('src', 'utils', 'attachmentProcessor.ts');
        expect(util).toContain("import('pdfjs-dist')");
        expect(util).toContain('const ensurePdfjs = () => {');
        expect(util).not.toContain("import * as pdfjsLib from 'pdfjs-dist'");
    });

    it('the AI SDK (@google/genai) is not statically imported by any entry-reachable module', () => {
        // entry-reachable set: geminiService + IngestionAgent + useResearch +
        // audioUtils + the tax agent (all reached from App's static graph).
        // `import type` lines are fine — they erase at build time.
        const valueImport = /^\s*import\s+(?!type\s)[^;'\"]*from\s*["']@google\/genai["']/m;
        for (const f of [
            ['src', 'services', 'geminiService.ts'],
            ['src', 'agents', 'IngestionAgent.ts'],
            ['src', 'agents', 'NigerianTaxComplianceAgent.ts'],
            ['src', 'hooks', 'useResearch.ts'],
            ['src', 'utils', 'audioUtils.ts'],
        ]) {
            const src = read(...f);
            expect(src, f.join('/')).not.toMatch(valueImport);
        }
        // and the value-import replacements exist
        expect(read('src', 'services', 'geminiService.ts')).toContain('import type { FunctionDeclaration, Content, Type as GeminiType }');
        expect(read('src', 'agents', 'IngestionAgent.ts')).toContain("await import(\"@google/genai\")");
    });

    it('IngestionAgent: JSZip also loads on first use', () => {
        expect(read('src', 'agents', 'IngestionAgent.ts')).toContain("await import('jszip')");
    });
});

describe('R73 load: the chunking rules (vite.config.ts)', () => {
    const cfg = read('vite.config.ts');

    it('the per-view manual chunks are retired (they hoisted shared core → eager)', () => {
        for (const gone of ["'module-settings'", "'module-atrium'", "'module-documents'", "'module-research'"]) {
            expect(cfg).not.toContain(`return ${gone}`);
        }
    });

    it('module-shared survives (types/constants leaf + the vite preload helper)', () => {
        expect(cfg).toContain("return 'module-shared'");
        expect(cfg).toContain("id.includes('vite/preload-helper')");
    });
});
