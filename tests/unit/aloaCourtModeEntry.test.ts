import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

/**
 * Round 19 — the Court Mode entry + plumbing contract (source-scan pins,
 * the same style as aloaVoxDesktopEntry.test.ts: read the file, pin the
 * wiring, so the deep-link path and the preserved guards cannot regress
 * silently). These EXTEND the existing AloaPanel/Provider coverage —
 * nothing existing is weakened.
 */
const read = (rel: string): string => readFileSync(resolve(__dirname, '../..', rel), 'utf-8');

const COURT_FILES = [
  'src/components/aloa/AloaCourtMode.tsx',
  'src/components/aloa/court/DiaryView.tsx',
  'src/components/aloa/court/DiaryMatterCard.tsx',
  'src/components/aloa/court/MiniCalendar.tsx',
  'src/components/aloa/court/MatterBriefing.tsx',
  'src/components/aloa/court/OutcomeComposer.tsx',
  'src/components/aloa/court/NextDateCard.tsx',
  'src/components/aloa/court/NextDateEditor.tsx',
  'src/components/aloa/court/EndorsementEditor.tsx',
  'src/components/aloa/court/NextDateSection.tsx',
  'src/components/aloa/court/DictationBar.tsx',
  'src/components/aloa/court/DateRiskChips.tsx',
  'src/components/aloa/court/SegmentedToggle.tsx',
  'src/components/aloa/court/BriefingAccordions.tsx',
  'src/components/aloa/court/format.ts',
  'src/components/aloa/court/courtDrafts.ts',
  'src/components/aloa/court/useCourtDrafts.ts',
  'src/components/aloa/court/useCourtDictation.ts',
  'src/components/aloa/court/useCourtModeData.ts',
  'src/components/aloa/court/useCourtInlineEdit.ts',
  'src/components/aloa/court/useOutcomeSave.ts',
  // ROUND 25 (ALOA Vox intelligence overhaul): the composer's new modules.
  'src/components/aloa/court/ComposerNextDate.tsx',
  'src/components/aloa/court/DetectedActionsList.tsx',
  'src/components/aloa/court/DictationReviewPanel.tsx',
  'src/components/aloa/court/useCourtroomActions.ts',
];

