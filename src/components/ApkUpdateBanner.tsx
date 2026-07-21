import React from 'react';
import { useApkVersionCheck } from '../hooks/useApkVersionCheck';

/**
 * ApkUpdateBanner — shows a non-intrusive update prompt at the bottom
 * of the screen when a new APK build is available.
 *
 * Similar to VersionRefreshBanner (web) but for native/APK:
 * - Shows "A new version is available" with version number
 * - "Download Update" button opens the APK download URL
 * - "Dismiss" button hides the banner until the next poll
 * - Only renders on native platforms (the hook is a no-op on web)
 * - Mobile-optimized: full-width on small screens, centered on larger
 */
const ApkUpdateBanner: React.FC = () => {
  const { updateAvailable, remoteVersion, downloadUpdate, dismiss } = useApkVersionCheck();

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[4000] px-4 py-3 pb-safe animate-slide-in-up">
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Brand accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-primary-600 to-primary-500" />

        <div className="p-4">
            <div className="flex items-start gap-3 mb-3">
                <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-primary-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 H1m6-6l4 4m-4-4l-4 4m4-4V1" />
                    </svg>
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 leading-tight">
                        A new version is available
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Version {remoteVersion} is ready to install.
                    </p>
                </div>
            </div>

            <div className="flex gap-2">
                <button
                    onClick={downloadUpdate}
                    className="flex-1 px-4 py-2.5 bg-primary-600 text-white text-sm font-bold rounded-xl hover:bg-primary-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download Update
                </button>
                <button
                    onClick={dismiss}
                    className="px-3 py-2.5 bg-slate-100 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-200 active:scale-[0.98] transition-all"
                >
                    Later
                </button>
            </div>

            <p className="text-3xs text-slate-400 mt-2 text-center leading-relaxed">
                The update will download in your browser. Tap the downloaded file to install.
            </p>
        </div>
      </div>
    </div>
  );
};

export default ApkUpdateBanner;
