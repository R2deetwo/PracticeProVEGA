/**
 * Capacitor config for the PracticePro Founder APK.
 *
 * This is a SEPARATE APK from the main PracticePro app:
 *   - Main app: com.practicepro.app (PracticePro)
 *   - Founder app: com.practicepro.admin (PracticePro Founder)
 *
 * Both apps share the same Convex backend and codebase, but the founder
 * app only renders admin/management views (Founder Dashboard, Founder
 * Signals, Firm Management, User Management, Audit Logs).
 *
 * The swap script (scripts/sync-admin-config.cjs) patches:
 *   - capacitor.config.ts → this file
 *   - android/app/build.gradle → applicationId = com.practicepro.admin
 *   - android/app/src/main/res/values/strings.xml → app_name = PracticePro Founder
 *   - android/app/version.properties → MINOR=99 (separate versionCode range)
 * And restores all files after cap sync completes.
 *
 * BUILD:
 *   npm run build:admin   — builds the founder frontend (Vite)
 *   npm run cap:sync:admin — syncs to the founder Android project
 *   npm run apk:admin:release — builds the founder release APK
 */

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.practicepro.admin',
  appName: 'PracticePro Founder',
  webDir: 'dist-admin',
  backgroundColor: '#000000',
  android: {
    allowMixedContent: true,
    captureInput: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      // Native splash is the FINAL phase of the founder loading
      // sequence (Green → Orange → Black). Black background matches
      // the founder brand standard. The HTML overlay in admin.html
      // then plays the full color transition on top of this black.
      launchShowDuration: 800,
      backgroundColor: '#000000',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      androidSpinnerStyle: 'large',
      spinnerColor: '#FFFFFF',
      splashFullScreen: true,
      splashImmersive: true,
    },
    LocalNotifications: {
      smallIcon: 'ic_notification',
      iconColor: '#000000',
      sound: 'notification.wav',
    },
  },
};

export default config;
