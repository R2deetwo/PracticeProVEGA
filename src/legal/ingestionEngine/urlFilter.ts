/**
 * urlFilter.ts — strict URL filtering, normalization & priority scoring for
 * the Legal Ingestion Engine (2026-11-22 owner task).
 *
 * OWNER CONTRACT: junk URLs (Cloudflare email-protection paths, cookie
 * policies, blogs) were entering the scrape queue, so 71 "completed" tasks
 * yielded almost no legal content. Every candidate URL now passes THIS
 * gate BEFORE it can be queued:
 *
 *   1. NORMALIZE — force https://, strip #fragments, strip tracking params
 *      (utm_*, fbclid, gclid), sort remaining params (kills order
 *      variants), normalize trailing slashes.
 *   2. GLOBAL BLOCK-LIST — Cloudflare internals, cookie/privacy/terms
 *      pages, auth routes, WordPress admin, feeds, blogs, tags, authors,
 *      share/gallery/event pages and asset file extensions.
 *   3. ALLOW-LIST + PRIORITY —
 *        Priority 1 (document): direct document links (*.pdf / *.doc /
 *          *.docx) and canonical legal detail paths (/akn/ng/judgment/*,
 *          /akn/ng/act/*, /judgments/*, /legislation/*, /regulation*,
 *          /rule*, /circular*, /guideline*, /practice-direction*, /bill*,
 *          /act*, /gazette*).
 *        Priority 2 (index): approved index/listing pages — crawled for
 *          the document links they contain, never stored as a Judgment or
 *          Instrument themselves.
 *      Everything else is rejected: the queue only ever holds genuine
 *      legal authorities and the indexes that list them.
 *   4. OFF-DOMAIN RULE (harvest): links found on an index page are only
 *      followed on the SAME host, or — when they are direct document
 *      links — on an official subdomain/CDN of the source host
 *      (files.lawfirm.ng ← lawfirm.ng). No third-party page ever enters
 *      the queue through discovery.
 *
 * PURE module (zero dependencies) shared by convex/legal/worker.ts,
 * convex/legal/engine.ts and the unit tests — same convention as the rest
 * of src/legal/ingestionEngine.
 */

// ─── Priorities (lower = claimed first; mirrors convex/legal/schema.ts) ────
/** Enqueue-time priority table. Kept in the pure module so the scorer and
 *  the queue schema share one source of truth (schema.ts imports this). */
export const URL_PRIORITY = {
    /** User is actively waiting on coverage — always first. */
    GAP_FILL: 0,
    /** Direct document link or canonical legal detail path (owner spec:
     *  "Priority 1 (Highest)"). */
    DOC_LINK: 2,
    /** Founder/operator-curated entry. */
    CURATED: 3,
    /** Routine seed discovery. */
    DEFAULT: 5,
    /** Index/listing pages — discovery only, never stored (owner spec:
     *  "Priority 2 (Index Discovery Only)"). */
    INDEX_DISCOVERY: 6,
} as const;

// ─── The global block-list (owner spec, verbatim + bare-form tightenings) ──
/** Verbatim from the owner spec, plus `$`-anchored bare forms (/blog,
 * /feed, /tag, /author without the trailing slash — trailing-slash
 * normalization would otherwise let them slip past the spec pattern). */
export const BLOCKED_URL_RE = new RegExp(
    "/cdn-cgi/|/cookie-policy|/cookies|/privacy-policy|/privacy|/terms|/disclaimer" +
    "|/login|/signin|/register|/auth/|/wp-admin|/wp-login|/xmlrpc\\.php" +
    "|/feed/|/rss|/blog/|/tag/|/author/|/share|/gallery|/events" +
    "|\\.(jpg|jpeg|png|gif|webp|svg|ico|css|js|woff|woff2|ttf|mp4|mp3|zip)(\\?.*)?$" +
    "|/feed$|/blog$|/tag$|/author$",
    "i"
);

/** Direct document extensions (Priority 1 even off-path). */
export const DIRECT_DOC_RE = /\.(pdf|doc|docx)(\?.*)?$/i;

