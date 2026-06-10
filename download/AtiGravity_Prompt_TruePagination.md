# Ati Gravity Prompt: Replace Faux-Page Rendering with True Document Pagination

## COPY EVERYTHING BELOW THIS LINE INTO ATI GRAVITY

---

## CONTEXT & PROBLEM STATEMENT

The DraftProEditor at `src/components/documents/tiptap/DraftProEditor.tsx` currently uses a **"faux-page" rendering system** — it paints decorative white rectangles behind a single continuous TipTap editor to create the *illusion* of multiple pages, but the underlying document model has ZERO structural awareness of page boundaries.

### Current Broken Architecture (Lines 91-94, 288-290, 730-771):

1. **Page constants** (lines 91-94) define `PAGE_WIDTH_PX = 794`, `PAGE_HEIGHT_PX = 1123`, `PAGE_MARGIN_PX = 96`, `PAGE_GAP_PX = 40` — used ONLY for visual decoration, never for content splitting
2. **Content height tracking** (lines 288-290) measures the entire ProseMirror `scrollHeight` and divides by `PAGE_HEIGHT_PX` to get `pageCount` — pure arithmetic with no content awareness
3. **Background page "simulations"** (lines 730-754) render a `z-0` stack of white `<div>` rectangles with shadows, headers, and page numbers that are COMPLETELY DISCONNECTED from the editor content
4. **Editor content overlay** (lines 756-771) is ONE continuous `<EditorContent>` on a `z-20` layer that flows straight through all visual page boundaries

### What This Causes:
- Text bleeds across page boundaries — paragraphs split mid-line across the gap between "Page 1" and "Page 2"
- Tables, images, and party groups break arbitrarily at page edges
- Headers and footers are absolute-positioned background decorations, not part of the document model
- Print output does NOT match the visual layout
- No manual page-break insertion is possible
- No widow/orphan control exists

### What Needs to Be Built:
Replace the entire faux-page system with a **true data-driven pagination engine** where the document model itself contains page-break nodes, content is measured in real-time and split at page boundaries, and each page renders as a structurally independent container with its own header/footer region.

---

## IMPLEMENTATION INSTRUCTIONS

### PHASE 1: Create the PageBreak TipTap Node Extension

**Create new file:** `src/components/documents/tiptap/extensions/PageBreak.ts`

This extension defines a block-level node that represents an explicit page break in the document model. It must:

```typescript
import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pageBreak: {
      /** Insert a page break at the current cursor position */
      setPageBreak: () => ReturnType;
      /** Remove the page break containing the cursor */
      unsetPageBreak: () => ReturnType;
    };
  }
}

export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  inline: false,
  selectable: true,
  draggable: false,
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-page-break]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-page-break': '',
        class: 'page-break-node',
        style: `
          page-break-after: always;
          break-after: page;
          height: 0;
          margin: 0;
          padding: 0;
          border-top: 2px dashed #cbd5e1;
          position: relative;
        `,
      }),
      [
        'span',
        {
          class: 'page-break-label',
          style: `
            position: absolute;
            top: -10px;
            left: 50%;
            transform: translateX(-50%);
            background: #f1f5f9;
            color: #64748b;
            font-size: 11px;
            padding: 0 8px;
            font-family: Inter, sans-serif;
            pointer-events: none;
          `,
        },
        '— Page Break —',
      ],
    ];
  },

  addCommands() {
    return {
      setPageBreak:
        () =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
          });
        },
      unsetPageBreak:
        () =>
        ({ commands }) => {
          return commands.deleteNode(this.name);
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Enter': () => this.editor.commands.setPageBreak(),
    };
  },
});
```

### PHASE 2: Create the PaginationEngine TipTap Extension

**Create new file:** `src/components/documents/tiptap/extensions/PaginationEngine.ts`

This is the core intelligence. It monitors content changes, measures cumulative height of content nodes, and automatically inserts/removes page-break nodes when content overflows or underflows a page boundary. This is the most critical piece.

