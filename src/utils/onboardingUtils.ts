
import { AppState, User, UserRole, Product } from '../types';

export interface ReadinessStep {
    id: string;
    label: string;
    isComplete: boolean;
    actionTarget: string; // e.g. 'modal_editFirmDetails', 'nav_profile'
    description: string;
    buttonText: string;
}

export interface ReadinessGroup {
    score: number;
    totalSteps: number;
    completedSteps: number;
    steps: ReadinessStep[];
    isFullyComplete: boolean;
}

const DEFAULT_FIRM_NAME = 'PracticePro Demo Firm';
const DEFAULT_FIRM_ADDRESS = '123 Legal Avenue, Victoria Island, Lagos';
const DEFAULT_BANK_ACCOUNT = '0123456789';

export const calculateFirmReadiness = (appState: AppState, product: Product): ReadinessGroup => {
    const { firmDetails } = appState;
    const isProperty = product === 'property';
    const steps: ReadinessStep[] = [];

    // 1. Firm Profile (Identity + Branding Consolidated)
    const hasName = firmDetails.name && firmDetails.name.trim().length > 0 && firmDetails.name !== DEFAULT_FIRM_NAME;
    const hasAddress = firmDetails.address && firmDetails.address.trim().length > 0 && firmDetails.address !== DEFAULT_FIRM_ADDRESS;
    const hasLogo = !!firmDetails.logoUrl;
    
    steps.push({
        id: 'firm_profile',
        label: isProperty ? 'Portfolio Profile' : 'Firm Profile',
        isComplete: !!(hasName && hasAddress && hasLogo),
        actionTarget: 'modal_editFirmDetails',
        description: isProperty 
            ? 'Complete your portfolio\'s identity and branding assets (Logo, Letterhead) for official documents.'
            : 'Complete your firm\'s identity and branding assets (Logo, Letterhead) for official documents.',
        buttonText: isProperty ? 'Edit Profile' : 'Edit Firm Profile'
    });

    // 2. Financials
    const hasRealBankAccount = firmDetails.bankAccounts.some(b => b.accountNumber !== DEFAULT_BANK_ACCOUNT);
    
    steps.push({
        id: 'firm_financials',
        label: 'Bank Accounts',
        isComplete: hasRealBankAccount,
        actionTarget: 'modal_newBankAccount',
        description: 'Add a valid Bank Account to receive payments.',
        buttonText: 'Add Account'
    });

    const completed = steps.filter(s => s.isComplete).length;
    const total = steps.length;
    
    return {
        steps,
        totalSteps: total,
        completedSteps: completed,
        score: total === 0 ? 100 : Math.round((completed / total) * 100),
        isFullyComplete: completed === total
    };
};

export const calculateProfileReadiness = (currentUser: User, product: Product): ReadinessGroup => {
    const isProperty = product === 'property';
    const steps: ReadinessStep[] = [];
    
    const isLawyer = (currentUser.role === UserRole.Lawyer || currentUser.role === UserRole.Admin) && !isProperty;

    // 1. Personal Details
    const isDefaultName = currentUser.name.includes('User') || currentUser.name.includes('Admin');
    steps.push({
        id: 'profile_identity',
        label: 'Personal Profile',
        isComplete: !isDefaultName,
        actionTarget: 'nav_profile',
        description: 'Update your full name and contact details for official correspondence.',
        buttonText: 'Edit Profile'
    });

    // 2. Professional Standards (Lawyers Only)
    if (isLawyer) {
        const standards = currentUser.professionalStandards;
        const isStampSet = standards?.nbaStampStatus === 'Approved';
        
        steps.push({
            id: 'profile_cpd',
            label: 'CPD & Standards',
            isComplete: !!isStampSet,
            actionTarget: 'nav_standards',
            description: 'Verify your NBA Stamp status & log completed CPD hours to ensure compliance.',
            buttonText: 'Update CPD'
        });
    }

    const completed = steps.filter(s => s.isComplete).length;
    const total = steps.length;

    return {
        steps,
        totalSteps: total,
        completedSteps: completed,
        score: total === 0 ? 100 : Math.round((completed / total) * 100),
        isFullyComplete: completed === total
    };
};

export const calculateSetupProgress = (appState: AppState, currentUser: User, product: Product) => {
    if (!appState || !currentUser) return { score: 0, missingSteps: [], nextStep: null };

    const firmReadiness = calculateFirmReadiness(appState, product);
    const profileReadiness = calculateProfileReadiness(currentUser, product);
    
    // Logic: If Admin, prioritize Firm Readiness items first, but Profile is always relevant
    let relevantReadiness = profileReadiness;
    if (currentUser.role === UserRole.Admin && !firmReadiness.isFullyComplete) {
        relevantReadiness = firmReadiness;
    }

    const missingSteps = relevantReadiness.steps.filter(s => !s.isComplete);
    const nextStep = missingSteps.length > 0 ? missingSteps[0] : null;

    return {
        score: relevantReadiness.score,
        missingSteps: missingSteps,
        nextStep: nextStep ? { message: nextStep.description } : null
    };
};
