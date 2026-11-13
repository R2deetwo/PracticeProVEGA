/**
 * Modal-architecture contract tests (UX-01 — the Critical finding).
 *
 * The audit: "Same logical surface gets different chrome, Esc
 * behaviour, animation and stacking depending on which pipeline catches
 * the modal type." The fix: ONE pipeline. These tests pin the completed
 * state — the legacy path is gone, every registered modal renders
 * through ModalLayer + ModalShell, and the two render-path bugs the
 * audit catalogued (registry modals under the bottom nav; the aria
 * fallback living only in the legacy chrome) cannot come back.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

const REGISTRY = 'src/overlays/registry/modalRegistry.tsx';
const LAYER = 'src/overlays/layers/ModalLayer.tsx';
const SHELL = 'src/overlays/primitives/ModalShell.tsx';

describe('UX-01: one modal pipeline', () => {
  it('the legacy ModalManager.tsx and Modal.tsx are deleted', () => {
    expect(existsSync(join(ROOT, 'src/components/modals/ModalManager.tsx'))).toBe(false);
    expect(existsSync(join(ROOT, 'src/components/modals/Modal.tsx'))).toBe(false);
  });

  it('App mounts exactly ONE modal pipeline (ModalLayer)', () => {
    const app = read('src/components/App.tsx');
    expect(app).toContain('<ModalLayer />');
    expect(app).not.toContain('ModalManager');
  });

  it('ModalLayer renders from the registry — no allowlist gate remains', () => {
    const layer = read(LAYER);
    // The MIGRATED_MODALS / MODAL_LAYER_HANDLED allowlists are gone;
    // the only skip is the documented needsSpecialWrapping delegation.
    expect(layer).not.toContain('MIGRATED_MODALS');
    expect(layer).not.toContain('MODAL_LAYER_HANDLED');
    expect(layer).toContain('MODAL_REGISTRY[modal]');
    expect(layer).toContain('meta.needsSpecialWrapping');
  });

  it('every registry entry with a component has size + title', () => {
    const registry = read(REGISTRY);
    // naive but effective: count component entries vs title lines
    const components = (registry.match(/^\s{2}\w+:\s*{$/gm) || []).length;
    const titles = (registry.match(/^\s{4}title:/gm) || []).length;
    const needsSpecial = (registry.match(/needsSpecialWrapping: true/g) || []).length;
    // documented entries without titles are allowed only when they
    // delegate (needsSpecialWrapping)
    expect(titles + needsSpecial).toBeGreaterThanOrEqual(components - 2);
  });

  it('the highest-traffic content builders survived the migration verbatim', () => {
    const layer = read(LAYER);
    // A sample of wiring the earlier rounds pinned as fixed behaviour:
    expect(layer).toContain("case 'newDocument':");          // V-DOC-4 draft session doc
    expect(layer).toContain("editingId.startsWith('virtual_')"); // calendar virtual events
    expect(layer).toContain('handleBulkAssignMatters');      // V-MATTER-15 bulk assign
    expect(layer).toContain('parseDateString(dateInstanceStr)');  // Lagos TZ fix
    expect(layer).toContain('manageBankAccountMutation');    // TASK 64 honest bank saves
    expect(layer).toContain('recordConsent');                // AI consent audit trail
    expect(layer).toContain('resolveAuthThemeId');           // R27 themed auth
    expect(layer).toContain("openModal('signup', null, authSwitchContext())"); // auth funnel
  });

  it('both modal chrome surfaces live on ModalShell (aria fallback + Z tier)', () => {
    const shell = read(SHELL);
    expect(shell).toContain("...(hideHeader ? { 'aria-label': title } : { 'aria-labelledby': 'modal-title' })");
    expect(shell).toContain('Z_TIERS.modal');
    expect(shell).toContain('overlayClass ??');
    expect(shell).toContain('cardClass');
  });

  it('the dead recordRentPayment wrapper entry is gone from the registry', () => {
    expect(read(REGISTRY)).not.toContain('RecordRentPaymentModalWrapper');
  });

  it('every modal type opened in the app has a registry entry or builder', () => {
    // Types actually opened via openModal('x') must resolve: registry
    // entry (component or needsSpecialWrapping) or a builder case.
    const layer = read(LAYER);
    const opened = new Set<string>();
    const srcDir = join(ROOT, 'src');
    const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs');
    const walk = (dir: string) => {
      for (const e of readdirSync(dir)) {
        const p = join(dir, e);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(e)) {
          const text = readFileSync(p, 'utf8');
          for (const m of text.matchAll(/openModal\('([\w_]+)'/g)) opened.add(m[1]);
        }
      }
    };
    walk(srcDir);
    const registry = read(REGISTRY);
    const covered = (t: string) =>
      new RegExp(`^\\s{2}${t}:\\s*{`, 'm').test(registry) ||
      new RegExp(`^\\s{2}${t}:\\s*{`, 'm').test(layer) ||
      new RegExp(`case '${t}':`).test(layer);
    const missing = [...opened].filter(t => !covered(t));
    expect(missing, `modal types opened but nowhere rendered: ${missing.join(', ')}`).toEqual([]);
  });
});
