/**
 * legal/drafting/assemble.ts — Stage 3: assembling the DraftBundle and the
 * deterministic validators behind it (owner spec 2026-11-19, §5d + §8 Phase 5).
 *
 *   blueprint + HydratedDraftContext + prose fills  --(pure code)-->  DraftBundle
 *
 * Also here:
 *   - collectProseSlotSpecs / buildProseFillPrompt — the LLM's ONLY job:
 *     filling bounded prose slots, one batched strict-JSON call per document.
 *   - validateProseFill — rejects court furniture, markdown headers,
 *     unverified citations (scrubbed to verify-pills), argument in affidavit
 *     slots (Evidence Act), over-length fills.
 *   - validateAST — per-category structural validation (AC3.2).
 *   - computeMissingFields — CODE diff of each template's requiredFields
 *     against what voice + matter + firm supplied (spec §4.6 — the LLM is
 *     never asked for this).
 *   - Editor transforms: findPlaceholders / fillSlot / numbered-item edits
 *     for placeholder navigation and voice editing (spec §7.3/§7.4).
 *
 * Pure functions; zero DOM/state.
 */

import type {
  Block,
  DocumentType,
  DraftBlueprint,
  DraftBundle,
  HydratedDraftContext,
  MissingField,
  ProseSlotSpec,
  Slot,
} from "./types";
import { TEMPLATES } from "./templates/registry";
import { scrubUnverifiedCitations, type AuthorityEntry } from "./authorityLibrary";

// ─── Assembly ───────────────────────────────────────────────────────────────

export interface AssembleArgs {
  blueprint: DraftBlueprint;
  ctx: HydratedDraftContext;
  /** documentIndex → slotKey → generated text. */
  fills: Record<number, Record<string, string>>;
}

