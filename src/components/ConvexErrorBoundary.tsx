/**
 * ConvexErrorBoundary — Sleek Dark State Error Boundary
 *
 * DESIGN PHILOSOPHY:
 *   "When something breaks, the UI should feel calm, not alarming."
 *
 * Features:
 *   1. Full-screen dark canvas (#0a0a0a) with a subtle mouse-tracking
 *      radial gradient ("flashlight" effect) that follows the cursor.
 *   2. Friendly, plain-English error messages (no raw stack traces visible
 *      by default). Technical details hidden behind a collapsible accordion.
 *   3. Silent background retry loop — retries happen BEHIND the error UI
 *      without remounting the splash screen. A subtle amber pill shows
 *      "Reconnecting... (Attempt 2/3)" in the corner.
 *   4. Zero splash re-renders — the error boundary catches the fault,
 *      shows the dark state, retries silently, and transitions back
 *      smoothly when the retry succeeds.
 */

import React, { Component, ErrorInfo, ReactNode, useState, useEffect, useRef } from 'react';

// ─── Error translation map ───────────────────────────────────────────────────

function translateError(error: Error): { title: string; subtitle: string; category: string } {
  const msg = error?.message || '';

  // Network / Convex connection errors
  if (msg.includes('CONVEX') || msg.includes('WebSocket') || msg.includes('convex.cloud') || msg.includes('network')) {
    return {
      title: 'Connection interrupted',
      subtitle: 'Your data is safe. We\u2019re reconnecting to the server automatically \u2014 this usually resolves in a few seconds.',
      category: 'connection',
    };
  }

  // Authentication errors
  if (msg.includes('Unauthenticated') || msg.includes('Unauthorized') || msg.includes('not logged in')) {
    return {
      title: 'Session needs refreshing',
      subtitle: 'Your session may have expired. We\u2019re attempting to restore it automatically. If this persists, please sign in again.',
      category: 'auth',
    };
  }

  // Data not found
  if (msg.includes('not found') || msg.includes('does not exist') || msg.includes('Record not found')) {
    return {
      title: 'Something went missing',
      subtitle: 'The item you were looking for may have been moved or deleted. Try navigating back and refreshing.',
      category: 'data',
    };
  }

  // Render errors (TypeError, etc.)
  if (msg.includes('TypeError') || msg.includes('is not a function') || msg.includes('is undefined') || msg.includes('is null')) {
    return {
      title: 'We\u2019ve hit a slight operational bump',
      subtitle: 'Don\u2019t worry \u2014 your data is safe. Our system is attempting to recover automatically.',
      category: 'render',
    };
  }

  // Default
  return {
    title: 'We\u2019ve hit a slight operational bump',
    subtitle: 'Your data is safe. Our system is attempting to recover automatically \u2014 this usually resolves in a moment.',
    category: 'unknown',
  };
}

// ─── Flashlight Background Component ─────────────────────────────────────────

const FlashlightBackground: React.FC = () => {
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.4 });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setMousePos({
          x: e.clientX / window.innerWidth,
          y: e.clientY / window.innerHeight,
        });
      });
    };
    window.addEventListener('mousemove', handleMove);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const px = (mousePos.x * 100).toFixed(1);
  const py = (mousePos.y * 100).toFixed(1);

  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none"
      style={{
        background: `radial-gradient(circle at ${px}% ${py}%, rgba(16, 185, 129, 0.06) 0%, rgba(16, 185, 129, 0.02) 25%, transparent 50%)`,
        transition: 'background 0.3s ease-out',
      }}
    />
  );
};

// ─── Sleek Error Screen ──────────────────────────────────────────────────────

interface SleekErrorScreenProps {
  error: Error;
  componentStack?: string;
  onRetry: () => void;
  retryCount: number;
  isRetrying: boolean;
}

