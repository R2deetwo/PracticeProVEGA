/**
 * draftProBlueprintService.ts — client-side orchestrator of the Voice →
 * DraftPro Litigation Drafting Pipeline (owner spec, 2026-11-19, §5d).
 *
 * "Generate & Open in DraftPro →" runs:
 *
 *   1. hydrate()                     — pure DB merge, no LLM (spec §5a)
 *   2. fillProseSlots() per document — the ONLY LLM calls in the pipeline,
 *      one batched strict-JSON call per document, validated + citation-
 *      scrubbed before anything reaches an AST (spec §5b)
 *   3. assembleBundle()              — deterministic templates build every
 *      structural block (spec §5c); affidavit paragraphs flow into sibling
 *      written addresses so cross-references match (AC3.6)
 *   4. validateBundle() + computeMissingFields() — structural validation and
 *      the CODE-computed missing-field diff (spec §4.6)
 *   5. bundleToHtml()                — the single AST→HTML render feeding the
 *      editor, DOCX and PDF (spec §1)
 *
 * The card then creates the documents row (with documentType + matterId),
 * persists the bundle in the draft session and opens DraftPro.
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { Matter, FirmDetails, User, Property } from "../types";
import type {
  DraftBlueprint,
  DraftBundle,
  MissingField,
  HydratedDraftContext,
} from "../legal/drafting/types";
import { hydrate, type HydrateInputs } from "../legal/drafting/hydrate";
import {
  assembleBundle,
  affidavitParagraphs,
  buildProseFillPrompt,
  collectProseSlotSpecs,
  computeMissingFields,
  validateBundle,
  type AstValidation,
} from "../legal/drafting/assemble";
import { validateProseFill, } from "../legal/drafting/assemble";
import { bundleToHtml } from "../legal/drafting/astToHtml";
import type { AuthorityEntry } from "../legal/drafting/authorityLibrary";
import { fillProseSlots } from "./geminiService";

const CONVEX_URL =
  (import.meta.env.VITE_CONVEX_URL as string) ||
  "https://gregarious-malamute-537.convex.cloud";

const convex = new ConvexHttpClient(CONVEX_URL);

function readSessionBearer(): string | undefined {
  return (
    (typeof sessionStorage !== "undefined" &&
      sessionStorage.getItem("practicepro_session_bearer")) ||
    (typeof localStorage !== "undefined" &&
      localStorage.getItem("practicepro_session_bearer")) ||
    undefined
  );
}

/** The firm's authority library (empty until the firm adds entries). */
export async function listAuthorities(): Promise<AuthorityEntry[]> {
  try {
    const rows: any[] = await convex.query(api.authorityLibrary.listAuthorities, {
      sessionToken: readSessionBearer(),
    });
    return (rows || []).map((r) => ({
      citation: r.citation,
      court: r.court || "",
      year: r.year || "",
      proposition: r.proposition || "",
      verified: r.verified === true,
    }));
  } catch {
    return []; // the library is optional context — never fatal
  }
}

/** Editor "Add authority" action (spec §6.2). */
export async function addAuthority(entry: AuthorityEntry): Promise<void> {
  await convex.mutation(api.authorityLibrary.addAuthority, {
    citation: entry.citation,
    court: entry.court,
    year: entry.year,
    proposition: entry.proposition,
    verified: entry.verified,
    sessionToken: readSessionBearer(),
  });
}

export interface GenerateBundleArgs {
  blueprint: DraftBlueprint;
  matter?: Matter | null;
  firm?: FirmDetails | null;
  user?: User | null;
  property?: Property | null;
  caseNotes?: string[];
  endorsements?: string[];
  /** Extra slot fills the caller already has (e.g. edited reliefs). */
  presetFills?: Record<number, Record<string, string>>;
  onProgress?: (message: string) => void;
}

export interface GenerateBundleResult {
  bundle: DraftBundle;
  ctx: HydratedDraftContext;
  missing: MissingField[];
  validations: Array<{ id: string; v: AstValidation }>;
  html: string;
  /** Slots whose generated fill was rejected by a validator. */
  rejectedSlots: Array<{ key: string; reason: string }>;
}

