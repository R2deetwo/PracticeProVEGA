
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import React from 'react';

/**
 * LegalPartiesGroup — A custom Tiptap extension for Nigerian Court Processes.
 * Renders a block where multiple parties can be grouped with a large bracket
 * and a label/arrow pointing to their designation (e.g., "1st - 5th CLAIMANTS").
 */
export const LegalPartiesGroup = Node.create({
    name: 'legalPartiesGroup',
    group: 'block',
    content: 'block+', // Allows paragraphs/lists inside
    draggable: true,

    addAttributes() {
        return {
            label: {
                default: 'CLAIMANTS',
                parseHTML: element => element.getAttribute('data-label'),
                renderHTML: attributes => ({ 'data-label': attributes.label }),
            },
        };
    },

    parseHTML() {
        return [{ tag: 'div[data-type="legal-parties-group"]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'legal-parties-group' }), 0];
    },

    addNodeView() {
        return ReactNodeViewRenderer(LegalPartiesGroupComponent);
    },
});

const LegalPartiesGroupComponent: React.FC<any> = ({ node, updateAttributes }) => {
    return (
        <NodeViewWrapper className="legal-parties-group flex items-center gap-8 my-8 group relative">
            {/* The Left Side (Content area for names) */}
            <div className="flex-1 relative border-r-2 border-slate-900 dark:border-white py-4 pr-6">
                <NodeViewContent className="outline-none" />
                
                {/* Decorative Brackets (Top/Bottom tips) */}
                <div className="absolute top-0 right-0 w-4 h-0.5 bg-slate-900 dark:bg-white" />
                <div className="absolute bottom-0 right-0 w-4 h-0.5 bg-slate-900 dark:bg-white" />
                
                {/* Arrow Pointer */}
                <div className="absolute top-1/2 -right-[1px] translate-y-[-50%] flex items-center">
                    <div className="w-8 h-0.5 bg-slate-900 dark:bg-white" />
                    <div className="w-2 h-2 border-t-2 border-r-2 border-slate-900 dark:border-white rotate-45 -ml-1" />
                </div>
            </div>

            {/* The Right Side (Label/Designation) */}
            <div className="flex-shrink-0 min-w-[120px]">
                <input autoComplete="off" data-lpignore="true" 
                    className="bg-transparent border-none outline-none font-bold text-sm uppercase tracking-widest text-slate-900 dark:text-white w-full focus:ring-0"
                    value={node.attrs.label}
                    onChange={e => updateAttributes({ label: e.target.value })}
                    placeholder="DESIGNATION"
                />
                <div className="text-[10px] font-medium text-slate-400 dark:text-zinc-500 uppercase mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    Designation
                </div>
            </div>

            {/* Drag Handle Overlay (Optional) */}
            <div className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                </svg>
            </div>
        </NodeViewWrapper>
    );
};
