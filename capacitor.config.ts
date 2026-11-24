/**
 * Capacitor config for the MAIN PracticePro APK (com.practicepro.app).
 *
 * This is the DEFAULT config — the one CI uses when it runs
 * `npx cap sync android` after `npx vite build` (which outputs to dist/).
 *
 * The Founder APK (com.practicepro.admin) uses a separate config that
 * points to dist-admin/. The swap script (scripts/sync-admin-config.cjs)
 * temporarily replaces this file with the admin variant, runs cap sync,
 * then restores this file. So this file must always point to dist/ (the
 * main app) in the committed state.
 *
 * BUILD:
 *   npm run build           — builds the main app frontend → dist/
 *   npx cap sync android    — syncs dist/ into the Android project
 *   npm run apk:release     — builds the main release APK
 *
 * FOUNDER APK BUILD (separate):
 *   npm run build:admin     — builds the founder frontend → dist-admin/
 *   npm run cap:sync:admin  — runs sync-admin-config.cjs (swaps config, syncs, restores)
 *   npm run apk:admin:release — builds the founder release APK
 *
 * OWNER BRIEF 2026-11-25 (Splash Sequence): the native splash + plugin color
 * are now BLACK (#000000) — the standard launch opens black-first with zero
 * bright-green flash, then the in-app cinematic runs Black → PracticePro
 * (Black → Amber → Green) → Black → the single product mark (see
 * SplashScreen.tsx / splashEndCard.ts). The FOUNDER APK (capacitor.admin
 * .config.ts) keeps its own sequence untouched.
 */

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.practicepro.app',
  appName: 'PracticePro',
  webDir: 'dist',
  backgroundColor: '#000000',
  android: {
    // allowMixedContent disabled (Aug 2026) — no code uses HTTP URLs.
    // All API calls go through HTTPS (Convex, Paystack, Firebase, Gemini).
    // The XML namespace URLs in docxExport.ts are not actual HTTP requests.
    // Leaving this on would be an unnecessary security loosening.
    allowMixedContent: false,
    captureInput: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    // ── SYSTEM BARS / EDGE-TO-EDGE (owner bug report 2026-11-25: the outer
    //    white gaps above the ALOA Vox header and below the bottom tab bar) ──
    // insetsHandling 'disable' turns OFF Capacitor 8's SystemBars insets
    // machinery. Its legacy path (taken whenever the device WebView is older
    // than v140 — common on Nigerian-market Transsion/Tecno builds — or the
    // viewport-fit detection has not settled) PADS the WebView's parent view
    // by the system-bar insets, which paints the window background in those
    // bands AND zeroes env(safe-area-inset-*) for the web layer. Combined
    // with our own MainActivity --native-safe-* bridge, that DOUBLE-inset
    // produced exactly the reported symptom: a dead white band between the
    // status bar and the header, and another between the tab bar and the
    // gesture lip.
    // With it disabled, the WebView fills the window edge-to-edge (MainActivity
    // forces setDecorFitsSystemWindows(false) on every OS version) and the
    // ONE inset source is the MainActivity bridge + env(): the web layer's
    // max(env(safe-area-inset-*), var(--native-safe-*)) resolves whichever
    // source reports correctly for that device's WebView.
    SystemBars: {
      insetsHandling: 'disable',
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#000000',
      androidScaleType: 'CENTER_CROP',
      showSpinner: true,
      androidSpinnerStyle: 'large',
      spinnerColor: '#FFFFFF',
      splashFullScreen: true,
      splashImmersive: true,
    },
    LocalNotifications: {
      smallIcon: 'ic_notification',
      iconColor: '#16A34A',
      sound: 'notification.wav',
    },
  },
};

export default config;
