
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Zap, AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    isConvexError: boolean;
    errorMessage: string;
    retryCount: number;
}

const isConvexRelatedError = (msg: string): boolean => {
    return (
        msg.includes('CONVEX') ||
        msg.includes('ConvexError') ||
        msg.includes('Server Error') ||
        msg.includes('Called by client') ||
        msg.includes('free plan') ||
        msg.includes('WebSocket') ||
        msg.includes('convex.cloud') ||
        msg.includes('myFunctions') ||
        msg.includes('getUser')
    );
};

/**
 * ConvexErrorBoundary
 *
 * Placed INSIDE ConvexProvider but OUTSIDE AuthProvider.
 * Catches Convex query/mutation errors that propagate through the React render cycle.
 * Shows a friendly "Connection Unavailable" screen with retry instead of a full crash.
 * Non-Convex errors are shown with a generic error screen and reload button.
 */
class ConvexErrorBoundary extends Component<Props, State> {
    private retryTimer: ReturnType<typeof setTimeout> | null = null;

    public state: State = {
        hasError: false,
        isConvexError: false,
        errorMessage: '',
        retryCount: 0,
    };

    public static getDerivedStateFromError(error: any): State {
        const msg = error?.message || String(error) || 'Unknown error';
        return {
            hasError: true,
            isConvexError: isConvexRelatedError(msg),
            errorMessage: msg,
            retryCount: 0,
        };
    }

    public componentDidCatch(error: any, errorInfo: ErrorInfo) {
        const msg = error?.message || String(error) || '';
        console.error('[ConvexErrorBoundary] Caught error:', msg);

        // Clear stale session on Convex errors so on retry the user lands on login cleanly
        if (isConvexRelatedError(msg)) {
            try { localStorage.removeItem('practicepro_user_session'); } catch (e) { /* ignore */ }

            // Auto-retry after 5 s (max 3 attempts)
            if (this.state.retryCount < 3) {
                this.retryTimer = setTimeout(() => {
                    this.setState(prev => ({
                        hasError: false,
                        isConvexError: false,
                        errorMessage: '',
                        retryCount: prev.retryCount + 1,
                    }));
                }, 5000);
            }
        }
    }

    public componentWillUnmount() {
        if (this.retryTimer) clearTimeout(this.retryTimer);
    }

    private handleManualRetry = () => {
        if (this.retryTimer) clearTimeout(this.retryTimer);
        this.setState({ hasError: false, isConvexError: false, errorMessage: '', retryCount: 0 });
    };

    private handleBackToLogin = () => {
        try { localStorage.removeItem('practicepro_user_session'); } catch (e) { /* ignore */ }
        window.location.reload();
    };

    public render() {
        const { hasError, isConvexError, errorMessage, retryCount } = this.state;

        if (!hasError) return this.props.children;

        const icon = isConvexError ? '🔌' : '⚠️';
        const title = isConvexError ? 'Server Temporarily Unavailable' : 'Application Error';
        const subtitle = isConvexError
            ? 'The app could not connect to the backend. This may be a transient network issue or a Convex plan limit. Your local data is safe.'
            : 'An unexpected error occurred in the application.';

        return (
            <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 text-center animate-fade-in" style={{
                background: 'radial-gradient(circle at center, #1e293b 0%, #0f172a 100%)',
                color: '#f8fafc',
                fontFamily: 'Outfit, Inter, system-ui, sans-serif',
            }}>
                {/* Visual element */}
                <div className="relative mb-10">
                    <div className="absolute inset-0 bg-primary-500/20 blur-3xl rounded-full scale-150 animate-pulse"></div>
                    <div className={`
                        relative w-24 h-24 rounded-3xl flex items-center justify-center text-4xl shadow-2xl transform rotate-3
                        ${isConvexError ? 'bg-amber-500/10 border-2 border-amber-500/30 text-amber-500' : 'bg-rose-500/10 border-2 border-rose-500/30 text-rose-500'}
                    `}>
                        {isConvexError ? <Zap className="w-10 h-10" /> : <AlertTriangle className="w-10 h-10" />}
                    </div>
                </div>

                {/* Text Content */}
                <h1 className="text-3xl font-black mb-4 tracking-tight leading-tight max-w-lg">
                    {isConvexError ? 'System Connection Interrupted' : 'Application Logic Error'}
                </h1>
                
                <p className="text-slate-400 text-base max-w-md mx-auto mb-8 leading-relaxed">
                    {isConvexError 
                        ? "Our backend infrastructure (Convex) is currently unresponsive. This usually happens during platform maintenance or unexpected load spikes. Your work remains cached locally."
                        : "Something went wrong while rendering the interface. Our team has been notified of this technical glitch."
                    }
                </p>

                {/* Status Badge */}
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-full mb-10">
                    <div className={`w-2 h-2 rounded-full animate-pulse ${isConvexError ? 'bg-amber-500' : 'bg-rose-500'}`}></div>
                    <span className="text-[11px] font-bold uppercase tracking-widest text-slate-300">
                        {isConvexError ? 'Syncing Status: Retrying...' : 'App Status: Recoverable'}
                    </span>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-4 w-full max-w-xs mx-auto">
                    <button
                        onClick={this.handleManualRetry}
                        className="w-full py-4 bg-primary-600 hover:bg-primary-500 text-white rounded-2xl font-bold text-sm shadow-xl shadow-primary-900/20 transition-all active:scale-95"
                    >
                        <RefreshCw className="w-4 h-4 inline mr-2" /> Reconnect Now
                    </button>
                    
                    <button
                        onClick={this.handleBackToLogin}
                        className="w-full py-4 bg-white/5 hover:bg-white/10 text-slate-300 rounded-2xl font-bold text-sm border border-white/10 transition-all"
                    >
                        ← Return to Portal
                    </button>

                    <button
                        onClick={() => { localStorage.clear(); window.location.reload(); }}
                        className="mt-4 text-[11px] font-bold text-slate-500 hover:text-rose-400 uppercase tracking-widest transition-colors"
                    >
                        Hard Reset Local State
                    </button>
                </div>

                {/* Technical Error Bubble */}
                {errorMessage && (
                    <div className="mt-12 p-4 bg-black/40 border border-white/5 rounded-2xl max-w-2xl w-full text-left overflow-hidden">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 rounded-full bg-slate-600"></div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Engine Error Log</span>
                        </div>
                        <p className="font-mono text-[10px] text-slate-500 break-all opacity-80 leading-relaxed">
                            {errorMessage}
                        </p>
                    </div>
                )}
            </div>
        );
    }
}

export default ConvexErrorBoundary;
