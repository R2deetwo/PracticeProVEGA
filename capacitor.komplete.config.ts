/**
 * Capacitor config for the KOMPLETE product APK variant.
 *
 * Same applicationId as the universal build (com.practicepro.app) — a Vega
 * APK installs/updates over any existing install; only the wrapper branding
 * differs: the home-screen label says "Vega" and the launcher icon carries
 * the Twin Coins. Brand Clarity Pass, Phase 2 (Gate B, option 2 — owner's stated
 * preference): real-estate attorneys running both sides download "Komplete".
 *
 * Built via:  npm run apk:komplete:release
 *   (scripts/sync-product-config.cjs --product komplete swaps this in, syncs,
 *    patches strings.xml app_name + the launcher icon set, builds, restores)
 *
 * OWNER BRIEF 2026-11-25 (Splash Sequence): the native splash + plugin
 * color are now BLACK (#000000) — the standard launch opens black-first with
 * zero bright-green flash, then the in-app cinematic runs Black → PracticePro
 * (Black → Amber → Green) → Black → the single product mark (see
 * SplashScreen.tsx / splashEndCard.ts). The ADMIN/FOUNDER app keeps its own
 * sequence untouched.
 */

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.practicepro.app',
  appName: 'Komplete',
  webDir: 'dist',
  backgroundColor: '#000000',
  android: {
    allowMixedContent: false,
    captureInput: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
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
