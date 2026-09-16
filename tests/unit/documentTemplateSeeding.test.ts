/**
 * Document Template Seeding — Backlog #3 + #4 contracts
 * =====================================================
 * PART 1 — Library content contracts (every template well-formed, keys
 *          aligned with the practice-profile library, placeholders valid).
 * PART 2 — State-specific variants (#4): state-aware rendering (captions,
 *          rules citations), state-suffixed names, stateOnly gating.
 * PART 3 — Engine contracts: the same additive/idempotent/previewable
 *          guarantees PART 3 of automationRules.test.ts pins for the rest
 *          of the blueprint, extended to documentTemplates +
 *          documentTemplateCategories.
 */

import { describe, it, expect } from 'vitest';
import {
    LEGAL_DOCUMENT_TEMPLATES,
    ATRIUM_DOCUMENT_TEMPLATES,
    getLegalDocumentTemplates,
    getAtriumDocumentTemplates,
    extractPlaceholders,
} from '../../src/config/documentTemplateLibrary';
import { PRACTICE_PROFILES, getProfilesForAreas } from '../../src/config/practiceProfileLibrary';
import { ATRIUM_PROFILES } from '../../src/config/atriumProfileLibrary';
import {
    buildLegalPlan,
    buildAtriumPlan,
    mergePlans,
    appendTemplateItems,
    type PlanItem,
} from '../../src/hooks/usePracticeProfile';
import { getAtriumProfilesForPortfolio } from '../../src/config/atriumProfileLibrary';

const emptyDeps = {
    contactCategories: [],
    documentCategories: [],
    eventTypes: [],
    workflows: [],
    checklistTemplates: [],
    documentTemplates: [],
    documentTemplateCategories: [],
    stateKey: undefined as string | undefined,
};

// ─── PART 1: Library content contracts ──────────────────────────────────────

describe('template library: content contracts', () => {
    it('every LEGAL template key matches a practice-profile area key', () => {
        for (const key of Object.keys(LEGAL_DOCUMENT_TEMPLATES)) {
            expect(PRACTICE_PROFILES[key], `key "${key}" has no matching practice profile`).toBeDefined();
        }
    });

    it('every ATRIUM template key matches a portfolio-type key', () => {
        for (const key of Object.keys(ATRIUM_DOCUMENT_TEMPLATES)) {
            expect(ATRIUM_PROFILES[key], `key "${key}" has no matching Atrium profile`).toBeDefined();
        }
    });

    it('every template is well-formed (name, description, category, substantive content)', () => {
        const all = [
            ...Object.values(LEGAL_DOCUMENT_TEMPLATES).flat(),
            ...Object.values(ATRIUM_DOCUMENT_TEMPLATES).flat(),
        ];
        expect(all.length).toBeGreaterThan(15);
        for (const bp of all) {
            expect(bp.name.trim().length).toBeGreaterThan(3);
            expect(bp.description.trim().length).toBeGreaterThan(10);
            expect(bp.categoryName.trim().length).toBeGreaterThan(3);
            // Content must be substantive (300+ chars) — a real starter draft, not a stub
            expect(bp.content.trim().length).toBeGreaterThan(300);
        }
    });

    it('extractPlaceholders returns bracketed uppercase tokens only', () => {
        const out = extractPlaceholders('Dear [CLIENT NAME], re [MATTER TITLE] — no {{STATE_NAME}} markers.');
        expect(out).toContain('[CLIENT NAME]');
        expect(out).toContain('[MATTER TITLE]');
        expect(out.some((p) => p.includes('{{'))).toBe(false);
    });
});

// ─── PART 2: State-specific variants (Backlog #4) ───────────────────────────

