
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { getPlaceholderDef, PlaceholderCategory } from '../../../../constants/placeholderRegistry';

const CATEGORY_STYLES: Record<PlaceholderCategory, { border: string; bg: string; text: string; abbr: string }> = {
  parties:   { border: 'border-blue-500',   bg: 'bg-blue-100/50',   text: 'text-blue-900 dark:text-blue-200',   abbr: 'P' },
  dates:     { border: 'border-purple-500', bg: 'bg-purple-100/50', text: 'text-purple-900 dark:text-purple-200', abbr: 'D' },
  financial: { border: 'border-green-500',  bg: 'bg-green-100/50',  text: 'text-green-900 dark:text-green-200',  abbr: '$' },
  location:  { border: 'border-teal-500',   bg: 'bg-teal-100/50',   text: 'text-teal-900 dark:text-teal-200',   abbr: 'A' },
  court:     { border: 'border-rose-500',   bg: 'bg-rose-100/50',   text: 'text-rose-900 dark:text-rose-200',   abbr: 'C' },
  firm:      { border: 'border-indigo-500', bg: 'bg-indigo-100/50', text: 'text-indigo-900 dark:text-indigo-200', abbr: 'F' },
  freetext:  { border: 'border-amber-500',  bg: 'bg-amber-100/50',  text: 'text-amber-900 dark:text-amber-200',  abbr: 'T' },
};

function resolveCategory(label: string, explicit?: string | null): PlaceholderCategory {
  if (explicit && CATEGORY_STYLES[explicit as PlaceholderCategory]) return explicit as PlaceholderCategory;
  return getPlaceholderDef(label)?.category ?? 'freetext';
}

export default Node.create({
  name: 'legalPlaceholder',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      label: {
        default: 'PLACEHOLDER',
        parseHTML: element => element.getAttribute('data-label') || element.getAttribute('label') || 'PLACEHOLDER',
        renderHTML: attributes => attributes.label ? { 'data-label': attributes.label } : {},
      },
      category: {
        default: null,
        parseHTML: element => {
          const explicit = element.getAttribute('data-category');
          if (explicit) return explicit;
          const label = element.getAttribute('data-label') || '';
          return resolveCategory(label, null);
        },
        renderHTML: attributes => attributes.category ? { 'data-category': attributes.category } : {},
      },
      id: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="legal-placeholder"]' }];
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
  const label = node.attrs.label || 'PLACEHOLDER';
  const category = resolveCategory(label, node.attrs.category);
  const style = CATEGORY_STYLES[category];

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const event = new CustomEvent('open-placeholder-modal', { detail: { label } });
    window.dispatchEvent(event);
  };

  return (
    <NodeViewWrapper as="span" className="inline text-inherit cursor-pointer">
      <span
        onClick={handleClick}
        className={`inline-flex items-center gap-0.5 border-b border-dashed ${style.border} ${style.bg} ${style.text} rounded-sm hover:opacity-80 transition-opacity`}
        style={{ padding: '0 2px' }}
        contentEditable={false}
        title={`Click to Fill — ${category}`}
      >
        {label}
      </span>
    </NodeViewWrapper>
  );
};
