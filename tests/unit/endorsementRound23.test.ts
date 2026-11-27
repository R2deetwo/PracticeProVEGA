import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

/**
 * ROUND 23 — the endorsement refinement round (owner spec 2026-11-27):
 * mode cleanup, the clean Endorsements timeline, itemised formatting,
 * attending-counsel attribution + notifications, and the diary sync.
 * Source-scan pins (the established style): read the file, pin the wiring,
 * so the round's rules cannot regress silently.
 */
const read = (rel: string): string => readFileSync(resolve(__dirname, '../..', rel), 'utf-8');

describe('ROUND 23 §1 — the redundant quick-notes pencil mode and the Endorsement | Note toggle are gone', () => {
  it('AloaChat carries no pencil quick-note mode (Aloa Vox owns voice capture and notes)', () => {
    const chat = read('src/components/aloa/AloaChat.tsx');
    expect(chat).not.toContain('PencilSquareIcon');
    expect(chat).not.toContain("'quickNote'");
    expect(chat).not.toContain('Quick Note mode');
    expect(chat).not.toContain('>New Note<');
    // The chat mic (the Vox hand-off) stays.
    expect(chat).toContain('icon={MicrophoneIcon}');
  });

  it('the provider drops the quickNote view and its content state entirely', () => {
    const provider = read('src/contexts/AloaProvider.tsx');
    expect(provider).not.toContain('quickNote');
    expect(provider).not.toContain('quickNoteContent');
  });

  it('a chat answer still saves to a note — through the shared Save-to-Note modal', () => {
    const chat = read('src/components/aloa/AloaChat.tsx');
    expect(chat).toContain("openModal('saveToNote', null, { content })");
  });

  it('the Record outcome composer records an Endorsement directly — no Endorsement | Note split toggle', () => {
    const composer = read('src/components/aloa/court/OutcomeComposer.tsx');
    expect(composer).not.toContain('SegmentedToggle');
    expect(composer).not.toContain('onNoteTypeChange');
    expect(composer).not.toContain(`{ value: "user", label: "Note" }`);
    expect(composer).toContain('const noteType = "endorsement" as const');
    expect(composer).toContain('Save endorsement');
  });
});

describe('ROUND 23 §2 — the matter Endorsements tab: clean timeline, labels, in-between insertion', () => {
  it('the entry box is hidden by default and opens from the New Endorsement header trigger', () => {
    const tab = read('src/components/details/TeamDiscussionTab.tsx');
    expect(tab).toContain('const [composerOpen, setComposerOpen] = useState(false)');
    expect(tab).toContain('New Endorsement');
    expect(tab).not.toContain('always-open');
  });

  it('the timeline uses the owner vocabulary: Last endorsement / Endorsements / Previous endorsements — never "Last order", never "Court endorsements", no awkward "and notes"', () => {
    const tab = read('src/components/details/TeamDiscussionTab.tsx');
    expect(tab).toContain('Last endorsement ·');
    expect(tab).toContain('Previous endorsements (');
    expect(tab).not.toMatch(/Last order/i);
    expect(tab).not.toMatch(/Court endorsements/i);
    expect(tab).not.toContain('endorsements & notes');

    const editor = read('src/components/aloa/court/EndorsementEditor.tsx');
    expect(editor).toContain('Last endorsement');
    expect(editor).not.toContain('Last order');

    const diary = read('src/components/aloa/court/DiaryView.tsx');
    expect(diary).toContain('Last endorsement:');

    const briefing = read('src/components/aloa/court/BriefingAccordions.tsx');
    expect(briefing).toContain('Previous endorsements (');
    expect(briefing).not.toContain('Earlier endorsements');
  });

  it('each previous endorsement is directly clickable (inspects in place) — not only a generic View-all jump', () => {
    const briefing = read('src/components/aloa/court/BriefingAccordions.tsx');
    expect(briefing).toContain('aria-expanded={open}');
    expect(briefing).toContain('PreviousEndorsementRow');
    expect(briefing).toContain('View all');
  });

  it('chronological order follows the SITTING date — a missed, earlier endorsement inserts in between', () => {
    const tab = read('src/components/details/TeamDiscussionTab.tsx');
    expect(tab).toContain('endorsementOrderMs(b) - endorsementOrderMs(a)');
    expect(tab).toContain('Sitting date');
    expect(tab).toContain('formatEndorsementJacket({');
    const briefing = read('src/components/aloa/court/MatterBriefing.tsx');
    expect(briefing).toContain('endorsementOrderMs(right) - endorsementOrderMs(left)');
  });

  it('the matter tab is labelled Endorsements and the endorsement TYPE survives the save path', () => {
    const view = read('src/components/details/MatterDetailView.tsx');
    expect(view).toContain('<TabButton label="Endorsements"');
    expect(view).toContain('handleAddMatterNote(matterId, title, content, type)');
    expect(view).not.toContain('<TabButton label="Notes"');
  });

  it('plain notes stay DISTINCT from endorsements (never lumped under one label)', () => {
    const tab = read('src/components/details/TeamDiscussionTab.tsx');
    expect(tab).toContain("n.type === 'user'");
    expect(tab).toContain('Notes ({plainNotes.length})');
    const briefing = read('src/components/aloa/court/BriefingAccordions.tsx');
    expect(briefing).toContain('plainNotes');
    expect(briefing).toContain('Notes ({plainNotes.length})');
  });
});

