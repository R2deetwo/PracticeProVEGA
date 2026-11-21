/**
 * legal/drafting/templates/shared.ts — deterministic block builders shared by
 * every template family (owner spec 2026-11-19, §5b/§5c).
 *
 * Everything here is PURE CODE: templates lay out court furniture
 * (captions, case-number lines, parties blocks, notice clauses, jurats,
 * franking blocks) deterministically. The LLM only ever fills the prose
 * slots these builders leave as Slot placeholders.
 *
 * Placeholder convention: missing values render as `[[LABEL]]` markers in
 * literal text (and `placeholder` Slots in typed slots). astToHtml.ts
 * renders both as clickable legal-placeholder pills. The YEAR is always
 * computed from the current date — never hard-coded (AC3.7).
 */

import type {
  Block,
  FieldValue,
  HydratedDraftContext,
  PartyLine,
  ProseSlotSpec,
  Slot,
} from "../types";
import { renderPartyLines } from "../hydrate";
import type { ProcessKind, MatterLike } from "../hydrate";

// ─── Slot constructors ──────────────────────────────────────────────────────

export const lit = (text: string): Slot => ({ kind: "literal", text });

export function hyd(
  key: string,
  v: FieldValue<string>,
  placeholderLabel: string
): Slot {
  return v.value ? { kind: "hydrated", key, text: v.value, source: v.source } : { kind: "placeholder", key, label: placeholderLabel };
}

/** A prose slot: LLM fill when present, placeholder pill when not. */
export function proseSlot(spec: ProseSlotSpec, fills: Record<string, string>): Slot {
  const text = (fills[spec.key] || "").trim();
  if (!text) return { kind: "placeholder", key: spec.key, label: spec.label };
  return { kind: "prose", key: spec.key, text: text.slice(0, spec.maxLength), status: "generated" };
}

// ─── Date helpers ───────────────────────────────────────────────────────────

/** Current year — computed at generation, never hard-coded (AC3.7). */
export function currentYear(): number {
  return new Date().getFullYear();
}

