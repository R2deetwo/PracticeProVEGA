/**
 * PageBreak TipTap Extension
 *
 * A block-level atom node that represents an explicit page break in the
 * document model.
 *
 * Visual: dashed "— Page Break —" rule in the editor
 * Print:  maps to CSS `break-after: page` so physical printers see a real page break
 * Shortcut: Ctrl/Cmd + Enter
 */

import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        pageBreak: {
            /** Insert a page break at the current cursor position */
            setPageBreak: () => ReturnType;
            /** Remove the pageBreak node that contains/precedes the selection */
            unsetPageBreak: () => ReturnType;
        };
    }
}

export const PageBreak = Node.create({
    name: 'pageBreak',

    group: 'block',

    atom: true,

    selectable: true,

    draggable: false,

    addAttributes() {
        return {
            /** True when the user manually inserted this break (vs. future auto-pagination) */
            manual: {
                default: true,
                parseHTML: el => el.getAttribute('data-manual') !== 'false',
                renderHTML: attrs => ({ 'data-manual': String(attrs.manual) }),
            },
        };
    },

    parseHTML() {
        return [
            { tag: 'div[data-type="page-break"]' },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return [
            'div',
            mergeAttributes(HTMLAttributes, {
                'data-type': 'page-break',
                class: 'page-break-node',
                contenteditable: 'false',
            }),
        ];
    },

    addCommands() {
        return {
            setPageBreak:
                () =>
                ({ chain }) => {
                    return chain()
                        .insertContent({ type: this.name, attrs: { manual: true } })
                        .run();
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

export default PageBreak;
