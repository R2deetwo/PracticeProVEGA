# Visitor Management System (VMS) — Standard Operating Procedures

This document describes the end-to-end setup and day-to-day operations for the PracticePro VMS add-on, including the gatehouse portal that security guards use to verify visitor codes.

---

## 1. Overview

The VMS lets residents generate 6-digit visitor access codes from their resident portal. When a visitor arrives at the gatehouse, the security guard enters the code at the gatehouse terminal (a public web page). The system verifies the code, displays the visitor name + host + unit, and the guard approves entry. Every action is logged with a timestamp.

### Components

| Component | Description | URL / Location |
|-----------|-------------|----------------|
| Resident Portal | Where residents generate codes | `/portal/tenant/{accessToken}` |
| Gatehouse Terminal | Where guards verify codes | `/gatehouse?firmId=YOUR_FIRM_ID` |
| Admin Settings | Where firm admin enables VMS + manages subscription | Settings → Subscription → Add-ons |
| Backend | Convex mutations for code generation, verification, check-in | `convex/visitorManagement.ts` |

---

## 2. Firm Admin Setup (One-Time)

### Step 1 — Subscribe to the VMS Add-on

1. Sign in to PracticePro as a firm admin.
2. Navigate to **Settings → Subscription → Add-ons**.
3. Find the **Visitor Management System** card.
4. Click **Start 14-Day Free Trial**.
5. Confirm. The trial is active for 30 days — no payment required.

To convert to a paid subscription after the trial:

1. Email `founder@practicepro.ng` with your firm name and request to subscribe.
2. Arrange payment (₦15,000/month).
3. The founder activates the add-on from the admin dashboard — your VMS panel will show "Active" within minutes.

### Step 2 — Enable VMS in Portal Access Settings

1. Navigate to **Settings → Portal Access**.
2. Toggle **Visitor Management System** to ON.
3. Configure the default expiry window (2 / 6 / 12 / 24 hours) and grace period (default: 30 minutes).
4. Save.

### Step 3 — Share the Gatehouse URL with Security

1. In **Settings → Subscription → Add-ons → VMS panel**, copy the **Gatehouse Terminal URL**.
   - Format: `https://app.practicepro.ng/gatehouse?firmId=YOUR_FIRM_ID`
2. Send this URL to your security team.
3. Have them open it on a tablet or phone at the gatehouse. Bookmark it on the home screen for one-tap access.
4. **No PracticePro login is required** for the gatehouse terminal — it is a public page that only verifies visitor codes (no firm data is exposed).

---

## 3. Resident Workflow (Day-to-Day)

### Generating a Visitor Code

1. Resident signs in to their portal at `/portal/tenant/{accessToken}`.
2. Navigates to the **Visitors** tab.
3. Taps **Generate Code**.
4. Enters visitor name, visitor phone (optional), visit date, and expiry window.
5. The system generates a unique 6-digit code (e.g. `482917`).
6. The resident shares this code with their visitor via SMS, WhatsApp, or phone call.

### Visitor Arrival at the Gatehouse

1. Visitor arrives at the gatehouse.
2. Guard opens the gatehouse terminal (bookmarked URL).
3. Guard enters the 6-digit code.
4. The system verifies:
   - Code exists
   - Code is not expired
   - Code has not been revoked
   - Code has not already been used (if single-use)
5. The system displays: **visitor name**, **host name (resident)**, **unit number**, **property name**.
6. Guard confirms the visitor's identity matches the displayed name.
7. Guard taps **Approve Entry**.
8. The check-in is logged with a timestamp.

### Visitor Check-Out

1. When the visitor leaves, the guard enters the same code at the gatehouse terminal.
2. The system shows the active check-in record.
3. Guard taps **Check Out**.
4. The check-out is logged with a timestamp.

### Resident Code Revocation

If a resident needs to cancel a code (e.g. the visitor is no longer coming):

1. Resident opens the **Visitors** tab in their portal.
2. Finds the active code in the list.
3. Taps **Revoke**.
4. The code is immediately rejected at the gatehouse terminal.

---

## 4. Gatehouse Terminal (For Security Guards)

### Access

- **URL**: `https://app.practicepro.ng/gatehouse?firmId=YOUR_FIRM_ID`
- **Login**: None required. The URL itself identifies the firm.
- **Device**: Tablet or phone recommended. Works offline (caches the last 100 verified codes for offline lookup).

### Verification Screen

The guard sees a single input field: "Enter 6-digit code". After entry:

- **Valid code**: Shows visitor name, host name, unit number. Two buttons: "Approve Entry" and "Cancel".
- **Invalid code** (not found / expired / revoked): Shows a red error message. No buttons.
- **Already checked in**: Shows the existing check-in record. Two buttons: "Check Out" and "Cancel".

### Offline Mode

If the gatehouse terminal loses internet connection:

