/**
 * legalCorpus — curated seed content for the Legal Knowledge Engine.
 *
 * CORPUS PHILOSOPHY (Task 51):
 *  - Accuracy over bravado. Every entry is either (a) anchored to a rule /
 *    section reference the corpus author is confident about, or (b) a
 *    practice guide at process level. Nothing is presented as verbatim text
 *    unless it is.
 *  - Honest verification: every provision/form carries verificationStatus
 *    "needs_founder_review" until a Founder confirms it against the source.
 *    ALOA surfaces this status in answers ("verify current form number").
 *  - National scaffold, deep core: all 37 judiciaries have institutions +
 *    instruments (the rules citation the app already drafts with); Lagos HC,
 *    FHC, the Constitution, CAMA, Evidence Act, Tenancy Law and enforcement
 *    practice get provision-level depth first. Coverage tiers make the gap
 *    answerable instead of hidden.
 *
 * This file is PURE DATA — no Convex imports — so it can also be unit-tested.
 */

// ─────────────────────────────────────────────────────────────────────────────
// INSTITUTIONS
// ─────────────────────────────────────────────────────────────────────────────

export interface CorpusInstitution {
  key: string;
  name: string;
  type: "court" | "tribunal" | "registry" | "regulator";
  level: "federal" | "state" | "fct";
  jurisdictionKey?: string;
  divisions: string[];
  website?: string;
  notes?: string;
  coverageTier: "deep" | "instruments" | "listed";
}

export const FEDERAL_INSTITUTIONS: CorpusInstitution[] = [
  {
    key: "supreme_court",
    name: "Supreme Court of Nigeria",
    type: "court",
    level: "federal",
    divisions: ["Abuja"],
    website: "https://supremecourt.gov.ng",
    notes: "Final appellate court; original jurisdiction in disputes between Federation and states, and presidential election petitions.",
    coverageTier: "instruments",
  },
  {
    key: "court_of_appeal",
    name: "Court of Appeal of Nigeria",
    type: "court",
    level: "federal",
    divisions: ["Abuja", "Lagos", "Enugu", "Ibadan", "Kaduna", "Port Harcourt", "Benin", "Calabar", "Ilorin", "Jos", "Owerri", "Akure", "Abeokuta", "Asaba", "Awka", "Bauchi", "Gombe", "Kano", "Maiduguri", "Sokoto", "Yola", "Nasarawa", "Osogbo", "Oshogbo Judicial Division (see official list)"],
    notes: "Intermediate appellate court for federal and state appeals; National/Presidential election petitions.",
    coverageTier: "instruments",
  },
  {
    key: "fhc",
    name: "Federal High Court of Nigeria",
    type: "court",
    level: "federal",
    divisions: ["Abuja", "Lagos", "Port Harcourt", "Kano", "Enugu", "Ibadan", "Kaduna", "Benin", "Calabar", "Ilorin", "Jos", "Maiduguri", "Sokoto", "Yola", "Awka", "Bauchi", "Uyo", "Yenagoa", "Lafia", "Minna", "Abeokuta", "Ado-Ekiti", "Asaba", "Damaturu", "Dutse", "Gusau", "Jalingo", "Lokoja", "Osogbo", "Owerri", "Umuahia", "Warri", "Yenagoa"],
    website: "https://fhcng.com",
    notes: "Exclusive federal jurisdiction per s.251 CFRN 1999: revenue, taxation of the Federation, customs & excise, admiralty, banking & foreign exchange, citizenship, prerogative writs against federal agencies, IP, aviation, narcotics, mines & minerals.",
    coverageTier: "deep",
  },
  {
    key: "nicn",
    name: "National Industrial Court of Nigeria",
    type: "court",
    level: "federal",
    divisions: ["Abuja", "Lagos", "Enugu", "Kano", "Ibadan", "Port Harcourt", "Calabar", "Jos", "Maiduguri", "Yenagoa", "Akure", "Asaba", "Bauchi", "Gombe", "Ilorin", "Jalingo", "Lokoja", "Minna", "Oshogbo", "Owerri", "Sokoto", "Umuahia", "Uyo", "Warri", "Yola"],
    notes: "Exclusive jurisdiction over labour, employment, industrial relations and workplace disputes (s.254C CFRN).",
    coverageTier: "instruments",
  },
  {
    key: "cac",
    name: "Corporate Affairs Commission",
    type: "registry",
    level: "federal",
    divisions: ["Abuja HQ", "Lagos", "Kano", "Enugu", "Port Harcourt", "Ibadan", "Kaduna", "Benin"],
    website: "https://cac.gov.ng",
    notes: "Corporate registry under CAMA 2020 — incorporation, post-incorporation filings, annual returns, business names, incorporated trustees.",
    coverageTier: "deep",
  },
];

// 37 state/FCT judiciaries, mirroring src/utils/jurisdictionConfig.ts.
// [key, name, capital, rulesCitation, rulesYear?]
export interface StateJudiciary {
  key: string;
  name: string;
  capital: string;
  rules: string;
  year?: number;
}

