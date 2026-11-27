import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

/**
 * ROUND 24 — ALOA FAB surface, Phase 1 (frame, FAB, navigation) pins.
 * Source-scan contracts in the established style: read the file, pin the
 * wiring, so the one-navigation-model rules cannot regress silently.
 * Every pin EXTENDS coverage; nothing existing is weakened.
 */
const read = (rel: string): string => readFileSync(resolve(__dirname, '../..', rel), 'utf-8');

describe('ROUND 24 §1.1 — one navigation model', () => {
  const panel = read('src/components/aloa/AloaPanel.tsx');

  it('the panel owns exactly one top row in every mode: mark · Ask|Vox|Court · Close', () => {
    expect(panel).toContain("{ value: 'chat', label: 'Ask' }");
    expect(panel).toContain("{ value: 'capture', label: 'Vox' }");
    expect(panel).toContain("{ value: 'court', label: 'Court' }");
    expect(panel).toContain('label="ALOA pane"');
    // Chat included — the segments render regardless of mode.
    expect(panel).not.toContain("? (mode === 'capture' || mode === 'court')");
    expect(panel).not.toContain("mode === 'capture' || mode === 'court' ? (");
  });

  it('pane headers keep only pane-specific actions (no mode-back buttons)', () => {
    const chat = read('src/components/aloa/AloaChat.tsx');
    const vox = read('src/components/quickcapture/QuickCaptureView.tsx');
    const court = read('src/components/aloa/AloaCourtMode.tsx');
    // Chat: no Close, no mic (panel owns both).
    expect(chat).not.toContain('aria-label="Close panel"');
    expect(chat).not.toContain('aria-label="Open Vox mode"');
    expect(chat).not.toContain('onPointerDown={handleClose}');
    // Vox embedded: no `< ALOA` back, no Dashboard exit.
    expect(vox).toContain('{!embedded && compactHeader ? (');
    expect(vox).toContain('{!embedded && (');
    // Court: inner Back only (hidden at the diary root), no X.
    expect(court).toContain('{view !== "diary" ? (');
    expect(court).not.toContain('aria-label="Close Court Mode"');
    expect(court).not.toContain('onBackToChat');
  });

  it('the standalone Vox header keeps working (APK): back + Dashboard remain for non-embedded', () => {
    const vox = read('src/components/quickcapture/QuickCaptureView.tsx');
    expect(vox).toContain('handleBackToAloa');
    expect(vox).toContain('Dashboard');
    expect(vox).toContain('embedded = false');
  });
});

describe('ROUND 24 §1.2 — no accidental loss (busy guard)', () => {
  const panel = read('src/components/aloa/AloaPanel.tsx');

  it('backdrop, Close and Escape all route through the busy-guarded requestClose', () => {
    expect(panel).toContain('onClick={() => void requestClose()}');
    expect(panel).toContain('void requestClose()');
    expect(panel).toContain("if (e.key !== 'Escape') return;");
  });

  it('a live take opens the ConfirmDialog — Keep recording / Stop and close', () => {
    expect(panel).toContain("Stop and keep what you've recorded?");
    expect(panel).toContain("confirmLabel: 'Stop and close'");
    expect(panel).toContain("cancelLabel: 'Keep recording'");
    // Only after the confirm does the stop-and-keep run, then the close.
    expect(panel).toContain('stopAndKeepRef.current?.()');
    expect(panel).toContain('if (!stop) return;');
  });

  it('both busy panes register a stop-and-keep function (segments flush to the on-device queue)', () => {
    const vox = read('src/components/quickcapture/QuickCaptureView.tsx');
    const court = read('src/components/aloa/AloaCourtMode.tsx');
    expect(vox).toContain('registerStopAndKeep?.(qc.phase === "recording" ? () => qc.stopRecording() : null)');
    expect(court).toContain('registerStopAndKeep?.(dictation.recording ? () => dictation.stopDictation() : null)');
  });

  it('segment lock while busy: every other segment disables with the reason text', () => {
    expect(panel).toContain("mode === 'court' && courtBusy ? ['chat', 'capture']");
    expect(panel).toContain("mode === 'capture' && captureBusy ? ['chat', 'court']");
    expect(panel).toContain('disabledReason="Finish or discard the dictation first."');
  });
});

