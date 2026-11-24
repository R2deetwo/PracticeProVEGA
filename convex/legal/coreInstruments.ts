/**
 * legal/coreInstruments — the curated CORE NIGERIAN AUTHORITIES seed list
 * (2026-11-25, Antigravity audit response: "Legal KB Corpus Emptiness —
 * the pipeline tables hold 1 judgment chunk and 0 statutory instruments;
 * seed the database with high-frequency statutes so they are searchable").
 *
 * WHAT THIS IS: verified METADATA rows for the highest-frequency Nigerian
 * authorities, landed in `legal_instruments` through the seed action, PLUS
 * a CURATED-priority scrape-queue row per instrument so the ingestion
 * engine fetches the REAL TEXT (with SHA-256 provenance, chunks, embeddings)
 * the moment it runs. What this is NOT: statutory text. Not one line of
 * legislation is reproduced here — that only arrives through the pipeline
 * from the authoritative sources below. (House rule 2: no invented legal
 * specifics.)
 *
 * EVERY citation fact below was verified against live sources on 2026-11-25
 * (PLAC consolidated texts, the Federal Republic of Nigeria Official
 * Gazette copies, WIPO Lex, the NBA's October 2024 compliance notice and
 * the issuing gazette prefaces). Amendment details live in
 * amendmentTracker; statuses are the legacy vocabulary the currency
 * derivation reads (in_force | amended | repealed) — currencyStatus is
 * derived at seed time, mirroring the ingest path.
 *
 * PURE module — no Convex imports — so vitest pins the invariants
 * (tests/unit/coreInstrumentsSeed.test.ts) and the seed action imports the
 * same single source of truth.
 */

export interface CoreInstrumentDef {
  title: string;
  key: string;
  issuingBody: string;
  /** act | rules_of_court | subsidiary_instrument (soft vocabulary). */
  instrumentType: string;
  commencementDate?: string;
  year?: number;
  /** in_force | amended | repealed — what deriveCurrencyStatus reads. */
  status: string;
  /** Deliberately EMPTY until the pipeline ingests the real text. */
  structure: Array<{ level: string; number: string; heading: string }>;
  amendmentTracker: {
    amended: boolean;
    amendmentRefs: string[];
    repealed: boolean;
    repealRef?: string;
  };
  summary?: string;
  sourceUrl: string;
  /** DOMAIN_CATEGORIES value for the scrape-queue row. */
  domainCategory: string;
}

