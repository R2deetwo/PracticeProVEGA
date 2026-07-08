
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

export function resolveCategory(label: string, explicit?: string | null): PlaceholderCategory {
  if (explicit && CATEGORY_STYLES[explicit as PlaceholderCategory]) return explicit as PlaceholderCategory;
  // 1. Check the explicit registry first
  const def = getPlaceholderDef(label);
  if (def) return def.category;
  // 2. Pattern-based fallback for placeholders not in the registry
  const n = label.trim().toUpperCase();
  // Duration/count labels should NOT be dates — they're quantities, not calendar dates
  // e.g. [NUMBER OF DAYS], [NOTICE PERIOD IN WEEKS], [LEASE TERM IN YEARS]
  const isDuration = /\b(NUMBER|COUNT|QUANTITY|DURATION|PERIOD|TERM|LENGTH)\b/.test(n)
    || /\b(DAYS|WEEKS|MONTHS|YEARS|HOURS|MINUTES)\b/.test(n);
  if (isDuration) return 'freetext';
  if (/(NAME|PARTY|COUNSEL|TENANT|LANDLORD|GUARANTOR|DEPONENT|JUDGE|WITNESS|CLAIMANT|DEFENDANT|APPLICANT|RESPONDENT|PETITIONER|TRUSTEE|BENEFICIARY|DIRECTOR|SHAREHOLDER|EXECUTOR|ADMINISTRATOR|GUARDIAN|ATTORNEY|SOLICITOR|BARRISTER|NOTARY)/.test(n)) return 'parties';
  if (/(DATE|DAY|MONTH|YEAR|TIME|DEADLINE|HEARING|EXPIR|COMMENCEMENT|TERMINATION|EFFECTIVE)/.test(n)) return 'dates';
  if (/(AMOUNT|FEE|CHARGE|RENT|DEPOSIT|PAYMENT|COST|PRICE|SUM|MONEY|NAIRA|DOLLAR|PENALTY|RATE|SALARY|WAGE|INCOME|REVENUE|TAX|VAT|DISCOUNT|BALANCE|TOTAL)/.test(n)) return 'financial';
  if (/(ADDRESS|LOCATION|STREET|AVENUE|ROAD|CITY|STATE|COUNTRY|LGA|PLOT|ZONE|DISTRICT|REGION|AREA)/.test(n)) return 'location';
  if (/(COURT|SUIT|CASE|MATTER|JURISDICTION|CAUSE|RELIEF|EXHIBIT|ORDER|RULE|GROUND|TRIBUNAL|CHAMBER|REGISTRY)/.test(n)) return 'court';
  if (/(FIRM|SOLICITOR|PRACTICE|CHAMBERS|OFFICE|REG|REGISTRATION)/.test(n)) return 'firm';
  return 'freetext';
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
