
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import React from 'react';

/**
 * PartyRow — the Nigerian court-process party line, as a real layout row:
 *
 *   MERIDIAN AGRO PROCESSING LTD.     ……………………………     CLAIMANT
 *   (name, left margin)                (uniform leader)     (designation, RIGHT)
 *
 * Owner direction (2026-11-22, the DraftPro demo review): "the word claimant
 * should be a bit more to the right, sort of under where that suit number
 * is… the defendant should be again a bit further down… the word claimant
 * shouldn't be under BETWEEN, it should be across the screen. The dotted
 * lines — have them uniform and then bring them across the screen."
 *
 * The old renderer emitted `NAME .... CLAIMANT` as ONE plain paragraph with
 * a character-counted dot run — in a proportional font the designation
 * landed mid-page (visually under the centered BETWEEN), at a different
 * x-position for every party, and the leader broke across lines. This node
 * fixes the geometry structurally:
 *
 *   - flex row: name (left, editable) | leader (flex:1, one uniform dotted
 *     rule) | designation (right, editable) — so EVERY party's designation
 *     sits in the same right-hand column, aligned under the right-aligned
 *     SUIT NO / CASE NO line above it;
 *   - the leader is a single border-bottom dotted rule — perfectly uniform
 *     and spanning the full width between name and designation;
 *   - round-trips as <div data-type="party-row" data-designation="CLAIMANT">
 *     (renderHTML), so the print drawer, DOCX export (which maps it to a
 *     native Word right-tab + dot-leader paragraph — the way real pleadings
 *     are typed) and the editor all render the same geometry.
 */
export const PartyRow = Node.create({
    name: 'partyRow',
    group: 'block',
    // The party NAME is editable inline text; the designation is an attribute
    // (edited via the seamless input in the node view).
    content: 'text*',
    draggable: true,

    addAttributes() {
        return {
            designation: {
                default: 'CLAIMANT',
                parseHTML: element =>
                    element.getAttribute('data-designation') ||
                    element.getAttribute('data-capacity') ||
                    'CLAIMANT',
                renderHTML: attributes => ({
                    'data-designation': attributes.designation || 'CLAIMANT',
                }),
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'div[data-type="party-row"]',
                // The serialized row carries THREE spans (name | leader |
                // designation) but only the NAME is content — contentElement
                // restricts the parse to the first span, so the designation
                // text never leaks into the editable name (caught in the
                // live editor probe: "Meridian Agro Processing
                // Ltd.CLAIMANT" as one name run).
                contentElement: (el: HTMLElement) =>
                    (el.firstElementChild as HTMLElement) || el,
            },
            // Legacy attr name kept parseable so nothing already stored breaks.
            { tag: 'div[data-type="party-row"][data-capacity]' },
        ];
    },

    renderHTML({ HTMLAttributes, node }) {
        // Self-contained inline styles: raw-HTML consumers (the print
        // drawer's iframe, exported HTML previews) render the exact geometry
        // without knowing about this extension. The editor itself uses the
        // React node view below.
        return [
            'div',
            mergeAttributes(HTMLAttributes, {
                'data-type': 'party-row',
                'data-designation': node.attrs.designation || 'CLAIMANT',
                style:
                    'display:flex;align-items:baseline;gap:10px;' +
                    'margin:0 0 0.35em 0;break-inside:avoid;',
            }),
            ['span', { style: 'white-space:nowrap;' }, 0],
            [
                'span',
                {
                    'aria-hidden': 'true',
                    style:
                        'flex:1 1 auto;border-bottom:1.5pt dotted #111;' +
                        'transform:translateY(-0.22em);min-width:2em;',
                },
            ],
            [
                'span',
                {
                    style:
                        'white-space:nowrap;font-variant:all-small-caps;' +
                        'letter-spacing:0.06em;',
                },
                node.attrs.designation || 'CLAIMANT',
            ],
        ];
    },

    addNodeView() {
        return ReactNodeViewRenderer(PartyRowComponent);
    },
});

const PartyRowComponent: React.FC<any> = ({ node, updateAttributes, selected }) => {
    const designation = node.attrs.designation || 'CLAIMANT';
    return (
        <NodeViewWrapper
            as="div"
            className="party-row flex items-baseline gap-2.5 my-1.5 break-inside-avoid"
            style={{ display: 'flex', alignItems: 'baseline', gap: '10px', margin: '0 0 0.35em 0' }}
        >
            {/* The party name — editable document text. */}
            <NodeViewContent
                className="outline-none"
                style={{ whiteSpace: 'nowrap' }}
            />
            {/* The uniform dotted leader — one rule, full remaining width. */}
            <span
                aria-hidden="true"
                contentEditable={false}
                className="flex-1"
                style={{
                    borderBottom: '1.5pt dotted #111',
                    transform: 'translateY(-0.22em)',
                    minWidth: '2em',
                }}
            />
            {/* The designation — right-hand column, aligned under the
                right-aligned suit number. Small-caps so it reads as the
                printed designation line. */}
            <span
                contentEditable={false}
                className="flex-shrink-0"
                style={{ display: 'inline-flex', alignItems: 'baseline', gap: '4px' }}
            >
                <input
                    autoComplete="off"
                    data-lpignore="true"
                    aria-label="Party designation"
                    className="bg-transparent border-none outline-none p-0 w-[9.5em] text-right font-semibold uppercase tracking-widest text-[0.85em] text-slate-900 dark:text-white focus:ring-1 focus:ring-indigo-400 rounded-sm"
                    style={{ fontVariant: 'all-small-caps', letterSpacing: '0.06em' }}
                    value={designation}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateAttributes({ designation: e.target.value })
                    }
                />
            </span>
            {selected && (
                <span contentEditable={false} className="absolute -mt-6 text-2xs text-indigo-500 uppercase tracking-widest">
                    Party row
                </span>
            )}
        </NodeViewWrapper>
    );
};
