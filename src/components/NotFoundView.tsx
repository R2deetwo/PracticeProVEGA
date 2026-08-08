import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useUI } from '../contexts/UIContext';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';

/**
 * NotFoundView — 404 page
 *
 * SECURITY: Portal users (Client/Tenant) must NEVER see a "Go to Dashboard"
 * button that could take them into the main app. Instead, they get a
 * "Return to Portal" button that redirects to their specific portal login.
 */
const NotFoundView: React.FC = () => {
    const { navigateTo } = useUI();
    const { currentUser } = useAuth();
    const navigate = useNavigate();

    const isPortalUser = currentUser?.role === UserRole.Client || currentUser?.role === UserRole.Tenant;

    // SECURITY: If the current user is a portal user, they must NEVER be
    // directed to the main app's dashboard. Redirect them to their portal
    // login page instead — this is a hard boundary that prevents cross-access.
    if (isPortalUser) {
        const portalType = currentUser?.role === UserRole.Client ? 'client' : 'tenant';
        const loginPath = `/portal/${portalType}/login`;

        return (
            <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center p-8 bg-slate-50 dark:bg-zinc-900">
                <div className="p-6 bg-slate-100 dark:bg-zinc-800 rounded-2xl mb-6">
                    <svg className="w-16 h-16 text-slate-400 dark:text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <h2 className="text-2xl font-bold text-slate-700 dark:text-zinc-200 mb-2">Page Not Found</h2>
                <p className="text-sm text-slate-500 dark:text-zinc-400 mb-8 max-w-sm">
                    The page you're looking for doesn't exist or may have been moved.
                </p>
                <button
                    onClick={() => navigate(loginPath, { replace: true })}
                    className="px-6 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-bold hover:bg-primary-700 transition-colors shadow-sm"
                >
                    Return to Portal
                </button>
            </div>
        );
    }

    // Main app users get the standard "Go to Dashboard" button
    return (
        <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center p-8 bg-slate-50 dark:bg-zinc-900">
            <div className="p-6 bg-slate-100 dark:bg-zinc-800 rounded-2xl mb-6">
                <svg className="w-16 h-16 text-slate-400 dark:text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-700 dark:text-zinc-200 mb-2">Page Not Found</h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mb-8 max-w-sm">
                The page you're looking for doesn't exist or may have been moved.
            </p>
            <button
                onClick={() => navigateTo('dashboard')}
                className="px-6 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-bold hover:bg-primary-700 transition-colors shadow-sm"
            >
                Go to Dashboard
            </button>
        </div>
    );
};

export default NotFoundView;
