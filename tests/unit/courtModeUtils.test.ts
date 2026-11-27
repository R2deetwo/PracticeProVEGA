import { describe, expect, it } from "vitest";
import { BillingModel, CalendarEvent, Matter, MatterStatus, MatterType, NotePage } from "../../src/types";
import {
  assessNextDate,
  buildOutcomePlan,
  canSeeMatter,
  detectNextDate,
  endorsementBodyOf,
  endorsementCounselOf,
  endorsementOrderMs,
  endorsementSittingDayKey,
  expandCourtEvents,
  filterDiary,
  formatEndorsementJacket,
  getCourtDiary,
  isRecurringInstanceId,
  pickLastEndorsement,
  stripDictationFiller,
} from "../../src/components/aloa/courtModeUtils";
import { parseDrafts, serializeDrafts } from "../../src/components/aloa/court/courtDrafts";

// Fixtures (verified): 2026-03-10 Tue, 2026-03-14 Sat, 2026-03-15 Sun,
// 2026-03-16 Mon, 2026-10-01 Thu = Independence Day. Users: alice (viewer), bob.
const TODAY = "2026-03-10";
const ALICE = "alice";
const BOB = "bob";
const USER_NAMES: Record<string, string> = { alice: "Alice", bob: "Bob" };

const makeMatter = (overrides: Partial<Matter> = {}): Matter => ({
  id: "m-1",
  firmId: "firm-1",
  referenceNumber: "REF-1",
  title: "Matter one",
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
  assignedUsers: [ALICE],
  ...overrides,
});

const makeEvent = (overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: "e-1",
  firmId: "firm-1",
  title: "Court hearing",
  type: "Hearing",
  date: "2026-03-15",
  status: "Active",
  matterId: "m-1",
  ...overrides,
});

const makeNote = (overrides: Partial<NotePage> = {}): NotePage => ({
  id: "n-1",
  firmId: "firm-1",
  // 2026-11-27 (owner direction): "Endorsement" — never "Court endorsement".
  title: "Endorsement — Matter one",
  content: "Adjourned for hearing.",
  notebookId: "nb-1",
  parentId: null,
  matterId: "m-1",
  authorId: ALICE,
  createdAt: "2026-03-01T10:00:00",
  updatedAt: "2026-03-01T10:00:00",
  order: 0,
  type: "endorsement",
  ...overrides,
});

describe("canSeeMatter (privacy defence-in-depth)", () => {
  it("hides a private matter the viewer is not assigned to, in every other case shows it", () => {
    expect(canSeeMatter(makeMatter({ isPrivate: true } as Partial<Matter>), ALICE)).toBe(true);
    expect(canSeeMatter(makeMatter({ isPrivate: true } as Partial<Matter>), BOB)).toBe(false);
    expect(canSeeMatter(makeMatter({ isPrivate: false } as Partial<Matter>), BOB)).toBe(true);
    expect(canSeeMatter(makeMatter(), BOB)).toBe(true);
  });
});