export function assembleBundle(args: AssembleArgs): DraftBundle {
  const documents = args.blueprint.documents.map((d, i) => {
    const template = TEMPLATES[d.documentType];
    const fills = args.fills[i] || {};
    const ast = template.build(args.ctx, fills);
    return { ...ast, id: `${d.documentType}-${i}` };
  });
  return {
    bundleId: `bundle-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    documents,
  };
}

/** Every prose slot the bundle needs (drives the batched LLM calls). */
export function collectProseSlotSpecs(blueprint: DraftBlueprint): Array<{
  documentIndex: number;
  documentType: DocumentType;
  spec: ProseSlotSpec;
}> {
  const out: Array<{ documentIndex: number; documentType: DocumentType; spec: ProseSlotSpec }> = [];
  blueprint.documents.forEach((d, i) => {
    for (const spec of TEMPLATES[d.documentType].proseSlots) {
      out.push({ documentIndex: i, documentType: d.documentType, spec });
    }
  });
  return out;
}

// ─── The prose-fill prompt (the LLM's bounded job) ──────────────────────────

export function buildProseFillPrompt(args: {
  documentType: DocumentType;
  specs: ProseSlotSpec[];
  dictated: DraftBlueprint["dictated"];
  matterNotes: string[];
  /** Paragraphs of the sibling affidavit (bundle consistency; AC3.6). */
  siblingAffidavitParagraphs?: string[];
  exhibitLetters?: string[];
}): { system: string; user: string } {
  const slotLines = args.specs
    .map(
      (s) =>
        `- "${s.key}" (${s.label}; ≤${s.maxLength} chars; ${s.shape}${
          s.factsOnly ? "; FACTS ONLY — no argument, no opinion, no legal conclusions, no citations" : ""
        }): ${s.contract}`
    )
    .join("\n");
  const dictated = args.dictated;
  const dictatedBlock = [
    dictated.reliefs.length ? `RELIEFS DICTATED:\n${dictated.reliefs.map((r) => `- ${r}`).join("\n")}` : "",
    dictated.groundsOrFacts.length
      ? `FACTS/GROUNDS DICTATED:\n${dictated.groundsOrFacts.map((r) => `- ${r}`).join("\n")}`
      : "",
    dictated.amounts.length
      ? `AMOUNTS: ${dictated.amounts.map((a) => `${a.label}: ${a.currency} ${a.amount}`).join("; ")}`
      : "",
    dictated.periods.length
      ? `PERIODS: ${dictated.periods.map((p) => `${p.label}: ${p.value} ${p.unit}`).join("; ")}`
      : "",
    dictated.dates.length ? `DATES: ${dictated.dates.map((d) => `${d.label}: ${d.iso}`).join("; ")}` : "",
    dictated.namedPeople.length
      ? `PEOPLE: ${dictated.namedPeople.map((p) => `${p.name} (${p.role})`).join("; ")}`
      : "",
    dictated.specialInstructions.length
      ? `SPECIAL INSTRUCTIONS: ${dictated.specialInstructions.join("; ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const system = `You fill BOUNDED prose slots of a Nigerian legal document. The document's structure (court captions, parties blocks, titles, jurats, signature blocks) is generated deterministically by code — you NEVER write it.

HARD RULES:
1. Write ONLY the content of each slot — numbered paragraphs or plain prose per the slot's shape. NO headings, NO court captions, NO markdown (#, **), NO "IN THE HIGH COURT…", NO suit numbers, NO signature blocks.
2. Use ONLY the dictated content and the matter notes provided. NEVER invent facts, parties, dates, amounts or reliefs. Missing facts stay missing — the app renders placeholder pills.
3. Preserve names, dates, amounts (₦), citations and legal terminology EXACTLY as dictated.
4. NEVER invent a case citation or a statute section number. If a proposition of law is needed, state the proposition plainly without a citation (an unverified citation will be stripped).
5. Professional Nigerian legal register. Nigerian English spellings (judgement, defence).

Respond with STRICT JSON only — no prose, no markdown fences:
{"<slotKey>": "<slot content>", …}`;

  const user = `DOCUMENT TYPE: ${args.documentType.replace(/_/g, " ").toUpperCase()}

SLOTS TO FILL:
${slotLines}

${dictatedBlock || "(no dictated content — draft from the matter notes only, and only what they support)"}

${args.matterNotes.length ? `MATTER NOTES:\n${args.matterNotes.slice(-6).join("\n---\n").slice(0, 8000)}` : ""}

${
  args.siblingAffidavitParagraphs?.length
    ? `SIBLING AFFIDAVIT PARAGRAPHS (for the facts slot — keep the same numbering so cross-references match):\n${args.siblingAffidavitParagraphs
        .map((p, i) => `${i + 1}. ${p}`)
        .join("\n")
        .slice(0, 8000)}`
    : ""
}

${
  args.exhibitLetters?.length
    ? `EXHIBITS ALREADY LETTERED ACROSS THIS BUNDLE (refer to them with these exact letters): ${args.exhibitLetters
        .map((e) => `EXHIBIT ${e}`)
        .join(", ")}`
    : ""
}`;

  return { system, user };
}

// ─── Prose fill validation ──────────────────────────────────────────────────

/** Court furniture / markdown the LLM must never emit into a slot. */
const FURNITURE_RE =
  /\b(IN THE (HIGH|FEDERAL|SUPREME|INDUSTRIAL) COURT|SUIT NO|APPEAL NO|MOTION NO|COURT OF APPEAL OF NIGERIA|BEFORE ME|COMMISSIONER FOR OATHS)\b/i;

export interface FillValidation {
  ok: boolean;
  reason?: string;
  text: string;
}

/** Argument/opinion markers banned from affidavit slots (Evidence Act). */
const AFFIDAVIT_ARGUMENT_RE =
  /\b(it is (respectfully )?(submitted|argued|contended)|we submit|counsel submits|it is trite|the law is settled|in our submission|authorities? hold|it is humbly submitted|in my (considered )?opinion|i believe that|it follows that the court (should|ought))\b/i;

/**
 * Validate one generated fill. Rejects (with reason) or scrubs:
 *   - court furniture / markdown headers → REJECT (the model disobeyed);
 *   - unverified citations → SCRUBBED to verify-pills (AC6.1);
 *   - argument in factsOnly (affidavit) slots → REJECT (AC3.3);
 *   - over-length → truncated to the slot cap.
 */
export function validateProseFill(
  spec: ProseSlotSpec,
  text: string,
  library: AuthorityEntry[]
): FillValidation {
  const t = (text || "").trim();
  if (!t) return { ok: false, reason: "empty fill", text: "" };
  if (FURNITURE_RE.test(t)) {
    return { ok: false, reason: "court furniture detected in prose slot", text: "" };
  }
  if (/(^|\n)\s*#{1,6}\s|\*\*|__(?!\w)/.test(t)) {
    return { ok: false, reason: "markdown formatting detected", text: "" };
  }
  if (spec.factsOnly && AFFIDAVIT_ARGUMENT_RE.test(t)) {
    return { ok: false, reason: "argument/opinion in facts-only (affidavit) slot", text: "" };
  }
  // Scrub unverified citations — they NEVER reach the AST as literal text.
  const scrubbed = scrubUnverifiedCitations(t, library);
  return { ok: true, text: scrubbed.text.slice(0, spec.maxLength) };
}

// ─── Structural AST validation (AC3.2) ──────────────────────────────────────

type BlockT = Block["t"];

function blockTypes(blocks: Block[]): BlockT[] {
  const out: BlockT[] = [];
  for (const b of blocks) {
    out.push(b.t);
    if (b.t === "section") out.push(...blockTypes(b.children));
  }
  return out;
}

/** Required block types per document family (structural contract). */
const REQUIRED_BLOCKS: Partial<Record<DocumentType, BlockT[]>> = {
  motion_on_notice: ["courtHeading", "caseNumber", "partiesBlock", "processTitle", "numbered", "dateLine", "frankingBlock", "serviceBlock"],
  motion_ex_parte: ["courtHeading", "caseNumber", "partiesBlock", "processTitle", "numbered", "dateLine", "frankingBlock"],
  notice_of_preliminary_objection: ["courtHeading", "caseNumber", "partiesBlock", "processTitle", "numbered", "dateLine", "frankingBlock", "serviceBlock"],
  motion_for_leave_or_extension: ["courtHeading", "caseNumber", "partiesBlock", "processTitle", "numbered", "dateLine", "frankingBlock", "serviceBlock"],
  stay_of_execution: ["courtHeading", "caseNumber", "partiesBlock", "processTitle", "numbered", "dateLine", "frankingBlock", "serviceBlock"],
  garnishee_application: ["courtHeading", "caseNumber", "partiesBlock", "processTitle", "numbered", "dateLine", "frankingBlock", "serviceBlock"],
  supporting_affidavit: ["courtHeading", "caseNumber", "partiesBlock", "processTitle", "numbered", "signature", "jurat"],
  counter_affidavit: ["courtHeading", "caseNumber", "partiesBlock", "processTitle", "numbered", "signature", "jurat"],
  further_and_better_affidavit: ["courtHeading", "caseNumber", "partiesBlock", "processTitle", "numbered", "signature", "jurat"],
  witness_statement_on_oath: ["courtHeading", "caseNumber", "partiesBlock", "processTitle", "numbered", "signature", "jurat"],
  statement_of_claim: ["courtHeading", "caseNumber", "partiesBlock", "processTitle", "numbered", "dateLine", "frankingBlock", "serviceBlock"],
  statement_of_defence: ["courtHeading", "caseNumber", "partiesBlock", "processTitle", "numbered", "dateLine", "frankingBlock", "serviceBlock"],
  writ_of_summons: ["courtHeading", "caseNumber", "partiesBlock", "processTitle", "dateLine", "frankingBlock", "serviceBlock"],
  originating_summons: ["courtHeading", "caseNumber", "partiesBlock", "processTitle", "dateLine", "frankingBlock", "serviceBlock"],
  petition: ["courtHeading", "caseNumber", "partiesBlock", "processTitle", "numbered", "dateLine", "frankingBlock", "serviceBlock"],
  originating_motion: ["courtHeading", "caseNumber", "partiesBlock", "processTitle", "numbered", "dateLine", "frankingBlock", "serviceBlock"],
  written_address: ["courtHeading", "caseNumber", "partiesBlock", "processTitle", "section", "dateLine", "frankingBlock", "serviceBlock"],
  final_written_address: ["courtHeading", "caseNumber", "partiesBlock", "processTitle", "section", "dateLine", "frankingBlock", "serviceBlock"],
  appellants_brief: ["courtHeading", "caseNumber", "partiesBlock", "processTitle", "section", "dateLine", "frankingBlock", "serviceBlock"],
  respondents_brief: ["courtHeading", "caseNumber", "partiesBlock", "processTitle", "section", "dateLine", "frankingBlock", "serviceBlock"],
  reply_brief: ["courtHeading", "caseNumber", "partiesBlock", "processTitle", "section", "dateLine", "frankingBlock", "serviceBlock"],
  notice_of_appeal: ["courtHeading", "caseNumber", "partiesBlock", "processTitle", "dateLine", "frankingBlock"],
  grounds_of_appeal: ["courtHeading", "caseNumber", "partiesBlock", "processTitle", "numbered", "dateLine", "frankingBlock"],
  notice_to_quit: ["letterhead", "recipient", "processTitle", "clause", "signature"],
  seven_days_notice_of_intention: ["letterhead", "recipient", "processTitle", "clause", "signature"],
  statutory_demand_notice: ["letterhead", "recipient", "processTitle", "clause", "signature"],
  pre_action_notice: ["letterhead", "recipient", "processTitle", "clause", "signature"],
  notice_of_breach_of_covenant: ["letterhead", "recipient", "processTitle", "clause", "signature"],
  formal_demand_letter: ["letterhead", "recipient", "subjectLine", "signature"],
  engagement_letter: ["letterhead", "recipient", "subjectLine", "signature"],
  official_correspondence: ["letterhead", "recipient", "subjectLine", "signature"],
  tenancy_or_lease_agreement: ["processTitle", "signature"],
  deed_of_assignment: ["processTitle", "signature"],
  power_of_attorney: ["processTitle", "signature"],
  mou_or_heads_of_terms: ["processTitle", "signature"],
  memorandum_of_appearance: ["courtHeading", "caseNumber", "partiesBlock", "processTitle", "signature"],
  conditional_memorandum_of_appearance: ["courtHeading", "caseNumber", "partiesBlock", "processTitle", "signature"],
};

export interface AstValidation {
  ok: boolean;
  missing: string[];
}

/** Validate an AST against its type's mandatory structure (AC3.2). */
export function validateAST(ast: { documentType: DocumentType; blocks: Block[] }): AstValidation {
  const required = REQUIRED_BLOCKS[ast.documentType] || ["processTitle"];
  const present = new Set(blockTypes(ast.blocks));
  const missing = required.filter((t) => !present.has(t));
  return { ok: missing.length === 0, missing };
}

/** Validate a whole bundle. */
export function validateBundle(bundle: DraftBundle): Array<{ id: string; v: AstValidation }> {
  return bundle.documents.map((d) => ({ id: d.id, v: validateAST(d) }));
}

// ─── Missing critical fields (computed in CODE — spec §4.6) ─────────────────

export function computeMissingFields(
  ctx: HydratedDraftContext,
  documents: Array<{ documentType: DocumentType }>
): MissingField[] {
  const out: MissingField[] = [];
  const seen = new Set<string>();
  const add = (key: string, label: string, documentIndex: number) => {
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ key, label, documentIndex });
  };
  documents.forEach((d, i) => {
    for (const f of TEMPLATES[d.documentType].requiredFields) {
      const missing =
        !isFieldSourced(f.key, ctx);
      if (missing) add(f.key, f.label, i);
    }
  });
  return out;
}

function isFieldSourced(key: string, ctx: HydratedDraftContext): boolean {
  switch (key) {
    case "matter.caseNumber":
      return !!ctx.matter?.caseNumber.value;
    case "matter.parties":
      return ctx.rawParties.length > 0;
    case "firm.counselName":
    case "firm.firmName":
      return !!(ctx.firm.counselName.value || ctx.firm.firmName.value);
    case "deponent.fullName":
      return ctx.dictated.namedPeople.some((p) => /deponent|witness/i.test(p.role)) || ctx.dictated.namedPeople.length > 0;
    case "deponent.address":
      return ctx.dictated.specialInstructions.some((s) => /address|resid/i.test(s));
    case "tenant.name":
    case "recipient.name":
    case "party.names":
      return ctx.rawParties.length > 0 || ctx.dictated.namedPeople.length > 0;
    case "premises.address":
      return ctx.dictated.groundsOrFacts.some((g) => /premises|address|known as/i.test(g));
    case "notice.expiryDate":
      return ctx.dictated.dates.length > 0;
    default:
      return true;
  }
}

// ─── Editor transforms (spec §7.3 / §7.4) ───────────────────────────────────

export interface PlaceholderRef {
  documentIndex: number;
  slotKey: string;
  label: string;
}

function walkSlots(blocks: Block[], visit: (slot: Slot, path: number[]) => void, path: number[] = []): void {
  blocks.forEach((b, i) => {
    const p = [...path, i];
    switch (b.t) {
      case "caseNumber":
        visit(b.value, p);
        break;
      case "clause":
        visit(b.text, p);
        break;
      case "dateLine":
        visit(b.value, p);
        break;
      case "subjectLine":
        visit(b.text, p);
        break;
      case "numbered":
        b.items.forEach((s, j) => visit(s, [...p, j]));
        break;
      case "section":
        walkSlots(b.children, visit, p);
        break;
      case "frankingBlock":
        visit(b.counsel, [...p, 0]);
        visit(b.firm, [...p, 1]);
        visit(b.address, [...p, 2]);
        visit(b.email, [...p, 3]);
        visit(b.phone, [...p, 4]);
        break;
      case "serviceBlock":
        b.recipients.forEach((s, j) => visit(s, [...p, j]));
        break;
      case "signature":
        visit(b.name, p);
        break;
      case "recipient":
        b.lines.forEach((s, j) => visit(s, [...p, j]));
        break;
      case "letterhead":
        visit(b.firm, p);
        break;
      default:
        break;
    }
  });
}

/** All unresolved placeholder pills in the bundle (navigation order). */
export function findPlaceholders(bundle: DraftBundle): PlaceholderRef[] {
  const out: PlaceholderRef[] = [];
  bundle.documents.forEach((doc, documentIndex) => {
    walkSlots(doc.blocks, (slot) => {
      if (slot.kind === "placeholder") {
        out.push({ documentIndex, slotKey: slot.key, label: slot.label });
      }
    });
  });
  return out;
}

/** Count of unresolved placeholder slots. */
export function countPlaceholders(bundle: DraftBundle): number {
  return findPlaceholders(bundle).length;
}

/** Fill ONE placeholder slot anywhere in the bundle (immutably). */
export function fillSlot(
  bundle: DraftBundle,
  documentIndex: number,
  slotKey: string,
  value: string,
  source: "voice" | "manual" | "matter" | "firm"
): DraftBundle {
  const documents = bundle.documents.map((doc, di) => {
    if (di !== documentIndex) return doc;
    const blocks = mapSlots(doc.blocks, (slot) =>
      slot.kind === "placeholder" && slot.key === slotKey
        ? { kind: "hydrated", key: slotKey, text: value.trim().slice(0, 2000), source }
        : slot
    );
    return { ...doc, blocks };
  });
  return { ...bundle, documents };
}

/** Immutable slot mapper over all block types. */
function mapSlots(blocks: Block[], fn: (slot: Slot) => Slot): Block[] {
  return blocks.map((b) => {
    switch (b.t) {
      case "caseNumber":
        return { ...b, value: fn(b.value) };
      case "clause":
        return { ...b, text: fn(b.text) };
      case "dateLine":
        return { ...b, value: fn(b.value) };
      case "subjectLine":
        return { ...b, text: fn(b.text) };
      case "numbered":
        return { ...b, items: b.items.map(fn) };
      case "section":
        return { ...b, children: mapSlots(b.children, fn) };
      case "frankingBlock":
        return {
          ...b,
          counsel: fn(b.counsel),
          firm: fn(b.firm),
          address: fn(b.address),
          email: fn(b.email),
          phone: fn(b.phone),
        };
      case "serviceBlock":
        return { ...b, recipients: b.recipients.map(fn) };
      case "signature":
        return { ...b, name: fn(b.name) };
      case "recipient":
        return { ...b, lines: b.lines.map(fn) };
      case "letterhead":
        return { ...b, firm: fn(b.firm) };
      default:
        return b;
    }
  });
}

/** Insert a numbered item into the FIRST numbered block whose items carry the
 *  given slot key (voice-edit "add relief"; AC4.3). Position: append, or at
 *  `position` when provided (before the omnibus prayer when found). */
export function insertNumberedItem(
  bundle: DraftBundle,
  documentIndex: number,
  itemText: string
): DraftBundle {
  const documents = bundle.documents.map((doc, di) => {
    if (di !== documentIndex) return doc;
    let inserted = false;
    const blocks = doc.blocks.map((b): Block => {
      if (b.t !== "numbered" || inserted) return b;
      const items = [...b.items];
      // Insert before the omnibus final prayer when present.
      const lastIdx = items.length - 1;
      const last = items[lastIdx];
      const isOmnibus =
        last &&
        (last.kind === "literal") &&
        /further or other order/i.test(last.text);
      const newItem: Slot = { kind: "prose", key: "voiceEdit.reliefs", text: itemText.trim(), status: "dictated" };
      if (isOmnibus) items.splice(lastIdx, 0, newItem);
      else items.push(newItem);
      inserted = true;
      return { ...b, items };
    });
    return inserted ? { ...doc, blocks } : doc;
  });
  return { ...bundle, documents };
}

/** The plain text of an AST (diffing + tests + voice-edit context). */
export function astPlainText(ast: { blocks: Block[] }): string {
  const parts: string[] = [];
  const renderSlot = (s: Slot): string => {
    switch (s.kind) {
      case "literal":
      case "hydrated":
      case "prose":
        return s.text;
      case "placeholder":
        return `[[${s.label}]]`;
    }
  };
  const render = (blocks: Block[]) => {
    for (const b of blocks) {
      switch (b.t) {
        case "courtHeading":
          parts.push(b.lines.join("\n"));
          break;
        case "caseNumber":
          parts.push(renderSlot(b.value));
          break;
        case "partiesBlock":
          parts.push(
            b.parties.map((p, i) => `${i === 0 ? "BETWEEN" : "AND"} ${p.name} … ${p.capacity}`).join("\n")
          );
          break;
        case "processTitle":
          parts.push(b.text);
          break;
        case "clause":
          parts.push(renderSlot(b.text));
          break;
        case "numbered":
          b.items.forEach((s, i) => parts.push(`${i + 1}. ${renderSlot(s)}`));
          break;
        case "section":
          parts.push(`${b.number ? b.number + " " : ""}${b.heading}`);
          render(b.children);
          break;
        case "dateLine":
          parts.push(renderSlot(b.value));
          break;
        case "frankingBlock":
          parts.push(
            [renderSlot(b.counsel), renderSlot(b.firm), renderSlot(b.address), renderSlot(b.email), renderSlot(b.phone)]
              .filter(Boolean)
              .join("\n")
          );
          break;
        case "serviceBlock":
          parts.push("FOR SERVICE ON:");
          b.recipients.forEach((s) => parts.push(renderSlot(s)));
          break;
        case "jurat":
          parts.push(`SWORN TO at ${renderSlot(b.place)} BEFORE ME:\nCOMMISSIONER FOR OATHS`);
          break;
        case "signature":
          parts.push([b.label, renderSlot(b.name)].filter(Boolean).join("\n"));
          break;
        case "letterhead":
          parts.push(renderSlot(b.firm));
          break;
        case "recipient":
          b.lines.forEach((s) => parts.push(renderSlot(s)));
          break;
        case "subjectLine":
          parts.push(`RE: ${renderSlot(b.text)}`);
          break;
        case "pageBreak":
          parts.push("— — —");
          break;
      }
    }
  };
  render(ast.blocks);
  return parts.filter((p) => (p || "").trim().length > 0).join("\n\n");
}

/** Extract the numbered paragraph texts of the first affidavit-like document
 *  in a bundle (for sibling-paragraph consistency; AC3.6). */
export function affidavitParagraphs(bundle: DraftBundle): string[] {
  const affidavitTypes: DocumentType[] = [
    "supporting_affidavit",
    "counter_affidavit",
    "further_and_better_affidavit",
    "witness_statement_on_oath",
  ];
  const doc = bundle.documents.find((d) => affidavitTypes.includes(d.documentType));
  if (!doc) return [];
  const out: string[] = [];
  for (const b of doc.blocks) {
    if (b.t === "numbered") {
      for (const s of b.items) {
        if (s.kind === "literal" || s.kind === "hydrated" || s.kind === "prose") out.push(s.text);
      }
    }
  }
  return out;
}