describe('ROUND 23 §3 — clean, itemised formatting and manual editing', () => {
  it('the dictated transcript loses spoken filler as it lands in the composer draft', () => {
    const dictation = read('src/components/aloa/court/useCourtDictation.ts');
    expect(dictation).toContain('stripDictationFiller(merged.draft)');
    // The pinned merge rules themselves stay untouched (the strip is applied AFTER the merge).
    expect(dictation).toContain('mergeLiveTranscriptDraft(');
  });

  it('the Endorsements tab posts the standard file jacket (Date from the sitting date / Appearances / body)', () => {
    const tab = read('src/components/details/TeamDiscussionTab.tsx');
    expect(tab).toContain('nowISO: sittingDate || todayKey()');
    expect(tab).toContain('nextDate: null');
  });

  it('the endorsement record is editable by hand at any time (text and dates in the record itself)', () => {
    const editor = read('src/components/aloa/court/EndorsementEditor.tsx');
    expect(editor).toContain('aria-label="Edit endorsement"');
    const tab = read('src/components/details/TeamDiscussionTab.tsx');
    expect(tab).toContain('Edit the record and its dates directly');
  });
});

describe('ROUND 23 §4 — attending-counsel monikers (never "System") and matter notifications', () => {
  it('notes carry their author — the recording counsel — when created', () => {
    const matters = read('src/hooks/useMatters.ts');
    expect(matters).toContain('authorId: currentUser?.id');
  });

  it('the timeline resolves the attending counsel honestly: authorId, then the jacket Appearances line, then the legacy title — and never falls back to "System"', () => {
    const tab = read('src/components/details/TeamDiscussionTab.tsx');
    expect(tab).toContain('authorNameOf');
    expect(tab).toContain('endorsementCounselOf(note.content');
    // The old fallback rendered "System" as the author name — never again.
    expect(tab).not.toContain("|| 'System'");
    expect(tab).not.toContain('|| "System"');
    expect(tab).not.toContain(`: 'S'`);
  });

  it('a server mutation notifies the matter\u2019s attached users (in-app + push) on create AND edit', () => {
    const convex = read('convex/myFunctions.ts');
    expect(convex).toContain('export const notifyMatterEndorsement = mutation({');
    expect(convex).toContain('requireFirmUser(ctx, undefined, args.sessionToken)');
    expect(convex).toContain('id !== actorId'); // the actor is never their own recipient
    expect(convex).toContain('ctx.db.insert("notifications"');
    expect(convex).toContain('internal.pushNotifications.dispatchPushToUsers');
    expect(convex).toContain("link");
  });

  it('the client hook is best-effort — a notification failure never blocks or alarms a save', () => {
    const hook = read('src/hooks/useEndorsementNotify.ts');
    expect(hook).toContain('api.myFunctions.notifyMatterEndorsement');
    expect(hook).toContain('.catch(() => {');
  });

  it('every endorsement write path fires the notification', () => {
    const save = read('src/components/aloa/court/useOutcomeSave.ts');
    expect(save).toContain('notifyEndorsement({');
    expect(save).toContain('action: "created"');
    const inline = read('src/components/aloa/court/useCourtInlineEdit.ts');
    expect(inline).toContain('action: "edited"');
    const tab = read('src/components/details/TeamDiscussionTab.tsx');
    expect(tab).toContain("action: 'created'");
    expect(tab).toContain("action: 'edited'");
  });

  it('the owner vocabulary holds in the audit row and the save item name', () => {
    const inline = read('src/components/aloa/court/useCourtInlineEdit.ts');
    expect(inline).toContain('"Endorsement"');
    expect(inline).toContain('logActivity("Edited an endorsement"');
    expect(inline).not.toContain('"Court endorsement"');
  });
});

describe('ROUND 23 §5 — diary / calendar sync', () => {
  it('recurring diary items reach the court surfaces (the same expansion the main calendar uses)', () => {
    const data = read('src/components/aloa/court/useCourtModeData.ts');
    expect(data).toContain('expandCourtEvents(events, todayDayKey())');
  });

  it('a picked date scrolls its diary agenda into view', () => {
    const calendar = read('src/components/aloa/court/MiniCalendar.tsx');
    expect(calendar).toContain('scrollIntoView({ behavior: "smooth", block: "nearest" })');
    expect(calendar).toContain('agendaRef');
  });

  it('"No next date recorded." sets the next date DIRECTLY — no round-trip through Record outcome', () => {
    const briefing = read('src/components/aloa/court/MatterBriefing.tsx');
    expect(briefing).toContain('Set next date');
    expect(briefing).toContain('SYNTHESIZED_HEARING_ID_PREFIX');
    expect(briefing).toContain('settingNextDate');
  });

  it('a recurring occurrence is never silently moved (the series is edited on the calendar)', () => {
    const nextDate = read('src/components/aloa/court/NextDateEditor.tsx');
    expect(nextDate).toContain('Recurring diary item — edit the series on the calendar.');
    const inline = read('src/components/aloa/court/useCourtInlineEdit.ts');
    expect(inline).toContain('isRecurringInstanceId(hearing.id)');
  });

  it('the matter\u2019s own diary items dot the date picker even when not court-typed (parity with the main calendar)', () => {
    const briefing = read('src/components/aloa/court/MatterBriefing.tsx');
    expect(briefing).toContain('isCourtCalendarEvent(event) || event.matterId === matter.id');
  });

  it('the one-click + Event carries the matter\u2019s court, division and team (the same wiring as the outcome flow)', () => {
    const tab = read('src/components/details/TeamDiscussionTab.tsx');
    expect(tab).toContain('court: matter?.court');
    expect(tab).toContain('judicialDivision: matter?.judicialDivision');
    expect(tab).toContain('assignedUsers: (matter?.assignedUsers || []).length > 0');
  });
});
