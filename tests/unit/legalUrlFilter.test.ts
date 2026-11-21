/**
 * Strict URL filtering, normalization & priority scoring (2026-11-22).
 *
 * OWNER TASK (verbatim intent): "Update the link-discovery and
 * queue-insertion logic so low-value/trap URLs (like
 * /cdn-cgi/l/email-protection, /cookie-policy, and /blog) are rejected
 * before entering QUEUED, and existing junk URLs in QUEUED are purged."
 *
 * PART 1 — the pure gate (src/legal/ingestionEngine/urlFilter.ts):
 *   normalization, block-list, allow-lists, priority scoring, off-domain
 *   document-link rule, duplicate query variants.
 * PART 2 — wiring contracts (source-scanned so removal fails CI):
 *   the worker purges queued junk every run, every enqueue path filters,
 *   and the priorities are shared with the queue schema.
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
    filterCandidateUrl,
    normalizeCandidateUrl,
    isBlockedUrl,
    isAllowedQueueUrl,
    URL_PRIORITY,
    BLOCKED_URL_RE,
} from '../../src/legal/ingestionEngine/urlFilter';
import { BUILTIN_SEED_SOURCES } from '../../src/legal/ingestionEngine/seeds';
import { PRIORITY } from '../../convex/legal/schema';

// ─── PART 1: the pure gate ──────────────────────────────────────────────────

describe('normalization (step 1: every candidate URL first)', () => {
    it('forces https://', () => {
        expect(normalizeCandidateUrl('http://nigerialii.org/akn/ng/judgment/x')).toBe(
            'https://nigerialii.org/akn/ng/judgment/x'
        );
    });
    it('strips #fragments', () => {
        expect(normalizeCandidateUrl('https://nigerialii.org/judgments/a#section-2')).toBe(
            'https://nigerialii.org/judgments/a'
        );
    });
    it('strips utm_*, fbclid and gclid tracking params', () => {
        const out = normalizeCandidateUrl(
            'https://nigerialii.org/judgments/a?utm_source=x&utm_medium=y&fbclid=1&gclid=2'
        );
        expect(out).toBe('https://nigerialii.org/judgments/a');
    });
    it('sorts remaining params so order variants collapse (duplicate query variants)', () => {
        const a = normalizeCandidateUrl('https://example.gov.ng/act/1?b=2&a=1');
        const b = normalizeCandidateUrl('https://example.gov.ng/act/1?a=1&b=2');
        expect(a).toBe(b);
    });
    it('normalizes trailing slashes (but keeps the domain root)', () => {
        expect(normalizeCandidateUrl('https://nigerialii.org/judgments/')).toBe(
            'https://nigerialii.org/judgments'
        );
        expect(normalizeCandidateUrl('https://nigerialii.org/')).toBe('https://nigerialii.org/');
    });
});

describe('global block-list (step 2: reject before queueing)', () => {
    const junk = [
        'https://nigerialii.org/cdn-cgi/l/email-protection',
        'https://nigerialii.org/cookie-policy',
        'https://nigerialii.org/cookies',
        'https://nigerialii.org/privacy-policy',
        'https://nigerialii.org/terms',
        'https://nigerialii.org/disclaimer',
        'https://nigerialii.org/login',
        'https://nigerialii.org/signin',
        'https://nigerialii.org/register',
        'https://nigerialii.org/auth/session',
        'https://nigerialii.org/wp-admin/options.php',
        'https://nigerialii.org/wp-login.php',
        'https://nigerialii.org/xmlrpc.php',
        'https://nigerialii.org/feed/',
        'https://nigerialii.org/rss',
        'https://nigerialii.org/blog/why-law-matters',
        'https://nigerialii.org/blog',
        'https://nigerialii.org/tag/news',
        'https://nigerialii.org/author/admin',
        'https://nigerialii.org/share/judgment',
        'https://nigerialii.org/gallery/team',
        'https://nigerialii.org/events/2026',
        'https://nigerialii.org/logo.png',
        'https://nigerialii.org/style.css',
        'https://nigerialii.org/app.js',
        'https://nigerialii.org/font.woff2',
        'https://nigerialii.org/video.mp4',
        'https://nigerialii.org/archive.zip',
    ];
    it.each(junk)('rejects %s', (url) => {
        const r = filterCandidateUrl(url);
        expect(r.allowed).toBe(false);
        expect(r.reason).toBeTruthy();
    });
    it('is case-insensitive', () => {
        expect(isBlockedUrl('https://x.ng/BLOG/post')).not.toBeNull();
        expect(isBlockedUrl('https://x.ng/Privacy-Policy')).not.toBeNull();
    });
    it('asset extensions are blocked even with query strings', () => {
        expect(isBlockedUrl('https://x.ng/doc.pdf?v=2')).toBeNull(); // pdf is a DOCUMENT, not an asset
        expect(isBlockedUrl('https://x.ng/img.jpg?v=2')).not.toBeNull();
    });
});

describe('allow-lists & priority scoring (step 3)', () => {
    it('direct .pdf/.doc/.docx links are Priority 1 documents', () => {
        for (const url of [
            'https://sec.gov.ng/files/rules-2026.pdf',
            'https://nass.gov.ng/acts/cama-2020.docx',
            'https://nigerialii.org/judgment/sc-123-2021.doc',
        ]) {
            const r = filterCandidateUrl(url);
            expect(r.allowed).toBe(true);
            expect(r.kind).toBe('document');
            expect(r.priority).toBe(URL_PRIORITY.DOC_LINK);
        }
    });
    it('canonical legal detail paths are Priority 1 documents', () => {
        for (const url of [
            'https://nigerialii.org/akn/ng/judgment/supremecourt/2023/45',
            'https://nigerialii.org/akn/ng/act/2020/20',
            'https://nigerialii.org/judgments/sc-123-2021',
            'https://nigerialii.org/legislation/cama-2020',
            'https://sec.gov.ng/regulations/sec-rules-2021',
            'https://nass.gov.ng/bill/2026/something',
            'https://nass.gov.ng/acts/cama',
            'https://example.gov.ng/circulars/new-fees',
            'https://example.gov.ng/gazettes/vol-42',
            'https://example.gov.ng/practice-directions/2024-01',
        ]) {
            const r = filterCandidateUrl(url);
            expect(r.allowed, url).toBe(true);
            expect(r.kind, url).toBe('document');
            expect(r.priority, url).toBe(URL_PRIORITY.DOC_LINK);
        }
    });
    it('bare collection roots are Priority 2 INDEX pages (discovery only)', () => {
        for (const url of [
            'https://nigerialii.org/',
            'https://nigerialii.org/judgments',
            'https://nigerialii.org/legislation',
            'https://nass.gov.ng/acts',
            'https://nigerialii.org/browse',
        ]) {
            const r = filterCandidateUrl(url);
            expect(r.allowed, url).toBe(true);
            expect(r.kind, url).toBe('index');
            expect(r.priority, url).toBe(URL_PRIORITY.INDEX_DISCOVERY);
        }
    });
    it('index pages keep ONLY the page param (duplicate query variants collapse)', () => {
        const a = filterCandidateUrl('https://nigerialii.org/judgments?sort=title&filter=recent&page=2');
        const b = filterCandidateUrl('https://nigerialii.org/judgments?page=2');
        expect(a.allowed).toBe(true);
        expect(a.kind).toBe('index');
        expect(a.url).toBe(b.url);
        expect(a.url).toBe('https://nigerialii.org/judgments?page=2');
    });
    it('random non-legal pages are rejected by the allow-list', () => {
        for (const url of [
            'https://nigerialii.org/about',
            'https://nigerialii.org/contact-us',
            'https://nigerialii.org/careers/2026',
            'https://nigerialii.org/donate',
        ]) {
            const r = filterCandidateUrl(url);
            expect(r.allowed, url).toBe(false);
            expect(r.reason, url).toMatch(/allow-list/);
        }
    });
});

describe('off-domain rule (harvest context)', () => {
    const parent = 'https://nigerialii.org/judgments';
    it('same-host links pass the domain rule', () => {
        const r = filterCandidateUrl('https://nigerialii.org/akn/ng/judgment/sc/2023/1', parent);
        expect(r.allowed).toBe(true);
    });
    it('an official subdomain document link passes (the CDN case)', () => {
        const r = filterCandidateUrl('https://files.nigerialii.org/judgments/2023/sc-1.pdf', parent);
        expect(r.allowed).toBe(true);
        expect(r.kind).toBe('document');
    });
    it('an off-domain HTML page is rejected', () => {
        const r = filterCandidateUrl('https://blog.someone.ng/legal-thoughts', parent);
        expect(r.allowed).toBe(false);
        expect(r.reason).toMatch(/off-domain/);
    });
    it('an off-domain PDF on an unrelated host is rejected (not an official CDN)', () => {
        const r = filterCandidateUrl('https://random-cdn.example.com/judgment.pdf', parent);
        expect(r.allowed).toBe(false);
        expect(r.reason).toMatch(/off-domain/);
    });
    it('a subdomain HTML page (non-document) is still rejected by the allow-list', () => {
        const r = filterCandidateUrl('https://files.nigerialii.org/about', parent);
        expect(r.allowed).toBe(false);
    });
});

describe('misc gate behavior', () => {
    it('malformed URLs are rejected, never thrown', () => {
        expect(filterCandidateUrl('not a url').allowed).toBe(false);
        expect(filterCandidateUrl('').allowed).toBe(false);
    });
    it('non-http(s) schemes are rejected', () => {
        expect(filterCandidateUrl('ftp://nigerialii.org/judgments/1').allowed).toBe(false);
        expect(filterCandidateUrl('javascript:alert(1)').allowed).toBe(false);
    });
    it('the builtin seed sources all pass as index pages', () => {
        for (const s of BUILTIN_SEED_SOURCES) {
            const r = filterCandidateUrl(s.sourceUrl);
            expect(r.allowed, s.sourceUrl).toBe(true);
        }
    });
});

// ─── PART 2: wiring contracts (source-scanned so removal fails CI) ──────────

const worker = read('convex/legal/worker.ts');
const engine = read('convex/legal/engine.ts');
const schema = read('convex/legal/schema.ts');

describe('wiring: the junk purge', () => {
    it('the worker purges policy-violating QUEUED rows every run (before claiming)', () => {
        expect(worker).toMatch(/purgeBlockedQueuedInternal/);
        // Purge runs BEFORE the claim step:
        expect(worker.indexOf('purgeBlockedQueuedInternal')).toBeLessThan(
            worker.indexOf('claimForEngine, { workerId, limit }')
        );
    });
    it('the purge deletes violators and audit-logs them', () => {
        expect(worker).toMatch(/eventType: "queue.purge"/);
        expect(worker).toMatch(/await ctx\.db\.delete\(row\._id\)/);
    });
    it('the run summary records the purge (surfaced as a "junk purged" chip)', () => {
        expect(worker).toMatch(/summary\.purgedBlocked = purge\?\.purged \?\? 0/);
    });
});

describe('wiring: every enqueue path filters', () => {
    it('the harvest enqueue (enqueueForEngine) applies filterCandidateUrl with parentUrl', () => {
        expect(worker).toMatch(/filterCandidateUrl\(item\.sourceUrl, item\.parentUrl\)/);
        expect(worker).toMatch(/parentUrl: v\.optional\(v\.string\(\)\)/);
    });
    it('the index harvest passes THIS page as the parent of every link', () => {
        expect(worker).toMatch(/parentUrl: task\.sourceUrl,/);
    });
    it('the founder manual add (enqueueUrlForIngestion) filters and returns the rejection reason', () => {
        expect(engine).toMatch(/filterCandidateUrl\(args\.url\)/);
        expect(engine).toMatch(/rejected: verdict\.reason/);
    });
    it('the builtin seeds pass the same gate', () => {
        expect(worker).toMatch(/filterCandidateUrl\(s\.sourceUrl\)/);
    });
});

describe('wiring: priority table shared by the gate and the queue', () => {
    it('DOC_LINK and INDEX_DISCOVERY exist in the queue schema and mirror the pure module', () => {
        expect(PRIORITY.DOC_LINK).toBe(URL_PRIORITY.DOC_LINK);
        expect(PRIORITY.INDEX_DISCOVERY).toBe(URL_PRIORITY.INDEX_DISCOVERY);
        expect(PRIORITY.DOC_LINK).toBeLessThan(PRIORITY.CURATED);
        expect(PRIORITY.CURATED).toBeLessThan(PRIORITY.INDEX_DISCOVERY);
        expect(schema).toMatch(/DOC_LINK: URL_PRIORITY\.DOC_LINK/);
    });
    it('survivors carry policy priorities on insert', () => {
        expect(worker).toMatch(/priority: item\.priority \?\? verdict\.priority/);
    });
});

describe('regression: the exact junk the founder saw', () => {
    it('the reported trap URLs are all rejected', () => {
        for (const url of [
            'https://nigerialii.org/cdn-cgi/l/email-protection',
            'https://nigerialii.org/cookie-policy',
            'https://nigerialii.org/blog/some-post',
        ]) {
            expect(isAllowedQueueUrl(url), url).toBe(false);
        }
    });
    it('BLOCKED_URL_RE is exported for reuse (purge/UI)', () => {
        expect(BLOCKED_URL_RE).toBeInstanceOf(RegExp);
    });
});
