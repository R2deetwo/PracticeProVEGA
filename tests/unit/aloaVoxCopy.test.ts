import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

/**
 * ROUND 24 §3.8 — the Vox copy pins: user-visible strings in the ALOA/Vox
 * surfaces use "Vox" / "ALOA Vox" only. "QC", "Quick Capture" and
 * "Quick note" are retired user-visible vocabulary (internal identifiers,
 * storage keys and doc comments are explicitly out of scope — no
 * migrations).
 */
const read = (rel: string): string => readFileSync(resolve(__dirname, '../..', rel), 'utf-8');

const FOLDERS = ['src/components/aloa', 'src/components/quickcapture'];
const TSX_FILES = FOLDERS.flatMap((folder) =>
  readdirSync(resolve(__dirname, '../..', folder))
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => `${folder}/${f}`)
);

/** Extract user-visible string literals: JSX text, title=, aria-label=,
 *  placeholder=, alt= (comments stripped first — they never render). */
function userVisibleStrings(source: string): string[] {
  // strip comments before any extraction (they are not user-visible)
  const code = source.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const out: string[] = [];
  for (const m of code.matchAll(/(?:title|aria-label|placeholder|aria-placeholder|aria-describedby|alt)="([^"]*)"/g)) out.push(m[1]);
  for (const m of code.matchAll(/>([^<>{}]+)</g)) {
    const t = m[1].trim();
    if (t) out.push(t);
  }
  for (const m of code.matchAll(/(?:aria-label|title|placeholder)=\{`([^`]*)`\}/g)) out.push(m[1]);
  return out;
}

describe('ROUND 24 §3.8 — Vox vocabulary in user-visible strings', () => {
  it.each(TSX_FILES)('%s carries no retired vocabulary', (rel) => {
    const strings = userVisibleStrings(read(rel));
    for (const s of strings) {
      expect(s, `${rel}: "${s}"`).not.toMatch(/\bQC\b/);
      expect(s, `${rel}: "${s}"`).not.toMatch(/Quick Capture/i);
      expect(s, `${rel}: "${s}"`).not.toMatch(/Quick note/i);
      expect(s, `${rel}: "${s}"`).not.toMatch(/\bWhisper\b/);
    }
  });

  it('the Recent-captures row label is "Note" (never "Quick note")', () => {
    const vox = read('src/components/quickcapture/QuickCaptureView.tsx');
    expect(vox).toContain('{r.kind === "legalpad" ? "Legal Pad" : "Note"}');
    expect(vox).not.toContain('"Quick note"');
  });

  it('internal identifiers keep their legacy spellings (no migrations)', () => {
    const vox = read('src/components/quickcapture/QuickCaptureView.tsx');
    expect(vox).toContain('practicepro_whisper_mode'); // storage key unchanged
    expect(vox).toContain('readWhisperPref'); // function name unchanged
  });
});
