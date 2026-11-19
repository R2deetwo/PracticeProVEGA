/**
 * extract.ts — HTML text + link extraction for the in-Convex ingestion
 * engine (the TS port of tools/legal_ingester/legal_ingester/extract.py).
 *
 * The Python worker used BeautifulSoup; Convex actions have no DOM, so
 * this is a regex-based extractor that reproduces the same contract:
 *   - <title> (fallback og:title) is the document title
 *   - every <a href> is resolved against the page URL (absolute, defragged)
 *   - script/style/nav/header/footer/noscript/aside/form content is REMOVED
 *   - block-level closings become newlines so legal structure (numbered
 *     paragraphs, section headings) survives tag stripping
 *   - whitespace is collapsed the same way the Python did
 *
 * PDFs are intentionally NOT parsed here (no pypdf equivalent in Convex):
 * the engine defers them — see worker.ts's pdf_deferred outcome. The
 * Python tool remains the full-fidelity path for PDF sources.
 */

export interface ExtractedDocument {
    text: string;
    title: string;
    links: string[];
}

/** Defensive cap: pages larger than this are truncated before parsing. */
export const MAX_HTML_BYTES = 1_500_000;

const STRIP_BLOCK_RE =
    /<(script|style|nav|header|footer|noscript|aside|form)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const BLOCK_CLOSE_RE =
    /<\/(?:p|div|section|article|li|ul|ol|table|tr|h1|h2|h3|h4|h5|h6|blockquote|thead|tbody|dl|dd|dt)\s*>|<br\s*\/?>|<hr\s*\/?>/gi;
const TAG_RE = /<[^>]+>/g;

const ENTITIES: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
    "&nbsp;": " ",
};

function decodeEntities(s: string): string {
    return s
        .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (m) => ENTITIES[m] ?? m)
        .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
            try { return String.fromCodePoint(parseInt(hex, 16)); } catch { return ""; }
        })
        .replace(/&#(\d+);/g, (_, dec) => {
            try { return String.fromCodePoint(parseInt(dec, 10)); } catch { return ""; }
        });
}

/** Resolve an href against a base URL, dropping the fragment. */
export function resolveHref(href: string, baseUrl: string): string | null {
    const trimmed = href.trim();
    if (!trimmed || /^(#|javascript:|mailto:|tel:|data:)/i.test(trimmed)) return null;
    try {
        const u = new URL(trimmed, baseUrl);
        u.hash = "";
        return u.toString();
    } catch {
        return null;
    }
}

export function isPdfBody(body: string): boolean {
    return body.slice(0, 5) === "%PDF-";
}

export function extractHtml(html: string, baseUrl = ""): ExtractedDocument {
    let src = html.length > MAX_HTML_BYTES ? html.slice(0, MAX_HTML_BYTES) : html;

    // Title: <title> first, og:title fallback (mirrors extract.py).
    let title = "";
    const titleM = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(src);
    if (titleM) title = decodeEntities(titleM[1].replace(TAG_RE, "")).trim();
    if (!title) {
        const ogM = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i.exec(src)
            || /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i.exec(src);
        if (ogM) title = decodeEntities(ogM[1]).trim();
    }

    // Links: harvest BEFORE stripping (anchors live in the markup).
    const links: string[] = [];
    if (baseUrl) {
        const hrefRe = /<a\s[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
        let m: RegExpExecArray | null;
        while ((m = hrefRe.exec(src)) !== null) {
            const href = m[1] ?? m[2] ?? m[3] ?? "";
            const abs = resolveHref(href, baseUrl);
            if (abs && !links.includes(abs)) links.push(abs);
            if (links.length >= 500) break; // defensive cap
        }
    }

    // Strip script/style/nav/... blocks entirely.
    src = src.replace(STRIP_BLOCK_RE, " ");
    // Block closings / br / hr → newline sentinels (legal structure survives).
    src = src.replace(BLOCK_CLOSE_RE, "\n");
    // Remove remaining tags, decode entities.
    let text = decodeEntities(src.replace(TAG_RE, " "));
    // Whitespace collapse — same three passes as extract.py.
    text = text.replace(/[ \t]+/g, " ");
    text = text.replace(/ ?\n ?/g, "\n");
    text = text.replace(/\n{3,}/g, "\n\n");

    return { text: text.trim(), title, links };
}
