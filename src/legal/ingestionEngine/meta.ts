/**
 * meta.ts — judgment / instrument metadata extraction for the in-Convex
 * ingestion engine (the TS port of
 * tools/legal_ingester/legal_ingester/metadata.py — spec §3).
 *
 * Heuristic field extraction tuned for Nigerian judgment formats
 * (LII-style headers, LPELR citations, "SUIT NO: SC/123/2021", counsel
 * blocks). Everything is best-effort: missing fields come back as
 * empty/unknown and the document still ingests with an "unverified"
 * warning — honesty over invented data (the corpus philosophy).
 */

import { extractCitations } from "./chunk";

export interface JudgmentMeta {
    citation: string;
    suitNumber: string;
    court: string;
    courtLevel: string;
    dateDelivered: string;
    parties: Array<{ role: string; name: string }>;
    judges: { lead: string[]; concurring: string[]; dissenting: string[] };
    counsel: Array<{ party: string; names: string }>;
    ratioDecidendi: string;
    obiterDicta: string;
    statutesConsidered: string[];
    casesCited: Array<{ case: string; treatment: string }>;
}

const SUIT_NO_RE = /(?:SUIT\s*NO\.?|CASE\s*NO\.?|APPEAL\s*NO\.?)\s*[:\-]?\s*([A-Z]{1,6}(?:\/[A-Z0-9]{1,6}){1,4}\/\d{4})/i;
const JUDGE_LINE_RE = /^\s*(HON\.?\s+)?JUSTICE\s+([A-Z][A-Z\s.,'-]+?),?\s*(JSC|J\.?SC|JCA|J\.?CA|J\.?|CJN|JUDGE)?\s*$/i;
const COURT_LINE_RE = /(SUPREME\s+COURT\s+OF\s+NIGERIA|COURT\s+OF\s+APPEAL|FEDERAL\s+HIGH\s+COURT|HIGH\s+COURT\s+OF\s+[A-Z\s]+STATE|NATIONAL\s+INDUSTRIAL\s+COURT|SHARIA\s+COURT\s+OF\s+APPEAL|CUSTOMARY\s+COURT\s+OF\s+APPEAL)/i;
const DATE_RE = /\b(\d{1,2}(?:st|nd|rd|th)?)(?:\s+day\s+of)?\s+(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s*,?\s+(\d{4})\b/i;
const LPELR_RE = /\[?(\d{4})\]?\s*LPELR-(\d+)\s*\(([A-Z]{2,5})\)/i;
const VS_RE = /^(.+?)\s+(?:v\.?|vs\.?)\s+(.+)$/i;

const MONTHS: Record<string, number> = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function isoDate(text: string): string {
    const m = DATE_RE.exec(text);
    if (!m) return "";
    const day = parseInt(m[1].replace(/(st|nd|rd|th)/i, ""), 10);
    const month = MONTHS[m[2].toLowerCase()];
    const year = parseInt(m[3], 10);
    if (!month || !day || !year) return "";
    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function courtLevelOf(court: string): string {
    const c = court.toLowerCase();
    if (c.includes("supreme")) return "supreme";
    if (c.includes("appeal")) return "court_of_appeal";
    if (c.includes("federal high")) return "federal_high_court";
    if (c.includes("industrial")) return "national_industrial_court";
    if (c.includes("high court")) return "state_high_court";
    return "other";
}

function titleCase(s: string): string {
    return s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

export function extractJudgmentMeta(text: string, title: string, sourceUrl: string, citationFallback = ""): JudgmentMeta {
    const meta: JudgmentMeta = {
        citation: "",
        suitNumber: "",
        court: "",
        courtLevel: "",
        dateDelivered: "",
        parties: [],
        judges: { lead: [], concurring: [], dissenting: [] },
        counsel: [],
        ratioDecidendi: "",
        obiterDicta: "",
        statutesConsidered: [],
        casesCited: [],
    };
    const head = text.slice(0, 6000);

    // Citation: prefer an LPELR citation found anywhere in the document.
    const lpelr = LPELR_RE.exec(text);
    if (lpelr) meta.citation = `[${lpelr[1]}] LPELR-${lpelr[2]} (${lpelr[3].toUpperCase()})`;
    else if (citationFallback) meta.citation = citationFallback;
    else meta.citation = title.trim().slice(0, 160) || sourceUrl;

    const suit = SUIT_NO_RE.exec(head);
    if (suit) meta.suitNumber = suit[1].toUpperCase();

    const court = COURT_LINE_RE.exec(head);
    if (court) {
        // Python parity: .title() per word, whitespace collapsed.
        meta.court = court[1].split(/\s+/).map(titleCase).join(" ");
        meta.courtLevel = courtLevelOf(meta.court);
    }

    meta.dateDelivered = isoDate(text.slice(0, 12000));

    // Parties from the title ("A v. B") or the first "X VS Y" line.
    let partySrc = title && VS_RE.test(title) ? title : "";
    if (!partySrc) {
        for (const line of head.split("\n").slice(0, 40)) {
            if (VS_RE.test(line) && line.length < 220) {
                partySrc = line.trim();
                break;
            }
        }
    }
    if (partySrc) {
        const pm = VS_RE.exec(partySrc);
        if (pm) {
            meta.parties = [
                { role: "appellant/plaintiff", name: pm[1].replace(/[. ]+$/, "") },
                { role: "respondent/defendant", name: pm[2].replace(/[. ]+$/, "") },
            ];
        }
    }

    // Judges: lines like "JUSTICE OLUKAYODE ARIWOOLA, JSC".
    for (const line of head.split("\n")) {
        const jm = JUDGE_LINE_RE.exec(line.trim());
        if (jm && meta.judges.lead.length < 9) {
            const name = titleCase(jm[2].replace(/\s+/g, " "));
            const suffix = (jm[3] || "").toUpperCase().replace(/\./g, "");
            const label = `Justice ${name}${suffix ? ` (${suffix})` : ""}`;
            if (!meta.judges.lead.includes(label)) meta.judges.lead.push(label);
        }
    }

    // Counsel: "FOR THE APPELLANT: ..." blocks.
    const counselBlock = /FOR THE (?:APPELLANT|PLAINTIFF|CLAIMANT)[:\s][\s\S]{5,200}?(?=\n\s*\n|FOR THE|$)/i.exec(text.slice(0, 10000));
    if (counselBlock) {
        meta.counsel.push({
            party: "appellant",
            names: counselBlock[0].replace(/\s+/g, " ").slice(0, 200),
        });
    }

    // Ratio: text following a RATIO/RESOLUTION/HELD heading.
    const ratioM = /(?:RATIO\s+DECIDENDI|HELD\s*:|I\s+RESOLVE)\s*[:\-]?\s*([\s\S]{80,1200}?)(?=\n\s*\n|\n[A-Z]{4,})/i.exec(text);
    if (ratioM) meta.ratioDecidendi = ratioM[1].replace(/\s+/g, " ").slice(0, 1000);

    // Statutes considered + cases cited with treatment tags.
    for (const citation of extractCitations(text)) {
        if (citation.startsWith("Section") || citation.startsWith("S.")) {
            if (!meta.statutesConsidered.includes(citation)) meta.statutesConsidered.push(citation);
        } else if (citation.includes("LPELR") || citation.includes("LR")) {
            const idx = text.indexOf(citation);
            const window = idx >= 0 ? text.slice(idx, idx + 400).toLowerCase() : "";
            const treatment =
                ["applied", "distinguished", "overruled", "affirmed", "followed"].find((t) => window.includes(t))
                ?? "considered";
            meta.casesCited.push({ case: citation, treatment });
        }
    }

    return meta;
}

export interface InstrumentMeta {
    title: string;
    key: string;
    issuingBody: string;
    instrumentType: string;
    commencementDate: string | null;
    year: number | null;
    status: string;
    structure: Array<{ level: string; number: string; heading: string }>;
    amendmentTracker: { amended: boolean; amendmentRefs: string[]; repealed: boolean; repealRef: string | null };
    summary: string | null;
}

function issuingBodyFor(sourceUrl: string, title: string, text: string): string {
    const url = sourceUrl.toLowerCase();
    if (url.includes("sec.gov.ng")) return "Securities and Exchange Commission (SEC)";
    if (url.includes("inec")) return "Independent National Electoral Commission (INEC)";
    if (url.includes("nass.gov.ng") || text.slice(0, 3000).toLowerCase().includes("national assembly")) {
        return "National Assembly";
    }
    if (url.includes("lagos") || url.includes("state")) return "State House of Assembly";
    if (url.includes("court") || title.toLowerCase().includes("rules")) return "Judiciary (Rules Committee)";
    return "Federal Government of Nigeria";
}

function instrumentTypeFor(category: string, title: string, text: string): string {
    const t = `${title} ${text.slice(0, 1000)}`.toLowerCase();
    if (category === "rules_of_court" || t.includes("rules of court") || t.includes("civil procedure rules")) {
        return "rules_of_court";
    }
    if (category === "sec_regulations") return "regulation";
    if (category === "electoral") return "guideline";
    if (t.includes("regulation")) return "regulation";
    return "act";
}

function structureSummary(text: string): Array<{ level: string; number: string; heading: string }> {
    const out: Array<{ level: string; number: string; heading: string }> = [];
    for (const raw of text.split("\n")) {
        if (out.length >= 400) break;
        const s = raw.trim();
        let m = /^PART\s+([A-Z0-9]+)\s*[—\-–:]?\s*(.*)$/i.exec(s);
        if (m) {
            out.push({ level: "part", number: m[1], heading: (m[2] || "").trim().slice(0, 120) });
            continue;
        }
        m = /^(?:SECTION|Section)\s+(\d+[A-Za-z]?)\.?\s*[—\-–:]?\s*(.*)$/.exec(s);
        if (m) out.push({ level: "section", number: m[1], heading: (m[2] || "").trim().slice(0, 160) });
    }
    return out;
}

export function buildInstrumentMeta(title: string, text: string, sourceUrl: string, category: string): InstrumentMeta {
    const yearM = /\b(19|20)\d{2}\b/.exec(`${title} ${text.slice(0, 2000)}`);
    const key = title.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80)
        || sourceUrl.split("/").filter(Boolean).pop()?.slice(0, 60) || "instrument";
    return {
        title: title.trim().slice(0, 200) || key,
        key,
        issuingBody: issuingBodyFor(sourceUrl, title, text),
        instrumentType: instrumentTypeFor(category, title, text),
        commencementDate: isoDate(text.slice(0, 3000)) || null,
        year: yearM ? parseInt(yearM[0], 10) : null,
        status: "in_force",
        structure: structureSummary(text),
        amendmentTracker: { amended: false, amendmentRefs: [], repealed: false, repealRef: null },
        summary: text.slice(0, 600).replace(/\s+/g, " ").slice(0, 500) || null,
    };
}
