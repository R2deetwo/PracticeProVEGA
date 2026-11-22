/**
 * legal/drafting/astToHtml.ts — the ONE renderer from DocumentAST to the
 * HTML the whole product consumes (owner spec 2026-11-19, §1 + §7).
 *
 *   DocumentAST ──astToHtml──>  TipTap editor content
 *                            └> DOCX export (docxExport.ts)
 *                            └> PDF/print pipeline (PAGE_CSS_PRINT)
 *
 * There is NO other generation path: editor, DOCX and PDF all render this
 * same output, so what the lawyer sees is what files.
 *
 * Court-layout styling (spec §7.1): centred caps heading, right-aligned
 * case number, party blocks as STRUCTURAL rows (name left, one uniform
 * dotted leader, designation in a right-hand column under the case number
 * — the PartyRow node), centred bold underlined process titles, numbered
 * paragraphs as real lists, right-aligned franking block, page breaks
 * between bundle documents.
 *
 * Placeholders: both typed `placeholder` Slots and `[[LABEL]]` markers in
 * literal text render as legal-placeholder pills (the TipTap
 * LegalPlaceholder node; DOCX exports them as bold [LABEL] text; print CSS
 * shows them bracketed). The counsel-review banner is NOT part of this
 * output — it is an editor-only overlay (AC6.2).
 *
 * Pure function; no DOM needed at render time.
 */

import type { Block, DraftBundle, Slot } from "./types";

/** Convert `[[LABEL]]` markers inside literal text to placeholder pills. */
function inlineText(text: string): string {
  return escapeHtml(text).replace(
    /\[\[([^\]]+)\]\]/g,
    (_m, label: string) =>
      `<span data-type="legal-placeholder" data-label="${label.trim()}"></span>`
  );
}

function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderSlot(slot: Slot): string {
  switch (slot.kind) {
    case "literal":
    case "hydrated":
    case "prose":
      return inlineText(slot.text);
    case "placeholder":
      return `<span data-type="legal-placeholder" data-label="${escapeHtml(slot.label)}"></span>`;
  }
}

/**
 * One Nigerian court-process party line, as a STRUCTURAL row (2026-11-22
 * owner direction, the DraftPro demo review): the party name sits at the
 * left margin, a single uniform dotted leader spans the middle, and the
 * designation (CLAIMANT / DEFENDANT / APPLICANT …) sits in a right-hand
 * column — aligned under the right-aligned case number above it. The old
 * renderer counted dots per name (`64 - name.length`), so in a proportional
 * font every designation landed mid-page at a different x-position
 * (visually under the centered BETWEEN) and the leaders broke across
 * lines. The row is emitted as a party-row div (the TipTap PartyRow node;
 * the DOCX export maps it to a native right-tab + dot-leader paragraph).
 */
function partyRow(p: { name: string; capacity: string }): string {
  // The name goes through inlineText so [[LABEL]] fallbacks render as
  // placeholder pills inside the row's name span.
  const name = inlineText(p.name);
  const designation = escapeHtml(p.capacity);
  return (
    `<div data-type="party-row" data-designation="${designation}"` +
    ` style="display:flex;align-items:baseline;gap:10px;margin:0 0 0.35em 0;break-inside:avoid;">` +
    `<span style="white-space:nowrap;">${name}</span>` +
    `<span aria-hidden="true" style="flex:1 1 auto;border-bottom:1.5pt dotted #111;transform:translateY(-0.22em);min-width:2em;"></span>` +
    `<span style="white-space:nowrap;font-variant:all-small-caps;letter-spacing:0.06em;">${designation}</span>` +
    `</div>`
  );
}

function renderBlock(b: Block): string {
  switch (b.t) {
    case "courtHeading":
      return b.lines
        .map(
          (line) =>
            `<p data-align="center" style="text-align: center;"><strong>${inlineText(line.toUpperCase())}</strong></p>`
        )
        .join("");
    case "caseNumber":
      return `<p data-align="right" style="text-align: right;">${renderSlot(b.value)}</p>`;
    case "partiesBlock": {
      const parts: string[] = [];
      b.parties.forEach((p, i) => {
        parts.push(
          `<p data-align="center" style="text-align: center;">${i === 0 ? escapeHtml(b.connectors) : "AND"}</p>`
        );
        parts.push(partyRow(p));
      });
      return parts.join("");
    }
    case "processTitle":
      return `<p data-align="center" style="text-align: center;"><strong><u>${inlineText(b.text.toUpperCase())}</u></strong></p>`;
    case "clause":
      return `<p>${renderSlot(b.text)}</p>`;
    case "numbered": {
      const items = b.items.map((s) => `<li><p>${renderSlot(s)}</p></li>`).join("");
      return `<ol>${items}</ol>`;
    }
    case "section": {
      const heading = `${b.number ? b.number + " " : ""}${b.heading}`.trim();
      const children = b.children.map(renderBlock).join("");
      return `<h3>${inlineText(heading)}</h3>${children}`;
    }
    case "dateLine":
      return `<p data-align="right" style="text-align: right;">${renderSlot(b.value)}</p>`;
    case "frankingBlock":
      return `<div>
<p data-align="right" style="text-align: right;">________________________</p>
<p data-align="right" style="text-align: right;">(Counsel) for the ${escapeHtml(b.party)}</p>
<p data-align="right" style="text-align: right;">${renderSlot(b.counsel)}</p>
<p data-align="right" style="text-align: right;">${renderSlot(b.firm)}</p>
<p data-align="right" style="text-align: right;">${renderSlot(b.address)}</p>
<p data-align="right" style="text-align: right;">${renderSlot(b.email)}</p>
<p data-align="right" style="text-align: right;">${renderSlot(b.phone)}</p>
</div>`;
    case "serviceBlock":
      return `<div><p><strong>FOR SERVICE ON:</strong></p>${b.recipients
        .map((s) => `<p>${renderSlot(s)}</p>`)
        .join("")}</div>`;
    case "jurat":
      return `<div>
<p>SWORN TO at ${renderSlot(b.place)} this _____ day of _______________, 20___</p>
<p data-align="center" style="text-align: center;">BEFORE ME</p>
<p data-align="center" style="text-align: center;">________________________</p>
<p data-align="center" style="text-align: center;"><strong>COMMISSIONER FOR OATHS</strong></p>
</div>`;
    case "signature":
      return `<div>
${b.label ? `<p><strong>${escapeHtml(b.label)}</strong></p>` : ""}
<p>${renderSlot(b.name)}</p>
</div>`;
    case "letterhead":
      return `<div class="letterhead"><p data-align="center" style="text-align: center;"><strong>${renderSlot(b.firm)}</strong></p></div>`;
    case "recipient":
      return b.lines.map((s) => `<p>${renderSlot(s)}</p>`).join("");
    case "subjectLine":
      return `<p data-align="center" style="text-align: center;"><strong><u>${renderSlot(b.text)}</u></strong></p>`;
    case "pageBreak":
      return `<div class="page-break" data-type="page-break"></div>`;
  }
}

/** Render ONE DocumentAST to editor/export HTML. */
export function astToHtml(ast: { blocks: Block[] }): string {
  return ast.blocks.map(renderBlock).join("");
}

/** Render a whole bundle, documents separated by page breaks. */
export function bundleToHtml(bundle: DraftBundle): string {
  return bundle.documents.map((d) => astToHtml(d)).join(renderBlock({ t: "pageBreak" }));
}