describe("getCourtDiary", () => {
  const notes = [
    makeNote({ id: "n-old", matterId: "m-later", createdAt: "2026-03-01T10:00:00", content: "Matter called up and stood down." }),
    makeNote({ id: "n-new", matterId: "m-later", createdAt: "2026-03-09T10:00:00", content: "Adjourned to 10 March for hearing of the originating motion." }),
  ];

  it("scope 'mine' excludes a matter assigned to bob only; scope 'firm' includes it with lawyerNames ['Bob'] and isMine false", () => {
    const matters = [makeMatter({ id: "m-bob", title: "Bob's case", suitNumber: "LD/1234/2024", assignedUsers: [BOB] })];
    const events = [makeEvent({ id: "e-bob", matterId: "m-bob", date: "2026-03-11T09:00:00", assignedUsers: [BOB] })];

    const mine = getCourtDiary(matters, events, notes, { viewerId: ALICE, scope: "mine", userNames: USER_NAMES, today: TODAY });
    expect(mine.groups).toHaveLength(0);
    expect([...mine.needsNewDate, ...mine.noDate]).toHaveLength(0);

    const firm = getCourtDiary(matters, events, notes, { viewerId: ALICE, scope: "firm", userNames: USER_NAMES, today: TODAY });
    const entries = firm.groups.flatMap((group) => group.entries);
    expect(entries).toHaveLength(1);
    expect(entries[0].lawyerNames).toEqual(["Bob"]);
    expect(entries[0].isMine).toBe(false);
  });

  it("a private matter not assigned to the viewer is excluded from BOTH scopes", () => {
    const matters = [
      makeMatter({ id: "m-private", title: "Hidden case", isPrivate: true, assignedUsers: [BOB] } as Partial<Matter>),
    ];
    const events = [makeEvent({ id: "e-private", matterId: "m-private", date: "2026-03-11", assignedUsers: [BOB] })];

    for (const scope of ["mine", "firm"] as const) {
      const diary = getCourtDiary(matters, events, notes, { viewerId: ALICE, scope, userNames: USER_NAMES, today: TODAY });
      expect(diary.groups).toHaveLength(0);
      expect(diary.noDate).toHaveLength(0);
      expect(diary.needsNewDate).toHaveLength(0);
    }
  });

  it("groups by day with labels, sorts entries by time (untimed last), and synthesizes an untimed next-adjourned date", () => {
    const matters = [
      makeMatter({ id: "m-today", title: "Today's case", suitNumber: "LD/1234/2024" }),
      makeMatter({ id: "m-untimed", title: "Untimed case" }),
      makeMatter({ id: "m-later", title: "Later case", assignedUsers: [BOB] }),
      makeMatter({ id: "m-synth", title: "Synth case", nextAdjournedDate: "2026-03-12" }),
    ];
    const events = [
      makeEvent({ id: "e-9", matterId: "m-today", date: "2026-03-10T09:00:00", title: "Mention at 9" }),
      makeEvent({ id: "e-14", matterId: "m-today", date: "2026-03-10T14:00:00", title: "Hearing at 2" }),
      makeEvent({ id: "e-untimed", matterId: "m-untimed", date: "2026-03-10", title: "Untimed mention" }),
      makeEvent({ id: "e-tomorrow", matterId: "m-today", date: "2026-03-11T11:00:00", title: "Tomorrow hearing" }),
      makeEvent({ id: "e-later", matterId: "m-later", date: "2026-03-25T09:00:00", title: "Later hearing", assignedUsers: [BOB] }),
    ];
    const diary = getCourtDiary(matters, events, notes, { viewerId: ALICE, scope: "firm", userNames: USER_NAMES, today: TODAY });

    expect(diary.groups.map((group) => group.label)).toEqual(["Today", "Tomorrow", "Thu 12 Mar", "Later"]);
    const todayGroup = diary.groups[0];
    expect(todayGroup.label).toBe("Today");
    expect(todayGroup.entries.map((entry) => entry.timeLabel)).toEqual(["9:00 am", "2:00 pm", null]);
    expect(todayGroup.entries.map((entry) => entry.title)).toEqual(["Mention at 9", "Hearing at 2", "Untimed mention"]);

    const tomorrow = diary.groups[1];
    expect(tomorrow.entries[0].timeLabel).toBe("11:00 am");

    const synth = diary.groups[2].entries[0];
    expect(synth.hearingId.startsWith("matter-next-hearing-")).toBe(true);
    expect(synth.timeLabel).toBeNull();

    const later = diary.groups[3];
    expect(later.label).toBe("Later");
    expect(later.entries[0].lastOrderSnippet).toContain("Adjourned to 10 March");
  });

  it("routes matters with only a past hearing to needsNewDate and matters with no hearing to noDate", () => {
    const matters = [
      makeMatter({ id: "m-past-only", title: "Past only" }),
      makeMatter({ id: "m-none", title: "No hearing at all" }),
    ];
    const events = [makeEvent({ id: "e-past", matterId: "m-past-only", date: "2026-03-01T09:00:00" })];
    const diary = getCourtDiary(matters, events, notes, { viewerId: ALICE, scope: "mine", userNames: USER_NAMES, today: TODAY });

    expect(diary.needsNewDate.map(({ matter }) => matter.id)).toEqual(["m-past-only"]);
    expect(diary.noDate.map(({ matter }) => matter.id)).toEqual(["m-none"]);
    expect(diary.groups).toHaveLength(0);
  });
});

