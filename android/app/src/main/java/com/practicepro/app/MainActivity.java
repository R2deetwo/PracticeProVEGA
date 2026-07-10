package com.practicepro.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.widget.Toast;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import android.view.View;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.practicepro.app.plugins.ContentProtectionPlugin;

/**
 * MainActivity — PracticePro Android entry point.
 *
 * Native security features:
 * 1. FLAG_SECURE — prevents screenshots at the OS level (same as banking apps).
 * 2. WebView debugging disabled in production.
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

    private boolean flagSecureEnabled = true;
    private static final int MIC_PERMISSION_REQUEST_CODE = 4242;
    private PermissionRequest pendingWebPermissionRequest = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ContentProtectionPlugin.class);
        super.onCreate(savedInstanceState);
        applyFlagSecure();

        // Disable WebView debugging — security hardening.
        WebView.setWebContentsDebuggingEnabled(false);

        // Set a custom WebChromeClient that intercepts microphone permission
        // requests from the WebView and bridges them to the native Android
        // RECORD_AUDIO runtime permission.
        // Capacitor's default BridgeActivity does NOT do this automatically,
        // which is why getUserMedia({ audio: true }) silently fails on the APK
        // even though RECORD_AUDIO is declared in AndroidManifest.xml.
        WebView webView = findViewById(com.getcapacitor.R.id.webview);
        if (webView != null) {
            webView.setWebChromeClient(new WebChromeClient() {
                @Override
                public void onPermissionRequest(final PermissionRequest request) {
                    runOnUiThread(() -> {
                        // Check what resources the web page is requesting
                        // (e.g. PermissionRequest.RESOURCE_AUDIO_CAPTURE)
                        String[] resources = request.getResources();
                        boolean wantsAudio = false;
                        for (String r : resources) {
                            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)) {
                                wantsAudio = true;
                                break;
                            }
                        }

                        if (wantsAudio) {
                            // Check if RECORD_AUDIO is already granted at the OS level
                            if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO)
                                    == PackageManager.PERMISSION_GRANTED) {
                                // Already granted — grant the WebView request
                                request.grant(request.getResources());
                            } else {
                                // Not yet granted — request the native runtime permission.
                                // Save the web request so we can grant/deny it once the
                                // native permission dialog completes.
                                pendingWebPermissionRequest = request;
                                ActivityCompat.requestPermissions(MainActivity.this,
                                        new String[]{Manifest.permission.RECORD_AUDIO},
                                        MIC_PERMISSION_REQUEST_CODE);
                            }
                        } else {
                            // Non-audio permission request — deny by default
                            request.deny();
                        }
                    });
                }
            });
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode == MIC_PERMISSION_REQUEST_CODE && pendingWebPermissionRequest != null) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                // User granted RECORD_AUDIO — grant the WebView request
                pendingWebPermissionRequest.grant(pendingWebPermissionRequest.getResources());
            } else {
                // User denied — deny the WebView request
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
