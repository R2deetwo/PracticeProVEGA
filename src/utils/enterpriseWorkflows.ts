import { MatterType, TaskStatus, TaskPriority } from '../types';

export const ENTERPRISE_WORKFLOWS = {
    [MatterType.MaritimeAdmiralty]: {
        subCategories: {
            'Ship Arrest (In Rem)': {
                stages: ['Initial Assessment', 'Warrant Procurement', 'Execution of Arrest', 'Caveat Against Release', 'Settlement / Sale', 'Closed'],
                suggestions: {
                    processes: ['Affidavit of Urgency', 'Writ of Summons in Rem', 'Undertaking as to Damages', 'Warrant of Arrest'],
                    tasks: [
                        { title: 'Draft Affidavit of Urgency', priority: TaskPriority.High, dueInDays: 1 },
                        { title: 'File Writ of Summons in Rem', priority: TaskPriority.High, dueInDays: 1 },
                        { title: 'Execute Warrant via Admiralty Marshal', priority: TaskPriority.Medium, dueInDays: 3 }
                    ]
                }
            },
            'Cargo Claim': {
                stages: ['Notice of Claim', 'Survey & Inspection', 'Negotiation with P&I Club', 'Litigation / Arbitration', 'Closed'],
                suggestions: {
                    processes: ['Letter of Claim', 'Writ of Summons', 'Statement of Claim'],
                    tasks: [
                        { title: 'Review Bill of Lading & Protest Notes', priority: TaskPriority.High, dueInDays: 2 },
                        { title: 'Lodge Claim with P&I Club', priority: TaskPriority.Medium, dueInDays: 5 }
                    ]
                }
            }
        }
    },
    [MatterType.Tax]: {
        subCategories: {
            'FIRS Desk Audit': {
                stages: ['Pre-Audit Review', 'Information Request', 'Draft Audit Report', 'Reconciliation', 'Final Assessment', 'Closed'],
                suggestions: {
                    processes: ['Notice of Objection', 'TCC Application'],
                    tasks: [
                        { title: 'Collate Client Receipts & TCCs', priority: TaskPriority.Medium, dueInDays: 7 },
                        { title: 'Draft Notice of Objection', priority: TaskPriority.High, dueInDays: 25, description: 'Must be filed within 30 days of FIRS assessment' }
                    ]
                }
            },
            'Tax Appeal (TAT)': {
                stages: ['Prepare Notice of Appeal', 'Filing at TAT', 'Hearing', 'Judgment', 'Closed'],
                suggestions: {
                    processes: ['Notice of Appeal', 'Witness Statement on Oath', 'Reply to FIRS'],
                    tasks: [
                        { title: 'File Notice of Appeal at TAT', priority: TaskPriority.High, dueInDays: 28 },
                        { title: 'Draft Appellant\'s Brief', priority: TaskPriority.High, dueInDays: 45 }
                    ]
                }
            }
        }
    },
    [MatterType.OilGas]: {
        subCategories: {
            'License Renewal (PIA)': {
                stages: ['Audit & Compliance', 'NUPRC Application', 'Technical Presentation', 'Approval / Issuance', 'Closed'],
                suggestions: {
                    processes: ['NUPRC Application Form', 'Relinquishment Notice'],
                    tasks: [
                        { title: 'Review PIA Compliance Obligations', priority: TaskPriority.Medium, dueInDays: 10 },
                        { title: 'Submit Relinquishment Plan', priority: TaskPriority.High, dueInDays: 30 }
                    ]
                }
            },
            'Farm-in / Farm-out': {
                stages: ['Term Sheet', 'Due Diligence', 'JOA Negotiation', 'Ministerial Consent', 'Closed'],
                suggestions: {
                    processes: ['Deed of Assignment', 'Joint Operating Agreement (JOA)', 'Application for Consent'],
                    tasks: [
                        { title: 'Draft Deed of Assignment', priority: TaskPriority.Medium, dueInDays: 14 },
                        { title: 'Apply for Ministerial Consent (NUPRC)', priority: TaskPriority.High, dueInDays: 60 }
                    ]
                }
            }
        }
    },
    [MatterType.CorporateCommercial]: {
        subCategories: {
            'Company Incorporation': {
                stages: ['Name Reservation', 'Document Execution', 'CAC Upload', 'Certificate Issuance', 'Post-incorporation'],
                suggestions: {
                    processes: ['CAC Form 1.1', 'Memorandum & Articles', 'Board Resolution'],
                    tasks: [
                        { title: 'Reserve Name at CAC', priority: TaskPriority.High, dueInDays: 1 },
                        { title: 'Draft MemArt', priority: TaskPriority.Medium, dueInDays: 3 }
                    ]
                }
            },
            'Annual Returns Compliance': {
                stages: ['Audit Review', 'Draft Resolution', 'File Returns', 'Closed'],
                suggestions: {
                    processes: ['Annual Returns Form', 'Audited Financial Statement'],
                    tasks: [
                        { title: 'Review Audited Accounts', priority: TaskPriority.Medium, dueInDays: 7 },
                        { title: 'File Returns at CAC', priority: TaskPriority.High, dueInDays: 14 }
                    ]
                }
            }
        }
    },
    [MatterType.RealEstate]: {
        subCategories: {
            'Title Perfection (Gov. Consent)': {
                stages: ['Assessment', 'Stamping', 'Consent Application', 'Registration', 'Closed'],
                suggestions: {
                    processes: ['Deed of Assignment', 'Form 1C', 'Survey Plan'],
                    tasks: [
                        { title: 'Pay Stamp Duties', priority: TaskPriority.High, dueInDays: 30 },
                        { title: 'Submit Consent Application to Lands Bureau', priority: TaskPriority.Medium, dueInDays: 40 }
                    ]
                }
            }
        }
    }
};
