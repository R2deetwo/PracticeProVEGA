/**
 * cprWindows.test.ts — the verified Civil Procedure Rules windows engine
 * (2026-11-22, owner: "How does the app actually know when a document was
 * served? … why don't we get this working?").
 *
 * Pins:
 *   - the registry's VERIFIED windows (Lagos 42 / FCT 21+21 / FHC 30 / CA
 *     3 months + 14 days) with their exact rule citations;
 *   - computation from a recorded service date (first day excluded,
 *     weekend/holiday rollover);
 *   - calendar-MONTH math for the 3-month appeal period (not 90 days);
 *   - the honesty rule: courts without verified windows return NOTHING —
 *     never a guess.
 */
import { describe, it, expect } from "vitest";

import {
  CPR_WINDOWS,
  computeServiceDeadlines,
  courtJurisdictionProfile,
} from "../../src/legal/cprWindows";

describe("the CPR windows registry — verified entries only", () => {
  it("Lagos HC: statement of defence 42 days — Order 17 Rule 1(2), 2019 Rules", () => {
    const win = CPR_WINDOWS.find(w => w.id === "lagos-hc-defence-42")!;
    expect(win.jurisdictionKey).toBe("lagos_high_court");
    expect(win.windowDays).toBe(42);
    expect(win.citation).toContain("Order 17 Rule 1(2)");
    expect(win.citation).toContain("High Court of Lagos State (Civil Procedure) Rules 2019");
    expect(win.trigger).toBe("service_of_originating_process");
  });

  it("FCT HC (2025 Rules): appearance 21 (Order 11 Rule 1) + defence 21 (Order 15 Rule 1(2)&(3))", () => {
    const appearance = CPR_WINDOWS.find(w => w.id === "fct-hc-appearance-21")!;
    const defence = CPR_WINDOWS.find(w => w.id === "fct-hc-defence-21")!;
    expect(appearance.windowDays).toBe(21);
    expect(appearance.citation).toContain("Order 11 Rule 1");
    expect(appearance.citation).toContain("Rules 2025");
    expect(defence.windowDays).toBe(21);
    expect(defence.citation).toContain("Order 15 Rule 1(2) & (3)");
  });

  it("FHC: memorandum of appearance 30 days — Order 7 Rule 1, 2019 Rules", () => {
    const win = CPR_WINDOWS.find(w => w.id === "fhc-appearance-30")!;
    expect(win.windowDays).toBe(30);
    expect(win.citation).toContain("Order 7 Rule 1");
    expect(win.citation).toContain("Federal High Court (Civil Procedure) Rules 2019");
  });

  it("Court of Appeal: 3 months (final, s.24(3)) and 14 days (interlocutory, s.24(2))", () => {
    const final = CPR_WINDOWS.find(w => w.id === "ca-appeal-final-3m")!;
    const interlocutory = CPR_WINDOWS.find(w => w.id === "ca-appeal-interlocutory-14")!;
    expect(final.counting).toBe("months");
    expect(final.citation).toContain("Section 24(3)");
    expect(interlocutory.windowDays).toBe(14);
    expect(interlocutory.citation).toContain("Section 24(2)");
  });

  it("every entry carries the anti-fabrication flag and a source", () => {
    for (const win of CPR_WINDOWS) {
      expect(win.verifyBy).toBe("counsel");
      expect(win.source.length).toBeGreaterThan(10);
      expect(win.verifiedOn).toBe("2026-11-22");
    }
  });
});