describe('template library: state-specific variants', () => {
    it('renders the firm state court caption + procedural rules into state-aware templates', () => {
        const lagos = getLegalDocumentTemplates(['Civil Litigation'], 'Lagos');
        const delta = getLegalDocumentTemplates(['Civil Litigation'], 'Delta');
        const lagosDemand = lagos.find((t) => t.name.startsWith('Demand Letter'));
        const deltaDemand = delta.find((t) => t.name.startsWith('Demand Letter'));
        expect(lagosDemand).toBeDefined();
        expect(deltaDemand).toBeDefined();
        // Lagos rules citation vs Delta rules citation — same template, different state law
        expect(lagosDemand!.content).toContain('High Court of Lagos State (Civil Procedure) Rules 2019');
        expect(deltaDemand!.content).toContain('Delta State High Court (Civil Procedure) Rules 2021');
        expect(lagosDemand!.content).toContain('IN THE HIGH COURT OF LAGOS STATE');
        expect(deltaDemand!.content).toContain('IN THE HIGH COURT OF DELTA STATE');
    });

    it('bakes the state into the template NAME so a later state change adds, never overwrites', () => {
        const lagos = getLegalDocumentTemplates(['Civil Litigation'], 'Lagos');
        const delta = getLegalDocumentTemplates(['Civil Litigation'], 'Delta');
        expect(lagos.some((t) => t.name.includes('Lagos'))).toBe(true);
        expect(delta.some((t) => t.name.includes('Delta'))).toBe(true);
        // The two states produce distinct names → both can coexist additively
        const lagosNames = new Set(lagos.map((t) => t.name));
        for (const t of delta) expect(lagosNames.has(t.name)).toBe(false);
    });

    it('stateOnly templates are gated to their state (Lagos Pre-Action Protocol)', () => {
        const lagos = getLegalDocumentTemplates(['Civil Litigation'], 'Lagos');
        const delta = getLegalDocumentTemplates(['Civil Litigation'], 'Delta');
        expect(lagos.some((t) => t.name.includes('Pre-Action Protocol'))).toBe(true);
        expect(delta.some((t) => t.name.includes('Pre-Action Protocol'))).toBe(false);
    });

    it('no unresolved {{STATE_*}} markers survive rendering, with or without a state', () => {
        for (const stateKey of ['Lagos', 'Delta', 'FCT', undefined]) {
            const rendered = [
                ...getLegalDocumentTemplates(Object.keys(LEGAL_DOCUMENT_TEMPLATES), stateKey),
                ...getAtriumDocumentTemplates(Object.keys(ATRIUM_DOCUMENT_TEMPLATES), stateKey),
            ];
            for (const t of rendered) {
                expect(t.content.includes('{{'), `${t.name} (${stateKey}) has unresolved markers`).toBe(false);
            }
        }
    });
});

// ─── PART 3: Blueprint engine contracts for template seeding ────────────────