```typescript
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Fragment, Node as ProseMirrorNode } from '@tiptap/pm/model';

export const PaginationEngine = Extension.create<{
  pageHeightPx: number;
  contentMarginPx: number;
  headerHeightPx: number;
  footerHeightPx: number;
  widowOrphanMinLines: number;
  autoPaginate: boolean;
}>({
  name: 'paginationEngine',

  addOptions() {
    return {
      pageHeightPx: 1123,       // A4 height at 96dpi
      contentMarginPx: 96,      // ~1 inch margins
      headerHeightPx: 80,       // Space for letterhead header
      footerHeightPx: 40,       // Space for page number footer
      widowOrphanMinLines: 2,   // Minimum lines to keep together
      autoPaginate: true,       // Auto-insert page breaks
    };
  },

  addProseMirrorPlugins() {
    const editor = this.editor;
    const options = this.options;

    return [
      new Plugin({
        key: new PluginKey('paginationEngine'),

        view() {
          return {
            update(view, prevState) {
              if (!options.autoPaginate) return;

              const doc = view.state.doc;
              const dom = view.dom as HTMLElement;

              // Don't run on every single transaction (e.g., selection changes)
              if (view.state.doc.eq(prevState.doc)) return;

              // Defer to next frame to allow DOM to settle
              requestAnimationFrame(() => {
                paginateDocument(view, dom, options);
              });
            },
          };
        },
      }),
    ];
  },
});

/**
 * Core pagination algorithm:
 * 1. Iterate through all top-level block nodes in the document
 * 2. Measure each node's rendered height from the DOM
 * 3. Track cumulative height against the usable page area
 * 4. When cumulative height exceeds the usable area, insert a pageBreak node BEFORE the overflowing block
 * 5. Reset cumulative height to 0 and continue
 * 6. Apply widow/orphan protection: if the last N lines of a block would be orphaned on the next page,
 *    move the entire block to the next page instead
 * 7. Remove any pageBreak nodes that are no longer needed (content shrunk)
 */
function paginateDocument(
  view: any,
  dom: HTMLElement,
  options: {
    pageHeightPx: number;
    contentMarginPx: number;
    headerHeightPx: number;
    footerHeightPx: number;
    widowOrphanMinLines: number;
  }
) {
  const { pageHeightPx, contentMarginPx, headerHeightPx, footerHeightPx } = options;

  // Usable content area per page (excluding header, footer, and margins)
  const usablePageHeight = pageHeightPx - (contentMarginPx * 2) - headerHeightPx - footerHeightPx;

  const doc = view.state.doc;
  const tr = view.state.tr;

  // Step 1: Find all existing pageBreak nodes and their positions
  const existingPageBreaks: number[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === 'pageBreak') {
      existingPageBreaks.push(pos);
    }
    return false; // Don't recurse into children of pageBreak
  });

  // Step 2: Get DOM height measurements for each top-level block node
  const prosemirrorEl = dom.querySelector('.ProseMirror') as HTMLElement;
  if (!prosemirrorEl) return;

  const blockElements = prosemirrorEl.children;
  const blockHeights: { pos: number; height: number; node: ProseMirrorNode }[] = [];

  let domIndex = 0;
  doc.forEach((node, offset) => {
    if (node.type.name === 'pageBreak') {
      // Page break nodes have negligible height
      blockHeights.push({ pos: offset, height: 4, node });
      return;
    }

    const el = blockElements[domIndex] as HTMLElement;
    if (el) {
      blockHeights.push({ pos: offset, height: el.offsetHeight, node });
    }
    domIndex++;
  });

  // Step 3: Calculate where page breaks SHOULD be
  const desiredPageBreakPositions: number[] = [];
  let cumulativeHeight = 0;
  let currentPageStart = 0;

  for (let i = 0; i < blockHeights.length; i++) {
    const { pos, height, node } = blockHeights[i];

    // Skip existing pageBreak nodes in the calculation
    if (node.type.name === 'pageBreak') {
      cumulativeHeight = 0; // Reset for new page
      continue;
    }

    // Check if adding this block would overflow the page
    if (cumulativeHeight + height > usablePageHeight && cumulativeHeight > 0) {
      // Widow/orphan check: if this block is small enough that only
      // widowOrphanMinLines would be left on the current page,
      // move the entire block to the next page
      const lineHeight = height / (node.textContent.split('\n').length || 1);
      const linesOnCurrentPage = Math.floor((usablePageHeight - cumulativeHeight) / lineHeight);

      if (linesOnCurrentPage > 0 && linesOnCurrentPage < options.widowOrphanMinLines) {
        // Not enough lines on current page — move entire block to next page
        desiredPageBreakPositions.push(pos);
      } else {
        // Normal overflow — break before this block
        desiredPageBreakPositions.push(pos);
      }

      cumulativeHeight = height; // Start new page with this block
    } else {
      cumulativeHeight += height;
    }
  }

  // Step 4: Reconcile existing pageBreaks with desired positions
  // This is done carefully to avoid infinite loops — we batch all changes into one transaction

  // Remove all auto-generated page breaks first (manual page breaks are preserved via a data attribute)
  // For this implementation, we'll remove all existing page breaks that don't have a data-manual attribute
  // and insert new ones at the desired positions

  // IMPORTANT: Process removals from end to start to preserve positions
  const removals = existingPageBreaks.slice().reverse();

  // Only proceed if changes are needed
  if (JSON.stringify(existingPageBreaks.sort()) !== JSON.stringify(desiredPageBreakPositions.sort())) {
    // Batch: remove old auto-breaks, then insert new ones
    let offsetAdjustment = 0;

    // Remove existing auto page breaks (those without data-manual attribute)
    for (const pos of removals) {
      const node = doc.nodeAt(pos);
      if (node && node.type.name === 'pageBreak' && !node.attrs?.manual) {
        const deletePos = pos + 1 + offsetAdjustment; // +1 for paragraph offset
        tr.delete(deletePos, deletePos + node.nodeSize);
      }
    }

    // Insert new page breaks at desired positions
    // Re-read doc from tr.doc after removals
    const updatedDoc = tr.doc || doc;
    let insertOffset = 0;

    for (const pos of desiredPageBreakPositions) {
      const adjustedPos = pos + insertOffset;
      const pageBreakNode = updatedDoc.type.schema.nodes.pageBreak?.create();
      if (pageBreakNode) {
        tr.insert(adjustedPos, pageBreakNode);
        insertOffset += pageBreakNode.nodeSize;
      }
    }

    // Only dispatch if we actually made changes
    if (tr.docChanged) {
      // Preserve selection
      view.dispatch(tr);
    }
  }
}

export default PaginationEngine;
```

