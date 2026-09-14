package com.practicepro.app.push;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.Person;
import androidx.core.app.RemoteInput;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.json.JSONObject;

/**
 * PushReplyReceiver — handles actions on MessagingStyle notifications
 * (WhatsApp-style inline reply, 2026-09-14).
 *
 * ACTION_REPLY (the Direct Reply flow):
 *   1. Extract the text from RemoteInput.
 *   2. Immediately re-post the notification with "You: <text>" appended
 *      (WhatsApp shows your reply in the thread) — posted silently so the
 *      reply keystroke doesn't re-buzz.
 *   3. POST {replyToken, conversationId, text} to the Convex
 *      /api/push-reply endpoint (the replyToken was minted server-side at
 *      push-dispatch time, bound to user+conversation, 24h expiry).
 *   4. On failure, re-post with a "couldn't send" hint so the user knows
 *      to open the app.
 *
 * ACTION_CLEAR: the user dismissed the notification → clear that
 * conversation's history so the next message starts a fresh stack.
 *
 * The Convex URL: read from Capacitor Preferences (the JS layer stores
 * VITE_CONVEX_URL at boot under "pp_convex_url" — @capacitor/preferences
 * persists to the "CapacitorStorage" SharedPreferences as
 * {"value":"<url>"}), with the production deployment as the fallback so a
 * missed write can't kill replies.
 *
 * goAsync() keeps the process alive for the duration of the HTTP call.
 */
public class PushReplyReceiver extends BroadcastReceiver {

    public static final String ACTION_REPLY = "com.practicepro.app.push.ACTION_REPLY";
    public static final String ACTION_CLEAR = "com.practicepro.app.push.ACTION_CLEAR";
    public static final String KEY_REPLY_TEXT = "key_reply_text";
    public static final String EXTRA_REPLY_TOKEN = "replyToken";
    public static final String EXTRA_CONVERSATION_ID = "conversationId";
    public static final String EXTRA_TAG = "tag";
    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_CHANNEL = "channel";

    private static final String DEFAULT_CONVEX_URL = "https://gregarious-malamute-537.convex.cloud";
    private static final String SELF_NAME = "You";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction() == null ? "" : intent.getAction();

        if (ACTION_CLEAR.equals(action)) {
            String tag = intent.getStringExtra(EXTRA_TAG);
            if (tag != null) PushNotificationHistory.clear(context, tag);
            return;
        }

