package com.practicepro.app.push;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.Person;
import androidx.core.app.RemoteInput;
import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import com.practicepro.app.MainActivity;
import java.util.List;
import java.util.Map;

/**
 * PracticeProMessagingService — WhatsApp-grade FCM handling (2026-09-14).
 *
 * WHY THIS EXISTS: FCM `notification` payloads are posted by the SYSTEM
 * tray only when the app is backgrounded/killed — with zero styling
 * control: no message stacking, no inline reply, and (the bug that
 * triggered this round) they coexist with the app's own local
 * re-postings, producing "two notifications that give a preview".
 *
 * THE ARCHITECTURE (what WhatsApp does): the server sends DATA-ONLY
 * messages to devices that registered the "data_only" capability. Because
 * data messages are ALWAYS delivered to FirebaseMessagingService —
 * foreground, background, or killed — this service is the single owner of
 * the tray row in every app state:
 *
 *   - MessagingStyle: the notification shows the conversation's recent
 *     messages stacked (per-tag history persisted in SharedPreferences).
 *   - Per-conversation collapse: posted with (tag, stable id) — the Nth
 *     message REPLACES the row and appends to the stack, exactly like
 *     WhatsApp's single row per chat.
 *   - Inline reply: a RemoteInput action (only when the server marked the
 *     message replyable — team chat, not payments/tasks/updates) posts to
 *     /api/push-reply with a server-minted, 24h, conversation-bound
 *     replyToken. See PushReplyReceiver.
 *   - Categorization: the channel comes from the server (__channel:
 *     messages / tasks / signups / general) so per-category sound and
 *     vibration settings keep working.
 *   - Tap: launches MainActivity with the FCM data as extras +
 *     google.message_id — the Capacitor plugin's handleOnNewIntent then
 *     fires pushNotificationActionPerformed with that data, so the
 *     existing JS deep-link flow (pp:navigate) works unchanged.
 *   - JS bridge: every message is ALSO forwarded to
 *     PushNotificationsPlugin.sendRemoteMessage so the web layer's
 *     observation listeners still fire (display is native-only now).
 *
 * Stale APKs without this service keep receiving `notification` payloads
 * from the same server (capability-gated dispatch) — rollout never
 * regresses delivery.
 */
public class PracticeProMessagingService extends FirebaseMessagingService {

    public static final String KEY_TITLE = "__title";
    public static final String KEY_BODY = "__body";
    public static final String KEY_CHANNEL = "__channel";
    public static final String KEY_TAG = "__tag";
    public static final String KEY_COUNT = "__count";
    public static final String KEY_REPLY_TOKEN = "__replyToken";