describe('blueprint engine: document template seeding', () => {
    it('a fresh legal plan seeds templates AND ensures their categories (with counts)', () => {
        const plan = buildLegalPlan(getProfilesForAreas(['Civil Litigation']), { ...emptyDeps, stateKey: 'Lagos' });
        const templates = plan.items.filter((i) => i.table === 'documentTemplates');
        const categories = plan.items.filter((i) => i.table === 'documentTemplateCategories');
        expect(templates.length).toBe(3); // demand letter, witness statement, Lagos-only protocol letter
        expect(templates.every((i) => !i.duplicate)).toBe(true);
        expect(plan.counts.documentTemplates).toBe(3);
        // Categories: Correspondence + Affidavits & Exhibits
        const catNames = categories.map((c) => c.label);
        expect(catNames).toContain('Correspondence');
        expect(catNames).toContain('Affidavits & Exhibits');
        // Template payload references its category BY NAME (id resolved at apply)
        for (const t of templates) {
            expect(typeof t.data.categoryName).toBe('string');
            expect(catNames).toContain(t.data.categoryName);
            expect(Array.isArray(t.data.placeholders)).toBe(true);
            expect((t.data.placeholders as string[]).length).toBeGreaterThan(0);
        }
    });

    it('re-running against the now-existing workspace marks templates duplicate (idempotent)', () => {
        const first = buildLegalPlan(getProfilesForAreas(['Civil Litigation']), { ...emptyDeps, stateKey: 'Lagos' });
        const afterDeps = {
            ...emptyDeps,
            stateKey: 'Lagos',
            documentTemplates: first.items
                .filter((i) => i.table === 'documentTemplates')
                .map((i) => ({ id: 'x', name: i.label })),
            documentTemplateCategories: first.items
                .filter((i) => i.table === 'documentTemplateCategories')
                .map((i) => ({ id: 'x', name: i.label })),
        };
        const second = buildLegalPlan(getProfilesForAreas(['Civil Litigation']), afterDeps);
        const secondTemplates = second.items.filter((i) => i.table === 'documentTemplates');
        expect(secondTemplates.length).toBe(3);
        expect(secondTemplates.every((i) => i.duplicate)).toBe(true);
        expect(second.counts.documentTemplates).toBe(0);
        // Categories also not re-planned
        expect(second.items.filter((i) => i.table === 'documentTemplateCategories')).toHaveLength(0);
    });

    it('a state change plans the NEW state variant as an addition (never an overwrite)', () => {
        const first = buildLegalPlan(getProfilesForAreas(['Civil Litigation']), { ...emptyDeps, stateKey: 'Lagos' });
        const afterDelta = {
            ...emptyDeps,
            stateKey: 'Delta',
            documentTemplates: first.items
                .filter((i) => i.table === 'documentTemplates')
                .map((i) => ({ id: 'x', name: i.label })),
            documentTemplateCategories: first.items
                .filter((i) => i.table === 'documentTemplateCategories')
                .map((i) => ({ id: 'x', name: i.label })),
        };
        const second = buildLegalPlan(getProfilesForAreas(['Civil Litigation']), afterDelta);
        // The Lagos-named templates are NOT duplicates of the Delta names → new additions planned
        expect(second.counts.documentTemplates).toBeGreaterThan(0);
        const newTemplates = second.items.filter((i) => i.table === 'documentTemplates' && !i.duplicate);
        expect(newTemplates.every((t) => t.label.includes('Delta'))).toBe(true);
        // ...and the Lagos Pre-Action Protocol (stateOnly) is not planned for Delta
        expect(newTemplates.some((t) => t.label.includes('Pre-Action Protocol'))).toBe(false);
    });

    it('appendTemplateItems does not duplicate categories shared by several templates or already planned', () => {
        const items: PlanItem[] = [];
        const templates = [
            ...getLegalDocumentTemplates(['Civil Litigation', 'Corporate & Commercial'], 'Lagos'),
        ];
        const count = appendTemplateItems(templates, {
            items,
            documentTemplates: [],
            documentTemplateCategories: [],
        });
        expect(count).toBe(templates.length);
        const cats = items.filter((i) => i.table === 'documentTemplateCategories');
        const names = cats.map((c) => c.label);
        expect(new Set(names).size).toBe(names.length); // ensure-once per name
        // Re-append against the now-planned state → zero new writes
        const count2 = appendTemplateItems(templates, {
            items,
            documentTemplates: templates.map((t) => ({ id: 'x', name: t.name })),
            documentTemplateCategories: cats.map((c) => ({ id: 'x', name: c.label })),
        });
        expect(count2).toBe(0);
        expect(items.filter((i) => i.table === 'documentTemplateCategories')).toHaveLength(cats.length);
    });

    it('mergePlans de-duplicates template rows appearing in both legal and portfolio plans', () => {
        const legal = buildLegalPlan(getProfilesForAreas(['Real Estate & Property']), { ...emptyDeps, stateKey: 'Lagos' });
        const atriumPair = getAtriumProfilesForPortfolio(['residential'], []);
        const atrium = buildAtriumPlan(atriumPair.profiles, atriumPair.overlays, { ...emptyDeps, stateKey: 'Lagos' });
        const merged = mergePlans(legal, atrium);
        const keys = merged.items.map((i) => `${i.table}:${i.label.toLowerCase()}`);
        expect(new Set(keys).size).toBe(keys.length); // no duplicate rows
        expect(merged.counts.documentTemplates).toBe(
            merged.items.filter((i) => i.table === 'documentTemplates' && !i.duplicate).length,
        );
    });

    it('atrium portfolio templates seed through the same contracts', () => {
        const pair = getAtriumProfilesForPortfolio(['residential'], []);
        const plan = buildAtriumPlan(pair.profiles, pair.overlays, { ...emptyDeps, stateKey: 'Lagos' });
        const templates = plan.items.filter((i) => i.table === 'documentTemplates');
        expect(templates.length).toBe(3); // tenancy agreement, rent demand, quit notice
        expect(plan.counts.documentTemplates).toBe(3);
        expect(templates.some((t) => t.label.includes('Notice to Quit'))).toBe(true);
        // State-aware quit notice cites the firm's state
        const quit = templates.find((t) => t.label.includes('Notice to Quit'))!;
        expect(String(quit.data.content)).toContain('Lagos');
    });
});