        if (ACTION_REPLY.equals(action)) {
            BundleText reply = extractReplyText(intent);
            if (reply == null || reply.text.isEmpty()) return;

            final String tag = intent.getStringExtra(EXTRA_TAG);
            final String conversationId = intent.getStringExtra(EXTRA_CONVERSATION_ID);
            final String replyToken = intent.getStringExtra(EXTRA_REPLY_TOKEN);
            final String title = intent.getStringExtra(EXTRA_TITLE);
            final String channel = intent.getStringExtra(EXTRA_CHANNEL) != null
                    ? intent.getStringExtra(EXTRA_CHANNEL) : "practicepro-messages";
            if (tag == null || conversationId == null || replyToken == null) return;

            // 1. Show the reply in the thread immediately (silent).
            List<PushNotificationHistory.Entry> history =
                    PushNotificationHistory.append(context, tag, SELF_NAME, reply.text);
            repostWithHistory(context, tag, title != null ? title : "PracticePro", channel,
                    history, null);

            // 2. Deliver to the backend (goAsync keeps us alive for it).
            final PendingResult result = goAsync();
            final Context appContext = context.getApplicationContext();
            new Thread(() -> {
                try {
                    int status = postReply(appContext, conversationId, replyToken, reply.text);
                    if (status < 200 || status >= 300) {
                        // Surface the failure in the same row.
                        List<PushNotificationHistory.Entry> h =
                                PushNotificationHistory.read(appContext, tag);
                        repostWithHistory(appContext, tag, title != null ? title : "PracticePro",
                                channel, h, "Couldn't send — open the app to reply");
                    }
                } catch (Exception e) {
                    android.util.Log.w("PPPush", "reply POST failed", e);
                } finally {
                    result.finish();
                }
            }).start();
        }
    }

    private static class BundleText {
        final String text;
        BundleText(String text) { this.text = text; }
    }

    private static BundleText extractReplyText(Intent intent) {
        try {
            android.os.Bundle results = RemoteInput.getResultsFromIntent(intent);
            if (results == null) return null;
            CharSequence cs = results.getCharSequence(KEY_REPLY_TEXT);
            if (cs == null) return null;
            String text = cs.toString().trim();
            if (text.isEmpty()) return null;
            return new BundleText(text.length() > 1000 ? text.substring(0, 1000) : text);
        } catch (Exception e) {
            return null;
        }
    }

    private static int postReply(Context ctx, String conversationId, String replyToken, String text)
            throws Exception {
        String base = readConvexUrl(ctx);
        JSONObject payload = new JSONObject();
        payload.put("replyToken", replyToken);
        payload.put("conversationId", conversationId);
        payload.put("text", text);

        HttpURLConnection conn = (HttpURLConnection) new URL(base + "/api/push-reply")
                .openConnection();
        try {
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setDoOutput(true);
            conn.setConnectTimeout(10_000);
            conn.setReadTimeout(15_000);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(payload.toString().getBytes(StandardCharsets.UTF_8));
            }
            return conn.getResponseCode();
        } finally {
            conn.disconnect();
        }
    }

    /** Capacitor Preferences stores values in the CapacitatorStorage
     *  SharedPreferences as {"value":"..."}. Fallback: production URL. */
    private static String readConvexUrl(Context ctx) {
        try {
            SharedPreferences prefs = ctx.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            String raw = prefs.getString("pp_convex_url", null);
            if (raw != null) {
                String url = new JSONObject(raw).optString("value", "");
                if (url.startsWith("https://")) return url.replaceAll("/+$", "");
            }
        } catch (Exception ignored) {
        }
        return DEFAULT_CONVEX_URL;
    }

    /** Re-post the notification from history (used after the reply and on
     *  failure). postingNotice allows a status line ("Couldn't send…"). */
    private static void repostWithHistory(Context ctx, String tag, String title, String channel,
                                          List<PushNotificationHistory.Entry> history,
                                          String statusLine) {
        try {
            Person.Builder me = new Person.Builder().setName("You").setKey("me");
            NotificationCompat.MessagingStyle style =
                    new NotificationCompat.MessagingStyle(me.build());
            for (PushNotificationHistory.Entry e : history) {
                style.addMessage(e.text, e.ts,
                        new Person.Builder().setName(e.sender).setKey(e.sender).build());
            }
            style.setConversationTitle(title);

            NotificationCompat.Builder builder = new NotificationCompat.Builder(ctx, channel)
                    .setSmallIcon(ctx.getResources().getIdentifier("ic_notification", "drawable", ctx.getPackageName()))
                    .setColor(0xFF16A34A)
                    .setStyle(style)
                    .setContentTitle(title)
                    .setContentText(history.isEmpty() ? "" : history.get(history.size() - 1).text)
                    .setNumber(Math.max(1, history.size()))
                    .setWhen(System.currentTimeMillis())
                    .setShowWhen(true)
                    .setAutoCancel(true)
                    // Silent update — the user just typed this themselves.
                    .setOnlyAlertOnce(true)
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setCategory(NotificationCompat.CATEGORY_MESSAGE);

            if (statusLine != null) {
                builder.setContentText(statusLine);
            }

            NotificationManagerCompat.from(ctx).notify(tag,
                    PracticeProMessagingService.stableId(tag), builder.build());
        } catch (Exception e) {
            android.util.Log.w("PPPush", "repostWithHistory failed", e);
        }
    }
}
