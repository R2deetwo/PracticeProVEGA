/**
 * V5 — LEGAL AI RELIABILITY AND EVIDENCE INTEGRITY — acceptance suite.
 *
 * One test per honest behaviour this round locked in, across domains A–F:
 *   A citation integrity (no fake verification claims)
 *   B Research Studio (real website sources, gated free-generation, labels)
 *   C Law Reports (honest unavailability, no simulation)
 *   D chronology/matrix/gap + ALDIA metadata (AI-labelled, traceable)
 *   E jurisdiction correctness (no Lagos defaults, advisory limitation)
 *   F AI trust (raw-text confidence, chat/document separation, hedging prompts)
 *
 * Where behaviour is a pure function it is executed directly; where it is a
 * component/prompt/wiring, the source is scanned so a regression (restoring
 * a misleading string or path) fails CI.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Matter, MatterType, MatterStatus, CourtType } from '../../src/types';
import { PROCEDURAL_RULES } from '../../src/utils/proceduralRules';
import { ComplianceEngine } from '../../src/utils/ComplianceEngine';
import { analyzeMatterIntelligence } from '../../src/utils/defenseUtils';
import { TemplateService } from '../../src/utils/TemplateService';
import { getCourtTierInstruction } from '../../src/constants/litigationSkeletons';
import { buildJurisdictionalReasoning } from '../../src/utils/jurisdictionConfig';
import { SCALE_4_REFERENCE } from '../../src/utils/scaleOfCharges';
import { MOCK_CASE_LAW } from '../../src/utils/mockData';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

const matter = (over: Partial<Matter> = {}): Matter => ({
    id: 'm1', firmId: 'f1', referenceNumber: 'R/1', title: 'Debt recovery',
    type: MatterType.CivilLitigation, status: MatterStatus.Active,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 7).toISOString(), // 7 years old
    billingModel: 'Fixed Fee' as any, hourlyRate: 0, assignedUsers: [],
    ...over,
} as unknown as Matter);

// ─── A. CITATION INTEGRITY ───────────────────────────────────────────────────

describe('V5 A — citation integrity surfaces', () => {
    it('DraftPro drafting prompt calls the sources RESEARCHED, never verified', () => {
        const src = read('src/components/documents/tiptap/DraftProEditor.tsx');
        expect(src).toContain('researched sources (assembled by the AI during research');
        expect(src).not.toContain('following verified sources');
    });

    it('the self-review cross-check reads the real citation fields (the old c.citation/c.title bug left the set empty)', () => {
        const src = read('src/components/documents/tiptap/DraftProEditor.tsx');
        expect(src).toContain('c.text || c.rawText');
        expect(src).not.toContain('c.citation || c.title');
    });

    it('the confidence chip is labelled a heuristic and denies external verification', () => {
        const src = read('src/components/aloa/TrustSignals.tsx');
        expect(src).toContain('Confidence: {s.label} (heuristic)');
        expect(src).toContain('NOT an external verification');
    });

    it('corpus gaps and outages are disclosed to the model, never silent', () => {
        const src = read('src/components/aloa/AloaChat.tsx');
        expect(src).toContain('RULES & FORMS ENGINE: no matching entries');
        expect(src).toContain('RULES & FORMS ENGINE: unavailable right now');
        expect(src).not.toContain(`if (!results || results.length === 0) return "";`);
    });

    it('ALOA retrieval is jurisdiction-scoped (no Lagos bias for other states)', () => {
        const src = read('src/components/aloa/AloaChat.tsx');
        expect(src).toContain('jurisdictionKey: firmState');
    });
});

// ─── B. RESEARCH STUDIO ─────────────────────────────────────────────────────

describe('V5 B — Research Studio honesty', () => {
    it('the Website tab really fetches — no placeholder "[Content scraped from …]" sources', () => {
        const src = read('src/components/modals/AddResearchSourceModal.tsx');
        expect(src).toContain('fetchUrlContentClient(url.trim())');
        expect(src).not.toContain('[Content scraped from');
        // A failed fetch adds NO source (honest error instead of a fake source)
        expect(src).toContain("no source is added — an honest error instead of");
    });

    it('free-generation is gated and labelled — no-sources prompt forbids fake sourcing', () => {
        const src = read('src/hooks/useResearch.ts');
        expect(src).toContain('Never present an ungrounded answer as source-backed research');
        expect(src).toContain('never cite sources that were not provided');
        expect(src).toContain('[Ungrounded — no sources in context');
    });

    it('failed analysis runs throw instead of being saved as results', () => {
        const agent = read('src/agents/ResearchAgent.ts');
        expect(agent).toContain('throw error instanceof Error');
        expect(agent).not.toContain('return "I encountered an error while analyzing the sources');
        const studio = read('src/components/research/ResearchStudio.tsx');
        expect(studio).toContain('no result saved');
    });

    it('chronology / matrix / gap outputs carry AI-generated labelling and evidence-integrity rules', () => {
        const agent = read('src/agents/ResearchAgent.ts');
        expect(agent).toContain('[not established in sources]');
        expect(agent).toContain('AI-generated analysis — derived from the connected sources');
        expect(agent).toContain('Source gaps');
        const studio = read('src/components/research/ResearchStudio.tsx');
        expect(studio).toContain('>AI-generated<');
    });

    it('source attribution travels into drafting/export (Sources block + URLs)', () => {
        const studio = read('src/components/research/ResearchStudio.tsx');
        expect(studio).toContain('Sources (connected at analysis time)');
        expect(studio).toContain("s.url ? ` — ${s.url}`");
    });

    it('the pipeline banner no longer promises a live web search that never runs', () => {
        const chat = read('src/components/research/ResearchChat.tsx');
        expect(chat).not.toContain('run a live web search');
        expect(chat).toContain('No live web search runs here');
        expect(chat).toContain('No sources — answers will be ungrounded AI suggestions');
        const view = read('src/components/ResearchView.tsx');
        expect(view).not.toContain('Please verify each citation — confirm it exists');
        expect(view).toContain('quote it exactly as it appears');
    });
});

// ─── C. LAW REPORTS ─────────────────────────────────────────────────────────

describe('V5 C — Law Reports honesty', () => {
    it('the terminal discloses the missing dependency instead of simulating coverage', () => {
        const src = read('src/components/research/LawReportsView.tsx');
        expect(src).toContain('LAW_REPORTS_DISCLOSURE');
        expect(src).not.toContain('Search thousands of Supreme Court and Court of Appeal precedents');
        expect(src).not.toContain('Case Law Intelligence Terminal');
        // Search is disabled while the corpus is empty — never a live-looking empty search
        expect(src).toContain('disabled={MOCK_CASE_LAW.length === 0}');
    });

    it('the case-law dataset is genuinely empty (no mock precedents)', () => {
        expect(MOCK_CASE_LAW).toEqual([]);
    });

    it("no invented 'Good Law' authority-treatment for a missing status", () => {
        const src = read('src/components/research/LawReportsView.tsx');
        expect(src).not.toContain(`caseData.status || 'Good Law'`);
    });

    it('coming_soon modules are disclosed in the hub, not hidden', () => {
        const hub = read('src/components/settings/LegalIntelligenceHub.tsx');
        expect(hub).toContain("m.status === 'locked' || m.status === 'coming_soon'");
        const modules = read('src/utils/legalModules.ts');
        expect(modules).not.toContain('Powers ARIA case law reasoning');
        expect(modules).toContain('NOT AVAILABLE YET');
    });
});

// ─── D. EVIDENCE INTEGRITY (ALDIA metadata) ─────────────────────────────────

describe('V5 D — AI-extracted metadata and review badges', () => {
    it('ALDIA-extracted fields are labelled unverified in the document view', () => {
        const src = read('src/components/details/DocumentDetailView.tsx');
        expect(src).toContain('AI-extracted by ALDIA');
        expect(src).toContain('confirm each against the underlying document');
    });

    it('the RPC badge states what happened — no unconditional "Verified Agent"', () => {
        const src = read('src/components/details/DocumentDetailView.tsx');
        expect(src).not.toContain('Verified Agent');
        expect(src).toContain('AI self-review: passed (not externally verified)');
        expect(src).toContain('AI self-review: pending');
    });

    it('the RPC parse fallback no longer fabricates an approval', () => {
        const src = read('src/agents/AdvancedLegalDocumentIntelligenceAgent.ts');
        expect(src).not.toContain(`'{"status": "approved", "commentary": "Verified."}'`);
        expect(src).toContain('treat this document as unreviewed');
    });
});

// ─── E. JURISDICTION CORRECTNESS ─────────────────────────────────────────────

describe('V5 E — no hard-coded Lagos assumptions', () => {
    it('the generic StateHighCourt writ rules no longer assert Lagos-only requirements for all states', () => {
        const rule = PROCEDURAL_RULES['Writ of Summons']![CourtType.StateHighCourt]!;
        expect(rule.requirements.join(' ')).toContain("where the state's rules prescribe one");
        expect(rule.requirements.join(' ')).not.toContain('Pre-Action Protocol Form 01 (Lagos)');
        expect(rule.deadlines['Statement of Defence']).toContain("confirm the period under this state's High Court Rules");
        expect(rule.strategicFlags!.join(' ')).not.toContain('Lagos Pre-Action Protocol is MANDATORY');
        expect(rule.complianceChecks.join(' ')).not.toContain('Missing Pre-Action Protocol Form 01');
    });

    it('limitation warnings are ADVISORY and cause-aware — no unverifiable state-wide numbers', () => {
        const warnings = ComplianceEngine.checkMatter(matter());
        const limitation = warnings.filter(w => w.type === 'LIMITATION');
        expect(limitation.length).toBeGreaterThanOrEqual(2);
        for (const w of limitation) {
            expect(w.message).toMatch(/^Advisory/);
            expect(w.severity).not.toBe('CRITICAL');
        }
        expect(limitation[0].message).toContain('if the Defendant is a Public Officer');
        expect(limitation[1].message).toContain('specific cause of action');
        expect(JSON.stringify(limitation)).not.toContain('5 years (most states)');
    });

    it('the magistrate monetary-limit hint is advisory and names its Lagos ceiling as an example', () => {
        const hints = analyzeMatterIntelligence('Rent recovery claim', 'Magistrate Court', 25_000_000);
        const monetary = hints.find(h => h.id === 'monetary-limit');
        expect(monetary).toBeTruthy();
        expect(monetary!.text).toContain('Verify this state\'s Magistrate Court monetary limit');
        expect(monetary!.text).not.toContain('Verified jurisdictional limits');
    });

    it('TemplateService: no LAGOS STATE division fallback, no baked 42-day window, no phantom 2021 rules', () => {
        const noDivision = TemplateService.generateHeading(matter({ court: '', judicialDivision: undefined as any, stateOfPractice: undefined as any } as any));
        expect(noDivision).toContain('[JUDICIAL DIVISION]');
        expect(noDivision).not.toContain('LAGOS STATE');
        const delta = TemplateService.generateHeading(matter({ court: '', judicialDivision: undefined as any, stateOfPractice: 'Delta' as any } as any));
        expect(delta).toContain('DELTA');
        const writ = TemplateService.generateWritOfSummons(matter());
        expect(writ).toContain('[APPEARANCE WINDOW');
        expect(writ).not.toContain('forty-two (42) days');
        const motion = TemplateService.generateMotionOnNotice(matter());
        expect(motion).toContain('[YEAR — confirm');
        expect(motion).not.toContain('{2021}');
    });

    it('litigationSkeletons: captions come from the state registry, with placeholders when unknown', () => {
        expect(getCourtTierInstruction('magistrate', 'Rivers').caption).toContain('RIVERS STATE');
        expect(getCourtTierInstruction('magistrate', null).caption).toContain('IN THE MAGISTRATE COURT OF [STATE]');
        expect(getCourtTierInstruction(null, 'Delta').caption).toContain('DELTA STATE');
        expect(getCourtTierInstruction(null, null).caption).toContain('IN THE HIGH COURT OF [STATE]');
        const src = read('src/constants/litigationSkeletons.ts');
        expect(src).not.toContain('LAGOS STATE');
    });

    it('jurisdiction routing: substring traps no longer mis-route ordinary prompts to tribunals', () => {
        // "specialist" / "assist" / "statute" must NOT enter the IST branch…
        const specialist = buildJurisdictionalReasoning('Please assist me — I need a specialist to review this statute for my landlord matter in Kano', 'Kano');
        expect(specialist.court).not.toContain('INVESTMENT AND SECURITIES TRIBUNAL');
        // …but a genuine IST prompt still routes there.
        const ist = buildJurisdictionalReasoning('I want to challenge a SEC decision at the investment and securities tribunal', 'Lagos');
        expect(ist.court).toContain('INVESTMENT AND SECURITIES TRIBUNAL');
    });
});

// ─── F. AI TRUST & PROFESSIONAL BOUNDARIES ───────────────────────────────────

describe('V5 F — confidence semantics and chat/document separation', () => {
    it('confidence is scored on the RAW model text, before the identity strip', () => {
        const src = read('src/components/aloa/AloaChat.tsx');
        expect(src).toContain('assessConfidence(streamed.text, {');
        expect(src).toContain('assessConfidence(currentResponse.text, {');
        expect(src).not.toContain('assessConfidence(validatedText, {');
        expect(src).not.toContain('assessConfidence(displayText, {');
    });

    it('chat answers pasted into DraftPro carry a visible origin marker', () => {
        const src = read('src/components/aloa/AloaChat.tsx');
        expect(src).toContain('Imported from ALOA chat as-is');
        expect(src).toContain('not generated through the drafting protocol');
    });

    it('the identity prompts welcome uncertainty instead of banning it', () => {
        const aloa = read('ai/prompts/03a-aloa-identity-guardrail.md');
        const aria = read('ai/prompts/03b-aria-identity-guardrail.md');
        expect(aloa).toContain('UNCERTAINTY IS WELCOME');
        expect(aria).toContain('UNCERTAINTY IS WELCOME');
        expect(aloa).not.toContain('- "my knowledge cutoff"');
        expect(aria).not.toContain('- "my knowledge cutoff"');
    });

    it('the Vega legal identity carries a professional-scope guardrail, not an authority tone', () => {
        const identity = read('ai/prompts/01-aloa-legal-identity.md');
        expect(identity).toContain('PROFESSIONAL SCOPE (V5)');
        expect(identity).toContain('never present a conclusion as authoritative legal advice');
        expect(identity).not.toContain('professional, and authoritative');
        expect(identity).not.toContain('search_legal_repo` for Nigerian locus classicus');
    });

    it('ARIA no longer bakes Lagos tenancy law into a nationwide property identity', () => {
        const aria = read('ai/prompts/03b-aria-identity-guardrail.md');
        expect(aria).toContain('tenancy law of the state where the property is located');
        expect(aria).not.toContain('under Lagos State Tenancy Law and the Land Use Act 1978');
        expect(aria).not.toContain('Lagos/Nigerian tenancy regulations');
    });
});

// ─── SCALE OF CHARGES RECONCILIATION ─────────────────────────────────────────

describe('V5 — Scale of Charges citations reconciled', () => {
    it('the land-documentation scale cites the LAND-MATTERS Order (one instrument everywhere)', () => {
        expect(SCALE_4_REFERENCE).toContain('(Remuneration for Legal Documentation and Other Land Matters) Order 2023');
        expect(SCALE_4_REFERENCE).toContain('Scale 4');
        // The old misattribution to the Business/Representation Order is gone…
        expect(SCALE_4_REFERENCE).not.toContain('For Business, Legal Service and Representation');
        // …from every surface that cites it:
        const invoice = read('src/components/forms/InvoiceForm.tsx');
        expect(invoice).toContain('(Remuneration for Legal Documentation and Other Land Matters) Order 2023');
        expect(invoice).not.toContain('· Scale 4, Remuneration Order 2023');
        const agent = read('src/agents/ScaleOfChargesAgent.ts');
        expect(agent).toContain('Scale 4 progressive percentage bands');
        expect(agent).not.toContain("'Scale I'");
    });

    it('the bands are unchanged (product computation pinned by scaleAndTenancy)', () => {
        // Spot-check continuity through the boundary — the detailed band
        // contract lives in scaleAndTenancy.test.ts and is untouched.
        expect(SCALE_4_REFERENCE).toContain('preparation of agreements and land documents');
    });
});
