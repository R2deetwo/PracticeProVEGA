/**
 * ConvexErrorBoundary — Sleek Dark State Error Boundary
 *
 * DESIGN PHILOSOPHY:
 *   "When something breaks, the UI should feel calm, not alarming."
 *
 * RECOVERY MODEL (rewritten 2026-09-05 after the "death loop" incident —
 * see src/utils/errorRecovery.ts for the full story):
 *   1. Errors are CLASSIFIED first (auth / permission / connection / data /
 *      render / unknown). Classification order matters: auth is checked
 *      before connection so the `[CONVEX Q(...)]` transport prefix can't
 *      disguise a session rejection as a network blip.
 *   2. Every category has a BOUNDED retry policy. The old boundary retried
 *      every 3 seconds forever with a counter labeled "/3" — producing
 *      "attempt 22 of 3" and an endless splash ↔ error remount cycle.
 *      Now: auth gets 2 short retries (storage race only), connection
 *      gets 5 with exponential backoff (3s→48s), everything else 0–2.
 *      When a policy is exhausted we STOP and surface manual actions.
 *   3. Auth errors resolve via a clean sign-in: the primary button wipes
 *      ALL client auth state (sessionInvalidation.clearAllAuthStorage) and
 *      routes to the correct login surface — no dead bearers left behind.
 *   4. A 60s error-free window resets the retry burst, so a long-lived
 *      healthy session never accumulates attempts across unrelated
 *      transient hiccups.
 *   5. Technical diagnostics stay available (collapsible) and — because
 *      retries are capped and auth screens never auto-retry — the panel
 *      no longer vanishes mid-inspection.
 */

import React, { Component, ErrorInfo, ReactNode, useState, useEffect, useRef } from 'react';
import {
  classifyConvexError,
  RETRY_POLICIES,
  retryDelayFor,
  STABILITY_RESET_MS,
  ErrorCategory,
} from '../utils/errorRecovery';
import { clearAllAuthStorage, authSignInUrl } from '../utils/sessionInvalidation';

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
  category: ErrorCategory;
  onRetry: () => void;
  attemptCount: number;
  maxAutoRetries: number;
  isRetrying: boolean;
  /** True when the category's retry policy is exhausted — auto-retry has stopped. */
  exhausted: boolean;
}

