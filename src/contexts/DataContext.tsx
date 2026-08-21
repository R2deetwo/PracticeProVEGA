
import * as React from 'react';
import { AppState, DataActionsContextType, FirmActivity, UserRole, User, TaskStatus, Lead, SubscriptionPlan, Matter, Contact, ChatConversation, ChatMessage, ContactType, Document, Property, PropertyStatus, PropertyCategory, Product } from '../types';
import { useAuth } from './AuthContext'; // Import useAuth to access user
import { EMPTY_APP_STATE } from '../utils/mockData';
import { v4 as uuidv4 } from 'uuid';
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { analyzeDocument } from '../agents/AdvancedLegalDocumentIntelligenceAgent';

interface DataStateContextType {
    appState: AppState;
    setAppState: React.Dispatch<React.SetStateAction<AppState>>;
    isDataLoaded: boolean;
    isSaving: boolean;
    isOutdated: boolean;
    availableBackups: string[];
}

export interface ExtendedDataActions extends DataActionsContextType {
    refreshData: (user?: any) => Promise<void>;
    handleDeleteAllChats: () => void;
    handleRunDocumentAnalysis: (documentId: string) => Promise<void>;
    forceSync: () => Promise<void>;
    restoreFromLocalBackup: () => Promise<void>;
    handleRestoreBackup: (dateKey: string) => Promise<void>;
    handleUpdateUser: (userId: string, data: Partial<User>) => Promise<void>;
    handleExportData: () => Promise<void>;
    handleResetPracticeData: () => Promise<void>;
    handleClearState: () => void;
    handleDeleteChat: (conversationId: string, deleteForEveryone: boolean, userId: string) => void;
    handleDeleteMessage: (messageId: string, deleteForEveryone: boolean, userId: string) => void;
    handleCreateDirectMessage: (recipientId: string, firstMessage?: string, currentUserId?: string, matterId?: string, forceCreate?: boolean) => Promise<string>;
    handleCreateChannel: (name: string, memberIds: string[], creatorId: string, matterId?: string) => Promise<string>;
    handleRenamePage: (pageId: string, newTitle: string) => void;
    handleApplyStageChecklist: (matterId: string, stage: string, templateId: string, shareWithClient: boolean) => void;
    handleApplyCustomStageChecklist: (matterId: string, stage: string, name: string, items: { text: string }[], saveAsTemplate: boolean, shareWithClient: boolean) => void;
    handleEditMessage: (messageId: string, newContent: string) => void;
    handleLinkMatterToContact: (contactId: string, matterId: string, asClient: boolean) => void;
    registerBroadcastHandler: (handler: (type: string, data: any, senderId?: string) => void) => void;
    handleRemoteAction: (payload: any) => void;
    ensureUserInState: (user: User) => Promise<void>;
    retryMessage: (messageId: string, isClientMessage: boolean) => void;

    // ATOMIC RPC FUNCTIONS
    createFirm: (firmName: string, address: string, plan: SubscriptionPlan, userDetails?: { email: string, name: string }, product?: Product, isDataMigration?: boolean, trial?: boolean) => Promise<string | null>;
    joinFirm: (inviteCode: string) => Promise<string | null>;
    validateInviteCode: (inviteCode: string) => Promise<{ valid: boolean, firmName?: string, firmId?: string }>;
    regenerateInviteCode: (firmId: string) => Promise<string | null>;

