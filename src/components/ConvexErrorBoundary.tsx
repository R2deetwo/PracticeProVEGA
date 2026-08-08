/**
 * ConvexErrorBoundary
 *
 * Placed INSIDE ConvexProvider but OUTSIDE AuthProvider.
 * Catches Convex query/mutation errors AND React render errors that
 * propagate through the React render cycle.
 *
 * CRITICAL DESIGN DECISIONS (learned from past bugs):
 *
 * 1. NO 2-SECOND AUTO-RECOVERY for non-Convex errors.
 *    The previous implementation auto-cleared errors after 2 seconds,
 *    which meant the user could never read or screenshot the error.
 *    This was especially painful for the DraftPro crash — the error
 *    flashed on screen for 2s, then disappeared, then re-appeared
 *    (because the underlying render error was still present), in an
 *    infinite loop. Now we ONLY auto-retry Convex connection errors
 *    (which are genuinely transient) and require manual retry for
 *    everything else.
 *
 * 2. retryCount is preserved across errors (not reset to 0).
 *    The previous `getDerivedStateFromError` always reset retryCount to 0,
 *    which defeated the "max 3 attempts" guard — the boundary would
 *    retry forever. Now we use an instance field to track attempts
 *    across the lifetime of the component.
 *
 * 3. The error screen stays VISIBLE until the user clicks "Reconnect Now"
 *    or "Return to Portal". This lets them read, screenshot, and report
 *    the error — which is essential for debugging.
 */
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Zap, AlertTriangle, RefreshCw, Copy, Check } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    isConvexError: boolean;
    errorMessage: string;
    errorStack?: string;
    componentStack?: string;
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

class ConvexErrorBoundary extends Component<Props, State> {
    private retryTimer: ReturnType<typeof setTimeout> | null = null;
    // Instance field — survives across errors (unlike state which gets reset)
    private convexRetryCount = 0;
    private copiedToClipboard = false;

    public state: State = {
        hasError: false,
        isConvexError: false,
        errorMessage: '',
    };

    public static getDerivedStateFromError(error: any): State {
        const msg = error?.message || String(error) || 'Unknown error';
        return {
            hasError: true,
            isConvexError: isConvexRelatedError(msg),
            errorMessage: msg,
            errorStack: error?.stack,
        };
    }

    public componentDidCatch(error: any, errorInfo: ErrorInfo) {
        const msg = error?.message || String(error) || '';
        console.error('[ConvexErrorBoundary] Caught error:', msg, errorInfo?.componentStack);

        // Store the component stack for display
        this.setState({ componentStack: errorInfo?.componentStack || undefined });

        // ─── Convex connection errors → auto-retry (genuinely transient) ───
        // These are network/backend issues that often resolve themselves.
        // We retry up to 3 times with a 5-second delay.
        if (isConvexRelatedError(msg)) {
            try { localStorage.removeItem('practicepro_user_session'); } catch (e) { /* ignore */ }

            if (this.convexRetryCount < 3) {
                this.convexRetryCount++;
                this.retryTimer = setTimeout(() => {
                    this.setState({
                        hasError: false,
                        isConvexError: false,
                        errorMessage: '',
                        errorStack: undefined,
                        componentStack: undefined,
                    });
                }, 5000);
            }
            // After 3 failed retries, the error screen stays visible
            // until the user manually clicks "Reconnect Now".
        }
        // ─── Non-Convex errors (render crashes, TypeErrors, etc.) ───
        // DO NOT auto-recover. These are almost always persistent bugs
        // (e.g., a Tiptap node view that throws on specific AI output).
        // Auto-recovering just creates an infinite flash-on/flash-off loop
        // that the user can't read or screenshot. Let them see the error,
        // copy it, and report it — or manually click "Reconnect Now".
    }

    public componentWillUnmount() {
        if (this.retryTimer) clearTimeout(this.retryTimer);
    }

    private handleManualRetry = () => {
        if (this.retryTimer) clearTimeout(this.retryTimer);
        this.convexRetryCount = 0; // reset on manual retry
        this.setState({
            hasError: false,
            isConvexError: false,
            errorMessage: '',
            errorStack: undefined,
            componentStack: undefined,
        });
    };

