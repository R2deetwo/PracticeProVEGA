import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';

export default Node.create({
    name: 'legalContext',

    group: 'inline',

    inline: true,

    atom: true,

    addAttributes() {
        return {
            label: {
                default: 'CONTEXT',
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
        };
    },

    parseHTML() {
        return [
            {
                tag: 'span[data-type="legal-context"]',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        // CRITICAL: Do NOT include a content hole (the `0` argument) here.
        // This node is `atom: true` (a leaf node — it has no children).
        // ProseMirror throws "Content hole not allowed in a leaf node spec"
        // when renderHTML includes `0` on an atom node.
        return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'legal-context' })];
    },

    addNodeView() {
        return ReactNodeViewRenderer(LegalContextComponent);
    },
});

const LegalContextComponent = (props: any) => {
    const { node } = props;
    const label = node.attrs.label;

    return (
        <NodeViewWrapper as="span" className="inline text-inherit">
            <span
                className="inline text-inherit border-b border-solid border-primary-500 bg-primary-100/50 hover:bg-primary-100 dark:bg-primary-900/30 dark:hover:bg-primary-900/50 transition-colors"
                style={{ padding: '0 4px', borderRadius: '4px' }}
                contentEditable={false}
                title="Matter Context (Verify)"
            >
                {label}
            </span>
        </NodeViewWrapper>
    );
};