/** Canonical legal DETAIL path prefixes (owner spec list). A URL only
 *  counts as a document when something follows the prefix — the bare
 *  prefix (/judgments, /legislation) is the collection INDEX. */
const CANONICAL_DETAIL_RE =
    /^\/(akn\/ng\/(judgment|act)s?\/|judgments?\/|legislation\/|regulations?\/|rules?\/|circulars?\/|guidelines?\/|practice-directions?\/|bills?\/|acts?\/|gazettes?\/)/i;

/** Collection/listing words — the last path segment of an index page. */
const INDEX_SEGMENT_RE =
    /^(index|browse|list|lists|recent|judgments?|judgements?|cases|decisions|legislation|laws|acts?|regulations?|rules?|circulars?|guidelines?|bills?|gazettes?|decrees?|search)$/i;

/** Tracking params stripped from every candidate URL. */
const TRACKING_PARAM_RE = /^(utm_|fbclid|gclid|mc_cid|mc_eid|ref$|source$)/i;

/** The ONLY query param preserved on index-kind URLs (pagination depth);
 *  everything else on an index is a duplicate-variant trap. */
const INDEX_KEEP_PARAMS = new Set(["page"]);

export interface UrlFilterResult {
    /** Policy verdict. */
    allowed: boolean;
    /** Human-readable rejection reason (why junk was refused). */
    reason?: string;
    /** The normalized URL (force-https, defragged, tracking-stripped,
     *  param-sorted, slash-normalized). Valid when allowed. */
    url: string;
    /** document = a legal authority to parse & store; index = a listing
     *  page to harvest links from (never stored itself). */
    kind: "document" | "index";
    /** URL_PRIORITY.* — lower is claimed first. */
    priority: number;
}

function reject(reason: string): UrlFilterResult {
    return { allowed: false, reason, url: "", kind: "document", priority: URL_PRIORITY.DEFAULT };
}

// ─── 1. Normalization ───────────────────────────────────────────────────────

/**
 * Normalize a candidate URL for the scrape queue:
 *   - force https:// (http-only sources fail visibly in the queue instead
 *     of silently mixing schemes)
 *   - strip #fragments
 *   - strip tracking params (utm_*, fbclid, gclid, ref/source)
 *   - sort remaining params alphabetically (order variants collapse)
 *   - strip trailing slashes (except the domain root "/")
 *
 * NOTE: this is STRICTER than convex/legal/shared.ts normalizeUrl (which
 * must stay byte-stable — it keys the urlHash dedup of existing queue
 * rows and the Python ingester's contract). New candidates get this
 * normalization; legacy rows keep their hashes untouched.
 */
export function normalizeCandidateUrl(raw: string): string {
    let u: URL;
    try {
        u = new URL(raw.trim());
    } catch {
        return raw.trim();
    }
    u.protocol = "https:";
    u.hash = "";
    const drop: string[] = [];
    u.searchParams.forEach((_v, k) => {
        if (TRACKING_PARAM_RE.test(k)) drop.push(k);
    });
    drop.forEach((k) => u.searchParams.delete(k));
    // Sort params alphabetically so ?b=2&a=1 === ?a=1&b=2.
    const sorted = Array.from(u.searchParams.entries())
        .filter(([k]) => !TRACKING_PARAM_RE.test(k))
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    u.search = "";
    for (const [k, v] of sorted) u.searchParams.append(k, v);
    // Trailing slash: keep the root "/", drop everywhere else.
    if (u.pathname !== "/" && u.pathname.endsWith("/")) {
        u.pathname = u.pathname.slice(0, -1);
    }
    return u.toString();
}

/** True when the URL matches the global block-list. Checked against the
 *  raw AND the normalized form (belt and braces around normalization). */
export function isBlockedUrl(url: string): string | null {
    if (BLOCKED_URL_RE.test(url)) return "matches the global block-list (junk/asset/auth/trap path)";
    return null;
}

function isSubdomainOf(host: string, parentHost: string): boolean {
    const h = host.toLowerCase();
    const p = parentHost.toLowerCase();
    return h === p || h.endsWith("." + p);
}

// ─── The gate ───────────────────────────────────────────────────────────────

