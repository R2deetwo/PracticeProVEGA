
import * as React from 'react';

interface Props {
  children?: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    const { children, fallback } = (this as any).props;
    const { hasError, error } = this.state;

    if (hasError) {
      return fallback || (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-8 text-center bg-slate-50 dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-800">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Something went wrong</h2>
            <p className="text-slate-500 dark:text-zinc-400 mb-6 max-w-md">
                We encountered an unexpected error in this component. Your data is safe. Please try refreshing the page.
            </p>
            <button 
                onClick={() => window.location.reload()} 
                className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg font-semibold hover:opacity-90 transition-opacity"
            >
                Refresh Application
            </button>
            {error && (
                <pre className="mt-8 p-4 bg-slate-200 dark:bg-black rounded text-xs text-left overflow-auto max-w-full whitespace-pre-wrap break-all">
                    {error.toString()}
                    {error.stack ? '\n\n' + error.stack.split('\n').slice(0, 5).join('\n') : ''}
                </pre>
            )}
        </div>
      );
    }

    return children;
  }
}

export default ErrorBoundary;