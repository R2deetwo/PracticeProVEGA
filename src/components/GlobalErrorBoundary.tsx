/**
 * GlobalErrorBoundary — Sleek dark error screen (matches ConvexErrorBoundary)
 *
 * This is the OUTER error boundary that catches render crashes the
 * ConvexErrorBoundary might miss. Uses the same sleek dark aesthetic.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { captureError } from '../utils/sentry';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: any;
  errorInfo: string;
  showDetails: boolean;
}

class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: '',
    showDetails: false,
  };

  public static getDerivedStateFromError(error: any): Partial<State> {
    return { hasError: true, error, showDetails: false };
  }

  public componentDidCatch(error: any, errorInfo: ErrorInfo) {
    console.error('[GlobalErrorBoundary] Uncaught error:', error, errorInfo);
    captureError(error, { componentStack: errorInfo?.componentStack });
    this.setState({ errorInfo: errorInfo?.componentStack || '' });
  }

  private handleReload = () => {
    try { localStorage.removeItem('practicepro_session_locked'); } catch {}
    window.location.reload();
  };

  private handleHardReset = () => {
    try { localStorage.clear(); } catch {}
    try { sessionStorage.clear(); } catch {}
    window.location.href = '/';
  };

  private getErrorMessage(error: any): string {
    if (!error) return 'Unknown Error';
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;
    try { return JSON.stringify(error); } catch { return String(error); }
  }

  public render() {
    if (this.state.hasError) {
      const rawMsg = this.getErrorMessage(this.state.error);

      try {
        return (
          <div
            className="fixed inset-0 z-[99999] flex flex-col items-center justify-center px-6"
            style={{ background: '#0a0a0a', color: '#f8fafc', fontFamily: 'Inter, system-ui, sans-serif' }}
          >
            {/* Subtle glow */}
            <div className="absolute inset-0 pointer-events-none" style={{
              background: 'radial-gradient(circle at 50% 40%, rgba(239, 68, 68, 0.04) 0%, transparent 50%)',
            }} />

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center text-center max-w-md" style={{ marginBottom: '8vh' }}>

              {/* Icon */}
              <div className="relative mb-8">
                <div className="absolute inset-0 bg-rose-500/10 blur-2xl rounded-full scale-150" />
                <div className="relative w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <svg className="w-7 h-7 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                </div>
              </div>

              {/* Friendly message */}
              <h1 className="text-2xl font-bold mb-3 tracking-tight">
                We've hit a slight operational bump
              </h1>
              <p className="text-sm leading-relaxed mb-8" style={{ color: '#94a3b8' }}>
                Your data is safe. This is a temporary issue — try reloading the app.
                If the problem persists, your work is backed up locally.
              </p>

              {/* Actions */}
              <div className="flex flex-col gap-3 w-full max-w-xs">
                <button
                  onClick={this.handleReload}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                  Reload App
                </button>

                <button
                  onClick={this.handleHardReset}
                  className="w-full py-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-sm font-bold border border-white/10 transition-colors"
                >
                  Return to Home
                </button>
              </div>

              {/* Collapsible technical diagnostics */}
              <div className="mt-8 w-full max-w-md">
                <button
                  onClick={() => this.setState({ showDetails: !this.state.showDetails })}
                  className="w-full flex items-center justify-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <svg className={`w-3 h-3 transition-transform ${this.state.showDetails ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  {this.state.showDetails ? 'Hide' : 'View'} Technical Diagnostics
                </button>

                {this.state.showDetails && (
                  <div className="mt-3 p-4 bg-black/50 border border-white/5 rounded-xl text-left overflow-hidden">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Error Log</p>
                    <pre className="font-mono text-xs text-slate-600 break-all whitespace-pre-wrap max-h-32 overflow-y-auto leading-relaxed">
                      {rawMsg}
                      {this.state.errorInfo ? '\n\nComponent Stack:\n' + this.state.errorInfo.slice(0, 300) : ''}
                    </pre>
                    <p className="text-xs text-slate-700 mt-2">
                      {new Date().toISOString()} \u00b7 {window.location.href}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      } catch (renderError) {
        // Absolute last resort
        if (typeof document !== 'undefined') {
          document.body.style.background = '#0a0a0a';
          document.body.style.margin = '0';
          document.body.style.color = '#f8fafc';
          document.body.style.fontFamily = 'Inter, sans-serif';
          document.body.innerHTML = `<div style="padding:40px;max-width:500px;margin:40px auto;text-align:center;"><h1 style="font-size:22px;margin-bottom:12px;">We've hit a slight bump</h1><p style="color:#94a3b8;margin-bottom:24px;">Your data is safe. Please reload the page.</p><button onclick="localStorage.clear();sessionStorage.clear();location.href='/'" style="padding:12px 24px;background:#10b981;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700;font-size:14px;">Return to Home</button></div>`;
        }
        return null;
      }
    }

    return this.props.children;
  }
}

export default GlobalErrorBoundary;
