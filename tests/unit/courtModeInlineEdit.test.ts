import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

/**
 * ROUND 22 — inline matter/endorsement editing with the institutional audit
 * trail, and the Court Mode calendar's My diary | Firm diary toggle.
 * Source-scan pins (the established style): read the file, pin the wiring, so
 * the audit trail, the visible-Save rule and the diary vocabulary cannot
 * regress silently. The pure jacket/plan behaviour lives in
 * courtModeUtils.test.ts; the pane switcher lives in
 * aloaCourtModeEntry.test.ts.
 */
const read = (rel: string): string => readFileSync(resolve(__dirname, '../..', rel), 'utf-8');

describe('ROUND 22 — inline edits inside Court Mode (audit-trailed)', () => {
  it('both editors exist and stay behind a single visible Save press', () => {
    const endorsement = read('src/components/aloa/court/EndorsementEditor.tsx');
    const nextDate = read('src/components/aloa/court/NextDateEditor.tsx');
    expect(endorsement).toMatch(/>\s*Edit\s*<\/Button>/);
    // 2026-11-28 (owner direction, Round 25): the NEXT DATE affordance says
    // "Edit" when a valid date exists and "Set date" for the clean empty
    // state ("No next date set") — a single button either way.
    expect(nextDate).toContain('{existingDayKey ? "Edit" : "Set date"}');
    for (const source of [endorsement, nextDate]) {
      expect(source).toMatch(/>\s*Save\s*<\/Button>/);
      expect(source).toMatch(/>\s*Cancel\s*<\/Button>/);
      expect(source).not.toMatch(/useEffect\(/); // a save is NEVER effect-driven
    }
  });

  it('the saved endorsement edits through the note table and writes the audit row', () => {
    const hook = read('src/components/aloa/court/useCourtInlineEdit.ts');
    expect(hook).toContain('"notePages"');
    // 2026-11-27 (owner direction): "Endorsement" — never "Court endorsement".
    expect(hook).toContain('"Endorsement"');
    expect(hook).toContain('logActivity("Edited an endorsement", "Matter", matter.id, matter.title, matter.id)');
    // ROUND 23 (owner spec §4): the edit also notifies the matter's attached users.
    expect(hook).toContain('notifyEndorsement({');
    expect(hook).toContain('action: "edited"');
  });

  it('the upcoming matter date moves the real diary event (or the matter flag) with its audit row', () => {
    const hook = read('src/components/aloa/court/useCourtInlineEdit.ts');
    expect(hook).toContain('updateItem("events"');
    expect(hook).toContain('updateItem("matters"');
    expect(hook).toContain('SYNTHESIZED_HEARING_ID_PREFIX');
    expect(hook).toContain('logActivity("Updated the next court date", "Matter", matter.id, matter.title, matter.id)');
    // The moved date keeps its duration and the matter's next-adjourned flag
    // is kept in step when it pointed at the moved hearing.
    expect(hook).toContain('patch.endDate');
    expect(hook).toContain('dayKeyOf(matter.nextAdjournedDate) === dayKeyOf(hearing.date)');
  });

  it('a server rejection keeps the editor open — nothing is silently discarded', () => {
    const endorsement = read('src/components/aloa/court/EndorsementEditor.tsx');
    const nextDate = read('src/components/aloa/court/NextDateEditor.tsx');
    expect(endorsement).toContain('if (saved) setEditing(false)');
    // 2026-11-28 (owner direction, Round 25): the NEXT DATE save also reports
    // the committed date so the diary calendar jumps to it — the editor still
    // closes ONLY on a successful save.
    expect(nextDate).toContain('if (saved) {');
    expect(nextDate).toContain('setEditing(false);');
    const hook = read('src/components/aloa/court/useCourtInlineEdit.ts');
    expect(hook).toContain('return false');
  });

  it('editing stays disabled while dictation is busy (the preserved rule)', () => {
    const endorsement = read('src/components/aloa/court/EndorsementEditor.tsx');
    const nextDate = read('src/components/aloa/court/NextDateEditor.tsx');
    expect(endorsement).toContain('disabled={captureBusy}');
    expect(nextDate).toContain('disabled={captureBusy}');
  });

  it('the LAST ENDORSEMENT block renders the full jacket (the standard structure) and marks edits', () => {
    const endorsement = read('src/components/aloa/court/EndorsementEditor.tsx');
    expect(endorsement).toContain('whitespace-pre-wrap');
    // 2026-11-27 (owner direction): "Last endorsement" — never "Last order".
    expect(endorsement).toContain('Last endorsement');
    expect(endorsement).toContain('· edited');
  });
});

describe('ROUND 22 — the Court Mode calendar diary toggle', () => {
  it('the mini-calendar carries My diary | Firm diary (the diary vocabulary, never the court-published list)', () => {
    const calendar = read('src/components/aloa/court/MiniCalendar.tsx');
    expect(calendar).toContain('{ value: "mine", label: "My diary" }');
    expect(calendar).toContain('{ value: "firm", label: "Firm diary" }');
    expect(calendar).not.toMatch(/cause ?list/i);
  });

  it('My diary is the default; this matter\'s own dates always show; the firm view shows all', () => {
    const calendar = read('src/components/aloa/court/MiniCalendar.tsx');
    expect(calendar).toContain('useState<CalendarDiaryScope>("mine")');
    expect(calendar).toContain('entry.matterId === matterId || entry.attendeeIds.includes(viewerId)');
    expect(calendar).toContain('diaryScope === "firm"');
  });

  it('the briefing feeds the calendar the attendee ids (event assignees, else the matter\'s team)', () => {
    const briefing = read('src/components/aloa/court/MatterBriefing.tsx');
    expect(briefing).toContain('attendeeIds:');
    expect(briefing).toContain('const eventAssignees = event.assignedUsers || []');
    expect(briefing).toContain('eventMatter?.assignedUsers || []');
    expect(briefing).toContain('viewerId={viewerId}');
  });
});

describe('ROUND 22 — the structured endorsement inside the save path', () => {
  it('the composer saves the jacket for endorsements, raw words for plain notes', () => {
    const utils = read('src/components/aloa/courtModeUtils.ts');
    expect(utils).toContain('draft.noteType === "endorsement"');
    expect(utils).toContain('formatEndorsementJacket({ matter, viewerName: ctx.viewerName, bodyText: text, nowISO: ctx.nowISO, nextDate })');
  });

  it('the retry state carries the RAW text (a retry can never re-wrap the jacket)', () => {
    const save = read('src/components/aloa/court/useOutcomeSave.ts');
    expect(save).toContain('text: rawText');
    expect(save).toContain('text: partialFailure.text');
    expect(save).not.toContain('partialFailure.note.content');
  });

  it('the jacket is built only from existing schema fields (no invented facts)', () => {
    const utils = read('src/components/aloa/courtModeUtils.ts');
    expect(utils).toContain('firmRepresentingRole');
    expect(utils).toContain('matter.opposingCounsel');
    expect(utils).toContain('absent / unrepresented');
    expect(utils).toContain('Next Adjourned Date:');
  });
});
