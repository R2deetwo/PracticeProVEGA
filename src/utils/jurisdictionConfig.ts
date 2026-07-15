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
  // Detect explicit court overrides FIRST (user names the court)
  if (p.includes('federal high court') || p.includes('fhc')) {
    return {
      court: j.federalHighCourtCaption,
      jurisdiction: j.name,
      reasoning: `The prompt references the Federal High Court. Using ${j.federalHighCourtCaption} — federal matters (revenue, immigration, maritime, IP, corporate) fall under federal jurisdiction per Section 251 of the 1999 Constitution.`,
    };
  }
  if (p.includes('magistrate') || p.includes('district court')) {
    return {
      court: j.magistrateCourtCaption.replace('{DIVISION}', j.defaultDivision),
      jurisdiction: j.name,
      reasoning: `The prompt references the Magistrate Court. Using ${j.magistrateCourtCaption.replace('{DIVISION}', j.defaultDivision)} — a lower court of record with limited civil and criminal jurisdiction. Typically handles landlord-tenant recovery (where rent ≤ ₦50,000/year in most states), minor assaults, simple contract debts, and summary trials. Appeals lie to the State High Court.`,
    };
  }
  if (p.includes('customary court')) {
    return {
      court: `IN THE CUSTOMARY COURT OF ${j.name.toUpperCase()}`,
      jurisdiction: j.name,
      reasoning: `The prompt references the Customary Court. Using the Customary Court of ${j.name} — a lower court of record handling customary land disputes, inheritance under native law and custom, customary marriage/divorce, and minor civil claims governed by customary law. Appeals lie to the Customary Court of Appeal (where established) or the State High Court.`,
    };
  }
  if (p.includes('area court') || p.includes('sharia court')) {
    return {
      court: `IN THE AREA COURT OF ${j.name.toUpperCase()}`,
      jurisdiction: j.name,
      reasoning: `The prompt references the Area/Sharia Court. Using the Area Court of ${j.name} — a lower court of record in Northern Nigeria with jurisdiction over Islamic personal law matters (marriage, inheritance, waqf), minor civil claims under native law, and summary offences. Appeals lie to the Upper Area Court, then to the Sharia Court of Appeal (where established).`,
    };
  }
  if (p.includes('upper area court')) {
    return {
      court: `IN THE UPPER AREA COURT OF ${j.name.toUpperCase()}`,
      jurisdiction: j.name,
      reasoning: `The prompt references the Upper Area Court. Using the Upper Area Court of ${j.name} — an appellate court over Area Courts in Northern Nigeria. Hears appeals from Area Courts and has original jurisdiction in more serious Islamic law matters. Appeals lie to the Sharia Court of Appeal.`,
    };
  }
  if (p.includes('customary court of appeal')) {
    return {
      court: `IN THE CUSTOMARY COURT OF APPEAL, ${j.name.toUpperCase()}`,
      jurisdiction: j.name,
      reasoning: `The prompt references the Customary Court of Appeal. Using the Customary Court of Appeal of ${j.name} — an intermediate appellate court hearing appeals from Customary Courts on customary law matters (land, inheritance, marriage). Established per Section 280 of the 1999 Constitution. Appeals lie to the Court of Appeal.`,
    };
  }
  if (p.includes('sharia court of appeal')) {
    return {
      court: `IN THE SHARIA COURT OF APPEAL, ${j.name.toUpperCase()}`,
      jurisdiction: j.name,
      reasoning: `The prompt references the Sharia Court of Appeal. Using the Sharia Court of Appeal of ${j.name} — an intermediate appellate court hearing appeals from Upper Area Courts on Islamic personal law matters (marriage, inheritance, waqf, guardianship). Established per Section 275 of the 1999 Constitution. Appeals lie to the Court of Appeal.`,
    };
  }
  if (p.includes('national industrial court') || p.includes('nic') || p.includes('nicn')) {
    return {
      court: 'IN THE NATIONAL INDUSTRIAL COURT OF NIGERIA',
      jurisdiction: 'Federal',
      reasoning: `The prompt references the National Industrial Court. Using NICN — has EXCLUSIVE jurisdiction over employment, labour, and industrial matters per Section 254C of the 1999 Constitution. NICN also has powers to grant injunctions and equitable relief in trade disputes. Appeals lie directly to the Court of Appeal.`,
    };
  }
  if (p.includes('court of appeal') || p.includes('appellate court')) {
    return {
      court: 'COURT OF APPEAL OF NIGERIA',
      jurisdiction: 'Federal',
      reasoning: `The prompt references the Court of Appeal. The Court of Appeal is the intermediate appellate court — hears appeals from the Federal High Court, State High Courts, National Industrial Court, Customary Courts of Appeal, and Sharia Courts of Appeal. Established per Section 237 of the 1999 Constitution. Appeals lie to the Supreme Court.`,
    };
  }
  if (p.includes('supreme court')) {
    return {
      court: 'SUPREME COURT OF NIGERIA',
      jurisdiction: 'Federal',
      reasoning: `The prompt references the Supreme Court. The Supreme Court is the highest court in Nigeria — hears appeals from the Court of Appeal. Has original jurisdiction in disputes between the Federation and States, and between States (Section 232 of the 1999 Constitution). Its decisions are binding on all lower courts.`,
    };
  }
  if (p.includes('tribunal')) {
    // Generic tribunal detection — tax, investment, election, etc.
    if (p.includes('tax') || p.includes('firsc') || p.includes('tid')) {
      return {
        court: 'FEDERAL INLAND REVENUE SERVICE TRIBUNAL / TAX APPEAL COMMISSION',
        jurisdiction: 'Federal',
        reasoning: `The prompt references a tax tribunal. Tax disputes in Nigeria may go to the Tax Appeal Tribunal (TAT) established by FIRS, or to the Federal High Court. The TAT hears disputes on assessments, penalties, and FIRS enforcement. Appeals from the TAT lie to the Federal High Court.`,
      };
    }
    if (p.includes('election') || p.includes('ept')) {
      return {
        court: 'ELECTION PETITION TRIBUNAL',
        jurisdiction: 'Federal',
        reasoning: `The prompt references an Election Petition Tribunal. EPTs are established under the Electoral Act to hear petitions challenging elections to the Presidency, National Assembly, Governorship, and State Houses of Assembly. Appeals lie to the Court of Appeal.`,
      };
    }
    if (p.includes('investment') || p.includes('sec') || p.includes('securities')) {
      return {
        court: 'INVESTMENT AND SECURITIES TRIBUNAL (IST)',
        jurisdiction: 'Federal',
        reasoning: `The prompt references the Investment and Securities Tribunal. The IST has exclusive jurisdiction over capital market, securities, and investment disputes per the Investments and Securities Act (ISA) 2025. Appeals lie to the Court of Appeal.`,
      };
    }
  }
  if (p.includes('code of conduct') || p.includes('cct')) {
    return {
      court: 'CODE OF CONDUCT TRIBUNAL',
      jurisdiction: 'Federal',
      reasoning: `The prompt references the Code of Conduct Tribunal. The CCT hears cases of breach of the Code of Conduct for Public Officers (asset declaration, conflict of interest, foreign accounts, etc.) per the Fifth Schedule of the 1999 Constitution. Appeals lie to the Court of Appeal.`,
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
  const subjectMatterRules: { keywords: string[]; court: string; jurisdiction: string; reasoning: string; conflict?: string }[] = [
    {
      keywords: ['company', 'cama', 'corporate', 'incorporation', 'shareholder', 'board resolution', 'annual return', 'merger', 'acquisition', 'takeover'],
      court: j.federalHighCourtCaption,
      jurisdiction: j.name,
      reasoning: `Subject matter: Corporate/company law under CAMA 2020. The Federal High Court has exclusive jurisdiction over corporate matters per Section 251(1)(e) of the 1999 Constitution. ${j.name} Division applies based on the firm's default state of practice.`,
      conflict: `Company formation and corporate disputes fall under the EXCLUSIVE jurisdiction of the Federal High Court under CAMA 2020 — NOT the State High Court. Ensure filing is made at the appropriate FHC Division.`,
    },
    {
      keywords: ['employment', 'labour', 'labor', 'worker', 'employee', 'employer', 'termination', 'dismissal', 'workplace', 'union', 'strike', 'industrial', 'redundancy', 'unfair dismissal', 'wrongful termination'],
      court: 'IN THE NATIONAL INDUSTRIAL COURT OF NIGERIA',
      jurisdiction: 'Federal',
      reasoning: `Subject matter: Employment/labour law. The National Industrial Court (NICN) has EXCLUSIVE jurisdiction over employment, labour, and industrial matters per Section 254C of the 1999 Constitution (as amended). This overrides any state-level court jurisdiction.`,
      conflict: `Employment and labour matters MUST be filed at the National Industrial Court — NOT the Federal High Court or State High Court. Even if the employer is a company (CAMA matter), employment disputes are severed and filed separately at NICN.`,
    },
    {
      keywords: ['revenue', 'taxation', 'customs', 'excise', 'federal revenue', 'vat', 'company income tax', 'personal income tax', 'withholding tax', 'firs'],
      court: j.federalHighCourtCaption,
      jurisdiction: j.name,
      reasoning: `Subject matter: Federal revenue/taxation. The Federal High Court has exclusive jurisdiction over revenue matters per Section 251(1)(a) of the 1999 Constitution. Note: Tax Appeal Tribunal (TAT) may have first-instance jurisdiction for FIRS assessments — check if the matter requires TAT exhaustion before FHC filing.`,
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