describe('ALOA Court Mode — panel deep-link plumbing', () => {
  it('AloaPanelMode includes court and openPanel carries the matter deep-link', () => {
    const provider = read('src/contexts/AloaProvider.tsx');
    expect(provider).toContain("export type AloaPanelMode = 'chat' | 'capture' | 'court'");
    expect(provider).toContain("openPanel: (mode?: AloaPanelMode, opts?: AloaPanelOpenOptions) => void");
    expect(provider).toContain('panelInitialMatterId: string | null');
    expect(provider).toContain("setPanelInitialMatterId(mode === 'court' ? (opts?.matterId ?? null) : null)");
  });

  it('AloaPanel passes the deep-link matter into Court Mode and keeps the reset-to-chat-on-close behaviour', () => {
    const panel = read('src/components/aloa/AloaPanel.tsx');
    expect(panel).toContain('initialMatterId={panelInitialMatterId ?? undefined}');
    expect(panel).toContain("if (!isPanelOpen && wasOpenRef.current) {");
    expect(panel).toContain("setMode('chat')");
    // ROUND 24 (§1.2): the backdrop never DISCARDS a live take — every mode
    // routes through requestClose, which opens the ConfirmDialog while a
    // take is live and only then stops-and-keeps + closes.
    expect(panel).toContain('onClick={() => void requestClose()}');
    expect(panel).toContain("Stop and keep what you've recorded?");
    expect(panel).toContain('registerStopAndKeep');
  });

  it('ROUND 24: the panel owns ONE top row — Ask | Vox | Court — with the busy guards', () => {
    const panel = read('src/components/aloa/AloaPanel.tsx');
    expect(panel).toContain("{ value: 'chat', label: 'Ask' }");
    expect(panel).toContain("{ value: 'capture', label: 'Vox' }");
    expect(panel).toContain("{ value: 'court', label: 'Court' }");
    expect(panel).toContain('label="ALOA pane"');
    expect(panel).toContain('stampVoxUsedAt()');
    // Court Mode is reached via its own segment — no mode-level back wiring.
    expect(panel).not.toContain('onBackToChat');
    // Both panes report a live take; the other segments lock mid-take.
    expect(panel).toContain('onCaptureBusyChange={setCourtBusy}');
    expect(panel).toContain('onCaptureBusyChange={setCaptureBusy}');
    expect(panel).toContain('disabledReason="Finish or discard the dictation first."');
    // §1.3: the visual-only drag handle is GONE.
    expect(panel).not.toContain('w-10 h-1');
    // §1.4: dialog semantics + Tab trap live in the panel.
    expect(panel).toContain('role="dialog"');
    expect(panel).toContain('useFocusTrap');
    expect(panel).not.toContain('onPointerDown={handleClose}');
  });

  it('ROUND 22: both Vox panes report capture busyness (a live take is never silently dropped)', () => {
    const court = read('src/components/aloa/AloaCourtMode.tsx');
    expect(court).toContain('onCaptureBusyChange?: (busy: boolean) => void');
    expect(court).toContain('onCaptureBusyChange?.(dictation.captureBusy)');
    const qcv = read('src/components/quickcapture/QuickCaptureView.tsx');
    expect(qcv).toContain('onCaptureBusyChange?: (busy: boolean) => void');
  });

  it('ROUND 22 → ROUND 24: the chat mic is GONE too — the panel Vox segment owns the voice entry', () => {
    const chat = read('src/components/aloa/AloaChat.tsx');
    expect(chat).not.toContain('onOpenCourtMode');
    expect(chat).not.toContain('Open ALOA Court Mode');
    expect(chat).not.toContain('ScalesIcon');
    // §2.1: the mic was redundant with the new Vox segment — removed.
    expect(chat).not.toContain('icon={MicrophoneIcon}');
    expect(chat).not.toContain('aria-label="Open Vox mode"');
    // The panel top row owns the voice entry:
    const panel = read('src/components/aloa/AloaPanel.tsx');
    expect(panel).toContain("{ value: 'capture', label: 'Vox' }");
  });

  it('AloaCourtMode keeps its props (ROUND 24: no mode-level back — inner Back only)', () => {
    const courtMode = read('src/components/aloa/AloaCourtMode.tsx');
    expect(courtMode).not.toContain('onBackToChat');
    expect(courtMode).toContain('onClose: () => void;');
    expect(courtMode).toContain('initialMatterId?: string;');
    // §1.2: the pane registers stop-and-keep for the busy-guard Close.
    expect(courtMode).toContain('registerStopAndKeep?: (fn: (() => Promise<unknown> | void) | null) => void;');
    expect(courtMode).toContain('registerStopAndKeep?.(dictation.recording ? () => dictation.stopDictation() : null)');
    // §1.1: the inner Back navigates within the pane; hidden at the diary root.
    expect(courtMode).toContain('{view !== "diary" ? (');
    // §1.4: the Court header carries no X of its own (panel owns Close).
    expect(courtMode).not.toContain('Close Court Mode');
  });

  it('the Scales entry button in AloaChat is removed — Court Mode nests inside ALOA Vox (Round 22)', () => {
    const chat = read('src/components/aloa/AloaChat.tsx');
    expect(chat).not.toContain('!isProperty && onOpenCourtMode');
    expect(chat).not.toContain('title="Open ALOA Court Mode"');
  });
});