    // Explicitly Typed Handlers
    onAddMatter: (matterData: any, clientData: { data: any, createPortal: boolean } | null) => Promise<any>;
    handleAddDocumentAndAnalyze: (docData: any) => Promise<void>;
    handleAddResearchNotebook: (data: any) => any;
    handleAddResearchSource: (notebookId: string, source: any) => void;
    handleSendResearchMessage: (notebookId: string, content: string, sourceIds?: string[]) => void;
    handleDeleteResearchNotebook: (id: string, name: string) => void;
    handleDeleteResearchSource: (id: string, name: string) => void;
    handleSaveAnalysisResult: (result: any) => void;
    handleDeleteAnalysisResult: (id: string) => void;
    handleToggleBookmarkCase: (id: string) => void;
    archiveItem: (type: string, id: string, name: string, data: any) => void;
    handleSendEmail: (data: any) => void;
    handleRequestFinancialDocument: (matterId: string, type: string) => void;
    handleAddLead: (lead: any, isClientRequest?: boolean) => void;
    handleSendIntakeLink: (leadId: string) => void;
    handleClientSubmitIntakeAudio: (leadId: string, recordings: any[], transcription: string) => void;
    handleAnalyzeIntake: (leadId: string) => void;
    handleActivateLead: (lead: Lead, matterData: any, billingData: any) => void;
    handleCancelIntakeRequest: (leadId: string) => void;
    handleClientUploadDocument: (matterId: string, fileDetails: any) => void;
    handleClientMarkDocumentAsReviewed: (id: string) => void;
    handleUpdateClientActionItem: (matterId: string, itemId: string, completed: boolean) => void;
    handleSendClientMessage: (matterId: string, content: string) => void;
    handleSaveEmailAsDocument: (email: any) => void;
    handleUpdateTaskPriority: (id: string, priority: any) => void;
    handleInviteExternalCounsel: (invite: any) => void;
    handleSyncGoogleContacts: () => Promise<void>;
    handleDetermineJurisdiction: (matterId: string) => Promise<void>;
    handleDeleteProperty: (id: string, name: string) => Promise<void>;
    handleBulkUpdateProperties: (ids: string[], data: { status?: PropertyStatus, category?: PropertyCategory }) => Promise<void>;
    onUpdateContactProperties: (contactId: string, properties: Property[]) => void;
    handleDismissNotification: (id: string) => Promise<void>;
    handleUpdateFirmDetails: (details: any) => Promise<void>;
    handleBulkArchiveTasks: (ids: string[]) => Promise<void>;
    handleBulkUpdateTaskStatus: (ids: string[], status: TaskStatus) => Promise<void>;
    handleBulkDeleteTasks: (ids: string[]) => Promise<void>;
    handleDeleteAllDoneTasks: () => Promise<void>;
    handleArchiveAllDoneTasks: () => Promise<void>;
    handleUpdatePageContent: (id: string, title: string, content: string) => Promise<void>;
    handleDeleteNotebook: (id: string, name: string) => Promise<void>;
    handleRestoreItem: (item: any) => Promise<void>;
    handlePermanentDeleteFromArchive: (id: string) => Promise<void>;
    handleDeleteTimeEntry: (id: string) => Promise<void>;
    handleDeleteExpense: (id: string) => Promise<void>;
    handleUpdateMatter: (m: Matter) => Promise<void>;
    handleReopenMatter: (id: string) => Promise<void>;
    handleLinkContactToMatter: (matterId: string, contactIds: string[]) => Promise<void>;
    handleAddMatterNote: (matterId: string, title: string, content: string, type?: 'user' | 'endorsement') => Promise<void>;
    handleDeleteMatter: (id: string, name: string) => Promise<void>;
    handleUpdateMatterStage: (id: string, stage: string) => void;
    switchDemoProduct: (product: 'vega' | 'atrium') => void;
    removeItemFromState: (table: string, id: string) => void;
}

export const DataStateContext = React.createContext<DataStateContextType | undefined>(undefined);
export const DataActionsContext = React.createContext<ExtendedDataActions | undefined>(undefined);

export const useDataState = () => {
    const context = React.useContext(DataStateContext);
    if (context === undefined) throw new Error('useDataState must be used within a DataProvider');
    return context;
};

export const useDataActions = () => {
    const context = React.useContext(DataActionsContext);
    if (context === undefined) throw new Error('useDataActions must be used within a DataProvider');
    return context;
};