describe("filterDiary", () => {
  const matters = [
    makeMatter({ id: "m-bob", title: "Okoro v. Eze", suitNumber: "LD/1234/2024", assignedUsers: [BOB] }),
    makeMatter({ id: "m-alice", title: "Alice v. State", suitNumber: "LD/5678/2024", assignedUsers: [ALICE] }),
  ];
  const events = [
    makeEvent({ id: "e-bob", matterId: "m-bob", date: "2026-03-11T09:00:00", assignedUsers: [BOB] }),
    makeEvent({ id: "e-alice", matterId: "m-alice", date: "2026-03-12T09:00:00", assignedUsers: [ALICE] }),
  ];
  const diary = getCourtDiary(matters, events, [], { viewerId: ALICE, scope: "firm", userNames: USER_NAMES, today: TODAY });

  it("matches suit numbers ignoring non-alphanumerics", () => {
    const filtered = filterDiary(diary, "ld1234");
    expect(filtered.groups.flatMap((group) => group.entries).map((entry) => entry.matterId)).toEqual(["m-bob"]);
  });

  it("matches by lawyer name and is case-insensitive", () => {
    const filtered = filterDiary(diary, "bob");
    expect(filtered.groups.flatMap((group) => group.entries).map((entry) => entry.matterId)).toEqual(["m-bob"]);
  });

  it("returns the input unchanged for an empty query and empty groups when nothing matches", () => {
    expect(filterDiary(diary, "   ")).toBe(diary);
    expect(filterDiary(diary, "zzz").groups).toHaveLength(0);
    expect(filterDiary(diary, "zzz").needsNewDate).toHaveLength(0);
  });
});

describe("assessNextDate", () => {
  const bobOtherMatter = makeMatter({ id: "m-bob-other", title: "Bob v. Zenith", assignedUsers: [BOB] });
  const candidateMatter = makeMatter({ id: "m-candidate", title: "Stand-in case" });

  const baseInput = {
    dateISO: "2026-03-16",
    timeHHmm: "09:30" as string | null,
    matterId: "m-candidate",
    matters: [bobOtherMatter, candidateMatter],
    attendeeIds: [BOB],
    viewerId: ALICE,
    userNames: USER_NAMES,
  };

  it("warns on Saturday and Sunday with the weekday", () => {
    expect(assessNextDate({ ...baseInput, dateISO: "2026-03-14", events: [] })).toEqual([
      { kind: "weekend", weekday: "Saturday" },
    ]);
    expect(assessNextDate({ ...baseInput, dateISO: "2026-03-15", events: [] })).toEqual([
      { kind: "weekend", weekday: "Sunday" },
    ]);
  });

  it("returns no risks for a clean Monday", () => {
    expect(assessNextDate({ ...baseInput, events: [] })).toEqual([]);
  });

  it("flags the Independence Day public holiday and honours custom holidays", () => {
    expect(assessNextDate({ ...baseInput, dateISO: "2026-10-01", events: [] })).toEqual([
      { kind: "public_holiday" },
    ]);
    expect(assessNextDate({ ...baseInput, customHolidays: ["2026-03-16"], events: [] })).toEqual([
      { kind: "public_holiday" },
    ]);
  });

  it("detects an overlapping clash for the attendee, naming them (not 'You') when they are not the viewer", () => {
    const events = [
      makeEvent({ id: "e-bob", matterId: "m-bob-other", date: "2026-03-16T09:00:00", endDate: "2026-03-16T10:00:00", assignedUsers: [BOB], title: "Mention — Bob v. Zenith" }),
    ];
    const risks = assessNextDate({ ...baseInput, events, attendeeIds: [BOB] });
    expect(risks).toHaveLength(1);
    const clash = risks[0];
    expect(clash.kind).toBe("clash");
    if (clash.kind === "clash") {
      expect(clash.overlapping).toBe(true);
      expect(clash.forViewer).toBe(false);
      expect(clash.sameDayCount).toBe(1);
      expect(clash.attendeeNames).toEqual(["Bob"]);
      expect(clash.others[0].matterTitle).toBe("Bob v. Zenith");
      expect(clash.others[0].timeLabel).toBe("9:00 am");
    }
  });

  it("does not count an event assigned only to the viewer when the attendee is a colleague", () => {
    const events = [
      makeEvent({ id: "e-alice", matterId: "m-bob-other", date: "2026-03-16T09:00:00", endDate: "2026-03-16T10:00:00", assignedUsers: [ALICE], title: "Alice's event" }),
    ];
    expect(assessNextDate({ ...baseInput, events, attendeeIds: [BOB] })).toEqual([]);
  });

  it("counts a same-day date-only event without marking it overlapping", () => {
    const events = [
      makeEvent({ id: "e-untimed", matterId: "m-bob-other", date: "2026-03-16", assignedUsers: [BOB], title: "Untimed" }),
    ];
    const risks = assessNextDate({ ...baseInput, events, attendeeIds: [BOB] });
    expect(risks).toHaveLength(1);
    const clash = risks[0];
    if (clash.kind === "clash") {
      expect(clash.sameDayCount).toBe(1);
      expect(clash.overlapping).toBe(false);
    }
  });

  it("ignores cancelled and same-matter events, but counts unassigned events", () => {
    expect(
      assessNextDate({
        ...baseInput,
        events: [makeEvent({ id: "e-cancelled", matterId: "m-bob-other", date: "2026-03-16T09:00:00", assignedUsers: [BOB], status: "Cancelled" })],
        attendeeIds: [BOB],
      }),
    ).toEqual([]);

    expect(
      assessNextDate({
        ...baseInput,
        events: [makeEvent({ id: "e-same-matter", matterId: "m-candidate", date: "2026-03-16T09:00:00", assignedUsers: [BOB] })],
        attendeeIds: [BOB],
      }),
    ).toEqual([]);

    const unassigned = assessNextDate({
      ...baseInput,
      events: [makeEvent({ id: "e-unassigned", matterId: "m-bob-other", date: "2026-03-16T13:00:00" })],
      attendeeIds: [BOB],
    });
    expect(unassigned).toHaveLength(1);
    const clash = unassigned[0];
    if (clash.kind === "clash") expect(clash.sameDayCount).toBe(1);
  });
});

