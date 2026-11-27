import { describe, expect, it } from "vitest";
import { BillingModel, CalendarEvent, Matter, MatterStatus, MatterType, NotePage } from "../../src/types";
import {
  assessNextDate,
  buildOutcomePlan,
  detectNextDate,
  diaryDayLabel,
  filterDiary,
  getCourtDiary,
} from "../../src/components/aloa/courtModeUtils";

/**
 * Round 19 — THE STAND-IN SCENARIO (Nigerian practice: a colleague "holds
 * brief" for another's matter). Alice (viewer, logged in) appears for Bob on
 * Matter B (suit LD/1234/2024); Bob also has another hearing the same day.
 * The scenario drives the REAL deterministic layer end to end and executes
 * the composer's save sequence against mocked actions, asserting the three
 * writes happen in order with the exact payloads — the evidence form the
 * task accepts when a live end-to-end run is not possible.
 *
 * The save order itself (note → event → matterPatch, with the note failure
 * stopping everything) is additionally pinned on the real useOutcomeSave
 * source by tests/unit/aloaCourtModeEntry.test.ts.
 */
const ALICE = "alice";
const BOB = "bob";
const USER_NAMES: Record<string, string> = { alice: "Alice", bob: "Bob" };
const TODAY = "2026-03-10"; // Tuesday

const makeMatter = (overrides: Partial<Matter> = {}): Matter => ({
  id: "m-b",
  firmId: "firm-1",
  referenceNumber: "R-22",
  title: "Okoro v. Eze",
  type: MatterType.CivilLitigation,
  clientId: "c-1",
  court: "High Court",
  judicialDivision: "Lagos",
  stage: "Hearing",
  stageLastUpdated: "2026-03-01",
  createdAt: "2026-01-01",
  hourlyRate: 0,
  billingModel: BillingModel.Hourly,
  status: MatterStatus.Active,
  assignedUsers: [BOB],
  ...overrides,
});

const makeEvent = (overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: "e-1",
  firmId: "firm-1",
  title: "Court hearing",
  type: "Hearing",
  date: "2026-03-16",
  status: "Active",
  matterId: "m-b",
  ...overrides,
});

