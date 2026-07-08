export type PlaceholderCategory = 'parties' | 'dates' | 'financial' | 'location' | 'court' | 'firm' | 'freetext';

export interface PlaceholderDef {
  label: string;
  category: PlaceholderCategory;
  dataPath: string | null;
}

export const PLACEHOLDER_REGISTRY: PlaceholderDef[] = [
  // PARTIES
  { label: '[CLIENT NAME]', category: 'parties', dataPath: 'matter.clientName' },
  { label: '[OPPOSING PARTY NAME]', category: 'parties', dataPath: 'matter.opposingPartyName' },
  { label: '[OPPOSING COUNSEL]', category: 'parties', dataPath: 'matter.opposingCounsel' },
  { label: '[TENANT NAME]', category: 'parties', dataPath: 'tenancy.tenantName' },
  { label: '[LANDLORD NAME]', category: 'parties', dataPath: 'property.landlordName' },
  { label: '[GUARANTOR NAME]', category: 'parties', dataPath: 'tenancy.guarantorName' },
  { label: '[DEPONENT NAME]', category: 'parties', dataPath: null },
  { label: '[JUDGE NAME]', category: 'parties', dataPath: null },
  { label: '[WITNESS NAME]', category: 'parties', dataPath: null },
  { label: '[OATH COMMISSIONER]', category: 'parties', dataPath: null },
  { label: '[CLAIMANT NAME]', category: 'parties', dataPath: 'matter.clientName' },
  { label: '[DEFENDANT NAME]', category: 'parties', dataPath: 'matter.opposingPartyName' },
  // DATES
  { label: "[TODAY'S DATE]", category: 'dates', dataPath: 'system.currentDate' },
  { label: '[LEASE START DATE]', category: 'dates', dataPath: 'tenancy.startDate' },
  { label: '[LEASE END DATE]', category: 'dates', dataPath: 'tenancy.endDate' },
  { label: '[RENT DUE DATE]', category: 'dates', dataPath: 'tenancy.rentDueDate' },
  { label: '[HEARING DATE]', category: 'dates', dataPath: 'matter.nextHearingDate' },
  { label: '[DEADLINE DATE]', category: 'dates', dataPath: 'matter.deadlineDate' },
  { label: '[NOTICE DATE]', category: 'dates', dataPath: 'system.currentDate' },
  { label: '[DATE OF BIRTH]', category: 'dates', dataPath: null },
  // FINANCIAL
  { label: '[RENT AMOUNT]', category: 'financial', dataPath: 'tenancy.rentAmount' },
  { label: '[SERVICE CHARGE]', category: 'financial', dataPath: 'tenancy.serviceCharge' },
  { label: '[SECURITY DEPOSIT]', category: 'financial', dataPath: 'tenancy.securityDeposit' },
  { label: '[CAUTION FEE]', category: 'financial', dataPath: 'tenancy.cautionFee' },
  { label: '[AGENCY FEE]', category: 'financial', dataPath: 'tenancy.agencyFee' },
  { label: '[PENALTY RATE]', category: 'financial', dataPath: 'tenancy.penaltyRate' },
  { label: '[LEGAL FEES]', category: 'financial', dataPath: 'matter.legalFees' },
  { label: '[CLAIM AMOUNT]', category: 'financial', dataPath: 'matter.claimAmount' },
  // LOCATION
  { label: '[PROPERTY ADDRESS]', category: 'location', dataPath: 'property.address' },
  { label: '[CLIENT ADDRESS]', category: 'location', dataPath: 'matter.clientAddress' },
  { label: '[REGISTERED OFFICE ADDRESS]', category: 'location', dataPath: 'matter.opposingPartyAddress' },
  { label: '[COURT ADDRESS]', category: 'location', dataPath: null },
  // COURT
  { label: '[COURT NAME]', category: 'court', dataPath: 'matter.courtName' },
  { label: '[SUIT NUMBER]', category: 'court', dataPath: 'matter.suitNumber' },
  { label: '[MATTER TITLE]', category: 'court', dataPath: 'matter.title' },
  { label: '[JURISDICTION]', category: 'court', dataPath: null },
  { label: '[CAUSE OF ACTION]', category: 'court', dataPath: null },
  { label: '[RELIEF SOUGHT]', category: 'court', dataPath: null },
  { label: '[EXHIBIT REFERENCE]', category: 'court', dataPath: null },
  { label: '[ORDER AND RULE]', category: 'court', dataPath: null },
  { label: '[GROUNDS OF APPLICATION]', category: 'court', dataPath: null },
  { label: '[COURT TIER]', category: 'court', dataPath: 'matter.courtTier' },
  // FIRM
  { label: '[FIRM NAME]', category: 'firm', dataPath: 'firm.name' },
  { label: '[FIRM ADDRESS]', category: 'firm', dataPath: 'firm.address' },
  { label: '[SOLICITOR NAME]', category: 'firm', dataPath: 'firm.assignedSolicitor' },
  { label: '[FIRM REG NUMBER]', category: 'firm', dataPath: 'firm.regNumber' },
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
