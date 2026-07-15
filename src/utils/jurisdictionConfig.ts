/**
 * jurisdictionConfig — central registry of Nigerian state jurisdictions and
 * their court hierarchy / procedural rules. Used by the AI drafting engine
 * to generate jurisdictionally-correct court captions and cite the right
 * procedural rules.
 *
 * The firm's `defaultStateOfPractice` (set in FirmDetailsForm) selects which
 * entry to use. The AI can also override per-draft if the user explicitly
 * specifies a different court in their prompt.
 */

export interface JurisdictionConfig {
  /** Short key matching FirmDetails.defaultStateOfPractice */
  key: string;
  /** Display name, e.g., "Lagos State" */
  name: string;
  /** Capital/division seat, e.g., "Ikeja" or "Asaba" */
  capital: string;
  /** High Court caption format, e.g., "IN THE HIGH COURT OF LAGOS STATE" */
  highCourtCaption: string;
  /** Magistrate Court caption format */
  magistrateCourtCaption: string;
  /** Federal High Court caption (same nationwide but division varies) */
  federalHighCourtCaption: string;
  /** Procedural rules citation for the High Court */
  highCourtRules: string;
  /** Procedural rules citation for the Magistrate Court */
  magistrateRules: string;
  /** Default judicial division (usually the capital) */
  defaultDivision: string;
}

export const JURISDICTION_REGISTRY: Record<string, JurisdictionConfig> = {
  Lagos: {
    key: 'Lagos',
    name: 'Lagos State',
    capital: 'Ikeja',
    highCourtCaption: 'IN THE HIGH COURT OF LAGOS STATE',
    magistrateCourtCaption: 'IN THE MAGISTRATE COURT OF LAGOS STATE, HOLDEN AT {DIVISION}',
    federalHighCourtCaption: 'IN THE FEDERAL HIGH COURT OF NIGERIA, HOLDEN AT LAGOS',
    highCourtRules: 'High Court of Lagos State (Civil Procedure) Rules 2019',
    magistrateRules: 'Magistrate Court (Civil Procedure) Rules of Lagos State',
    defaultDivision: 'Ikeja',
  },
  Delta: {
    key: 'Delta',
    name: 'Delta State',
    capital: 'Asaba',
    highCourtCaption: 'IN THE HIGH COURT OF DELTA STATE',
    magistrateCourtCaption: 'IN THE MAGISTRATE COURT OF DELTA STATE, HOLDEN AT {DIVISION}',
    federalHighCourtCaption: 'IN THE FEDERAL HIGH COURT OF NIGERIA, HOLDEN AT ASABA',
    highCourtRules: 'Delta State High Court (Civil Procedure) Rules 2021',
    magistrateRules: 'Magistrate Court (Civil Procedure) Rules of Delta State',
    defaultDivision: 'Asaba',
  },
  FCT: {
    key: 'FCT',
    name: 'Federal Capital Territory',
    capital: 'Abuja',
    highCourtCaption: 'IN THE HIGH COURT OF THE FEDERAL CAPITAL TERRITORY, ABUJA',
    magistrateCourtCaption: 'IN THE MAGISTRATE COURT OF THE FCT, HOLDEN AT ABUJA',
    federalHighCourtCaption: 'IN THE FEDERAL HIGH COURT OF NIGERIA, HOLDEN AT ABUJA',
    highCourtRules: 'High Court of the Federal Capital Territory (Civil Procedure) Rules 2018',
    magistrateRules: 'Magistrate Court (Civil Procedure) Rules of the FCT',
    defaultDivision: 'Abuja',
  },
  Rivers: {
    key: 'Rivers',
    name: 'Rivers State',
    capital: 'Port Harcourt',
    highCourtCaption: 'IN THE HIGH COURT OF RIVERS STATE',
    magistrateCourtCaption: 'IN THE MAGISTRATE COURT OF RIVERS STATE, HOLDEN AT PORT HARCOURT',
    federalHighCourtCaption: 'IN THE FEDERAL HIGH COURT OF NIGERIA, HOLDEN AT PORT HARCOURT',
    highCourtRules: 'High Court of Rivers State (Civil Procedure) Rules 2023',
    magistrateRules: 'Magistrate Court (Civil Procedure) Rules of Rivers State',
    defaultDivision: 'Port Harcourt',
  },
  Abia: {
    key: 'Abia',
    name: 'Abia State',
    capital: 'Umuahia',
    highCourtCaption: 'IN THE HIGH COURT OF ABIA STATE',
    magistrateCourtCaption: 'IN THE MAGISTRATE COURT OF ABIA STATE, HOLDEN AT UMUAHIA',
    federalHighCourtCaption: 'IN THE FEDERAL HIGH COURT OF NIGERIA, HOLDEN AT UMUAHIA',
    highCourtRules: 'High Court of Abia State (Civil Procedure) Rules',
    magistrateRules: 'Magistrate Court (Civil Procedure) Rules of Abia State',
    defaultDivision: 'Umuahia',
  },
  Anambra: {
    key: 'Anambra',
    name: 'Anambra State',
    capital: 'Awka',
    highCourtCaption: 'IN THE HIGH COURT OF ANAMBRA STATE',
    magistrateCourtCaption: 'IN THE MAGISTRATE COURT OF ANAMBRA STATE, HOLDEN AT AWKA',
    federalHighCourtCaption: 'IN THE FEDERAL HIGH COURT OF NIGERIA, HOLDEN AT AWKA',
    highCourtRules: 'High Court of Anambra State (Civil Procedure) Rules 2019',
    magistrateRules: 'Magistrate Court (Civil Procedure) Rules of Anambra State',
    defaultDivision: 'Awka',
  },
  Enugu: {
    key: 'Enugu',
    name: 'Enugu State',
    capital: 'Enugu',
    highCourtCaption: 'IN THE HIGH COURT OF ENUGU STATE',
    magistrateCourtCaption: 'IN THE MAGISTRATE COURT OF ENUGU STATE, HOLDEN AT ENUGU',
    federalHighCourtCaption: 'IN THE FEDERAL HIGH COURT OF NIGERIA, HOLDEN AT ENUGU',
    highCourtRules: 'High Court of Enugu State (Civil Procedure) Rules 2020',
    magistrateRules: 'Magistrate Court (Civil Procedure) Rules of Enugu State',
    defaultDivision: 'Enugu',
  },
  Imo: {
    key: 'Imo',
    name: 'Imo State',
    capital: 'Owerri',
    highCourtCaption: 'IN THE HIGH COURT OF IMO STATE',
    magistrateCourtCaption: 'IN THE MAGISTRATE COURT OF IMO STATE, HOLDEN AT OWERRI',
    federalHighCourtCaption: 'IN THE FEDERAL HIGH COURT OF NIGERIA, HOLDEN AT OWERRI',
    highCourtRules: 'High Court of Imo State (Civil Procedure) Rules',
    magistrateRules: 'Magistrate Court (Civil Procedure) Rules of Imo State',
    defaultDivision: 'Owerri',
  },
  Oyo: {
    key: 'Oyo',
    name: 'Oyo State',
    capital: 'Ibadan',
    highCourtCaption: 'IN THE HIGH COURT OF OYO STATE',
    magistrateCourtCaption: 'IN THE MAGISTRATE COURT OF OYO STATE, HOLDEN AT IBADAN',
    federalHighCourtCaption: 'IN THE FEDERAL HIGH COURT OF NIGERIA, HOLDEN AT IBADAN',
    highCourtRules: 'High Court of Oyo State (Civil Procedure) Rules 2018',
    magistrateRules: 'Magistrate Court (Civil Procedure) Rules of Oyo State',
    defaultDivision: 'Ibadan',
  },
  Kano: {
    key: 'Kano',
    name: 'Kano State',
    capital: 'Kano',
    highCourtCaption: 'IN THE HIGH COURT OF KANO STATE',
    magistrateCourtCaption: 'IN THE MAGISTRATE COURT OF KANO STATE, HOLDEN AT KANO',
    federalHighCourtCaption: 'IN THE FEDERAL HIGH COURT OF NIGERIA, HOLDEN AT KANO',
    highCourtRules: 'High Court of Kano State (Civil Procedure) Rules 2019',
    magistrateRules: 'Magistrate Court (Civil Procedure) Rules of Kano State',
    defaultDivision: 'Kano',
  },
  Kaduna: {
    key: 'Kaduna',
    name: 'Kaduna State',
    capital: 'Kaduna',
    highCourtCaption: 'IN THE HIGH COURT OF KADUNA STATE',
    magistrateCourtCaption: 'IN THE MAGISTRATE COURT OF KADUNA STATE, HOLDEN AT KADUNA',
    federalHighCourtCaption: 'IN THE FEDERAL HIGH COURT OF NIGERIA, HOLDEN AT KADUNA',
    highCourtRules: 'High Court of Kaduna State (Civil Procedure) Rules 2007',
    magistrateRules: 'Magistrate Court (Civil Procedure) Rules of Kaduna State',
    defaultDivision: 'Kaduna',
  },
  Edo: {
    key: 'Edo',
    name: 'Edo State',
    capital: 'Benin City',
    highCourtCaption: 'IN THE HIGH COURT OF EDO STATE',
    magistrateCourtCaption: 'IN THE MAGISTRATE COURT OF EDO STATE, HOLDEN AT BENIN',
    federalHighCourtCaption: 'IN THE FEDERAL HIGH COURT OF NIGERIA, HOLDEN AT BENIN',
    highCourtRules: 'High Court of Edo State (Civil Procedure) Rules 2012',
    magistrateRules: 'Magistrate Court (Civil Procedure) Rules of Edo State',
    defaultDivision: 'Benin',
  },
  Ogun: {
    key: 'Ogun',
    name: 'Ogun State',
    capital: 'Abeokuta',
    highCourtCaption: 'IN THE HIGH COURT OF OGUN STATE',
    magistrateCourtCaption: 'IN THE MAGISTRATE COURT OF OGUN STATE, HOLDEN AT ABEOKUTA',
    federalHighCourtCaption: 'IN THE FEDERAL HIGH COURT OF NIGERIA, HOLDEN AT ABEOKUTA',
    highCourtRules: 'High Court of Ogun State (Civil Procedure) Rules',
    magistrateRules: 'Magistrate Court (Civil Procedure) Rules of Ogun State',
    defaultDivision: 'Abeokuta',
  },
  'Cross River': {
    key: 'Cross River',
    name: 'Cross River State',
    capital: 'Calabar',
    highCourtCaption: 'IN THE HIGH COURT OF CROSS RIVER STATE',
    magistrateCourtCaption: 'IN THE MAGISTRATE COURT OF CROSS RIVER STATE, HOLDEN AT CALABAR',
    federalHighCourtCaption: 'IN THE FEDERAL HIGH COURT OF NIGERIA, HOLDEN AT CALABAR',
    highCourtRules: 'High Court of Cross River State (Civil Procedure) Rules',
    magistrateRules: 'Magistrate Court (Civil Procedure) Rules of Cross River State',
    defaultDivision: 'Calabar',
  },
  'Akwa Ibom': {
    key: 'Akwa Ibom',
    name: 'Akwa Ibom State',
    capital: 'Uyo',
    highCourtCaption: 'IN THE HIGH COURT OF AKWA IBOM STATE',
    magistrateCourtCaption: 'IN THE MAGISTRATE COURT OF AKWA IBOM STATE, HOLDEN AT UYO',
    federalHighCourtCaption: 'IN THE FEDERAL HIGH COURT OF NIGERIA, HOLDEN AT UYO',
    highCourtRules: 'High Court of Akwa Ibom State (Civil Procedure) Rules',
    magistrateRules: 'Magistrate Court (Civil Procedure) Rules of Akwa Ibom State',
    defaultDivision: 'Uyo',
  },
};