const SleekErrorScreen: React.FC<SleekErrorScreenProps> = ({
  error,
  componentStack,
  category,
  onRetry,
  attemptCount,
  maxAutoRetries,
  isRetrying,
  exhausted,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  const translated = classifyConvexError(error.message);

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

  // Clean sign-in: wipe ALL client auth state (email session, bearer,
  // offline cache, impersonation leftovers) and land on the correct login
  // surface. This is the ONLY sane resolution for an auth-category error —
  // and it must not leave dead keys behind for the next boot to trip on.
  const handleSignInAgain = () => {
    clearAllAuthStorage();
    window.location.href = authSignInUrl();
  };

  // Non-auth escape hatch — also uses the shared invalidation so a dead
  // bearer can't survive the click.
  const handleBackToLogin = () => {
    clearAllAuthStorage();
    window.location.href = authSignInUrl();
  };

  const isAuth = category === 'auth';

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
            <svg className={`w-7 h-7 ${isAuth ? 'text-sky-400' : 'text-emerald-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              {isAuth ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              )}
            </svg>
          </div>
        </div>

        {/* Friendly message */}
        <h1 className="text-2xl font-bold mb-3 tracking-tight" style={{ color: '#f8fafc' }}>
          {translated.title}
        </h1>
        <p className="text-sm leading-relaxed mb-8" style={{ color: '#94a3b8' }}>
          {translated.subtitle}
          {exhausted && !isAuth && category === 'connection' && (
            <span className="block mt-2" style={{ color: '#fbbf24' }}>
              We couldn\u2019t reconnect automatically. Check your internet connection, then try again.
            </span>
          )}
        </p>

        {/* Action buttons */}
        <div className="flex flex-col gap-3 w-full max-w-xs">
          {isAuth ? (
            /* Auth: the primary resolution is a clean sign-in. Retrying a
               dead session forever is what caused the incident. */
            <button
              onClick={handleSignInAgain}
              className="w-full py-3.5 bg-sky-600 hover:bg-sky-500 text-white rounded-md text-sm font-bold transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
              Sign in again
            </button>
          ) : (
            <button
              onClick={onRetry}
              disabled={isRetrying}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
          )}

          {isAuth && (
            <button
              onClick={handleHardReload}
              className="w-full py-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-md text-sm font-bold border border-white/10 transition-colors"
            >
              Reload App
            </button>
          )}

          <button
            onClick={isAuth ? handleHardReload : handleBackToLogin}
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
            <div className="mt-3 p-4 bg-black/50 border border-white/5 rounded-lg text-left overflow-hidden">
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

      {/* Status pill (bottom right corner) — only while an automatic retry
          is genuinely scheduled, and the label tells the TRUTH: the real
          attempt number over the policy's real cap. The incident UI said
          "Attempt 22/3" because the counter was uncapped and the label was
          hardcoded. Never again. */}
      {isRetrying && maxAutoRetries > 0 && (
        <div className="fixed bottom-6 right-6 z-20 flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-xs font-bold text-amber-500">
            {category === 'auth'
              ? 'Restoring your session\u2026'
              : `Reconnecting... (Attempt ${Math.min(attemptCount + 1, maxAutoRetries)}/${maxAutoRetries})`}
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
  category: ErrorCategory;
  attemptCount: number;
  isRetrying: boolean;
  exhausted: boolean;
}

class ConvexErrorBoundary extends Component<Props, State> {
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private stabilityTimer: ReturnType<typeof setTimeout> | null = null;
  /** Automatic retries performed in the CURRENT burst (resets after
      STABILITY_RESET_MS of error-free rendering — see armStabilityReset). */
  private attempts = 0;

  public state: State = {
    hasError: false,
    error: null,
    componentStack: undefined,
    category: 'unknown',
    attemptCount: 0,
    isRetrying: false,
    exhausted: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      isRetrying: false,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ConvexErrorBoundary] Caught error:', error.message, errorInfo?.componentStack);

    const category = classifyConvexError(error.message).category;
    const policy = RETRY_POLICIES[category];
    const delay = retryDelayFor(policy, this.attempts);

    this.cancelStabilityReset();
    this.setState({
      componentStack: errorInfo?.componentStack ?? undefined,
      category,
      exhausted: delay === null,
    });

    if (delay !== null) {
      this.scheduleRetry(delay);
    } else {
      // Policy exhausted (or never had retries): STOP. No timer, no
      // remount churn, no loop. The screen stays put with manual actions.
      this.clearRetryTimer();
      this.setState({ isRetrying: false });
    }
  }

  private scheduleRetry(delayMs: number) {
    this.clearRetryTimer();
    this.setState({ isRetrying: true });
    this.retryTimer = setTimeout(() => {
      this.attempts++;
      this.setState({
        hasError: false,
        error: null,
        componentStack: undefined,
        isRetrying: false,
        attemptCount: this.attempts,
      });
      // Children remount now. If they render error-free for long enough,
      // the burst is forgotten; if they throw again, componentDidCatch
      // runs with the updated attempt count.
      this.armStabilityReset();
    }, delayMs);
  }

  /** Manual "Try Again" — resets the burst so the user gets a full policy. */
  private handleManualRetry = () => {
    this.attempts = 0;
    this.setState({ exhausted: false, attemptCount: 0 });
    this.scheduleRetry(500);
  };

  private armStabilityReset() {
    this.cancelStabilityReset();
    this.stabilityTimer = setTimeout(() => {
      this.attempts = 0;
      this.setState({ attemptCount: 0, exhausted: false });
    }, STABILITY_RESET_MS);
  }

  private clearRetryTimer() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private cancelStabilityReset() {
    if (this.stabilityTimer) {
      clearTimeout(this.stabilityTimer);
      this.stabilityTimer = null;
    }
  }

  public componentWillUnmount() {
    this.clearRetryTimer();
    this.cancelStabilityReset();
  }

  public render() {
    const { hasError, error, componentStack, category, attemptCount, isRetrying, exhausted } = this.state;

    if (hasError && error) {
      return (
        <SleekErrorScreen
          error={error}
          componentStack={componentStack}
          category={category}
          onRetry={this.handleManualRetry}
          attemptCount={attemptCount}
          maxAutoRetries={RETRY_POLICIES[category].maxAutoRetries}
          isRetrying={isRetrying}
          exhausted={exhausted}
        />
      );
    }

    return this.props.children;
  }
}

export default ConvexErrorBoundary;