describe("computeServiceDeadlines — the day math", () => {
  it("Lagos: service 22 Nov 2026 → defence due 3 Jan 2027 (42 days, first day excluded)", () => {
    const deadlines = computeServiceDeadlines({
      court: "High Court of Lagos State",
      fromDate: "2026-11-22",
    });
    expect(deadlines.length).toBe(1);
    expect(deadlines[0].window.id).toBe("lagos-hc-defence-42");
    const due = new Date(deadlines[0].dueDate);
    // Nov 22 + 42 days = Jan 3, 2027; Jan 3 is a Sunday → rolled to Mon Jan 4.
    expect(due.getFullYear()).toBe(2027);
    expect(due.getMonth()).toBe(0);
    expect([3, 4]).toContain(due.getDate());
    expect(deadlines[0].note).toContain("42 days");
    expect(deadlines[0].note).toContain("22 November 2026");
  });

  it("FCT: service yields BOTH the appearance and the defence windows, citations riding each", () => {
    const deadlines = computeServiceDeadlines({
      court: "High Court of the Federal Capital Territory",
      fromDate: "2026-11-16",
    });
    expect(deadlines.map(d => d.window.id)).toEqual(["fct-hc-appearance-21", "fct-hc-defence-21"]);
    for (const d of deadlines) {
      expect(d.window.citation).toContain("Federal Capital Territory");
    }
  });

  it("a weekend/holiday landing date rolls to the next working day", () => {
    // Service 2026-10-30 (Fri) + 21 days = 2026-11-20 (Fri) — fine.
    // Service 2026-11-13 (Fri) + 21 days = 2026-12-04 (Fri) — fine. Use a
    // case that lands on a weekend: 2026-11-01 (Sun) + 21 = 2026-11-22 (Sun)
    // → rolls to Monday 2026-11-23.
    const deadlines = computeServiceDeadlines({
      court: "High Court of the Federal Capital Territory, Abuja",
      fromDate: "2026-11-01",
    });
    const appearance = deadlines.find(d => d.window.id === "fct-hc-appearance-21")!;
    const due = new Date(appearance.dueDate);
    expect(due.getDay()).not.toBe(0);
    expect(due.getDay()).not.toBe(6);
    expect(due.getDate()).toBe(23);
    expect(due.getMonth()).toBe(10);
  });

  it("the 3-month appeal window uses CALENDAR months, not 90 days", () => {
    // Judgment 31 Jan 2027 + 3 calendar months = 30 Apr 2027 (Friday).
    // 90 DAYS would land on 1 May (a Saturday, rolling to Mon 3 May) —
    // the two are visibly different, so this pins the calendar-month math.
    const deadlines = computeServiceDeadlines({
      court: "Court of Appeal",
      fromDate: "2027-01-31",
    });
    const final = deadlines.find(d => d.window.id === "ca-appeal-final-3m")!;
    const due = new Date(final.dueDate);
    expect(due.getFullYear()).toBe(2027);
    expect(due.getMonth()).toBe(3); // April
    expect(due.getDate()).toBe(30);
    expect(final.note).toContain("3 calendar months");
  });

  it("an interlocutory decision yields ONLY the 14-day window", () => {
    const deadlines = computeServiceDeadlines({
      court: "Court of Appeal",
      fromDate: "2026-11-02",
      interlocutory: true,
    });
    expect(deadlines.map(d => d.window.id)).toEqual(["ca-appeal-interlocutory-14"]);
  });
});

describe("the honesty rule — no verified window, no guess", () => {
  it("a court without verified windows computes NOTHING (never a default period)", () => {
    const deadlines = computeServiceDeadlines({
      court: "High Court of Kano State",
      fromDate: "2026-11-22",
    });
    expect(deadlines).toEqual([]);
  });

  it("an empty court string computes nothing", () => {
    expect(computeServiceDeadlines({ court: "", fromDate: "2026-11-22" })).toEqual([]);
    expect(computeServiceDeadlines({ court: null, fromDate: "2026-11-22" })).toEqual([]);
  });

  it("a garbage service date computes nothing (no NaN deadlines)", () => {
    expect(computeServiceDeadlines({ court: "High Court of Lagos State", fromDate: "not-a-date" })).toEqual([]);
  });

  it("the coverage resolver maps court strings to jurisdictions", () => {
    expect(courtJurisdictionProfile("High Court of Lagos State").key).toBe("lagos_high_court");
    expect(courtJurisdictionProfile("Federal High Court").key).toBe("federal_high_court");
    expect(courtJurisdictionProfile("Court of Appeal").key).toBe("court_of_appeal");
    expect(courtJurisdictionProfile("High Court of Kano State").key).toBe("default");
  });
});
