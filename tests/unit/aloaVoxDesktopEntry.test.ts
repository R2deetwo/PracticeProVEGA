/**
 * Task 92 — ALOA Vox desktop entry + dark-mode uniformity (2026-11-25).
 *
 * Owner context: checking the ADR-0007 work, the owner found (a) the APK
 * has a prominent bottom-nav Vox tab — "a place for recording that uses
 * voice to send a message through to Aloa" — while the desktop had only
 * the small header mic (the 2026-11-20 sidebar-pill removal), and (b) the
 * ALOA panel opened from the FAB in dark mode mixed white surfaces with
 * dark ones (the quickcapture family had no dark: pairs at all).
 *
 * Source-scan contracts (same style as singleAssistantSurface.test.ts):
 *   1. the Sidebar carries the desktop Vox pill with the full entitlement
 *      ladder (Pro+ records; Free/Growth land on the dedicated upsell)
 *   2. the in-panel chat mic wiring (AloaPanel → AloaChat onOpenCapture)
 *      stays intact
 *   3. every quickcapture surface is dark-mode paired — the exact class
 *      regression the owner saw can never silently return
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const here = __dirname;
const repoRoot = existsSync(resolve(here, '../../src/components/Sidebar.tsx'))
  ? resolve(here, '../..')
  : process.cwd();
const read = (p: string) => readFileSync(resolve(repoRoot, p), 'utf8');

describe('ALOA Vox — the desktop recording place (Task 92)', () => {
  const sidebar = read('src/components/Sidebar.tsx');

  it('the Sidebar carries the Vox pill wired to capture mode with haptics + usage stamp', () => {
    // The pill opens the panel directly in Quick Capture mode — the same
    // one-tap recording destination as the APK's bottom-nav Vox tab.
    expect(sidebar).toContain('openAloaPanel(\'capture\')');
    expect(sidebar).toContain('stampVoxUsedAt()');
    expect(sidebar).toContain('useHapticFeedback');
    // It is a ui-primitive Button (ADR-0004) — no raw <button> added.
    expect(sidebar).toContain("import { Button } from './ui/Button'");
    // The pill is a labeled place, not a bare icon.
    expect(sidebar).toContain('ALOA Vox');
    expect(sidebar).toContain('Tap to record — voice to Aloa');
  });

  it('the entitlement ladder mirrors the bottom-nav tab exactly', () => {
    // Pro+ records; Free/Growth see the pill with a lock dot and land on
    // the DEDICATED Vox upgrade card (owner spec 2026-11-20).
    expect(sidebar).toContain('features.canUseVox');
    expect(sidebar).toContain('setShowVoxUpsell(true)');
    expect(sidebar).toContain('<VoxUpsellModal');
    expect(sidebar).toContain('MicrophoneIcon');
    expect(sidebar).toContain('LockClosedIcon');
  });

  it('the in-panel chat mic wiring (voice → send through to Aloa) stays intact', () => {
    const panel = read('src/components/aloa/AloaPanel.tsx');
    const chat = read('src/components/aloa/AloaChat.tsx');
    expect(panel).toContain('onOpenCapture={openCaptureMode}');
    expect(chat).toContain('onOpenCapture?: () => void');
    expect(chat).toContain('icon={MicrophoneIcon}');
  });
});

describe('ALOA Vox — dark-mode uniformity (Task 92)', () => {
  const FAMILY = [
    'src/components/quickcapture/QuickCaptureView.tsx',
    'src/components/quickcapture/LegalPadView.tsx',
    'src/components/quickcapture/VoiceTipsPanel.tsx',
    'src/components/quickcapture/TriageCard.tsx',
    'src/components/quickcapture/SessionCaptureView.tsx',
    'src/components/quickcapture/SessionDetailTabs.tsx',
    'src/components/quickcapture/VoxUpsellModal.tsx',
    'src/components/quickcapture/QuickAskActions.tsx',
  ];

  // Light-only utility tokens that MUST carry a dark: twin on the same
  // line. Opacity-suffixed whites (bg-white/15 glass overlays) are exempt.
  const LIGHT_BG = /\b(?:bg-white|bg-slate-50|bg-slate-100|bg-slate-300)\b(?!\/)/;
  const LIGHT_TEXT = /\btext-slate-[3-9]00\b/;
  const LIGHT_BORDER = /\bborder-slate-[123]00\b/;

  it.each(FAMILY)('%s carries no unpaired light-only surfaces', (f) => {
    const lines = read(f).split('\n');
    for (const [i, line] of lines.entries()) {
      const offenders = [
        LIGHT_BG.test(line) && !/dark:bg-/.test(line),
        LIGHT_TEXT.test(line) && !/dark:text-/.test(line),
        LIGHT_BORDER.test(line) && !/dark:border-/.test(line),
      ].filter(Boolean).length;
      if (offenders > 0) {
        throw new Error(
          `${f}:${i + 1} has a light-only utility without its dark twin:\n    ${line.trim()}`,
        );
      }
    }
  });

  it('the capture shell itself is paired (root + header)', () => {
    const qcv = read('src/components/quickcapture/QuickCaptureView.tsx');
    expect(qcv).toContain('bg-slate-50 dark:bg-zinc-900');
    expect(qcv).toContain('bg-white dark:bg-zinc-900');
  });

  it('the panel shell stays dark-aware around the capture surface', () => {
    const panel = read('src/components/aloa/AloaPanel.tsx');
    expect(panel).toContain('bg-white dark:bg-zinc-950');
  });
});
