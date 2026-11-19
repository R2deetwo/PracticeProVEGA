/**
 * legal/drafting/authorityLibrary.ts — the Legal Authority guardrail of the
 * Voice → DraftPro pipeline (owner spec 2026-11-19, §6.2).
 *
 * "The system must not generate case citations, statute section numbers or
 * rule numbers from model memory." Written addresses and briefs may cite
 * ONLY entries from the firm's AuthorityLibrary. Any citation the LLM
 * proposes that is not in the library is replaced by a
 * `[CITATION TO BE VERIFIED: <proposition>]` placeholder pill — it never
 * reaches the AST as literal text (AC6.1).
 *
 * The library ships EMPTY; the firm populates it via the "Add authority"
 * action in the editor or the CSV import path (convex/authorityLibrary.ts).
 *
 * Pure functions; zero imports.
 */

/** One verified (or to-be-verified) authority entry. */
export interface AuthorityEntry {
  citation: string;
  court: string;
  year: string;
  proposition: string;
  verified: boolean;
}

/** The shape of a scrubbed citation marker in the text. */
export const CITATION_TO_VERIFY_PREFIX = "[CITATION TO BE VERIFIED: ";
export const CITATION_TO_VERIFY_SUFFIX = "]";

/** Nigerian citation shapes we recognise. */
const CITATION_PATTERNS: RegExp[] = [
  // [2023] NWLR (Pt 1291) 1 ; [1995] 12 SCNJ 1 ; [1976] 1 All NLR 1
  /\[\d{4}\]\s*(?:\d+\s+)?(?:NWLR|NMLR|NSCNJ|SCNJ|RNWLR|All\s+NLR|WACA|FNLR|LRCN)\s*(?:\(\s*Pt\.?\s*\d+\s*\))?\s*\d+/i,
  // (2023) LPELR-58880(SC) ; (2010) LPELR-99999(CA)
  /\(\d{4}\)\s*LPELR-\d+\s*\([A-Z]{2,5}\)/i,
  // Case name + neutral year: Okafor v. Bello (2023) / Gov. of Lagos v. X [2023]
  /\b[A-Z][A-Za-z.'& ]{2,60}\bv\.?\s+[A-Z][A-Za-z.'& ]{2,60}\s*[([]\d{4}[)\]]/g,
];

/** Extract every citation-shaped string from a text. */
export function extractCitations(text: string): string[] {
  const out = new Set<string>();
  for (const re of CITATION_PATTERNS) {
    const flags = re.flags.includes("g") ? re.flags : re.flags + "g";
    const global = new RegExp(re.source, flags);
    let m: RegExpExecArray | null;
    while ((m = global.exec(text || "")) !== null) {
      const cite = m[0].trim();
      if (cite.length >= 6) out.add(cite);
      if (out.size > 40) break;
    }
  }
  return Array.from(out);
}

/** Case-insensitive containment match against the library. */
function inLibrary(citation: string, library: AuthorityEntry[]): boolean {
  const norm = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const c = norm(citation);
  if (!c) return true; // nothing to check
  return library.some((e) => {
    const k = norm(e.citation);
    return !!k && (k.includes(c) || c.includes(k));
  });
}

export interface ScrubResult {
  text: string;
  /** Citations that were NOT in the library and got replaced. */
  replaced: string[];
}

/**
 * Replace every citation not present in the library with a verification
 * placeholder pill. The proposition carried in the pill is the surrounding
 * clause (up to 120 chars) so the lawyer knows what the citation supported.
 */
export function scrubUnverifiedCitations(
  text: string,
  library: AuthorityEntry[]
): ScrubResult {
  const replaced: string[] = [];
  let out = text || "";
  for (const cite of extractCitations(text || "")) {
    if (inLibrary(cite, library)) continue;
    const idx = out.indexOf(cite);
    if (idx === -1) continue;
    // Proposition = the sentence fragment around the citation.
    const sentenceStart = Math.max(
      out.lastIndexOf(".", idx),
      out.lastIndexOf(";", idx),
      0
    );
    const proposition = out
      .slice(sentenceStart, idx)
      .replace(/^[\s.;]+/, "")
      .slice(0, 120)
      .trim();
    const pill =
      CITATION_TO_VERIFY_PREFIX +
      (proposition || "proposition supported by this citation") +
      CITATION_TO_VERIFY_SUFFIX;
    out = out.slice(0, idx) + pill + out.slice(idx + cite.length);
    replaced.push(cite);
  }
  return { text: out, replaced };
}

/** Parse the CSV import format: citation,court,year,proposition,verified. */
export function parseAuthoritiesCsv(csv: string): AuthorityEntry[] {
  const out: AuthorityEntry[] = [];
  for (const line of (csv || "").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.toLowerCase().startsWith("citation,")) continue;
    const [citation, court, year, proposition, verified] = t
      .split(",")
      .map((s) => (s || "").trim());
    if (!citation) continue;
    out.push({
      citation,
      court: court || "",
      year: year || "",
      proposition: proposition || "",
      verified:
        verified === "true" ||
        verified === "1" ||
        (verified || "").toLowerCase() === "yes",
    });
    if (out.length >= 500) break;
  }
  return out;
}
