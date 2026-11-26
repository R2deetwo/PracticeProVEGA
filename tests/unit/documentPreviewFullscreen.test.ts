// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

vi.mock('../../src/components/documents/PdfViewer', () => ({ default: () => null }));
vi.mock('../../src/components/documents/HtmlPagePreview', () => ({ default: () => null }));
vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);

import DocumentPreviewModal from '../../src/components/documents/DocumentPreviewModal';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolvePath(here, '../..');
const read = (path: string) => readFileSync(resolvePath(repoRoot, path), 'utf-8');
const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(() => {
    for (const root of roots.splice(0)) {
        act(() => root.unmount());
    }
    document.body.innerHTML = '';
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
});

describe('full-screen document reader', () => {
    it('portals the preview above split-pane and app-shell stacking contexts', async () => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        const root = createRoot(host);
        roots.push(root);

        await act(async () => {
            root.render(React.createElement(DocumentPreviewModal, {
                html: '<p>Selectable text</p>',
                title: 'Document preview',
                onClose: vi.fn(),
            }));
        });

        const overlay = document.body.querySelector('[data-document-preview-overlay]');
        expect(overlay?.parentElement).toBe(document.body);
        expect(host.contains(overlay)).toBe(false);
    });

    it('exposes selectable PDF and HTML text without consuming native find shortcuts', () => {
        const pdfViewer = read('src/components/documents/PdfViewer.tsx');
        const htmlPreview = read('src/components/documents/HtmlPagePreview.tsx');
        const globalStyles = read('src/index.css');

        expect(pdfViewer).toContain('new pdfjsLib.TextLayer');
        expect(pdfViewer).toContain('className="pdfjs-text-layer selectable"');
        expect(pdfViewer).toContain('enableTextSelection={!!isFullScreen}');
        expect(pdfViewer).toMatch(/e\.key === 'f'[\s\S]*?!e\.ctrlKey && !e\.metaKey/);
        expect(htmlPreview).toContain('selectable={isFullScreen}');
        expect(htmlPreview).toMatch(/e\.key === 'f'[\s\S]*?!e\.ctrlKey && !e\.metaKey/);
        expect(globalStyles).toContain('.pdfjs-text-layer ::selection');
        expect(globalStyles).toMatch(/\.selectable,\s*\.selectable \*[\s\S]*user-select: text !important/);
    });

    it('wraps long document titles and keeps status pills readable in dark mode', () => {
        const documentList = read('src/components/DocumentList.tsx');

        expect(documentList).toContain('whitespace-normal break-words">{doc.title}</p>');
        expect(documentList).toContain('flex flex-wrap items-center gap-x-2 gap-y-1');
        expect(documentList).toContain('dark:text-green-300');
        expect(documentList).toContain('dark:text-blue-300');
        expect(documentList).toContain('dark:text-orange-300');
    });
});
