/**
 * UX-27 contract tests — one canonical matter-notes surface.
 *
 * The audit (register row UX-27): three matter-notes surfaces; users
 * cannot predict where a note lands; knowledge fragments. The ratified
 * design: the matter's OWN Notes tab (MatterDetailView →
 * TeamDiscussionTab) is the one canonical write surface — it is at the
 * point of work and already renders every matter note from every
 * origin. The Firm Knowledge "Matters" notebook becomes a read-only
 * browser with a jump affordance. These tests pin the completed state.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

const NOTES_VIEW = 'src/components/NotesView.tsx';
const MATTER_DETAIL = 'src/components/details/MatterDetailView.tsx';
const READ_ONLY = 'src/components/notes/MatterPageReadOnly.tsx';
const USE_MATTERS = 'src/hooks/useMatters.ts';

describe('UX-27: one canonical matter-notes surface', () => {
    it('the read-only page view exists and sanitizes rich content', () => {
        expect(existsSync(join(ROOT, READ_ONLY))).toBe(true);
        const ro = read(READ_ONLY);
        // Rich (TipTap-authored) pages render as sanitized HTML — raw tags
        // never show; plain pages render as pre-wrapped text.
        expect(ro).toContain("import { sanitize } from '../../utils/sanitization'");
        expect(ro).toContain('dangerouslySetInnerHTML');
        // One affordance only: the jump to the canonical surface.
        expect(ro).toContain('onOpenInMatter');
        expect(ro).not.toContain('onSave');
    });

    it('the Matters notebook in Firm Knowledge has NO add-page affordance', () => {
        const view = read(NOTES_VIEW);
        // The only remaining onAddPage in NotesView is the PRACTICE
        // notebook column (firm knowledge — a different content kind,
        // fully writable). The matter column (level 2) lost its writer.
        const addPageProps = view.match(/onAddPage=\{/g) || [];
        expect(addPageProps.length).toBe(1);
        // And that one is the practice-notebook list, not the matter list:
        // the matter list is identifiable by its title prop.
        const matterColumnIdx = view.indexOf('title={`Notes for ${selectedMatter.title}`}');
        const practiceColumnIdx = view.indexOf('title={`Pages in ${selectedNotebook.name}`}');
        expect(matterColumnIdx).toBeGreaterThan(-1);
        expect(practiceColumnIdx).toBeGreaterThan(-1);
        const matterColumnBlock = view.slice(matterColumnIdx, matterColumnIdx + 1200);
        expect(matterColumnBlock).not.toContain('onAddPage');
    });

    it('the matter notebook renders the read-only view with a jump to the Notes tab', () => {
        const view = read(NOTES_VIEW);
        expect(view).toContain('<MatterPageReadOnly');
        expect(view).toContain("navigateTo('matterDetail', selectedMatter.id, { initialTab: 'notes' })");
        // The rich editor is still used for PRACTICE notebooks (firm
        // knowledge stays fully writable) — the import remains.
        expect(view).toContain("import { NoteEditor } from './notes/NoteEditor'");
    });

    it('the canonical write path is unchanged: the timeline composer', () => {
        const detail = read(MATTER_DETAIL);
        expect(detail).toContain('<TeamDiscussionTab');
        expect(detail).toContain('handleAddMatterNote');
        // A matter note created anywhere lands in the same table with the
        // same shape (one write function, one data truth).
        const hook = read(USE_MATTERS);
        expect(hook).toContain("actions.addItem('notePages'");
    });
});