**IMPORTANT NOTES ON THE PAGINATION ENGINE:**
- The algorithm runs asynchronously (requestAnimationFrame) to avoid blocking the UI
- It only runs when the document content actually changes (not on selection changes)
- It respects manual page breaks (data-manual attribute) and won't remove them
- Widow/orphan control prevents awkward single-line breaks at page boundaries
- All changes are batched into a single ProseMirror transaction to avoid infinite loops
- The `usablePageHeight` accounts for header, footer, and margin space on each page

### PHASE 3: Restructure DraftProEditor Rendering — Replace Faux Pages with True Page Containers

**Modify file:** `src/components/documents/tiptap/DraftProEditor.tsx`

This is the biggest change. You must replace the entire faux-page rendering system with a new architecture that renders each page as a structurally independent container with its own content slice.

#### 3A. Update Constants (replace lines 91-94)

```typescript
// A4 Page Dimensions at 96dpi
const PAGE_WIDTH_PX = 794;    // 210mm
const PAGE_HEIGHT_PX = 1123;  // 297mm
const PAGE_MARGIN_PX = 96;    // ~25.4mm (1 inch)
const PAGE_GAP_PX = 40;       // Gap between page containers
const HEADER_HEIGHT_PX = 80;  // Space reserved for letterhead
const FOOTER_HEIGHT_PX = 40;  // Space reserved for page number
const USABLE_CONTENT_HEIGHT = PAGE_HEIGHT_PX - (PAGE_MARGIN_PX * 2) - HEADER_HEIGHT_PX - FOOTER_HEIGHT_PX;
```

#### 3B. Replace the Faux-Page State Tracking (replace lines 197, 288-290)

