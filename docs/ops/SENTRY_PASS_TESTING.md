# Sentry Pass — Gatehouse Station + Staff Time-Tracking: Test Guide

> TASK 94 (2026-11-25). This is the owner's hands-on path to create a
> gatehouse account RIGHT NOW and run real gate operations side-by-side —
> resident code on one device, gate terminal on another.

## What changed in one paragraph

The gate terminal at `/gatehouse?firmId=…` used to be a fully public page:
anyone with the URL could verify codes, check visitors in and out. Now the
estate admin provisions **Gatehouse Stations** (e.g. "Main Gate", "Gate 1")
each with a PIN; the moment a station exists, the terminal locks and every
gate endpoint requires that station's session. Visitors' passes come from
their **resident ahead of arrival** (the primary flow — the old "no pass?
raise a request" desk is gone). In-house **workers** get admin-issued staff
passes whose check-in/check-out stamps become the **attendance log**.
Nigerian phone numbers normalise canonically everywhere, and WhatsApp
delivery failures show on the pass itself instead of failing silently.

## The 10-minute test path

### 1. Provision a station (as the estate admin)

1. Sign in to the app with the Atrium admin account → **Settings →
   Security & Access** (the page with the Sentry Pass reports).
2. Scroll to **Gatehouse Stations**:
   - pick the estate (e.g. Palm Grove) and name the station (e.g. `Main Gate`);
   - optionally type your own PIN (4-8 digits) — or leave blank for an
     auto-generated 6-digit PIN;
   - click **Add station**.
3. The PIN is shown **once** — copy it. (Forgotten? **Reset PIN** re-issues
   one; compromised? **Revoke** kills every tablet session instantly.)
4. Copy the **terminal URL** shown in the panel — it is
   `https://practice-pro-vega.vercel.app/gatehouse?firmId=YOUR_FIRM_ID`
   with your real firmId filled in.

### 2. Open the gate terminal (phone/tablet — second device or same browser)

1. Open the copied URL. The terminal now shows the **station login screen**
   (it is locked because your station exists).
2. Pick `Main Gate`, enter the PIN, **Sign in to terminal**.
3. You see the verification screen only — nothing else: no financials, no
   leases, no directories, no settings. A station session can reach ONLY
   these six gate endpoints (verify / check-in / check-out / search /
   logs / denial-recording).
4. **Log out** button (top-right) returns to the lock screen.

### 3. Generate a resident visitor code (the primary flow)

1. As a tenant, open the **tenant portal → Visitors** tab.
2. Fill visitor name + phone (type it however you like — `08012345678`,
   `+234 801 234 5678`, even the double-prefix `23408012345678` — the live
   hint under the field shows the exact `+234 …` number that will be used;
   an invalid number is refused up front).
3. Delivery: **Share via My WhatsApp** (opens your WhatsApp prefilled to
   the visitor) or **Send from Portal** (server-side WhatsApp).
4. If you chose Send from Portal, watch the code card's delivery badge:
   `Delivered ✓`, `Sending…`, or **`Not delivered — <reason>`**
   (invalid phone / not configured / quota / 24h-window / template
   rejection). Failures are never silent any more.

### 4. Verify at the gate (side-by-side)

1. On the gate terminal, type the visitor's 6-digit code (auto-verifies at
   6 digits; the 12-char Pass ID also works).
2. **Valid Entry** → the visitor name, unit, host, expected arrival, gate
   instructions → **Approve Entry** (check-in) → later **Check Out** from
   Today's Activity.
3. Type a wrong code → Invalid; **Record denied entry** with a reason —
   it lands in the estate admin's Security report.
4. A guest with no code? The terminal now says: the code comes from the
   resident they are visiting — no request form at the gate.

### 5. Quiet staff time-tracking (in-house only)

1. As the estate admin: **Settings → Security & Access → Staff Passes**.
2. Issue a pass: worker name (`Mama Ada`), role (`Cleaner`), estate,
   date, validity window → **Issue staff pass** → shown once, e.g. `748291`
   (tell the worker offline — no WhatsApp).
3. At the gate, the worker's code verifies with a **STAFF · Cleaner**
   badge and `Approved by` line; **Approve Entry (log arrival)** stamps
   the arrival; **Check Out** stamps departure.
4. Back in StaffPassesPanel, **Pull** the attendance log (date range) —
   per worker per day: first arrival, last departure, entries, durations.

## Notes

- Firms that never provision a station keep the legacy open terminal —
  nothing changes until the first station exists.
- Gate offline mode still works (last 100 verifications cached).
- Billing: staff passes pass the same VMS add-on gate as visitor codes.
- Phone canonicalisation: `convex/ngPhone.ts` (server) and
  `src/utils/ngPhone.ts` (client) are the twins; both pinned by
  `tests/unit/ngPhone.test.ts`.