/** Default jurisdiction if firm hasn't set one */
const DEFAULT_JURISDICTION = 'Lagos';

/**
 * Get the JurisdictionConfig for a firm's defaultStateOfPractice.
 * Falls back to Lagos if unset or invalid.
 */
export function getJurisdiction(stateKey?: string | null): JurisdictionConfig {
  if (stateKey && JURISDICTION_REGISTRY[stateKey]) {
    return JURISDICTION_REGISTRY[stateKey];
  }
  return JURISDICTION_REGISTRY[DEFAULT_JURISDICTION];
}

/**
 * Build a jurisdiction context block for the AI system prompt.
 * Tells the AI which court hierarchy and procedural rules to use.
 */
export function buildJurisdictionContextBlock(stateKey?: string | null): string {
  const j = getJurisdiction(stateKey);
  return `JURISDICTIONAL CONTEXT:
- Default State of Practice: ${j.name}
- Capital/Judicial Division: ${j.defaultDivision}
- High Court Caption: "${j.highCourtCaption} IN THE ${j.defaultDivision.toUpperCase()} JUDICIAL DIVISION"
- Magistrate Court Caption: "${j.magistrateCourtCaption.replace('{DIVISION}', j.defaultDivision)}"
- Federal High Court Caption: "${j.federalHighCourtCaption}"
- High Court Procedural Rules: ${j.highCourtRules}
- Magistrate Procedural Rules: ${j.magistrateRules}

JURISDICTIONAL INTELLIGENCE RULES:
1. Unless the user explicitly specifies a different court (e.g., "Federal High Court", "Magistrate Court"), default to the High Court of ${j.name}.
2. If the matter involves federal jurisdiction (e.g., revenue, immigration, copyright, maritime), use the Federal High Court caption instead.
3. If the matter is a landlord-tenant recovery of premises with low monetary value, use the Magistrate Court caption.
4. Always cite the correct procedural rules (${j.highCourtRules}) in the heading or first paragraph of court processes.
5. When generating a court caption, place it at the TOP of the document, centered and bold, before any party information.`;
}

/**
 * Build a short jurisdictional reasoning string for the chat status display.
 * This is shown to the user so they understand which jurisdiction the AI
 * selected and why.
 */
/**
 * Jurisdictional analysis result — now structured around the 3 pillars:
 *   1. Applicable Law (governing statutes, rules, practice directions)
 *   2. Competent Forum (the court or regulatory body with constitutional/statutory authority)
 *   3. Filing/Practice Key (the immediate procedural rule or form required)
 *
 * The old `court` and `reasoning` fields are kept for backward compatibility
 * but the new `governingLaw`, `forum`, `filingKey`, and `warning` fields
 * are what the concise JurisdictionCard UI renders.
 */
export interface JurisdictionAnalysis {
  /** Full court caption for the document header (backward compat) */
  court: string;
  /** Display name of the jurisdiction (e.g., "Lagos State", "Federal") */
  jurisdiction: string;
  /** Full reasoning text (backward compat — used by old UI) */
  reasoning: string;
  /** NEW: The primary governing statutes, rules, and practice directions */
  governingLaw: string;
  /** NEW: The competent forum (court or regulatory body) with legal nuance */
  forum: string;
  /** NEW: A single sentence on the immediate procedural rule or form required */
  filingKey: string;
  /** NEW: Optional jurisdictional warning (only if there's a genuine risk) */
  warning?: string;
}

export function buildJurisdictionalReasoning(
  prompt: string,
  stateKey?: string | null
): JurisdictionAnalysis {
  const result = computeJurisdictionalReasoning(prompt, stateKey);
  // Enrich with 3-pillar fields if not explicitly set
  return enrichJurisdictionAnalysis(result);
}

/**
 * Internal: the original jurisdictional reasoning logic.
 * Returns the old-style { court, jurisdiction, reasoning } plus any
 * explicitly-set 3-pillar fields (governingLaw, forum, filingKey, warning).
 * The 3-pillar fields are optional here — enrichJurisdictionAnalysis fills
 * them in via pattern matching if they're not explicitly set.
 */