const SleekErrorScreen: React.FC<SleekErrorScreenProps> = ({ error, componentStack, onRetry, retryCount, isRetrying }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  const translated = translateError(error);

  const handleCopy = () => {
    const text = [
      `Error: ${error.message}`,
      '',
      'Stack:',
      error.stack || '(no stack)',
      '',
      'Component Stack:',
      componentStack || '(no component stack)',
      '',
      `Time: ${new Date().toISOString()}`,
      `URL: ${window.location.href}`,
    ].join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const handleHardReload = () => {
    try { localStorage.removeItem('practicepro_session_locked'); } catch {}
    window.location.reload();
  };

  const handleBackToLogin = () => {
    try { localStorage.removeItem('practicepro_user_session'); } catch {}
    try { localStorage.removeItem('practicepro_portal_session'); } catch {}
    try { localStorage.removeItem('practicepro_cached_user'); } catch {}
    try { sessionStorage.removeItem('practicepro_user_session'); } catch {}
    try { sessionStorage.removeItem('practicepro_portal_session'); } catch {}
    window.location.href = '/';
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center px-6"
      style={{ background: '#0a0a0a', color: '#f8fafc', fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      <FlashlightBackground />

      {/* Content — centered and elevated above taskbar */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-md" style={{ marginBottom: '8vh' }}>

        {/* Subtle icon */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-emerald-500/10 blur-2xl rounded-full scale-150 animate-pulse" style={{ animationDuration: '3s' }} />
          <div className="relative w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
        </div>

        {/* Friendly message */}
        <h1 className="text-2xl font-bold mb-3 tracking-tight" style={{ color: '#f8fafc' }}>
          {translated.title}
        </h1>
        <p className="text-sm leading-relaxed mb-8" style={{ color: '#94a3b8' }}>
          {translated.subtitle}
        </p>

        {/* Action buttons */}
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={onRetry}
            disabled={isRetrying}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isRetrying ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Recovering...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                Try Again
              </>
            )}
          </button>

          <button
            onClick={handleHardReload}
            className="w-full py-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-sm font-bold border border-white/10 transition-colors"
          >
            Reload App
          </button>

          <button
            onClick={handleBackToLogin}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors mt-1"
          >
            Return to Home
          </button>
        </div>

        {/* Collapsible technical diagnostics */}
        <div className="mt-8 w-full max-w-md">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-300 transition-colors"
          >
            <svg className={`w-3 h-3 transition-transform ${showDetails ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            {showDetails ? 'Hide' : 'View'} Technical Diagnostics
          </button>

          {showDetails && (
            <div className="mt-3 p-4 bg-black/50 border border-white/5 rounded-xl text-left overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Error Log</span>
                <button onClick={handleCopy} className="text-xs text-slate-500 hover:text-emerald-400 transition-colors">
                  {copied ? '\u2713 Copied' : 'Copy'}
                </button>
              </div>
              <pre className="font-mono text-xs text-slate-600 break-all whitespace-pre-wrap max-h-32 overflow-y-auto leading-relaxed">
                {error.message}
                {error.stack ? '\n\n' + error.stack.slice(0, 500) : ''}
                {componentStack ? '\n\nComponent Stack:\n' + componentStack.slice(0, 300) : ''}
              </pre>
              <p className="text-xs text-slate-700 mt-2">
                {new Date().toISOString()} \u00b7 {window.location.href}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Silent retry pill (bottom right corner) */}
      {isRetrying && (
        <div className="fixed bottom-6 right-6 z-20 flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-xs font-bold text-amber-500">
            Reconnecting... (Attempt {retryCount}/3)
          </span>
        </div>
      )}
    </div>
  );
};

// ─── Error Boundary Class Component ──────────────────────────────────────────

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string | undefined;
  retryCount: number;
  isRetrying: boolean;
}

class ConvexErrorBoundary extends Component<Props, State> {
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  // Instance field — survives across errors (unlike state which gets reset)
  private totalRetryCount = 0;
  private copiedToClipboard = false;

  public state: State = {
    hasError: false,
    error: null,
    componentStack: undefined,
    retryCount: 0,
    isRetrying: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      isRetrying: false, // Reset retrying flag on new error
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ConvexErrorBoundary] Caught error:', error.message, errorInfo?.componentStack);
    this.setState({ componentStack: errorInfo?.componentStack });

    // Start silent background retry
    this.startSilentRetry();
  }

  private startSilentRetry = () => {
    if (this.retryTimer) clearTimeout(this.retryTimer);

    this.setState({ isRetrying: true });

    // Retry after 3 seconds
    this.retryTimer = setTimeout(() => {
      this.totalRetryCount++;
      this.setState({
        hasError: false,
        error: null,
        componentStack: undefined,
        isRetrying: false,
        retryCount: this.totalRetryCount,
      });

      // If the app crashes again, getDerivedStateFromError will fire
      // and the error screen will reappear. No splash screen flash.
    }, 3000);
  };

  public componentWillUnmount() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }

  private handleManualRetry = () => {
    if (this.retryTimer) clearTimeout(this.retryTimer);

    this.setState({ isRetrying: true });

    this.retryTimer = setTimeout(() => {
      this.totalRetryCount++;
      this.setState({
        hasError: false,
        error: null,
        componentStack: undefined,
        isRetrying: false,
        retryCount: this.totalRetryCount,
      });
    }, 500);
  };

  public render() {
    const { hasError, error, componentStack, retryCount, isRetrying } = this.state;

    if (hasError && error) {
      return (
        <SleekErrorScreen
          error={error}
          componentStack={componentStack}
          onRetry={this.handleManualRetry}
          retryCount={retryCount}
          isRetrying={isRetrying}
        />
      );
    }

    return this.props.children;
  }
}

export default ConvexErrorBoundary;