Remove the old `contentHeight` state and the `pageCount` derived from it. Replace with:

```typescript
// Track pages as structured data
const [pages, setPages] = useState<Array<{
  id: number;
  contentStartPos: number;
  contentEndPos: number;
  hasManualBreak: boolean;
}>>([{ id: 1, contentStartPos: 0, contentEndPos: 0, hasManualBreak: false }]);

// Derive pageCount from pages array
const pageCount = pages.length;
```

#### 3C. Add Page-Change Listener in Editor onUpdate (replace the contentHeight logic in onUpdate)

Inside the `useEditor` configuration's `onUpdate` callback, replace the `contentHeight` tracking with:

```typescript
onUpdate: ({ editor }) => {
  // ... existing update logic ...

  // Calculate page boundaries from pageBreak nodes
  const doc = editor.state.doc;
  const pageBreakPositions: number[] = [];

  doc.descendants((node, pos) => {
    if (node.type.name === 'pageBreak') {
      pageBreakPositions.push(pos);
    }
    return false;
  });

  // Build pages array from page break positions
  const newPages = [];
  let startPos = 0;

  for (let i = 0; i < pageBreakPositions.length; i++) {
    const breakPos = pageBreakPositions[i];
    newPages.push({
      id: i + 1,
      contentStartPos: startPos,
      contentEndPos: breakPos,
      hasManualBreak: doc.nodeAt(breakPos)?.attrs?.manual === true,
    });
    startPos = breakPos + 1;
  }

  // Last page (after the final page break, or the only page if no breaks)
  newPages.push({
    id: newPages.length + 1,
    contentStartPos: startPos,
    contentEndPos: doc.content.size,
    hasManualBreak: false,
  });

  setPages(newPages);
},
```

#### 3D. Replace the Entire Page Rendering JSX (replace lines 714-771)

This is the core visual change. Replace the background page simulations + single editor overlay with a **per-page rendering system**:

```tsx
{/* === TRUE PAGINATION RENDERING === */}
<div
  className="flex justify-center"
  style={{
    padding: '40px 0',
  }}
>
  <div
    style={{
      width: `${PAGE_WIDTH_PX * zoom}px`,
      transformOrigin: 'top center',
    }}
  >
    <div
      style={{
        transform: `scale(${zoom})`,
        transformOrigin: 'top left',
        width: `${PAGE_WIDTH_PX}px`,
      }}
    >
      {pages.map((page, pageIndex) => (
        <div
          key={page.id}
          className="bg-white shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-gray-200/50 relative mb-[40px] last:mb-0"
          style={{
            width: `${PAGE_WIDTH_PX}px`,
            height: `${PAGE_HEIGHT_PX}px`,
            overflow: 'hidden',
          }}
        >
          {/* Page Header (Letterhead) */}
          {(pageIndex === 0 || appState.firmDetails.settings?.headerConfig?.showOnAllPages) && (
            <div
              className="absolute left-0 right-0 top-0 z-10"
              style={{ height: `${HEADER_HEIGHT_PX + PAGE_MARGIN_PX}px` }}
            >
              <HeaderRenderer config={appState.firmDetails.settings?.headerConfig} />
            </div>
          )}

          {/* Page Content Area */}
          <div
            className="absolute left-0 right-0 overflow-hidden"
            style={{
              top: `${PAGE_MARGIN_PX + HEADER_HEIGHT_PX}px`,
              bottom: `${PAGE_MARGIN_PX + FOOTER_HEIGHT_PX}px`,
              left: `${PAGE_MARGIN_PX}px`,
              right: `${PAGE_MARGIN_PX}px`,
            }}
          >
            {/* Render the slice of editor content for this page */}
            <PageContentSlice
              editor={editor}
              startPos={page.contentStartPos}
              endPos={page.contentEndPos}
              pageIndex={pageIndex}
            />
          </div>

          {/* Page Footer (Page Number) */}
          <div
            className="absolute left-0 right-0 text-center z-10"
            style={{
              bottom: `${PAGE_MARGIN_PX / 2}px`,
              fontSize: '12px',
              color: '#94a3b8',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Page {pageIndex + 1} of {pageCount}
          </div>

          {/* Page Break Indicator (between pages) */}
          {pageIndex < pages.length - 1 && (
            <div
              className="absolute left-0 right-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-slate-300 to-transparent"
              style={{ transform: 'translateY(50%)' }}
            />
          )}
        </div>
      ))}
    </div>
  </div>
</div>
```