describe("stand-in scenario — Alice records Bob's matter outcome", () => {
  const matterB = makeMatter({ id: "m-b", suitNumber: "LD/1234/2024", assignedUsers: [BOB] });
  const bobsOtherMatter = makeMatter({
    id: "m-bob-other",
    title: "Bob v. Zenith Bank PLC",
    suitNumber: "LD/7000/2025",
    assignedUsers: [BOB],
  });
  // Bob ALSO has another hearing 2026-03-16 09:00-10:00 on a different matter.
  const events = [
    // Matter B is in court TODAY — that is why Alice is holding the brief.
    makeEvent({
      id: "e-m-b-today",
      matterId: "m-b",
      title: "Hearing — Okoro v. Eze",
      date: "2026-03-10T09:00:00",
      assignedUsers: [BOB],
    }),
    makeEvent({
      id: "e-bob-other",
      matterId: "m-bob-other",
      title: "Mention — Bob v. Zenith Bank PLC",
      date: "2026-03-16T09:00:00",
      endDate: "2026-03-16T10:00:00",
      assignedUsers: [BOB],
    }),
  ];
  const matters = [matterB, bobsOtherMatter];
  const notes: NotePage[] = [];

  it("step 1 — Alice opens the Firm diary, types 'ld1234', and finds Matter B", () => {
    const diary = getCourtDiary(matters, events, notes, {
      viewerId: ALICE,
      scope: "firm",
      userNames: USER_NAMES,
      today: TODAY,
    });
    const filtered = filterDiary(diary, "ld1234");
    const entries = filtered.groups.flatMap((group) => group.entries);
    expect(entries.map((entry) => entry.matterId)).toEqual(["m-b"]);
    expect(entries[0].isMine).toBe(false);
  });

  it("step 2 — the endorsement text detects the next date with the time", () => {
    const detected = detectNextDate("Adjourned to 16th March 2026 at 9:30am for hearing.", new Date(2026, 2, 10));
    expect(detected?.dateISO).toBe("2026-03-16");
    expect(detected?.timeHHmm).toBe("09:30");
  });

  it("step 3 — the risk chip names Bob (not 'You'), with a real overlap", () => {
    const risks = assessNextDate({
      dateISO: "2026-03-16",
      timeHHmm: "09:30",
      matterId: "m-b",
      events,
      matters,
      attendeeIds: matterB.assignedUsers, // who WILL attend — Bob, not the stand-in
      viewerId: ALICE,
      userNames: USER_NAMES,
    });
    const clash = risks.find((risk) => risk.kind === "clash");
    expect(clash).toBeDefined();
    if (clash?.kind === "clash") {
      expect(clash.overlapping).toBe(true);
      expect(clash.forViewer).toBe(false);
      expect(clash.attendeeNames).toEqual(["Bob"]);
      expect(clash.others[0].matterTitle).toBe("Bob v. Zenith Bank PLC");
    }
  });

  it("steps 4-6 — the save sequence writes note → event → matter patch, in order, with the stand-in payloads", async () => {
    const endorsement = "Adjourned to 16th March 2026 at 9:30am for hearing.";
    const detected = detectNextDate(endorsement, new Date(2026, 2, 10));
    expect(detected).not.toBeNull();

    const plan = buildOutcomePlan(
      {
        matterId: "m-b",
        noteType: "endorsement",
        text: endorsement,
        nextDate: {
          dateISO: detected!.dateISO,
          timeHHmm: detected!.timeHHmm,
          purpose: "Hearing",
          source: "detected",
        },
        addToDiary: true,
        setAsMatterNextDate: true,
      },
      {
        matter: matterB,
        events,
        viewerId: ALICE,
        viewerName: "Alice",
        eventTypeNames: ["Meeting", "Hearing", "Mention", "Deadline"],
        nowISO: "2026-03-10T08:00:00.000Z",
      },
    );

    // The mocked actions record the calls in execution order.
    const calls: string[] = [];
    // ROUND 22: the endorsement saves as the standard Nigerian file jacket —
    // never raw verbatim text (appearances from the matter's own fields; the
    // stand-in's name on the line; the body stays the lawyer's own words).
    const expectedJacket = [
      "Date: 10/03/2026",
      "",
      "Appearances:",
      "- Alice for the Claimant",
      "- Defendant absent / unrepresented",
      "",
      "Endorsement:",
      endorsement,
      "",
      "Next Adjourned Date: 16/03/2026 — For Hearing",
    ].join("\n");
    const handleAddMatterNote = async (matterId: string, title: string, content: string, type: string) => {
      calls.push(`note:${matterId}`);
      expect(matterId).toBe("m-b");
      // 2026-11-27 (owner direction): "Endorsement" — never "Court endorsement".
      expect(title).toBe("Endorsement — Okoro v. Eze (brief held by Alice)");
      expect(content).toBe(expectedJacket);
      expect(type).toBe("endorsement");
    };
    const addItem = async (table: string, data: any) => {
      calls.push(`event:${table}`);
      expect(table).toBe("events");
      expect(data.assignedUsers).toEqual(["bob"]); // the next date goes to Bob's diary
      expect(data.matterId).toBe("m-b");
      expect(data.type).toBe("Hearing");
      expect(data.status).toBe("Active");
      expect(String(data.date).slice(0, 10)).toBe("2026-03-16");
    };
    const handleUpdateMatter = async (matter: Matter) => {
      calls.push(`matter:${matter.id}`);
      expect(matter.nextAdjournedDate).toBe("2026-03-16");
    };

    // The composer's save sequence (useOutcomeSave order, mirrored here).
    await handleAddMatterNote(plan.note.matterId, plan.note.title, plan.note.content, plan.note.type);
    if (plan.event) await addItem("events", plan.event);
    if (plan.matterPatch) await handleUpdateMatter({ ...matterB, ...plan.matterPatch });

    expect(calls).toEqual(["note:m-b", "event:events", "matter:m-b"]);
  });

  it("step 7 — back on the briefing, the saved endorsement shows as the LAST ORDER", () => {
    const savedNote: NotePage = {
      id: "n-new",
      firmId: "firm-1",
      // 2026-11-27 (owner direction): "Endorsement" — never "Court endorsement".
      title: "Endorsement — Okoro v. Eze (brief held by Alice)",
      content: "Adjourned to 16th March 2026 at 9:30am for hearing.",
      notebookId: "nb-1",
      parentId: null,
      matterId: "m-b",
      authorId: ALICE,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      order: 0,
      type: "endorsement",
    };
    // The diary event the save sequence wrote (addItem landed).
    const newEvent = makeEvent({
      id: "e-new-date",
      matterId: "m-b",
      title: "Adjourned to 16th March 2026 at 9:30am for hearing.",
      date: "2026-03-16T09:30:00",
      endDate: "2026-03-16T10:30:00",
      assignedUsers: [BOB],
    });
    const diary = getCourtDiary(matters, [...events, newEvent], [savedNote], {
      viewerId: BOB,
      scope: "mine",
      userNames: USER_NAMES,
      today: TODAY,
    });
    const entry = diary.groups.flatMap((group) => group.entries)[0];
    expect(entry.lastOrderSnippet).toContain("Adjourned to 16th March");
    // Bob's diary now carries the new date alongside his other hearing that day.
    const day16 = diary.groups.find((group) => group.key === "2026-03-16");
    expect(day16?.entries.length).toBe(2);
  });

  it("the success toast date label renders the diary day", () => {
    expect(diaryDayLabel("2026-03-16")).toBe("Mon 16 Mar");
  });
});
