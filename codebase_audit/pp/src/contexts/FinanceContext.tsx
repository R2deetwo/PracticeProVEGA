import React, { createContext, useContext } from 'react';
import { Invoice, TimeEntry, Expense } from '../types';

export interface FinanceState {
    invoices: Invoice[];
    timeEntries: TimeEntry[];
    expenses: Expense[];
}

export interface FinanceActions {
    updateInvoice: (invoice: Partial<Invoice> & { id: string }) => Promise<void>;
    deleteInvoice: (id: string, name?: string) => Promise<void>;
    addTimeEntry: (entry: any) => Promise<any>;
    deleteTimeEntry: (id: string, name?: string) => Promise<void>;
    addExpense: (expense: any) => Promise<any>;
    deleteExpense: (id: string, name?: string) => Promise<void>;
}

import { useDataState, useDataActions } from './DataContext';

const FinanceContext = createContext<{ financeState: FinanceState; financeActions: FinanceActions } | undefined>(undefined);

export const FinanceProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
    const { appState } = useDataState();
    const actions = useDataActions();
    
    const financeState: FinanceState = {
        invoices: appState.invoices,
        timeEntries: appState.timeEntries,
        expenses: appState.expenses
    };

    const financeActions: FinanceActions = {
        updateInvoice: (item) => actions.updateItem('invoices', item, 'Invoice'),
        deleteInvoice: (id, name) => actions.deleteItem('invoices', id, name || 'Invoice'),
        addTimeEntry: (item) => actions.addItem('timeEntries', item, 'Time Entry'),
        deleteTimeEntry: (id, name) => actions.deleteItem('timeEntries', id, name || 'Time Entry'),
        addExpense: (item) => actions.addItem('expenses', item, 'Expense'),
        deleteExpense: (id, name) => actions.deleteItem('expenses', id, name || 'Expense'),
    };

    return (
        <FinanceContext.Provider value={{ financeState, financeActions }}>
            {children}
        </FinanceContext.Provider>
    );
};


export const useFinanceState = () => {
    const context = useContext(FinanceContext);
    if (!context) throw new Error('useFinanceState must be used within FinanceProvider');
    return context;
};