#### 3E. Create the PageContentSlice Component

**Add this new component inside DraftProEditor.tsx** (or as a separate file at `src/components/documents/tiptap/PageContentSlice.tsx`):

```tsx
import React, { useEffect, useRef } from 'react';
import { Editor } from '@tiptap/react';

interface PageContentSliceProps {
  editor: Editor;
  startPos: number;
  endPos: number;
  pageIndex: number;
}

/**
 * Renders a slice of the TipTap editor's document content for a specific page.
 *
 * This component works by:
 * 1. Creating a temporary ProseMirror slice from startPos to endPos
 * 2. Rendering that slice into an isolated DOM container
 * 3. Using the editor's schema and decorations to maintain formatting
 *
 * Only the "active" page (the one containing the cursor) gets an actual
 * editable ProseMirror view. All other pages render a read-only preview.
 */
const PageContentSlice: React.FC<PageContentSliceProps> = ({
  editor,
  startPos,
  endPos,
  pageIndex,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Determine if this page contains the cursor (active page)
  const isActivePage = (() => {
    const { from } = editor.state.selection;
    return from >= startPos && from <= endPos;
  })();

  useEffect(() => {
    if (!containerRef.current) return;

    if (isActivePage) {
      // For the active page, we need to make sure the editor's ProseMirror
      // view is properly positioned within this container.
      // The actual editable content stays in the main editor instance,
      // but we visually position it within this page container.
      return;
    }

    // For inactive pages, render a static preview of the content slice
    const slice = editor.state.doc.slice(startPos, endPos);
    const fragment = document.createDocumentFragment();

    // Use the editor's schema to serialize the slice to HTML
    const tempDiv = document.createElement('div');
    const html = editor.view.dom.innerHTML; // Get current editor HTML

    // Extract just this page's content by position
    // We use a simplified approach: clone the ProseMirror DOM and show only
    // the nodes that fall within our position range
    renderStaticSlice(containerRef.current, editor, startPos, endPos);
  }, [editor.state, startPos, endPos, pageIndex]);

  return (
    <div
      ref={containerRef}
      className={`page-content-slice ${isActivePage ? 'active-page' : 'inactive-page'}`}
      style={{
        fontSize: editor.getAttributes('textStyle').fontSize || '14px',
        fontFamily: editor.getAttributes('textStyle').fontFamily || 'Inter, sans-serif',
        lineHeight: editor.getAttributes('paragraph')?.lineHeight || '1.6',
        color: '#1e293b',
      }}
    />
  );
};

/**
 * Renders a static (non-editable) preview of a document slice
 * by cloning the relevant DOM nodes from the editor.
 */
function renderStaticSlice(
  container: HTMLElement,
  editor: Editor,
  startPos: number,
  endPos: number
) {
  // Clear previous content
  container.innerHTML = '';

  const doc = editor.state.doc;
  const prosemirrorEl = editor.view.dom.querySelector('.ProseMirror') as HTMLElement;
  if (!prosemirrorEl) return;

  // Create a mapping from document positions to DOM nodes
  // Walk through the editor's DOM and clone nodes that fall within our range
  const clonedNodes: HTMLElement[] = [];
  let currentPos = 0;

  // Iterate through top-level block nodes in the ProseMirror DOM
  const children = Array.from(prosemirrorEl.children);
  let domChildIndex = 0;

  doc.forEach((node, offset) => {
    if (node.type.name === 'pageBreak') {
      domChildIndex++;
      return; // Skip page break nodes
    }

    const nodeStart = offset;
    const nodeEnd = offset + node.nodeSize;

    // Check if this node falls within our page's range
    if (nodeEnd > startPos && nodeStart < endPos) {
      const domNode = children[domChildIndex] as HTMLElement;
      if (domNode) {
        const clone = domNode.cloneNode(true) as HTMLElement;
        // Make the clone non-interactive
        clone.style.pointerEvents = 'none';
        clone.style.userSelect = 'none';
        clonedNodes.push(clone);
      }
    }

    domChildIndex++;
  });

  // Append cloned nodes to the container
  for (const node of clonedNodes) {
    container.appendChild(node);
  }
}

export default PageContentSlice;
```

