package com.practicepro.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.practicepro.app.plugins.ContentProtectionPlugin;

/**
 * MainActivity — PracticePro Android entry point.
 *
 * Native security features:
 * 1. FLAG_SECURE — prevents screenshots at the OS level (same as banking apps).
 * 2. WebView debugging disabled in production.
 * 3. Notification channel creation — Android 8+ requires channels before
 *    notifications can display. Without this, FCM push notifications
 *    are silently dropped by the OS.
 *
 * MICROPHONE PERMISSIONS (rewritten 2026-11-18):
 * The previous implementation replaced Capacitor's WebChromeClient with a
 * bare `new WebChromeClient()` that manually bridged only RECORD_AUDIO.
 * That caused THREE problems on real devices:
 *
 *   1. It never requested MODIFY_AUDIO_SETTINGS — which Capacitor's own
 *      BridgeWebChromeClient requests together with RECORD_AUDIO for
 *      AUDIO_CAPTURE. On several OEM ROMs (Transsion/Infinix/Tecno, some
 *      Samsung/MediaTek builds) Chromium's audio pipeline cannot open the
 *      native AudioRecord without it, so getUserMedia fails with
 *      NotReadableError ("the microphone did not open on this device")
 *      EVEN WHEN the user has granted the OS microphone permission.
 *      This was the founder's device symptom: grant → revoke → re-grant
 *      changed nothing.
 *   2. The bare client dropped Capacitor's onShowFileChooser — file
 *      uploads (<input type="file">) silently did nothing in the APK.
 *   3. It dropped onJsAlert/onJsConfirm/onJsPrompt (window.alert/confirm
 *      dead) and onConsoleMessage (no console relay for diagnostics).
 *
 * THE FIX: do NOT replace the WebChromeClient at all. Capacitor 8's
 * BridgeWebChromeClient (set by the bridge during onCreate) already
 * implements the correct flow: onPermissionRequest(AUDIO_CAPTURE) →
 * request RECORD_AUDIO + MODIFY_AUDIO_SETTINGS via the modern
 * ActivityResult launcher → grant the WebView request. The manifest now
 * declares both permissions. Everything else (file chooser, dialogs,
 * console, geolocation) keeps working because the stock client is intact.
 */
public class MainActivity extends BridgeActivity {

    private boolean flagSecureEnabled = false;

    // ─── NOTIFICATION CHANNEL (Aug 2026) ───────────────────────────────
    // Android 8+ (API 26+) requires notification channels. Without a channel,
    // FCM push notifications are silently dropped by the OS — the user sees
    // nothing (no banner, no sound, no tray icon). The backend sends
    // notifications tagged with channelId "practicepro-general", but if
    // that channel doesn't exist on the device, the notification is dropped.
    // This creates the channel at app startup so notifications can display.
    private static final String CHANNEL_ID = "practicepro-general";
    private static final String CHANNEL_NAME = "PracticePro Notifications";
    private static final String CHANNEL_DESC = "Matter updates, rent reminders, maintenance tickets, and estate announcements";

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH  // Shows as heads-up notification with sound
            );
            channel.setDescription(CHANNEL_DESC);
            channel.enableLights(true);
            channel.enableVibration(true);
            channel.setShowBadge(true);

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ContentProtectionPlugin.class);
        super.onCreate(savedInstanceState);
        applyFlagSecure();

        // Create notification channel BEFORE any notification could arrive.
        // Must run in onCreate so the channel exists before the first FCM
        // message is processed.
        createNotificationChannel();

        // Disable WebView debugging — security hardening.
        WebView.setWebContentsDebuggingEnabled(false);

        // NOTE: no setWebChromeClient() here — intentionally. The bridge has
        // already installed Capacitor's BridgeWebChromeClient, whose
        // onPermissionRequest implementation requests RECORD_AUDIO +
        // MODIFY_AUDIO_SETTINGS for WebView mic access and grants the
        // request once the OS permissions are granted. Replacing it (as an
        // older revision of this file did) breaks mic capture on OEM ROMs
        // and kills file-upload dialogs. See the class comment above.
    }

    public void setFlagSecure(boolean enabled) {
        flagSecureEnabled = enabled;
        applyFlagSecure();
    }

    public boolean isFlagSecureEnabled() {
        return flagSecureEnabled;
    }

    private void applyFlagSecure() {
        runOnUiThread(() -> {
            if (flagSecureEnabled) {
                getWindow().setFlags(
                    WindowManager.LayoutParams.FLAG_SECURE,
                    WindowManager.LayoutParams.FLAG_SECURE
                );
            } else {
                getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
            }
        });
    }

    @Override
    public void onResume() {
        super.onResume();
        applyFlagSecure();
    }
}
