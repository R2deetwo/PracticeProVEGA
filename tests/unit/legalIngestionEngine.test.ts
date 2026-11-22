/**
 * Legal Ingestion Engine tests (2026-11-19).
 *
 * THE OWNER'S CONTRACT:
 *   "the ingestion engine is supposed to be in the founder's app and work
 *    by itself — anytime I open my phone it should be ingesting."
 *
 * PART 1 — pure port parity: the TS ports (src/legal/ingestionEngine/*)
 *   reproduce the Python ingester's deterministic core (robots, extract,
 *   classify, chunk, meta) with the same heuristics and boundaries.
 * PART 2 — autonomy + wiring contracts (source-scanned so removal fails CI):
 *   - the 15-minute worker cron exists (the "by itself" half)
 *   - the engine is founder-gated on every public surface
 *   - the founder APK has the Ingestion view wired (nav + view map)
 *   - politeness: one page per domain per run, robots respected,
 *     conditional GETs, SHA-256 provenance, artifacts stored once
 *   - the Python ingester's public contract is unchanged (token-gated)
 *   - founder signup tab hides once a Founder exists (security round)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolve(here, '../../convex/legal/worker.ts'))
    ? resolve(here, '../..')
    : process.cwd();
const read = (p: string) => readFileSync(resolve(repoRoot, p), 'utf8');

import {
    parseRobots,
    rulesForUserAgent,
    robotsAllows,
    robotsUrlFor,
    extractHtml,
    isPdfBody,
    resolveHref,
    classifyCategory,
    classifyDocumentType,
    chunkInstrument,
    chunkJudgment,
    extractCitations,
    extractJudgmentMeta,
    buildInstrumentMeta,
    BUILTIN_SEED_SOURCES,
} from '../../src/legal/ingestionEngine';

// ─── PART 1: pure port parity ───────────────────────────────────────────────

describe('robots.txt evaluation (urllib.robotparser port)', () => {
    const UA = 'PracticePro-LegalKB-Engine/1.0';

    it('disallows matching paths for the wildcard group', () => {
        const body = 'User-agent: *\nDisallow: /private/\nDisallow: /admin\n';
        const rules = rulesForUserAgent(body, UA);
        expect(robotsAllows(rules, 'https://example.com/private/x')).toBe(false);
        expect(robotsAllows(rules, 'https://example.com/admin')).toBe(false);
        expect(robotsAllows(rules, 'https://example.com/public')).toBe(true);
    });

    it('a longer Allow beats a shorter Disallow', () => {
        const body = 'User-agent: *\nDisallow: /legal/\nAllow: /legal/public/\n';
        const rules = rulesForUserAgent(body, UA);
        expect(robotsAllows(rules, 'https://example.com/legal/public/doc')).toBe(true);
        expect(robotsAllows(rules, 'https://example.com/legal/secret')).toBe(false);
    });

    it('specific agent group wins over the wildcard', () => {
        const body = 'User-agent: *\nDisallow: /\n\nUser-agent: practicepro-legalkb-engine\nDisallow: /nothing\n';
        const rules = rulesForUserAgent(body, UA);
        expect(robotsAllows(rules, 'https://example.com/anywhere')).toBe(true);
    });

    it('no robots.txt content → everything allowed', () => {
        const rules = rulesForUserAgent('', UA);
        expect(rules.disallow).toBeNull();
        expect(robotsAllows(rules, 'https://example.com/x')).toBe(true);
    });

    it('wildcards and $ anchors in patterns', () => {
        const body = 'User-agent: *\nDisallow: /*.pdf$\n';
        const rules = rulesForUserAgent(body, UA);
        expect(robotsAllows(rules, 'https://example.com/doc.pdf')).toBe(false);
        expect(robotsAllows(rules, 'https://example.com/doc.pdf?x=1')).toBe(true); // no $ match with query
        expect(robotsAllows(rules, 'https://example.com/doc.html')).toBe(true);
    });

    it('crawl-delay is surfaced for pacing', () => {
        const body = 'User-agent: *\nCrawl-delay: 10\nDisallow: /x\n';
        const rules = rulesForUserAgent(body, UA);
        expect(rules.crawlDelayS).toBe(10);
    });

    it('comments and blank lines are ignored', () => {
        const body = '# comment\n\nUser-agent: * # inline\nDisallow: /a\n';
        const groups = parseRobots(body);
        expect(groups.get('*')?.disallow).toEqual(['/a']);
    });

    it('robotsUrlFor builds the origin robots URL', () => {
        expect(robotsUrlFor('https://nigerialii.org/judgments/x')).toBe('https://nigerialii.org/robots.txt');
    });
});

describe('HTML extraction (BeautifulSoup port, regex-based)', () => {
    it('strips script/style/nav content, keeps text, decodes entities', () => {
        const html = [
            '<html><head><title>Test Act 2020</title><style>.x{color:red}</style></head>',
            '<body><nav>menu menu</nav><script>alert(1)</script>',
            '<p>Section 1 &mdash; &amp; commencement &amp; all that</p>',
            '<div>Part II content</div></body></html>',
        ].join('');
        const doc = extractHtml(html, 'https://example.org/act');
        expect(doc.title).toBe('Test Act 2020');
        expect(doc.text).toContain('Section 1');
        expect(doc.text).toContain('commencement & all that');
        expect(doc.text).toContain('Part II content');
        expect(doc.text).not.toContain('alert');
        expect(doc.text).not.toContain('menu');
        expect(doc.text).not.toContain('color:red');
    });

    it('block closings become newlines so structure survives', () => {
        const doc = extractHtml('<p>One</p><p>Two</p><br><p>Three</p>', '');
        const lines = doc.text.split('\n').filter(Boolean);
        expect(lines).toEqual(['One', 'Two', 'Three']);
    });

    it('harvests absolute, defragged links; skips mailto/#/javascript', () => {
        const html = [
            '<a href="/judgments/1">a</a>',
            '<a href="https://other.example/x#frag">b</a>',
            '<a href="mailto:x@y.z">c</a>',
            '<a href="#top">d</a>',
            '<a href="javascript:void(0)">e</a>',
        ].join('');
        const doc = extractHtml(html, 'https://nigerialii.org/index');
        expect(doc.links).toContain('https://nigerialii.org/judgments/1');
        expect(doc.links).toContain('https://other.example/x');
        expect(doc.links.some((l) => l.includes('mailto') || l.includes('#') || l.includes('javascript'))).toBe(false);
    });

    it('og:title is the fallback title', () => {
        const html = '<meta property="og:title" content="Og Title"><body>text</body>';
        expect(extractHtml(html, '').title).toBe('Og Title');
    });

    it('resolveHref rejects non-http schemes', () => {
        expect(resolveHref('tel:+123', 'https://x.y')).toBeNull();
        expect(resolveHref('data:text/html,x', 'https://x.y')).toBeNull();
        expect(resolveHref('/a', 'https://x.y/z/')).toBe('https://x.y/a');
    });

    it('detects PDF bodies by magic bytes', () => {
        expect(isPdfBody('%PDF-1.7 blah')).toBe(true);
        expect(isPdfBody('<html>')).toBe(false);
    });
});

describe('classification (classifier.py port)', () => {
    it('routes by domain: SEC → sec_regulations, INEC → electoral', () => {
        expect(classifyCategory('https://sec.gov.ng/rules/x', '')).toBe('sec_regulations');
        expect(classifyCategory('https://www.inecnigeria.org/guidelines', '')).toBe('electoral');
    });

    it('judgment domains with judgment paths → judgments', () => {
        expect(classifyCategory('https://nigerialii.org/judgments/123', 'some title', 'A v B text')).toBe('judgments');
    });

    it('rules of court phrasing → rules_of_court', () => {
        expect(classifyCategory('https://example.org/docs/x', 'High Court (Civil Procedure) Rules 2012', 'text')).toBe('rules_of_court');
    });

    it('statute path words → statutes (fallback)', () => {
        expect(classifyCategory('https://nass.gov.ng/constitution', '')).toBe('statutes');
    });

    it('document type: LPELR path on a judgment domain → judgment', () => {
        expect(classifyDocumentType('judgments', 'https://nigerialii.org/judgment/lpelr-123', 'text')).toBe('judgment');
    });

    it('document type: Part/Section skeleton in head → instrument', () => {
        const text = 'AN ACT to amend things\n\nPART I\nSection 2 — Definitions\n(1) words mean things here';
        expect(classifyDocumentType('statutes', 'https://nass.gov.ng/act/1', text)).toBe('instrument');
    });

    it('document type: nothing recognizable → index (link harvest)', () => {
        expect(classifyDocumentType('index', 'https://nigerialii.org', 'welcome to the portal')).toBe('index');
    });
});

describe('legal-boundary chunking (chunker.py port)', () => {
    const instrumentText = [
        'ARRANGEMENT OF SECTIONS',
        '',
        'PART I — PRELIMINARY',
        'Section 1 — Short title',
        'This Act may be cited as the Test Act 2020.',
        'Section 2 — Commencement',
        'This Act comes into force on 1 January 2021.',
        '(1) The first subsection text goes here and must be long enough to count as a real chunk of words.',
        'Provided that this proviso carves an exception and stands alone exactly as practitioners cite it.',
        'PART II — SUBSTANCE',
        'Section 3 — The substance',
        'The substantive provision text follows here with enough words to form a legitimate chunk on its own merits.',
    ].join('\n');

    it('chunks along Part → Section → Subsection (+ proviso) boundaries', () => {
        const chunks = chunkInstrument(instrumentText);
        const paths = chunks.map((c) => c.boundaryPath.join('/'));
        expect(paths).toContain('PART I/Section 1');
        expect(paths).toContain('PART I/Section 2/(1)');
        // A proviso attaches to the CURRENT boundary — here the (1) subsection.
        expect(paths).toContain('PART I/Section 2/(1)/proviso');
        expect(paths).toContain('PART II/Section 3');
    });

    it('provisos are their own chunks with the Proviso heading', () => {
        const chunks = chunkInstrument(instrumentText);
        const proviso = chunks.find((c) => c.boundaryPath[c.boundaryPath.length - 1] === 'proviso');
        expect(proviso?.heading).toBe('Proviso');
        expect(proviso?.text).toContain('Provided that');
    });

    it('splits oversized chunks on sentence boundaries, never mid-sentence', () => {
        const sentences = Array.from({ length: 120 }, (_, i) => `Sentence number ${i} with several words in it.`).join(' ');
        const chunks = chunkInstrument(sentences);
        expect(chunks.length).toBeGreaterThan(1);
        for (const c of chunks) {
            expect(c.text.split(/\s+/).length).toBeLessThanOrEqual(805); // MAX_CHUNK_WORDS + slack
            expect(c.text.endsWith('.') || c.text.endsWith('!') || c.text.endsWith('?')).toBe(true);
        }
    });

    it('judgment chunking: heading lines become section boundaries', () => {
        const text = [
            'Introductory paragraphs of the judgment that are reasonably long and set the scene for the dispute.',
            'ISSUES FOR DETERMINATION',
            'Whether the appeal has merit and whether the lower court was right in all the circumstances of the case.',
            'RATIO DECIDENDI',
            'The appeal succeeds on the first issue and fails on the second issue for the reasons that follow here.',
        ].join('\n');
        const chunks = chunkJudgment(text);
        const headings = chunks.map((c) => c.heading);
        expect(headings.some((h) => /Issues For Determination/i.test(h))).toBe(true);
        expect(headings.some((h) => /Ratio Decidendi/i.test(h))).toBe(true);
    });

    it('extracts LPELR and section-of-act citations, deduped and capped', () => {
        const text = 'See [2024] LPELR-12345 (SC) and [2024] LPELR-12345 (SC) plus Section 18 of the Constitution of the Federal Republic.';
        const cites = extractCitations(text);
        expect(cites.filter((c) => c.includes('LPELR-12345'))).toHaveLength(1);
        expect(cites.some((c) => c.startsWith('Section 18'))).toBe(true);
    });
});

describe('judgment metadata (metadata.py port)', () => {
    const judgmentText = [
        'BEFORE THEIR LORDSHIPS',
        'JUSTICE OLUKAYODE ARIWOOLA, JSC',
        'IN THE SUPREME COURT OF NIGERIA',
        'SUIT NO: SC/123/2021',
        'DELIVERED ON 15th day of MARCH 2024',
        'JOHN ADEYEMI OLAGOKE v. MUSA IBRAHIM & 2 ORS.',
        'FOR THE APPELLANT: Chief Wole Olanipekun, SAN',
        '',
        'The appellant argued the grounds of appeal at length in his brief of argument filed within time.',
        'HELD: The appeal lacks merit and it is accordingly dismissed by this court for want of prosecution.',
        '',
        'COSTS: parties to bear their respective costs of this appeal.',
    ].join('\n');

    it('extracts citation, suit number, court, level, date, parties, judges, counsel, ratio', () => {
        const meta = extractJudgmentMeta(judgmentText, 'Adeyemi v Ibrahim', 'https://nigerialii.org/j/1', '[2024] LPELR-99999 (SC)');
        expect(meta.citation).toBe('[2024] LPELR-99999 (SC)');
        expect(meta.suitNumber).toBe('SC/123/2021');
        expect(meta.court.toLowerCase()).toContain('supreme court');
        expect(meta.courtLevel).toBe('supreme');
        expect(meta.dateDelivered).toBe('2024-03-15');
        // Parties prefer the title's "A v. B" (Python parity)…
        expect(meta.parties).toHaveLength(2);
        expect(meta.parties[0].name).toBe('Adeyemi');
        expect(meta.parties[1].name).toBe('Ibrahim');
        // …and fall back to the first "X v. Y" body line when no title match.
        const noTitle = extractJudgmentMeta(judgmentText, '', 'https://nigerialii.org/j/1', '[2024] LPELR-99999 (SC)');
        expect(noTitle.parties[0].name).toContain('JOHN ADEYEMI OLAGOKE');
        expect(meta.judges.lead.some((j) => j.includes('Ariwoola'))).toBe(true);
        expect(meta.counsel[0]?.names).toContain('Olanipekun');
        expect(meta.ratioDecidendi).toContain('dismissed');
    });

    it('missing fields stay empty/unknown — never invented', () => {
        const meta = extractJudgmentMeta('bare text with no structure', '', 'https://x.y/z');
        expect(meta.suitNumber).toBe('');
        expect(meta.dateDelivered).toBe('');
        expect(meta.court).toBe('');
        expect(meta.parties).toHaveLength(0);
    });

    it('instrument meta: slug key, issuing body, type, in-force tracker', () => {
        const meta = buildInstrumentMeta('Corruption Practices and Other Related Offences Act 2000', 'AN ACT to prohibit corruption\nSection 1 — Short title\n', 'https://nass.gov.ng/act/x', 'statutes');
        expect(meta.key).toBe('corruption_practices_and_other_related_offences_act_2000');
        expect(meta.issuingBody).toBe('National Assembly');
        expect(meta.instrumentType).toBe('act');
        expect(meta.status).toBe('in_force');
        expect(meta.amendmentTracker.amended).toBe(false);
        expect(meta.structure.some((s) => s.level === 'section')).toBe(true);
    });

    it('instrument meta NEVER carries null values (Convex v.optional rejects null — 2026-11-22 "0 instruments" regression)', () => {
        // A text with no dates, no year, no summary-worthy content: every
        // optional field is unknown. The payload must OMIT them, not send
        // null — the audit trail caught "repealRef: null" failing
        // ArgumentValidationError on every instrument ingestion in prod.
        const meta = buildInstrumentMeta('Bare Rules', '', 'https://court.example/rules', 'rules_of_court');
        const deepNulls: string[] = [];
        const walk = (obj: unknown, path: string) => {
            for (const [k, v] of Object.entries(obj ?? {})) {
                if (v === null || v === undefined) deepNulls.push(`${path}.${k}`);
                else if (typeof v === 'object') walk(v, `${path}.${k}`);
            }
        };
        walk(meta, 'instrument');
        expect(deepNulls).toEqual([]);
        // And the fields are simply absent, not null:
        expect('repealRef' in meta.amendmentTracker).toBe(false);
        expect('commencementDate' in meta).toBe(false);
        expect('year' in meta).toBe(false);
        expect('summary' in meta).toBe(false);
    });
});

describe('builtin seed sources', () => {
    it('six authoritative Nigerian sources, all https, valid categories', () => {
        expect(BUILTIN_SEED_SOURCES.length).toBeGreaterThanOrEqual(6);
        for (const s of BUILTIN_SEED_SOURCES) {
            expect(s.sourceUrl.startsWith('https://')).toBe(true);
            expect(['judgments', 'statutes', 'subsidiary', 'rules_of_court', 'sec_regulations', 'electoral', 'index'])
                .toContain(s.domainCategory);
            expect(s.kind).toBe('index');
            expect(s.authority.length).toBeGreaterThan(3);
        }
    });
});

// ─── PART 2: autonomy + wiring contracts ────────────────────────────────────

describe('the engine runs BY ITSELF (cron contract)', () => {
    const crons = read('convex/crons.ts');

    it('the 15-minute worker cron is registered', () => {
        expect(crons).toContain('legalKbIngestionWorker');
        expect(crons).toContain('{ minutes: 15 }');
        expect(crons).toContain('internal.legal.worker.runIngestionWorker');
    });

    it('the weekly freshness sweep survives untouched', () => {
        expect(crons).toContain('legalKbFreshnessSweep');
        expect(crons).toContain('internal.legal.queue.requeueSeedsForSweep');
    });
});

describe('the worker (convex/legal/worker.ts)', () => {
    const worker = read('convex/legal/worker.ts');

    it('gates on the founder-controlled engine state', () => {
        expect(worker).toContain('getEngineStateInternal');
        expect(worker).toContain('!state.enabled');
    });

    it('politeness: at most ONE task per domain per run', () => {
        expect(worker).toContain('domains.has(domain)');
        expect(worker).toContain('claimForEngine');
    });

    it('respects robots.txt via the ported evaluator', () => {
        expect(worker).toContain('robotsAllows');
        expect(worker).toContain('robots.txt disallows this path');
    });

    it('conditional GETs: 304 Not Modified is a free terminal outcome', () => {
        expect(worker).toContain('If-None-Match');
        expect(worker).toContain('If-Modified-Since');
        expect(worker).toContain('not_modified');
    });

    it('SHA-256 provenance on every fetched document', () => {
        expect(worker).toContain('sha256Hex');
        expect(worker).toContain('crypto.subtle.digest');
    });

    it('raw artifacts stored ONCE via Convex storage, content-addressed', () => {
        expect(worker).toContain('ctx.storage.store');
        expect(worker).toContain('storageBackend: "convex"');
    });

    it('honest boundary: PDFs are deferred, not half-parsed', () => {
        expect(worker).toContain('pdf_deferred');
        expect(worker).toContain('pdf.deferred');
    });

    it('index pages harvest child links through the strict filter (2026-11-22: cap + parentUrl)', () => {
        // The raw-candidate cap replaced the old unfiltered same-domain cap:
        // links now pass filterCandidateUrl (block-list + allow-list +
        // off-domain rule) inside enqueueForEngine, with the index page as
        // the parent.
        expect(worker).toContain('MAX_LINK_CANDIDATES_PER_INDEX');
        expect(worker).toContain('enqueueForEngine');
        expect(worker).toContain('parentUrl: task.sourceUrl,');
    });

    it('retry policy caps at 3 attempts then terminal failure', () => {
        expect(worker).toContain('MAX_ATTEMPTS = 3');
    });

    it('uses the SHARED ingest code path (ingestDocumentInternal)', () => {
        expect(worker).toContain('internal.legal.ingest.ingestDocumentInternal');
    });
});

describe('the founder control surface (convex/legal/engine.ts)', () => {
    const engine = read('convex/legal/engine.ts');

    it('every public function is founder-gated with the session bearer', () => {
        const fns = ['getIngestionDashboard', 'setIngestionEngineState', 'runIngestionNow', 'toggleSeedSource', 'enqueueUrlForIngestion'];
        for (const fn of fns) {
            expect(engine).toContain(`export const ${fn}`);
        }
        const gateCount = (engine.match(/requireFounderCaller\(ctx/g) || []).length;
        expect(gateCount).toBeGreaterThanOrEqual(5);
    });

    it('first enable auto-seeds the builtin sources', () => {
        expect(engine).toContain('seedBuiltinSourcesInternal');
    });

    it('Run Now refuses while the engine is paused', () => {
        expect(engine).toContain('The ingestion engine is paused');
    });
});

describe('the Python ingester contract is unchanged', () => {
    const ingest = read('convex/legal/ingest.ts');

    it('public ingestDocument still enforces the LEGAL_INGEST_TOKEN', () => {
        expect(ingest).toContain('requireToken(args.ingestToken)');
    });

    it('the internal core is shared by both callers (one code path)', () => {
        expect(ingest).toContain('ingestDocumentInternal');
        expect(ingest).toContain('internal.legal.ingest.ingestDocumentInternal');
    });

    it('dedupProbeInternal is an internalQuery — never public', () => {
        expect(ingest).toContain('export const dedupProbeInternal = internalQuery');
    });
});

describe('schema + generated types', () => {
    it('the engine state table is registered in the schema', () => {
        expect(read('convex/legal/schema.ts')).toContain('export const legalEngineState');
        expect(read('convex/schema.ts')).toContain('legal_engine_state: legalEngineState');
    });

    it('api.d.ts registers the two new modules (local-codegen hand extension)', () => {
        const api = read('convex/_generated/api.d.ts');
        expect(api).toContain('"legal/engine": typeof legal_engine');
        expect(api).toContain('"legal/worker": typeof legal_worker');
    });
});

describe('the founder APK wiring', () => {
    it('AdminApp renders the Ingestion view + deep-links it', () => {
        const app = read('src/admin/AdminApp.tsx');
        expect(app).toContain("import { IngestionEngine } from './views/IngestionEngine'");
        expect(app).toContain("case 'ingestion'");
        expect(app).toContain("ingestion: 'ingestion'");
        expect(app).toContain("'refunds' | 'ingestion'");
    });

    it('FounderBottomNav has the Ingestion item in the More menu', () => {
        const nav = read('src/admin/FounderBottomNav.tsx');
        expect(nav).toContain("view: 'ingestion'");
        expect(nav).toContain("label: 'Ingestion'");
    });

    it('the view exists and uses the defensive query pattern (no black screens)', () => {
        const view = read('src/admin/views/IngestionEngine.tsx');
        expect(view).toContain('useConvex()');
        expect(view).toContain('getIngestionDashboard');
        expect(view).toContain('try {');
    });

    it('the view uses ui primitives (ADR-0004) — no raw form elements', () => {
        const view = read('src/admin/views/IngestionEngine.tsx');
        expect(view).not.toMatch(/<button[\s>]/);
        expect(view).not.toMatch(/<input[\s>]/);
        expect(view).toContain("from '../../components/ui/Button'");
        expect(view).toContain("from '../../components/ui/Input'");
    });
});

// ─── 2026-11-20 OWNER BUG REPORT — "the paused button can't be toggled" ────
// Two compounding defects left the founder staring at a dead switch:
//   1. getIngestionDashboard used a RANGE filter (.gte) on the BOOLEAN
//      `enabled` field — Convex rejects that at runtime, so the whole
//      dashboard query threw on every poll and the view fell into its
//      "backend not deployed" branch.
//   2. Even with the query healthy, engine state rows are created ON
//      FIRST TOGGLE; the view's guard silently returned while
//      `dash?.engine` was null → the mutation that creates the row could
//      never fire (chicken-and-egg deadlock), and the failure was
//      INVISIBLE (no toast, no error, no busy state).
describe('the toggle must actually toggle (2026-11-20 regression)', () => {
    it('REGRESSION: the dashboard never range-filters the boolean `enabled` field', () => {
        const engine = read('convex/legal/engine.ts');
        expect(engine).not.toContain('gte("enabled"');
        expect(engine).not.toContain('lte("enabled"');
        expect(engine).not.toContain('gt("enabled"');
        expect(engine).not.toContain('lt("enabled"');
    });

    it('REGRESSION: the dashboard returns a DEFAULT engine object when no state row exists yet', () => {
        const engine = read('convex/legal/engine.ts');
        expect(engine).toContain('DEFAULT_ENGINE');
        // The default must look OFF and sane so the first toggle turns it ON.
        expect(engine).toMatch(/DEFAULT_ENGINE = \{\s*enabled: false/);
    });

    it('REGRESSION: the view toggle has NO silent `!dash?.engine` bail-out', () => {
        const view = read('src/admin/views/IngestionEngine.tsx');
        expect(view).not.toContain('!dash?.engine');
        // The toggle must derive the next state from whatever engine data
        // exists (null-safe), never refuse to fire.
        expect(view).toContain("dash?.engine?.enabled ?? false");
    });

    it('Settings exposes the ingestion engine config (owner: "no configuration to configure the ingestor in settings")', () => {
        const settings = read('src/admin/views/Settings.tsx');
        expect(settings).toContain("'ingestion'");
        expect(settings).toContain('setIngestionEngineState');
        expect(settings).toContain('getIngestionDashboard');
        expect(settings).toContain('Pages per run');
    });
});

describe('founder signup hardening (this round\'s security ask)', () => {
    it('founderSignupOpen exposes exactly one boolean, no privilege', () => {
        const fm = read('convex/founderMetrics.ts');
        expect(fm).toContain('export const founderSignupOpen = query');
        expect(fm).toContain('return { open: founders === 0 }');
    });

    it('createFounderAccount stays bootstrap-only (countFounders gate)', () => {
        const fm = read('convex/founderMetrics.ts');
        expect(fm).toContain('countFounders');
        expect(fm).toContain('Founder signup is closed');
    });

    it('AdminLogin hides the Create Account tab once a Founder exists', () => {
        const login = read('src/admin/AdminLogin.tsx');
        expect(login).toContain('founderSignupOpen');
        expect(login).toContain('signupVisible');
        expect(login).toContain('{signupVisible && (');
    });
});

// ─── 2026-11-22 OWNER SPEC — JUDGMENT INDEX & ISSUE EXTRACTION ─────────────
// "When a user clicks a downloaded/ingested judgment, do not leave it as
// a dead click with nothing shown." The judgment rows (Recent documents
// + the Judgments inspector bucket) open a structured reading sheet:
// metadata/citation, core facts, issues determined, holdings/ratio,
// key authorities cited, and the section-by-section text.
describe('judgment index & issue extraction (no dead clicks)', () => {
    it('engine exposes getJudgmentDetail — the structured record + chunk sections', () => {
        const engine = read('convex/legal/engine.ts');
        expect(engine).toContain('export const getJudgmentDetail = query');
        expect(engine).toContain('by_citation');
        expect(engine).toContain('by_document');
        // The full capture: parties, coram, counsel, ratio, authorities.
        expect(engine).toContain('ratioDecidendi');
        expect(engine).toContain('casesCited');
        expect(engine).toContain('statutesConsidered');
        expect(engine).toContain('lastVerifiedAt');
    });

    it('the view wires every judgment row to the reader (house div role="button" pattern)', () => {
        const view = read('src/admin/views/IngestionEngine.tsx');
        expect(view).toContain('getJudgmentDetail');
        expect(view).toContain('openJudgment');
        expect(view).toContain('JudgmentIndexSheet');
        // Both entry points are clickable — the recent-documents rows and
        // the judgments inspector bucket rows.
        expect((view.match(/openJudgment\(/g) || []).length).toBeGreaterThanOrEqual(4);
        expect(view).toContain('inspectorBucket === \'judgments\'');
        // The reader replaces the inspector (one sheet at a time).
        expect(view).toContain('setInspectorBucket(null)');
    });

    it('the reading sheet carries the legal structure, with honest absence notes', () => {
        const view = read('src/admin/views/IngestionEngine.tsx');
        for (const pinned of [
            'Judgment Index · Issue Extraction',
            'Issues determined by the court',
            'Holdings · Ratio · Precedent points',
            'Key authorities cited',
            'Coram',
            'Full text —',
            'No explicit issues-for-determination section was detected',
            'the extractor records only what the document states',
        ]) {
            expect(view).toContain(pinned);
        }
        // Treatment tags on cited cases (the schema\'s applied/distinguished/
        // overruled/affirmed/followed/considered vocabulary).
        expect(view).toContain('TREATMENT_STYLES');
        expect(view).toContain('distinguished');
        expect(view).toContain('overruled');
    });
});
