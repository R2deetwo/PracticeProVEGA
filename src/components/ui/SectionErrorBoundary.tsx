/**
 * SectionErrorBoundary — a scope-limited error boundary for page SECTIONS.
 *
 * WHY THIS EXISTS (2026-09-14 incident): the root-level ConvexErrorBoundary
 * wraps the entire app, so a single failed `useQuery` in one tab replaced
 * the WHOLE screen with the full-screen "Something went wrong" panel. The
 * trigger: the Vercel frontend auto-deploys on every push, but the Convex
 * production backend only deploys via the manual promote workflow — so the
 * Scheduled tab shipped calling `automationEngine:getUpcomingAutomation`
 * before the backend had it, and clicking "Scheduled" killed the app.
 *
 * THE CONTRACT:
 *   1. A failing section degrades to a compact inline card — the rest of
 *      the page (and app) stays fully interactive.
 *   2. "Could not find public function" errors are recognised as a
 *      backend/frontend version skew and get a dedicated explanation +
 *      a copyable diagnostic, because the fix (deploy the backend) is on
 *      a different surface than anything the user can click.
 *   3. The boundary NEVER retries automatically — remount loops are the
 *      failure mode the root boundary was rewritten to avoid. One click,
 *      one manual retry, logged to console for forensics.
 */

import React, { ErrorInfo, ReactNode } from 'react';

interface SectionErrorBoundaryProps {
  /** Section name shown in the degraded card, e.g. "Scheduled messages". */
  sectionName: string;
  children: ReactNode;
}

interface SectionErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/** Detect the Convex version-skew signature: frontend calls a function the
 *  deployed backend doesn't have (yet). Matches both the runtime error
 *  text and the log-prefixed form Convex raises through useQuery. */
const isFunctionMissingError = (message: string): boolean =>
  /could not find (public )?function/i.test(message);

export class SectionErrorBoundary extends React.Component<
  SectionErrorBoundaryProps,
  SectionErrorBoundaryState
> {
  public state: SectionErrorBoundaryState = { hasError: false, error: null };

  public static getDerivedStateFromError(error: Error): Partial<SectionErrorBoundaryState> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, info: ErrorInfo) {
    // Scoped log: enough for forensics, not enough to spam.
    console.error(
      `[SectionErrorBoundary] ${this.props.sectionName} failed:`,
      error.message,
      info?.componentStack?.split('\n').slice(0, 4).join('\n')
    );
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (!this.state.hasError || !this.state.error) {
      return this.props.children;
    }

    const versionSkew = isFunctionMissingError(this.state.error.message);

    return (
      <div
        className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900/60"
        role="alert"
      >
        <div className="flex items-start gap-3">
          <svg
            className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100 mb-1">
              {this.props.sectionName} couldn't load
            </h4>
            {versionSkew ? (
              <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed mb-3">
                This section needs a newer version of the app's backend than what is currently
                deployed. Everything else keeps working — the backend update usually lands within
                a day. If it persists, ask your admin to promote the latest release.
              </p>
            ) : (
              <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed mb-3">
                Something went wrong loading this section. Other parts of the app are unaffected.
                You can retry now, or refresh the page if it keeps failing.
              </p>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={this.handleRetry}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-slate-700 dark:hover:bg-zinc-300 transition-colors"
              >
                Try again
              </button>
              {versionSkew && (
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(this.state.error?.message || '').catch(() => {})}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Copy diagnostic
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default SectionErrorBoundary;
