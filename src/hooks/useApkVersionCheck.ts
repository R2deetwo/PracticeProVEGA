/**
 * useApkVersionCheck — detects new APK builds and prompts the user to download.
 *
 * HOW IT WORKS
 * ------------
 * 1. On app launch (native only), reads the current app version via
 *    Capacitor's App plugin (App.getInfo() → version.build = versionCode).
 * 2. Polls /version.json (the web-hosted manifest) every 10 minutes.
 * 3. If version.json has apkVersionCode > current build AND
 *    apkBuildStatus === 'healthy' AND apkUrl is set, shows an update prompt.
 * 4. User clicks "Download Update" → opens the APK download URL in the
 *    system browser (which triggers the Android download manager).
 * 5. Failed builds (apkBuildStatus !== 'healthy') are NEVER shown to users.
 *
 * DIFFERENCES FROM useVersionCheck (web):
 * - Web: compares git SHA, auto-refreshes the page
 * - Native: compares APK versionCode, prompts user to download new APK
 * - Web: polls every 60s
 * - Native: polls every 10min (less aggressive — APK downloads are heavy)
 *
 * GATING:
 * - Only runs on native platforms (Capacitor.isNativePlatform())
 * - No-op in dev mode
 * - No-op if apkBuildStatus !== 'healthy'
 * - No-op if apkUrl is null/empty
 * - No-op if apkVersionCode <= current build
 */
import { useEffect, useRef, useState } from 'react';

const POLL_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const INITIAL_DELAY_MS = 5_000; // 5 seconds after launch

export interface ApkVersionCheckState {
  /** True when a new APK build is available and verified healthy. */
  updateAvailable: boolean;
  /** The version string of the new APK (e.g. "1.0.272"). */
  remoteVersion?: string;
  /** The version code of the new APK (e.g. 10272). */
  remoteVersionCode?: number;
  /** The download URL for the new APK. */
  apkUrl?: string;
  /** The current app's version code. */
  localVersionCode?: number;
  /** Open the APK download URL in the system browser. */
  downloadUpdate: () => void;
  /** Dismiss the prompt for now (will re-appear on next poll). */
  dismiss: () => void;
}

const isNative = typeof window !== 'undefined'
  && (window as any).Capacitor?.isNativePlatform?.();

const isDev = typeof import.meta !== 'undefined'
  && (import.meta as any).env?.DEV === true;

export function useApkVersionCheck(): ApkVersionCheckState {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [remoteVersion, setRemoteVersion] = useState<string | undefined>(undefined);
  const [remoteVersionCode, setRemoteVersionCode] = useState<number | undefined>(undefined);
  const [apkUrl, setApkUrl] = useState<string | undefined>(undefined);
  const [localVersionCode, setLocalVersionCode] = useState<number | undefined>(undefined);
  const [dismissed, setDismissed] = useState(false);
  const localBuildRef = useRef<number | undefined>(undefined);

  // Get the current app's version code on mount
  useEffect(() => {
    if (!isNative || isDev) return;

    (async () => {
      try {
        // Dynamic import to avoid bundling Capacitor in web builds
        const { App } = await import('@capacitor/app');
        const info = await App.getInfo();
        // version.build is the versionCode on Android
        const build = parseInt(info.version.build || '0');
        localBuildRef.current = build;
        setLocalVersionCode(build);
        console.log(`[useApkVersionCheck] Local versionCode: ${build}`);
      } catch (e) {
        console.warn('[useApkVersionCheck] Could not get app info:', e);
      }
    })();
  }, []);

  // Poll version.json for new APK builds
  useEffect(() => {
    if (!isNative || isDev) return;

    let cancelled = false;

    const check = async () => {
      try {
        // Fetch version.json from the production URL (not bundled local copy)
        const url = `https://practice-pro-vega.vercel.app/version.json?_=${Date.now()}`;
        const res = await fetch(url, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data) return;

        // GATE 1: Only show updates for healthy builds
        if (data.apkBuildStatus !== 'healthy') return;

        // GATE 2: Must have a download URL
        if (!data.apkUrl) return;

        // GATE 3: Must have a version code
        if (!data.apkVersionCode) return;

        const local = localBuildRef.current;
        if (local === undefined) return;

        // GATE 4: Remote versionCode must be GREATER than local
        if (data.apkVersionCode <= local) {
          setUpdateAvailable(false);
          return;
        }

        // All gates passed — show the update prompt
        setRemoteVersion(data.apkVersion);
        setRemoteVersionCode(data.apkVersionCode);
        setApkUrl(data.apkUrl);
        setUpdateAvailable(true);
        setDismissed(false);

        console.log(`[useApkVersionCheck] Update available: ${data.apkVersion} (code ${data.apkVersionCode}) > local ${local}`);
      } catch {
        // Network error — silently ignore, retry on next interval
      }
    };

    // Initial check after a short delay (let the app settle)
    const initialTimer = setTimeout(check, INITIAL_DELAY_MS);
    const interval = setInterval(check, POLL_INTERVAL_MS);

    // Also check when the app comes back to foreground
    let appListener: any;
    (async () => {
      try {
        const { App } = await import('@capacitor/app');
        appListener = await App.addListener('appStateChange', (state: any) => {
          if (state.isActive) check();
        });
      } catch {}
    })();

    return () => {
      cancelled = true;
      clearTimeout(initialTimer);
      clearInterval(interval);
      appListener?.remove?.();
    };
  }, []);

  const downloadUpdate = () => {
    if (!apkUrl) return;
    // Open the APK download URL in the system browser.
    // On Android, this triggers the download manager which downloads
    // the APK file. Once downloaded, the user taps the notification
    // to install (Android prompts "Install unknown app" permission).
    //
    // Note: We can't trigger a silent download + install without a
    // custom Capacitor plugin that uses DOWNLOAD_WITHOUT_NOTIFICATION
    // and ACTION_INSTALL_PACKAGE intents. For now, the browser approach
    // is the most reliable across all Android devices.
    window.open(apkUrl, '_system');
  };

  const dismiss = () => {
    setDismissed(true);
  };

  return {
    updateAvailable: updateAvailable && !dismissed,
    remoteVersion,
    remoteVersionCode,
    apkUrl,
    localVersionCode,
    downloadUpdate,
    dismiss,
  };
}
