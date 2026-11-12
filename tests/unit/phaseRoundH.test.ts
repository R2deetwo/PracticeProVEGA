/**
 * phaseRoundH.test.ts — UX-04 remainder: the form double-submit guard
 * census. After this round every form file under src/components/forms has
 * an isSubmitting guard (or is documented as not-a-submit-form). Source
 * contract: the guard state, the re-entry lock, and the disabled submit.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolvePath(here, '../../convex/myFunctions.ts'))
    ? resolvePath(here, '../..')
    : process.cwd();
const formsDir = resolvePath(repoRoot, 'src/components/forms');
const src = (p: string) => readFileSync(resolvePath(repoRoot, p), 'utf8');

/** Forms that are not submit forms (toggles/popovers) or use an equivalent guard. */
const DOCUMENTED_EXCEPTIONS: Record<string, string> = {
    'UserAssignment.tsx': 'not a submit form — toggle popover calling parent onToggle synchronously',
    'ContactForm.tsx': 'already guarded via its own isSaving state (same pattern)',
};

describe('UX-04 remainder — every form resists double submission', () => {
    const files = readdirSync(formsDir).filter(f => f.endsWith('.tsx'));
    it('the forms census is non-trivial', () => {
        expect(files.length).toBeGreaterThan(30);
    });
    it.each(files)('%s carries a submit guard or a documented exception', (f) => {
        const code = readFileSync(resolvePath(formsDir, f), 'utf8');
        const guarded = /isSubmitting|isSaving/.test(code) || DOCUMENTED_EXCEPTIONS[f] !== undefined;
        expect(guarded).toBe(true);
    });
    it('the round-H fifteen use the full pattern (state + re-entry lock)', () => {
        for (const f of ['AssignUsersForm.tsx', 'BankAccountForm.tsx', 'ChecklistTemplateForm.tsx',
            'DocumentCategoryForm.tsx', 'EventTypeForm.tsx', 'ExternalCounselInviteForm.tsx',
            'InvoiceGeneratorForm.tsx', 'NewChannelForm.tsx', 'NewDirectMessageForm.tsx',
            'NewResearchNotebookForm.tsx', 'NotePageForm.tsx', 'NotebookForm.tsx',
            'RequestFinancialDocumentForm.tsx', 'StageChecklistForm.tsx', 'TemplateCategoryForm.tsx']) {
            const code = readFileSync(resolvePath(formsDir, f), 'utf8');
            expect(code).toContain('const [isSubmitting, setIsSubmitting] = useState(false)');
            expect(code).toContain('if (isSubmitting) return;');
            expect(code).toContain('setIsSubmitting(false)');
        }
    });
    it('the guards disable the submit control', () => {
        for (const f of ['AssignUsersForm.tsx', 'ExternalCounselInviteForm.tsx', 'InvoiceGeneratorForm.tsx']) {
            const code = readFileSync(resolvePath(formsDir, f), 'utf8');
            expect(code).toContain('disabled={isSubmitting}');
        }
    });
});
