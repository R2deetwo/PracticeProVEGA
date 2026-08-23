package com.practicepro.app;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
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
 * Microphone permission bridging:
 * When the web app calls navigator.mediaDevices.getUserMedia({ audio: true }),
 * the WebView fires WebChromeClient.onPermissionRequest. By default, Capacitor's
 * BridgeActivity does NOT bridge this to the native Android RECORD_AUDIO runtime
 * permission — so the user sees "permission denied" without ever being asked.
 *
 * This override intercepts onPermissionRequest, explicitly requests the Android
 * RECORD_AUDIO runtime permission, and grants the WebView request once the native
 * permission is granted. This is what makes the Notetaker / voice recorder work
 * on the APK.
 */
public class MainActivity extends BridgeActivity {

    private boolean flagSecureEnabled = false;
    private static final int MIC_PERMISSION_REQUEST_CODE = 4242;
    private PermissionRequest pendingWebPermissionRequest = null;

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

        // Set a custom WebChromeClient that intercepts microphone permission
        // requests from the WebView and bridges them to the native Android
        // RECORD_AUDIO runtime permission.
        // Use the official Capacitor API (bridge.getWebView()) instead of
        // findViewById(com.getcapacitor.R.id.webview) — the R.id reference
        // is an internal implementation detail that may not resolve in all
        // build environments.
        if (this.bridge != null) {
            WebView webView = this.bridge.getWebView();
            if (webView != null) {
                webView.setWebChromeClient(new WebChromeClient() {
                    @Override
                    public void onPermissionRequest(final PermissionRequest request) {
                        runOnUiThread(() -> {
                            String[] resources = request.getResources();
                            boolean wantsAudio = false;
                            for (String r : resources) {
                                if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)) {
                                    wantsAudio = true;
                                    break;
                                }
                            }

                            if (wantsAudio) {
                                if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO)
                                        == PackageManager.PERMISSION_GRANTED) {
                                    request.grant(request.getResources());
                                } else {
                                    pendingWebPermissionRequest = request;
                                    ActivityCompat.requestPermissions(MainActivity.this,
                                            new String[]{Manifest.permission.RECORD_AUDIO},
                                            MIC_PERMISSION_REQUEST_CODE);
                                }
                            } else {
                                request.deny();
                            }
                        });
                    }
                });
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode == MIC_PERMISSION_REQUEST_CODE && pendingWebPermissionRequest != null) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                pendingWebPermissionRequest.grant(pendingWebPermissionRequest.getResources());
            } else {
                pendingWebPermissionRequest.deny();
                Toast.makeText(this, "Microphone permission denied. Enable it in Settings → Apps → PracticePro → Permissions.", Toast.LENGTH_LONG).show();
            }
            pendingWebPermissionRequest = null;
        }
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
