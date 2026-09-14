# Push Notification Hardware Verification Protocol

**Status:** Code-verified ✅ · Hardware verification pending (this checklist)
**Builds under test:** Main APK `v1.0.612` (build-994, commit `80fa68f6`) · Founder APK `admin-build-98`
**Note:** v1.0.611 / admin-build-97 shipped the categorization overhaul (`7231d665`); v1.0.612 / admin-build-98 additionally ships round-2 fixes (founder signup pushes, maintenance status pushes, support-thread pushes, tray icon). **Test on the newer builds** — they are strict supersets.

Code-level verification already passed: 43/43 unit tests green (`tests/unit/pushNotifications.test.ts`, `tests/unit/messagePushWiring.test.ts`) covering channel routing, tag-based collapse, notificationCount badge, 90-char preview truncation, string-only data payloads, and stale-token deactivation. The checks below are the physical-device layer that code review cannot cover.

---

## Setup

1. **Two test devices** (Android 8+ recommended; one can be the founder's daily phone).
   - Device A: regular user account (team member or portal user).
   - Device B: founder account (Founder APK `admin-build-98`).
2. Install both APKs from GitHub Releases:
   - Main: `https://github.com/R2deetwo/PracticeProVEGA/releases/download/build-994/PracticePro-v1.0.612.apk`
   - Founder: latest `admin-build-*` release asset `app-release.apk`.
3. On first launch, **accept the notification permission prompt** on both devices. If it was previously denied, enable it in Settings → Apps → PracticePro → Notifications.
4. Confirm both devices have registered a token: user app → Settings → Notification Settings → **Send Test Push** (founder app → Settings → Push Diagnostics → **Send Test Push**). Each should report `sent: 1, failed: 0`.
5. Sign in and let each app sit on the home screen for ~10 seconds (token registration completes after the session token resolves).

---

## T1 — Previews show the real message body

| Step | Action | Expected |
|------|--------|----------|
| 1 | Device A: force-close PracticePro (swipe from recents). | — |
| 2 | From another account (web or second user), send a team DM: `"Testing lock screen preview 123"`. | — |
| 3 | Watch Device A's notification shade / lock screen. | Title = **sender's name** (or `sender · group name`). Body = the actual text `Testing lock screen preview 123` — **not** "X sent you a message". |
| 4 | Send a 200-character message. | Body truncated to ~90 chars + `…` — lock-screen friendly. |
| 5 | Send a message with only an attachment. | Body = `sent an attachment` (fallback), still delivered. |

## T2 — Routing to the right channel

| Step | Action | Expected |
|------|--------|----------|
| 1 | Long-press a chat notification → notice the channel name, or check Settings → Apps → PracticePro → Notifications. | Chat/portal/support messages appear under **Messages** (heads-up + sound). |
| 2 | Trigger a task assignment (assign a task to Device A's user from the web app), force-closed. | Notification appears under **Tasks & Deadlines** — no heads-up peek, high priority. |
| 3 | Resident side: submit a maintenance request from a tenant portal account. | Admin/founder device gets it under **Tasks** (it's a request, not a chat). |
| 4 | Founder device: register a brand-new account on the main app. | Founder APK shows the signup under **Signups & Growth** channel. |

## T3 — Grouping & deduplication (one row per conversation)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Force-close Device A. Send 3 messages in the **same** conversation, ~10s apart. | **ONE** tray row for that conversation, preview text = newest message, badge shows the running unread count (WhatsApp-style), not 3 stacked rows. |
| 2 | Send messages in a **different** conversation. | A separate row for that conversation (per-conversation tags — they don't merge across conversations). |
| 3 | Open the conversation in the app and read it. | (Acceptance) The tray row can be swiped away; no phantom count on the next message. |

## T4 — Foreground behavior (no double notification)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Device A: app **open in the foreground**, on any screen. | Incoming message shows ONE heads-up notification (FCM foreground listener re-displays it via a stable per-conversation id). |
| 2 | Send a second message in the same conversation while still foregrounded. | Still one notification row — replaced, not stacked, no duplicate for the same message. |
| 3 | Founder app foregrounded: trigger a signup. | One notification on the Signups & Growth channel. |

---

## If a test fails — capture this

```
adb logcat | grep -iE "push|fcm|PracticePro|notif"
```

Also grab: Settings → Apps → PracticePro → Notifications (screenshot of channel list), and the test-push result strings from Settings → Notification Settings. The server logs `[push] FCM v1 dispatched: N sent…` lines in Convex logs (Dashboard → Functions → pushNotificationsNode) tell you whether the send left the server — if `sent > 0` but nothing on device, the issue is device-side (channel deleted, battery optimization, Doze); if `sent = 0`, paste the `errors[]` from the same log line.

## Known device-side gotchas

- **Battery optimization / OEM killers** (Tecno/Infinix/Samsung "put app to sleep") silently block background FCM. Exempt PracticePro on test devices: Settings → Battery → Unrestricted.
- **Channel settings persist per install.** If a channel was previously created at the wrong importance (pre-overhaul installs), Android will NOT upgrade it on app update. Fix: Settings → Apps → PracticePro → Notifications → tune each channel, or uninstall + reinstall fresh.
- Doze mode defers non-high-priority pushes ~15 min; message pushes are sent `priority: HIGH` so they should arrive immediately even in Doze.
