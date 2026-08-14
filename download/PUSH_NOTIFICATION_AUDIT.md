# Push Notification Crawler Audit Report
## Investigating Both APKs (User App + Admin App)

---

## EXECUTIVE SUMMARY

| Component | User APK | Admin APK |
|-----------|----------|-----------|
| `usePushNotifications` hook | ✅ Called in App.tsx:588 | ❌ NOT called |
| `google-services.json` | ✅ Present (com.practicepro.app) | ⚠️ Same file — but admin uses com.practicepro.admin |
| Firebase project | ✅ practicepro-42178 | ✅ Same project |
| `FIREBASE_SERVICE_ACCOUNT_JSON` in Convex | ✅ Configured | ✅ Same backend |
| `FCM_SERVER_KEY` in Convex | ❌ Not set (using service account instead) | ❌ Same |
| Token registration on login | ✅ Works (saves to user_push_tokens) | ❌ Never registered |
| `sendFcmPush` backend action | ✅ Works (firebase-admin SDK) | ✅ Same backend |
| Push on new feedback | ✅ Fires FCM to founder tokens | ❌ Founder has no tokens (never registered) |
| Push on new sales lead | ✅ Fires FCM to founder tokens | ❌ Founder has no tokens |
| Push on add-on request | ✅ Fires FCM to founder tokens | ❌ Founder has no tokens |

---

## CRITICAL FINDINGS

### 1. ADMIN APK — NO PUSH NOTIFICATION REGISTRATION (CRITICAL)
**The admin/founder app NEVER registers for push notifications.**

The `usePushNotifications` hook is called in `src/components/App.tsx:588` (user app) but is **NOT called anywhere in `src/admin/AdminApp.tsx`**. This means:

- The founder's device never gets an FCM token
- No token is saved to `user_push_tokens` for the founder's user ID
- When backend code fires `sendFcmPush` with founder tokens, the token list is EMPTY
- All push notifications to the founder silently fail with `sent: 0`

**Fix:** Add `usePushNotifications` to the admin app.

### 2. ADMIN APK — GOOGLE-SERVICES.JSON MISMATCH (CRITICAL)
The `google-services.json` file has `package_name: "com.practicepro.app"` but the admin APK builds with `applicationId: "com.practicepro.admin"` (set by `sync-admin-config.cjs`). Firebase will reject the FCM registration because the package name doesn't match.

**Fix:** Either:
- (a) Register `com.practicepro.admin` as a second Android app in the Firebase console and add it to `google-services.json`, OR
- (b) Patch `google-services.json` in `sync-admin-config.cjs` to use the admin package name during the build

### 3. USER APK — PUSH PIPELINE IS FUNCTIONAL ✅
The user app correctly:
- Calls `usePushNotifications(userId, firmId)` on login
- Requests permission on native platform
- Registers with FCM → gets device token
- Saves token to `user_push_tokens` table
- Backend `sendFcmPush` uses `firebase-admin` SDK with the service account JSON
- Push notifications fire on: feedback replies, add-on requests, sales leads, app updates

### 4. FIREBASE SERVICE ACCOUNT — CONFIGURED ✅
`FIREBASE_SERVICE_ACCOUNT_JSON` is set in Convex environment variables with a valid service account for project `practicepro-42178`. The `firebase-admin` SDK initializes correctly and can send push notifications to registered tokens.

### 5. LEGACY FCM_SERVER_KEY — NOT SET (OK)
`FCM_SERVER_KEY` is not set, but this is fine — the backend falls back to the service account method (Method 2 in `pushNotificationsNode.ts:69`), which is the recommended approach.

---

## ROOT CAUSE OF "PUSH NOTIFICATIONS NOT WORKING"

The founder/admin app never registers for push notifications. Even though the backend correctly creates notifications and attempts to send FCM pushes, the founder has NO registered device tokens. The `sendFcmPush` action receives an empty token array and returns `{ sent: 0, reason: "FCM_NOT_CONFIGURED" }` — but actually it's not that FCM isn't configured, it's that the founder has no tokens.

---

## FIX PLAN

1. Add `usePushNotifications` to the admin app (AdminApp.tsx)
2. Fix `google-services.json` package name mismatch for admin APK
3. Verify token registration works on next admin APK build
