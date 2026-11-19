/**
 * classify.ts — domain-category + document-type classification for the
 * in-Convex ingestion engine (the TS port of
 * tools/legal_ingester/legal_ingester/classifier.py, same heuristics,
 * same taxonomy — spec §3).
 *
 * classifyCategory(url, text, title) → one of DOMAIN_CATEGORIES
 * classifyDocumentType(category, url, text) → judgment | instrument | index
 *   (decides which Convex document table the payload targets, or whether
 *   we only harvest links from an index page)
 */

export const CATEGORIES = [
    "judgments",
    "statutes",
    "subsidiary",
    "rules_of_court",
    "sec_regulations",
    "electoral",
    "index",
] as const;

const JUDGMENT_DOMAINS = [
    "supremecourt.gov.ng",
    "courtofappeal.gov.ng",
    "nigerialii.org",
    "liiofindia.org",
    "lawpivot",
    "lawnigeria.com",
];
const JUDGMENT_URL_WORDS = ["judgment", "judgement", "decision", "lpelr", "suit-no", "suit_no"];
const JUDGMENT_TEXT_WORDS = ["ratio decidendi", "obiter", "suit no", "before the supreme court", "court of appeal"];

const STATUTE_URL_WORDS = ["constitution", "act", "law", "statute", "laws-of-the-federation"];
const REGULATION_URL_WORDS = ["regulation", "rules", "guideline", "guidelines", "code"];
const ELECTORAL_URL_WORDS = ["inec", "electoral", "election"];

function hostOf(url: string): string {
    try { return new URL(url).host.toLowerCase(); } catch { return ""; }
}

function pathOf(url: string): string {
    try { return new URL(url).pathname.toLowerCase(); } catch { return ""; }
}

export function classifyCategory(url: string, text: string, title = ""): string {
    const host = hostOf(url);
    const path = pathOf(url);
    // Parens normalized away (with whitespace collapse) so "High Court
    // (Civil Procedure) Rules" matches the "civil procedure rules" phrase
    // (a small improvement over the Python original, which missed the
    // parenthesized form).
    const hay = `${path} ${title.toLowerCase()} ${text.slice(0, 2000).toLowerCase()}`
        .replace(/[()]/g, " ")
        .replace(/\s+/g, " ");

    if (host.includes("sec.gov.ng")) return "sec_regulations";
    if (host.includes("inec") || ELECTORAL_URL_WORDS.some((w) => path.includes(w))) return "electoral";
    if (JUDGMENT_DOMAINS.some((d) => host.includes(d)) && JUDGMENT_URL_WORDS.some((w) => path.includes(w))) {
        return "judgments";
    }
    if (JUDGMENT_TEXT_WORDS.some((w) => hay.includes(w)) && /\b(suit no|sc\/|ca\/|fhc\/|nicn\/|llr)\b/.test(hay)) {
        return "judgments";
    }
    if (hay.includes("rules of court") || hay.includes("high court rules") || hay.includes("civil procedure rules")) {
        return "rules_of_court";
    }
    if (REGULATION_URL_WORDS.some((w) => path.includes(w)) && !JUDGMENT_URL_WORDS.some((w) => path.includes(w))) {
        return "subsidiary";
    }
    if (STATUTE_URL_WORDS.some((w) => path.includes(w))) return "statutes";
    return JUDGMENT_TEXT_WORDS.slice(0, 2).some((w) => hay.includes(w)) ? "judgments" : "statutes";
}

export function classifyDocumentType(category: string, url: string, text: string): "judgment" | "instrument" | "index" {
    const path = pathOf(url);
    if (category === "judgments" && /(judgment|decision|lpelr)/.test(path)) return "judgment";
    if (/(judgment|decision|lpelr)/.test(path) && /\bsuit no\b/.test(text.slice(0, 4000).toLowerCase())) {
        return "judgment";
    }
    if (category !== "index") {
        const head = text.slice(0, 4000).toLowerCase();
        if (/\b(part|section)\s+[0-9ivx]+\b/.test(head)) return "instrument";
    }
    return "index";
}
