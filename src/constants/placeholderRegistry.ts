export type PlaceholderCategory = 'parties' | 'dates' | 'financial' | 'location' | 'court' | 'firm' | 'freetext';

export interface PlaceholderDef {
  label: string;
  category: PlaceholderCategory;
  dataPath: string | null;
  /** Human-readable description shown as a hover tooltip in the fill modal */
  description?: string;
}

export const PLACEHOLDER_REGISTRY: PlaceholderDef[] = [
  // PARTIES
  { label: '[CLIENT NAME]', category: 'parties', dataPath: 'matter.clientName', description: 'The full legal name of the client you are representing in this matter.' },
  { label: '[OPPOSING PARTY NAME]', category: 'parties', dataPath: 'matter.opposingPartyName', description: 'The name of the adverse party — the person or entity on the other side of the dispute.' },
  { label: '[OPPOSING COUNSEL]', category: 'parties', dataPath: 'matter.opposingCounsel', description: 'The name of the lawyer representing the opposing party.' },
  { label: '[TENANT NAME]', category: 'parties', dataPath: 'tenancy.tenantName', description: 'The full name of the tenant occupying the property.' },
  { label: '[LANDLORD NAME]', category: 'parties', dataPath: 'property.landlordName', description: 'The full name of the property owner / landlord.' },
  { label: '[GUARANTOR NAME]', category: 'parties', dataPath: 'tenancy.guarantorName', description: 'The person who guarantees the tenant’s obligations under the tenancy.' },
  { label: '[DEPONENT NAME]', category: 'parties', dataPath: null, description: 'The person swearing to or affirming the affidavit — usually the client or a witness with direct knowledge.' },
  { label: '[JUDGE NAME]', category: 'parties', dataPath: null, description: 'The name of the presiding judge hearing the matter.' },
  { label: '[WITNESS NAME]', category: 'parties', dataPath: null, description: 'The name of a witness providing testimony in the proceedings.' },
  { label: '[OATH COMMISSIONER]', category: 'parties', dataPath: null, description: 'The Commissioner for Oaths who administers the sworn declaration.' },
  { label: '[CLAIMANT NAME]', category: 'parties', dataPath: 'matter.clientName', description: 'The party bringing the claim — synonymous with plaintiff in civil matters.' },
  { label: '[DEFENDANT NAME]', category: 'parties', dataPath: 'matter.opposingPartyName', description: 'The party against whom the claim is brought.' },
  // DATES
  { label: "[TODAY'S DATE]", category: 'dates', dataPath: 'system.currentDate', description: 'Today’s date — the date the document is being signed or executed.' },
  { label: '[LEASE START DATE]', category: 'dates', dataPath: 'tenancy.startDate', description: 'The date the tenancy or lease begins.' },
  { label: '[LEASE END DATE]', category: 'dates', dataPath: 'tenancy.endDate', description: 'The date the tenancy or lease expires.' },
  { label: '[RENT DUE DATE]', category: 'dates', dataPath: 'tenancy.rentDueDate', description: 'The day of the month by which rent must be paid.' },
  { label: '[HEARING DATE]', category: 'dates', dataPath: 'matter.nextHearingDate', description: 'The date of the next court hearing or appearance.' },
  { label: '[DEADLINE DATE]', category: 'dates', dataPath: 'matter.deadlineDate', description: 'The final date by which an action must be taken (filing, response, etc.).' },
  { label: '[NOTICE DATE]', category: 'dates', dataPath: 'system.currentDate', description: 'The date the notice is being issued.' },
  { label: '[DATE OF BIRTH]', category: 'dates', dataPath: null, description: 'The birth date of the relevant party — used for identification.' },
  // FINANCIAL
  { label: '[RENT AMOUNT]', category: 'financial', dataPath: 'tenancy.rentAmount', description: 'The periodic rent payable (e.g. annual, monthly). Include the currency and period.' },
  { label: '[SERVICE CHARGE]', category: 'financial', dataPath: 'tenancy.serviceCharge', description: 'The charge for maintenance and shared facilities (electricity, water, security, etc.).' },
  { label: '[SECURITY DEPOSIT]', category: 'financial', dataPath: 'tenancy.securityDeposit', description: 'The refundable deposit held against damage or default.' },
  { label: '[CAUTION FEE]', category: 'financial', dataPath: 'tenancy.cautionFee', description: 'A fee (often distinct from the deposit) held as security against breach.' },
  { label: '[AGENCY FEE]', category: 'financial', dataPath: 'tenancy.agencyFee', description: 'The fee payable to the letting agent for arranging the tenancy.' },
  { label: '[PENALTY RATE]', category: 'financial', dataPath: 'tenancy.penaltyRate', description: 'The late-payment penalty (often a percentage of the outstanding amount).' },
  { label: '[LEGAL FEES]', category: 'financial', dataPath: 'matter.legalFees', description: 'The professional fees charged for legal services on this matter.' },
  { label: '[CLAIM AMOUNT]', category: 'financial', dataPath: 'matter.claimAmount', description: 'The monetary value of the claim being sought in the action.' },
  // LOCATION
  { label: '[PROPERTY ADDRESS]', category: 'location', dataPath: 'property.address', description: 'The full physical address of the property (plot, street, area, city, state).' },
  { label: '[CLIENT ADDRESS]', category: 'location', dataPath: 'matter.clientAddress', description: 'The residential or business address of the client.' },
  { label: '[REGISTERED OFFICE ADDRESS]', category: 'location', dataPath: 'matter.opposingPartyAddress', description: 'The registered office address of a corporate party.' },
  { label: '[COURT ADDRESS]', category: 'location', dataPath: null, description: 'The physical address of the court where the matter is filed.' },
  // COURT
  { label: '[COURT NAME]', category: 'court', dataPath: 'matter.courtName', description: 'The full name of the court (e.g. High Court of Lagos State, Federal High Court).' },
  { label: '[SUIT NUMBER]', category: 'court', dataPath: 'matter.suitNumber', description: 'The unique case number assigned by the court registry (e.g. FHC/L/CS/123/2024).' },
  { label: '[MATTER TITLE]', category: 'court', dataPath: 'matter.title', description: 'The short title of the matter (e.g. John Doe v. ABC Ltd).' },
  { label: '[JURISDICTION]', category: 'court', dataPath: null, description: 'The court’s jurisdiction (e.g. Lagos State, Federal Capital Territory).' },
  { label: '[CAUSE OF ACTION]', category: 'court', dataPath: null, description: 'The legal basis of the claim (e.g. breach of contract, negligence, trespass).' },
  { label: '[RELIEF SOUGHT]', category: 'court', dataPath: null, description: 'The specific remedy being asked for (damages, injunction, declaration, etc.).' },
  { label: '[EXHIBIT REFERENCE]', category: 'court', dataPath: null, description: 'The label for an exhibit attached to the affidavit (e.g. Exhibit A, Exhibit 1).' },
  { label: '[ORDER AND RULE]', category: 'court', dataPath: null, description: 'The specific order and rule under which the application is brought.' },
  { label: '[GROUNDS OF APPLICATION]', category: 'court', dataPath: null, description: 'The legal grounds supporting the application.' },
  { label: '[COURT TIER]', category: 'court', dataPath: 'matter.courtTier', description: 'The tier of court (High Court, Magistrate Court, Federal High Court, etc.).' },
  // FIRM
  { label: '[FIRM NAME]', category: 'firm', dataPath: 'firm.name', description: 'The name of your law firm or organisation.' },
  { label: '[FIRM ADDRESS]', category: 'firm', dataPath: 'firm.address', description: 'The address of your firm — appears on the letterhead.' },
  { label: '[SOLICITOR NAME]', category: 'firm', dataPath: 'firm.assignedSolicitor', description: 'The name of the solicitor handling the matter.' },
  { label: '[FIRM REG NUMBER]', category: 'firm', dataPath: 'firm.regNumber', description: 'Your firm’s registration number (e.g. NBA seal number, CAC RC number).' },
];

const normalize = (s: string) => s.trim().toUpperCase();

export function getPlaceholderDef(label: string): PlaceholderDef | undefined {
  const n = normalize(label);
  return PLACEHOLDER_REGISTRY.find(d => d.label === n);
}

export function resolveAutoFill(
  label: string,
  matter?: any,
  property?: any,
  tenancy?: any,
  firm?: any
): string | null {
  const def = getPlaceholderDef(label);
  if (!def || !def.dataPath) return null;

  const parts = def.dataPath.split('.');
  const rootKey = parts[0];
  const path = parts.slice(1);

  let ctx: any;
  switch (rootKey) {
    case 'matter': ctx = matter; break;
    case 'property': ctx = property; break;
    case 'tenancy': ctx = tenancy; break;
    case 'firm': ctx = firm; break;
    case 'system':
      if (path[0] === 'currentDate') {
        return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      }
      return null;
    default: return null;
  }

  if (!ctx) return null;
  let val: any = ctx;
  for (const p of path) {
    val = val?.[p];
    if (val == null) return null;
  }
  if (val == null || val === '') return null;
  return String(val);
}
