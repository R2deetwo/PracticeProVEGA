/**
 * Capacitor config for the VEGA product APK variant.
 *
 * Same applicationId as the universal build (com.practicepro.app) — a Vega
 * APK installs/updates over any existing install; only the wrapper branding
 * differs: the home-screen label says "Vega" and the launcher icon carries
 * the Seal. Brand Clarity Pass, Phase 2 (Gate B, option 2 — owner's stated
 * preference): law firms download "Vega", estate managers download "Atrium".
 *
 * Built via:  npm run apk:vega:release
 *   (scripts/sync-product-config.cjs --product vega swaps this in, syncs,
 *    patches strings.xml app_name + the launcher icon set, builds, restores)
 *
 * The native splash STAYS company-branded (owner direction: the PracticePro
 * opening is liked as-is; the *in-app* cinematic splash ends on the product
 * mark — see SplashScreen.tsx / splashEndCard.ts).
 */

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.practicepro.app',
  appName: 'Vega',
  webDir: 'dist',
  backgroundColor: '#16A34A',
  android: {
    allowMixedContent: false,
    captureInput: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#16A34A',
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
