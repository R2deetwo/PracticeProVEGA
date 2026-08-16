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
 */

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.practicepro.app',
  appName: 'PracticePro',
  webDir: 'dist',
  backgroundColor: '#16A34A',
  android: {
    allowMixedContent: true,
    captureInput: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#16A34A',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
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
