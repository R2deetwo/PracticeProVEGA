# Changelog

User-facing notes on what shipped. One line per thing that matters to people using PracticePro. Engineering detail lives in `docs/worklog/` (monthly) and commit history.

## Unreleased (on main, next APK build)

- **Refund requests (30-day money-back guarantee)** — the guarantee on annual plans is now a real in-app flow: request a refund from Settings → Billing & Plans, track its status, and withdraw it while pending. The founder reviews every request in a new Refunds view of the founder app; refund money moves manually via Paystack with a full audit trail. Terms of Service §12.3 now matches the guarantee (was: "non-refundable").
- **Design tokens** — the app's colors now flow through a semantic token layer; first components migrated with zero visual change, and CI now blocks new uses of the inconsistent `gray` palette.
- **Tenant Portal refactor** — the residents' portal was re-architected internally (16 focused modules instead of one 4,526-line file). No feature changes; faster, safer iteration.
- **Backend error visibility** — payment, messaging, and automation failures are now recorded in a queryable error log the founder can inspect, not just console output.
- **Repo cleanup** — 47 historical specs/audits archived to `docs/archive/`, sandbox dumps untracked, docs index added.

## v1.0.612 — 2026-09-14

- Push notifications round 2: founder gets signups, maintenance-status, and support-thread pushes; notification tray icon fixed (real app icon instead of the generic "i" badge).

## v1.0.611 — 2026-09-14

- **Smart push notifications**: messages arrive with the actual text preview (not "you have a message"), routed into Messages / Tasks / Signups channels, grouped one-row-per-conversation with unread counts, no duplicates while the app is open.

## v1.0.610 — 2026-09-13

- One-click password reset links (no recovery-code detour), chat identity + scroll fixes, floating back-to-top, scheduled-tab layout fixes.

## v1.0.608–609 — 2026-09-13

- Recovery-key UX, FCM payload 400 fix, privacy-policy naming, chat auto-scroll, complete automation template library.

## v1.0.570–607 — 2026-09-08 → 09-13

- **Automation & Dispatch Engine** (replaces Scheduled Messages): pre-built workflows (rent, service charge, lease expiry, rent review), per-firm toggles, live queue with pause/resume/cancel, hard no-duplicate guarantees, payment-proof suppression (hold on upload, cancel on approval, resume on rejection).
- Automated emails now carry the firm letterhead, an unsubscribe link, and "Powered by PracticePro Systems".
- WhatsApp template fixes end-to-end (Meta-approved templates actually sending), message-type mappings, test-send diagnostics.
- Messaging overhaul: one inbox (team + client/tenant + system), one composer, honest send results, resident auto-fill, Outbox.
- Founder app account recovery — including the forgot-which-email path.
- Estate Community (amenity booking, bulletin, service-provider directory), VMS gatehouse SOPs, Visitor Portal with 6-digit access codes.
- Login-code reliability fix (the "every code rejected" outage), Aloa authentication fix, Messages false-"sent" fix.

## v1.0.564–569 — 2026-09-05 → 09-08

- APK update channel repaired (stable signing key restored — updates install cleanly again).
- Observability round: backend `error_events` table + Sentry relay, RUNBOOK, backup/restore drills.
- Round-18 identity hardening (session-verified callers across portal + notification endpoints).

## v1.0.563 and earlier — through 2026-09-05

- PracticePro VEGA launch series: Vega (legal practice management with ALOA), Atrium (property management with ARIA), Komplete bundle, DraftPro legal word processor with citation tooling, client & tenant portals, trust accounting, service-charge monitoring, billing monitor, retainer billing, Paystack payments with webhooks, Brevo email, WhatsApp via Chakra, Estate Community, Practice Profile Engine (curated workspace blueprints), Unified Messaging, Sentry-pass visitor management.
