/**
 * FounderContexts — lightweight auth + toast contexts for the Founder APK.
 *
 * Extracted into a separate file to avoid circular imports between
 * AdminApp.tsx (which imports views) and views (which import contexts
 * from AdminApp.tsx).
 */

import React, { createContext, useContext } from 'react';

// ─── Auth Context ───────────────────────────────────────────────────
export interface FounderUser {
    id: string;
    _id?: string;
    email: string;
    name: string;
    role: string;
    tokenIdentifier: string;
}

export interface FounderAuthContextType {
    currentUser: FounderUser | null;
    isAuthenticated: boolean;
    isLoadingSession: boolean;
    login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
    logout: () => void;
}

export const FounderAuthContext = createContext<FounderAuthContextType>({
    currentUser: null,
    isAuthenticated: false,
    isLoadingSession: true,
    login: async () => ({ success: false }),
    logout: () => {},
});

export const useFounderAuth = () => useContext(FounderAuthContext);

// ─── Toast Context ──────────────────────────────────────────────────
export interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
}

export const ToastContext = createContext<{ addToast: (msg: string, opts?: { type?: Toast['type'] }) => void }>({
    addToast: () => {},
});

export const useFounderToast = () => useContext(ToastContext);
