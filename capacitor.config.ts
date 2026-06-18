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
  // OPTION A: Load the live Vercel deployment.
  // The app opens this URL on launch. All routing, auth, and data stay
  // on the web app — the APK is just a native shell.
  server: {
    url: 'https://practice-pro-vega.vercel.app',
    cleartext: true,
    androidScheme: 'https',
  },
  // Android-specific configuration
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false, // Disable in production
  },
  // Native plugins configuration
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#16A34A', // PracticePro green
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      androidSpinnerStyle: 'large',
      iosSpinnerStyle: 'small',
      spinnerColor: '#ffffff',
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
