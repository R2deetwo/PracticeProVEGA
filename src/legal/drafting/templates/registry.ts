/**
 * legal/drafting/templates/registry.ts — THE template registry: one template
 * per DocumentType (owner spec 2026-11-19, §5b/§5c). 52 types, built from a
 * small set of family factories so every document of a family shares the
 * exact same mandatory structure.
 *
 * STRUCTURE IS DETERMINISTIC CODE. `build(ctx, fills)` lays out every
 * structural block (caption, case number, parties block, notice clause,
 * numbered paragraphs, jurat, franking, service); the LLM only fills the
 * declared prose slots. Missing values render as placeholder pills —
 * generation never blocks (spec §5d).
 *
 * Structural rules per family (spec §5c):
 *   - First-instance processes: courtHeading → caseNumber (+ MOTION NO for
 *     motions) → partiesBlock → processTitle → body.
 *   - Motions: enabling-rule clause → TAKE NOTICE (year computed at
 *     generation, AC3.7) → numbered reliefs ending with the omnibus prayer
 *     → grounds → dateLine → frankingBlock → serviceBlock (ex parte omits
 *     service and adjusts the notice wording).
 *   - Affidavits / witness statements: preamble slots → numbered FACTS ONLY
 *     → Oaths Act conclusion → deponent signature → jurat. Exhibits
 *     auto-number EXHIBIT A, B, C from the shared bundle context (AC3.6).
 *   - Pleadings: numbered material facts → WHEREOF relief block (SoC) /
 *     defence conclusion (SoD; counterclaim variants add a separate
 *     COUNTERCLAIM section with its own reliefs) → dateLine → franking →
 *     service. Frontloading jurisdictions add the accompanying-document
 *     reminder (non-blocking).
 *   - Written addresses: 1.0–5.0 sections from the jurisdiction profile.
 *   - Appellate: appellate caption, APPEAL NO, appellate capacities; each
 *     ground = title + Particulars; briefs use the profile's brief headings;
 *     the LIST OF AUTHORITIES is generated from the AST fills.
 *   - Statutory notices: letterhead → TO → statutory title → operative
 *     wording driven by the CODE-COMPUTED notice period (AC3.5) →
 *     solicitor's signature for the landlord.
 *   - Formal letters: letterhead → OUR REF/DATE → recipient → salutation →
 *     RE: → Background/Breach/Demand/Consequences → Yours faithfully.
 *
 * Pure functions; zero state, zero DOM.
 */

import type {
  Block,
  DocumentAST,
  DocumentTemplate,
  HydratedDraftContext,
  ProseSlotSpec,
} from "../types";
import type { DocumentType } from "../documentTypes";
import { DOCUMENT_TYPE_CATEGORIES } from "../documentTypes";
import { extractCitations } from "../authorityLibrary";
import {
  caseNumberBlock,
  courtHeadingBlock,
  dateLineBlock,
  dictatedOrProseBlock,
  exhibitsClause,
  frankingBlockFromCtx,
  juratBlock,
  lit,
  motionTakeNoticeClause,
  noticePeriodWords,
  partiesBlockFromCtx,
  prose,
  proseSlot,
  reliefsBlock,
  serviceBlockFromCtx,
  signatureBlock,
  todayLong,
} from "./shared";

// ─── Shared field specs ─────────────────────────────────────────────────────

const COURT_FIELDS = [
  { key: "matter.caseNumber", label: "Suit / Motion / Appeal Number" },
  { key: "matter.parties", label: "Parties" },
  { key: "firm.counselName", label: "Counsel Name" },
];

const AFFIDAVIT_FIELDS = [
  ...COURT_FIELDS,
  { key: "deponent.fullName", label: "Deponent Name" },
  { key: "deponent.address", label: "Deponent Address" },
];

const NOTICE_FIELDS = [
  { key: "tenant.name", label: "Tenant Name" },
  { key: "premises.address", label: "Premises Address" },
  { key: "notice.expiryDate", label: "Notice Expiry Date" },
];

const LETTER_FIELDS = [
  { key: "recipient.name", label: "Recipient Name" },
  { key: "firm.firmName", label: "Firm Name" },
];

const INSTRUMENT_FIELDS = [
  { key: "party.names", label: "Party Names" },
  { key: "firm.firmName", label: "Firm Name" },
];