describe("pickLastEndorsement", () => {
  it("returns the latest non-archived endorsement, ignoring user notes and archived entries", () => {
    const notes = [
      makeNote({ id: "n-endorse-old", createdAt: "2026-03-01T10:00:00" }),
      makeNote({ id: "n-endorse-new", createdAt: "2026-03-09T10:00:00" }),
      makeNote({ id: "n-user", type: "user", createdAt: "2026-03-10T10:00:00" }),
      makeNote({ id: "n-archived", createdAt: "2026-03-11T10:00:00", archivedAt: 1 }),
      makeNote({ id: "n-other-matter", matterId: "m-other", createdAt: "2026-03-12T10:00:00" }),
    ];
    expect(pickLastEndorsement(notes, "m-1")?.id).toBe("n-endorse-new");
    expect(pickLastEndorsement(notes, "m-none")).toBeNull();
  });
});

describe("buildOutcomePlan", () => {
  const detectedText = "Adjourned to 16th March 2026 at 9:30am for hearing.";
  const now = new Date(2026, 2, 10);
  const detected = detectNextDate(detectedText, now);

  const eventTypeNames = ["Meeting", "Hearing", "Mention", "Deadline", "Consultation", "Judgment"];
  // ROUND 22: date-only nowISO — the jacket's "Date:" line is TZ-stable.
  const planCtx = (matter: Matter, events: CalendarEvent[] = []) => ({
    matter,
    events,
    viewerId: ALICE,
    viewerName: "Alice",
    eventTypeNames,
    nowISO: "2026-03-10",
  });

  const draft = (overrides: Partial<Parameters<typeof buildOutcomePlan>[0]> = {}) => ({
    matterId: "m-own",
    noteType: "endorsement" as const,
    text: detectedText,
    nextDate: {
      dateISO: "2026-03-16",
      timeHHmm: "09:30",
      purpose: "Hearing" as const,
      source: "detected" as const,
    },
    addToDiary: true,
    setAsMatterNextDate: true,
    ...overrides,
  });

  it("detects the next date from the endorsement text", () => {
    expect(detected?.dateISO).toBe("2026-03-16");
    expect(detected?.timeHHmm).toBe("09:30");
    expect(detected?.label).toContain("16 Mar");
  });

  it("ROUND 21: a purpose-only draft (empty dateISO) records the note and nothing else", () => {
    const matter = makeMatter({ id: "m-own", title: "Okoro v. Eze" });
    const plan = buildOutcomePlan(
      draft({ nextDate: { dateISO: "", timeHHmm: null, purpose: "Mention" as const, source: "manual" as const } }),
      { matter, events: [], viewerId: ALICE, viewerName: "Alice", eventTypeNames, nowISO: "2026-03-10T08:00:00.000Z" },
    );
    expect(plan.note.matterId).toBe("m-own");
    expect(plan.event).toBeNull();
    expect(plan.matterPatch).toBeNull();
    expect(plan.skipReasons).toEqual(["date_not_set"]);
  });

  it("ROUND 21: purpose 'Other' coerces the diary event type from the custom text", () => {
    const matter = makeMatter({ id: "m-own", title: "Okoro v. Eze" });
    const plan = buildOutcomePlan(
      draft({
        nextDate: {
          dateISO: "2026-03-16", timeHHmm: "09:30",
          purpose: "Other" as const, purposeOther: "Pre-trial conference",
          source: "manual" as const,
        },
      }),
      {
        matter, events: [], viewerId: ALICE, viewerName: "Alice",
        eventTypeNames: ["Pre-trial conference", "Hearing"],
        nowISO: "2026-03-10T08:00:00.000Z",
      },
    );
    expect(plan.event?.type).toBe("Pre-trial conference");
  });

  it("plans note + event + matter patch for an own matter with both toggles on", () => {
    const matter = makeMatter({ id: "m-own", title: "Okoro v. Eze" });
    const plan = buildOutcomePlan(draft(), planCtx(matter));
    // 2026-11-27 (owner direction): "Endorsement" — never "Court endorsement"
    // (there is no need to say "court" to a lawyer).
    expect(plan.note.title).toBe("Endorsement — Okoro v. Eze");
    expect(plan.note.type).toBe("endorsement");
    // ROUND 22: the endorsement saves as the standard Nigerian file jacket —
    // never raw verbatim text (deterministic; no LLM anywhere).
    expect(plan.note.content).toBe(
      [
        "Date: 10/03/2026",
        "",
        "Appearances:",
        "- Alice for the Claimant",
        "- Defendant absent / unrepresented",
        "",
        "Endorsement:",
        detectedText,
        "",
        "Next Adjourned Date: 16/03/2026 — For Hearing",
      ].join("\n"),
    );
    expect(plan.event).not.toBeNull();
    expect(plan.event?.assignedUsers).toEqual([ALICE]);
    expect((plan.event?.type as string) === "Hearing").toBe(true);
    expect(plan.matterPatch).toEqual({ nextAdjournedDate: "2026-03-16" });
    expect(plan.skipReasons).toEqual([]);
  });

  it("ROUND 22: a plain 'Note' stays the lawyer's raw words (no jacket)", () => {
    const matter = makeMatter({ id: "m-own", title: "Okoro v. Eze" });
    const plan = buildOutcomePlan(draft({ noteType: "user" as const }), planCtx(matter));
    expect(plan.note.type).toBe("user");
    expect(plan.note.content).toBe(detectedText);
  });

  it("marks a colleague's matter with '(brief held by …)' and routes the event to their diary", () => {
    const matter = makeMatter({ id: "m-colleague", title: "Bob's case", assignedUsers: [BOB] });
    const plan = buildOutcomePlan({ ...draft(), matterId: "m-colleague" }, planCtx(matter));
    expect(plan.note.title).toBe("Endorsement — Bob's case (brief held by Alice)");
    expect(plan.event?.assignedUsers).toEqual([BOB]);
    expect(plan.matterPatch).toEqual({ nextAdjournedDate: "2026-03-16" });
  });

  it("refuses a duplicate diary event but keeps the matter patch", () => {
    const matter = makeMatter({ id: "m-dup", title: "Dup case" });
    const events = [makeEvent({ id: "e-existing", matterId: "m-dup", date: "2026-03-16T09:00:00" })];
    const plan = buildOutcomePlan(draft(), planCtx(matter, events));
    expect(plan.event).toBeNull();
    expect(plan.skipReasons).toContain("already_in_diary");
    expect(plan.matterPatch).toEqual({ nextAdjournedDate: "2026-03-16" });
  });

  it("plans a note only when no date is set, and skips the diary when toggled off", () => {
    const matter = makeMatter({ id: "m-own", title: "No date case" });
    const noDate = buildOutcomePlan({ ...draft(), nextDate: null }, planCtx(matter));
    expect(noDate.event).toBeNull();
    expect(noDate.matterPatch).toBeNull();
    expect(noDate.skipReasons).toEqual(["no_date"]);

    const diaryOff = buildOutcomePlan({ ...draft(), addToDiary: false }, planCtx(matter));
    expect(diaryOff.event).toBeNull();
    expect(diaryOff.skipReasons).toContain("diary_off");
    expect(diaryOff.matterPatch).toEqual({ nextAdjournedDate: "2026-03-16" });
  });
});

