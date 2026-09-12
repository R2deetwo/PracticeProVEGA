# Push Notifications — Setup & Troubleshooting Guide

> **Status of the Sept 2026 fix:** the code pipeline (client registration,
> server dispatch, Android payload, tap handling, diagnostics) has been
> rewritten and works end-to-end. What remains is **one manual Firebase
> configuration step** that cannot be done from the repo — see Step 1.

## Why pushes were not working (root causes found)

| # | Root cause | Effect | Fixed by |
|---|-----------|--------|----------|
| 1 | `FIREBASE_SERVICE_ACCOUNT_JSON` **not set** on the Convex deployment (and `FCM_SERVER_KEY` empty too) | Server silently skipped every FCM send — in-app notifications appeared, device pushes never did | Now surfaces a loud error in logs + founder Settings + test-push result |
| 2 | Dispatch used the **legacy FCM API** (`fcm.googleapis.com/fcm/send` + server key), which Google **shut down in June 2024** | Even if a server key were set, every send would fail with 401 | Rewritten to the **FCM HTTP v1 API** with a service-account OAuth2 token (RS256 JWT, no firebase-admin SDK needed) |
| 3 | Founder APK **cannot register with FCM**: its `com.practicepro.admin` client in google-services.json is a **clone** of the consumer app id, and Firebase rejects cloned app ids at token registration (runtime 403) | Founder devices have zero registered tokens; "Send Test Push" always failed — while its error message told the founder to do something impossible | Accurate messaging + real fix path (Step 2) |
| 4 | FCM payload set `clickAction: "FCM_PLUGIN_ACTIVITY"` — a leftover from the old cordova plugin; no activity in the manifest declares it | Tapping a background notification did **nothing** (app never opened) | clickAction removed — taps now open the launcher activity and are delivered to the app |
| 5 | The `practicepro-general` notification channel was only created **after** the user granted permission | On Android 8+, pushes to a nonexistent channel are **silently dropped** | Channels are now created **before** registration, permission-independent |
| 6 | Foreground pushes were only `console.log`-ged | With the app open, notifications were invisible | Foreground pushes are re-displayed as local notifications (channel + sound + haptic + tap) |
| 7 | `sendTestPush` scheduled the send fire-and-forget and returned "success" based on token count | The founder could never see the real failure reason | Test pushes now dispatch inline and return **real FCM results** (sent / failed / per-token errors) |
| 8 | FCM v1 requires data values to be **strings**; the old code sent objects | 400 INVALID_ARGUMENT whenever a data payload was attached | Data values are stringified before send |

## Step 1 — Set the service account on Convex (REQUIRED, 5 minutes)

1. Open the [Firebase console](https://console.firebase.google.com) → project **practicepro-42178**.
2. ⚙️ **Project Settings → Service accounts**.
3. Click **Generate new private key** → confirm → a JSON file downloads.
4. Give that JSON to the Convex deployment, either:
   - **Dashboard:** convex.dev → your deployment (production: *gregarious-malamute-537*) → Settings → Environment Variables → `FIREBASE_SERVICE_ACCOUNT_JSON` = the full JSON content (single line), **or**
   - **CLI:** `npx convex env set FIREBASE_SERVICE_ACCOUNT_JSON "$(cat service-account.json)"` (run from the repo, logged in to the right deployment).
5. Remove `FCM_SERVER_KEY` if it exists anywhere — it is dead and only causes confusion.
6. Verify: founder app → Settings → System → **API Integrations** → "Push Notifications (FCM)" should show **Connected** with the project id. Then press **Send Test Push Notification**.

## Step 2 — Register the Founder APK package in Firebase (for founder-device pushes)

The founder APK (`com.practicepro.admin`) is a separate Android app:

1. Firebase console → Project Settings → **Your apps** → **Add app** → Android.
2. Package name: `com.practicepro.admin` → Register (no need to download their analytics config).
3. Download the **new google-services.json** — it now contains BOTH `com.practicepro.app` and `com.practicepro.admin`, each with its own genuine app id.
4. Replace `android/app/google-services.json` in the repo with it and commit.
5. Rebuild the founder APK (`npm run apk:admin:release`). The build script auto-detects the genuine admin client and skips the clone.

> Until this is done, the founder can still receive pushes by logging into
> the **main PracticePro app** on their device with the founder account —
> the main package is fully registered.

## How to verify the whole chain

1. **Server config:** founder Settings → System → API Integrations → FCM row.
2. **Token registration:** install the APK, log in, grant notification permission; the backend `user_push_tokens` table then has an active row for your user.
3. **Delivery:** user app → Settings → Notification Settings → **Send Test Push**, or founder Settings → **Send Test Push Notification**. The toast now reports the exact FCM outcome:
   - `FCM_NOT_CONFIGURED` / `INVALID_SERVICE_ACCOUNT` → Step 1 not done
   - `NO_REGISTERED_DEVICES` → device never registered (log into the app on the device)
   - `404/UNREGISTERED` → stale token (now auto-retired)
   - `401` / `SENDER_ID_MISMATCH` → token was minted for a different Firebase project than the service account
4. **Background taps:** tapping a push opens the app (APK-update pushes open the download).

## Where things live

| Piece | File |
|-------|------|
| FCM v1 dispatcher (OAuth2 JWT + send + token hygiene) | `convex/pushNotificationsNode.ts` |
| Public test actions (real results) | `convex/pushNotificationsNode.ts` (`sendTestPush`, `sendTestPushToUser`) |
| Token registration & internal helpers | `convex/pushNotifications.ts` |
| Client registration hook (channels, listeners, foreground display) | `src/hooks/usePushNotifications.ts` |
| Notification channels + local display | `src/utils/notifications.ts` (`ensureNotificationChannels`, `showLocalNotification`) |
| Founder diagnostics UI | `src/admin/views/Settings.tsx` (Push Diagnostics + API Integrations) |
| Founder APK google-services handling | `scripts/sync-admin-config.cjs` (Step 2c-iv) |
| Env status query | `convex/debug_env.ts` |

## Notes

- **Fan-out sends** (app updates, founder notifications, broadcasts) remain scheduled fire-and-forget via the Convex scheduler — they log real outcomes server-side and now auto-retire dead tokens.
- **iOS:** the payload already carries an APNs section; iOS delivery additionally requires uploading APNs credentials to Firebase (Cloud Messaging → Apple app credentials) once an iOS build exists.
- **The v1 data payload** is stringified automatically; receivers must `JSON.parse` non-string values if needed (the client already treats `data` fields as strings for routing).
