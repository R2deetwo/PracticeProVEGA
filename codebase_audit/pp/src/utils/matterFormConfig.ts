import { MatterType } from '../types';

interface FieldConfig {
  label?: string;
  placeholder?: string;
  hidden?: boolean;
}

export interface FormConfig {
  suitNumber: FieldConfig;
  court: FieldConfig;
  judicialDivision: FieldConfig;
  opposingCounsel: FieldConfig;
}

const defaultConfig: FormConfig = {
  suitNumber: { label: 'Reference Number', placeholder: 'e.g., CORP/GEN/01/2024', hidden: false },
  court: { hidden: true },
  judicialDivision: { hidden: true },
  opposingCounsel: { label: 'Counterparty / Other Side', placeholder: 'Name of other party or firm', hidden: false },
};

const litigationConfig: FormConfig = {
  suitNumber: { label: 'Suit Number', placeholder: 'e.g., FHC/L/CS/123/2024', hidden: false },
  court: { hidden: false },
  judicialDivision: { hidden: false },
  opposingCounsel: { label: 'Opposing Counsel', placeholder: 'Name of opposing counsel or firm', hidden: false },
};

export const getMatterFormConfig = (matterType: MatterType, subCategory?: string): FormConfig => {
  if (matterType === MatterType.CivilLitigation) {
    return litigationConfig;
  }
  
  if (matterType === MatterType.CorporateCommercial && subCategory === 'Company Incorporation (CAC)') {
    return {
      ...defaultConfig,
      opposingCounsel: { ...defaultConfig.opposingCounsel, hidden: true }
    };
  }

  // All other corporate and real estate matters
  return defaultConfig;
};