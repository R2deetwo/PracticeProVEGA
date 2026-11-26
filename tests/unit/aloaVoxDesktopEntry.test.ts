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

describe('ALOA Vox — the desktop recording place (Task 92 → Round 21 removal)', () => {
  const sidebar = read('src/components/Sidebar.tsx');

  it('the sidebar Vox pill is GONE (owner directive 2026-11-26: the header mic is the voice entry)', () => {
    // ROUND 21, owner directive: "Remove the redundant ALOA Vox card from
    // the left navigation panel — voice recording is already accessible
    // from the microphone control in the top header." The pill, its lock
    // dot, its upsell modal and its usage stamp are all removed; this pin
    // keeps them out so the sidebar can never grow the card back.
    expect(sidebar).not.toContain('Tap to record — voice to Aloa');
    expect(sidebar).not.toContain('ALOA Vox — start recording');
    expect(sidebar).not.toContain('openAloaPanel(\'capture\')');
    expect(sidebar).not.toContain('<VoxUpsellModal');
    expect(sidebar).not.toContain('stampVoxUsedAt');
  });

  it('the header mic remains the desktop voice entry (the removal never touched it)', () => {
    const header = read('src/components/Header.tsx');
    expect(header).toContain('ALOA Vox — start recording');
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