/** Split a prose fill into numbered/bulleted items by line. */
function linesOf(fill: string | undefined): string[] {
  return (fill || "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-•*]|\(?\d+[.)])\s*/, "").trim())
    .filter(Boolean);
}

/** A numbered block from a fill's lines (placeholder when empty). */
function numberedFromFill(slot: ProseSlotSpec, fills: Record<string, string>): Block {
  const lines = linesOf(fills[slot.key]);
  if (lines.length > 0) {
    return {
      t: "numbered",
      items: lines.map((l) => ({ kind: "prose", key: slot.key, text: l.slice(0, slot.maxLength), status: "generated" as const })),
      style: "arabic",
    };
  }
  return { t: "numbered", items: [proseSlot(slot, fills)], style: "arabic" };
}

// ─── Family: motions (incl. execution motions) ──────────────────────────────

function motionFamily(
  documentType: DocumentType,
  title: string,
  opts?: {
    exParte?: boolean;
    enablingIntro?: (ctx: HydratedDraftContext) => Block[];
    prayersLabel?: string;
  }
): DocumentTemplate {
  const reliefsSlot = prose(
    `${documentType}.reliefs`,
    "Reliefs / Prayers sought",
    "Each relief the applicant seeks, as a discrete prayer in plain terms. Do not invent facts; derive only from the dictated content and matter notes.",
    3000,
    "numbered"
  );
  const groundsSlot = prose(
    `${documentType}.grounds`,
    "Grounds of application",
    "The grounds for the application, each stated concisely. Facts the lawyer dictated come first; never invent new grounds.",
    4000,
    "numbered"
  );
  return {
    documentType,
    category: DOCUMENT_TYPE_CATEGORIES[documentType],
    requiredFields: COURT_FIELDS,
    proseSlots: [reliefsSlot, groundsSlot],
    build: (ctx, fills): DocumentAST => {
      const blocks: Block[] = [
        courtHeadingBlock(ctx),
        caseNumberBlock(ctx, "suit"),
        caseNumberBlock(ctx, "motion"),
        partiesBlockFromCtx(ctx, opts?.enablingIntro ? "enforcement" : "motion"),
        { t: "processTitle", text: title },
        ...(opts?.enablingIntro ? opts.enablingIntro(ctx) : []),
        motionTakeNoticeClause(ctx, !!opts?.exParte),
        { t: "clause", text: lit(opts?.prayersLabel || "The Applicant prays this Honourable Court for:") },
        reliefsBlock(ctx, reliefsSlot, fills),
        { t: "clause", text: lit("GROUNDS OF APPLICATION:") },
        dictatedOrProseBlock(ctx, groundsSlot, fills),
        dateLineBlock(ctx),
        frankingBlockFromCtx(ctx),
      ];
      if (!opts?.exParte) blocks.push(serviceBlockFromCtx(ctx, "motion"));
      return { id: `${documentType}-0`, documentType, blocks };
    },
  };
}

// ─── Family: affidavits & witness statements ────────────────────────────────

function affidavitFamily(
  documentType: DocumentType,
  title: string,
  opts?: { witnessStyle?: boolean }
): DocumentTemplate {
  const factsSlot = prose(
    `${documentType}.facts`,
    "Numbered factual paragraphs",
    "Numbered paragraphs of FACTS ONLY, in the first person, derived strictly from the dictated content and the matter's case notes. NO argument, no opinion, no legal conclusions, no citations — affidavit evidence must comply with the Evidence Act. Do not invent facts.",
    8000,
    "numbered",
    true
  );
  return {
    documentType,
    category: DOCUMENT_TYPE_CATEGORIES[documentType],
    requiredFields: AFFIDAVIT_FIELDS,
    proseSlots: [factsSlot],
    build: (ctx, fills): DocumentAST => {
      const blocks: Block[] = [
        courtHeadingBlock(ctx),
        caseNumberBlock(ctx, "suit"),
        partiesBlockFromCtx(ctx, "motion"),
        { t: "processTitle", text: title },
        {
          t: "clause",
          text: lit(
            opts?.witnessStyle
              ? "I, [[DEPONENT FULL NAME]], an adult, a Nigerian citizen, [[OCCUPATION]], of [[DEPONENT ADDRESS]], make oath and state as follows:"
              : "I, [[DEPONENT FULL NAME]], an adult, [[GENDER]], a Nigerian citizen and a believer of the [[RELIGION]] faith, [[OCCUPATION]], of [[DEPONENT ADDRESS]], do hereby make oath and state as follows:"
          ),
        },
        dictatedOrProseBlock(ctx, factsSlot, fills),
      ];
      const ex = exhibitsClause(ctx);
      if (ex) blocks.push(ex);
      blocks.push(
        {
          t: "clause",
          text: lit(
            "That this affidavit is made in good faith, for the purposes of the proceedings herein, and in compliance with the provisions of the Oaths Act."
          ),
        },
        { t: "signature", label: "DEPONENT", name: lit("____________________\n[[DEPONENT FULL NAME]]") },
        juratBlock(ctx)
      );
      return { id: `${documentType}-0`, documentType, blocks };
    },
  };
}

// ─── Family: pleadings ──────────────────────────────────────────────────────

function pleadingFamily(
  documentType: DocumentType,
  title: string,
  opts?: { counterclaim?: boolean; reply?: boolean; conclusion?: string }
): DocumentTemplate {
  const factsSlot = prose(
    `${documentType}.materialFacts`,
    "Numbered material facts",
    "Numbered paragraphs of material facts, in the third person, derived strictly from the dictated content and the matter's case notes. Never invent facts. Concise, chronological, one fact per paragraph where possible.",
    8000,
    "numbered"
  );
  const counterclaimSlot = prose(
    `${documentType}.counterclaimReliefs`,
    "Counterclaim reliefs",
    "The reliefs sought in the counterclaim, each a discrete prayer.",
    3000,
    "numbered"
  );
  const proseSlots: ProseSlotSpec[] = opts?.counterclaim
    ? [factsSlot, counterclaimSlot]
    : [factsSlot];
  return {
    documentType,
    category: DOCUMENT_TYPE_CATEGORIES[documentType],
    requiredFields: COURT_FIELDS,
    proseSlots,
    build: (ctx, fills): DocumentAST => {
      const blocks: Block[] = [
        courtHeadingBlock(ctx),
        caseNumberBlock(ctx, "suit"),
        partiesBlockFromCtx(ctx, "claim"),
        { t: "processTitle", text: title },
        dictatedOrProseBlock(ctx, factsSlot, fills),
      ];
      if (documentType === "statement_of_claim") {
        blocks.push(
          { t: "clause", text: lit("WHEREOF the Claimant claims:") },
          reliefsBlock(ctx, prose(`${documentType}.reliefs`, "Reliefs claimed", "Each relief claimed, as a discrete prayer.", 3000, "numbered"), fills)
        );
      } else if (opts?.counterclaim) {
        blocks.push(
          {
            t: "clause",
            text: lit(
              "WHEREOF the Defendant denies liability in toto and/or defends this claim and shall at the trial rely on all denials herein."
            ),
          },
          {
            t: "section",
            number: "",
            heading: "COUNTERCLAIM",
            children: [
              { t: "clause", text: lit("BY WAY OF COUNTERCLAIM, the Defendant states as follows:") },
              dictatedOrProseBlock(
                ctx,
                prose(`${documentType}.counterclaimFacts`, "Counterclaim facts", "Numbered paragraphs of the counterclaim's material facts.", 6000, "numbered"),
                fills,
                { fromDictated: "specialInstructions" }
              ),
              { t: "clause", text: lit("WHEREOF the Defendant as Counterclaimant claims:") },
              reliefsBlock(ctx, counterclaimSlot, fills),
            ],
          }
        );
      } else {
        blocks.push({
          t: "clause",
          text: lit(
            opts?.conclusion ||
              "WHEREOF the Defendant strictly denies the Claimant's claim in its entirety and shall contend that the same is frivolous, vexatious and ought to be dismissed."
          ),
        });
      }
      // Frontloading reminder (Lagos-style) — non-blocking (spec §5c).
      if (
        ctx.jurisdiction.frontloading.required &&
        ["statement_of_claim", "writ_of_summons"].includes(documentType)
      ) {
        blocks.push({
          t: "clause",
          text: lit(
            `[FRONTLOADING REMINDER — FOR COUNSEL, NOT FOR FILING: this jurisdiction requires the accompanying processes — ${ctx.jurisdiction.frontloading.accompanyingDocuments
              .map((d) => d.replace(/_/g, " "))
              .join(", ")} — to be filed with this process (${ctx.jurisdiction.frontloading.rule?.text || "frontloading rules"}). Verify before filing.]`
          ),
        });
      }
      blocks.push(dateLineBlock(ctx), frankingBlockFromCtx(ctx, documentType === "statement_of_defence" || opts?.counterclaim ? "Defendant" : "Claimant"), serviceBlockFromCtx(ctx, "claim"));
      return { id: `${documentType}-0`, documentType, blocks };
    },
  };
}

// ─── Family: written addresses ──────────────────────────────────────────────

function addressFamily(documentType: DocumentType): DocumentTemplate {
  const slots = [
    prose(`${documentType}.introduction`, "Introduction", "One short paragraph identifying the applicant and the process this address supports.", 1500),
    prose(`${documentType}.facts`, "Brief statement of facts", "A concise statement of facts derived from the affidavit in the same bundle (match its paragraph numbering). Never invent facts.", 6000),
    prose(`${documentType}.issues`, "Issues for determination", "Each issue for determination, one per line, framed from the dictated grounds and the facts.", 2500, "numbered"),
    prose(
      `${documentType}.argument`,
      "Legal argument",
      "Argue each issue in order under a subheading 'ARGUMENT ON ISSUE ONE/TWO…'. Cite ONLY authorities from the firm's verified authority library; where the law is asserted without a library citation, write the proposition plainly without inventing a citation.",
      20000
    ),
    prose(`${documentType}.conclusion`, "Conclusion", "One short concluding paragraph urging the court to grant the reliefs.", 1500),
  ];
  return {
    documentType,
    category: DOCUMENT_TYPE_CATEGORIES[documentType],
    requiredFields: COURT_FIELDS,
    proseSlots: slots,
    build: (ctx, fills): DocumentAST => {
      const h = ctx.jurisdiction.addressHeadings;
      const blocks: Block[] = [
        courtHeadingBlock(ctx),
        caseNumberBlock(ctx, "suit"),
        partiesBlockFromCtx(ctx, "motion"),
        { t: "processTitle", text: documentType === "final_written_address" ? "FINAL WRITTEN ADDRESS" : "WRITTEN ADDRESS" },
      ];
      const sections: Block[] = [
        { t: "section", number: "1.0", heading: "INTRODUCTION", children: [{ t: "clause", text: proseSlot(slots[0], fills) }] },
        { t: "section", number: "2.0", heading: "BRIEF STATEMENT OF FACTS", children: [{ t: "clause", text: proseSlot(slots[1], fills) }] },
        { t: "section", number: "3.0", heading: "ISSUE(S) FOR DETERMINATION", children: [numberedFromFill(slots[2], fills)] },
        { t: "section", number: "4.0", heading: "LEGAL ARGUMENT", children: [{ t: "clause", text: proseSlot(slots[3], fills) }] },
        { t: "section", number: "5.0", heading: "CONCLUSION", children: [{ t: "clause", text: proseSlot(slots[4], fills) }] },
      ];
      for (const s of sections) blocks.push(s);
      blocks.push(dateLineBlock(ctx), frankingBlockFromCtx(ctx), serviceBlockFromCtx(ctx, "motion"));
      return { id: `${documentType}-0`, documentType, blocks };
    },
  };
}

// ─── Family: appellate briefs ───────────────────────────────────────────────

function briefFamily(documentType: DocumentType, title: string): DocumentTemplate {
  const slots = [
    prose(`${documentType}.introduction`, "Introduction", "One short paragraph identifying the appellant/respondent and the appeal.", 1500),
    prose(`${documentType}.facts`, "Statement of facts", "A concise statement of facts from the record, chronological, no argument.", 8000),
    prose(`${documentType}.issues`, "Issues for determination", "Each issue for determination, one per line, each tagged with the ground(s) of appeal it arises from, e.g. 'ISSUE ONE (Grounds 1 & 3): …'.", 2500, "numbered"),
    prose(
      `${documentType}.argument`,
      "Argument of issues",
      "Argue each issue in order under a subheading. Cite ONLY authorities from the firm's verified authority library; never invent a citation. Distill the applicable legal principles before applying them to the facts.",
      30000
    ),
    prose(`${documentType}.conclusion`, "Conclusion", "One short concluding paragraph urging the court to allow/dismiss the appeal.", 1500),
  ];
  return {
    documentType,
    category: DOCUMENT_TYPE_CATEGORIES[documentType],
    requiredFields: COURT_FIELDS,
    proseSlots: slots,
    build: (ctx, fills): DocumentAST => {
      const blocks: Block[] = [
        courtHeadingBlock(ctx, { appellate: true }),
        caseNumberBlock(ctx, "appeal"),
        partiesBlockFromCtx(ctx, "appeal"),
        { t: "processTitle", text: title },
        { t: "clause", text: lit(`TABLE OF CONTENTS: ${ctx.jurisdiction.briefHeadings.join("; ")}.`) },
        { t: "section", number: "1.0", heading: "INTRODUCTION", children: [{ t: "clause", text: proseSlot(slots[0], fills) }] },
        { t: "section", number: "2.0", heading: "STATEMENT OF FACTS", children: [{ t: "clause", text: proseSlot(slots[1], fills) }] },
        { t: "section", number: "3.0", heading: "ISSUES FOR DETERMINATION", children: [numberedFromFill(slots[2], fills)] },
        { t: "section", number: "4.0", heading: "ARGUMENT OF ISSUES", children: [{ t: "clause", text: proseSlot(slots[3], fills) }] },
        { t: "section", number: "5.0", heading: "CONCLUSION", children: [{ t: "clause", text: proseSlot(slots[4], fills) }] },
      ];
      // LIST OF AUTHORITIES generated from the AST fills (deterministic).
      const cited = new Set<string>();
      for (const s of slots) for (const c of extractCitations(fills[s.key] || "")) cited.add(c);
      const authorities = Array.from(cited);
      blocks.push({
        t: "section",
        number: "6.0",
        heading: "LIST OF AUTHORITIES",
        children: authorities.length
          ? [{ t: "numbered", items: authorities.map((a) => lit(a)), style: "arabic" }]
          : [{ t: "clause", text: lit("[[LIST OF AUTHORITIES — add after counsel verification]]") }],
      });
      blocks.push(dateLineBlock(ctx), frankingBlockFromCtx(ctx, documentType === "respondents_brief" ? "Respondent" : "Appellant"), serviceBlockFromCtx(ctx, "appeal"));
      return { id: `${documentType}-0`, documentType, blocks };
    },
  };
}

// ─── Family: statutory notices ──────────────────────────────────────────────

function noticeFamily(documentType: DocumentType, title: string, operative: (ctx: HydratedDraftContext) => string): DocumentTemplate {
  const groundsSlot = prose(
    `${documentType}.grounds`,
    "Facts / breaches",
    "The specific facts, arrears or breaches that justify this notice, derived from the dictated content and the property record. Never invent amounts.",
    4000,
    "numbered"
  );
  return {
    documentType,
    category: DOCUMENT_TYPE_CATEGORIES[documentType],
    requiredFields: NOTICE_FIELDS,
    proseSlots: [groundsSlot],
    build: (ctx, fills): DocumentAST => {
      const blocks: Block[] = [
        { t: "letterhead", firm: { kind: "literal", text: ctx.firm.firmName.value || "[[FIRM NAME]]" } },
        {
          t: "recipient",
          lines: [
            lit("TO: [[TENANT / RECIPIENT NAME]]"),
            lit("[[PREMISES / RECIPIENT ADDRESS]]"),
          ],
        },
        { t: "processTitle", text: title },
        { t: "clause", text: lit(operative(ctx)) },
      ];
      const grounds = dictatedOrProseBlock(ctx, groundsSlot, fills, { fromDictated: "groundsOrFacts" });
      blocks.push(grounds);
      blocks.push(
        {
          t: "signature",
          label: "For: [[LANDLORD / PRINCIPAL NAME]]",
          name: hydCounsel(ctx),
        },
        { t: "dateLine", value: lit(`Dated this ${todayLong()}`) }
      );
      return { id: `${documentType}-0`, documentType, blocks };
    },
  };
}

function hydCounsel(ctx: HydratedDraftContext): ReturnType<typeof lit> {
  return ctx.firm.counselName.value
    ? { kind: "hydrated", key: "firm.counselName", text: ctx.firm.counselName.value, source: ctx.firm.counselName.source }
    : { kind: "placeholder", key: "firm.counselName", label: "COUNSEL NAME" };
}

// ─── Family: formal letters ─────────────────────────────────────────────────

function letterFamily(
  documentType: DocumentType,
  subject: string,
  opts?: { demand?: boolean }
): DocumentTemplate {
  const slots = [
    prose(`${documentType}.background`, "Background paragraph", "The factual background: the relationship, the agreement, the relevant history. Derived strictly from dictated content and matter notes.", 3000),
  ];
  if (opts?.demand) {
    slots.push(
      prose(`${documentType}.breach`, "Breach / default paragraph", "The specific breach or default, with amounts and dates as dictated.", 3000),
      prose(`${documentType}.demand`, "Demand & deadline paragraph", "The demand itself and the deadline (period) for compliance, using the dictated amounts and periods.", 2500),
      prose(`${documentType}.consequences`, "Consequences paragraph", "The consequences of non-compliance (proceedings, costs, interest) without inventing figures.", 2500)
    );
  } else {
    slots.push(prose(`${documentType}.body`, "Letter body", "The body of the letter, professional register, derived from the dictated content.", 6000));
  }
  return {
    documentType,
    category: DOCUMENT_TYPE_CATEGORIES[documentType],
    requiredFields: LETTER_FIELDS,
    proseSlots: slots,
    build: (ctx, fills): DocumentAST => {
      const blocks: Block[] = [
        { t: "letterhead", firm: { kind: "literal", text: ctx.firm.firmName.value || "[[FIRM NAME]]" } },
        { t: "clause", text: lit(`OUR REF: [[OUR REF]]                                                                                              DATE: ${todayLong()}`) },
        { t: "recipient", lines: [lit("The [[RECIPIENT NAME / TITLE]]"), lit("[[RECIPIENT ORGANISATION]]"), lit("[[RECIPIENT ADDRESS]]")] },
        { t: "clause", text: lit("Dear Sir/Madam,") },
        { t: "subjectLine", text: lit(subject) },
      ];
      for (const s of slots) blocks.push({ t: "clause", text: proseSlot(s, fills) });
      blocks.push(
        { t: "clause", text: lit("Yours faithfully,") },
        { t: "signature", label: "", name: hydCounsel(ctx) },
        { t: "clause", text: lit("FOR: [[FIRM NAME]]") }
      );
      return { id: `${documentType}-0`, documentType, blocks };
    },
  };
}

// ─── Family: instruments (agreements / deeds / POA / MOU) ───────────────────

function instrumentFamily(
  documentType: DocumentType,
  title: string,
  operative: string,
  clauseSlots: ProseSlotSpec[]
): DocumentTemplate {
  return {
    documentType,
    category: DOCUMENT_TYPE_CATEGORIES[documentType],
    requiredFields: INSTRUMENT_FIELDS,
    proseSlots: clauseSlots,
    build: (ctx, fills): DocumentAST => {
      const blocks: Block[] = [
        { t: "processTitle", text: title },
        { t: "clause", text: lit(operative) },
      ];
      for (const s of clauseSlots) blocks.push({ t: "clause", text: proseSlot(s, fills) });
      blocks.push(
        { t: "clause", text: lit("IN WITNESS WHEREOF the parties have executed this instrument on the day and year first above written.") },
        { t: "signature", label: "FIRST PARTY", name: lit("____________________\n[[FIRST PARTY NAME]]") },
        { t: "signature", label: "SECOND PARTY", name: lit("____________________\n[[SECOND PARTY NAME]]") },
        { t: "signature", label: "WITNESS", name: lit("____________________\n[[WITNESS NAME / ADDRESS]]") }
      );
      return { id: `${documentType}-0`, documentType, blocks };
    },
  };
}

// ─── Family: registry forms ─────────────────────────────────────────────────

function formFamily(documentType: DocumentType, title: string, clauses: string[], opts?: { courtCaption?: boolean }): DocumentTemplate {
  return {
    documentType,
    category: DOCUMENT_TYPE_CATEGORIES[documentType],
    requiredFields: COURT_FIELDS,
    proseSlots: [],
    build: (ctx, _fills): DocumentAST => {
      const blocks: Block[] = [];
      if (opts?.courtCaption !== false) {
        blocks.push(courtHeadingBlock(ctx), caseNumberBlock(ctx, "suit"), partiesBlockFromCtx(ctx, "claim"));
      }
      blocks.push({ t: "processTitle", text: title });
      for (const c of clauses) blocks.push({ t: "clause", text: lit(c) });
      blocks.push(signatureBlock(ctx, ""), dateLineBlock(ctx));
      return { id: `${documentType}-0`, documentType, blocks };
    },
  };
}

// ─── The registry: 52 templates ─────────────────────────────────────────────

const writIndorsementSlot = prose(
  "indorsement_of_claim.statement",
  "Indorsement of claim",
  "The concise statement of the claim (the cause of action and the relief), derived strictly from the dictated content.",
  3000
);

export const TEMPLATES: Record<DocumentType, DocumentTemplate> = {
  // Originating / commencement
  writ_of_summons: {
    documentType: "writ_of_summons",
    category: "litigation_process",
    requiredFields: COURT_FIELDS,
    proseSlots: [writIndorsementSlot],
    build: (ctx, fills): DocumentAST => ({
      id: "writ_of_summons-0",
      documentType: "writ_of_summons",
      blocks: [
        courtHeadingBlock(ctx),
        caseNumberBlock(ctx, "suit"),
        partiesBlockFromCtx(ctx, "claim"),
        { t: "processTitle", text: "WRIT OF SUMMONS" },
        {
          t: "clause",
          text: lit(
            "LET the Defendant(s) named above cause an appearance to be entered for them within the time prescribed by the rules of this Honourable Court after service of this Writ on them, inclusive of the day of such service, failing which the Claimant may proceed with the claim and judgment may be given in the Defendant's absence."
          ),
        },
        { t: "clause", text: lit("INDEORSEMENT OF CLAIM:") },
        { t: "clause", text: proseSlot(writIndorsementSlot, fills) },
        dateLineBlock(ctx),
        frankingBlockFromCtx(ctx, "Claimant"),
        serviceBlockFromCtx(ctx, "claim"),
      ],
    }),
  },
  indorsement_of_claim: {
    documentType: "indorsement_of_claim",
    category: "litigation_process",
    requiredFields: COURT_FIELDS,
    proseSlots: [writIndorsementSlot],
    build: (ctx, fills): DocumentAST => ({
      id: "indorsement_of_claim-0",
      documentType: "indorsement_of_claim",
      blocks: [
        courtHeadingBlock(ctx),
        caseNumberBlock(ctx, "suit"),
        partiesBlockFromCtx(ctx, "claim"),
        { t: "processTitle", text: "INDEORSEMENT OF CLAIM" },
        { t: "clause", text: proseSlot(writIndorsementSlot, fills) },
        dateLineBlock(ctx),
        frankingBlockFromCtx(ctx, "Claimant"),
      ],
    }),
  },
  statement_of_claim: pleadingFamily("statement_of_claim", "STATEMENT OF CLAIM"),
  originating_summons: {
    documentType: "originating_summons",
    category: "litigation_process",
    requiredFields: COURT_FIELDS,
    proseSlots: [
      prose("originating_summons.questions", "Questions for determination", "Each question the applicant seeks to have determined, one per line.", 4000, "numbered"),
    ],
    build: (ctx, fills): DocumentAST => ({
      id: "originating_summons-0",
      documentType: "originating_summons",
      blocks: [
        courtHeadingBlock(ctx),
        caseNumberBlock(ctx, "suit"),
        partiesBlockFromCtx(ctx, "motion"),
        { t: "processTitle", text: "ORIGINATING SUMMONS" },
        {
          t: "clause",
          text: lit(
            "LET all the parties concerned attend before this Honourable Court on the [[DAY]] day of [[MONTH]], " +
              new Date().getFullYear() +
              " at 9 O'clock in the forenoon or so soon thereafter as the Summons may be heard, for the determination of the following questions:"
          ),
        },
        numberedFromFill(
          prose("originating_summons.questions", "Questions for determination", "", 4000, "numbered"),
          fills
        ),
        dateLineBlock(ctx),
        frankingBlockFromCtx(ctx, "Applicant"),
        serviceBlockFromCtx(ctx, "motion"),
      ],
    }),
  },
  petition: {
    documentType: "petition",
    category: "litigation_process",
    requiredFields: COURT_FIELDS,
    proseSlots: [
      prose("petition.facts", "Petition paragraphs", "Numbered paragraphs of the petition's factual and legal grounds.", 8000, "numbered"),
      prose("petition.prayer", "Prayer", "The prayer(s) sought, each a discrete request.", 3000, "numbered"),
    ],
    build: (ctx, fills): DocumentAST => ({
      id: "petition-0",
      documentType: "petition",
      blocks: [
        courtHeadingBlock(ctx),
        caseNumberBlock(ctx, "suit"),
        partiesBlockFromCtx(ctx, "claim", { fallbackClaimant: "[[PETITIONER NAME]]", fallbackDefendant: "[[RESPONDENT NAME]]" }),
        { t: "processTitle", text: "PETITION" },
        { t: "clause", text: lit("THE PETITION OF [[PETITIONER NAME]] respectfully shows as follows:") },
        dictatedOrProseBlock(
          ctx,
          prose("petition.facts", "Petition paragraphs", "", 8000, "numbered"),
          fills
        ),
        { t: "clause", text: lit("WHEREFORE the Petitioner prays as follows:") },
        numberedFromFill(prose("petition.prayer", "Prayer", "", 3000, "numbered"), fills),
        dateLineBlock(ctx),
        frankingBlockFromCtx(ctx, "Petitioner"),
        serviceBlockFromCtx(ctx, "claim"),
      ],
    }),
  },
  originating_motion: {
    documentType: "originating_motion",
    category: "litigation_process",
    requiredFields: COURT_FIELDS,
    proseSlots: [
      prose("originating_motion.reliefs", "Reliefs", "Each relief sought, phrased as DECLARATION / ORDER / COMPENSATION prayers under the relevant constitutional provisions.", 4000, "numbered"),
      prose("originating_motion.facts", "Statement of facts", "Numbered paragraphs of facts (facts only).", 8000, "numbered"),
      prose("originating_motion.grounds", "Grounds", "The grounds relied upon, one per line.", 4000, "numbered"),
    ],
    build: (ctx, fills): DocumentAST => {
      const frep = ctx.jurisdiction.frepRules?.text || "[FREP RULES TO BE VERIFIED]";
      return {
        id: "originating_motion-0",
        documentType: "originating_motion",
        blocks: [
          courtHeadingBlock(ctx),
          caseNumberBlock(ctx, "suit"),
          partiesBlockFromCtx(ctx, "motion"),
          { t: "processTitle", text: "ORIGINATING MOTION" },
          {
            t: "clause",
            text: lit(
              `TAKE NOTICE that this motion is brought pursuant to ${frep} for the enforcement of the Applicant's fundamental rights as enshrined in the Constitution of the Federal Republic of Nigeria 1999 (as amended) and the African Charter on Human and Peoples' Rights, praying for the reliefs set out hereunder:`
            ),
          },
          numberedFromFill(prose("originating_motion.reliefs", "Reliefs", "", 4000, "numbered"), fills),
          { t: "clause", text: lit("STATEMENT OF FACTS:") },
          dictatedOrProseBlock(ctx, prose("originating_motion.facts", "Statement of facts", "", 8000, "numbered", true), fills),
          { t: "clause", text: lit("GROUNDS:") },
          dictatedOrProseBlock(ctx, prose("originating_motion.grounds", "Grounds", "", 4000, "numbered"), fills, { fromDictated: "groundsOrFacts" }),
          dateLineBlock(ctx),
          frankingBlockFromCtx(ctx, "Applicant"),
          serviceBlockFromCtx(ctx, "motion"),
        ],
      };
    },
  },

  // Pleadings
  statement_of_defence: pleadingFamily("statement_of_defence", "STATEMENT OF DEFENCE"),
  statement_of_defence_and_counterclaim: pleadingFamily("statement_of_defence_and_counterclaim", "STATEMENT OF DEFENCE AND COUNTERCLAIM", { counterclaim: true }),
  reply_to_statement_of_defence: pleadingFamily("reply_to_statement_of_defence", "REPLY TO STATEMENT OF DEFENCE", {
    conclusion: "WHEREOF the Claimant joins issue with the Defendant on the Statement of Defence and shall rely on the Statement of Claim already filed.",
  }),
  reply_and_defence_to_counterclaim: pleadingFamily("reply_and_defence_to_counterclaim", "REPLY AND DEFENCE TO COUNTERCLAIM", {
    conclusion: "WHEREOF the Claimant denies the counterclaim in its entirety and shall contend that it is frivolous, vexatious and an abuse of court process.",
  }),

  // Interlocutory
  motion_on_notice: motionFamily("motion_on_notice", "MOTION ON NOTICE"),
  motion_ex_parte: motionFamily("motion_ex_parte", "MOTION EX PARTE", { exParte: true }),
  notice_of_preliminary_objection: motionFamily("notice_of_preliminary_objection", "NOTICE OF PRELIMINARY OBJECTION", {
    prayersLabel: "The Defendant will raise the following preliminary objection — the Court is respectfully urged to:",
  }),
  counter_affidavit: affidavitFamily("counter_affidavit", "COUNTER-AFFIDAVIT"),
  further_and_better_affidavit: affidavitFamily("further_and_better_affidavit", "FURTHER AND BETTER AFFIDAVIT"),
  supporting_affidavit: affidavitFamily("supporting_affidavit", "AFFIDAVIT IN SUPPORT OF MOTION ON NOTICE"),
  written_address: addressFamily("written_address"),
  final_written_address: addressFamily("final_written_address"),

  // Evidence / case management
  witness_statement_on_oath: affidavitFamily("witness_statement_on_oath", "WITNESS STATEMENT ON OATH", { witnessStyle: true }),
  list_of_witnesses: {
    documentType: "list_of_witnesses",
    category: "litigation_process",
    requiredFields: COURT_FIELDS,
    proseSlots: [prose("list_of_witnesses.witnesses", "Witnesses", "Each witness's full name and role (e.g. 'John Okafor — Claimant's manager'), one per line.", 3000, "numbered")],
    build: (ctx, fills): DocumentAST => {
      const people = ctx.dictated.namedPeople.filter((p) => /witness|deponent/i.test(p.role) || true).slice(0, 12);
      const items = people.length
        ? people.map((p) => ({ kind: "prose" as const, key: "dictated.namedPeople", text: `${p.name}${p.role ? ` — ${p.role}` : ""}`, status: "dictated" as const }))
        : null;
      return {
        id: "list_of_witnesses-0",
        documentType: "list_of_witnesses",
        blocks: [
          courtHeadingBlock(ctx),
          caseNumberBlock(ctx, "suit"),
          partiesBlockFromCtx(ctx, "claim"),
          { t: "processTitle", text: "LIST OF WITNESSES" },
          items ? { t: "numbered", items, style: "arabic" } : numberedFromFill(prose("list_of_witnesses.witnesses", "Witnesses", "", 3000, "numbered"), fills),
          dateLineBlock(ctx),
          frankingBlockFromCtx(ctx, "Applicant"),
        ],
      };
    },
  },
  list_of_documents: {
    documentType: "list_of_documents",
    category: "litigation_process",
    requiredFields: COURT_FIELDS,
    proseSlots: [prose("list_of_documents.documents", "Documents", "Each document the party will rely on, one per line, with its exhibit letter where known.", 4000, "numbered")],
    build: (ctx, fills): DocumentAST => {
      const docs = ctx.exhibits.length
        ? ctx.exhibits.map((e) => ({ kind: "literal" as const, text: `EXHIBIT ${e} — [[DESCRIPTION OF EXHIBIT ${e}]]` }))
        : null;
      return {
        id: "list_of_documents-0",
        documentType: "list_of_documents",
        blocks: [
          courtHeadingBlock(ctx),
          caseNumberBlock(ctx, "suit"),
          partiesBlockFromCtx(ctx, "claim"),
          { t: "processTitle", text: "LIST OF DOCUMENTS" },
          docs
            ? { t: "numbered", items: docs, style: "arabic" }
            : numberedFromFill(prose("list_of_documents.documents", "Documents", "", 4000, "numbered"), fills),
          dateLineBlock(ctx),
          frankingBlockFromCtx(ctx, "Applicant"),
        ],
      };
    },
  },
  pre_trial_information_sheet: {
    documentType: "pre_trial_information_sheet",
    category: "litigation_process",
    requiredFields: COURT_FIELDS,
    proseSlots: [prose("pre_trial_information_sheet.details", "Pre-trial information", "Names of counsel, estimated length of trial, number of witnesses, agreed/contested issues and any other pre-trial information.", 5000, "numbered")],
    build: (ctx, fills): DocumentAST => ({
      id: "pre_trial_information_sheet-0",
      documentType: "pre_trial_information_sheet",
      blocks: [
        courtHeadingBlock(ctx),
        caseNumberBlock(ctx, "suit"),
        partiesBlockFromCtx(ctx, "claim"),
        { t: "processTitle", text: "PRE-TRIAL INFORMATION SHEET" },
        { t: "clause", text: lit("Estimated length of trial: [[ESTIMATED LENGTH OF TRIAL]]") },
        { t: "clause", text: lit("Number of witnesses: [[NUMBER OF WITNESSES]]") },
        dictatedOrProseBlock(ctx, prose("pre_trial_information_sheet.details", "Pre-trial information", "", 5000, "numbered"), fills, { fromDictated: "specialInstructions" }),
        dateLineBlock(ctx),
        frankingBlockFromCtx(ctx, "Claimant"),
      ],
    }),
  },
  subpoena: formFamily("subpoena", "SUBPOENA", [
    "YOU are commanded in the name of the State to attend before this Honourable Court on the [[DAY]] day of [[MONTH]], at 9 O'clock in the forenoon, and from day to day until the trial is concluded, to give evidence on behalf of the [[PARTY]].",
    "IF YOU FAIL to attend, a warrant will be issued for your arrest.",
    "WITNESS: The Presiding Judge of this Honourable Court.",
  ]),
  notice_to_produce: formFamily("notice_to_produce", "NOTICE TO PRODUCE", [
    "TAKE NOTICE that at the trial of this action, the [[PARTY]] will rely on the following documents in your possession, custody or power:",
    "[[DOCUMENTS TO BE PRODUCED — list each document]]",
    "AND TAKE NOTICE that unless you produce the said documents at the trial, secondary evidence of their contents will be given.",
  ]),
  notice_to_admit: formFamily("notice_to_admit", "NOTICE TO ADMIT", [
    "TAKE NOTICE that unless within [[NUMBER OF DAYS]] days after service of this notice you admit the following facts and documents, costs of proving them will be claimed:",
    "[[FACTS / DOCUMENTS TO BE ADMITTED — list each]]",
  ]),

  // Execution
  garnishee_application: motionFamily("garnishee_application", "GARNISHEE PROCEEDINGS (MOTION ON NOTICE)", {
    enablingIntro: (ctx) => [
      {
        t: "clause",
        text: lit(
          `This application is brought pursuant to ${ctx.jurisdiction.garnisheeProvisions?.text || "[GARNISHEE PROVISIONS TO BE VERIFIED]"} for an order of this Honourable Court attaching the debts of the Judgment Debtor in the hands of the Garnishee named in the affidavit in support.`
        ),
      },
    ],
    prayersLabel: "The Judgment Creditor prays this Honourable Court for:",
  }),
  writ_of_fi_fa: formFamily("writ_of_fi_fa", "WRIT OF FI FA", [
    "TO THE SHERIFF OF [[STATE]]: WHEREAS on the [[DAY]] day of [[MONTH]], judgment was recovered in this Honourable Court by the above-named Judgment Creditor against the above-named Judgment Debtor for the sum of ₦[[AMOUNT]] plus costs;",
    "YOU ARE HEREBY COMMANDED that of the goods and chattels, lands and tenements of the said Judgment Debtor you cause to be levied the said sum plus costs; and that you have the said monies before this Honourable Court within [[NUMBER OF DAYS]] days of the date of this Writ to be rendered to the Judgment Creditor;",
    "MAKE KNOWN the return day of this Writ.",
  ]),
  judgment_debtor_summons: formFamily("judgment_debtor_summons", "JUDGMENT DEBTOR SUMMONS", [
    "YOU, the above-named Judgment Debtor, are required to appear before this Honourable Court on the [[DAY]] day of [[MONTH]], at 9 O'clock in the forenoon, to be examined on oath concerning your property and means of satisfying the judgment against you.",
    "IF YOU FAIL to attend, you will be liable to be committed to prison.",
  ]),
  stay_of_execution: motionFamily("stay_of_execution", "MOTION ON NOTICE FOR STAY OF EXECUTION"),
  terms_of_settlement: {
    documentType: "terms_of_settlement",
    category: "execution_and_enforcement",
    requiredFields: COURT_FIELDS,
    proseSlots: [prose("terms_of_settlement.terms", "Settlement terms", "Each agreed term, numbered, in the order agreed.", 6000, "numbered")],
    build: (ctx, fills): DocumentAST => ({
      id: "terms_of_settlement-0",
      documentType: "terms_of_settlement",
      blocks: [
        courtHeadingBlock(ctx),
        caseNumberBlock(ctx, "suit"),
        partiesBlockFromCtx(ctx, "claim"),
        { t: "processTitle", text: "TERMS OF SETTLEMENT" },
        { t: "clause", text: lit("BY CONSENT of the parties, the following terms of settlement are adopted as the judgment of this Honourable Court:") },
        dictatedOrProseBlock(ctx, prose("terms_of_settlement.terms", "Settlement terms", "", 6000, "numbered"), fills, { fromDictated: "specialInstructions" }),
        dateLineBlock(ctx),
        frankingBlockFromCtx(ctx, "Claimant"),
      ],
    }),
  },

  // Appellate
  notice_of_appeal: {
    documentType: "notice_of_appeal",
    category: "appellate_process",
    requiredFields: COURT_FIELDS,
    proseSlots: [prose("notice_of_appeal.part appealed", "Part appealed", "Whether the appeal is against the whole or part of the decision (and which part).", 800)],
    build: (ctx, fills): DocumentAST => ({
      id: "notice_of_appeal-0",
      documentType: "notice_of_appeal",
      blocks: [
        courtHeadingBlock(ctx, { appellate: true }),
        caseNumberBlock(ctx, "appeal"),
        partiesBlockFromCtx(ctx, "appeal"),
        { t: "processTitle", text: "NOTICE OF APPEAL" },
        {
          t: "clause",
          text: lit(
            "TAKE NOTICE that the Appellant, being dissatisfied with the decision of [[LOWER COURT AND JUDGE]] in Suit No [[SUIT NUMBER OF LOWER COURT]] delivered on the [[DAY]] day of [[MONTH]], hereby appeals against " +
              (fills["notice_of_appeal.part appealed"]?.trim() || "[[WHOLE / PART OF THE]]") +
              " the said decision upon the grounds set out in paragraph 3 hereof and will at the hearing of the appeal seek the reliefs set out in paragraph 4 hereof."
          ),
        },
        { t: "clause", text: lit("1. PARTIES: The names and addresses of all parties directly affected by the appeal are as stated above.") },
        { t: "clause", text: lit("2. RELIEF SOUGHT: [[RELIEF SOUGHT FROM THE APPELLATE COURT]]") },
        { t: "clause", text: lit("3. GROUNDS OF APPEAL: As per the Notice/Grounds of Appeal filed herewith — see the Grounds of Appeal document in this bundle.") },
        { t: "clause", text: lit("4. ADDRESS FOR SERVICE: the Appellant's address for service is c/o [[COUNSEL NAME AND FIRM]], [[FIRM ADDRESS]].") },
        dateLineBlock(ctx),
        frankingBlockFromCtx(ctx, "Appellant"),
      ],
    }),
  },
  grounds_of_appeal: {
    documentType: "grounds_of_appeal",
    category: "appellate_process",
    requiredFields: COURT_FIELDS,
    proseSlots: [
      prose(
        "grounds_of_appeal.grounds",
        "Grounds of appeal",
        "Each ground of appeal, one per line, in the form: 'GROUND ONE — ERROR IN LAW: <the error>; PARTICULARS: <the particulars>'. Use ERROR IN LAW, MISDIRECTION (IN LAW OR FACT), ERROR IN FACT or MIXED LAW AND FACT as the ground title.",
        8000,
        "numbered"
      ),
    ],
    build: (ctx, fills): DocumentAST => {
      const fill = (fills["grounds_of_appeal.grounds"] || "").trim();
      const grounds = linesOf(fill);
      const items = grounds.length
        ? grounds.map((g) => ({ kind: "prose" as const, key: "grounds_of_appeal.grounds", text: g, status: "generated" as const }))
        : [
            { kind: "literal" as const, text: "GROUND ONE — [[ERROR IN LAW / MISDIRECTION / ERROR IN FACT / MIXED LAW AND FACT]]: [[THE GROUND]]" },
            { kind: "literal" as const, text: "PARTICULARS OF ERROR: [[PARTICULARS]]" },
          ];
      return {
        id: "grounds_of_appeal-0",
        documentType: "grounds_of_appeal",
        blocks: [
          courtHeadingBlock(ctx, { appellate: true }),
          caseNumberBlock(ctx, "appeal"),
          partiesBlockFromCtx(ctx, "appeal"),
          { t: "processTitle", text: "GROUNDS OF APPEAL" },
          { t: "clause", text: lit("The Appellant will rely upon the following grounds of appeal at the hearing of the appeal:") },
          { t: "numbered", items, style: "arabic" },
          dateLineBlock(ctx),
          frankingBlockFromCtx(ctx, "Appellant"),
        ],
      };
    },
  },
  appellants_brief: briefFamily("appellants_brief", "APPELLANT'S BRIEF OF ARGUMENT"),
  respondents_brief: briefFamily("respondents_brief", "RESPONDENT'S BRIEF OF ARGUMENT"),
  reply_brief: briefFamily("reply_brief", "APPELLANT'S REPLY BRIEF"),
  motion_for_leave_or_extension: motionFamily("motion_for_leave_or_extension", "MOTION ON NOTICE FOR LEAVE / EXTENSION OF TIME"),

  // Statutory notices — operative wording driven by the CODE-COMPUTED period (AC3.5).
  notice_to_quit: noticeFamily(
    "notice_to_quit",
    "NOTICE TO QUIT",
    (ctx) =>
      `TAKE NOTICE that, pursuant to ${ctx.jurisdiction.noticePeriodRule?.text || "[STATUTORY PROVISION TO BE VERIFIED]"}, your tenancy of the premises known as [[PREMISES]], held on a ${noticeTenancy(ctx)}, shall determine on the [[EXPIRY DATE]], and you are hereby required to QUIT and deliver up possession of the said premises on or before that date. THIS NOTICE is given in accordance with the notice period of ${
        ctx.noticePeriodDays === null
          ? "[[STATUTORY NOTICE PERIOD]]"
          : noticePeriodWords(ctx.noticePeriodDays)
      } applicable to your tenancy.`
  ),
  seven_days_notice_of_intention: noticeFamily(
    "seven_days_notice_of_intention",
    "SEVEN DAYS' NOTICE OF OWNER'S INTENTION TO RECOVER POSSESSION",
    (ctx) =>
      `TAKE NOTICE that the landlord of the premises known as [[PREMISES]] intends, after the expiration of SEVEN (7) clear days from the service of this notice, to apply to the ${
        ctx.jurisdiction.label
      } for the recovery of possession of the said premises on the ground that you, the tenant, are in arrears of rent and/or breach of covenant. ${ctx.noticePeriodConflict ? "[COUNSEL WARNING: the dictated notice period is shorter than the statutory minimum for this tenancy type — verify before service.]" : ""}`
  ),
  statutory_demand_notice: noticeFamily(
    "statutory_demand_notice",
    "STATUTORY DEMAND",
    () =>
      "TAKE NOTICE that unless within [[NUMBER OF DAYS]] days after the service of this statutory demand you pay the debt of ₦[[AMOUNT]] owing from you to the Creditor, or secure or compound for it to the Creditor's satisfaction, proceedings will be commenced for your bankruptcy / the winding-up of your company (as applicable), and this demand may be relied upon in such proceedings."
  ),
  pre_action_notice: noticeFamily(
    "pre_action_notice",
    "NOTICE OF INTENTION TO COMMENCE LEGAL PROCEEDINGS",
    () =>
      "TAKE NOTICE that the undersigned, on the instruction of [[CLIENT NAME]], intends to commence legal proceedings against you in respect of the subject matter set out below unless the dispute is resolved within [[NUMBER OF DAYS]] days of the service of this notice. This notice is served in compliance with the applicable pre-action rules."
  ),
  notice_of_breach_of_covenant: noticeFamily(
    "notice_of_breach_of_covenant",
    "NOTICE OF BREACH OF COVENANT",
    () =>
      "TAKE NOTICE that you are in breach of the covenants/obligations set out below. You are required to remedy the said breaches within [[NUMBER OF DAYS]] days of the service of this notice, failing which the landlord/principal shall be entitled to re-enter and/or enforce the covenants against you, including by proceedings for recovery of possession and/or damages."
  ),

  // Letters / instruments
  formal_demand_letter: letterFamily("formal_demand_letter", "FORMAL DEMAND", { demand: true }),
  engagement_letter: letterFamily("engagement_letter", "RE: ENGAGEMENT OF LEGAL SERVICES"),
  official_correspondence: letterFamily("official_correspondence", "RE: [[SUBJECT OF THE LETTER]]"),

  tenancy_or_lease_agreement: instrumentFamily(
    "tenancy_or_lease_agreement",
    "TENANCY AGREEMENT",
    "THIS TENANCY AGREEMENT is made on this [[DAY]] day of [[MONTH]] BETWEEN [[LANDLORD NAME]] of [[LANDLORD ADDRESS]] (hereinafter 'the Landlord') AND [[TENANT NAME]] of [[TENANT ADDRESS]] (hereinafter 'the Tenant').",
    [
      prose("tenancy_or_lease_agreement.premises", "Premises & term", "The premises description and the term (commencement, duration, determined by the dictated periods) plus the rent (from the dictated amounts). Never invent figures.", 3000),
      prose("tenancy_or_lease_agreement.covenants", "Covenants", "The parties' covenants (payment of rent, use of premises, repairs, etc.) as conventional numbered obligations.", 6000, "numbered"),
    ]
  ),
  deed_of_assignment: instrumentFamily(
    "deed_of_assignment",
    "DEED OF ASSIGNMENT",
    "THIS DEED OF ASSIGNMENT is made on this [[DAY]] day of [[MONTH]] BETWEEN [[ASSIGNOR NAME]] (hereinafter 'the Assignor') AND [[ASSIGNEE NAME]] (hereinafter 'the Assignee').",
    [
      prose("deed_of_assignment.recitals", "Recitals & consideration", "The WHEREAS recitals (root of title, prior interests) and the consideration (from the dictated amounts). Never invent figures.", 4000),
      prose("deed_of_assignment.operative", "Operative clauses", "The assignment, the covenants for title, and the governor's-consent condition, as conventional numbered clauses.", 6000, "numbered"),
    ]
  ),
  power_of_attorney: instrumentFamily(
    "power_of_attorney",
    "POWER OF ATTORNEY",
    "I, [[DONOR FULL NAME]] of [[DONOR ADDRESS]] HEREBY APPOINT [[ATTORNEY FULL NAME]] of [[ATTORNEY ADDRESS]] (hereinafter 'my Attorney') to be my true and lawful attorney.",
    [
      prose("power_of_attorney.powers", "Powers conferred", "Each power conferred on the attorney, one per line (e.g. to sign documents, collect rents, appear before authorities).", 5000, "numbered"),
    ]
  ),
  mou_or_heads_of_terms: instrumentFamily(
    "mou_or_heads_of_terms",
    "MEMORANDUM OF UNDERSTANDING (HEADS OF TERMS)",
    "THIS MEMORANDUM OF UNDERSTANDING is made on this [[DAY]] day of [[MONTH]] BETWEEN [[FIRST PARTY NAME]] AND [[SECOND PARTY NAME]] (each a 'Party', together 'the Parties').",
    [
      prose("mou_or_heads_of_terms.terms", "Heads of terms", "Each head of term (subject matter, obligations, timeline, governing law, non-binding statement), one per line.", 6000, "numbered"),
    ]
  ),

  // Forms
  memorandum_of_appearance: formFamily("memorandum_of_appearance", "MEMORANDUM OF APPEARANCE", [
    "The above-named Defendant enters an appearance to this Writ / Claim.",
    "Name of Defendant's Solicitor: [[SOLICITOR NAME]]. Firm: [[FIRM NAME]]. Address for service: [[FIRM ADDRESS]].",
  ]),
  conditional_memorandum_of_appearance: formFamily("conditional_memorandum_of_appearance", "CONDITIONAL MEMORANDUM OF APPEARANCE", [
    "The above-named Defendant enters a CONDITIONAL appearance to this Writ / Claim solely for the purpose of contesting the jurisdiction of this Honourable Court, and not for the purpose of defending the claim on the merits.",
    "Name of Defendant's Solicitor: [[SOLICITOR NAME]]. Firm: [[FIRM NAME]]. Address for service: [[FIRM ADDRESS]].",
  ]),
  certificate_of_pre_action_counselling: formFamily("certificate_of_pre_action_counselling", "CERTIFICATE OF PRE-ACTION COUNSELLING", [
    "I certify that the intending claimant has undergone pre-action counselling in respect of the intended proceedings in accordance with the applicable pre-action rules.",
    "Name of Counsellor: [[COUNSELLOR NAME]]. Signature: ______________. Date: [[DATE]].",
  ], { courtCaption: false }),
  undertaking_as_to_costs: formFamily("undertaking_as_to_costs", "UNDERTAKING AS TO COSTS", [
    "I, [[COUNSEL NAME]], of counsel to the [[PARTY]], HEREBY UNDERTAKE to pay any costs which this Honourable Court may order against the said [[PARTY]] in respect of this process.",
  ]),
};

/** Tenancy wording for notices (from the property record; placeholder when unknown). */
function noticeTenancy(ctx: HydratedDraftContext): string {
  const d = ctx.dictated.periods.find((p) => /tenan|period/i.test(p.label));
  if (d) return `${d.value} ${d.unit} tenancy`;
  return "[[TENANCY TYPE]] tenancy";
}
