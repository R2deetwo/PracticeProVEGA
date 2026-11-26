import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

/**
 * ROUND 21 — the owner's multi-part directive, pinned:
 *
 *   1. Court Mode: the draft survives a picked date without text (the
 *      "stuck on DD/MM/YYYY" report); the purpose list is the full
 *      Nigerian set; "Other" carries custom text; a purpose-only draft
 *      records the note and leaves the matter in Needs a New Date.
 *   2. The matter-scoped mini-calendar mounts only in the matter view and
 *      uses ui primitives (no raw <button> — the ratchet).
 *   3. The New Matter / Edit Matter modals: deep-linked accordion routing
 *      (focusSection opens the exact section, scrolls, focuses); no
 *      Auto/Unlock buttons; the title never disabled.
 *   4. Commercial / specialist High Court divisions in CourtType.
 *   5. The sidebar Vox pill stays removed.
 *   6. The WhatsApp template sync re-verifies REJECTED rows through the
 *      authoritative single-template GET (visitor_pass was approved by
 *      Meta while the bulk listing still read REJECTED).
 */
const here = __dirname;
const read = (rel: string): string => readFileSync(resolve(here, '../..', rel), 'utf-8');

// ─── 1. Court Mode ─────────────────────────────────────────────────────────
describe('Round 21 — Court Mode next-date + endorsements', () => {
  it('the draft store keeps a draft that carries a next date (even with no text yet)', () => {
    const hooks = read('src/components/aloa/court/useCourtDrafts.ts');
    expect(hooks).toContain('const hasNextDate = Boolean(draft && draft.nextDate && draft.nextDate.dateISO);');
    expect(hooks).toContain('if (!draft || (!hasText && !hasNextDate)) {');
  });

  it('the purpose list is the full Nigerian courtroom set, "Other" last', () => {
    const utils = read('src/components/aloa/courtModeUtils.ts');
    for (const purpose of [
      'Mention', 'Hearing', 'Hearing of Motion', 'Adoption of Written Addresses',
      'Trial / Continuation of Trial', 'Ruling', 'Judgment', 'Report of Settlement', 'Other',
    ]) {
      expect(utils).toContain(`"${purpose}"`);
    }
    const composer = read('src/components/aloa/court/NextDateSection.tsx');
    expect(composer).toContain('HEARING_PURPOSES.map');
    // "Other" reveals the custom text input that rides on the save plan.
    expect(composer).toContain('Specify purpose');
    expect(composer).toContain('purposeOther');
  });

  it('a purpose-only draft (empty dateISO) persists and records the note only', () => {
    const plan = read('src/components/aloa/courtModeUtils.ts');
    expect(plan).toContain('if (!nextDate.dateISO) {');
    expect(plan).toContain('skipReasons: ["date_not_set"]');
  });

  it('the diary keeps all three views and states the My → Firm sync explicitly', () => {
    const diary = read('src/components/aloa/court/DiaryView.tsx');
    expect(diary).toContain('"My diary"');
    expect(diary).toContain('"Firm diary"');
    expect(diary).toContain('Needs a new date');
    expect(diary).toContain('What you record lands in the firm diary too — no double entry.');
  });
});

// ─── 2. The matter-scoped mini-calendar ────────────────────────────────────
describe('Round 21 — the matter-scoped mini-calendar', () => {
  it('mounts inside the matter view only (MatterBriefing), never the diary list', () => {
    const briefing = read('src/components/aloa/court/MatterBriefing.tsx');
    expect(briefing).toContain('<MiniCalendar');
    const diary = read('src/components/aloa/court/DiaryView.tsx');
    expect(diary).not.toContain('MiniCalendar');
  });

  it('uses ui primitives only (no raw button/input/select/textarea) and no bare variant', () => {
    const mini = read('src/components/aloa/court/MiniCalendar.tsx');
    expect(mini).not.toMatch(/<button[\s>]/);
    expect(mini).not.toMatch(/<input[\s>]/);
    expect(mini).not.toMatch(/<select[\s>]/);
    expect(mini).not.toContain('variant="bare"');
    // the clash surface: dots mark this matter's dates AND other matters'.
    expect(mini).toContain('entry.matterId !== matterId');
    // the flip-to-inspect day agenda + the pick-into-the-flow affordance.
    expect(mini).toContain('Use as next date');
  });

  it('a picked date pipes into the outcome flow keeping any chosen purpose', () => {
    const container = read('src/components/aloa/AloaCourtMode.tsx');
    expect(container).toContain('onUseDate={(dateISO)');
    expect(container).toContain('purpose: base?.purpose ?? "Hearing"');
    expect(container).toContain('setView("compose")');
  });
});

