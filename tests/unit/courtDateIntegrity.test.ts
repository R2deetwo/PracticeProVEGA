/**
 * courtDateIntegrity — ROUND 25 (ALOA Vox intelligence overhaul, owner bug
 * report 2026-11-28: the Court Mode NEXT DATE card rendered
 * "undefined NaN undefined NaN · overdue" and dates could not be cleanly
 * edited or reset).
 *
 * Locks the strict date-validation layer end to end:
 *   - format.ts: `isValidDayKey` / `safeDayKeyOf` / `dayKeyOf` /
 *     `formatDayKeyLong` / `formatDayKeyFull` / `relativeDayLabel` — a
 *     missing, malformed or unparseable date NEVER yields `undefined`,
 *     `NaN` or garbage like "Invalid Da".
 *   - NextDateCard: the clean "No next date set" empty state.
 *   - NextDateEditor + useCourtInlineEdit: the clean edit and RESET (a
 *     matter-level date clears; a real diary event always keeps a date).
 *   - courtDrafts: the rawTranscript round-trip (the review workflow's raw
 *     side survives storage, malformed copies are dropped).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  dayKeyOf,
  formatDayKeyFull,
  formatDayKeyLong,
  isValidDayKey,
  relativeDayLabel,
  safeDayKeyOf,
} from "../../src/components/aloa/court/format";
import { parseDrafts, serializeDrafts } from "../../src/components/aloa/court/courtDrafts";

const root = (relative: string) => join(process.cwd(), relative);
const readSrc = (relative: string) => readFileSync(root(relative), "utf8");

// ─── format.ts — the strict validation layer ─────────────────────────────

describe("isValidDayKey (ROUND 25)", () => {
  it("accepts a real YYYY-MM-DD calendar date", () => {
    expect(isValidDayKey("2026-12-04")).toBe(true);
  });

  it("rejects garbage, calendar-impossible and empty values", () => {
    expect(isValidDayKey("2026-13-45")).toBe(false); // rolled-over month/day
    expect(isValidDayKey("2026-02-30")).toBe(false); // no such date
    expect(isValidDayKey("")).toBe(false);
    expect(isValidDayKey("Invalid Da")).toBe(false);
    expect(isValidDayKey("undefined NaN undefined NaN")).toBe(false);
    expect(isValidDayKey(null)).toBe(false);
    expect(isValidDayKey(undefined)).toBe(false);
  });
});

describe("dayKeyOf / safeDayKeyOf (ROUND 25)", () => {
  it("resolves a date-only key and an ISO instant to local day keys", () => {
    expect(dayKeyOf("2026-12-04")).toBe("2026-12-04");
    expect(safeDayKeyOf("2026-12-04T09:30:00.000Z")).toBeTypeOf("string");
    expect(isValidDayKey(safeDayKeyOf("2026-12-04T09:30:00.000Z")!)).toBe(true);
  });

  it("collapses missing / malformed values to null / \"\" — never garbage slices", () => {
    expect(safeDayKeyOf("")).toBeNull();
    expect(safeDayKeyOf(null)).toBeNull();
    expect(safeDayKeyOf(undefined)).toBeNull();
    expect(safeDayKeyOf("Invalid Date")).toBeNull();
    expect(safeDayKeyOf("undefined NaN")).toBeNull();
    expect(dayKeyOf("Invalid Date")).toBe("");
    expect(dayKeyOf("2026-13-45")).toBe("");
  });

  it("never produces a NaN-rendering key for any input shape", () => {
    const hostile: Array<string | null | undefined> = ["", null, undefined, "NaN", "garbage", "2026-99-99", "   "];
    for (const value of hostile) {
      const key = dayKeyOf((value ?? "") as string);
      expect(key === "" || isValidDayKey(key)).toBe(true);
    }
  });
});

describe("formatDayKeyLong / formatDayKeyFull (ROUND 25)", () => {
  it("formats a valid key", () => {
    const weekday = new Date(2026, 11, 4).toLocaleDateString("en-GB", { weekday: "long" });
    expect(formatDayKeyLong("2026-12-04")).toBe(`${weekday} 4 Dec 2026`);
    expect(formatDayKeyFull("2026-12-04")).toBe("4 December 2026");
  });

  it("returns \"\" for an invalid key — the exact rendering bug", () => {
    expect(formatDayKeyLong("")).toBe("");
    expect(formatDayKeyLong("2026-13-45")).toBe("");
    expect(formatDayKeyFull("")).toBe("");
    // The owner's reported rendering can never reappear:
    for (const key of ["", "2026-99-99", "Invalid Da"]) {
      expect(formatDayKeyLong(key)).not.toContain("undefined");
      expect(formatDayKeyLong(key)).not.toContain("NaN");
    }
  });
});

describe("relativeDayLabel (ROUND 25)", () => {
  const TODAY = "2026-11-28";
  it("keeps the factual labels for valid keys", () => {
    expect(relativeDayLabel(TODAY, TODAY)).toBe("today");
    expect(relativeDayLabel("2026-11-29", TODAY)).toBe("tomorrow");
    expect(relativeDayLabel("2026-12-01", TODAY)).toBe("in 3 days");
    expect(relativeDayLabel("2026-11-27", TODAY)).toBe("overdue");
  });

  it("returns \"\" for an invalid key — never a NaN-derived \"overdue\"", () => {
    expect(relativeDayLabel("", TODAY)).toBe("");
    expect(relativeDayLabel("2026-13-45", TODAY)).toBe("");
    expect(relativeDayLabel(TODAY, "")).toBe("");
  });
});

// ─── NextDateCard — the clean empty state ────────────────────────────────

describe("NextDateCard (ROUND 25 source contract)", () => {
  const source = readSrc("src/components/aloa/court/NextDateCard.tsx");

  it("renders the clean empty state when no valid date exists", () => {
    expect(source).toContain("No next date set");
    expect(source).toContain("hearing: CourtHearing | null");
    // The empty state is driven by the STRICT resolver, not a lenient local copy.
    expect(source).toContain("safeDayKeyOf");
  });

  it("never formats an unvalidated key", () => {
    expect(source).toContain("dayKey && isValidDayKey(dayKey)");
  });
});

// ─── NextDateEditor + useCourtInlineEdit — the clean edit & reset ─────────

describe("NextDateEditor / useCourtInlineEdit (ROUND 25 source contract)", () => {
  const editor = readSrc("src/components/aloa/court/NextDateEditor.tsx");
  const inlineEdit = readSrc("src/components/aloa/court/useCourtInlineEdit.ts");

  it("the affordance says \"Set date\" when no valid date exists, \"Edit\" otherwise", () => {
    expect(editor).toContain('existingDayKey ? "Edit" : "Set date"');
  });

  it("the editor seeds from the STRICT resolver — never a NaN string", () => {
    expect(editor).toContain("safeDayKeyOf(hearing.date)");
    expect(editor).not.toContain("dayKeyOf(hearing.date)");
  });

  it("a matter-level (synthesized) date can be RESET via Clear date", () => {
    expect(editor).toContain("Clear date");
    expect(editor).toContain("SYNTHESIZED_HEARING_ID_PREFIX");
  });

  it("saving an empty date on a synthesized hearing clears the matter's next date", () => {
    expect(inlineEdit).toContain("if (!dateISO && !isSynthesized) return false;");
    expect(inlineEdit).toContain("nextAdjournedDate: dateISO");
    expect(inlineEdit).toContain("Cleared the next court date");
  });

  it("a real diary event always keeps a date", () => {
    expect(inlineEdit).toContain("real diary event");
  });
});

// ─── courtDrafts — the rawTranscript round-trip ──────────────────────────

describe("courtDrafts rawTranscript (ROUND 25)", () => {
  const base = {
    text: "Matter adjourned to 4 December 2026 for hearing of motion.",
    noteType: "endorsement" as const,
    nextDate: null,
    updatedAt: Date.now(),
  };

  it("survives a serialize → parse round-trip", () => {
    const drafts = { "m-1": { ...base, rawTranscript: "the court adjourned to the fourth of December" } };
    const parsed = parseDrafts(serializeDrafts(drafts), Date.now());
    expect(parsed["m-1"].rawTranscript).toBe("the court adjourned to the fourth of December");
  });

  it("a malformed rawTranscript value drops the whole draft entry (never throws)", () => {
    const raw = JSON.stringify({
      "m-1": { ...base, rawTranscript: 42 },
    });
    expect(parseDrafts(raw, Date.now())).toEqual({});
  });

  it("drafts without a rawTranscript still round-trip unchanged", () => {
    const parsed = parseDrafts(serializeDrafts({ "m-1": base }), Date.now());
    expect(parsed["m-1"].text).toBe(base.text);
    expect(parsed["m-1"].rawTranscript).toBeUndefined();
  });
});
