import { describe, expect, it } from "vitest";
import { BillingModel, CalendarEvent, Matter, MatterStatus, MatterType } from "../../src/types";
import {
  getCourtHearings,
  getCourtModeMatters,
  mergeLiveTranscriptDraft,
} from "../../src/components/aloa/courtModeUtils";

const makeMatter = (overrides: Partial<Matter> = {}): Matter => ({
  id: "matter-1",
  firmId: "firm-1",
  referenceNumber: "REF-1",
  title: "Sample litigation matter",
  type: MatterType.CivilLitigation,
  clientId: "client-1",
  court: "High Court",
  judicialDivision: "Lagos",
  stage: "Hearing",
  stageLastUpdated: "2026-03-01",
  createdAt: "2026-01-01",
  hourlyRate: 0,
  billingModel: BillingModel.Hourly,
  status: MatterStatus.Active,
  assignedUsers: [],
  ...overrides,
});

const makeEvent = (overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: "event-1",
  firmId: "firm-1",
  title: "Court hearing",
  type: "Hearing",
  date: "2026-03-15",
  status: "Active",
  matterId: "matter-1",
  ...overrides,
});

describe("ALOA Court Mode matter and hearing selection", () => {
  it("partitions court dates, omits cancelled and unrelated events, and uses the next adjourned date", () => {
    const matter = makeMatter({ nextAdjournedDate: "2026-03-20" });
    const result = getCourtHearings(matter, [
      makeEvent({ id: "past", date: "2026-03-01", title: "Previous mention" }),
      makeEvent({ id: "next", date: "2026-03-15" }),
      makeEvent({ id: "cancelled", date: "2026-03-18", status: "Cancelled" }),
      makeEvent({ id: "other-matter", matterId: "matter-2", date: "2026-03-12" }),
    ], "2026-03-10");

    expect(result.previousHearing?.id).toBe("past");
    expect(result.upcomingHearings.map(({ date }) => date)).toEqual(["2026-03-15", "2026-03-20"]);
  });

  it("lists active litigation and court matters in next-hearing order, excluding archived matters", () => {
    const result = getCourtModeMatters([
      makeMatter({ id: "later", title: "Later hearing", nextAdjournedDate: "2026-04-20" }),
      makeMatter({ id: "soon", title: "Soon hearing", nextAdjournedDate: "2026-03-12" }),
      makeMatter({ id: "archived", title: "Archived case", status: MatterStatus.Archived }),
      makeMatter({
        id: "property",
        title: "Property file",
        type: MatterType.RealEstate,
        court: "",
      }),
    ], [], "2026-03-10");

    expect(result.map(({ matter }) => matter.id)).toEqual(["soon", "later"]);
  });
});

describe("ALOA Court Mode live endorsement draft", () => {
  it("replaces the automatic transcript as it grows without duplicating earlier words", () => {
    const first = mergeLiveTranscriptDraft("", "", "", "The matter was called", false);
    const second = mergeLiveTranscriptDraft(first.draft, "", first.previousTranscript, "The matter was called and adjourned", false);

    expect(second.draft).toBe("The matter was called and adjourned");
  });

  it("appends new transcript to manual edits instead of overwriting them", () => {
    const result = mergeLiveTranscriptDraft(
      "The matter was called.\n\nCounsel appeared",
      "",
      "The matter was called",
      "The matter was called and adjourned",
      true,
    );

    expect(result.draft).toBe("The matter was called.\n\nCounsel appeared\n\nand adjourned");
  });
});