// ─── 3. The matter modals ─────────────────────────────────────────────────
describe('Round 21 — New Matter / Edit Matter modals', () => {
  it('SmartMatterModal routes a focusSection onto the exact accordion and scrolls to it', () => {
    const modal = read('src/components/forms/SmartMatterModal.tsx');
    expect(modal).toContain("openModal('newMatter', null, { focusSection: 'court' })");
    expect(modal).toContain("const focusSection: string | undefined = workflowContext?.focusSection ||");
    expect(modal).toContain("carriedCourtFields");
    expect(modal).toContain("court: 'process', parties: 'process'");
    expect(modal).toContain("initial[focusTarget] = true;");
    expect(modal).toContain('data-section-id');
    expect(modal).toContain('document.querySelector(`[data-section-id="${target}"]`)');
    expect(modal).toContain("header?.focus({ preventScroll: true })");
    // Round 21 workflow prefill: routed entries arrive pre-filled, past the
    // type picker.
    expect(modal).toContain('if (knownType) { setMatterType(knownType.type); setStep(1); }');
    expect(modal).toContain("if (typeof fields.court === 'string' && fields.court) setCourt(fields.court);");
  });

  it('MatterForm carries the same deep-link contract', () => {
    const form = read('src/components/forms/MatterForm.tsx');
    expect(form).toContain("const focusSection = (initialContext as { focusSection?: string } | null | undefined)?.focusSection;");
    expect(form).toContain("court: 'litigation', parties: 'litigation'");
    expect(form).toContain('document.querySelector(`[data-section-id="${focusTarget}"]`)');
    expect(form).toContain("header?.focus({ preventScroll: true })");
  });

  it('the Auto/Unlock buttons are gone and the title field is never disabled', () => {
    const form = read('src/components/forms/MatterForm.tsx');
    expect(form).not.toContain("'Unlock' : 'Auto'");
    expect(form).not.toContain('disabled={isLitigation && titleAutoGenerated}');
    // an edit falls back to the matter's own title — no false "required" prompt.
    expect(form).toContain("const effectiveTitle = title.trim() || (isEditing && matterToEdit ? matterToEdit.title : '');");
  });

  it('litigation parties suggest from contacts without blocking manual entry', () => {
    const form = read('src/components/forms/MatterForm.tsx');
    expect(form).toContain('list="matter-party-suggestions"');
    expect(form).toContain('matter-party-suggestions');
  });
});

// ─── 4. Commercial / specialist High Court divisions ───────────────────────
describe('Round 21 — Commercial High Court support', () => {
  it('CourtType carries both Commercial Division values', () => {
    const types = read('src/types.ts');
    expect(types).toContain("StateHighCourtCommercialDivision = 'State High Court (Commercial Division)'");
    expect(types).toContain("FederalHighCourtCommercialDivision = 'Federal High Court (Commercial Division)'");
  });

  it('the New Matter court picker lists them (MatterForm reads the enum directly)', () => {
    const modal = read('src/components/forms/SmartMatterModal.tsx');
    expect(modal).toContain('State High Court (Commercial Division)');
    expect(modal).toContain('Federal High Court (Commercial Division)');
    const form = read('src/components/forms/MatterForm.tsx');
    expect(form).toContain('Object.values(CourtType).map');
  });
});

// ─── 5. The sidebar Vox pill stays gone ────────────────────────────────────
describe('Round 21 — the sidebar stays clean', () => {
  it('the ALOA Vox card never returns to the left rail', () => {
    const sidebar = read('src/components/Sidebar.tsx');
    expect(sidebar).not.toContain('Tap to record — voice to Aloa');
    expect(sidebar).not.toContain("aria-label=\"ALOA Vox — start recording\"");
  });
});

// ─── 6. The WhatsApp template sync re-verifies REJECTED rows ───────────────
describe('Round 21 — WhatsApp template sync (visitor_pass)', () => {
  it('the sync re-checks every REJECTED row through the single-template GET before writing', () => {
    const sync = read('convex/whatsappTemplates.ts');
    expect(sync).toContain('ROUND 21 (visitor_pass): Meta\'s BULK listing can lag');
    expect(sync).toContain('String(template.status).toUpperCase() !== "REJECTED"');
    expect(sync).toContain('message_templates?name=${encodeURIComponent(template.name)}');
    expect(sync).toContain('Object.assign(template, confirmed);');
  });

  it('the sync RECOVERS known template names the bulk listing omitted (the reclassified-template hole)', () => {
    const sync = read('convex/whatsappTemplates.ts');
    expect(sync).toContain('ROUND 21 (visitor_pass, part 2)');
    expect(sync).toContain('const listed = new Set(templates.map((t) => t.name.toLowerCase()));');
    expect(sync).toContain('if (recovered) templates.push(recovered);');
  });

  it('the template-ops workflow exposes inspect / resubmit / resync / state', () => {
    const wf = read('.github/workflows/whatsapp-template-ops.yml');
    expect(wf).toContain('internal.whatsappTemplates.createVegaTemplates');
    expect(wf).toContain('internal.whatsappTemplates.syncAllFirms');
    expect(wf).toContain('internal.whatsappDiagnostics.dumpWhatsAppState');
    expect(wf).toContain("secrets.CONVEX_DEPLOY_KEY");
  });
});
