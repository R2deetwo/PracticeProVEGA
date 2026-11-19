/**
 * seeds.ts — the builtin authoritative Nigerian legal seed sources for the
 * in-Convex ingestion engine (the TS port of
 * tools/legal_ingester/legal_ingester/seeds.py).
 *
 * The founder can enable the engine from the Founder APK with one toggle:
 * these seeds are upserted into `legal_seed_sources` automatically on
 * first enable (and re-runnable), landing in the queue at CURATED
 * priority. Each domain's robots.txt is respected by the worker; the
 * founder can disable any seed from the app without touching code.
 */

export interface SeedSource {
    sourceUrl: string;
    domainCategory: string;
    kind: "index" | "document";
    authority: string;
    notes: string;
}

export const BUILTIN_SEED_SOURCES: SeedSource[] = [
    {
        sourceUrl: "https://nigerialii.org",
        domainCategory: "index",
        kind: "index",
        authority: "NigeriaLII (AfricanLII) — judgments index",
        notes: "Legal Information Institute layer for Nigerian case law.",
    },
    {
        sourceUrl: "https://supremecourt.gov.ng",
        domainCategory: "judgments",
        kind: "index",
        authority: "Supreme Court of Nigeria — official site",
        notes: "Judgments section; verify robots.txt before deep crawls.",
    },
    {
        sourceUrl: "https://nass.gov.ng",
        domainCategory: "statutes",
        kind: "index",
        authority: "National Assembly — bills and legislation",
        notes: "Federal statutes and subsidiary legislation index.",
    },
    {
        sourceUrl: "https://sec.gov.ng",
        domainCategory: "sec_regulations",
        kind: "index",
        authority: "Securities and Exchange Commission, Nigeria",
        notes: "SEC rules, regulations, codes and guidelines.",
    },
    {
        sourceUrl: "https://www.inecnigeria.org",
        domainCategory: "electoral",
        kind: "index",
        authority: "Independent National Electoral Commission (INEC)",
        notes: "Electoral guidelines, regulations and manuals.",
    },
    {
        sourceUrl: "https://www.cac.gov.ng",
        domainCategory: "subsidiary",
        kind: "index",
        authority: "Corporate Affairs Commission (CAC)",
        notes: "Company regulations, forms and practice directions.",
    },
];