describe("ROUND 22 — the Nigerian file-jacket endorsement", () => {
  const bodyText = "Matter called up. Counsel moved for an adjournment; granted.";
  const jacketMatter = (overrides: Partial<Matter> = {}) =>
    makeMatter({
      id: "m-j",
      title: "Okoro v. Eze",
      parties: [
        { id: "p-1", name: "Okoro", role: "Claimant" },
        { id: "p-2", name: "Eze", role: "Defendant" },
      ],
      specialtyData: { firmRepresentingRole: "Claimant" },
      ...overrides,
    } as Partial<Matter>);

  const jacket = (overrides: Partial<Parameters<typeof formatEndorsementJacket>[0]> = {}) =>
    formatEndorsementJacket({
      matter: jacketMatter(),
      viewerName: "Alice",
      bodyText,
      nowISO: "2026-03-10",
      nextDate: null,
      ...overrides,
    });

  it("wraps the dictated text in the standard jacket with the next adjourned date", () => {
    expect(
      jacket({
        nextDate: { dateISO: "2026-06-01", timeHHmm: "09:30", purpose: "Hearing", source: "manual" },
      }),
    ).toBe(
      [
        "Date: 10/03/2026",
        "",
        "Appearances:",
        "- Alice for the Claimant",
        "- Defendant absent / unrepresented",
        "",
        "Endorsement:",
        bodyText,
        "",
        "Next Adjourned Date: 01/06/2026 — For Hearing",
      ].join("\n"),
    );
  });

  it("prints opposing counsel when the matter records one", () => {
    expect(
      jacket({
        matter: jacketMatter({ opposingCounsel: "Kunle Ojo, SAN" }),
        nextDate: { dateISO: "2026-06-01", timeHHmm: null, purpose: "Mention", source: "manual" },
      }),
    ).toContain("- Kunle Ojo, SAN for the Defendant");
  });

  it("prints the firm on the defence side against the recorded opposing party role", () => {
    expect(
      jacket({
        matter: jacketMatter({
          specialtyData: { firmRepresentingRole: "Defendant" },
          parties: [{ id: "p-1", name: "Okoro", role: "Claimant" }],
        }),
      }),
    ).toContain("- Alice for the Defendant");
    // The opposing role comes from the actual party on file (Respondent firm
    // against a Petitioner) — and falls back to the standard default.
    expect(
      jacket({
        matter: jacketMatter({
          specialtyData: { firmRepresentingRole: "Respondent" },
          parties: [{ id: "p-1", name: "Okoro", role: "Petitioner" }],
        }),
      }),
    ).toContain("- Petitioner absent / unrepresented");
    expect(
      jacket({
        matter: jacketMatter({ specialtyData: { firmRepresentingRole: "Defendant" } }),
      }),
    ).toContain("- Claimant absent / unrepresented");
  });

  it("omits the Next Adjourned Date line when no date is on record (sine die is the lawyer's call)", () => {
    const content = jacket();
    expect(content).not.toContain("Next Adjourned Date:");
    expect(content.endsWith(bodyText)).toBe(true);
  });

  it("uses the custom purpose text for 'Other'", () => {
    expect(
      jacket({
        nextDate: { dateISO: "2026-06-01", timeHHmm: null, purpose: "Other", purposeOther: "Pre-trial conference", source: "manual" },
      }),
    ).toContain("Next Adjourned Date: 01/06/2026 — For Pre-trial conference");
  });

  it("endorsementBodyOf extracts the body from a jacket and passes legacy raw notes through", () => {
    const content = jacket({
      nextDate: { dateISO: "2026-06-01", timeHHmm: null, purpose: "Hearing", source: "manual" },
    });
    expect(endorsementBodyOf(content)).toBe(bodyText);
    expect(endorsementBodyOf("A legacy raw note.")).toBe("A legacy raw note.");
    expect(endorsementBodyOf("")).toBe("");
  });

  it("the diary snippet shows the BODY of a jacketed endorsement, never the boilerplate", () => {
    const jacketContent = jacket();
    const diary = getCourtDiary(
      [jacketMatter({ id: "m-snippet", nextAdjournedDate: "2026-03-16" })],
      [makeEvent({ id: "e-snippet", matterId: "m-snippet", date: "2026-03-16" })],
      [
        makeNote({ id: "n-j", matterId: "m-snippet", createdAt: "2026-03-10T10:00:00", content: jacketContent }),
      ],
      { viewerId: ALICE, scope: "firm", userNames: {}, today: "2026-03-10" },
    );
    const entry = diary.groups.flatMap((group) => group.entries).find((item) => item.matterId === "m-snippet");
    expect(entry?.lastOrderSnippet).toContain(bodyText.slice(0, 30));
    expect(entry?.lastOrderSnippet).not.toContain("Appearances:");
    expect(entry?.lastOrderSnippet).not.toContain("Date: 10/03/2026");
  });
});

