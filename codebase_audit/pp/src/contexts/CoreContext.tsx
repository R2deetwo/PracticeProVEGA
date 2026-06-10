import React, { createContext, useContext } from 'react';
import {
    User, FirmDetails, Notification, Lead, FirmActivity,
    Email, AutomationRule, IntakeFormTemplate, ArchivedItem,
    Theme, AppMode, CustomEventType, ContactCategory, ChecklistTemplate,
    DocumentTemplate, DocumentTemplateCategory, DocumentCategory,
    ExternalCounselInvite, NoteNotebook, StudioAnalysisResult,
    ResearchMessage, UserRole, Property,
    LedgerEntry, ServiceCharge, LeadPipelineEntry, AutomationLog
} from '../types';
import { useProduct } from './ProductContext';

export interface CoreState {
    users: User[];
    firmDetails: FirmDetails;
    notifications: Notification[];
    leads: Lead[];
    firmActivity: FirmActivity[];
    emails: Email[];
    automationRules: AutomationRule[];
    intakeForms: IntakeFormTemplate[];
    archive: ArchivedItem[];
    theme: Theme;
    appMode: AppMode;
    onboardingStatus?: any;
    externalCounselInvites: ExternalCounselInvite[];
    // Categories and metadata
    eventTypes: any[];
    contactCategories: any[];
    documentCategories: any[];
    documentTemplateCategories: any[];
    folderPermissions: Record<string, UserRole[]>;
    checklistTemplates: any[];
    documentTemplates: any[];
    chatConversations: any[]; // Missing from previous
    chatMessages: any[]; // Missing from previous
    noteNotebooks: NoteNotebook[];
    bookmarkedCaseIds: string[];
    researchAnalysisResults: StudioAnalysisResult[];
    properties: Property[];
    ledgerEntries: LedgerEntry[];
    serviceCharges: ServiceCharge[];
    leadsPipeline: LeadPipelineEntry[];
    automationLogs: AutomationLog[];
}

export interface CoreActions {
    handleUpdateUser: (userId: string, data: any) => void;
    handleUpdateFirmDetails: (details: any) => void;
    handleMarkNotificationsRead: (ids: string[]) => void;
    handleDismissNotification: (id: string) => void;
    handleClearAllNotifications: () => void;
    handleSendMessage: (conversationId: string, content: string, senderId: string, overrideMembers?: string[]) => void;
    handleDeleteChat: (id: string, name: string) => void;
    deleteItem: (table: any, id: string, name?: string) => void;
}

import { useDataState, useDataActions } from './DataContext';

const CoreContext = createContext<{ coreState: CoreState; coreActions: CoreActions; isDataLoaded: boolean; } | undefined>(undefined);

export const CoreProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
    const { appState, isDataLoaded } = useDataState();
    const actions = useDataActions();
    const { product } = useProduct();
    
    const productCategories = React.useMemo(() => {
        const categories = {
            contactCategories: appState.contactCategories || [],
            documentCategories: appState.documentCategories || [],
        };

        if (product === 'property' || product === 'atrium') {
            categories.contactCategories = [
                { id: 'cat_landlord', name: 'Landlord', firmId: '' },
                { id: 'cat_tenant', name: 'Tenant', firmId: '' },
                { id: 'cat_agent', name: 'Property Agent', firmId: '' },
                { id: 'cat_manager', name: 'Facility Manager', firmId: '' },
                { id: 'cat_vendor', name: 'Vendor/Artisan', firmId: '' },
                { id: 'cat_govt', name: 'Govt Agency', firmId: '' }
            ];
            categories.documentCategories = [
                { id: 'doc_leases', name: 'Lease Agreements', firmId: '', parentId: null },
                { id: 'doc_deeds', name: 'Title Deeds', firmId: '', parentId: null },
                { id: 'doc_utility', name: 'Utility Bills', firmId: '', parentId: null },
                { id: 'doc_service', name: 'Service Charges', firmId: '', parentId: null },
                { id: 'doc_maint', name: 'Maintenance Records', firmId: '', parentId: null },
                { id: 'doc_tax', name: 'Tax/Rates', firmId: '', parentId: null }
            ];
        } else if (product === 'legal' || product === 'vega') {
            categories.contactCategories = [
                { id: 'cat_client', name: 'Client', firmId: '' },
                { id: 'cat_opposing', name: 'Opposing Counsel', firmId: '' },
                { id: 'cat_judiciary', name: 'Judiciary Staff', firmId: '' },
                { id: 'cat_witness', name: 'Expert Witness', firmId: '' },
                { id: 'cat_advocate', name: 'Advocate', firmId: '' }
            ];
            categories.documentCategories = [
                { id: 'doc_pleadings', name: 'Pleadings', firmId: '', parentId: null },
                { id: 'doc_corresp', name: 'Correspondence', firmId: '', parentId: null },
                { id: 'doc_evidence', name: 'Evidence', firmId: '', parentId: null },
                { id: 'doc_agreements', name: 'Agreements', firmId: '', parentId: null },
                { id: 'doc_orders', name: 'Court Orders', firmId: '', parentId: null },
                { id: 'doc_opinions', name: 'Legal Opinions', firmId: '', parentId: null }
            ];
        }

        return categories;
    }, [product, appState.contactCategories, appState.documentCategories]);

    const coreState: CoreState = {
        users: appState.users || [],
        chatMessages: appState.chatMessages || [],
        firmDetails: appState.firmDetails,
        notifications: appState.notifications || [],
        leads: appState.leads || [],
        firmActivity: appState.firmActivity || [],
        emails: appState.emails || [],
        automationRules: appState.automationRules || [],
        intakeForms: appState.intakeForms || [],
        archive: appState.archive || [],
        theme: appState.theme,
        appMode: appState.appMode,
        externalCounselInvites: appState.externalCounselInvites || [],
        eventTypes: appState.eventTypes || [],
        contactCategories: productCategories.contactCategories,
        documentCategories: productCategories.documentCategories,
        documentTemplateCategories: appState.documentTemplateCategories || [],
        folderPermissions: appState.folderPermissions || {},
        checklistTemplates: appState.checklistTemplates || [],
        documentTemplates: appState.documentTemplates || [],
        chatConversations: appState.chatConversations || [],
        noteNotebooks: appState.noteNotebooks || [],
        bookmarkedCaseIds: appState.bookmarkedCaseIds || [],
        researchAnalysisResults: appState.researchAnalysisResults || [],
        properties: appState.properties || [],
        ledgerEntries: appState.ledgerEntries || [],
        serviceCharges: appState.serviceCharges || [],
        leadsPipeline: appState.leadsPipeline || [],
        automationLogs: appState.automationLogs || [],
    };

    const coreActions: CoreActions = {
        handleUpdateUser: actions.handleUpdateUser,
        handleUpdateFirmDetails: actions.handleUpdateFirmDetails,
        handleMarkNotificationsRead: actions.handleMarkNotificationsRead,
        handleDismissNotification: actions.handleDismissNotification,
        handleClearAllNotifications: actions.handleClearAllNotifications,
        handleSendMessage: actions.handleSendMessage,
        handleDeleteChat: (id, name) => actions.deleteItem('chatConversations', id, name || 'Chat'),
        deleteItem: (table, id, name) => actions.deleteItem(table as any, id, name || 'Item'),
    };

    return (
        <CoreContext.Provider value={{ coreState, coreActions, isDataLoaded }}>
            {children}
        </CoreContext.Provider>
    );
};


export const useCoreState = () => {
    const context = useContext(CoreContext);
    if (!context) throw new Error('useCoreState must be used within CoreProvider');
    return context;
};