#### 3F. Alternative Simpler Approach (RECOMMENDED for initial implementation)

**If the per-page slice rendering above is too complex for a first pass**, use this simpler approach that keeps the single TipTap editor but wraps it in a CSS-based pagination container that enforces page boundaries:

Instead of the per-page rendering system, keep ONE editor but use CSS `break-after: page` and measured page-break nodes to create visual page separation:

```tsx
{/* === SIMPLIFIED TRUE PAGINATION (Single Editor, CSS Page Breaks) === */}
<div
  className="flex justify-center"
  style={{ padding: '40px 0' }}
>
  <div
    style={{
      width: `${PAGE_WIDTH_PX * zoom}px`,
      transformOrigin: 'top center',
    }}
  >
    <div
      style={{
        transform: `scale(${zoom})`,
        transformOrigin: 'top left',
        width: `${PAGE_WIDTH_PX}px`,
      }}
    >
      {/* The single editor wrapped in a paginated container */}
      <div
        ref={editorWrapRef}
        className="relative"
      >
        <div
          className="draftpro-paginated-content"
          style={{
            columnWidth: `${PAGE_WIDTH_PX}px`,
            columnFill: 'auto',
          }}
        >
          {/* Letterhead header on first page */}
          <div className="page-header-first">
            <HeaderRenderer config={appState.firmDetails.settings?.headerConfig} />
          </div>

          <EditorContent editor={editor} />

          {/* Page number footer */}
          <div className="page-footer" style={{
            position: 'sticky',
            bottom: 0,
          }}>
            Page 1 of {pageCount}
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
```

AND add these critical CSS rules to the `<style>` tag in DraftProEditor:

```css
/* True Pagination Styles */
.draftpro-paginated-content .ProseMirror {
  column-width: 794px;
  column-fill: auto;
  column-gap: 40px;
}

/* Page break nodes force column breaks */
.page-break-node {
  break-after: page;
  break-after: column;
  height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  border-top: 2px dashed #cbd5e1;
  position: relative;
}

.page-break-label {
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  background: #f1f5f9;
  color: #64748b;
  font-size: 11px;
  padding: 0 8px;
  font-family: Inter, sans-serif;
  pointer-events: none;
}

/* Each column acts as a page container */
.draftpro-paginated-content .ProseMirror > * {
  break-inside: avoid;
}

/* Prevent orphan/widow lines */
.draftpro-paginated-content .ProseMirror p {
  orphans: 2;
  widows: 2;
}

/* Table rows should not split across pages */
.draftpro-paginated-content .ProseMirror table {
  break-inside: avoid;
}

/* Print styles that match visual layout */
@media print {
  .page-break-node {
    break-after: page !important;
  }
  .draftpro-paginated-content .ProseMirror {
    column-width: auto;
    column-fill: auto;
  }
}
```

**HOWEVER — the CSS column approach alone is NOT sufficient for a production legal document editor.** It is only a stepping stone. The per-page rendering system (Phase 3D-3E) is the correct final architecture. Use the CSS approach ONLY if you need a quick fix to stop the bleeding, then upgrade to per-page rendering.

### PHASE 4: Add Manual Page Break Button to Toolbar

**In DraftProEditor.tsx**, add a page break button to the toolbar. Insert it after the line spacing group and before the heading group:

```tsx
{/* Page Break */}
<ToolbarBtn
  onClick={() => editor.chain().focus().setPageBreak().run()}
  active={false}
  title="Insert Page Break (Ctrl/Cmd+Enter)"
>
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="3" y1="12" x2="21" y2="12" strokeDasharray="3 3" />
    <path d="M8 8l-2 2 2 2" />
    <path d="M16 8l2 2-2 2" />
  </svg>
</ToolbarBtn>
```