describe("courtDrafts persistence helpers", () => {
  const nowMs = new Date("2026-03-10T10:00:00Z").getTime();
  const fresh = { text: "Adjourned", noteType: "endorsement" as const, nextDate: null, updatedAt: nowMs - 1000 };
  const stale = { ...fresh, updatedAt: nowMs - 8 * 24 * 60 * 60 * 1000 };

  it("drops entries older than 7 days and malformed entries without throwing", () => {
    const raw = JSON.stringify({
      "m-1": fresh,
      "m-2": stale,
      "m-3": { text: "no noteType" },
      "m-4": "a string is not a draft",
    });
    const parsed = parseDrafts(raw, nowMs);
    expect(Object.keys(parsed)).toEqual(["m-1"]);

    expect(parseDrafts("not json at all", nowMs)).toEqual({});
    expect(parseDrafts("[]", nowMs)).toEqual({});
    expect(parseDrafts(null, nowMs)).toEqual({});
  });

  it("round-trips valid drafts through serializeDrafts and re-parses them", () => {
    const blob = serializeDrafts({ "m-1": fresh, "m-9": stale });
    const parsed = parseDrafts(blob, nowMs);
    expect(Object.keys(parsed)).toEqual(["m-1"]);
    expect(parsed["m-1"].text).toBe("Adjourned");
    expect(serializeDrafts({})).toBe("{}");
  });
});