export const STATE_JUDICIARIES: StateJudiciary[] = [
  { key: "Lagos", name: "Lagos State", capital: "Ikeja", rules: "High Court of Lagos State (Civil Procedure) Rules 2019", year: 2019 },
  { key: "Delta", name: "Delta State", capital: "Asaba", rules: "Delta State High Court (Civil Procedure) Rules 2021", year: 2021 },
  { key: "FCT", name: "Federal Capital Territory, Abuja", capital: "Abuja", rules: "High Court of the Federal Capital Territory (Civil Procedure) Rules 2018", year: 2018 },
  { key: "Rivers", name: "Rivers State", capital: "Port Harcourt", rules: "High Court of Rivers State (Civil Procedure) Rules 2023", year: 2023 },
  { key: "Abia", name: "Abia State", capital: "Umuahia", rules: "High Court of Abia State (Civil Procedure) Rules" },
  { key: "Anambra", name: "Anambra State", capital: "Awka", rules: "High Court of Anambra State (Civil Procedure) Rules 2019", year: 2019 },
  { key: "Enugu", name: "Enugu State", capital: "Enugu", rules: "High Court of Enugu State (Civil Procedure) Rules 2020", year: 2020 },
  { key: "Imo", name: "Imo State", capital: "Owerri", rules: "High Court of Imo State (Civil Procedure) Rules" },
  { key: "Oyo", name: "Oyo State", capital: "Ibadan", rules: "High Court of Oyo State (Civil Procedure) Rules 2018", year: 2018 },
  { key: "Kano", name: "Kano State", capital: "Kano", rules: "High Court of Kano State (Civil Procedure) Rules 2019", year: 2019 },
  { key: "Kaduna", name: "Kaduna State", capital: "Kaduna", rules: "High Court of Kaduna State (Civil Procedure) Rules 2007", year: 2007 },
  { key: "Edo", name: "Edo State", capital: "Benin City", rules: "High Court of Edo State (Civil Procedure) Rules 2012", year: 2012 },
  { key: "Ogun", name: "Ogun State", capital: "Abeokuta", rules: "High Court of Ogun State (Civil Procedure) Rules" },
  { key: "Cross River", name: "Cross River State", capital: "Calabar", rules: "High Court of Cross River State (Civil Procedure) Rules" },
  { key: "Akwa Ibom", name: "Akwa Ibom State", capital: "Uyo", rules: "High Court of Akwa Ibom State (Civil Procedure) Rules" },
  { key: "Adamawa", name: "Adamawa State", capital: "Yola", rules: "High Court of Adamawa State (Civil Procedure) Rules" },
  { key: "Bauchi", name: "Bauchi State", capital: "Bauchi", rules: "High Court of Bauchi State (Civil Procedure) Rules" },
  { key: "Bayelsa", name: "Bayelsa State", capital: "Yenagoa", rules: "High Court of Bayelsa State (Civil Procedure) Rules" },
  { key: "Benue", name: "Benue State", capital: "Makurdi", rules: "High Court of Benue State (Civil Procedure) Rules" },
  { key: "Borno", name: "Borno State", capital: "Maiduguri", rules: "High Court of Borno State (Civil Procedure) Rules" },
  { key: "Ebonyi", name: "Ebonyi State", capital: "Abakaliki", rules: "High Court of Ebonyi State (Civil Procedure) Rules" },
  { key: "Ekiti", name: "Ekiti State", capital: "Ado-Ekiti", rules: "High Court of Ekiti State (Civil Procedure) Rules" },
  { key: "Gombe", name: "Gombe State", capital: "Gombe", rules: "High Court of Gombe State (Civil Procedure) Rules" },
  { key: "Jigawa", name: "Jigawa State", capital: "Dutse", rules: "High Court of Jigawa State (Civil Procedure) Rules" },
  { key: "Katsina", name: "Katsina State", capital: "Katsina", rules: "High Court of Katsina State (Civil Procedure) Rules" },
  { key: "Kebbi", name: "Kebbi State", capital: "Birnin Kebbi", rules: "High Court of Kebbi State (Civil Procedure) Rules" },
  { key: "Kogi", name: "Kogi State", capital: "Lokoja", rules: "High Court of Kogi State (Civil Procedure) Rules" },
  { key: "Kwara", name: "Kwara State", capital: "Ilorin", rules: "High Court of Kwara State (Civil Procedure) Rules" },
  { key: "Nasarawa", name: "Nasarawa State", capital: "Lafia", rules: "High Court of Nasarawa State (Civil Procedure) Rules" },
  { key: "Niger", name: "Niger State", capital: "Minna", rules: "High Court of Niger State (Civil Procedure) Rules" },
  { key: "Ondo", name: "Ondo State", capital: "Akure", rules: "High Court of Ondo State (Civil Procedure) Rules" },
  { key: "Osun", name: "Osun State", capital: "Osogbo", rules: "High Court of Osun State (Civil Procedure) Rules" },
  { key: "Plateau", name: "Plateau State", capital: "Jos", rules: "High Court of Plateau State (Civil Procedure) Rules" },
  { key: "Sokoto", name: "Sokoto State", capital: "Sokoto", rules: "High Court of Sokoto State (Civil Procedure) Rules" },
  { key: "Taraba", name: "Taraba State", capital: "Jalingo", rules: "High Court of Taraba State (Civil Procedure) Rules" },
  { key: "Yobe", name: "Yobe State", capital: "Damaturu", rules: "High Court of Yobe State (Civil Procedure) Rules" },
  { key: "Zamfara", name: "Zamfara State", capital: "Gusau", rules: "High Court of Zamfara State (Civil Procedure) Rules" },
];

// ─────────────────────────────────────────────────────────────────────────────
// INSTRUMENTS (federal — state instruments are derived from STATE_JUDICIARIES)
// ─────────────────────────────────────────────────────────────────────────────

export interface CorpusInstrument {
  key: string;
  institutionKey: string;
  title: string;
  kind: "rules" | "practice_direction" | "forms_schedule" | "statute" | "guide";
  year?: number;
  versionLabel?: string;
  status: "in_force" | "repealed" | "superseded" | "monitor";
  effectiveDate?: string;
  sourceUrl?: string;
  summary?: string;
  jurisdictionKey?: string;
}

