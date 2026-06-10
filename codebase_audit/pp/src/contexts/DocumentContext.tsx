import React, { createContext, useContext } from 'react';
import { Document, NotePage, ResearchNotebook, ResearchSource } from '../types';

export interface DocumentState {
    documents: Document[];
    notePages: NotePage[];
    researchNotebooks: ResearchNotebook[];
    researchSources: ResearchSource[];
}

export interface DocumentActions {
    updateDocument: (doc: Partial<Document> & { id: string }) => Promise<void>;
    deleteDocument: (id: string, name?: string) => Promise<void>;
    handleUpdatePageContent: (pageId: string, title: string, content: string) => void;
    handleRenamePage: (pageId: string, newTitle: string) => void;
    handleDeleteNotebook: (id: string, name: string) => void;
    onDeletePage: (id: string) => void;
    handleAddMatterNote: (matterId: string, title: string, content: string) => void;
}

import { useDataState, useDataActions } from './DataContext';

const DocumentContext = createContext<{ documentState: DocumentState; documentActions: DocumentActions } | undefined>(undefined);

export const DocumentProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
    const { appState } = useDataState();
    const actions = useDataActions();
    
    const documentState: DocumentState = {
        documents: appState.documents,
        notePages: appState.notePages,
        researchNotebooks: appState.researchNotebooks,
        researchSources: appState.researchSources
    };

    const documentActions: DocumentActions = {
        updateDocument: (item) => actions.updateItem('documents', item, 'Document'),
        deleteDocument: (id, name) => actions.deleteItem('documents', id, name || 'Document'),
        handleUpdatePageContent: (id, title, content) => actions.handleUpdatePageContent(id, title, content),
        handleRenamePage: actions.handleRenamePage,
        handleDeleteNotebook: (id, name) => actions.handleDeleteNotebook(id, name),
        onDeletePage: (id) => actions.deleteItem('notePages', id, 'page'),
        handleAddMatterNote: actions.handleAddMatterNote
    };

    return (
        <DocumentContext.Provider value={{ documentState, documentActions }}>
            {children}
        </DocumentContext.Provider>
    );
};


export const useDocumentState = () => {
    const context = useContext(DocumentContext);
    if (!context) throw new Error('useDocumentState must be used within DocumentProvider');
    return context;
};
