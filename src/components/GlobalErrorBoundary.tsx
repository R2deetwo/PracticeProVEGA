
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2, XCircle } from 'lucide-react';
import { captureError } from '../utils/sentry';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: any;
  errorInfo: string;
}

class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: '',
  };

  public static getDerivedStateFromError(error: any): State {
    return { hasError: true, error, errorInfo: '' };
  }

  public componentDidCatch(error: any, errorInfo: ErrorInfo) {
    console.error('[GlobalErrorBoundary] Uncaught error:', error, errorInfo);
    // Report to Sentry so the dev team sees production crashes
    captureError(error, { componentStack: errorInfo?.componentStack });
    this.setState({ errorInfo: errorInfo?.componentStack || '' });
  }

  private handleHardReset = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  };

  private getErrorMessage(error: any): string {
    if (!error) return 'Unknown Error';
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;
    if (typeof error === 'object') {
      if ('$$typeof' in error) return 'A UI rendering error occurred (React element returned as error).';
      try { return JSON.stringify(error); } catch { return 'Non-serializable Error Object'; }
    }
    return String(error);
  }

  public render() {
    if (this.state.hasError) {
      const rawMsg = this.getErrorMessage(this.state.error);
      // In production, show a user-friendly message instead of raw error details.
      // The raw error is still logged to console for developer debugging.
      const msg = process.env.NODE_ENV === 'development'
        ? rawMsg
        : 'Something went wrong. Please try reloading the page. If the problem persists, contact support.';

      try {
        return (
          <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', color: '#0f172a', padding: '24px', textAlign: 'center', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, fontSize: 28, color: '#ef4444' }}><AlertTriangle size={32} /></div>
            <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, margin: '0 0 8px' }}>Application Error</h1>
            <p style={{ color: '#475569', marginBottom: 32, maxWidth: 480 }}>
              An unexpected error occurred. Your data is safe.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 300 }}>
              <button
                onClick={() => window.location.reload()}
                style={{ padding: '12px 24px', background: '#0f172a', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 14 }}
              >
                <RefreshCw size={14} style={{ display: 'inline', marginRight: 6 }} /> Reload Page
              </button>
              <button
                onClick={this.handleHardReset}
                style={{ padding: '12px 24px', background: 'white', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 14 }}
              >
                <Trash2 size={14} style={{ display: 'inline', marginRight: 6 }} /> Reset Data &amp; Sign Out
              </button>
            </div>
            {/* Error details — ONLY shown in development. In production, users
                see a clean error message without stack traces or internal details. */}
            {process.env.NODE_ENV === 'development' && (
            <div style={{ marginTop: 32, padding: 16, background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, maxWidth: 680, width: '100%', textAlign: 'left', overflowX: 'auto' }}>
              <p style={{ fontFamily: 'monospace', fontSize: 13, color: '#dc2626', fontWeight: 700, marginBottom: 8, wordBreak: 'break-all' }}>
                <XCircle size={14} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 4 }} /> {msg}
              </p>
              {this.state.errorInfo && (
                <pre style={{ fontFamily: 'monospace', fontSize: 10, color: '#64748b', whiteSpace: 'pre-wrap', marginTop: 8, overflow: 'auto', maxHeight: 200 }}>
                  {this.state.errorInfo}
                </pre>
              )}
            </div>
            )}
          </div>
        );
      } catch (renderError) {
        // Absolute last resort — directly inject HTML if even our error UI fails
        if (typeof document !== 'undefined') {
          document.body.style.background = '#fff';
          document.body.style.margin = '0';
          document.body.style.fontFamily = 'sans-serif';
          document.body.innerHTML = `
            <div style="padding:40px;max-width:600px;margin:40px auto;">
              <h1 style="color:#dc2626;font-size:24px;margin-bottom:12px;">⚠️ Critical Render Error</h1>
              <pre style="background:#f1f5f9;padding:12px;border-radius:6px;font-size:12px;overflow:auto;border:1px solid #e2e8f0;">${msg}</pre>
              <button onclick="localStorage.clear();sessionStorage.clear();location.reload()" style="margin-top:16px;padding:12px 24px;background:#0f172a;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:700;font-size:14px;">Reset &amp; Reload</button>
            </div>`;
        }
        return null;
      }
    }

    return (this as any).props.children;
  }
}

export default GlobalErrorBoundary;