/**
 * Filter one candidate URL against the full policy.
 *
 * @param raw     the candidate URL exactly as discovered/entered.
 * @param parent  optional parent page URL (index harvest). When present,
 *                off-domain links are rejected unless they are direct
 *                document links on a subdomain/CDN of the parent host.
 */
export function filterCandidateUrl(raw: string, parent?: string): UrlFilterResult {
    let u: URL;
    try {
        u = new URL(raw.trim());
    } catch {
        return reject("malformed URL");
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") {
        return reject(`unsupported scheme (${u.protocol})`);
    }

    // Off-domain rule (harvest context only).
    if (parent) {
        let pu: URL;
        try {
            pu = new URL(parent);
        } catch {
            return reject("malformed parent URL");
        }
        const sameSite = isSubdomainOf(u.host, pu.host);
        if (!sameSite) {
            // Only direct document links on an official subdomain/CDN of
            // the SOURCE are allowed off-host — and u.host must actually be
            // a subdomain of the parent (a different registrable domain is
            // never "official").
            const docLink = DIRECT_DOC_RE.test(u.pathname);
            if (!docLink || !isSubdomainOf(u.host, pu.host)) {
                return reject(
                    docLink
                        ? `off-domain document link (${u.host} is not an official subdomain of ${pu.host})`
                        : `off-domain link (${u.host} ≠ ${pu.host})`
                );
            }
        }
    }

    // Normalize, then re-check the block list on both forms.
    const normalized = normalizeCandidateUrl(raw);
    const blockedOn = isBlockedUrl(raw) ?? isBlockedUrl(normalized);
    if (blockedOn) return reject(blockedOn);

    let nu: URL;
    try {
        nu = new URL(normalized);
    } catch {
        return reject("malformed URL after normalization");
    }
    const path = nu.pathname;

    // ── Priority 1: direct document links ─────────────────────────────
    if (DIRECT_DOC_RE.test(path)) {
        return { allowed: true, url: normalized, kind: "document", priority: URL_PRIORITY.DOC_LINK };
    }

    // ── Priority 1: canonical legal detail paths (with a detail segment) ──
    const canonical = CANONICAL_DETAIL_RE.exec(path);
    if (canonical) {
        const rest = path.slice(canonical[0].length).replace(/^\/+|\/+$/g, "");
        if (rest.length > 0) {
            return { allowed: true, url: normalized, kind: "document", priority: URL_PRIORITY.DOC_LINK };
        }
        // Bare prefix (/judgments, /legislation) — fall through to the
        // index rules below.
    }

    // ── Priority 2: index/listing pages (discovery only) ───────────────
    const segments = path.split("/").filter(Boolean);
    const lastSegment = segments.length > 0 ? segments[segments.length - 1] : "";
    const isIndexLike =
        segments.length === 0 || // domain root
        INDEX_SEGMENT_RE.test(lastSegment) ||
        INDEX_SEGMENT_RE.test(decodeURIComponent(lastSegment));
    if (isIndexLike) {
        // Duplicate-variant trap: on index pages keep ONLY pagination —
        // sort/filter/search params collapse so one listing = one row.
        const iu = new URL(normalized);
        const keep: Array<[string, string]> = [];
        iu.searchParams.forEach((v, k) => {
            if (INDEX_KEEP_PARAMS.has(k)) keep.push([k, v]);
        });
        iu.search = "";
        for (const [k, v] of keep) iu.searchParams.append(k, v);
        if (iu.pathname !== "/" && iu.pathname.endsWith("/")) {
            iu.pathname = iu.pathname.slice(0, -1);
        }
        const indexUrl = iu.toString();
        return { allowed: true, url: indexUrl, kind: "index", priority: URL_PRIORITY.INDEX_DISCOVERY };
    }

    // ── Everything else: not a legal authority, not a listing ──────────
    return reject(
        "not on the allow-list (add a /judgments, /legislation, /regulation… detail path or link the .pdf directly)"
    );
}

/** Convenience: is this URL allowed by the queue policy (no parent)? */
export function isAllowedQueueUrl(raw: string): boolean {
    return filterCandidateUrl(raw).allowed;
}