/**
 * The full deterministic assembly. Throws only on total failure (no
 * documents); individual slot failures degrade to placeholder pills —
 * generation never blocks on missing fields (spec §5d).
 */
export async function generateDraftBundle(
  args: GenerateBundleArgs
): Promise<GenerateBundleResult> {
  const blueprint = args.blueprint;
  if (blueprint.documents.length === 0) {
    throw new Error("The blueprint has no documents to generate — pick a document type first.");
  }

  const hydrateInputs: HydrateInputs = {
    blueprint,
    matter: (args.matter || null) as HydrateInputs["matter"],
    firm: (args.firm || null) as HydrateInputs["firm"],
    user: (args.user || null) as HydrateInputs["user"],
    property: (args.property || null) as HydrateInputs["property"],
    caseNotes: args.caseNotes,
    endorsements: args.endorsements,
  };
  const ctx = hydrate(hydrateInputs);

  const library = await listAuthorities();
  const matterNotes = ctx.matter?.caseNotes || [];

  // ── Pass 1: fill every document's prose slots. Affidavit-family documents
  //    are filled FIRST so their numbered paragraphs can seed the written
  //    addresses' facts slots (AC3.6).
  const slotSpecs = collectProseSlotSpecs(blueprint);
  const affidavitTypes = new Set([
    "supporting_affidavit",
    "counter_affidavit",
    "further_and_better_affidavit",
    "witness_statement_on_oath",
  ]);
  const fills: Record<number, Record<string, string>> = {};
  for (const k of Object.keys(args.presetFills || {})) {
    fills[Number(k)] = { ...(args.presetFills?.[Number(k)] || {}) };
  }
  const rejectedSlots: Array<{ key: string; reason: string }> = [];

  const docIsAffidavit = (i: number) =>
    affidavitTypes.has(blueprint.documents[i].documentType);
  const ordered = [0, 1, 2, 3, 4, 5].filter((i) => i < blueprint.documents.length);
  const passOrder = [
    ...ordered.filter((i) => docIsAffidavit(i)),
    ...ordered.filter((i) => !docIsAffidavit(i)),
  ];

  let siblingParagraphs: string[] = [];
  for (const docIndex of passOrder) {
    const doc = blueprint.documents[docIndex];
    const specs = slotSpecs.filter((s) => s.documentIndex === docIndex);
    if (specs.length === 0) continue;
    if (fills[docIndex] && Object.keys(fills[docIndex]).length >= specs.length) continue;

    args.onProgress?.(`Drafting the ${doc.documentType.replace(/_/g, " ")}…`);
    const prompt = buildProseFillPrompt({
      documentType: doc.documentType,
      specs: specs.map((s) => s.spec),
      dictated: blueprint.dictated,
      matterNotes,
      siblingAffidavitParagraphs:
        !docIsAffidavit(docIndex) && siblingParagraphs.length > 0
          ? siblingParagraphs
          : undefined,
      exhibitLetters: ctx.exhibits,
    });
    const generated = await fillProseSlots({
      system: prompt.system,
      user: prompt.user,
    });
    const docFills: Record<string, string> = fills[docIndex] || {};
    for (const s of specs) {
      if (docFills[s.spec.key]) continue; // preset fill wins
      const raw = generated[s.spec.key] || "";
      if (!raw) continue;
      const validation = validateProseFill(s.spec, raw, library);
      if (validation.ok) {
        docFills[s.spec.key] = validation.text;
      } else {
        rejectedSlots.push({ key: s.spec.key, reason: validation.reason || "rejected" });
      }
    }
    fills[docIndex] = docFills;
  }

  const bundle = assembleBundle({ blueprint, ctx, fills });

  // Sibling affidavit paragraphs for a potential re-generation of addresses.
  siblingParagraphs = affidavitParagraphs(bundle);

  const missing = computeMissingFields(
    ctx,
    blueprint.documents.map((d) => ({ documentType: d.documentType }))
  );
  const validations = validateBundle(bundle);
  const html = bundleToHtml(bundle);

  return { bundle, ctx, missing, validations, html, rejectedSlots };
}