    private handleBackToLogin = () => {
        try { localStorage.removeItem('practicepro_user_session'); } catch (e) { /* ignore */ }
        window.location.reload();
    };

    private handleCopyError = () => {
        const errorText = [
            `Error: ${this.state.errorMessage}`,
            '',
            'Stack:',
            this.state.errorStack || '(no stack)',
            '',
            'Component Stack:',
            this.state.componentStack || '(no component stack)',
            '',
            `Time: ${new Date().toISOString()}`,
            `URL: ${window.location.href}`,
        ].join('\n');
        try {
            navigator.clipboard.writeText(errorText);
            this.copiedToClipboard = true;
            this.forceUpdate();
            setTimeout(() => {
                this.copiedToClipboard = false;
                this.forceUpdate();
            }, 2000);
        } catch (e) {
            // clipboard API may not be available
        }
    };

    public render() {
        const { hasError, isConvexError, errorMessage } = this.state;

        if (!hasError) return this.props.children;

        const title = isConvexError ? 'Server Temporarily Unavailable' : 'Application Error';
        const subtitle = isConvexError
            ? 'The app could not connect to the backend. This may be a transient network issue or a Convex plan limit. Your local data is safe.'
            : 'An unexpected error occurred while rendering the interface. The error details are shown below — please screenshot or copy them for support.';

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
                <h1 className="text-3xl font-bold mb-4 tracking-tight leading-tight max-w-lg">
                    {isConvexError ? 'System Connection Interrupted' : 'Application Logic Error'}
                </h1>

                <p className="text-slate-400 text-base max-w-md mx-auto mb-8 leading-relaxed">
                    {isConvexError
                        ? "Our backend infrastructure (Convex) is currently unresponsive. This usually happens during platform maintenance or unexpected load spikes. Your work remains cached locally."
                        : "Something went wrong while rendering the interface. The error details below will stay visible until you choose an action — please copy or screenshot them for support."
                    }
                </p>

                {/* Status Badge */}
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-full mb-10">
                    <div className={`w-2 h-2 rounded-full animate-pulse ${isConvexError ? 'bg-amber-500' : 'bg-rose-500'}`}></div>
                    <span className="text-2xs font-bold uppercase tracking-widest text-slate-300">
                        {isConvexError ? 'Syncing Status: Retrying...' : 'App Status: Error (manual retry required)'}
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
                        className="mt-4 text-2xs font-bold text-slate-500 hover:text-rose-400 uppercase tracking-widest transition-colors"
                    >
                        Hard Reset Local State
                    </button>
                </div>

                {/* Technical Error Bubble — stays visible so user can read/screenshot/copy */}
                {errorMessage && (
                    <div className="mt-12 p-4 bg-black/40 border border-white/5 rounded-2xl max-w-2xl w-full text-left overflow-hidden">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-slate-600"></div>
                                <span className="text-2xs font-bold text-slate-500 uppercase tracking-wider">Engine Error Log</span>
                            </div>
                            <button
                                onClick={this.handleCopyError}
                                className="flex items-center gap-1 text-2xs font-bold text-slate-400 hover:text-white transition-colors px-2 py-1 rounded border border-slate-700 hover:border-slate-500"
                            >
                                {this.copiedToClipboard ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                {this.copiedToClipboard ? 'Copied!' : 'Copy'}
                            </button>
                        </div>
                        <p className="font-mono text-2xs text-slate-500 break-all opacity-80 leading-relaxed">
                            {errorMessage}
                        </p>
                        {this.state.componentStack && (
                            <details className="mt-2">
                                <summary className="text-2xs font-bold text-slate-600 hover:text-slate-400 cursor-pointer uppercase tracking-wider">
                                    Component Stack (click to expand)
                                </summary>
                                <pre className="font-mono text-3xs text-slate-600 break-all whitespace-pre-wrap mt-2 max-h-48 overflow-y-auto">
                                    {this.state.componentStack}
                                </pre>
                            </details>
                        )}
                    </div>
                )}
            </div>
        );
    }
}

export default ConvexErrorBoundary;
