# PracticePro Documentation Index

This folder holds the **active source of truth** documentation. Historical material lives in [`docs/archive/`](archive/).

## Active documentation (root & docs/)

| Document | What it covers |
|----------|----------------|
| [`README.md`](../README.md) | Project entry point — what PracticePro is, setup, structure |
| [`ARCHITECTURE.md`](../ARCHITECTURE.md) | System architecture: Vite/React + Capacitor frontends, Convex backend, products |
| [`RUNBOOK.md`](../RUNBOOK.md) | Operations — deploys, CI, APK releases, environment, incident playbook |
| [`PUSH_NOTIFICATIONS_SETUP.md`](../PUSH_NOTIFICATIONS_SETUP.md) | FCM/service-account setup, push dispatch pipeline, debugging |
| [`SAAS_HARDENING_PLAN.md`](../SAAS_HARDENING_PLAN.md) | Live hardening roadmap (security/ops workstream) |
| [`STYLE_GUIDE.md`](../STYLE_GUIDE.md) | Brand UI & style rules (spacing, layout, visual identity) |
| [`COLOR_SCHEME.md`](../COLOR_SCHEME.md) | Brand palette + CSS-variable design system (`src/index.css` mapping) |
| [`ALOAGUIDE.md`](../ALOAGUIDE.md) | ALOA (legal AI assistant) — capabilities, identity, safety |
| [`ALOA_LOGO.md`](../ALOA_LOGO.md) | ALOA/ARIA assistant mark usage |
| [`PRACTICE_PRO_LOGO.md`](../PRACTICE_PRO_LOGO.md) | PracticePro logo usage |
| [`PRACTICE_PRO_APP_MARKDOWN.md`](../PRACTICE_PRO_APP_MARKDOWN.md) | Product one-pager (business description) |
| [`DEV_TOOLKIT.md`](../DEV_TOOLKIT.md) | Developer commands, scripts, conventions |
| [`INVOICE_GENERATION.md`](../INVOICE_GENERATION.md) | Billing flow — invoices, receipts, payments |
| [`ESTATE_COMMUNITY.md`](../ESTATE_COMMUNITY.md) | Atrium estate community features (amenities, bulletin, payments) |
| [`VMS_GATEHOUSE_SOPS.md`](../VMS_GATEHOUSE_SOPS.md) | Visitor Management System operating procedures |
| [`CONFIDENTIALITY_GUIDE.md`](../CONFIDENTIALITY_GUIDE.md) | Data protection / NDPA 2023 confidentiality architecture |
| [`CONTRIBUTING.md`](../CONTRIBUTING.md) | How to contribute |
| [`CODE_OF_CONDUCT.md`](../CODE_OF_CONDUCT.md) | Code of conduct |
| [`docs/MESSAGING_UNIFICATION.md`](MESSAGING_UNIFICATION.md) | Unified messaging design (inbox tabs, sections) |
| [`docs/testing/PUSH_VERIFICATION_PROTOCOL.md`](testing/PUSH_VERIFICATION_PROTOCOL.md) | Manual hardware checklist for push categorization/dedup |
| [`docs/worklog/`](worklog/) | Monthly engineering worklog (current month + archive) |
| [`docs/adr/`](adr/) | Architecture Decision Records |
| [`docs/glossary.md`](glossary.md) | Product names (Vega, Atrium, Komplete, ALOA, ARIA) & Nigerian legal/property terms |
| [`SECURITY.md`](../SECURITY.md) | Vulnerability reporting policy |
| [`CHANGELOG.md`](../CHANGELOG.md) | User-facing changelog (what shipped) |

## Where things went

- **One-off AI prompts, fix logs, past audits, old specs/strategy docs** → `docs/archive/` (nothing deleted; see [`archive/README.md`](archive/README.md)).
- **`upload/` & `download/` sandbox dumps** (screenshots, generated images, pasted files) → untracked from git; already listed in `.gitignore`, files remain only on local disks.
- **`audit-results/` local test screenshots** → untracked + ignored.

## Adding new documentation

1. Living docs go in `docs/` (or root for the top-level guides above) and get a row in this index.
2. Superseded docs get `git mv`'d into `docs/archive/` under the matching category — never deleted.
3. Monthly worklog entries go to `docs/worklog/worklog-YYYY-MM.md`; user-facing ship notes to `CHANGELOG.md`.