export const FEDERAL_INSTRUMENTS: CorpusInstrument[] = [
  {
    key: "cfrn_1999",
    institutionKey: "supreme_court",
    title: "Constitution of the Federal Republic of Nigeria 1999 (as altered)",
    kind: "statute",
    year: 1999,
    versionLabel: "As altered to date",
    status: "in_force",
    summary: "Supreme law; judicial powers (s.6), fair hearing (s.36), appellate structure (ss.233, 240-242), Federal High Court exclusive jurisdiction (s.251), State High Court unlimited jurisdiction (s.272).",
    sourceUrl: "https://www.nigeria-law.org/ConstitutionOfTheFederalRepublicOfNigeria.htm",
  },
  {
    key: "scn_rules",
    institutionKey: "supreme_court",
    title: "Rules of the Supreme Court (as amended)",
    kind: "rules",
    status: "in_force",
    summary: "Appellate practice before the Supreme Court — leave requirements, briefs of argument, time limits for filing appeals. Confirm the current consolidated edition and any recent practice directions before filing.",
  },
  {
    key: "ca_rules",
    institutionKey: "court_of_appeal",
    title: "Court of Appeal Rules (as amended)",
    kind: "rules",
    status: "in_force",
    summary: "Appellate practice before the Court of Appeal — entry of appeal, records of appeal, briefs, time limits. Confirm the current edition (amendments issued in recent years) before filing.",
  },
  {
    key: "fhc_cpr_2019",
    institutionKey: "fhc",
    title: "Federal High Court (Civil Procedure) Rules 2019",
    kind: "rules",
    year: 2019,
    versionLabel: "2019 Edition",
    status: "in_force",
    summary: "Civil procedure in all Federal High Court divisions — originating processes, service, pleadings, undefended list, interlocutory applications, trial and enforcement, with the First Schedule of forms.",
  },
  {
    key: "nicn_cpr_2017",
    institutionKey: "nicn",
    title: "National Industrial Court (Civil Procedure) Rules 2017",
    kind: "rules",
    year: 2017,
    status: "in_force",
    summary: "Procedure for labour and employment claims before the NICN — originating processes, pre-trial conferences, and the Court's practice directions on labour disputes.",
  },
  {
    key: "cama_2020",
    institutionKey: "cac",
    title: "Companies and Allied Matters Act 2020",
    kind: "statute",
    year: 2020,
    status: "in_force",
    summary: "Principal companies legislation — incorporation (single-member private companies), share capital, meetings, annual returns, business names, incorporated trustees.",
    sourceUrl: "https://www.cac.gov.ng",
  },
  {
    key: "companies_regulations_2021",
    institutionKey: "cac",
    title: "Companies Regulations 2021 (CAC forms)",
    kind: "forms_schedule",
    year: 2021,
    status: "in_force",
    summary: "Regulations under CAMA 2020 prescribing CAC forms and fees — incorporation, post-incorporation and annual return filings. Form codes were renumbered under this regime; verify current codes on the CAC portal.",
    sourceUrl: "https://www.cac.gov.ng",
  },
  {
    key: "evidence_act_2011",
    institutionKey: "supreme_court",
    title: "Evidence Act 2011",
    kind: "statute",
    year: 2011,
    status: "in_force",
    summary: "Uniform evidence law for all Nigerian courts — admissibility, proof of documents, electronic evidence (s.84), burden of proof, judicial notice and presumptions.",
    sourceUrl: "https://www.nigeria-law.org/EvidenceAct.htm",
  },
  {
    key: "sheriffs_act",
    institutionKey: "fhc",
    title: "Sheriffs and Civil Process Act (as amended)",
    kind: "statute",
    status: "in_force",
    summary: "Framework for enforcement of judgments — writs of execution (fieri facias, elegit, possession), garnishee proceedings, judgment-debtor summonses, and leave requirements for enforcing judgments outside the issuing jurisdiction.",
    sourceUrl: "https://www.nigeria-law.org",
  },
];

