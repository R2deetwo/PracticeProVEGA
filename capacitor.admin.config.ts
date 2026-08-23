/**
 * Capacitor config for the FOUNDER APK (com.practicepro.admin).
 *
 * This config is NOT committed as the active capacitor.config.ts —
 * the sync-admin-config.cjs script temporarily swaps it in during
 * the admin APK build process, then restores the main config.
 *
 * The founder APK uses dist-admin/ (built by vite.admin.config.ts)
 * and has a separate applicationId so it installs alongside the
 * consumer app on the same device.
 */

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.practicepro.admin',
  appName: 'PracticePro Founder',
  webDir: 'dist-admin',
  backgroundColor: '#0f172a',
  android: {
    allowMixedContent: false,
    captureInput: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#0f172a',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    LocalNotifications: {
      smallIcon: 'ic_notification',
      iconColor: '#0f172a',
      sound: 'notification.wav',
    },
  },
};

export default config;