describe("ROUND 21 — Court Mode draft persistence (courtDrafts)", () => {
  it("keeps a draft that carries ONLY a next date (picked before any text)", () => {
    const now = Date.now();
    const stored = serializeDrafts({
      "m-1": {
        text: "",
        noteType: "endorsement",
        nextDate: { dateISO: "2026-12-15", timeHHmm: null, purpose: "Mention", source: "manual" },
        updatedAt: now,
      },
    });
    const parsed = parseDrafts(stored, now);
    expect(parsed["m-1"]?.nextDate?.dateISO).toBe("2026-12-15");
    expect(parsed["m-1"]?.nextDate?.purpose).toBe("Mention");
  });

  it("keeps an empty-dateISO next date (the purpose chosen before the date)", () => {
    const now = Date.now();
    const stored = serializeDrafts({
      "m-1": {
        text: "Adjourned",
        noteType: "endorsement",
        nextDate: { dateISO: "", timeHHmm: null, purpose: "Other", purposeOther: "Pre-trial conference", source: "manual" },
        updatedAt: now,
      },
    });
    const parsed = parseDrafts(stored, now);
    expect(parsed["m-1"]?.nextDate?.dateISO).toBe("");
    expect(parsed["m-1"]?.nextDate?.purposeOther).toBe("Pre-trial conference");
  });

  it("still drops a fully empty draft", () => {
    const now = Date.now();
    const stored = serializeDrafts({
      "m-1": { text: "", noteType: "endorsement", nextDate: null, updatedAt: now },
    });
    expect(parseDrafts(stored, now)["m-1"]).toBeUndefined();
  });
});

// ── ROUND 23 ──────────────────────────────────────────────────────────────

describe("ROUND 23 — stripDictationFiller (filler out, every fact stays)", () => {
  it("strips spoken filler and sentence-initial 'so' while preserving every fact", () => {
    expect(stripDictationFiller("uh, um, the matter was called um and adjourned")).toBe(
      "the matter was called and adjourned",
    );
    expect(stripDictationFiller("So, counsel appeared for the claimant")).toBe(
      "counsel appeared for the claimant",
    );
    expect(stripDictationFiller("erm the court sat at 9am")).toBe("the court sat at 9am");
  });

  it("never touches real words, mid-sentence 'so', dates or figures", () => {
    expect(stripDictationFiller("Thus the sum of N1,000,000 was awarded")).toBe(
      "Thus the sum of N1,000,000 was awarded",
    );
    expect(stripDictationFiller("The matter came up so the court adjourned")).toBe(
      "The matter came up so the court adjourned",
    );
    expect(stripDictationFiller("Adjourned to 16/03/2026 at 9:30am")).toBe(
      "Adjourned to 16/03/2026 at 9:30am",
    );
  });

  it("is idempotent (stripping twice never changes a word)", () => {
    const once = stripDictationFiller("um, so the ruling was adjourned to 12/03/2026");
    expect(stripDictationFiller(once)).toBe(once);
  });
});

