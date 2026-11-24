package com.practicepro.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.practicepro.app.plugins.ContentProtectionPlugin;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

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
        // ── EDGE-TO-EDGE, EVERY OS VERSION (owner bug report 2026-11-25: the
        // outer white gaps above the ALOA Vox header and below the bottom
        // tab bar). Android 15+ (targetSdk 35+) enforces edge-to-edge anyway,
        // but Android ≤ 14 does not — without this call the WebView sits
        // BETWEEN the bars there and the system-bar bands show the window
        // background (the reported dead white strips). One inset owner for
        // every version: the WebView fills the whole window, insets reach
        // the web layer via the bridge below + env() where the WebView
        // supports it (Chromium ≥ 140). NOTE: Capacitor 8's own SystemBars
        // insets handling is DISABLED in capacitor.config.ts — its legacy
        // path pads the WebView's parent on old WebViews and DOUBLE-insets
        // the content (the original white-gap bug).
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        applyFlagSecure();
        bridgeSystemBarInsetsToWebView();

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

    /**
     * SAFE-AREA INSET BRIDGE (owner bug report 2026-11-24).
     *
     * On Android 15+ (targetSdk 35+) the window is edge-to-edge, but the
     * WebView frequently resolves env(safe-area-inset-*) to 0 — only the
     * DISPLAY CUTOUT is mapped, not the system bars. Web content that pads
     * itself with env() alone then renders UNDER the status bar (its clock
     * and notification icons collide with the ALOA Vox back button) and
     * UNDER the bottom gesture bar.
     *
     * This bridge reads the REAL system-bar insets and publishes them to the
     * web layer as CSS custom properties on the document element:
     *   --native-safe-top: <n>px   (status bar)
     *   --native-safe-bottom: <n>px (gesture navigation bar)
     *
     * The web CSS uses them as a fallback floor:
     *   padding-top: max(env(safe-area-inset-top), var(--native-safe-top, 0px))
     * so whichever source reports the correct inset wins. When the vars are
     * absent (browser, older APK, native side not yet run) everything
     * falls back to env() exactly as before — no regression.
     *
     * The listener re-fires on inset changes (rotation, keyboard, immersive
     * toggles), re-publishing the current values. Idempotent JS assignments.
     */
    private void bridgeSystemBarInsetsToWebView() {
        try {
            ViewCompat.setOnApplyWindowInsetsListener(
                getWindow().getDecorView(),
                (v, insets) -> {
                    try {
                        Insets bars = insets.getInsets(
                            WindowInsetsCompat.Type.systemBars()
                                | WindowInsetsCompat.Type.displayCutout()
                        );
                        final int top = bars.top;
                        final int bottom = bars.bottom;
                        runOnUiThread(() -> {
                            try {
                                WebView wv = (bridge != null) ? bridge.getWebView() : null;
                                if (wv != null) {
                                    String js =
                                        "try{document.documentElement.style.setProperty('--native-safe-top','" + top + "px');"
                                        + "document.documentElement.style.setProperty('--native-safe-bottom','" + bottom + "px');}catch(e){}";
                                    wv.evaluateJavascript(js, null);
                                }
                            } catch (Exception ignored) {
                                // WebView not ready yet — insets re-dispatch on
                                // the next layout pass and retry.
                            }
                        });
                    } catch (Exception ignored) {
                        // Never let an insets read crash the activity.
                    }
                    return insets;
                }
            );
        } catch (Exception ignored) {
            // Older devices / exotic OEMs — env() fallback still applies.
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        applyFlagSecure();
    }
}