export const CORE_INSTRUMENTS: CoreInstrumentDef[] = [
  {
    title: "Constitution of the Federal Republic of Nigeria 1999 (as altered)",
    key: "constitution_1999",
    issuingBody: "National Assembly",
    instrumentType: "act",
    year: 1999,
    status: "amended",
    structure: [],
    amendmentTracker: {
      amended: true,
      amendmentRefs: [
        "First Alteration (2010)",
        "Second Alteration (2010)",
        "Third Alteration (2010)",
        "Fourth Alteration (2017)",
        "Fifth Alteration (2023) - 16 alteration acts assented 17 March 2023",
      ],
      repealed: false,
    },
    summary:
      "The supreme law of the Federal Republic of Nigeria. Amended through the Fifth Alteration (2023). Consolidated text published by PLAC; the sovereignty of the text itself rests with the Federal Government Printer's gazette.",
    sourceUrl:
      "https://placng.org/i/wp-content/uploads/2023/05/Constitution-of-the-Federal-Republic-of-Nigeria-2023.pdf",
    domainCategory: "statutes",
  },
  {
    title: "Companies and Allied Matters Act, 2020 (No. 3 of 2020)",
    key: "cama_2020",
    issuingBody: "National Assembly",
    instrumentType: "act",
    year: 2020,
    status: "in_force",
    structure: [],
    amendmentTracker: {
      amended: false,
      amendmentRefs: [],
      repealed: false,
    },
    summary:
      "The federal companies legislation. Repeals CAMA (Cap. C20 LFN 2004). Gazetted Official Gazette No. 124, Vol. 107, Lagos, 10 August 2020. Introduces single-shareholder companies, beneficial-ownership registers and the reform of corporate rescue.",
    sourceUrl:
      "https://icrp.cac.gov.ng/assets/docs/CAMA-NOTE%20FINAL-FULL-VERSION.pdf",
    domainCategory: "statutes",
  },
  {
    title: "Evidence Act, 2011 (Act No. 18 of 2011, as amended)",
    key: "evidence_act_2011",
    issuingBody: "National Assembly",
    instrumentType: "act",
    year: 2011,
    status: "amended",
    structure: [],
    amendmentTracker: {
      amended: true,
      amendmentRefs: [
        "Evidence (Amendment) Act, 2023 (assented 12 June 2023) - amends sections 84, 93, 108, 109, 110, 119, 255 and 258 (electronic and audio-visual evidence)",
      ],
      repealed: false,
    },
    summary:
      "The evidence law for all judicial proceedings in Nigerian courts. The 2023 Amendment Act modernised computer-generated and audio-visual evidence (oaths and testimony via electronic means).",
    sourceUrl: "https://placng.org/lawsofnigeria/laws/E14.pdf",
    domainCategory: "statutes",
  },
  {
    title: "Land Use Act (Cap. L5 LFN 2004; Decree No. 6 of 1978)",
    key: "land_use_act",
    issuingBody: "Federal Military Government (1978 decree)",
    instrumentType: "act",
    year: 1978,
    status: "in_force",
    structure: [],
    amendmentTracker: {
      amended: false,
      amendmentRefs: [],
      repealed: false,
    },
    summary:
      "Vests all land in the territory of each state in the governor of that state and governs rights of occupancy, consent to alienation and revocation. Entrenched in the 1999 Constitution (s. 315(5)) so amendment follows the constitutional-alteration process.",
    sourceUrl: "https://faolex.fao.org/docs/pdf/nig67625.pdf",
    domainCategory: "statutes",
  },
  {
    title: "Federal High Court (Civil Procedure) Rules, 2019",
    key: "fhc_civil_rules_2019",
    issuingBody: "Federal High Court of Nigeria",
    instrumentType: "rules_of_court",
    year: 2019,
    status: "in_force",
    structure: [],
    amendmentTracker: {
      amended: false,
      amendmentRefs: [],
      repealed: false,
    },
    summary:
      "Civil procedure rules of the Federal High Court: originating processes, motion practice, pre-trial conferences and judgment enforcement, including the front-loading and case-management directions.",
    sourceUrl:
      "https://akabogulaw.com/wp-content/uploads/2021/07/FHC-Rules-2019-Federal-High-Court-Civil-Procedure-Rules-2019-1.pdf",
    domainCategory: "rules_of_court",
  },
  {
    title: "High Court of Lagos State (Civil Procedure) Rules, 2019",
    key: "lagos_hc_civil_rules_2019",
    issuingBody: "Lagos State Judiciary",
    instrumentType: "rules_of_court",
    year: 2019,
    status: "in_force",
    structure: [],
    amendmentTracker: {
      amended: false,
      amendmentRefs: [],
      repealed: false,
    },
    summary:
      "The civil procedure rules of the Lagos State High Court: writ and originating summons practice, the undefended list, front-loaded processes, pre-trial conferences and active case management.",
    sourceUrl:
      "https://oblp.org/wp-content/uploads/2021/01/Lagos-State-High-Court-Civil-Procedure-Rules-2019-.pdf",
    domainCategory: "rules_of_court",
  },
  {
    title: "Rules of Professional Conduct for Legal Practitioners, 2023",
    key: "rpc_2023",
    issuingBody: "General Council of the Bar",
    instrumentType: "subsidiary_instrument",
    commencementDate: "2024-01-01",
    year: 2023,
    status: "in_force",
    structure: [],
    amendmentTracker: {
      amended: false,
      amendmentRefs: [],
      repealed: false,
    },
    summary:
      "The professional-conduct rules made by the General Council of the Bar under s. 12(4) of the Legal Practitioners Act on 6 June 2023, gazetted at pages B725-771 and commenced 1 January 2024. Three chapters of 78 rules; Chapter Two introduces the anti-money-laundering and counter-terrorism-financing guidelines for legal practitioners. Revokes the 2007 Rules with effect from 31 December 2023.",
    sourceUrl:
      "https://barristerng.com/wp-content/uploads/2023/06/Rules-of-Professional-Conduct-for-Legal-Practitioners-2023.pdf",
    domainCategory: "subsidiary",
  },
  {
    title: "Rules of Professional Conduct for Legal Practitioners, 2007",
    key: "rpc_2007",
    issuingBody: "General Council of the Bar",
    instrumentType: "subsidiary_instrument",
    year: 2007,
    status: "repealed",
    structure: [],
    amendmentTracker: {
      amended: false,
      amendmentRefs: [],
      repealed: true,
      repealRef:
        "Rules of Professional Conduct for Legal Practitioners, 2023 (revocation effective 31 December 2023)",
    },
    summary:
      "The superseded professional-conduct rules. Superseded by the 2023 Rules (made 6 June 2023; the revocation took effect 31 December 2023). Retained as an authority for historical analysis and for matters arising during its currency.",
    sourceUrl:
      "https://edojudiciary.gov.ng/wp-content/uploads/2016/10/Rules-Of-Proffessional-Conduct-For-Legal-Practitioners-2007.pdf",
    domainCategory: "subsidiary",
  },
];
