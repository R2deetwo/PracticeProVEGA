
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { getPlaceholderDef, PlaceholderCategory } from '../../../../constants/placeholderRegistry';

/**
 * Category colour system — HIGHLIGHT, not text colour (2026-09-24 user
 * feedback: "the colors are not very legible — is it possible to have a
 * highlight rather than change the color of the text so that it is more
 * legible").
 *
 * The placeholder text keeps the document's own ink colour (inherited,
 * always near-black on the white A4 sheet); the category colour is
 * applied as a translucent background band — like a highlighter pen —
 * plus a thin left/right colour core via the dashed underline. This is
 * dramatically more legible than re-dying the letters themselves.
 */
const CATEGORY_STYLES: Record<PlaceholderCategory, { border: string; bg: string; dot: string; abbr: string }> = {
  parties:   { border: 'border-blue-600',   bg: 'bg-blue-200/70',    dot: 'bg-blue-500',    abbr: 'P' },
  dates:     { border: 'border-purple-600', bg: 'bg-purple-200/70',  dot: 'bg-purple-500',  abbr: 'D' },
  financial: { border: 'border-green-600',  bg: 'bg-green-200/70',   dot: 'bg-green-500',   abbr: '$' },
  location:  { border: 'border-teal-600',   bg: 'bg-teal-200/70',    dot: 'bg-teal-500',    abbr: 'A' },
  court:     { border: 'border-rose-600',   bg: 'bg-rose-200/70',    dot: 'bg-rose-500',    abbr: 'C' },
  firm:      { border: 'border-indigo-600', bg: 'bg-indigo-200/70',  dot: 'bg-indigo-500',  abbr: 'F' },
  freetext:  { border: 'border-amber-600',  bg: 'bg-amber-200/70',   dot: 'bg-amber-500',   abbr: 'T' },
};

// Safe fallback for any category string that isn't in CATEGORY_STYLES.
// This prevents a TypeError ("Cannot read properties of undefined")
// when the AI emits a data-category value we don't recognize.
const SAFE_FALLBACK_STYLE = CATEGORY_STYLES.freetext;

function safeGetStyle(category: string | null | undefined) {
  if (!category) return SAFE_FALLBACK_STYLE;
  return CATEGORY_STYLES[category as PlaceholderCategory] ?? SAFE_FALLBACK_STYLE;
}

export function resolveCategory(label: string, explicit?: string | null): PlaceholderCategory {
  if (explicit && CATEGORY_STYLES[explicit as PlaceholderCategory]) return explicit as PlaceholderCategory;
  // 1. Check the explicit registry first
  const def = getPlaceholderDef(label);
  if (def) return def.category;
  // 2. Pattern-based fallback for placeholders not in the registry
  const n = label.trim().toUpperCase();
  // Court reference numbers ("SUIT NUMBER", "SUIT NO", "CASE NUMBER") are
  // COURT facts, not durations — checked before the quantity heuristic so
  // the word "NUMBER" alone doesn't misfile them.
  if (/^(SUIT|CASE|MATTER|CAUSE)\s*(NO|NUMBER)/.test(n)) return 'court';
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
          // Validate the explicit category against our known set.
          // If the AI emitted an unrecognized data-category value,
          // fall back to resolving from the label rather than
          // passing through an invalid string that could crash
          // the React node view.
          if (explicit && CATEGORY_STYLES[explicit as PlaceholderCategory]) {
            return explicit;
          }
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
    // CRITICAL: Do NOT include a content hole (the `0` argument) here.
    // This node is `atom: true` (a leaf node — it has no children).
    // ProseMirror throws "Content hole not allowed in a leaf node spec"
    // when renderHTML includes `0` on an atom node. This was the root
    // cause of the DraftPro crash after draft completion — the crash
    // happened whenever editor.getHTML() was called (during save,
    // content change, or persistence), because ProseMirror tried to
    // serialize the legalPlaceholder nodes and hit the invalid spec.
    return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'legal-placeholder' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(LegalPlaceholderComponent);
  },
});

const LegalPlaceholderComponent = (props: any) => {
  const { node } = props;
  const label = node.attrs.label || 'PLACEHOLDER';
  const category = resolveCategory(label, node.attrs.category);
  // Use the safe getter — if category is somehow invalid (shouldn't happen
  // after the parseHTML fix, but defensive), we fall back to freetext style
  // instead of crashing the entire editor.
  const style = safeGetStyle(category);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const event = new CustomEvent('open-placeholder-modal', { detail: { label } });
    window.dispatchEvent(event);
  };

  return (
    <NodeViewWrapper as="span" className="inline text-inherit cursor-pointer" style={{ display: 'inline' }}>
      <span
        onClick={handleClick}
        className={`inline border-b border-dashed ${style.border} ${style.bg} rounded-sm hover:opacity-80 transition-opacity`}
        style={{ padding: '0 3px', display: 'inline', WebkitBoxDecorationBreak: 'clone', boxDecorationBreak: 'clone' }}
        contentEditable={false}
        title={`${label} — click to fill (${category})`}
      >
        <span
          className={`inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle ${style.dot}`}
          style={{ fontSize: 0, lineHeight: 0 }}
          aria-hidden="true"
        />
        {label}
      </span>
    </NodeViewWrapper>
  );
};
