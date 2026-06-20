package com.practicepro.app.plugins;

import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.practicepro.app.MainActivity;

/**
 * ContentProtectionPlugin — bridges the JS content protection toggle
 * to the native Android FLAG_SECURE window flag.
 *
 * When the user toggles "Content Protection" ON in Settings:
 *   → JS calls ContentProtectionPlugin.setEnabled(true)
 *   → Plugin calls MainActivity.setFlagSecure(true)
 *   → Android applies FLAG_SECURE to the window
 *   → Screenshots are BLOCKED at the OS graphics level
 *   → Recents/Task Manager shows a blank card
 *
 * When the user toggles "Content Protection" OFF:
 *   → JS calls ContentProtectionPlugin.setEnabled(false)
 *   → Plugin calls MainActivity.setFlagSecure(false)
 *   → Android clears FLAG_SECURE
 *   → Screenshots are ALLOWED (user can take screenshots for support)
 *
 * This is the REAL screenshot prevention — not the CSS/JS workaround.
 * FLAG_SECURE works at the Android compositor level, the same mechanism
 * banking apps use. It cannot be bypassed by screen recording software.
 */
@CapacitorPlugin(name = "ContentProtection")
public class ContentProtectionPlugin extends Plugin {

    private static final String TAG = "ContentProtection";

    @PluginMethod
    public void setEnabled(PluginCall call) {
        Boolean enabled = call.getBoolean("enabled");
        if (enabled == null) {
            enabled = true; // Default: ON
        }

        try {
            if (getActivity() instanceof MainActivity) {
                MainActivity mainActivity = (MainActivity) getActivity();
                mainActivity.setFlagSecure(enabled);
                Log.i(TAG, "FLAG_SECURE " + (enabled ? "ENABLED" : "DISABLED"));

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("enabled", enabled);
                call.resolve(ret);
            } else {
                Log.w(TAG, "Activity is not MainActivity — cannot set FLAG_SECURE");
                call.reject("Activity is not MainActivity");
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to set FLAG_SECURE", e);
            call.reject("Failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void isEnabled(PluginCall call) {
        try {
            if (getActivity() instanceof MainActivity) {
                MainActivity mainActivity = (MainActivity) getActivity();
                JSObject ret = new JSObject();
                ret.put("enabled", mainActivity.isFlagSecureEnabled());
                call.resolve(ret);
            } else {
                call.reject("Activity is not MainActivity");
            }
        } catch (Exception e) {
            call.reject("Failed: " + e.getMessage());
        }
    }
}