// Lagos-specific instruments (deep jurisdiction)
export const LAGOS_INSTRUMENTS: CorpusInstrument[] = [
  {
    key: "lagos_hc_cpr_2019",
    institutionKey: "lagos_judiciary",
    title: "High Court of Lagos State (Civil Procedure) Rules 2019",
    kind: "rules",
    year: 2019,
    versionLabel: "2019 Edition",
    status: "in_force",
    summary: "Civil procedure in Lagos — front-loaded originating processes, case management and pre-trial conferences, undefended list, interlocutory practice and enforcement, with the First Schedule of forms.",
    jurisdictionKey: "Lagos",
  },
  {
    key: "lagos_tenancy_law_2011",
    institutionKey: "lagos_judiciary",
    title: "Tenancy Law of Lagos State 2011",
    kind: "statute",
    year: 2011,
    status: "in_force",
    summary: "Lagos tenancy regime — notice-to-quit periods by tenancy period, recovery of premises through the court, prohibition of self-help ejection, and rent payment rules.",
    jurisdictionKey: "Lagos",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// PROVISIONS / PRACTICE ANCHORS (deep content)
// ─────────────────────────────────────────────────────────────────────────────

export interface CorpusProvision {
  instrumentKey: string;
  ref: string;
  heading: string;
  textType: "verbatim" | "summary" | "practice_note";
  text: string;
  tags: string[];
  jurisdictionKey?: string;
  verificationStatus?: "founder_reviewed" | "needs_founder_review";
}

export const PROVISIONS: CorpusProvision[] = [
  // ── Lagos HC (CP) Rules 2019 ──────────────────────────────────────────────
  {
    instrumentKey: "lagos_hc_cpr_2019",
    ref: "Order 1",
    heading: "Commencement of civil proceedings",
    textType: "summary",
    text: "Civil proceedings in the Lagos State High Court are commenced by writ of summons, originating summons, petition or notice of motion as prescribed by the Rules. A claimant uses an originating summons where the dispute is mainly a question of law, or the facts are largely undisputed; a writ is the general route where facts are contested. Interpleader and other special proceedings follow their prescribed forms.",
    tags: ["commencement", "originating process", "writ", "originating summons"],
    jurisdictionKey: "Lagos",
  },
  {
    instrumentKey: "lagos_hc_cpr_2019",
    ref: "Order 2",
    heading: "Form and indorsement of writ",
    textType: "summary",
    text: "A writ of summons is issued in Form 1 (or Form 13 for certain commercial claims under practice directions) with a concise general indorsement of the claim. Where the claim is for a debt or liquidated demand, the writ may be specially indorseed so the matter can proceed on the undefended list. Concurrent writs may be issued for service in different jurisdictions.",
    tags: ["writ of summons", "indorsement", "undefended list", "Form 1"],
    jurisdictionKey: "Lagos",
  },
  {
    instrumentKey: "lagos_hc_cpr_2019",
    ref: "Order 3",
    heading: "Issue, sealing and validity of originating processes",
    textType: "summary",
    text: "Originating processes are prepared, signed and filed at the registry, then issued under seal. An originating process is valid for service for six months from the date of first issue (including where directed to be served out of jurisdiction, subject to the Rules). A process about to expire may be renewed by order of a Judge before expiry, effectively for a further period.",
    tags: ["validity", "renewal", "sealing", "six months", "issue"],
    jurisdictionKey: "Lagos",
  },
  {
    instrumentKey: "lagos_hc_cpr_2019",
    ref: "Order 5",
    heading: "Service of court process",
    textType: "summary",
    text: "An originating process must be served personally on the defendant. Where personal service cannot be effected after diligent attempts, the court may order substituted service (for example by leaving the process at the defendant's last known address, advertisement, or electronic means) as the court directs. Service is proved by an affidavit of service.",
    tags: ["service", "personal service", "substituted service", "affidavit of service"],
    jurisdictionKey: "Lagos",
  },
  {
    instrumentKey: "lagos_hc_cpr_2019",
    ref: "Practice Guide — Front-Loading",
    heading: "Front-loaded originating processes in Lagos",
    textType: "practice_note",
    text: "Lagos practice (from the 2012 Rules, retained in 2019) is 'front-loaded': the claimant files, together with the writ, the statement of claim, the witness statements on oath, exhibits to be used at trial, and the list of witnesses. The defendant similarly front-loads its defence, witness statements and exhibits. The object is to have the entire evidence on file before case management begins, so trials run on the filed statements rather than oral narrative evidence.",
    tags: ["front-loading", "witness statements", "evidence", "case management"],
    jurisdictionKey: "Lagos",
  },
  {
    instrumentKey: "lagos_hc_cpr_2019",
    ref: "Practice Guide — Pre-Trial Conference",
    heading: "Pre-trial conferences and case management",
    textType: "practice_note",
    text: "After the close of pleadings the matter is set down for a pre-trial conference (PTC) before the judge, covering joinder of parties, amendment, settlement of issues, exchange of evidence and settlement negotiation. Sanctions for non-cooperation include cost penalties or dismissal/entry of judgment. Matters that are not resolved at PTC are given a trial date with a strict case-management timetable.",
    tags: ["PTC", "case management", "settlement", "pleadings"],
    jurisdictionKey: "Lagos",
  },
  {
    instrumentKey: "lagos_hc_cpr_2019",
    ref: "Practice Guide — Undefended List",
    heading: "Undefended list / summary judgment for liquidated demands",
    textType: "practice_note",
    text: "A specially indorsed writ for a debt or liquidated money demand may be placed on the undefended list. The defendant must, within the time allowed (in Lagos, eight days from service in ordinary cases), enter an appearance and file a notice of intention to defend with an affidavit disclosing a defence on the merits. If no notice is filed, or the affidavit discloses no real defence, judgment is entered without trial; if a triable issue is disclosed, the matter is transferred to the general cause list.",
    tags: ["undefended list", "summary judgment", "debt recovery", "liquidated demand"],
    jurisdictionKey: "Lagos",
  },
  {
    instrumentKey: "lagos_hc_cpr_2019",
    ref: "Practice Guide — Interlocutory Applications",
    heading: "Motions, ex parte orders and interim reliefs",
    textType: "practice_note",
    text: "Interlocutory applications are made by motion on notice supported by affidavit evidence, setting out the reliefs and the grounds. Ex parte applications are permitted in urgent cases for interim orders (such as interim injunctions, mareva/freezing orders or asset preservation), but the applicant must move the court for the substantive motion on notice within a short period, and full and frank disclosure is required — non-disclosure can vitiate the order.",
    tags: ["motion on notice", "ex parte", "injunction", "interim relief", "mareva"],
    jurisdictionKey: "Lagos",
  },
  {
    instrumentKey: "lagos_hc_cpr_2019",
    ref: "Practice Guide — Judgment Enforcement",
    heading: "Enforcing Lagos High Court judgments",
    textType: "practice_note",
    text: "Judgment creditors may enforce through: (1) writs of execution — fieri facias against goods, elegit against land, writ of possession; (2) garnishee proceedings, attaching debts owed to the judgment debtor (notably bank balances); (3) judgment-debtor summonses compelling examination of means, with committal for default; and (4) charging orders on land. Enforcement of judgments across state lines engages the Sheriffs and Civil Process Act framework and its consent/leave requirements.",
    tags: ["enforcement", "fieri facias", "garnishee", "judgment debtor", "charging order"],
    jurisdictionKey: "Lagos",
  },
  {
    instrumentKey: "lagos_hc_cpr_2019",
    ref: "Practice Guide — Pre-Action Protocol",
    heading: "Pre-action correspondence in Lagos",
    textType: "practice_note",
    text: "Lagos practice directions encourage pre-action correspondence: the claimant's letter notifying the intended defendant of the claim, inviting settlement or response before filing. In specified categories the protocol letter is effectively a condition precedent. PracticePro's Lagos letter templates implement this notification step. Confirm the current practice direction and any category-specific protocol requirements before filing.",
    tags: ["pre-action protocol", "letter before action", "practice direction"],
    jurisdictionKey: "Lagos",
  },

  // ── FHC (CP) Rules 2019 ───────────────────────────────────────────────────
  {
    instrumentKey: "fhc_cpr_2019",
    ref: "Order 1",
    heading: "Commencement of proceedings in the Federal High Court",
    textType: "summary",
    text: "Proceedings are commenced by writ of summons, originating summons, originating motion or petition, in accordance with the Rules and the subject matter. The court's jurisdiction is statutory (s.251 CFRN), so the writ or motion must show a Federal High Court cause of action on its face.",
    tags: ["commencement", "jurisdiction", "writ", "originating summons"],
  },
  {
    instrumentKey: "fhc_cpr_2019",
    ref: "Order 3",
    heading: "Validity and renewal of originating processes",
    textType: "summary",
    text: "An originating process is valid for six months from the date of issue. Processes directed to be served outside jurisdiction carry their own validity period. Renewal before expiry preserves the action where service has not been effected.",
    tags: ["validity", "renewal", "six months"],
  },
  {
    instrumentKey: "fhc_cpr_2019",
    ref: "Order 5",
    heading: "Service of process",
    textType: "summary",
    text: "Personal service is the general rule for originating processes; substituted service may be ordered where personal service is impracticable. Affidavits of service must be filed, and service outside Nigeria follows the Rules' international service provisions with the court's leave.",
    tags: ["service", "substituted service", "service out of jurisdiction"],
  },
  {
    instrumentKey: "fhc_cpr_2019",
    ref: "Practice Guide — Undefended List",
    heading: "Undefended list procedure at the FHC",
    textType: "practice_note",
    text: "For liquidated money claims the claimant may apply for the writ to be placed on the undefended list. The defendant must enter appearance and file a notice of intention to defend supported by affidavit within the prescribed period; a notice that discloses no defence on the merits leads to judgment without trial, while a triable issue moves the case to the general list.",
    tags: ["undefended list", "summary judgment", "debt recovery"],
  },
  {
    instrumentKey: "fhc_cpr_2019",
    ref: "Practice Guide — Jurisdiction Check",
    heading: "Federal High Court jurisdiction — the s.251 checklist",
    textType: "practice_note",
    text: "Before filing at the FHC, screen the claim against s.251 CFRN: federal revenue and taxation, customs and excise, banking, foreign exchange and other financial institutions, admiralty, citizenship and naturalisation, prerogative writs against federal agencies, aviation, arms and ammunition, narcotics, mines and minerals (including oil and gas regulatory matters), and intellectual property among the enumerated heads. Anything outside s.251 belongs to the State High Court or NICN as appropriate. Jurisdiction can be raised at any stage, even on appeal.",
    tags: ["jurisdiction", "section 251", "federal", "oil and gas", "tax", "banking"],
  },

  // ── Constitution of the Federal Republic of Nigeria 1999 ──────────────────
  {
    instrumentKey: "cfrn_1999",
    ref: "s. 6",
    heading: "Judicial powers of the courts",
    textType: "summary",
    text: "Section 6 vests the judicial powers of the Federation and the States in the courts established by the Constitution, extending to all inherent powers and sanctions of a court of law. Judicial power is exercised over justiciable controversies between persons, or between government and any person.",
    tags: ["judicial power", "constitution", "justiciability"],
  },
  {
    instrumentKey: "cfrn_1999",
    ref: "s. 36",
    heading: "Right to fair hearing",
    textType: "summary",
    text: "Section 36 guarantees that a person shall be entitled to a fair hearing within a reasonable time by a court or tribunal established by law. Determinations must be reached in accordance with the principle of natural justice — hear the other side (audi alteram partem) and no one may be judge in their own cause. Breaches render proceedings a nullity.",
    tags: ["fair hearing", "natural justice", "audi alteram partem"],
  },
  {
    instrumentKey: "cfrn_1999",
    ref: "ss. 233",
    heading: "Supreme Court appellate jurisdiction",
    textType: "summary",
    text: "Section 233 confers on the Supreme Court jurisdiction to hear appeals from the Court of Appeal. Appeals lie as of right in specified classes (including constitutional interpretation questions and certain criminal matters), and with leave in others. The Supreme Court is the final court of appeal in Nigeria.",
    tags: ["supreme court", "appeal", "appellate jurisdiction"],
  },
  {
    instrumentKey: "cfrn_1999",
    ref: "ss. 240–242",
    heading: "Court of Appeal jurisdiction and appeals",
    textType: "summary",
    text: "Section 240 establishes the Court of Appeal with jurisdiction to hear appeals from the Federal High Court, State High Courts, NICN and other lower courts and tribunals as prescribed. Sections 241 and 242 classify appeals to the Court of Appeal as of right and appeals requiring leave, respectively — the classification drives whether leave must be sought before filing the notice of appeal.",
    tags: ["court of appeal", "appeal as of right", "leave to appeal"],
  },
  {
    instrumentKey: "cfrn_1999",
    ref: "s. 251",
    heading: "Federal High Court exclusive jurisdiction",
    textType: "summary",
    text: "Section 251 confers exclusive federal jurisdiction on the Federal High Court over civil causes and matters relating to, among others: revenue of the Federation; taxation of the Federation; customs and excise; admiralty; banking, foreign exchange and other financial institutions; citizenship and naturalisation; prerogative writs against federal agencies; aviation; intellectual property; and mines and minerals. The schedule of subjects is exhaustive, and jurisdictional errors are fatal at any stage.",
    tags: ["federal high court", "exclusive jurisdiction", "section 251"],
  },
  {
    instrumentKey: "cfrn_1999",
    ref: "s. 272",
    heading: "State High Court unlimited jurisdiction",
    textType: "summary",
    text: "Section 272 confers on the High Court of a State unlimited jurisdiction to hear and determine any civil proceedings in which the existence of a legal right or duty is in issue, subject to the exclusive federal matters carved out for the Federal High Court and NICN. State High Courts remain the general civil courts of Nigeria.",
    tags: ["high court", "unlimited jurisdiction", "state court"],
  },

  // ── CAMA 2020 / CAC practice ──────────────────────────────────────────────
  {
    instrumentKey: "cama_2020",
    ref: "Practice Guide — Incorporation",
    heading: "Incorporating a company at the CAC",
    textType: "practice_note",
    text: "Incorporation at the Corporate Affairs Commission proceeds in three stages: (1) name availability check and reservation (two proposed names; reservation is time-limited but extendable); (2) preparation and submission of the incorporation documents — the prescribed application form, memorandum and articles of association, particulars of the first directors, notice of situation of registered address, and declaration of compliance by a legal practitioner; and (3) issuance of the certificate of incorporation, after which the company can obtain its TIN. Fees scale with authorised share capital, and stamp duties apply to the memorandum/articles. Under CAMA 2020, a private company may have a single shareholder and single director.",
    tags: ["incorporation", "CAC", "company", "name reservation", "memorandum", "articles"],
    verificationStatus: "needs_founder_review",
  },
  {
    instrumentKey: "cama_2020",
    ref: "s. 18",
    heading: "Formation and membership of companies",
    textType: "summary",
    text: "Section 18 provides the formation rules: two or more persons may form a company, except that a private company may be formed by one person (a single-member company). A company formed for a lawful purpose becomes a body corporate on registration. This single-member innovation of CAMA 2020 removed the pre-2020 two-subscriber requirement for private companies.",
    tags: ["single member", "formation", "cama 2020"],
  },
  {
    instrumentKey: "cama_2020",
    ref: "Practice Guide — Annual Returns",
    heading: "Annual return obligations",
    textType: "practice_note",
    text: "Every company must file annual returns with the CAC — for companies with shares, a return in the prescribed form containing the address of the registered office, particulars of directors, summary of share capital and statement of affairs/financial summary, together with the prescribed fee. Small companies enjoy simplified disclosure (reduced accounts) under CAMA 2020, and newly incorporated companies have an initial grace period before the first annual return falls due. Late filing attracts penalties that accrue per year of default. Verify the current form codes and fees on the CAC portal — the 2021 Regulations renumbered them.",
    tags: ["annual returns", "CAC", "compliance", "small company"],
    verificationStatus: "needs_founder_review",
  },

  // ── Evidence Act 2011 ─────────────────────────────────────────────────────
  {
    instrumentKey: "evidence_act_2011",
    ref: "s. 84",
    heading: "Admissibility of electronic evidence",
    textType: "summary",
    text: "Section 84 of the Evidence Act 2011 makes statements in documents produced by computers admissible, subject to conditions on the computer's regular use and reliability, and to production of a certificate identifying the electronic record and describing its production. The certificate requirement must be satisfied for electronic evidence (emails, bank records, device logs, CCTV) to be admitted without objection succeeding.",
    tags: ["electronic evidence", "certificate", "computer generated", "section 84"],
  },
  {
    instrumentKey: "evidence_act_2011",
    ref: "Practice Guide — Proof of Documents",
    heading: "Primary and secondary evidence of documents",
    textType: "practice_note",
    text: "Documents are proved by primary evidence (the original itself) or secondary evidence (copies, counterparts, oral accounts) in the circumstances the Act permits — where the original is lost, in the possession of the opponent, or is a public document. Public documents are proved by certified true copies issued by the custodian; private documents require more. The distinction between public and private documents drives what must be pleaded and how it is tendered.",
    tags: ["proof of documents", "primary evidence", "secondary evidence", "certified true copy"],
  },

  // ── Tenancy Law of Lagos State 2011 (Atrium-relevant) ─────────────────────
  {
    instrumentKey: "lagos_tenancy_law_2011",
    ref: "Practice Guide — Notice to Quit",
    heading: "Notice-to-quit periods in Lagos",
    textType: "practice_note",
    text: "Under the Tenancy Law of Lagos State, the length of a valid notice to quit follows the tenancy period: roughly one week for a weekly tenancy, one month for a monthly tenancy, three months for a quarterly tenancy and six months for a yearly tenancy. Where the tenancy has no stipulated period, the law fixes a short notice appropriate to the payment interval. A notice that understates the required period is invalid and defeats a recovery action, so the tenancy period must be established first. Atrium's tenancy records feed this analysis directly.",
    tags: ["tenancy", "notice to quit", "recovery of premises", "landlord", "tenant"],
    jurisdictionKey: "Lagos",
    verificationStatus: "needs_founder_review",
  },
  {
    instrumentKey: "lagos_tenancy_law_2011",
    ref: "Practice Guide — Recovery of Premises",
    heading: "Court-ordered recovery of premises; self-help prohibited",
    textType: "practice_note",
    text: "A Lagos landlord recovers possession only by court order: after a valid notice to quit expires, the landlord issues recovery proceedings, and possession follows only from the court's judgment and warrant. Self-help — changing locks, ejecting the tenant, or forceful removal without an order — is unlawful and exposes the landlord to damages, however strong the grievance. After judgment, enforcement is by writ of possession through the court.",
    tags: ["recovery of premises", "self-help", "writ of possession", "eviction"],
    jurisdictionKey: "Lagos",
  },

  // ── Sheriffs and Civil Process Act ────────────────────────────────────────
  {
    instrumentKey: "sheriffs_act",
    ref: "Practice Guide — Garnishee",
    heading: "Garnishee proceedings after judgment",
    textType: "practice_note",
    text: "Garnishee proceedings attach a debt owed to the judgment debtor by a third party — most commonly the judgment debtor's bank balance. The judgment creditor applies for a garnishee order nisi; once served, the garnishee (bank) must not pay out the attached funds, and if it does not show cause, the order is made absolute and the attached sum is paid to the judgment creditor in satisfaction of the judgment. Garnishee is often the fastest route to actual recovery of a Nigerian money judgment.",
    tags: ["garnishee", "enforcement", "bank", "judgment", "order nisi"],
  },
  {
    instrumentKey: "sheriffs_act",
    ref: "Practice Guide — Cross-Jurisdiction Enforcement",
    heading: "Enforcing a judgment in another state",
    textType: "practice_note",
    text: "A judgment of a Nigerian court is enforceable nationwide, but a writ of execution issued in one state to be executed in another requires compliance with the Sheriffs and Civil Process Act — including the requirement of leave (and, in specified federal cases, the consent of the Attorney-General of the Federation) before issuing a writ of execution to be executed outside the state of issue. Garnishee and judgment-debtor proceedings in the executing jurisdiction are often the practical alternative.",
    tags: ["enforcement", "cross-jurisdiction", "leave", "sheriffs act"],
  },

  // ── NICN practice ─────────────────────────────────────────────────────────
  {
    instrumentKey: "nicn_cpr_2017",
    ref: "Practice Guide — Employment Claims",
    heading: "Commencing an employment claim at the NICN",
    textType: "practice_note",
    text: "The National Industrial Court has exclusive jurisdiction over labour, employment and industrial-relations disputes, including wrongful termination claims between employer and employee. Claims are commenced by claim/complaint with supporting documents; the Court runs pre-trial conferences and encourages settlement through its Alternative Dispute Resolution centres. Individual contract-of-employment claims and statutory labour-law claims are both within its competence — assess limitation carefully, as employment contract claims are subject to limitation rules while statutory claims have their own regimes.",
    tags: ["employment", "NICN", "wrongful termination", "labour"],
    verificationStatus: "needs_founder_review",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// COURT & REGISTRY FORMS
// ─────────────────────────────────────────────────────────────────────────────

export interface CorpusForm {
  institutionKey: string;
  instrumentKey?: string;
  formNumber: string;
  title: string;
  purpose?: string;
  fee?: string;
  statutoryRef?: string;
  fields: string[];
  tags: string[];
  jurisdictionKey?: string;
  verificationStatus?: "founder_reviewed" | "needs_founder_review";
}

export const FORMS: CorpusForm[] = [
  // Lagos High Court (First Schedule forms)
  {
    institutionKey: "lagos_judiciary",
    instrumentKey: "lagos_hc_cpr_2019",
    formNumber: "Form 1",
    title: "Writ of Summons",
    purpose: "General origin of a civil claim by writ in the Lagos State High Court; commands the defendant to appear or risk judgment.",
    fields: ["Court caption", "Suit number", "Parties", "General indorsement of claim", "Attorney's details"],
    tags: ["writ", "commencement", "lagos"],
    jurisdictionKey: "Lagos",
    verificationStatus: "needs_founder_review",
  },
  {
    institutionKey: "lagos_judiciary",
    instrumentKey: "lagos_hc_cpr_2019",
    formNumber: "",
    title: "Originating Summons",
    purpose: "Originates claims that turn mainly on questions of law or undisputed facts (e.g., interpretation of documents, chieftaincy or trust questions).",
    fields: ["Court caption", "Questions for determination", "Supporting affidavit", "Exhibits"],
    tags: ["originating summons", "commencement", "lagos"],
    jurisdictionKey: "Lagos",
    verificationStatus: "needs_founder_review",
  },
  {
    institutionKey: "lagos_judiciary",
    formNumber: "",
    title: "Witness Statement on Oath",
    purpose: "Front-loaded testimony of a witness, adopted at trial in place of oral narrative; attaches exhibits referenced.",
    fields: ["Deponent identity", "Facts within knowledge", "Exhibits referenced", "Statement of truth/oath"],
    tags: ["evidence", "witness statement", "front-loading", "lagos"],
    jurisdictionKey: "Lagos",
    verificationStatus: "needs_founder_review",
  },
  {
    institutionKey: "lagos_judiciary",
    formNumber: "",
    title: "Motion on Notice",
    purpose: "Interlocutory application to the court supported by affidavit, seeking orders before or during trial.",
    fields: ["Reliefs sought", "Grounds", "Supporting affidavit", "Written address"],
    tags: ["motion", "interlocutory", "lagos"],
    jurisdictionKey: "Lagos",
    verificationStatus: "needs_founder_review",
  },
  {
    institutionKey: "lagos_judiciary",
    formNumber: "",
    title: "Pre-Action Protocol Letter",
    purpose: "Letter before action notifying the intended defendant of the claim and inviting resolution, per Lagos practice directions.",
    fields: ["Parties", "Summary of claim", "Documents relied on", "Response window"],
    tags: ["pre-action", "letter before action", "lagos"],
    jurisdictionKey: "Lagos",
    verificationStatus: "needs_founder_review",
  },
  // Federal High Court
  {
    institutionKey: "fhc",
    instrumentKey: "fhc_cpr_2019",
    formNumber: "",
    title: "Writ of Summons",
    purpose: "Originates a civil claim at the Federal High Court within its s.251 jurisdiction.",
    fields: ["Court caption with division", "Suit number", "Parties", "Indorsement", "Counsel details"],
    tags: ["writ", "federal high court", "commencement"],
    verificationStatus: "needs_founder_review",
  },
  {
    institutionKey: "fhc",
    instrumentKey: "fhc_cpr_2019",
    formNumber: "",
    title: "Notice of Intention to Defend",
    purpose: "Undefended-list response: the defendant's notice plus affidavit disclosing a defence on the merits; judgment follows without trial if none is disclosed.",
    fields: ["Defendant details", "Affidavit facts", "Grounds of defence"],
    tags: ["undefended list", "defence", "debt"],
    verificationStatus: "needs_founder_review",
  },
  {
    institutionKey: "fhc",
    formNumber: "",
    title: "Originating Summons",
    purpose: "Commences FHC proceedings on questions of law or agreed facts (tax objections, regulatory applications, etc.).",
    fields: ["Questions for determination", "Affidavit in support", "Exhibits"],
    tags: ["originating summons", "federal high court"],
    verificationStatus: "needs_founder_review",
  },
  // CAC
  {
    institutionKey: "cac",
    instrumentKey: "companies_regulations_2021",
    formNumber: "",
    title: "Application for Availability and Reservation of Name",
    purpose: "First incorporation step: check availability of two proposed names and reserve the available one for the incorporation window.",
    fee: "Prescribed CAC fee — confirm current schedule on the CAC portal",
    fields: ["Two proposed names", "Nature of business", "Applicant details"],
    tags: ["CAC", "incorporation", "name reservation"],
    verificationStatus: "needs_founder_review",
  },
  {
    institutionKey: "cac",
    instrumentKey: "cama_2020",
    formNumber: "",
    title: "Application for Incorporation of a Company",
    purpose: "Main incorporation filing: memorandum and articles, particulars of directors, notice of registered address, declaration of compliance, share capital details and TIN processing.",
    fee: "Scales with authorised share capital — confirm current schedule",
    fields: ["Proposed company name", "Share capital", "Directors' particulars", "Registered address", "Memorandum & articles", "Declaration of compliance"],
    tags: ["CAC", "incorporation", "cama 2020"],
    verificationStatus: "needs_founder_review",
  },
  {
    institutionKey: "cac",
    instrumentKey: "cama_2020",
    formNumber: "",
    title: "Annual Returns",
    purpose: "Yearly company filing: registered office, directors' particulars, capital summary and financial statement (simplified for small companies).",
    fee: "Prescribed annual fee plus penalties for late filing — confirm current schedule",
    fields: ["Registered office address", "Directors", "Share capital summary", "Financial summary"],
    tags: ["CAC", "annual returns", "compliance"],
    verificationStatus: "needs_founder_review",
  },
  {
    institutionKey: "cac",
    formNumber: "",
    title: "Notice of Change of Directors",
    purpose: "Post-incorporation filing notifying CAC of director appointments, removals or changes in particulars.",
    fields: ["Company name/number", "Change particulars", "Effective date", "Consent of new director"],
    tags: ["CAC", "post-incorporation", "directors"],
    verificationStatus: "needs_founder_review",
  },
  {
    institutionKey: "cac",
    formNumber: "",
    title: "Registration of Business Name",
    purpose: "Registers a sole proprietorship or partnership business name under Part B of CAMA 2020.",
    fields: ["Proposed business name", "Proprietor particulars", "Nature of business"],
    tags: ["CAC", "business name", "part B"],
    verificationStatus: "needs_founder_review",
  },
  // Registries with legal ramifications (Lagos first)
  {
    institutionKey: "lagos_land_registry",
    formNumber: "",
    title: "Application for Governor's Consent",
    purpose: "Statutory consent required under the Land Use Act for any assignment, mortgage, sublease or other alienation of a right of occupancy in Lagos; filed with the Lagos State Lands Bureau.",
    fields: ["Parties", "Description of land", "Instrument of alienation", "Payment of assessment/fees"],
    tags: ["land", "governor's consent", "land use act", "lagos"],
    jurisdictionKey: "Lagos",
    verificationStatus: "needs_founder_review",
  },
  {
    institutionKey: "lagos_land_registry",
    formNumber: "",
    title: "Application for Certificate of Occupancy (C of O)",
    purpose: "Root-of-title document evidencing a right of occupancy; processed through the Lagos State Lands Bureau land regularization scheme where applicable.",
    fields: ["Applicant particulars", "Land description and survey", "Evidence of possession", "Payment schedule"],
    tags: ["land", "certificate of occupancy", "lagos"],
    jurisdictionKey: "Lagos",
    verificationStatus: "needs_founder_review",
  },
  {
    institutionKey: "lagos_probate_registry",
    formNumber: "",
    title: "Petition for Letters of Administration",
    purpose: "Grants administration of an intestate estate to administrators; filed at the Lagos Probate Registry with bonds and sureties.",
    fields: ["Deceased particulars", "Estate inventory", "Administrators", "Sureties and bond"],
    tags: ["probate", "letters of administration", "intestacy", "lagos"],
    jurisdictionKey: "Lagos",
    verificationStatus: "needs_founder_review",
  },
  {
    institutionKey: "lagos_probate_registry",
    formNumber: "",
    title: "Petition for Grant of Probate",
    purpose: "Grants probate of a will to the executors named; filed at the Lagos Probate Registry with the original will and sworn statements.",
    fields: ["Deceased particulars", "Original will", "Executors", "Estate valuation"],
    tags: ["probate", "will", "executors", "lagos"],
    jurisdictionKey: "Lagos",
    verificationStatus: "needs_founder_review",
  },
];

// Extra registry institutions referenced by forms above (Lagos-first).
export const REGISTRY_INSTITUTIONS: CorpusInstitution[] = [
  {
    key: "lagos_land_registry",
    name: "Lagos State Lands Bureau (Land Registry)",
    type: "registry",
    level: "state",
    jurisdictionKey: "Lagos",
    divisions: ["Alausa, Ikeja"],
    website: "https://lands.lagosstate.gov.ng",
    notes: "Governor's consent, certificates of occupancy, deed registration, land regularization.",
    coverageTier: "listed",
  },
  {
    key: "lagos_probate_registry",
    name: "Lagos State Probate Registry",
    type: "registry",
    level: "state",
    jurisdictionKey: "Lagos",
    divisions: ["Lagos Island"],
    notes: "Grants of probate and letters of administration, estate administration filings.",
    coverageTier: "listed",
  },
];

export const CORPUS_VERSION = "2026-09-17.1";
