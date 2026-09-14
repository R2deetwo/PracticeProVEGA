package com.practicepro.app.push;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * PushNotificationHistory — per-conversation message history for
 * MessagingStyle notifications (WhatsApp-style stacking, 2026-09-14).
 *
 * FCM's tag-collapse (post with the same tag → replaces the row) only ever
 * shows the LATEST message. WhatsApp instead shows the whole recent thread
 * inside one notification. MessagingStyle needs the message LIST, so we
 * persist the last few messages per conversation tag in SharedPreferences:
 *
 *   {"conversation:abc": [{"s":"UBAH CHIGOZIE","t":"how about now?","ts":...}, ...]}
 *
 * - Capped at 8 entries (WhatsApp shows a similar handful; the cap keeps
 *   prefs tiny and the collapsed row readable).
 * - Cleared when the user dismisses the notification (deleteIntent) —
 *   reading/dismissing means the stack is no longer news.
 * - Survives process death: the service may be cold-started by FCM with
 *   the app killed; the previous messages must still be there to stack.
 */
public final class PushNotificationHistory {

    private static final String PREFS = "pp_push_history";
    private static final int MAX_ENTRIES = 8;

    private PushNotificationHistory() {}

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static class Entry {
        public final String sender;
        public final String text;
        public final long ts;
        public Entry(String sender, String text, long ts) {
            this.sender = sender == null ? "" : sender;
            this.text = text == null ? "" : text;
            this.ts = ts;
        }
    }

    /** Append a message to the tag's history and return the full list. */
    public static java.util.List<Entry> append(Context ctx, String tag, String sender, String text) {
        java.util.List<Entry> list = read(ctx, tag);
        list.add(new Entry(sender, text, System.currentTimeMillis()));
        while (list.size() > MAX_ENTRIES) list.remove(0);
        write(ctx, tag, list);
        return list;
    }

    /** Replace the whole list (used by the reply flow to add "You: …"). */
    public static void set(Context ctx, String tag, java.util.List<Entry> list) {
        while (list.size() > MAX_ENTRIES) list.remove(0);
        write(ctx, tag, list);
    }

    public static java.util.List<Entry> read(Context ctx, String tag) {
        java.util.List<Entry> out = new java.util.ArrayList<>();
        try {
            String raw = prefs(ctx).getString(tag, null);
            if (raw == null) return out;
            JSONArray arr = new JSONArray(raw);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.getJSONObject(i);
                out.add(new Entry(o.optString("s", ""), o.optString("t", ""), o.optLong("ts", 0)));
            }
        } catch (Exception ignored) {
            // Corrupt history must never crash push delivery — start fresh.
        }
        return out;
    }

    public static void clear(Context ctx, String tag) {
        prefs(ctx).edit().remove(tag).apply();
    }

    private static void write(Context ctx, String tag, java.util.List<Entry> list) {
        try {
            JSONArray arr = new JSONArray();
            for (Entry e : list) {
                JSONObject o = new JSONObject();
                o.put("s", e.sender);
                o.put("t", e.text);
                o.put("ts", e.ts);
                arr.put(o);
            }
            prefs(ctx).edit().putString(tag, arr.toString()).apply();
        } catch (Exception ignored) {
        }
    }
}
