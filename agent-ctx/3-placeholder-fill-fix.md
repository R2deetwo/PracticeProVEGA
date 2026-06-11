# Task 3: Fix Smart Fill / Placeholder Issues in DraftProEditor

## Summary
Fixed four critical bugs in the DraftProEditor's placeholder fill system:
1. Modal not dismissing after filling
2. Multiple pasting (value inserted multiple times)
3. Placeholders refusing to be dismissed/filled
4. Filled value not going into correct space

## Root Causes Identified
- **Modal not dismissing**: `processFill()` used separate `editor.chain().deleteRange().insertContentAt().run()` calls per placeholder. If any threw, `setActiveModal(null)` was never reached.
- **Multiple pasting**: No guard against duplicate submissions + stale closure positions from render-time IIFE caused each `.run()` to operate on outdated document state.
- **Stale positions**: `nodesToFill` was captured at render time; positions became invalid after the first replacement in the loop.
- **Wrong placement**: Same root cause — stale positions led to replacements at incorrect document offsets.

## Changes Made

### `/home/z/my-project/src/components/documents/tiptap/DraftProEditor.tsx`
1. **Added `isFillingRef`** (useRef<boolean>) — processing guard to prevent duplicate `processFill()` calls
2. **Added `targetPlaceholderLabel` state** — captures clicked placeholder's label for autoFocus
3. **Fixed event listener** — now extracts `e.detail.label` and sets `targetPlaceholderLabel`
4. **Rewrote `processFill()`**:
   - Guards with `isFillingRef` to exit if already processing
   - Re-fetches positions FRESH from `editor.state.doc.descendants()` (not stale render-time positions)
   - Uses a SINGLE ProseMirror transaction (`editor.state.tr`) with `tr.replaceWith()` for all replacements
   - Sorts bottom-up so higher positions are replaced first, keeping lower positions stable
   - Wrapped in try-catch-finally to guarantee modal closure
5. **Added `closeFillModal()` helper** — clears both `activeModal` and `targetPlaceholderLabel`
6. **Added `autoFocus` prop** on input matching `targetPlaceholderLabel`
7. **Added disabled styles** to submit button for visual feedback

### `/home/z/my-project/src/components/documents/tiptap/extensions/LegalPlaceholder.tsx`
No changes needed — the extension correctly dispatches `open-placeholder-modal` with label in detail.

## Key Technical Decision: Single ProseMirror Transaction
The most important fix is using a single `tr.replaceWith()` transaction for ALL replacements instead of multiple `chain().run()` calls. This ensures:
- Atomic operation (all or nothing)
- No position drift between replacements
- Proper mapping handled by ProseMirror internally
- Bottom-up sorting ensures lower positions remain valid after higher replacements
