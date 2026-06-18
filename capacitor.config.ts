import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor Configuration — PracticePro
 *
 * OPTION A (live Vercel URL): The Android app loads the live web app from
 * practice-pro-vega.vercel.app. This means:
 *   - Updates to Vercel automatically update the app (no APK rebuild needed)
 *   - Backend stays on Convex (no changes)
 *   - The APK is essentially a thin native wrapper around the web app
 *   - Smaller APK size, faster builds
 *
 * To switch to Option B (bundled offline app) later:
 *   1. Change server.url to undefined (or remove the server block)
 *   2. Run `npm run build` + `npx cap sync` before each APK build
 *   3. The web assets get bundled into the APK
 */
const config: CapacitorConfig = {
  appId: 'com.practicepro.app',
  appName: 'PracticePro',
  webDir: 'dist',
  // TASK: Switched to Option B (bundled assets).
  // The web app is now BAKED INTO the APK — no more loading from Vercel.
  // This means:
  //   - Every new APK = guaranteed latest JS/TS code (no WebView caching issues)
  //   - App works offline (loads instantly, no network needed for UI)
  //   - All JS changes show up immediately when you install a new APK
  //
  // The server.url is REMOVED. The APK loads from the bundled dist/ folder.
  // Convex backend is still remote (requires network for data).
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      // Show the native splash longer (2000ms) so there's NO black gap
      // between the native splash hiding and React mounting.
      // The native splash background is #0e0e11 (dark) which matches
      // the auth screen's dark gradient background — so the transition
      // from splash → auth screen is seamless (no black flash).
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0e0e11',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