1. The terminal caches the last 100 verified codes locally (localStorage).
2. The guard can still verify codes that were checked in the last 24 hours.
3. New code verifications are queued and synced when connection returns.
4. A yellow "OFFLINE" indicator appears in the top-right corner.

### Audit Log

The gatehouse terminal shows the last 50 check-ins/check-outs for the current day. This is read-only — guards cannot edit or delete log entries. The full audit log is available to firm admins in the resident portal's Visitors tab.

---

## 5. Billing & Subscription Lifecycle

### States

| Status | Description |
|--------|-------------|
| `none` | No VMS add-on. Residents cannot generate codes. |
| `trial` | 30-day free trial active. All features unlocked. |
| `active` | Paid subscription active. |
| `expired` | Trial ended or subscription cancelled. Residents cannot generate new codes. Existing tokens remain valid until they expire naturally. |
| `suspended` | Founder-initiated suspension (e.g. payment failure). Same as expired. |

### Auto-Expiry

- The backend `generateVisitorToken` mutation checks the firm's VMS add-on status before generating any new token.
- If the trial has expired, the status is automatically flipped to `expired` and the mutation throws a `VMS_TRIAL_EXPIRED` error.
- If the subscription is `none` / `expired` / `suspended`, the mutation throws `VMS_ADDON_REQUIRED`.
- Founder firms (`*@practicepro.ng`) bypass the gate for testing.

### Reactivation

To reactivate an expired add-on:

1. Firm admin emails `founder@practicepro.ng` to arrange payment.
2. Founder runs `activateVmsAddon` mutation from the admin dashboard.
3. The firm's VMS panel flips to "Active" within minutes.
4. Residents can immediately generate new codes.

---

## 6. Security & Privacy

### Data Isolation

- Each visitor token is scoped to a single property + unit + resident.
- A resident can only see their own tokens — never another resident's.
- The gatehouse terminal only displays the minimum information needed for entry verification (visitor name, host name, unit). It does NOT display the resident's phone, email, or payment history.

### Audit Trail

Every VMS lifecycle event is logged with a timestamp in the `visitor_tokens` table:

- `createdAt` — code generation
- `checkedInAt` — gatehouse check-in
- `checkedOutAt` — gatehouse check-out
- `revokedAt` — resident revocation
- `expiresAt` — natural expiry

These logs are never deleted. They are available to firm admins for security investigations and dispute resolution.

### Code Generation Security

- 6-digit codes are generated server-side using `Math.random()` + collision detection (queries existing tokens for the property within the validity window).
- The probability of collision is ~1 in 1,000,000 per attempt; collision detection ensures uniqueness even in the rare case of a match.
- Codes are not predictable (no sequential numbering).

---

## 7. Troubleshooting

### Resident cannot generate a code

**Symptom**: Resident taps "Generate Code" and sees an error message.

**Possible causes**:
1. **VMS add-on not active**: Ask the firm admin to subscribe or start a trial.
2. **Trial expired**: The 30-day trial has ended. The firm admin needs to subscribe.
3. **Property has no units**: VMS requires at least one unit on the property. The admin needs to add a unit in the property's Edit modal.
4. **Resident not assigned to a unit**: The resident's portal account must be linked to a specific unit. The admin needs to assign them via the Portal Access settings.

### Gatehouse terminal shows "Firm not found"

**Symptom**: The gatehouse URL loads but shows a "Firm not found" or "URL is missing firmId" error.

**Fix**: Ensure the URL includes `?firmId=YOUR_FIRM_ID`. Copy the exact URL from **Settings → Subscription → Add-ons → VMS panel → Gatehouse Terminal URL**. Do not manually type the URL — copy-paste it.

### Code works for resident but not at gatehouse

**Symptom**: Resident generates a code successfully, but the gatehouse terminal says "Invalid code".

**Possible causes**:
1. **Code expired**: Check the expiry window (2 / 6 / 12 / 24 hours from the visit date's start). If expired, the resident needs to generate a new code.
2. **Code already used (single-use)**: If the code was set to single-use and the visitor already checked in, the code cannot be reused. Generate a new one.
3. **Code revoked**: The resident revoked the code. They need to generate a new one.
4. **Wrong firm**: The gatehouse URL is for a different firm. Verify the firmId in the URL.

### Offline indicator stays yellow

**Symptom**: The gatehouse terminal shows "OFFLINE" even though the device has internet.

**Fix**: Refresh the page. If the indicator persists, check the device's network connection. The terminal requires an active connection to verify codes that aren't in the local cache.

---

## 8. Contact & Support

- **Founder (subscriptions, activations)**: `founder@practicepro.ng`
- **Support (bugs, feature requests)**: Submit via the in-app **Help → Send Feedback** form.
- **Urgent (gatehouse down)**: Email `founder@practicepro.ng` with subject `URGENT: VMS Gatehouse Down` and include your firm name + the gatehouse URL.
