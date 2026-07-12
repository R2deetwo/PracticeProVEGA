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
export function buildJurisdictionalReasoning(
  prompt: string,
  stateKey?: string | null
): { court: string; reasoning: string; jurisdiction: string } {
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
        // State abbreviations with word boundaries (matched via regex below)
      ], name: 'United States' },
    { keywords: [
        'united kingdom', 'uk ', 'u.k.', 'england', 'london', 'british',
        'wales', 'scotland', 'manchester', 'birmingham', 'liverpool', 'leeds',
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
        'australia', 'australian', 'sydney', 'melbourne', 'brisbane',
        'perth', 'adelaide', 'canberra', 'queensland', 'victoria',
        'new south wales', 'nsw',
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

  // Also check US state abbreviations as whole words (e.g. "CA", "NY", "TX")
  // to catch "San Francisco, CA" without matching "ca" inside other words.
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

  // ── NIGERIAN COURT DETECTION (only for Nigerian matters) ──
  // Detect explicit court overrides
  if (p.includes('federal high court') || p.includes('fhc')) {
    return {
      court: j.federalHighCourtCaption,
      jurisdiction: j.name,
      reasoning: `The prompt references the Federal High Court. Using ${j.federalHighCourtCaption} — federal matters (revenue, immigration, maritime, IP) fall under federal jurisdiction per Section 251 of the 1999 Constitution.`,
    };
  }
  if (p.includes('magistrate')) {
    return {
      court: j.magistrateCourtCaption.replace('{DIVISION}', j.defaultDivision),
      jurisdiction: j.name,
      reasoning: `The prompt references the Magistrate Court. Using ${j.magistrateCourtCaption.replace('{DIVISION}', j.defaultDivision)} — typically for landlord-tenant recovery and low-value civil claims.`,
    };
  }
  if (p.includes('customary court')) {
    return {
      court: `IN THE CUSTOMARY COURT OF ${j.name.toUpperCase()}`,
      jurisdiction: j.name,
      reasoning: `The prompt references the Customary Court. Using the Customary Court of ${j.name} — handles customary land disputes, inheritance, and family matters under native law and custom.`,
    };
  }
  if (p.includes('national industrial court') || p.includes('nic')) {
    return {
      court: 'IN THE NATIONAL INDUSTRIAL COURT OF NIGERIA',
      jurisdiction: 'Federal',
      reasoning: `The prompt references the National Industrial Court. Using NICN — has exclusive jurisdiction over employment, labour, and industrial matters per Section 254C of the 1999 Constitution.`,
    };
  }

  // Default: High Court of the firm's state (Nigerian only)
  return {
    court: `${j.highCourtCaption} IN THE ${j.defaultDivision.toUpperCase()} JUDICIAL DIVISION`,
    jurisdiction: j.name,
    reasoning: `No explicit court specified. Defaulting to the High Court of ${j.name} (${j.defaultDivision} Judicial Division) per the firm's Default State of Practice setting. Citing ${j.highCourtRules}.`,
  };
}