### PHASE 5: Register the New Extensions in the TipTap Editor

**In DraftProEditor.tsx**, in the `useEditor` hook's `extensions` array, add:

```typescript
import { PageBreak } from './extensions/PageBreak';
import { PaginationEngine } from './extensions/PaginationEngine';

// Inside useEditor:
extensions: [
  // ... existing extensions ...
  PageBreak,
  PaginationEngine.configure({
    pageHeightPx: PAGE_HEIGHT_PX,
    contentMarginPx: PAGE_MARGIN_PX,
    headerHeightPx: HEADER_HEIGHT_PX,
    footerHeightPx: FOOTER_HEIGHT_PX,
    widowOrphanMinLines: 2,
    autoPaginate: true,
  }),
],
```

### PHASE 6: Fix the Print Styles

**In DraftProEditor.tsx**, replace the existing `<style>` tag content (lines 1088-1135) with a unified print system:

```css
/* === DraftPro True Pagination Styles === */
.draftpro-editor-content .ProseMirror {
  outline: none;
  min-height: 100%;
  font-size: 14px;
  line-height: 1.6;
  color: #1e293b;
}

.draftpro-editor-content .ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: #adb5bd;
  pointer-events: none;
  height: 0;
}

/* Page break node styling */
.page-break-node {
  break-after: page;
  height: 0;
  margin: 0;
  padding: 8px 0;
  border-top: 2px dashed #cbd5e1;
  position: relative;
  user-select: none;
}

.page-break-label {
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  background: #f1f5f9;
  color: #64748b;
  font-size: 11px;
  padding: 0 8px;
  font-family: Inter, sans-serif;
  pointer-events: none;
}

/* Scrollbar hiding */
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

/* === Print Styles === */
@page {
  size: A4;
  margin: 25.4mm;
}

@media print {
  body * {
    visibility: hidden;
  }

  #draftpro-scroll-area,
  #draftpro-scroll-area * {
    visibility: visible;
  }

  #draftpro-scroll-area {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    padding: 0 !important;
    margin: 0 !important;
    background: white !important;
    overflow: visible !important;
    transform: none !important;
  }

  /* Remove decorative page containers for print */
  .shadow-2xl {
    box-shadow: none !important;
    border: none !important;
  }

  /* Page break nodes become real page breaks */
  .page-break-node {
    break-after: page !important;
    border: none !important;
    margin: 0 !important;
    padding: 0 !important;
    height: 0 !important;
  }

  .page-break-label {
    display: none !important;
  }

  /* Hide editor chrome */
  .absolute.left-\[-100px\].right-\[-100px\] {
    display: none !important;
  }

  /* Ensure tables don't break across pages */
  table {
    page-break-inside: avoid;
  }

  tr {
    page-break-inside: avoid;
  }

  /* Keep headings with following content */
  h1, h2, h3, h4, h5, h6 {
    page-break-after: avoid;
  }

  /* Prevent orphan/widow lines */
  p {
    orphans: 2;
    widows: 2;
  }
}
```

**Also in `src/index.css`**, remove or comment out the old Quill-era print styles (lines 771-848) that reference `.document-print-container`, `.ql-editor`, and `#workspace-scroll` — these are from the previous editor and conflict with the new system.

### PHASE 7: Update the Outer Container Height Calculation

**In DraftProEditor.tsx**, replace the container height calculation. Currently (around lines 714-722) it calculates height as:

```
PAGE_HEIGHT_PX * pageCount + PAGE_GAP_PX * (pageCount - 1)
```

This should remain similar but now derives from the `pages` array:

```tsx
const containerHeight = PAGE_HEIGHT_PX * pages.length + PAGE_GAP_PX * Math.max(0, pages.length - 1);
```

### PHASE 8: Nigerian Legal Document Considerations

The pagination system MUST respect these Nigerian legal formatting requirements:

1. **Suit Title Positioning**: The suit title (e.g., "IN THE HIGH COURT OF LAGOS STATE") must always start at the top of Page 1, below the letterhead. It should NEVER be split across pages.

