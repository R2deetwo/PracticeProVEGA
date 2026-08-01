/**
 * Capacitor config for the PracticePro Admin APK.
 *
 * This is a SEPARATE APK from the main PracticePro app:
 *   - Main app: com.practicepro.vega (practicepro.vega)
 *   - Admin app: com.practicepro.admin (practicepro.admin)
 *
 * Both apps share the same Convex backend and codebase, but the admin
 * app only renders admin/management views (Founder Dashboard, Firm
 * Management, User Management, Audit Logs).
 *
 * BUILD:
 *   npm run build:admin   — builds the admin frontend (Vite)
 *   npm run cap:sync:admin — syncs to the admin Android project
 *   npm run apk:admin:release — builds the admin release APK
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
