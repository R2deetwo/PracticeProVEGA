package com.practicepro.app;

import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;
import com.practicepro.app.plugins.ContentProtectionPlugin;
import com.practicepro.app.BuildConfig;

/**
 * MainActivity — PracticePro Android entry point.
 *
 * Native security features:
 * 1. FLAG_SECURE — prevents screenshots at the OS level (same as banking apps).
 * 2. WebView debugging disabled in production.
 */
public class MainActivity extends BridgeActivity {

    private boolean flagSecureEnabled = true;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ContentProtectionPlugin.class);
        super.onCreate(savedInstanceState);
        applyFlagSecure();

        if (!BuildConfig.DEBUG) {
            WebView.setWebContentsDebuggingEnabled(false);
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
