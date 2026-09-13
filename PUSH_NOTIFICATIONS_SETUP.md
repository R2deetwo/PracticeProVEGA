# Push Notifications — Setup & Troubleshooting Guide

> **Status of the Sept 2026 fix:** the code pipeline (client registration,
> server dispatch, Android payload, tap handling, diagnostics) has been
> rewritten and works end-to-end. The former "one manual Firebase
> configuration step" is **DONE** (2026-09-14): `com.practicepro.admin`
> was registered in Firebase project practicepro-42178 **programmatically
> via the Firebase Management API** (a one-time, setup-token-gated Convex
> action that has since been removed from the repo), and the genuine
> google-services.json — with both clients — is committed at
> `android/app/google-services.json`. Founder APK builds from 2026-09-14
> onward register FCM tokens normally.

## Why pushes were not working (root causes found)

| # | Root cause | Effect | Fixed by |
|---|-----------|--------|----------|
| 1 | `FIREBASE_SERVICE_ACCOUNT_JSON` **not set** on the Convex deployment (and `FCM_SERVER_KEY` empty too) | Server silently skipped every FCM send — in-app notifications appeared, device pushes never did | Now surfaces a loud error in logs + founder Settings + test-push result |
| 2 | Dispatch used the **legacy FCM API** (`fcm.googleapis.com/fcm/send` + server key), which Google **shut down in June 2024** | Even if a server key were set, every send would fail with 401 | Rewritten to the **FCM HTTP v1 API** with a service-account OAuth2 token (RS256 JWT, no firebase-admin SDK needed) |
| 3 | Founder APK **cannot register with FCM**: its `com.practicepro.admin` client in google-services.json was a **clone** of the consumer app id, and Firebase rejects cloned app ids at token registration (runtime 403) | Founder devices have zero registered tokens; "Send Test Push" always failed | **FIXED 2026-09-14**: com.practicepro.admin registered in Firebase via the Management API (appId `1:738464564911:android:6bfab42383e206522d365a`, state ACTIVE); genuine google-services.json committed |
| 4 | FCM payload set `clickAction: "FCM_PLUGIN_ACTIVITY"` — a leftover from the old cordova plugin; no activity in the manifest declares it | Tapping a background notification did **nothing** (app never opened) | clickAction removed — taps now open the launcher activity and are delivered to the app |
| 5 | The `practicepro-general` notification channel was only created **after** the user granted permission | On Android 8+, pushes to a nonexistent channel are **silently dropped** | Channels are now created **before** registration, permission-independent |
| 6 | Foreground pushes were only `console.log`-ged | With the app open, notifications were invisible | Foreground pushes are re-displayed as local notifications (channel + sound + haptic + tap) |
| 7 | `sendTestPush` scheduled the send fire-and-forget and returned "success" based on token count | The founder could never see the real failure reason | Test pushes now dispatch inline and return **real FCM results** (sent / failed / per-token errors) |
| 8 | FCM v1 requires data values to be **strings**; the old code sent objects | 400 INVALID_ARGUMENT whenever a data payload was attached | Data values are stringified before send |
| 9 | `usePushNotifications` effect didn't re-run when the session token arrived after the user object (auth race) | Devices stayed token-less for the whole session — pushes silently never arrived | sessionToken added to the effect deps; late tokens re-trigger registration (2026-09-14) |

## Step 1 — Set the service account on Convex (DONE — verification only)

Already configured on production (`gregarious-malamute-537`): the founder
Settings → System → API Integrations → "Push Notifications (FCM)" row shows
**Connected** with project `practicepro-42178`. To re-verify or re-set:

1. Open the [Firebase console](https://console.firebase.google.com) → project **practicepro-42178**.
2. ⚙️ **Project Settings → Service accounts**.
3. Click **Generate new private key** → confirm → a JSON file downloads.
4. Give that JSON to the Convex deployment, either:
   - **Dashboard:** convex.dev → your deployment (production: *gregarious-malamute-537*) → Settings → Environment Variables → `FIREBASE_SERVICE_ACCOUNT_JSON` = the full JSON content (single line), **or**
   - **CLI:** `npx convex env set FIREBASE_SERVICE_ACCOUNT_JSON "$(cat service-account.json)"` (run from the repo, logged in to the right deployment).
5. Remove `FCM_SERVER_KEY` if it exists anywhere — it is dead and only causes confusion.
6. Verify: founder app → Settings → System → **API Integrations** → "Push Notifications (FCM)" should show **Connected** with the project id. Then press **Send Test Push Notification**.

## Step 2 — Register the Founder APK package in Firebase (DONE 2026-09-14)

`com.practicepro.admin` is registered in Firebase (displayName "PracticePro
Founder", state ACTIVE) and `android/app/google-services.json` contains BOTH
clients with genuine app ids. Nothing to do here anymore — this section
remains for history and for re-registering a NEW package if one is ever added:

1. Firebase console → Project Settings → **Your apps** → **Add app** → Android.
2. Package name: e.g. `com.practicepro.newpkg` → Register.
3. Download the **new google-services.json** — it will contain all clients, each with its own genuine app id.
4. Replace `android/app/google-services.json` in the repo with it and commit.
5. Rebuild the founder APK (`npm run apk:admin:release`). The build script auto-detects the genuine admin client and skips the clone.

## How to verify the whole chain

1. **Server config:** founder Settings → System → API Integrations → FCM row.
2. **Token registration:** install the latest APK (founder build ≥ 2026-09-14, or the main app), log in, grant notification permission; the backend `user_push_tokens` table then has an active row for your user.
3. **Delivery:** user app → Settings → Notification Settings → **Send Test Push**, or founder Settings → **Send Test Push Notification**. The toast now reports the exact FCM outcome:
   - `FCM_NOT_CONFIGURED` / `INVALID_SERVICE_ACCOUNT` → Step 1 not done
   - `NO_REGISTERED_DEVICES` → device never registered (update to the latest APK, log out/in, grant permission; older founder APKs can never register)
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