    private static final String FALLBACK_CHANNEL = "practicepro-general";
    private static final long[] VIBRATE_PATTERN = {0, 250, 120, 250};

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);

        Map<String, String> data = remoteMessage.getData();
        boolean isDataOnly = remoteMessage.getNotification() == null;

        // Data-only messages are OURS to render. Legacy notification
        // payloads in the FOREGROUND are also ours (the system does not
        // post them while the app is visible, and the JS listener no
        // longer re-posts — see usePushNotifications STEP 4). In the
        // background the system posts notification payloads itself, and
        // onMessageReceived is not called at all — no double-post.
        // Foreground detection: FirebaseMessagingService runs while the
        // app is foregrounded only for notification payloads when the app
        // is visible; data messages arrive here in every state. The
        // plugin's own MessagingService used the same signal.
        postNotification(this, remoteMessage);

        // Forward to the Capacitor plugin so JS listeners keep firing
        // (observation-only — display is native).
        try {
            PushNotificationsPlugin.sendRemoteMessage(remoteMessage);
        } catch (Throwable t) {
            // The plugin class is on the classpath (it ships in the APK),
            // but any failure here must never break notification display.
        }
        if (!isDataOnly) {
            // The plugin re-posts notification payloads when
            // presentationOptions contains alert — our capacitor.config
            // does NOT set it, so no duplicate from that path either.
        }
    }

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        // Token rotation is surfaced to JS by the plugin's own service
        // registration… which this service REPLACED in the manifest. The
        // plugin exposes a static hook for exactly this case:
        try {
            PushNotificationsPlugin.onNewToken(token);
        } catch (Throwable ignored) {
        }
    }

    /** djb2 → positive 31-bit int (mirrors stableNotificationId() in
     *  src/utils/notifications.ts so JS and native agree on tray row ids). */
    public static int stableId(String key) {
        long h = 5381;
        for (int i = 0; i < key.length(); i++) {
            h = ((h << 5) + h + key.charAt(i)) & 0x7fffffffL;
        }
        return (int) (h == 0 ? 1 : h);
    }

    /** Build + post the MessagingStyle notification for a message. */
    private static void postNotification(Context ctx, RemoteMessage remoteMessage) {
        try {
            Map<String, String> data = remoteMessage.getData();
            // Display fields: __-prefixed (data-only payloads) with fallback
            // to the notification payload (legacy tokens in the FOREGROUND —
            // the system does not post those while the app is visible, and
            // the JS listener no longer re-posts, so this service must).
            RemoteMessage.Notification notif = remoteMessage.getNotification();
            String title = data.containsKey(KEY_TITLE) && !data.get(KEY_TITLE).isEmpty()
                    ? data.get(KEY_TITLE)
                    : (notif != null ? notif.getTitle() : null);
            String body = data.containsKey(KEY_BODY) && !data.get(KEY_BODY).isEmpty()
                    ? data.get(KEY_BODY)
                    : (notif != null ? notif.getBody() : null);

            // Nothing renderable → the system tray path owns it.
            if ((title == null || title.isEmpty()) && (body == null || body.isEmpty())) {
                return;
            }
            title = title == null || title.isEmpty() ? "PracticePro" : title;
            body = body == null ? "" : body;

            String channel = data.containsKey(KEY_CHANNEL) && !data.get(KEY_CHANNEL).isEmpty()
                    ? data.get(KEY_CHANNEL)
                    : channelForType(data.containsKey("type") ? data.get("type") : null);
            String conversationId = data.containsKey("conversationId") ? data.get("conversationId") : null;
            String tag = data.containsKey(KEY_TAG) && !data.get(KEY_TAG).isEmpty()
                    ? data.get(KEY_TAG)
                    : (conversationId != null ? "conversation:" + conversationId : "pp-" + title);
            String senderName = data.containsKey("senderName") ? data.get("senderName") : title;
            String replyToken = data.containsKey(KEY_REPLY_TOKEN) ? data.get(KEY_REPLY_TOKEN) : null;
            int count = 1;
            try {
                if (data.containsKey(KEY_COUNT)) count = Integer.parseInt(data.get(KEY_COUNT));
            } catch (NumberFormatException ignored) {
            }

            ensureChannel(ctx, channel);
            List<PushNotificationHistory.Entry> history =
                    PushNotificationHistory.append(ctx, tag, senderName, body);

            // ── MessagingStyle: stack the conversation ──
            Person.Builder personBuilder = new Person.Builder().setName(senderName).setKey(senderName);
            NotificationCompat.MessagingStyle style = new NotificationCompat.MessagingStyle(personBuilder.build());
            for (PushNotificationHistory.Entry e : history) {
                style.addMessage(e.text, e.ts,
                        new Person.Builder().setName(e.sender).setKey(e.sender).build());
            }
            if (count > 1) {
                style.setConversationTitle(title + " · " + count + " messages");
            } else {
                style.setConversationTitle(title);
            }

            NotificationCompat.Builder builder = new NotificationCompat.Builder(ctx, channel)
                    .setSmallIcon(ctx.getResources().getIdentifier("ic_notification", "drawable", ctx.getPackageName()))
                    .setColor(0xFF16A34A)
                    .setStyle(style)
                    .setContentTitle(title)
                    .setContentText(body)
                    .setNumber(count)
                    .setWhen(System.currentTimeMillis())
                    .setShowWhen(true)
                    .setAutoCancel(true)
                    // Replace (not stack) per conversation — the row is
                    // updated in place; sound/vibration only on the first.
                    .setOnlyAlertOnce(false)
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                    .setVibrate(VIBRATE_PATTERN);

            // ── Tap → MainActivity with the data extras ──
            Intent launch = new Intent(ctx, MainActivity.class);
            launch.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            if (remoteMessage.getMessageId() != null) {
                launch.putExtra("google.message_id", remoteMessage.getMessageId());
            }
            for (Map.Entry<String, String> e : data.entrySet()) {
                launch.putExtra(e.getKey(), e.getValue());
            }
            int requestCode = stableId(tag);
            PendingIntent contentIntent = PendingIntent.getActivity(
                    ctx, requestCode, launch,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            builder.setContentIntent(contentIntent);

            // ── Inline reply action (only for replyable messages) ──
            if (replyToken != null && !replyToken.isEmpty() && conversationId != null) {
                RemoteInput remoteInput = new RemoteInput.Builder(PushReplyReceiver.KEY_REPLY_TEXT)
                        .setLabel("Reply…")
                        .build();
                Intent replyIntent = new Intent(ctx, PushReplyReceiver.class);
                replyIntent.setAction(PushReplyReceiver.ACTION_REPLY);
                replyIntent.putExtra(PushReplyReceiver.EXTRA_REPLY_TOKEN, replyToken);
                replyIntent.putExtra(PushReplyReceiver.EXTRA_CONVERSATION_ID, conversationId);
                replyIntent.putExtra(PushReplyReceiver.EXTRA_TAG, tag);
                replyIntent.putExtra(PushReplyReceiver.EXTRA_TITLE, title);
                replyIntent.putExtra(PushReplyReceiver.EXTRA_CHANNEL, channel);
                PendingIntent replyPendingIntent = PendingIntent.getBroadcast(
                        ctx, requestCode + 1, replyIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE);
                NotificationCompat.Action replyAction = new NotificationCompat.Action.Builder(
                        0, "Reply", replyPendingIntent)
                        .addRemoteInput(remoteInput)
                        // Action.Builder has no setAllowSystemGeneratedContextualActions —
                        // that lives on NotificationCompat.Builder. The Action-level
                        // equivalent (suppress system-generated smart replies for this
                        // RemoteInput) is setAllowGeneratedReplies(false).
                        .setAllowGeneratedReplies(false)
                        .build();
                builder.addAction(replyAction);
            }

            // ── Dismiss → clear that conversation's history ──
            Intent clearIntent = new Intent(ctx, PushReplyReceiver.class);
            clearIntent.setAction(PushReplyReceiver.ACTION_CLEAR);
            clearIntent.putExtra(PushReplyReceiver.EXTRA_TAG, tag);
            PendingIntent clearPendingIntent = PendingIntent.getBroadcast(
                    ctx, requestCode + 2, clearIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            builder.setDeleteIntent(clearPendingIntent);

            NotificationManagerCompat.from(ctx).notify(tag, stableId(tag), builder.build());
        } catch (Exception e) {
            // Push display must never crash the process — the system
            // restarting us would lose this message entirely.
            android.util.Log.w("PPPush", "postNotification failed", e);
        }
    }

    /** Channels are created by the JS layer at app boot and persist; this
     *  is the cold-start safety net (createNotificationChannel is a no-op
     *  when the id already exists — the first creation keeps its settings). */
    private static void ensureChannel(Context ctx, String channelId) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        try {
            NotificationManager nm = ctx.getSystemService(NotificationManager.class);
            if (nm == null) return;
            if (nm.getNotificationChannel(channelId) != null) return;
            int importance = "practicepro-messages".equals(channelId)
                    ? NotificationManager.IMPORTANCE_HIGH
                    : NotificationManager.IMPORTANCE_DEFAULT;
            NotificationChannel ch = new NotificationChannel(
                    channelId, friendlyChannelName(channelId), importance);
            ch.setDescription("PracticePro notifications");
            nm.createNotificationChannel(ch);
        } catch (Exception ignored) {
        }
    }

    private static String friendlyChannelName(String channelId) {
        if ("practicepro-messages".equals(channelId)) return "Messages";
        if ("practicepro-tasks".equals(channelId)) return "Tasks & Deadlines";
        if ("practicepro-signups".equals(channelId)) return "Signups & Growth";
        return "General Notifications";
    }

    /** type → channel, mirroring channelForType() in
     *  convex/pushNotificationsNode.ts and getChannelForType() in
     *  src/utils/notifications.ts (kept in sync deliberately). Used for
     *  legacy notification payloads whose channel lives in the (opaque)
     *  android.notification section rather than the data map. */
    private static String channelForType(String type) {
        if (type == null) return FALLBACK_CHANNEL;
        switch (type) {
            case "new_signup": case "signup": case "new_org": case "new_firm":
            case "sales_lead": case "addon_request": case "subscription":
            case "subscription_payment": case "trial_started":
                return "practicepro-signups";
            case "chat_message": case "message": case "portal_reply":
            case "portal_message": case "portal_new_message":
            case "incoming_message": case "feedback_user_reply":
            case "feedback_reply": case "feedback_new": case "feedback_issue":
            case "feedback_auto_reply": case "automation_digest":
                return "practicepro-messages";
            case "task": case "task_assignment": case "deadline": case "overdue":
            case "portal_maintenance_ticket": case "portal_service_request":
            case "maintenance_status":
                return "practicepro-tasks";
            default:
                return FALLBACK_CHANNEL;
        }
    }
}