/** Today as "19 November 2026" (generation-time stamp for letters). */
export function todayLong(): string {
  return new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Convert a notice period in days to the statutory wording. */
export function noticePeriodWords(days: number): string {
  if (days === 7) return "one (1) week";
  if (days === 14) return "two (2) weeks";
  if (days === 30) return "one (1) month";
  if (days === 90) return "three (3) months";
  if (days === 180) return "six (6) months";
  if (days === 365) return "one (1) year";
  return `${days} (${days}) day${days === 1 ? "" : "s"}`;
}

// ─── Caption / case number / parties ────────────────────────────────────────

/** Centered court heading from the jurisdiction profile templates. */
export function courtHeadingBlock(ctx: HydratedDraftContext, opts?: { appellate?: boolean }): Block {
  const division = ctx.matter?.court.value?.division?.trim();
  const location =
    ctx.matter?.court.value?.location?.trim() || ctx.jurisdiction.defaultLocation;
  const templates =
    opts?.appellate && ctx.jurisdiction.key !== "supreme_court" && ctx.jurisdiction.key !== "court_of_appeal"
      ? // An appellate process on a trial-court matter still heads at the
        // appellate registry — use the appellate caption set.
        ["IN THE COURT OF APPEAL OF NIGERIA", "IN THE {{DIVISION}} JUDICIAL DIVISION", "HOLDEN AT {{LOCATION}}"]
      : ctx.jurisdiction.headingTemplates;
  const lines = templates.map((t) =>
    t
      .replace("{{DIVISION}}", division || "[[JUDICIAL DIVISION]]")
      .replace("{{LOCATION}}", location || "[[REGISTRY LOCATION]]")
  );
  return { t: "courtHeading", lines };
}

/** Right-aligned case-number line: SUIT NO / APPEAL NO / MOTION NO. */
export function caseNumberBlock(
  ctx: HydratedDraftContext,
  kind: "suit" | "appeal" | "motion"
): Block {
  const label =
    kind === "appeal" ? "APPEAL NO" : kind === "motion" ? "MOTION NO" : "SUIT NO";
  const number = ctx.matter?.caseNumber.value?.number;
  const value: Slot = number
    ? { kind: "hydrated", key: "matter.caseNumber", text: `${label}: ${number}`, source: "matter" }
    : { kind: "placeholder", key: "matter.caseNumber", label };
  return { t: "caseNumber", label, value };
}

/** Parties block with process-aware capacity labels + ordinals (AC3.4). */
export function partiesBlockFromCtx(
  ctx: HydratedDraftContext,
  processKind: ProcessKind,
  opts?: { fallbackClaimant?: string; fallbackDefendant?: string }
): Block {
  const lines: PartyLine[] = ctx.rawParties.length
    ? renderPartyLines(ctx.rawParties as NonNullable<MatterLike["parties"]>, processKind)
    : [];
  if (lines.length === 0) {
    lines.push(
      { name: opts?.fallbackClaimant || "[[CLAIMANT NAME]]", capacity: capacityLabelFor(processKind, "claim"), ordinal: null },
      { name: opts?.fallbackDefendant || "[[DEFENDANT NAME]]", capacity: capacityLabelFor(processKind, "defend"), ordinal: null }
    );
  }
  return { t: "partiesBlock", parties: lines, connectors: "BETWEEN" };
}

function capacityLabelFor(kind: ProcessKind, side: "claim" | "defend"): string {
  switch (kind) {
    case "appeal":
      return side === "claim" ? "APPELLANT" : "RESPONDENT";
    case "motion":
      return side === "claim" ? "APPLICANT" : "RESPONDENT";
    case "enforcement":
      return side === "claim" ? "JUDGMENT CREDITOR" : "JUDGMENT DEBTOR";
    case "tenancy":
      return side === "claim" ? "LANDLORD" : "TENANT";
    default:
      return side === "claim" ? "CLAIMANT" : "DEFENDANT";
  }
}

// ─── Franking / service / signature / jurat ─────────────────────────────────

export function frankingBlockFromCtx(ctx: HydratedDraftContext, party = "Applicant"): Block {
  // R78: the moving party's designation — "(Counsel) for the CLAIMANT" on
  // a statement of claim, "…APPLICANT" on a motion, "…APPELLANT" on an
  // appeal. Previously hard-coded "Applicant" in the renderer, so every
  // pleading's franking block mis-labelled the party (caught while
  // building the landing page's DraftPro capture, 2026-11-22).
  return {
    t: "frankingBlock",
    party,
    counsel: hyd("firm.counselName", ctx.firm.counselName, "COUNSEL NAME"),
    firm: hyd("firm.firmName", ctx.firm.firmName, "FIRM NAME"),
    address: hyd("firm.firmAddress", ctx.firm.firmAddress, "FIRM ADDRESS"),
    email: hyd("firm.firmEmail", ctx.firm.firmEmail, "FIRM EMAIL"),
    phone: hyd("firm.firmPhone", ctx.firm.firmPhone, "FIRM PHONE"),
  };
}

export function serviceBlockFromCtx(ctx: HydratedDraftContext, processKind: ProcessKind): Block {
  const label = capacityLabelFor(processKind, "defend");
  const defendants = (ctx.matter?.parties || [])
    .filter((p) => p.capacity === "defendant" || p.capacity === "respondent" || p.capacity === "judgment_debtor" || p.capacity === "tenant")
    .map((p) => p.name);
  const recipients: Slot[] = defendants.length
    ? defendants.map((name) => lit(`${name} — ${label}`))
    : [lit(`[[OPPOSING PARTY NAME]] — ${label}`)];
  return { t: "serviceBlock", recipients };
}

export function signatureBlock(ctx: HydratedDraftContext, label: string): Block {
  return {
    t: "signature",
    label,
    name: hyd("firm.counselName", ctx.firm.counselName, "COUNSEL NAME"),
  };
}

/** "DATED at Lagos this [[DAY]] day of [[MONTH]], {year}" */
export function dateLineBlock(ctx: HydratedDraftContext): Block {
  const location = ctx.matter?.court.value?.location?.trim() || ctx.jurisdiction.defaultLocation;
  return {
    t: "dateLine",
    value: lit(`DATED at ${location || "[[REGISTRY LOCATION]]"} this [[DAY]] day of [[MONTH]], ${currentYear()}`),
  };
}

/** Commissioner-for-Oaths jurat (affidavits / witness statements). */
export function juratBlock(ctx: HydratedDraftContext): Block {
  const location = ctx.matter?.court.value?.location?.trim() || ctx.jurisdiction.defaultLocation;
  return {
    t: "jurat",
    place: lit(`${location || "[[REGISTRY LOCATION]]"} Registry`),
    commissioner: true,
  };
}

// ─── Motion notice clause (spec §5c Motions) ────────────────────────────────

/** The TAKE NOTICE clause; year computed at generation (AC3.7). */
export function motionTakeNoticeClause(ctx: HydratedDraftContext, exParte: boolean): Block {
  const rule = ctx.jurisdiction.motionEnablingRule.text;
  const inherent = ctx.jurisdiction.inherentJurisdictionClause.text;
  const moved =
    exParte
      ? "TAKE NOTICE that this Honourable Court will be moved ex parte on the [[DAY]] day of [[MONTH]], " +
        `${currentYear()} at 9 O'clock in the forenoon or so soon thereafter as Counsel may be heard`
      : "TAKE NOTICE that this Honourable Court will be moved on the [[DAY]] day of [[MONTH]], " +
        `${currentYear()} at 9 O'clock in the forenoon or so soon thereafter as Counsel may be heard`;
  return {
    t: "clause",
    text: lit(
      `${moved}, pursuant to ${rule} and under ${inherent}, by Counsel for the ${
        exParte ? "Applicant" : "Applicant"
      }, praying for the reliefs set out hereunder:`
    ),
  };
}

/** Numbered reliefs block ending with the omnibus prayer (spec §5c). */
export function reliefsBlock(ctx: HydratedDraftContext, slot: ProseSlotSpec, fills: Record<string, string>): Block {
  const items: Slot[] = [];
  const dictated = ctx.dictated.reliefs;
  if (dictated.length > 0) {
    for (const r of dictated) items.push({ kind: "prose", key: "dictated.reliefs", text: r, status: "dictated" });
  } else {
    items.push(proseSlot(slot, fills));
  }
  items.push(lit("Such further or other order(s) as this Honourable Court may deem fit to make in the circumstances."));
  return { t: "numbered", items, style: "arabic" };
}

/** Grounds / facts: dictated first, LLM slot second, placeholder last. */
export function dictatedOrProseBlock(
  ctx: HydratedDraftContext,
  slot: ProseSlotSpec,
  fills: Record<string, string>,
  opts?: { fromDictated?: "groundsOrFacts" | "specialInstructions" }
): Block {
  const from = opts?.fromDictated || "groundsOrFacts";
  const dictated = ctx.dictated[from];
  if (dictated.length > 0) {
    return {
      t: "numbered",
      items: dictated.map((g) => ({ kind: "prose", key: "dictated." + from, text: g, status: "dictated" as const })),
      style: "arabic",
    };
  }
  return { t: "numbered", items: [proseSlot(slot, fills)], style: "arabic" };
}

/** Exhibits clause appended to affidavits when exhibits exist (AC3.6). */
export function exhibitsClause(ctx: HydratedDraftContext): Block | null {
  if (ctx.exhibits.length === 0) return null;
  return {
    t: "clause",
    text: lit(
      `The documents referred to in this affidavit are exhibited and marked as ${ctx.exhibits
        .map((e) => `EXHIBIT ${e}`)
        .join(", ")} respectively.`
    ),
  };
}

/** A shared prose-slot factory so every family stays in sync. */
export function prose(
  key: string,
  label: string,
  contract: string,
  maxLength = 4000,
  shape: ProseSlotSpec["shape"] = "paragraphs",
  factsOnly = false
): ProseSlotSpec {
  return factsOnly
    ? { key, label, contract, maxLength, shape, factsOnly: true }
    : { key, label, contract, maxLength, shape };
}

/** The counsel-review banner data (rendered by the editor, never exported). */
export const COUNSEL_REVIEW_BANNER =
  "Draft generated for counsel review. Statutory references and authorities must be verified before filing.";
