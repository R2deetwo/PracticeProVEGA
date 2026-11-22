/**
 * build-soc-draft.ts — R78 (2026-11-22): builds the Statement of Claim
 * draft behind the landing page's new DraftPro editor capture
 * (editor-r81.jpg) THROUGH THE APP'S OWN PIPELINE — assembleBundle +
 * bundleToHtml from src/legal/drafting — so the document shown in the
 * capture is genuinely what the product renders: centred court caption,
 * right-aligned case number, dotted-leader party block, centred bold
 * underlined process title, numbered paragraphs, franking block.
 *
 * The old editor.jpg capture showed an AI-drafted document with every
 * line flush-left (the owner's report: "fix alignment, spacing, and
 * formatting so court captions, headings, parties, and body paragraphs
 * look properly formatted to a lawyer's eye"). This builder feeds the
 * properly-assembled bundle into the editor's own draft-session store;
 * the capture is then taken of the REAL app rendering it.
 *
 * Run: npx tsx scripts/build-soc-draft.ts
 * Outputs: /tmp/soc-draft-session.json (the DraftSessionData payload
 * the capture script stashes into localStorage before opening /editor).
 */
import { writeFileSync } from "node:fs";
import { assembleBundle } from "../src/legal/drafting/assemble";
import { bundleToHtml } from "../src/legal/drafting/astToHtml";
import { LAGOS_HIGH_COURT } from "../src/legal/drafting/jurisdictionProfiles";
import type {
  DictatedContent,
  DraftBlueprint,
  DraftBundle,
  HydratedDraftContext,
} from "../src/legal/drafting/types";

const emptyDictated: DictatedContent = {
  reliefs: [],
  groundsOrFacts: [],
  amounts: [],
  periods: [],
  dates: [],
  namedPeople: [],
  specialInstructions: [],
};

const blueprint: DraftBlueprint = {
  documents: [
    {
      documentCategory: "litigation_process",
      documentType: "statement_of_claim",
      order: 1,
    },
  ],
  matchedMatterId: "m-lit-042",
  matchConfidence: 0.97,
  matchAlternatives: [],
  dictated: emptyDictated,
  missingCriticalFields: [],
  rawTranscript:
    "Draft a statement of claim for the Meridian Agro supply contract breach — Lagos High Court.",
};

const ctx: HydratedDraftContext = {
  matter: {
    id: "m-lit-042",
    court: {
      value: { courtName: "High Court of Lagos State", division: "Lagos", location: "Lagos" },
      source: "matter",
    },
    caseNumber: {
      value: { kind: "suit", number: "LD/ADR/2024/011" },
      source: "matter",
    },
    parties: [
      { name: "Meridian Agro Processing Ltd.", capacity: "claimant", ordinal: 1 },
      { name: "Savannah Haulage Ltd.", capacity: "defendant", ordinal: 1 },
    ],
    caseNotes: [],
    endorsements: [],
  },
  firm: {
    counselName: { value: "Seun Badejo, Esq.", source: "firm" },
    enrollmentNumber: { value: "NBA/1998/1417", source: "firm" },
    firmName: { value: "Badejo & Associates", source: "firm" },
    firmAddress: { value: "14B A.J. Marinho Drive, Victoria Island, Lagos", source: "firm" },
    firmEmail: { value: "chambers@badejoassociates.ng", source: "firm" },
    firmPhone: { value: "+234 803 000 0000", source: "firm" },
  },
  jurisdiction: LAGOS_HIGH_COURT,
  dictated: emptyDictated,
  rawParties: [
    { name: "Meridian Agro Processing Ltd.", role: "Claimant" },
    { name: "Savannah Haulage Ltd.", role: "Defendant" },
  ],
  noticePeriodDays: null,
  noticePeriodConflict: false,
  exhibits: [],
};

const fills: Record<number, Record<string, string>> = {
  0: {
    "statement_of_claim.materialFacts":
      "The Claimant is a company incorporated under the laws of the Federal Republic of Nigeria and carries on business as an agro-processing concern at Plot 8, Apapa-Oshodi Expressway, Lagos." +
      "\nThe Defendant is a company incorporated under the laws of the Federal Republic of Nigeria and carries on business as a road haulage and logistics services provider at 22 Warehouse Road, Apapa, Lagos." +
      "\nBy a Haulage Services Agreement dated the 15th day of March 2024, the Claimant engaged the Defendant to convey 4,200 bags of processed cassava flour from the Claimant's Apapa warehouse to the Claimant's distribution depot in Kano, and the Claimant paid the agreed freight charge of \u20a618,500,000.00 in advance." +
      "\nThe Defendant conveyed only 2,650 bags of the consignment and delivered the remaining 1,550 bags late, in a wet-damaged and unsaleable condition, contrary to clauses 6 and 11 of the Agreement." +
      "\nThe Claimant, by its letter of demand dated the 2nd day of July 2024, demanded the refund of the freight charges attributable to the undelivered and damaged portion of the consignment together with damages, but the Defendant has neglected and refused to pay.",
    "statement_of_claim.reliefs":
      "A declaration that the Defendant is in breach of the Haulage Services Agreement dated the 15th day of March 2024." +
      "\nThe sum of \u20a66,831,250.00 being the refund of freight charges attributable to the 1,550 bags not conveyed and the wet-damaged portion of the consignment." +
      "\nThe sum of \u20a624,000,000.00 as general damages for the loss of the consignment and loss of trade." +
      "\nInterest at the rate of 10% per annum on the sums awarded from the date of judgment until final liquidation.",
  },
};

const bundle: DraftBundle = assembleBundle({ blueprint, ctx, fills });
const html = bundleToHtml(bundle);

const session = {
  title: "Statement of Claim — Meridian Agro v. Savannah Haulage",
  content: html,
  // NOTE: no draftPrompt — the editor must NOT fire an AI auto-draft over
  // the assembled bundle when the capture is taken.
  matterId: null,
  documentId: null,
  documentType: "statement_of_claim",
  draftBundle: bundle,
  updatedAt: new Date().toISOString(),
  savedAt: Date.now(),
};

writeFileSync("/tmp/soc-draft-session.json", JSON.stringify(session, null, 2));
writeFileSync("/tmp/soc-preview.html", `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:'Times New Roman',serif;max-width:6.5in;margin:2rem auto;padding:0 1rem;line-height:1.7}p{margin:0 0 .4em}</style></head><body>${html}</body></html>`);
console.log("bundle documents:", bundle.documents.length);
console.log("html length:", html.length);
console.log("wrote /tmp/soc-draft-session.json + /tmp/soc-preview.html");
