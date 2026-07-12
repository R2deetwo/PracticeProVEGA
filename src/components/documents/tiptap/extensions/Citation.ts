/**
 * Citation Mark — a TipTap inline mark that renders [n] citation markers
 * as styled superscript chips.
 *
 * Used by DraftPro to display citations that came from ALOA research mode.
 * The mark is non-inclusive (typing doesn't extend it) and carries the
 * citation ID so clicks can open a popover with source details.
 */
import { Mark, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        citation: {
            /** Toggle a citation mark at the current selection */
            toggleCitation: (citationId: string, citationNumber: number) => ReturnType;
        };
    }
}

export const Citation = Mark.create({
    name: 'citation',

    inclusive: false,

    addAttributes() {
        return {
            citationId: {
                default: null,
                parseHTML: element => element.getAttribute('data-citation-id'),
                renderHTML: attributes => {
                    if (!attributes.citationId) return {};
                    return { 'data-citation-id': attributes.citationId };
                },
            },
            citationNumber: {
                default: null,
                parseHTML: element => element.getAttribute('data-cite-num'),
                renderHTML: attributes => {
                    if (!attributes.citationNumber) return {};
                    return { 'data-cite-num': attributes.citationNumber };
                },
            },
        };
    },

    parseHTML() {
        return [
            { tag: 'sup[data-type="citation"]' },
            { tag: 'sup.citation-chip' },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return [
            'sup',
            mergeAttributes(HTMLAttributes, {
                'data-type': 'citation',
                class: 'citation-chip',
                contenteditable: 'false',
            }),
        ];
    },

    addCommands() {
        return {
            toggleCitation:
                (citationId: string, citationNumber: number) =>
                ({ commands }) => {
                    return commands.setMark(this.name, {
                        citationId,
                        citationNumber,
                    });
                },
        };
    },
});

export default Citation;