describe('ALOA Court Mode — entry points', () => {
  it('MatterDetailView opens Court Mode for qualifying matters via the diary qualifier', () => {
    const view = read('src/components/details/MatterDetailView.tsx');
    expect(view).toContain("import { getCourtModeMatters } from '../aloa/courtModeUtils'");
    expect(view).toContain("getCourtModeMatters([matterData as Matter], events).length > 0");
    expect(view).toContain("openPanel('court', { matterId: matterData.id })");
    expect(view).toContain('!isProperty && qualifiesForCourtMode');
  });

  it('EventDetailModal offers Open in Court Mode for court-type events on a matter', () => {
    const modal = read('src/components/details/EventDetailModal.tsx');
    expect(modal).toContain("import { isCourtCalendarEvent } from '../aloa/courtModeUtils'");
    expect(modal).toContain('!isProperty && Boolean(event.matterId) && isCourtCalendarEvent(event)');
    expect(modal).toContain("openPanel('court', { matterId: event.matterId as string })");
    expect(modal).toContain('Open in Court Mode');
  });
});

describe('ALOA Court Mode — guards, privacy and hygiene', () => {
  it('the privacy filter is applied before anything reaches the diary or the clash scan', () => {
    const data = read('src/components/aloa/court/useCourtModeData.ts');
    expect(data).toContain('canSeeMatter(matter, viewerId)');
    const utils = read('src/components/aloa/courtModeUtils.ts');
    expect(utils).toContain('(matter as { isPrivate?: boolean }).isPrivate');
  });

  it('draft persistence uses the courtmode:v1: sessionStorage keys and the logout purge clears them', () => {
    const drafts = read('src/components/aloa/court/useCourtDrafts.ts');
    expect(drafts).toContain('"courtmode:v1:drafts:"');
    expect(drafts).toContain('"courtmode:v1:scope:"');
    const auth = read('src/contexts/AuthContext.tsx');
    expect(auth).toContain("k.startsWith('courtmode:v1:')");
  });

  it('the leave guard and discard path stay (dictation is never silently lost)', () => {
    const dictation = read('src/components/aloa/court/useCourtDictation.ts');
    expect(dictation).toContain('mergeLiveTranscriptDraft');
    expect(dictation).toContain('Queued dictation discarded.');
    expect(dictation).toContain('Wait for transcription to finish before leaving, or discard the queued capture.');
    expect(dictation).toContain('stampVoxUsedAt()');
  });

  it('the dictation bar announces politely and reports errors as alerts', () => {
    const bar = read('src/components/aloa/court/DictationBar.tsx');
    expect(bar).toContain('aria-live="polite"');
    expect(bar).toContain('role="alert"');
    expect(bar).toContain("Saved on this device; will transcribe when you&apos;re back online");
    expect(bar).toContain('Transcribing audio…');
    expect(bar).toContain('Transcript ready to review');
    expect(bar).toContain('This browser does not support audio recording.');
    expect(bar).toContain('Discard dictation and leave');
  });

  it.each(COURT_FILES.filter((f) => !f.endsWith('AloaCourtMode.tsx')))('%s uses ui primitives only (no bare/raw)', (rel) => {
    const source = read(rel);
    expect(source).not.toMatch(/<button[\s>]/);
    expect(source).not.toMatch(/<input[\s>]/);
    expect(source).not.toMatch(/<select[\s>]/);
    expect(source).not.toMatch(/<textarea[\s>]/);
    expect(source).not.toContain('variant="bare"');
    expect(source).not.toMatch(/gray-\d/);
    expect(source).not.toMatch(/rounded-xl/);
  });

  it('the container stays under the ratchets too', () => {
    const source = read('src/components/aloa/AloaCourtMode.tsx');
    expect(source).not.toContain('variant="bare"');
    expect(source).not.toMatch(/<button[\s>]/);
  });

  it('never uses the court-registry terminology (a DIARY is kept, not the court-published list)', () => {
    for (const rel of [...COURT_FILES, 'src/components/aloa/courtModeUtils.ts', 'src/components/aloa/AloaPanel.tsx']) {
      expect(read(rel)).not.toMatch(/cause ?list/i);
    }
  });

  it('each view file stays under 250 lines', () => {
    for (const rel of COURT_FILES.filter((f) => !f.includes('/AloaCourtMode.tsx'))) {
      const lines = read(rel).split('\n').length - 1;
      expect(lines, `${rel} has ${lines} lines`).toBeLessThan(250);
    }
  });
});