describe('ROUND 24 §1.3/§1.4 — honest mobile frame + close semantics', () => {
  const panel = read('src/components/aloa/AloaPanel.tsx');

  it('the visual-only drag handle is deleted', () => {
    expect(panel).not.toContain('Mobile drag handle');
    expect(panel).not.toContain('w-10 h-1');
  });

  it('safe-area padding lives in ONE place — AloaPanel — not per pane', () => {
    expect(panel).toContain('pt-[max(env(safe-area-inset-top,0px),var(--native-safe-top,0px))]');
    expect(panel).toContain('pb-[max(env(safe-area-inset-bottom,0px),var(--native-safe-bottom,0px))]');
    const vox = read('src/components/quickcapture/QuickCaptureView.tsx');
    expect(vox).toContain('${embedded ? "" : "pt-[max(env(safe-area-inset-top,0px),var(--native-safe-top,0px))]"}');
    expect(vox).toContain('${embedded ? "" : "pb-[max(calc(0.5rem+env(safe-area-inset-bottom,0px)),var(--native-safe-bottom,0px))]"}');
  });

  it('Close uses onClick with a 44px target and label ≥sm; dialog semantics + Tab trap', () => {
    expect(panel).not.toContain('onPointerDown');
    expect(panel).toContain('aria-label="Close"');
    expect(panel).toContain('role="dialog"');
    expect(panel).toContain('aria-modal={isMobile ? true : undefined}');
    expect(panel).toContain('aria-label="ALOA"');
    expect(panel).toContain('useFocusTrap(panelRef, isPanelOpen)');
  });
});

describe('ROUND 24 §1.5 — FAB states', () => {
  const fab = read('src/components/aloa/AloaFAB.tsx');

  it('one accessible name per state, tooltip and aria-label agree, no ®', () => {
    expect(fab).toContain("let accessibleName = `Open ${assistantName}`;");
    expect(fab).toContain('accessibleName = `Unlock ${assistantName}`;');
    expect(fab).toContain('accessibleName = `Open ${assistantName} — recording in progress`;');
    expect(fab).toContain('accessibleName = `${assistantName}, ${criticalCount} alert');
    expect(fab).toContain('<Tooltip text={accessibleName}>');
    expect(fab).toContain('aria-label={accessibleName}');
    expect(fab).not.toContain('®');
  });

  it('critical-insight count dot: same query as the chat empty state, red only for critical, hidden at 0', () => {
    expect(fab).toContain('api.proactive.getInsights');
    expect(fab).toContain("i.severity === 'critical'");
    expect(fab).toContain('isAiActive && criticalCount > 0');
    expect(fab).not.toContain("i.severity === 'warning'");
  });

  it('the red recording pulse honours prefers-reduced-motion (static ring instead)', () => {
    expect(fab).toContain('motion-safe:animate-pulse');
    expect(fab).not.toMatch(/(?<!motion-safe:)animate-pulse/);
  });

  it('the three-way handleClick gate and the amber lock badge are unchanged', () => {
    expect(fab).toContain("if (!isAiActive) {");
    expect(fab).toContain("openModal('upgradePlan', null, { featureName:");
    expect(fab).toContain("localStorage.getItem('practicepro_ai_consent') === 'true'");
    expect(fab).toContain('!isAiActive && (');
  });
});

describe('ROUND 24 — DEFERRED quick-note surfaces stay in place', () => {
  it('every DEFERRED(quick-note-removal) marker is present with its surface', () => {
    const chat = read('src/components/aloa/AloaChat.tsx');
    const markers = chat.match(/DEFERRED\(quick-note-removal\)/g) || [];
    expect(markers.length).toBeGreaterThanOrEqual(4);
    // The surfaces they guard are still functionally intact.
    expect(chat).toContain("activeView === 'form' || activeView === 'details'");
    expect(chat).toContain("<SaveToNoteForm");
    expect(chat).toContain("<NoteDetails");
    expect(chat).toContain('Archived Notes</h3>');
    // The quick-note MODE stays gone (ROUND 23) — only the deferred
    // form/details render branches remain.
    expect(chat).not.toContain("'quickNote'");
  });
});