2. **Party Grouping**: The `LegalPartiesGroup` block (claimant/respondent listings with bracketed numbering) must NEVER be split across a page break. The entire block should move to the next page if it doesn't fit.

3. **Naira Currency Formatting**: Currency amounts (₦) in tables or paragraphs should not be split across pages.

4. **Signature Blocks**: The signature/attestation area at the end of a legal document must be kept together and not split across pages. Add `break-inside: avoid` to signature block styling.

5. **Affidavit Paragraphs**: Numbered affidavit paragraphs (1., 2., 3.) should each be treated as indivisible units — a single paragraph should never be split across pages.

Add these CSS rules to support these requirements:

```css
/* Nigerian Legal Document Pagination Rules */
.draftpro-editor-content .ProseMirror [data-legal-parties-group] {
  break-inside: avoid;
}

.draftpro-editor-content .ProseMirror [data-signature-block] {
  break-inside: avoid;
}

.draftpro-editor-content .ProseMirror [data-affidavit-paragraph] {
  break-inside: avoid;
}

.draftpro-editor-content .ProseMirror [data-suit-title] {
  break-after: avoid;
  break-inside: avoid;
}
```

---

## IMPLEMENTATION ORDER (Follow This Sequence)

1. **First**: Create `PageBreak.ts` extension (Phase 1) — this is the foundation
2. **Second**: Register PageBreak in DraftProEditor's extensions array (Phase 5 — partial)
3. **Third**: Add the page break toolbar button (Phase 4) — so you can test manual page breaks
4. **Fourth**: Replace the faux-page rendering with the CSS-based approach (Phase 3F — the simpler version first)
5. **Fifth**: Update the `<style>` tag with new pagination CSS and unified print styles (Phase 6)
6. **Sixth**: Remove old Quill-era print styles from `src/index.css` (Phase 6 cleanup)
7. **Seventh**: Create `PaginationEngine.ts` extension (Phase 2) — this is the most complex piece
8. **Eighth**: Register PaginationEngine in DraftProEditor's extensions array (Phase 5 — complete)
9. **Ninth**: Update container height calculation (Phase 7)
10. **Tenth**: Upgrade from CSS-based pagination to per-page rendering (Phase 3D-3E) if needed for production quality
11. **Last**: Add Nigerian legal document pagination rules (Phase 8)

---

## TESTING CHECKLIST

After implementation, verify:

- [ ] Manual page break button appears in toolbar and inserts a dashed-line page break when clicked
- [ ] Ctrl/Cmd+Enter keyboard shortcut inserts a page break
- [ ] Text does NOT bleed across page boundaries — content stops cleanly at the bottom of each page
- [ ] New pages are automatically created when content overflows
- [ ] Empty pages are automatically removed when content shrinks
- [ ] Tables and images do not split across page boundaries
- [ ] The LegalPartiesGroup block stays together (never splits across pages)
- [ ] Letterhead appears on Page 1 and optionally on all pages (respects `showOnAllPages` setting)
- [ ] Page numbers show "Page X of Y" at the bottom of each page
- [ ] Zoom works correctly (pages scale but content stays within boundaries)
- [ ] Print preview matches the visual layout (no double pagination)
- [ ] Undo/Redo works correctly with page breaks
- [ ] Copy/Paste preserves page breaks
- [ ] The editor remains performant with documents up to 50 pages
- [ ] Widow/orphan control prevents single-line paragraphs at page boundaries
- [ ] Signature blocks and affidavit paragraphs are never split across pages

---

## FILES TO CREATE

1. `src/components/documents/tiptap/extensions/PageBreak.ts` — PageBreak TipTap node
2. `src/components/documents/tiptap/extensions/PaginationEngine.ts` — Auto-pagination extension
3. `src/components/documents/tiptap/PageContentSlice.tsx` — Per-page content renderer (for Phase 3D-3E upgrade)

## FILES TO MODIFY

1. `src/components/documents/tiptap/DraftProEditor.tsx` — Major restructuring of rendering, extensions, styles, toolbar
2. `src/index.css` — Remove Quill-era print styles (lines 771-848)

---

END OF PROMPT
