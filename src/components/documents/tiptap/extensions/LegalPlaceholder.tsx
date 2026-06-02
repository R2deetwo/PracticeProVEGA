
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';

export default Node.create({
    name: 'legalPlaceholder',

    group: 'inline',

    inline: true,

    atom: true,

    addAttributes() {
        return {
            label: {
                default: 'PLACEHOLDER',
                parseHTML: element => element.getAttribute('data-label') || element.getAttribute('label'),
                renderHTML: attributes => {
                    if (!attributes.label) {
                        return {}
                    }
                    return {
                        'data-label': attributes.label,
                    }
                }
            },
            id: {
                default: null,
            }
        };
    },

    parseHTML() {
        return [
            {
                tag: 'span[data-type="legal-placeholder"]',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'legal-placeholder' }), 0];
    },

    addNodeView() {
        return ReactNodeViewRenderer(LegalPlaceholderComponent);
    },
});

const LegalPlaceholderComponent = (props: any) => {
    const { node, getPos, editor } = props;
    const label = node.attrs.label;

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        const event = new CustomEvent('open-placeholder-modal', { detail: { label } });
        window.dispatchEvent(event);
    };

    return (
        <NodeViewWrapper as="span" className="inline text-inherit cursor-pointer">
            <span
                onClick={handleClick}
                className="inline text-inherit border-b border-dashed border-amber-500 bg-amber-100/50 hover:bg-amber-100 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 transition-colors"
                style={{ padding: '0 2px' }}
                contentEditable={false}
                title="Click to Fill Blank"
            >
                [{label}]
            </span>
        </NodeViewWrapper>
    );
};
