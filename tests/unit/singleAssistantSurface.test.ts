/**
 * ADR-0007 — ALOA is the single user-facing AI assistant.
 * Structural source-scan tests (the house pattern: read the file, assert the
 * contract) locking in the three convergence rules so future edits cannot
 * quietly reintroduce the second AI face:
 *
 *   1. ONE DOOR    — the AloaFAB never self-hides by view.
 *   2. ONE FACE    — the research notebook chat presents the assistant's own
 *                    identity (name, icon, accent) and answers under the same
 *                    identity lock the main chat uses.
 *   3. VISIBLE ACTIONS — every user message in the Aloa chat carries the
 *                    Research affordance; the text-only path exists.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect } from 'vitest';

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('ADR-0007 — single user-facing AI assistant', () => {
    it('the assistant FAB no longer self-hides in any view (one door)', () => {
        const fab = read('src/components/aloa/AloaFAB.tsx');
        // The pre-ADR rule vanished the door exactly in research/messaging —
        // the views where legal work happens and where the second AI face
        // lived. It must not come back.
        expect(fab).not.toContain("view === 'messaging' || view === 'research'");
        expect(fab).not.toMatch(/isHidden\s*=\s*view\s*===/);
        expect(fab).toContain('isHidden = false');
    });

    it('the research chat presents the ONE assistant, not a second AI face', () => {
        const chat = read('src/components/research/ResearchChat.tsx');
        // Identity comes from the naming authority (never hardcoded ALOA/ARIA)
        expect(chat).toContain("import { getAssistantName } from '../../utils/assistantIdentity'");
        // The assistant's own icon + product accent carry the AI avatar
        expect(chat).toContain('<AloaIcon className="w-4 h-4" />');
        expect(chat).toContain('text-primary-600 dark:text-primary-400');
        // The old second-face branding is gone
        expect(chat).not.toContain('Argument Lab');
        expect(chat).not.toContain('The AI will respond with citations');
    });

    it('the research system prompt answers under the same identity lock as the main chat', () => {
        const hook = read('src/hooks/useResearch.ts');
        // The guardrail is prepended FIRST (its placement rule) and the
        // assistant name is resolved from the product, not hardcoded.
        expect(hook).toContain("import { getIdentityGuardrail } from '../constants/identityGuardrails'");
        expect(hook).toContain('${getIdentityGuardrail(isPropertyMode)}');
        expect(hook).toContain('in RESEARCH MODE');
        expect(hook).not.toContain('You are a legal research assistant.');
    });

    it('every Aloa chat user message carries the Research affordance, with a text-only path', () => {
        const aloa = read('src/components/aloa/AloaChat.tsx');
        // The chip condition no longer requires attachments
        expect(aloa).not.toContain("msg.role === 'user' && msg.attachments && msg.attachments.length > 0 && (");
        // A plain message seeds the notebook with its own text as a source
        expect(aloa).toContain('if (!hasAttachments) {');
        expect(aloa).toContain('content: messageText.slice(0, 4000)');
        // The notebook title derives from the naming authority, not a hardcoded ALOA
        expect(aloa).not.toContain('`ALOA Research —');
        expect(aloa).toContain('${getAssistantName(isProperty)} Research —');
    });

    it('the bottom-nav ALOA Vox tab and the Research destination name are retained (Phase 3 calls)', () => {
        const nav = read('src/components/BottomNav.tsx');
        // The delegated Phase 3 product call: the Aloa-branded Vox entry +
        // Free-tier upsell surface STAYS; Research keeps its workspace name.
        expect(nav).toContain("{ view: 'quickCapture', text: 'ALOA Vox'");
        expect(nav).toContain("{ view: 'research', text: 'Research'");
    });
});
