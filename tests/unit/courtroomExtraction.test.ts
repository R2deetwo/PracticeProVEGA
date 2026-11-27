/**
 * courtroomExtraction — ROUND 25 (ALOA Vox intelligence overhaul, owner spec
 * 2026-11-28: FEATURE 5 — restore actionable structured extraction).
 *
 * A dictated courtroom passage must produce SEPARATED, ACTIONABLE items
 * auto-associated with the active matter:
 *   "The court adjourned to the 4th of December for hearing of the motion;
 *    the defendants are to file their response; we will file a written
 *    address; remind me to prepare the written address"
 *        → next date  4 Dec 2026
 *        → task       "Defendants to file their response"
 *        → task       "File a written address"
 *        → reminder   "Prepare the written address"
 */
import { describe, it, expect } from "vitest";
import { extractCourtroomActions } from "../../src/services/voice/courtroomExtraction";

const NOW = new Date(2026, 10, 28, 10, 0, 0); // Sat 28 Nov 2026 — owner's "today"

const OWNERS_PASSAGE =
  "The court adjourned to the 4th of December for hearing of the motion; " +
  "the defendants are to file their response; " +
  "we will file a written address; " +
  "remind me to prepare the written address";

describe("extractCourtroomActions — the owner's example passage", () => {
  const out = extractCourtroomActions(OWNERS_PASSAGE, NOW);

  it("detects the dictated next date (4 December 2026)", () => {
    expect(out.nextDate).not.toBeNull();
    expect(out.nextDate!.dateISO).toBe("2026-12-04");
  });

  it("extracts the party deadline as a task", () => {
    expect(out.tasks.map((t) => t.kind)).toEqual(["task", "task"]);
    expect(out.tasks.map((t) => t.title)).toContain("Defendants to file their response");
    const partyTask = out.tasks.find((t) => t.title === "Defendants to file their response");
    expect(partyTask!.dueDayKey).toBeNull();
  });

  it("extracts the first-person directive as a bare-imperative task", () => {
    expect(out.tasks.map((t) => t.title)).toContain("File a written address");
    expect(out.tasks).toHaveLength(2);
  });

  it("extracts the personal reminder", () => {
    expect(out.reminders).toHaveLength(1);
    expect(out.reminders[0].kind).toBe("reminder");
    expect(out.reminders[0].title).toBe("Prepare the written address");
  });

  it("keeps the proceedings narrative OUT of the action items", () => {
    // "The court adjourned to the 4th of December for hearing of the motion"
    // is the next date + narrative — never a task or reminder.
    const allTitles = [...out.tasks, ...out.reminders].map((a) => a.title);
    expect(allTitles.some((title) => /hearing of the motion/i.test(title))).toBe(false);
  });
});

describe("extractCourtroomActions — directive variants", () => {
  it("reads \"the court ordered the defendants to file their defence\"", () => {
    const out = extractCourtroomActions(
      "The court ordered the defendants to file their defence.",
      NOW,
    );
    expect(out.tasks.map((t) => t.title)).toContain("Defendants to file their defence");
  });

  it("reads \"counsel for the claimant shall serve the reply brief\"", () => {
    const out = extractCourtroomActions(
      "Counsel for the claimant shall serve the reply brief.",
      NOW,
    );
    expect(out.tasks.map((t) => t.title)).toContain(
      "Counsel for the claimant to serve the reply brief",
    );
  });

  it("attaches a stated due date to the action, distinct from the next date", () => {
    const out = extractCourtroomActions(
      "The court adjourned to the 4th of December for hearing of the motion. " +
        "The defendants are to file their response by the 1st of December.",
      NOW,
    );
    expect(out.nextDate!.dateISO).toBe("2026-12-04");
    const task = out.tasks.find((t) => t.title.includes("response"));
    expect(task).toBeDefined();
    expect(task!.dueDayKey).toBe("2026-12-01");
  });

  it("the adjournment date itself is never the action's due date", () => {
    const out = extractCourtroomActions(
      "The court adjourned to the 4th of December 2026 for hearing of the motion.",
      NOW,
    );
    expect(out.tasks).toHaveLength(0);
  });

  it("de-duplicates repeated directives", () => {
    const out = extractCourtroomActions(
      "The defendants are to file their response. The defendants are to file their response.",
      NOW,
    );
    expect(out.tasks).toHaveLength(1);
  });
});

describe("extractCourtroomActions — nothing actionable", () => {
  it("raw rambling with stutters and no directive yields no tasks", () => {
    const out = extractCourtroomActions(
      "my time and the judge the judge said they said they were going to they were opposed to the hearing of emotion",
      NOW,
    );
    expect(out.tasks).toHaveLength(0);
    expect(out.reminders).toHaveLength(0);
  });

  it("an empty passage yields no next date, tasks or reminders", () => {
    const out = extractCourtroomActions("", NOW);
    expect(out.nextDate).toBeNull();
    expect(out.tasks).toHaveLength(0);
    expect(out.reminders).toHaveLength(0);
  });
});
