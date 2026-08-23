# PracticePro ProGuard Rules
# Updated Aug 2026 — minifyEnabled is now true on release builds.
# These rules keep the classes that Capacitor, WebView JS interfaces,
# and reflection-based libraries need at runtime.

# ─── Capacitor ─────────────────────────────────────────────────────────────
# Capacitor uses reflection to find @CapacitorPlugin classes and bridge
# methods. Without these rules, minification strips the plugin classes
# and the JS→native bridge breaks silently.
-keep class com.getcapacitor.** { *; }
-keep class * extends com.getcapacitor.Plugin { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep @com.getcapacitor.annotation.NativePlugin class * { *; }
-keepclassmembers class * {
    @com.getcapacitor.annotation.CapacitorMethod <methods>;
}
-keepclassmembers class * {
    @com.getcapacitor.annotation.PermissionCallback <methods>;
}

# ─── WebView JavaScript Interface ──────────────────────────────────────────
# Capacitor injects a JS interface into the WebView. If this class is
# renamed/obfuscated, the JS bridge stops working.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ─── Cordova Plugins (if any) ─────────────────────────────────────────────
-keep class org.apache.cordova.** { *; }
-keep class * extends org.apache.cordova.CordovaPlugin { *; }

# ─── Firebase ──────────────────────────────────────────────────────────────
# Firebase uses reflection for its model classes. Without keep rules,
# push notification token registration silently fails.
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# ─── Keep line numbers for crash reports ───────────────────────────────────
# Renames the source file attribute so stack traces show "SourceFile"
# instead of the actual file name, but preserves line numbers.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ─── Keep enum values (used by Capacitor for return types) ─────────────────
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}
