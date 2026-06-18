package com.practicepro.app;

import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;
import com.practicepro.app.plugins.ContentProtectionPlugin;

/**
 * MainActivity — PracticePro Android entry point.
 *
 * TASK: Native security + performance features:
 * 1. FLAG_SECURE — prevents screenshots and screen recording at the OS level.
 *    When enabled, Android's compositor refuses to capture this window.
 *    This is the SAME mechanism banking apps use. It actually works (unlike
 *    CSS/JS approaches). The Recents/Task Manager preview also shows a blank card.
 *
 * 2. The flag is controlled from JS via the ContentProtectionPlugin, which
 *    reads the user's toggle setting from localStorage and calls
 *    setFlagSecure(true/false) on this activity.
 *
 * 3. WebView debugging is disabled in production builds for security.
 */
public class MainActivity extends BridgeActivity {

    private boolean flagSecureEnabled = true; // Default: ON for security

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Register the content protection plugin BEFORE super.onCreate
        registerPlugin(ContentProtectionPlugin.class);

        super.onCreate(savedInstanceState);

        // Apply FLAG_SECURE on launch — default ON for security.
        // The JS side will call setFlagSecure(false) if the user has toggled
        // content protection OFF in Settings.
        applyFlagSecure();

        // Disable WebView debugging in production (security hardening)
        // In debug builds, keep it enabled for Chrome DevTools inspection.
        if (!BuildConfig.DEBUG) {
            WebView.setWebContentsDebuggingEnabled(false);
        }
    }

    /**
     * Called from the ContentProtectionPlugin to toggle FLAG_SECURE.
     * When true: screenshots are blocked, Recents shows blank card.
     * When false: screenshots are allowed (user toggled protection OFF).
     */
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
    protected void onResume() {
        super.onResume();
        // Re-apply FLAG_SECURE on resume (in case it was cleared by the OS)
        applyFlagSecure();
    }
}