function computeJurisdictionalReasoning(
  prompt: string,
  stateKey?: string | null
): Omit<JurisdictionAnalysis, 'governingLaw' | 'forum' | 'filingKey'> & {
  governingLaw?: string;
  forum?: string;
  filingKey?: string;
  warning?: string;
} {
  const j = getJurisdiction(stateKey);
  const p = prompt.toLowerCase();

  // ── NON-NIGERIAN JURISDICTION DETECTION ──
  // If the prompt explicitly references a foreign jurisdiction, do NOT
  // default to Nigerian courts. Return a generic court caption and a
  // jurisdictional caveat instead.
  //
  // The keywords are matched as substrings (case-insensitive). We include
  // common city names, state abbreviations (with word boundaries), and
  // country names. This is intentionally broad — false positives (detecting
  // a foreign jurisdiction when the matter is actually Nigerian) are rare
  // and less harmful than false negatives (defaulting to Lagos for a
  // San Francisco matter).
  // ─── NIGERIA OVERRIDE GUARD ─────────────────────────────────────────
  // If the prompt EXPLICITLY mentions Nigeria or a Nigerian state/city,
  // we SKIP foreign-jurisdiction detection entirely. This prevents false
  // positives like "Victoria Island, Lagos" matching Australia's "Victoria"
  // state, or "Birmingham" matching when the matter is clearly Nigerian.
  //
  // The override is intentionally broad: Nigerian state names, major cities,
  // and common abbreviations. If ANY of these appear, the matter is Nigerian
  // and we fall through to the Nigerian court detection logic below.
  const nigeriaIndicators = [
    'nigeria', 'nigerian', 'lagos', 'abuja', 'fct', 'kano', 'ibadan',
    'port harcourt', 'benin city', 'kaduna', 'enugu', 'owerri', 'warri',
    'calabar', 'uyo', 'abeokuta', 'asaba', 'benue', 'plateau', 'nassarawa',
    'cross river', 'akwa ibom', 'rivers state', 'delta state', 'edo state',
    'ogun state', 'oyo state', 'osun', 'ondo', 'ekiti', 'kwara', 'kogi',
    'anambra', 'imo state', 'abia', 'ebonyi', 'bayelsa', 'gombe', 'bauchi',
    'borno', 'yobe', 'jigawa', 'sokoto', 'kebbi', 'zamfara', 'katsina',
    'niger state', 'taraba', 'adamawa',
    // Nigerian courts (strong Nigeria signal)
    'nwlr', 'lpelr', 'scn', 'supreme court of nigeria', 'court of appeal of nigeria',
    'federal high court of nigeria', 'nicn',
    // Common Nigerian legal terms
    'cama 2020', 'cama 2004', 'land use act', 'recovery of premises',
    'magistrate court of', 'customary court of', 'area court of',
    'naira', '₦',
  ];
  const isNigeriaMatter = nigeriaIndicators.some(kw => p.includes(kw));

  // US state abbreviations as whole words (e.g. "CA", "NY", "TX")
  // to catch "San Francisco, CA" without matching "ca" inside other words.
  // Declared here (before use) so the foreign-detection block can reference it.
  const usStateAbbrevs = [
    '\bAL\b', '\bAK\b', '\bAZ\b', '\bAR\b', '\bCA\b', '\bCO\b', '\bCT\b',
    '\bDE\b', '\bFL\b', '\bGA\b', '\bHI\b', '\bID\b', '\bIL\b', '\bIN\b',
    '\bIA\b', '\bKS\b', '\bKY\b', '\bLA\b', '\bME\b', '\bMD\b', '\bMA\b',
    '\bMI\b', '\bMN\b', '\bMS\b', '\bMO\b', '\bMT\b', '\bNE\b', '\bNV\b',
    '\bNH\b', '\bNJ\b', '\bNM\b', '\bNY\b', '\bNC\b', '\bND\b', '\bOH\b',
    '\bOK\b', '\bOR\b', '\bPA\b', '\bRI\b', '\bSC\b', '\bSD\b', '\bTN\b',
    '\bTX\b', '\bUT\b', '\bVT\b', '\bVA\b', '\bWA\b', '\bWV\b', '\bWI\b', '\bWY\b',
    '\bDC\b',
  ];

  const foreignJurisdictions: { keywords: string[]; name: string }[] = [
    { keywords: [
        'san francisco', 'california', 'u.s.', 'u.s.a.', 'united states', 'united states of america',
        'america', 'american', 'delaware', 'new york', 'texas', 'florida',
        'washington state', 'illinois', 'chicago', 'los angeles', 'seattle',
        'boston', 'houston', 'atlanta', 'miami', 'dallas', 'phoenix',
        'philadelphia', 'san diego', 'denver', 'las vegas', 'portland',
        'sacramento', 'austin', 'georgia', 'virginia', 'michigan', 'ohio',
        'pennsylvania', 'new jersey', 'arizona', 'nevada', 'oregon',
        'massachusetts', 'washington d.c.', 'washington dc',
      ], name: 'United States' },
    { keywords: [
        'united kingdom', 'u.k.', 'england', 'london', 'british',
        'wales', 'scotland', 'manchester', 'birmingham uk', 'liverpool', 'leeds',
        'glasgow', 'edinburgh', 'cardiff', 'belfast',
      ], name: 'United Kingdom' },
    { keywords: [
        'european union', 'e.u.', 'germany', 'france', 'spain', 'italy',
        'netherlands', 'belgium', 'austria', 'sweden', 'norway', 'denmark',
        'finland', 'poland', 'portugal', 'greece', 'ireland', 'switzerland',
        'berlin', 'paris', 'madrid', 'rome', 'amsterdam', 'vienna', 'stockholm',
      ], name: 'European Union' },
    { keywords: [
        'canada', 'canadian', 'ontario', 'toronto', 'vancouver', 'montreal',
        'calgary', 'ottawa', 'edmonton', 'quebec', 'british columbia',
        'alberta', 'manitoba', 'saskatchewan', 'nova scotia',
      ], name: 'Canada' },
    { keywords: [
        // REMOVED 'victoria' — false positive on Victoria Island, Lagos.
        // REMOVED 'perth' — ambiguous (also a Scottish city).
        // Now requires explicit Australia context or uniquely-Australian cities.
        'australia', 'australian', 'sydney', 'melbourne', 'brisbane',
        'adelaide', 'canberra', 'queensland', 'new south wales', 'nsw',
        'victoria australia', 'perth australia',
      ], name: 'Australia' },
    { keywords: [
        'south africa', 'south african', 'johannesburg', 'cape town',
        'durban', 'pretoria', 'western cape', 'gauteng',
      ], name: 'South Africa' },
    { keywords: ['ghana', 'ghanaian', 'accra', 'kumasi'], name: 'Ghana' },
    { keywords: ['kenya', 'kenyan', 'nairobi', 'mombasa'], name: 'Kenya' },
    { keywords: ['dubai', 'uae', 'u.a.e.', 'emirates', 'abu dhabi', 'sharjah'], name: 'United Arab Emirates' },
    { keywords: ['saudi arabia', 'saudi', 'riyadh', 'jeddah'], name: 'Saudi Arabia' },
    { keywords: ['qatar', 'doha'], name: 'Qatar' },
    { keywords: ['singapore', 'singaporean'], name: 'Singapore' },
    { keywords: ['hong kong', 'hongkong'], name: 'Hong Kong' },
    { keywords: ['japan', 'japanese', 'tokyo', 'osaka'], name: 'Japan' },
    { keywords: ['south korea', 'korean', 'seoul', 'busan'], name: 'South Korea' },
    { keywords: ['china', 'chinese', 'beijing', 'shanghai', 'shenzhen', 'guangzhou'], name: 'China' },
    { keywords: ['india', 'indian', 'mumbai', 'delhi', 'bangalore', 'chennai', 'kolkata', 'hyderabad'], name: 'India' },
    { keywords: ['pakistan', 'pakistani', 'karachi', 'lahore', 'islamabad'], name: 'Pakistan' },
    { keywords: ['bangladesh', 'dhaka', 'chittagong'], name: 'Bangladesh' },
    { keywords: ['brazil', 'brazilian', 'são paulo', 'sao paulo', 'rio de janeiro', 'brasilia'], name: 'Brazil' },
    { keywords: ['mexico', 'mexican', 'mexico city', 'guadalajara', 'monterrey'], name: 'Mexico' },
    { keywords: ['argentina', 'argentine', 'buenos aires'], name: 'Argentina' },
    { keywords: ['chile', 'chilean', 'santiago'], name: 'Chile' },
    { keywords: ['colombia', 'colombian', 'bogotá', 'bogota'], name: 'Colombia' },
    { keywords: ['egypt', 'egyptian', 'cairo', 'alexandria'], name: 'Egypt' },
    { keywords: ['morocco', 'moroccan', 'casablanca', 'rabat'], name: 'Morocco' },
    { keywords: ['tanzania', 'dar es salaam', 'dodoma'], name: 'Tanzania' },
    { keywords: ['uganda', 'kampala'], name: 'Uganda' },
    { keywords: ['zimbabwe', 'harare', 'bulawayo'], name: 'Zimbabwe' },
    { keywords: ['rwanda', 'kigali'], name: 'Rwanda' },
  ];

  // ─── Foreign-jurisdiction detection ───
  // SKIPPED if the prompt explicitly mentions Nigeria or a Nigerian
  // state/city. This is the key fix: "Victoria Island, Lagos" should
  // NEVER trigger Australia just because "victoria" is in the keyword list.
  // The Nigeria guard runs FIRST and short-circuits to Nigerian court
  // detection below.
  if (!isNigeriaMatter) {
    for (const fj of foreignJurisdictions) {
      if (fj.keywords.some(kw => p.includes(kw))) {
        return {
          court: `[JURISDICTION: ${fj.name}]`,
          jurisdiction: fj.name,
          reasoning: `This matter pertains to ${fj.name} jurisdiction. Drafting using general legal principles applicable to ${fj.name}. Verify with local counsel in ${fj.name} for jurisdiction-specific requirements, court formatting, and procedural rules.`,
        };
      }
    }

    // Check US state abbreviations (regex word-boundary match)
    for (const abbrev of usStateAbbrevs) {
      try {
        const re = new RegExp(abbrev, 'i');
        if (re.test(prompt)) {
          return {
            court: `[JURISDICTION: United States]`,
            jurisdiction: 'United States',
            reasoning: `This matter references a US state (${abbrev.replace(/\\b/g, '')}). Drafting using general legal principles applicable to the United States. Verify with local counsel for state-specific requirements, court formatting, and procedural rules.`,
          };
        }
      } catch {
        // regex error — skip
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // NIGERIAN COURT DETECTION (only for Nigerian matters)
  // Comprehensive hierarchy covering ALL courts of record:
  //
  //   SUPREME COURT (apex)
  //     ↑
  //   COURT OF APPEAL
  //     ↑
  //   ┌───────────────────────────────┬────────────────────────────┐
  //   │ FEDERAL HIGH COURT            │ STATE HIGH COURT (FCT HC)  │
  //   │ NATIONAL INDUSTRIAL COURT     │   ↑                        │
  //   │ (appellate div. for NIC)      │ MAGISTRATE COURT (tiers)   │
  //   │ SHARIA COURT OF APPEAL        │   ↑                        │
  //   │ CUSTOMARY COURT OF APPEAL     │ CUSTOMARY COURT / AREA CT  │
  //   └───────────────────────────────┴────────────────────────────┘
  //   SPECIALIZED TRIBUNALS: TAT, IST, EPT, CCT, ACDAMT
  //
  // Detection order:
  //   1. Apex & appellate courts (named explicitly first to avoid shadowing)
  //   2. Specialized federal courts (FHC, NICN)
  //   3. Lower courts of record (Magistrate tiers, Customary, Area, Sharia)
  //   4. Appellate divisions of lower courts (Upper Area, CCA, SCA)
  //   5. Specialized tribunals (TAT, IST, EPT, CCT, ACDAMT)
  //   6. Subject-matter-based inference (falls back to FHC/NICN/HC/Magistrate)
  //   7. Default to State High Court
  // ─────────────────────────────────────────────────────────────────────

  // ── 1. APEX & SUPERIOR APPELLATE COURTS ──────────────────────────────
  if (p.includes('supreme court')) {
    return {
      court: 'SUPREME COURT OF NIGERIA',
      jurisdiction: 'Federal',
      reasoning: `The prompt references the Supreme Court of Nigeria. The Supreme Court is the apex court — its decisions are binding on ALL lower courts per Section 235 of the 1999 Constitution. It hears appeals ONLY from the Court of Appeal (no direct appeals from lower courts except in narrowly defined original-jurisdiction matters). Original jurisdiction is limited to disputes between the Federation and a State, or between States (Section 232). A panel of at least 7 Justices is required for appeals; the full panel of 21 is reserved for constitutional interpretation. Citation form: SC.NNN/YYYY (e.g., SC.123/2024). Counsel must file a Brief of Argument within 14 days of filing the Notice of Appeal (Supreme Court Rules 2024).`,
    };
  }
  if (p.includes('court of appeal') || p.includes('appellate court') || p.includes('appeal court')) {
    return {
      court: 'COURT OF APPEAL OF NIGERIA',
      jurisdiction: 'Federal',
      reasoning: `The prompt references the Court of Appeal. The Court of Appeal is the second-highest court — hears appeals from: Federal High Court, State High Courts, FCT High Court, National Industrial Court (including its Appellate Division for certain interlocutory appeals), Sharia Courts of Appeal, Customary Courts of Appeal, Election Petition Tribunals, Code of Conduct Tribunal, and Investment and Securities Tribunal. Established per Section 237 of the 1999 Constitution. Sits in divisions (Lagos, Abuja, Ibadan, Kaduna, Enugu, Port Harcourt, Calabar, Benin, Ilorin, Jos, Sokoto, Owerri). A panel of at least 3 Justices is required. Citation form: CA/L/CIV.NNN/YYYY (division/circuit/track/number/year). Appeals lie to the Supreme Court. Time limit: 90 days from decision to file Notice of Appeal (CA Rules 2021).`,
    };
  }

  // ── 2. SPECIALIZED FEDERAL HIGH-TIER COURTS ──────────────────────────
  if (p.includes('federal high court') || p.includes(' fhc ') || p.endsWith(' fhc') || p.startsWith('fhc ')) {
    return {
      court: j.federalHighCourtCaption,
      jurisdiction: j.name,
      reasoning: `The prompt references the Federal High Court. Using ${j.federalHighCourtCaption}. The FHC has EXCLUSIVE jurisdiction over: (a) revenue/companies income tax/VAT/customs & excise (s.251(1)(a)); (b) immigration/citizenship (s.251(1)(b)); (c) aviation (s.251(1)(c)); (d) banking & banks/financial institutions incl. CBN/NDIC/AMCON (s.251(1)(d)); (e) corporate/CAMA matters (s.251(1)(e)); (f) intellectual property — copyright/trademark/patent (s.251(1)(f)); (g) maritime/admiralty (s.251(1)(g)); (h) fiscal/legislative prerogative; (i) federal pardons & forfeitures; (j) nuclear safety; (k) presidential elections (s.251(1)(k) — EXCLUSIVE except Governorship which goes to Election Petition Tribunal). Has supervisory jurisdiction over federal tribunals (TAT, IST, CCT). Sits in 37 divisions across Nigeria. Citation form: FHC/L/CS/NNN/YYYY (Lagos) — division/track/number/year. Procedural rules: Federal High Court (Civil Procedure) Rules 2019. Appeals lie to the Court of Appeal.`,
    };
  }
  if (p.includes('national industrial court') || p.includes(' nic ') || p.includes(' nicn') || p.startsWith('nic ') || p.includes('industrial court')) {
    // Distinguish NICN Appellate Division
    if (p.includes('appellate') || p.includes('appeal')) {
      return {
        court: 'IN THE NATIONAL INDUSTRIAL COURT OF NIGERIA (APPELLATE DIVISION)',
        jurisdiction: 'Federal',
        reasoning: `The prompt references the NICN Appellate Division. Established per Section 254C(5) of the 1999 Constitution (as amended by the 3rd Alteration). Hears appeals from the NICN single-judge interlocutory rulings and from the National Industrial Court Registry decisions. A panel of 3 Judges sits. Decisions of the Appellate Division are final on interlocutory matters but appeals on substantive issues lie to the Court of Appeal.`,
      };
    }
    return {
      court: 'IN THE NATIONAL INDUSTRIAL COURT OF NIGERIA',
      jurisdiction: 'Federal',
      reasoning: `The prompt references the National Industrial Court. NICN has EXCLUSIVE civil jurisdiction over: trade unions; conditions of employment; terms of workers' contracts; trade disputes; industrial actions; child labour; forced labour; discrimination in employment; minimum wage; industrial relations; occupational safety & health (s.254C(1)-(4) of the 1999 Constitution, 3rd Alteration). NICN can grant injunctions and equitable relief. Has exclusive jurisdiction over claims arising from the Employees' Compensation Act, Trade Disputes Act, Labour Act, Factories Act, Pensions Reform Act. Sits in 36 states + FCT. The President of the NICN sits with at least 2 Judges for substantive matters, single Judge for interlocutory. Citation form: NICN/LA/NNN/YYYY. Procedural rules: National Industrial Court of Nigeria (Civil Procedure) Rules 2017. Appeals lie directly to the Court of Appeal (NOT through any intermediate court).`,
    };
  }

  // ── 3. STATE HIGH COURT (explicit) ───────────────────────────────────
  if (p.includes('high court') && !p.includes('federal high court')) {
    return {
      court: `${j.highCourtCaption} IN THE ${j.defaultDivision.toUpperCase()} JUDICIAL DIVISION`,
      jurisdiction: j.name,
      reasoning: `The prompt references the State High Court. Using ${j.highCourtCaption} (${j.defaultDivision} Judicial Division). The State High Court has UNLIMITED original jurisdiction over civil and criminal matters NOT falling under federal exclusive jurisdiction (s.272 of the 1999 Constitution). Subject-matter coverage: land/property; torts; contracts; matrimonial causes (statutory marriage); probate & succession; fundamental rights enforcement (concurrent with FHC); equity & trusts; personal injuries; criminal trials (felonies); injunctions. Appellate jurisdiction: hears appeals from Magistrate Courts, Customary Courts, Area Courts, and Small Claims Courts. Has supervisory jurisdiction over lower courts in its state. Sits in multiple judicial divisions per state. Citation form:Suit No: HCL/NNN/YYYY (${j.name} format varies). Procedural rules: ${j.highCourtRules}. Appeals lie to the Court of Appeal.`,
    };
  }

  // ── 4. MAGISTRATE COURT — ALL TIERS (Nigeria's busiest lower court) ──
  // Tiers (varies slightly by state but the canonical hierarchy is):
  //   Chief Magistrate Court (Grade I) — highest tier
  //   Senior Magistrate Court (Grade II)
  //   Magistrate Court (Grade III)
  //   District Court / Inferior Magistrate (Grade IV) — lowest tier
  //
  // Lagos uses a different nomenclature: Chief Magistrate / Senior Magistrate /
  // Magistrate (Civil: up to ₦10,000,000 for Chief Magistrate; criminal: 7-14 yrs).
  // FCT: Senior Magistrate / Magistrate (Civil: up to ₦1,000,000; Criminal: 3-7 yrs).
  // Most other states: Chief Magistrate Civil up to ₦500,000 - ₦5,000,000,
  // Senior Magistrate up to ₦250,000 - ₦1,000,000, Magistrate up to ₦100,000.
  //
  // Detection — explicit tier names first, then generic "magistrate".
  if (p.includes('chief magistrate')) {
    return {
      court: `IN THE CHIEF MAGISTRATE COURT OF ${j.name.toUpperCase()}, HOLDEN AT ${j.defaultDivision.toUpperCase()}`,
      jurisdiction: j.name,
      reasoning: `The prompt references the Chief Magistrate Court (Grade I — the highest magistrate tier). Using the Chief Magistrate Court of ${j.name}, holden at ${j.defaultDivision}. The Chief Magistrate has the widest jurisdiction of all magistrate tiers: Civil — claims up to the statutory ceiling (Lagos: ₦10,000,000 under the Magistrates' Court Law; FCT: ₦1,000,000; most other states: ₦500,000–₦5,000,000 — verify ${j.name}'s current limit). Criminal — offences with maximum sentence of 7-14 years imprisonment (state-dependent). Subject-matter coverage: landlord-tenant recovery of premises (where the annual rent is within the monetary cap), simple contract debts, minor assaults, summary trials, misdemeanors, preliminary inquiries into felonies (committal proceedings). Has powers to issue search warrants, bail in bailable offences, and grant some equitable relief. Statutory basis: ${j.name} Magistrates' Court Law + ${j.magistrateRules}. Appeals lie to the State High Court (de novo or on the record depending on the issue). NOT a court of unlimited jurisdiction — matters exceeding the monetary cap must go to the High Court.`,
    };
  }
  if (p.includes('senior magistrate')) {
    return {
      court: `IN THE SENIOR MAGISTRATE COURT OF ${j.name.toUpperCase()}, HOLDEN AT ${j.defaultDivision.toUpperCase()}`,
      jurisdiction: j.name,
      reasoning: `The prompt references the Senior Magistrate Court (Grade II). Using the Senior Magistrate Court of ${j.name}, holden at ${j.defaultDivision}. Civil jurisdiction: claims up to mid-range limit (Lagos: ₦5,000,000; FCT: ₦500,000; most other states: ₦250,000–₦1,000,000 — verify ${j.name}'s current limit). Criminal jurisdiction: offences with maximum sentence of 5-7 years imprisonment. Subject-matter coverage overlaps with Chief Magistrate but at lower monetary stakes: landlord-tenant recovery, contract debts, minor assaults, summary trials, preliminary inquiries. Statutory basis: ${j.name} Magistrates' Court Law + ${j.magistrateRules}. Appeals lie to the State High Court.`,
    };
  }
  if (p.includes('magistrate')) {
    // Generic magistrate (unspecified tier) — use the standard caption
    return {
      court: j.magistrateCourtCaption.replace('{DIVISION}', j.defaultDivision),
      jurisdiction: j.name,
      reasoning: `The prompt references the Magistrate Court (lower court of record). Using ${j.magistrateCourtCaption.replace('{DIVISION}', j.defaultDivision)}. The Magistrate Court is the busiest trial court in Nigeria — handles the bulk of landlord-tenant recovery, simple contract debts, minor assaults, and summary trials. The court operates in TIERS (Chief Magistrate → Senior Magistrate → Magistrate → District Court) with progressively smaller monetary caps. As a guide: Chief Magistrate ≈ ₦5M–₦10M; Senior Magistrate ≈ ₦1M–₦5M; Magistrate ≈ ₦250K–₦1M; District Court ≈ <₦250K (varies by state — verify ${j.name}'s current Magistrates' Court Law). Criminal jurisdiction: offences with maximum sentence of 3-14 years (state and tier dependent). Statutory basis: ${j.name} Magistrates' Court Law + ${j.magistrateRules}. The court is a court of record and its proceedings are preserved for appeal. Appeals lie to the State High Court (typically by way of re-trial for civil matters, on the record for criminal matters). For landlord-tenant matters exceeding the monetary cap, the State High Court has exclusive jurisdiction. For customary land disputes, the Customary Court is the proper forum.`,
    };
  }
  if (p.includes('district court')) {
    // District Court — lowest magistrate-equivalent tier in some states (esp. Lagos/Anambra)
    return {
      court: `IN THE DISTRICT COURT OF ${j.name.toUpperCase()}, HOLDEN AT ${j.defaultDivision.toUpperCase()}`,
      jurisdiction: j.name,
      reasoning: `The prompt references the District Court (lowest magistrate-tier court). Using the District Court of ${j.name}, holden at ${j.defaultDivision}. District Courts are the lowest tier of magistrate-equivalent courts in some states (notably Lagos, Anambra, Imo). Civil jurisdiction: typically limited to claims under ₦250,000 (state-dependent — verify ${j.name}'s District Court Law). Criminal jurisdiction: offences with maximum sentence of 6 months to 3 years. Subject-matter coverage: small-debt recovery, minor landlord-tenant (low-rent tenancies), small claims, summary offences, traffic offences. Statutory basis: ${j.name} District Court Law (or equivalent). Appeals lie to the Magistrate Court or directly to the State High Court, depending on the state's court hierarchy structure. NOTE: Lagos has a parallel Small Claims Court (₦5,000,000 cap) that operates with simplified procedures — consider whether the matter fits the Small Claims regime instead.`,
    };
  }

  // ── 5. SMALL CLAIMS COURT (Lagos-pioneered, now adopted elsewhere) ──
  if (p.includes('small claims')) {
    return {
      court: `IN THE SMALL CLAIMS COURT OF ${j.name.toUpperCase()}, HOLDEN AT ${j.defaultDivision.toUpperCase()}`,
      jurisdiction: j.name,
      reasoning: `The prompt references the Small Claims Court. Using the Small Claims Court of ${j.name}, holden at ${j.defaultDivision}. Small Claims Courts were first established in Lagos (2018) and have been adopted by several other states. They have SIMPLIFIED procedures — no counsel required, no formal pleadings, single hearing, decision within 14 days. Monetary cap: Lagos ₦5,000,000; other states vary (₦1,000,000–₦5,000,000). Subject-matter: debt recovery, minor contract disputes, simple landlord-tenant (rent arrears, not recovery of premises). Statutory basis: ${j.name} Small Claims Court Practice Direction (or equivalent). Hearings are scheduled within 14 days of filing; judgment is given the same day or within 3 days. Appeals are limited — only on questions of law, and require leave of court. NOT for: land disputes, complex commercial matters, matrimonial causes, or personal injury claims.`,
    };
  }

  // ── 6. CUSTOMARY COURT (Southern & Middle-Belt states) ──────────────
  if (p.includes('customary court') && !p.includes('customary court of appeal')) {
    return {
      court: `IN THE CUSTOMARY COURT OF ${j.name.toUpperCase()}, HOLDEN AT ${j.defaultDivision.toUpperCase()}`,
      jurisdiction: j.name,
      reasoning: `The prompt references the Customary Court. Using the Customary Court of ${j.name}, holden at ${j.defaultDivision}. Customary Courts are lower courts of record in Southern and Middle-Belt states (Lagos, Oyo, Ogun, Ondo, Ekiti, Edo, Delta, Anambra, Enugu, Imo, Abia, Ebonyi, Cross River, Akwa Ibom, Benue, Plateau, Kogi, Nasarawa, FCT). Subject-matter jurisdiction: (1) customary land disputes (land held under customary tenure — NOT land under statutory Right of Occupancy which goes to the High Court); (2) inheritance & succession under native law and custom (NOT statutory wills which go to High Court probate); (3) customary marriage dissolution & consequences; (4) custody of children of customary marriage; (5) minor civil claims governed by customary law; (6) defamation under customary law. Monetary cap varies (often ₦50,000–₦500,000 — verify ${j.name}'s Customary Court Law). Statutory basis: ${j.name} Customary Court Law (or equivalent). The court's decisions are binding only on parties before it; precedents are not strictly applied. Appeals lie to the Customary Court of Appeal (where established) or directly to the State High Court. The Customary Court is presided over by a legally-qualified Chairman (in some states) or by lay assessors knowledgeable in customary law (in others).`,
    };
  }

  // ── 7. AREA COURT (Northern states — civil & criminal) ───────────────
  if ((p.includes('area court') && !p.includes('upper area court')) || (p.includes('sharia court') && !p.includes('sharia court of appeal') && !p.includes('upper area'))) {
    return {
      court: `IN THE AREA COURT OF ${j.name.toUpperCase()}, HOLDEN AT ${j.defaultDivision.toUpperCase()}`,
      jurisdiction: j.name,
      reasoning: `The prompt references the Area Court (sometimes called Sharia Court at first instance in some Northern states). Using the Area Court of ${j.name}, holden at ${j.defaultDivision}. Area Courts are lower courts of record in Northern Nigeria (the equivalent of Customary Courts in the South). They have BOTH civil and criminal jurisdiction. Civil jurisdiction: (1) Islamic personal law matters (marriage, divorce, maintenance, custody, guardianship, waqf, inheritance) between Muslims; (2) customary land disputes under native law; (3) minor civil claims under native law & custom; (4) debts and small contract claims under native law. Criminal jurisdiction: minor offences against native law & custom, and Islamic penal matters (in states that have adopted Sharia penal codes: Zamfara, Kano, Sokoto, Katsina, Jigawa, Bauchi, Borno, Yobe, Kaduna, Niger, Gombe, Kebbi). Monetary cap: typically ₦50,000–₦250,000 (state-dependent — verify ${j.name}'s Area Court Law). Statutory basis: ${j.name} Area Courts Law (or Sharia Courts Law in Sharia states). Presided over by an Alkali (Islamic judge) trained in Islamic jurisprudence. Appeals lie to the Upper Area Court, then to the Sharia Court of Appeal (for Islamic law matters) or the State High Court (for customary/civil matters).`,
    };
  }
  if (p.includes('upper area court')) {
    return {
      court: `IN THE UPPER AREA COURT OF ${j.name.toUpperCase()}, HOLDEN AT ${j.defaultDivision.toUpperCase()}`,
      jurisdiction: j.name,
      reasoning: `The prompt references the Upper Area Court (intermediate appellate court over Area Courts in Northern Nigeria). Using the Upper Area Court of ${j.name}, holden at ${j.defaultDivision}. The Upper Area Court hears appeals from Area Courts on Islamic personal law, customary land, and minor civil matters. It also has ORIGINAL jurisdiction in more serious Islamic law matters (e.g., higher-value estates, complex inheritance, contested guardianship). Presided over by a Senior Alkali or a panel of 2-3 Alkalis. Statutory basis: ${j.name} Area Courts Law. Appeals lie to the Sharia Court of Appeal (for Islamic personal law matters) or the State High Court (for customary law / civil matters). The Upper Area Court is the last court of first-instance appeal in the Northern lower-court hierarchy before matters reach the intermediate appellate courts (SCA / HC).`,
    };
  }

  // ── 8. INTERMEDIATE APPELLATE COURTS (CCA & SCA) ─────────────────────
  if (p.includes('customary court of appeal')) {
    return {
      court: `IN THE CUSTOMARY COURT OF APPEAL, ${j.name.toUpperCase()}`,
      jurisdiction: j.name,
      reasoning: `The prompt references the Customary Court of Appeal. Using the Customary Court of Appeal of ${j.name}. The CCA is an intermediate appellate court established per Section 280 of the 1999 Constitution — but only in states that have opted to establish one (currently: Enugu, Imo, Abia, Anambra, Ebonyi, Lagos, Oyo, Ogun, Ondo, Ekiti, Edo, Delta, Cross River, Akwa Ibom, Rivers, Bayelsa, Benue, Plateau, Nasarawa, Kogi, FCT). The CCA hears appeals from Customary Courts on CUSTOMARY LAW matters ONLY (land, inheritance, marriage under native law) — NOT on points of general law. Presided over by a President (a judge of High Court rank) and at least 4 Khadis/Judges. A panel of at least 3 Judges is required for a decision. Statutory basis: Section 280-283 of the 1999 Constitution + ${j.name} Customary Courts of Appeal Law. Appeals lie to the Court of Appeal. If ${j.name} has not established a CCA, Customary Court appeals go directly to the State High Court.`,
    };
  }
  if (p.includes('sharia court of appeal')) {
    return {
      court: `IN THE SHARIA COURT OF APPEAL, ${j.name.toUpperCase()}`,
      jurisdiction: j.name,
      reasoning: `The prompt references the Sharia Court of Appeal. Using the Sharia Court of Appeal of ${j.name}. The SCA is an intermediate appellate court established per Section 275 of the 1999 Constitution — but only in states that have opted to establish one (currently: Sokoto, Kano, Katsina, Zamfara, Jigawa, Kaduna, Kebbi, Bauchi, Borno, Yobe, Gombe, Adamawa, Taraba, Niger, Kwara, Oyo, Lagos, FCT). The SCA hears appeals from Upper Area Courts / Sharia Courts on ISLAMIC PERSONAL LAW matters ONLY (marriage, divorce, maintenance, custody, guardianship, waqf, wasiyya, inheritance, Islamic gifts) — NOT on points of general law or criminal matters outside Islamic penal jurisdiction. Presided over by a Grand Kadi and at least 4 Khadis. A panel of at least 3 Khadis is required for a decision. Statutory basis: Sections 275-279 of the 1999 Constitution + ${j.name} Sharia Courts of Appeal Law. Appeals lie to the Court of Appeal. If ${j.name} has not established an SCA, Area/Upper Area Court appeals on customary matters go to the State High Court.`,
    };
  }

  // ── 9. SPECIALIZED TRIBUNALS ─────────────────────────────────────────
  if (p.includes('tribunal') || p.includes('tat') || p.includes('ist') || p.includes('ept') || p.includes('cct') || p.includes('acdamt')) {
    // Tax Appeal Tribunal (TAT) — CORRECTED: FHC has constitutional jurisdiction
    //
    // LEGAL CORRECTION (per user feedback):
    // The previous version incorrectly claimed TAT has "exclusive jurisdiction"
    // and that "exhaustion of TAT remedies is jurisdictional." This is legally
    // inaccurate. Under Section 251(1)(a) & (b) of the 1999 Constitution (as
    // amended), the FEDERAL HIGH COURT has EXCLUSIVE original jurisdiction over
    // federal revenue, taxation, customs, and excise matters.
    //
    // The TAT is an ADMINISTRATIVE TRIBUNAL of first instance established by
    // Section 59 of the FIRS (Establishment) Act 2007. It hears FIRS assessment
    // disputes at the administrative level, but it does NOT strip the FHC of
    // its constitutional jurisdiction. The proper characterization:
    //   - TAT = administrative exhaustion step (statutory requirement for FIRS
    //     assessment disputes before approaching the FHC)
    //   - FHC = the competent court of record with constitutional jurisdiction
    //   - Appeals from TAT administrative decisions go to the FHC for judicial
    //     review, NOT to the Court of Appeal
    //
    // So for tax matters, the court caption should be the FHC (the competent
    // forum), with a note that TAT administrative exhaustion may apply.
    if (p.includes('tax appeal tribunal') || p.includes(' tat ') || p.startsWith('tat ') || p.endsWith(' tat')) {
      return {
        court: j.federalHighCourtCaption,
        jurisdiction: j.name,
        reasoning: `The prompt references the Tax Appeal Tribunal (TAT). The TAT is an administrative tribunal established under Section 59 of the FIRS (Establishment) Act 2007 to hear disputes between taxpayers and FIRS at the administrative level. However, under Section 251(1)(a) & (b) of the 1999 Constitution, the FEDERAL HIGH COURT has EXCLUSIVE jurisdiction over federal revenue and taxation matters — the TAT does not displace this constitutional jurisdiction. The TAT serves as an administrative exhaustion step: FIRS assessment disputes are filed at the TAT first (statutory requirement), and its decisions are subject to judicial review by the FHC. The TAT is NOT a court of record.`,
        governingLaw: 'FIRS (Establishment) Act 2007; Companies Income Tax Act; VAT Act; Section 251(1)(a) &(b) 1999 Constitution',
        forum: 'Federal High Court (constitutional jurisdiction); TAT as administrative first-instance body for FIRS assessments',
        filingKey: 'File FIRS assessment disputes at the TAT within 30 days of notice; FHC judicial review available thereafter.',
        warning: 'The TAT is an administrative tribunal, NOT a court of record. The Federal High Court retains exclusive constitutional jurisdiction over federal taxation per Section 251(1)(a). Do not characterize the TAT as having "exclusive jurisdiction" — that is legally inaccurate.',
      };
    }
    // Investment and Securities Tribunal (IST)
    if (p.includes('investment') || p.includes('securities') || p.includes('ist') || p.includes('capital market') || p.includes('sec nigeria') || p.includes('stock exchange') || p.includes('nse')) {
      return {
        court: 'IN THE INVESTMENT AND SECURITIES TRIBUNAL (IST)',
        jurisdiction: 'Federal',
        reasoning: `The prompt references the Investment and Securities Tribunal. The IST was established under Section 274 of the Investments and Securities Act (ISA) 2025 (replacing the ISA 2007 version). The IST has EXCLUSIVE jurisdiction over: (1) capital market disputes (SEC enforcement actions, capital market operator licensing, insider dealing, market manipulation); (2) securities fraud and misrepresentation; (3) disputes between the Securities and Exchange Commission (SEC) and capital market operators; (4) disputes arising from mergers, takeovers, and acquisitions requiring SEC approval; (5) commodity exchange disputes; (6) disputes between the Nigerian Stock Exchange (NGX) and its dealing members; (7) disputes arising from collective investment schemes (mutual funds, ETFs); (8) FinTech and digital asset disputes (per the 2025 amendments). Statutory basis: ISA 2025. Sits in Abuja with a Chairman (legal practitioner of 15+ years) and at least 8 other members. Appeals lie DIRECTLY to the Court of Appeal (NOT to the Federal High Court). The IST can grant injunctions, order specific performance, impose administrative penalties, and award damages. Citation form: IST/NNN/YYYY.`,
      };
    }
    // Election Petition Tribunal (EPT)
    if (p.includes('election') || p.includes('ept') || p.includes('electoral') || p.includes('governorship') || p.includes('presidential election') || p.includes('legislative election')) {
      return {
        court: 'IN THE ELECTION PETITION TRIBUNAL',
        jurisdiction: 'Federal',
        reasoning: `The prompt references an Election Petition Tribunal. EPTs are established under Section 285 of the 1999 Constitution and the Electoral Act 2022 to hear petitions challenging: (1) Presidential election → Presidential Election Petition Tribunal (PEPT) sits in Abuja, 5-member panel of Court of Appeal Justices; (2) Governorship election → Governorship Election Petition Tribunal, 3-member panel of High Court judges; (3) National Assembly (Senate/House of Reps) elections → National Assembly Election Tribunal, 3-member panel of High Court/FHC judges; (4) State Houses of Assembly elections → State Houses of Assembly Election Tribunal, 3-member panel of High Court judges. Statutory basis: Section 285 of the 1999 Constitution + Electoral Act 2022. TIME LIMITS ARE STRICT: petitions must be filed within 21 days of result declaration; tribunals must deliver judgment within 180 days. Appeals lie to the Court of Appeal (which must decide within 60 days), and from the Court of Appeal on PEPT matters, a further appeal lies to the Supreme Court. NO extension of time is permitted under any circumstances. The EPT is NOT a permanent court — it is constituted for each election cycle and dissolved after.\n\n⚠️ JURISDICTIONAL WARNING: Election petitions have STRICT AND UNEXTENDABLE time limits — 21 days to file, 180 days for tribunal judgment, 60 days for Court of Appeal. These limits are constitutional and CANNOT be extended. Missing any deadline is FATAL — the petition will be dismissed. Engage election-petition counsel IMMEDIATELY upon result declaration.`,
      };
    }
    // Code of Conduct Tribunal (CCT)
    if (p.includes('code of conduct') || p.includes('cct') || p.includes('asset declaration')) {
      return {
        court: 'IN THE CODE OF CONDUCT TRIBUNAL',
        jurisdiction: 'Federal',
        reasoning: `The prompt references the Code of Conduct Tribunal. The CCT was established under Section 20 of the Fifth Schedule to the 1999 Constitution to adjudicate allegations of breach of the Code of Conduct for Public Officers (Part I of the Fifth Schedule). Subject-matter jurisdiction: (1) false asset declaration; (2) foreign accounts operated by public officers; (3) operation of foreign accounts; (4) receipt of gifts/benefits in official capacity; (5) conflict of interest; (6) engagement in paid employment outside official duty; (7) membership of secret societies; (8) acceptance of loans from banks/subordinates/contractors above threshold; (9) receipt of bribes. Statutory basis: Paragraph 18-20 of the Fifth Schedule to the 1999 Constitution + Code of Conduct Bureau and Tribunal Act Cap C15 LFN 2004. Sits with a Chairman (legal practitioner of 15+ years, High Court rank) and 2 other members. The CCT can impose: removal from office, vacation of seat, disqualification from public office for up to 10 years, forfeiture of corrupt assets, and (per the 2022 amendment) imprisonment terms for false declaration. Appeals lie DIRECTLY to the Court of Appeal (per Saraki v. FRN (2018) — confirmed by the Supreme Court that there is NO appeal to the FHC).`,
      };
    }
    // Anti-Corruption and Other Related Offences Tribunal (ICPC tribunal — ACDAMT)
    if (p.includes('acdamt') || p.includes('anti-corruption') || p.includes('icpc tribunal')) {
      return {
        court: 'IN THE ANTI-CORRUPTION AND OTHER RELATED OFFENCES TRIBUNAL (ACDAMT)',
        jurisdiction: 'Federal',
        reasoning: `The prompt references the Anti-Corruption and Other Related Offences Tribunal. The ACDAMT is a specialized tribunal proposed under the Corrupt Practices and Other Related Offences Act to handle complex corruption cases referred by the ICPC. Statutory basis: Corrupt Practices and Other Related Offences Act 2000 (as amended). Sits with a Chairman (High Court judge rank) and 2 members. Hears cases of: bribery, graft, embezzlement of public funds, abuse of office, gratification. NOTE: This tribunal is rarely constituted — most ICPC cases are filed directly at the Federal High Court or State High Court under the ICPC Act. Verify whether the specific matter requires ACDAMT or can go directly to FHC. Appeals lie to the Court of Appeal.`,
      };
    }
  }

  // ── 10. MILITARY & SPECIAL COURTS (rare but included for completeness) ──
  if (p.includes('court martial') || p.includes('military court')) {
    return {
      court: 'IN THE GENERAL COURT MARTIAL',
      jurisdiction: 'Federal',
      reasoning: `The prompt references a Court Martial. Court Martial is established under the Armed Forces Act Cap A20 LFN 2004 to try members of the Nigerian Armed Forces for service offences (mutiny, desertion, insubordination, conduct prejudicial to good order, civil offences committed in service context). Types: General Court Martial (most serious offences, presided by a judge advocate + 5+ officers), Summary Court Martial (less serious, 2+ officers), Special Court Martial (intermediate). Statutory basis: Armed Forces Act + Armed Forces Rules of Procedure. The Judge Advocate is a legally-qualified officer; other members are serving officers. NOT a court of record in the civilian sense. Appeals lie to the Court of Appeal (Army Council reviews the sentence first). NOTE: Court Martial jurisdiction is limited to serving military personnel — civilians cannot be tried by Court Martial (per Dorma v. Chief of Army Staff).`,
    };
  }

  // ─── 3-AXIS JURISDICTION DETECTION (Subject Matter → Court) ────────
  // Classify jurisdiction across three axes:
  // 1. Subject Matter: What is the legal substance? (CAMA → FHC, Labor → NIC)
  // 2. Geographical: Where did the cause of action arise? (state/division)
  // 3. Hierarchy: Original vs Appellate jurisdiction
  //
  // This prevents the AI from defaulting to the High Court when the
  // matter actually falls under exclusive federal or specialized
  // jurisdiction (e.g., company formation → FHC under CAMA).

  // Subject Matter → Court mapping
  const subjectMatterRules: { keywords: string[]; court: string; jurisdiction: string; reasoning: string; conflict?: string; governingLaw?: string; forum?: string; filingKey?: string; warning?: string }[] = [
    {
      keywords: ['company', 'cama', 'corporate', 'incorporation', 'shareholder', 'board resolution', 'annual return', 'merger', 'acquisition', 'takeover'],
      court: j.federalHighCourtCaption,
      jurisdiction: j.name,
      reasoning: `Subject matter: Corporate/company law under CAMA 2020. The Federal High Court has exclusive jurisdiction over corporate matters per Section 251(1)(e) of the 1999 Constitution. ${j.name} Division applies based on the firm's default state of practice.`,
      governingLaw: 'Companies and Allied Matters Act (CAMA) 2020; Companies Regulations 2021; Federal High Court (Civil Procedure) Rules 2019',
      forum: 'Federal High Court (exclusive jurisdiction per s.251(1)(e))',
      filingKey: 'File at the FHC Division where the company is registered; use FHC originating process.',
      warning: 'Corporate matters are EXCLUSIVELY within FHC jurisdiction — NOT the State High Court.',
      conflict: `Company formation and corporate disputes fall under the EXCLUSIVE jurisdiction of the Federal High Court under CAMA 2020 — NOT the State High Court. Ensure filing is made at the appropriate FHC Division.`,
    },
    {
      keywords: ['employment', 'labour', 'labor', 'worker', 'employee', 'employer', 'termination', 'dismissal', 'workplace', 'union', 'strike', 'industrial', 'redundancy', 'unfair dismissal', 'wrongful termination'],
      court: 'IN THE NATIONAL INDUSTRIAL COURT OF NIGERIA',
      jurisdiction: 'Federal',
      reasoning: `Subject matter: Employment/labour law. The National Industrial Court (NICN) has EXCLUSIVE jurisdiction over employment, labour, and industrial matters per Section 254C of the 1999 Constitution (as amended). This overrides any state-level court jurisdiction.`,
      governingLaw: 'Section 254C 1999 Constitution (3rd Alteration); Labour Act; Trade Disputes Act; NICN (Civil Procedure) Rules 2017',
      forum: 'National Industrial Court of Nigeria (exclusive jurisdiction)',
      filingKey: 'File NICN originating process; appeals go directly to the Court of Appeal.',
      warning: 'Employment matters MUST be filed at NICN — NOT the FHC or State High Court. Even if the employer is a company, employment disputes are severed from CAMA matters.',
      conflict: `Employment and labour matters MUST be filed at the National Industrial Court — NOT the Federal High Court or State High Court. Even if the employer is a company (CAMA matter), employment disputes are severed and filed separately at NICN.`,
    },
    {
      keywords: ['revenue', 'taxation', 'customs', 'excise', 'federal revenue', 'vat', 'company income tax', 'personal income tax', 'withholding tax', 'firs', 'tax dispute', 'tax assessment'],
      court: j.federalHighCourtCaption,
      jurisdiction: j.name,
      reasoning: `Subject matter: Federal revenue/taxation. The Federal High Court has EXCLUSIVE jurisdiction over revenue and taxation matters per Section 251(1)(a) & (b) of the 1999 Constitution (as amended). The Tax Appeal Tribunal (TAT) is an administrative tribunal of first instance for FIRS assessment disputes — it does NOT displace the FHC's constitutional jurisdiction. FIRS assessment disputes should be filed at the TAT first (statutory exhaustion), with FHC judicial review available thereafter.`,
      governingLaw: 'Section 251(1)(a) &(b) 1999 Constitution; FIRS (Establishment) Act 2007; Companies Income Tax Act; VAT Act; Federal High Court (Civil Procedure) Rules 2019',
      forum: 'Federal High Court (exclusive constitutional jurisdiction)',
      filingKey: 'FIRS assessment disputes: file at TAT within 30 days, then FHC judicial review. Pure revenue claims: file directly at FHC.',
      warning: 'The TAT is an administrative exhaustion step, NOT a court of record. The FHC retains exclusive constitutional jurisdiction over federal taxation.',
    },
    {
      keywords: ['immigration', 'deportation', 'visa', 'passport', 'citizenship', 'naturalization', 'expulsion'],
      court: j.federalHighCourtCaption,
      jurisdiction: j.name,
      reasoning: `Subject matter: Immigration. The Federal High Court has exclusive jurisdiction over immigration and citizenship matters per Section 251(1)(b) of the 1999 Constitution.`,
    },
    {
      keywords: ['maritime', 'admiralty', 'shipping', 'sea', 'port', 'ocean', 'cargo', 'bill of lading', 'marine'],
      court: j.federalHighCourtCaption,
      jurisdiction: j.name,
      reasoning: `Subject matter: Maritime/admiralty. The Federal High Court has exclusive jurisdiction over maritime matters per Section 251(1)(g) of the 1999 Constitution and the Admiralty Jurisdiction Act.`,
    },
    {
      keywords: ['intellectual property', 'copyright', 'trademark', 'patent', 'industrial design', 'trade secret', 'unfair competition'],
      court: j.federalHighCourtCaption,
      jurisdiction: j.name,
      reasoning: `Subject matter: Intellectual property. The Federal High Court has exclusive jurisdiction over IP matters per Section 251(1)(f) of the 1999 Constitution. This includes copyright (Copyright Act), trademarks (Trademarks Act), and patents (Patents and Designs Act).`,
    },
    {
      keywords: ['banking', 'banks', 'central bank', 'cbn', 'ndic', 'bofia', 'financial institution'],
      court: j.federalHighCourtCaption,
      jurisdiction: j.name,
      reasoning: `Subject matter: Banking and financial institutions. The Federal High Court has jurisdiction over banking matters per Section 251(1)(d) of the 1999 Constitution and BOFIA 2020. This includes disputes between banks and customers where the CBN or NDIC is involved.`,
    },
    {
      keywords: ['land', 'tenancy', 'lease', 'property', 'landlord', 'tenant', 'rent', 'premises', 'eviction', 'recovery of premises', 'certificate of occupancy', 'right of occupancy'],
      court: j.highCourtCaption + ' IN THE ' + j.defaultDivision.toUpperCase() + ' JUDICIAL DIVISION',
      jurisdiction: j.name,
      reasoning: `Subject matter: Land/property law. State High Courts have jurisdiction over land matters per Section 272 of the 1999 Constitution. ${j.name} ${j.defaultDivision} Judicial Division applies. For low-value landlord-tenant recovery (rent ≤ threshold set by state law, typically ₦50,000/year in Lagos), consider the Magistrate Court. For customary land disputes, consider the Customary Court.`,
    },
    {
      keywords: ['divorce', 'matrimonial', 'custody', 'maintenance', 'spouse', 'marriage', 'matrimonial causes', 'judicial separation', 'nullity'],
      court: j.highCourtCaption + ' IN THE ' + j.defaultDivision.toUpperCase() + ' JUDICIAL DIVISION',
      jurisdiction: j.name,
      reasoning: `Subject matter: Matrimonial/family law (statutory marriage). The State High Court has jurisdiction over divorce and matrimonial causes under the Matrimonial Causes Act. ${j.name} ${j.defaultDivision} Judicial Division applies. Note: customary marriage dissolution is handled by the Customary Court; Islamic marriage dissolution by the Sharia/Area Court.`,
      conflict: `Jurisdiction depends on the TYPE of marriage: statutory marriages → State High Court (Matrimonial Causes Act); customary marriages → Customary Court; Islamic marriages → Sharia/Area Court. Verify the marriage type before filing.`,
    },
    {
      keywords: ['probate', 'estate', 'will', 'testament', 'executor', 'administrator', 'letter of administration', 'inheritance', 'succession'],
      court: j.highCourtCaption + ' IN THE ' + j.defaultDivision.toUpperCase() + ' JUDICIAL DIVISION',
      jurisdiction: j.name,
      reasoning: `Subject matter: Probate/succession. The State High Court has jurisdiction over probate matters (wills, letters of administration, estate administration) per Section 272 of the 1999 Constitution. ${j.name} ${j.defaultDivision} Judicial Division applies. Note: customary inheritance disputes go to the Customary Court; Islamic inheritance to the Sharia/Area Court.`,
    },
    {
      keywords: ['criminal', 'offence', 'felony', 'misdemeanor', 'charge', 'defendant', 'prosecution', 'bail', 'trial'],
      court: j.highCourtCaption + ' IN THE ' + j.defaultDivision.toUpperCase() + ' JUDICIAL DIVISION',
      jurisdiction: j.name,
      reasoning: `Subject matter: Criminal law. The State High Court has original jurisdiction over felonies and serious misdemeanors per Section 272 of the 1999 Constitution. ${j.name} ${j.defaultDivision} Judicial Division applies. Minor offences (simple misdemeanors, summary offences) may be handled by the Magistrate Court. Federal offences (cybercrime, terrorism, drug trafficking) go to the Federal High Court.`,
      conflict: `Criminal jurisdiction depends on the offence classification: felonies → State High Court; misdemeanors → Magistrate Court (limited by maximum sentence); federal offences (terrorism, cybercrime, NDLEA, EFCC) → Federal High Court. Verify the specific offence and its classification before filing.`,
    },
    {
      keywords: ['human rights', 'fundamental rights', 'enforcement of rights', 'freedom', 'section 46', 'section 34', 'section 35', 'section 36', 'section 40', 'section 41', 'section 42'],
      court: j.highCourtCaption + ' IN THE ' + j.defaultDivision.toUpperCase() + ' JUDICIAL DIVISION',
      jurisdiction: j.name,
      reasoning: `Subject matter: Fundamental Rights Enforcement. Per Section 46 of the 1999 Constitution, the High Court (State or Federal) has jurisdiction to enforce fundamental rights. ${j.name} ${j.defaultDivision} Judicial Division applies. The Federal High Court also has concurrent jurisdiction. Filing is done via the Fundamental Rights (Enforcement Procedure) Rules 2009.`,
    },
    {
      keywords: ['appeal', 'appellate', 'upper court'],
      court: 'COURT OF APPEAL OF NIGERIA',
      jurisdiction: 'Federal',
      reasoning: `Hierarchy: Appellate jurisdiction. The Court of Appeal hears appeals from: Federal High Court, State High Courts, National Industrial Court, Customary Courts of Appeal, Sharia Courts of Appeal, Election Petition Tribunals, Code of Conduct Tribunal, and Investment and Securities Tribunal. Appeals lie to the Supreme Court.`,
    },
    {
      keywords: ['small claims', 'minor debt', 'small debt'],
      court: j.magistrateCourtCaption.replace('{DIVISION}', j.defaultDivision),
      jurisdiction: j.name,
      reasoning: `Subject matter: Small claims/minor debts. The Magistrate Court has jurisdiction over minor civil claims up to the monetary limit set by state law (varies by state — e.g., ₦50,000 in some states, ₦100,000 in others). ${j.defaultDivision} Division applies. Some states have dedicated Small Claims Courts with simplified procedures for claims under ₦5,000,000 (e.g., Lagos Small Claims Court).`,
    },
  ];

  // Check subject matter rules
  for (const rule of subjectMatterRules) {
    if (rule.keywords.some(kw => p.includes(kw))) {
      return {
        court: rule.court,
        jurisdiction: rule.jurisdiction,
        reasoning: rule.conflict
          ? `${rule.reasoning}\n\n⚠️ JURISDICTIONAL WARNING: ${rule.conflict}`
          : rule.reasoning,
        // Pass through explicitly-set 3-pillar fields (if the rule defines them)
        governingLaw: (rule as any).governingLaw,
        forum: (rule as any).forum,
        filingKey: (rule as any).filingKey,
        warning: (rule as any).warning || (rule.conflict ? rule.conflict : undefined),
      };
    }
  }

  // Default: High Court of the firm's state (Nigerian only)
  return {
    court: `${j.highCourtCaption} IN THE ${j.defaultDivision.toUpperCase()} JUDICIAL DIVISION`,
    jurisdiction: j.name,
    reasoning: `No explicit court or subject matter specified. Defaulting to the High Court of ${j.name} (${j.defaultDivision} Judicial Division) per the firm's Default State of Practice setting. Citing ${j.highCourtRules}. If this matter involves corporate (CAMA), employment, tax, banking, IP, immigration, or maritime issues, the Federal High Court or NICN may have exclusive jurisdiction — verify before filing. For minor civil claims, consider the Magistrate Court. For customary matters, consider the Customary or Area Court.`,
  };
}

/**
 * Enrich a jurisdictional analysis result with the 3-pillar fields
 * (governingLaw, forum, filingKey, warning) if they're not explicitly set.
 *
 * This derives the fields from the court caption and reasoning text using
 * pattern matching. When a specific return path sets the fields explicitly
 * (e.g., the TAT, revenue, or employment rules), those take precedence.
 */
function enrichJurisdictionAnalysis(result: Omit<JurisdictionAnalysis, 'governingLaw' | 'forum' | 'filingKey'> & {
  governingLaw?: string;
  forum?: string;
  filingKey?: string;
  warning?: string;
}): JurisdictionAnalysis {
  // If all 3-pillar fields are already set, return as-is (cast to full type)
  if (result.governingLaw && result.forum && result.filingKey) {
    return result as JurisdictionAnalysis;
  }

  const court = (result.court || '').toLowerCase();
  const reasoning = (result.reasoning || '').toLowerCase();
  const stateKey = result.jurisdiction || '';
  const j = getJurisdiction(stateKey);

  // ─── Derive forum and governingLaw from the court caption ────────
  let forum = result.forum || '';
  let governingLaw = result.governingLaw || '';
  let filingKey = result.filingKey || '';

  if (!forum) {
    if (court.includes('supreme court')) {
      forum = 'Supreme Court of Nigeria';
      governingLaw = 'Supreme Court Rules 2024; Section 235 1999 Constitution';
      filingKey = 'File Notice of Appeal within 90 days of Court of Appeal decision.';
    } else if (court.includes('court of appeal')) {
      forum = 'Court of Appeal';
      governingLaw = 'Court of Appeal Rules 2021; Section 237 1999 Constitution';
      filingKey = 'File Notice of Appeal within 90 days of the lower court decision.';
    } else if (court.includes('federal high court')) {
      forum = 'Federal High Court';
      governingLaw = 'Federal High Court (Civil Procedure) Rules 2019; Section 251 1999 Constitution';
      filingKey = 'File at the appropriate FHC Division; use FHC originating process forms.';
    } else if (court.includes('national industrial court') || court.includes('nicn')) {
      forum = 'National Industrial Court of Nigeria';
      governingLaw = 'NICN (Civil Procedure) Rules 2017; Section 254C 1999 Constitution';
      filingKey = 'File NICN originating process; employment matters are exclusive to NICN.';
    } else if (court.includes('chief magistrate')) {
      forum = 'Chief Magistrate Court';
      governingLaw = `${j.name} Magistrates' Court Law; ${j.magistrateRules}`;
      filingKey = 'File at the Magistrate Court with jurisdiction over the subject matter.';
    } else if (court.includes('senior magistrate')) {
      forum = 'Senior Magistrate Court';
      governingLaw = `${j.name} Magistrates' Court Law; ${j.magistrateRules}`;
      filingKey = 'File at the Magistrate Court within the monetary jurisdiction limit.';
    } else if (court.includes('magistrate')) {
      forum = 'Magistrate Court';
      governingLaw = `${j.name} Magistrates' Court Law; ${j.magistrateRules}`;
      filingKey = 'File at the Magistrate Court within the monetary jurisdiction limit.';
    } else if (court.includes('district court')) {
      forum = 'District Court';
      governingLaw = `${j.name} District Court Law`;
      filingKey = 'File at the District Court for small claims within the monetary limit.';
    } else if (court.includes('small claims')) {
      forum = 'Small Claims Court';
      governingLaw = `${j.name} Small Claims Court Practice Direction`;
      filingKey = 'File simplified claim form; hearing within 14 days; judgment same day.';
    } else if (court.includes('customary court of appeal')) {
      forum = 'Customary Court of Appeal';
      governingLaw = `Section 280 1999 Constitution; ${j.name} Customary Courts of Appeal Law`;
      filingKey = 'File appeal from Customary Court on customary law matters only.';
    } else if (court.includes('customary court')) {
      forum = 'Customary Court';
      governingLaw = `${j.name} Customary Court Law`;
      filingKey = 'File customary land/inheritance/marriage disputes at the Customary Court.';
    } else if (court.includes('sharia court of appeal')) {
      forum = 'Sharia Court of Appeal';
      governingLaw = `Section 275 1999 Constitution; ${j.name} Sharia Courts of Appeal Law`;
      filingKey = 'File appeal from Upper Area Court on Islamic personal law matters.';
    } else if (court.includes('upper area court')) {
      forum = 'Upper Area Court';
      governingLaw = `${j.name} Area Courts Law`;
      filingKey = 'File appeal from Area Court; original jurisdiction for serious Islamic matters.';
    } else if (court.includes('area court')) {
      forum = 'Area Court';
      governingLaw = `${j.name} Area Courts Law`;
      filingKey = 'File Islamic personal law and minor civil matters at the Area Court.';
    } else if (court.includes('high court')) {
      forum = `High Court of ${j.name}`;
      governingLaw = j.highCourtRules + '; Section 272 1999 Constitution';
      filingKey = `File at the ${j.defaultDivision} Judicial Division; use High Court originating process.`;
    } else if (court.includes('investment and securities tribunal')) {
      forum = 'Investment and Securities Tribunal (IST)';
      governingLaw = 'Investments and Securities Act (ISA) 2025';
      filingKey = 'File capital market/securities disputes at the IST; appeals to Court of Appeal.';
    } else if (court.includes('election petition tribunal')) {
      forum = 'Election Petition Tribunal';
      governingLaw = 'Section 285 1999 Constitution; Electoral Act 2022';
      filingKey = 'File within 21 days of result declaration; strict unextendable deadlines.';
    } else if (court.includes('code of conduct tribunal')) {
      forum = 'Code of Conduct Tribunal';
      governingLaw = 'Paragraph 18-20, Fifth Schedule, 1999 Constitution; CCB & Tribunal Act';
      filingKey = 'File asset declaration breach cases; appeals to Court of Appeal.';
    } else if (court.includes('court martial')) {
      forum = 'General Court Martial';
      governingLaw = 'Armed Forces Act Cap A20 LFN 2004';
      filingKey = 'Court Martial has jurisdiction over serving military personnel only.';
    } else if (court.includes('jurisdiction')) {
      // Foreign jurisdiction
      forum = result.jurisdiction || 'Foreign Jurisdiction';
      governingLaw = 'Verify applicable law with local counsel in ' + (result.jurisdiction || 'the relevant jurisdiction');
      filingKey = 'Consult local counsel for jurisdiction-specific filing requirements.';
    } else {
      forum = `High Court of ${j.name}`;
      governingLaw = j.highCourtRules;
      filingKey = `File at the ${j.defaultDivision} Judicial Division.`;
    }
  }

  // ─── Derive warning from reasoning text (if not explicitly set) ──
  let warning = result.warning;
  if (!warning) {
    // Check for common jurisdictional risks in the reasoning text
    if (reasoning.includes('jurisdictional warning') || reasoning.includes('⚠️')) {
      // Extract the warning text after the marker
      const match = result.reasoning.match(/⚠️\s*JURISDICTIONAL WARNING:\s*([\s\S]+?)(?:\n\n|$)/);
      if (match) {
        warning = match[1].trim();
      }
    }
  }

  return {
    ...result,
    forum: forum || result.forum || result.court,
    governingLaw: governingLaw || result.governingLaw || 'Verify applicable statutes with counsel.',
    filingKey: filingKey || result.filingKey || 'Consult procedural rules for filing requirements.',
    warning,
  };
}