describe("ROUND 23 — jacket parsing and chronological ordering", () => {
  const jacket = [
    "Date: 26/11/2026",
    "",
    "Appearances:",
    "- Ada Uzo for the Claimant",
    "- Defendant absent / unrepresented",
    "",
    "Endorsement:",
    "Matter adjourned for hearing.",
  ].join("\n");

  it("reads the sitting date from the jacket's Date line (DD/MM/YYYY → day key)", () => {
    expect(endorsementSittingDayKey(jacket)).toBe("2026-11-26");
    expect(endorsementSittingDayKey("no jacket here")).toBeNull();
  });

  it("reads the recording counsel from the jacket's first Appearances line", () => {
    expect(endorsementCounselOf(jacket)).toBe("Ada Uzo");
    expect(endorsementCounselOf("no appearances")).toBeNull();
  });

  it("orders by the sitting date when present, else the save moment", () => {
    const backdated = { content: jacket, createdAt: "2026-11-27T10:00:00.000Z" };
    const postedToday = { content: "Matter adjourned.", createdAt: "2026-11-26T09:00:00.000Z" };
    // A record POSTED later about an EARLIER sitting sorts earlier.
    expect(endorsementOrderMs(backdated)).toBeLessThan(endorsementOrderMs(postedToday));
  });

  it("pickLastEndorsement keeps the true last sitting on top (backdated insertions slot in between)", () => {
    const notes: NotePage[] = [
      makeNote({ id: "n-old", content: jacket.replace("26/11/2026", "18/11/2026"), createdAt: "2026-11-18T09:00:00.000Z" }),
      makeNote({ id: "n-mid", content: jacket, createdAt: "2026-11-27T15:00:00.000Z" }), // backdated, sitting 26/11
      makeNote({ id: "n-new", content: jacket.replace("26/11/2026", "27/11/2026"), createdAt: "2026-11-19T09:00:00.000Z" }),
    ];
    const last = pickLastEndorsement(notes, "m-1");
    expect(last?.id).toBe("n-new"); // sitting 27/11 beats the later-POSTED 26/11 record
  });
});

describe("ROUND 23 — formatEndorsementJacket strips filler from the body", () => {
  const matter = makeMatter();
  it("the jacket body loses only spoken filler; every fact stays byte-for-byte", () => {
    const jacket = formatEndorsementJacket({
      matter,
      viewerName: "Alice",
      bodyText: "um, so the matter was adjourned to 16/03/2026 for hearing",
      nowISO: "2026-03-10T09:00:00.000Z",
      nextDate: null,
    });
    expect(endorsementBodyOf(jacket)).toBe(
      "the matter was adjourned to 16/03/2026 for hearing",
    );
    expect(jacket).toContain("Date: 10/03/2026");
  });
});

describe("ROUND 23 — recurring diary parity (expandCourtEvents)", () => {
  const recurring: CalendarEvent = {
    ...makeEvent({ id: "ev-recurring", date: "2026-03-01", title: "Weekly mention" }),
    recurrence: { frequency: "weekly" },
  } as CalendarEvent;

  it("materialises recurring instances so the court surfaces match the main calendar", () => {
    const expanded = expandCourtEvents([recurring, makeEvent({ id: "ev-once", date: "2026-03-12" })], "2026-03-10");
    // The non-recurring event stays as-is.
    expect(expanded.filter((e) => e.id === "ev-once")).toHaveLength(1);
    // The recurring anchor is REPLACED by its per-occurrence instances
    // (the same convention the main calendar's expansion uses).
    const instanceIds = expanded.map((e) => e.id).filter((id) => id.startsWith("ev-recurring_"));
    expect(instanceIds.length).toBeGreaterThan(6); // weeks of occurrences ahead
    expect(expanded.filter((e) => e.id === "ev-recurring")).toHaveLength(0);
    expect(new Set(instanceIds).size).toBe(instanceIds.length); // ids stay unique
  });

  it("instance ids follow the ${eventId}_YYYY-MM-DD convention (isRecurringInstanceId)", () => {
    expect(isRecurringInstanceId("ev-recurring_2026-03-17")).toBe(true);
    expect(isRecurringInstanceId("ev-recurring")).toBe(false);
    expect(isRecurringInstanceId("demo-e-6")).toBe(false);
  });

  it("no recurring events — the list is returned unchanged", () => {
    const events = [makeEvent({ id: "a" }), makeEvent({ id: "b" })];
    expect(expandCourtEvents(events, "2026-03-10")).toBe(events);
  });
});
