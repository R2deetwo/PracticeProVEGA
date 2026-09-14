# PracticePro Glossary

Terms a new developer (or AI agent) needs when working in this codebase. Product names, platform vocabulary, and the Nigerian legal/property terms that show up in workflows, templates, and drafting prompts.

## Products & modules

| Term | What it is |
|------|------------|
| **PracticePro** | The company/platform. Two products (Vega, Atrium) sold separately or bundled (Komplete). |
| **Vega** | The **legal practice management** product — matters, time entries, trust accounting, retainer billing, litigation drafting, court calculators. Assistant: ALOA. |
| **Atrium** | The **property management** product — properties/units/tenancies, service charges, rent collection, maintenance, visitor management. Assistant: ARIA. |
| **Komplete** | The bundle: Vega + Atrium + all add-ons (Sentry Pass, extra storage, dedicated account manager). Annual-only billing. |
| **DraftPro** | The legal word processor (TipTap-based, `src/components/documents/`) — templates, placeholders, citations, page breaks, print preview. |
| **ALOA** | **A**dvanced **L**egal **O**ffice **A**ssistant — the AI copilot for Vega. Named identity with guardrails (`ai/prompts/`, `src/components/aloa/`). |
| **ARIA** | The AI assistant for Atrium (property domain). Same engine as ALOA, different identity and knowledge focus. |
| **Sentry Pass** | The Visitor Management System (VMS) add-on: residents generate 6-digit visitor access codes, guards verify them at the gatehouse portal. |
| **Estate Community** | Atrium module for gated estates: amenity booking, estate bulletin, service-provider directory. |
| **Practice Blueprint** | The curated workspace pre-fill engine (practice-area → categories/folders/events/workflows) applied at firm creation or retroactively. |

## Platform vocabulary

| Term | Meaning |
|------|---------|
| **Founder app** | The admin build of the same codebase (`src/admin/`, `vite.admin.config.ts`, package `com.practicepro.admin`) — founder dashboard, sales pipeline, feedback inbox, broadcast console. |
| **Portal** | A external-user surface: **Tenant Portal** (residents), **Client Portal** (law-firm clients), **Gatekeeper/VMS portal** (guards). |
| **Unified Messaging** | One inbox for team chat + client/tenant conversations + system threads (`src/components/MessagingView`, `messaging/`). |
| **Automation & Dispatch Engine** | `convex/automationEngine.ts` — pre-built workflows (rent/service-charge ladders, lease expiry, rent review) with a hard dedup ledger and payment-proof suppression. |
| **SCE** | **Service Charge Equivalent** — annual Atrium subscription ÷ tenant base, shown as per-tenant monthly amount. A framing tool for property managers, not an extra fee. |
| **Dunning** | Automated past-due escalation flow for invoices. |
| **Bearer session** | The session-token auth model — `resolveCaller`/`requireFounderCaller` verify server-side on every public function. |
| **error_events** | Backend error log table (founder-readable) written via `logError`/`withCronReporting` — see `convex/observability.ts`. |
| **Sentry (the company)** | Frontend error tracking (not to be confused with Sentry Pass, the VMS feature). |

## Nigerian legal & property terms

| Term | Meaning |
|------|---------|
| **NDPA 2023** | Nigeria Data Protection Act 2023 — the privacy law the platform aligns to (DPO contact: `dpo@practicepro.ng`). |
| **FCCPA 2018** | Federal Competition and Consumer Protection Act 2018 — the consumer-protection baseline referenced in refund terms. |
| **Governor's Consent** | State governor's approval required for transfer of statutory right of occupancy — a standard conveyancing milestone in Lagos and most states. |
| **C of O (Certificate of Occupancy)** | Document evidencing statutory right of occupancy over land, issued by the state governor. |
| **Deed of Assignment** | The instrument transferring an existing interest in land from assignor to assignee; commonly paired with the Governor's Consent application. |
| **Survey Plan** | Charted land boundary document from a licensed surveyor, lodged with the state surveyor-general for verification. |
| **Tenancy agreement** | The landlord–tenant contract for residential/commercial letting (vs a *lease*, typically for longer fixed terms at a premium). |
| **Service charge** | Periodic charge to tenants/occupiers for shared building/estate operating costs (diesel, security, maintenance) — a core Atrium billing object. |
| **Undefended List** | Fast-track court procedure for undisputed debt claims — appears in PracticePro litigation workflows as "Debt Recovery (Undefended List)". |
| **NOD (Notice of Default/Demand)** | The formal demand letter before litigation; step in the automation engine's rent-collection ladder. |
| **Naira (₦, NGN)** | Currency; all billing is in NGN via Paystack. |

## People & roles

| Term | Meaning |
|------|---------|
| **Founder** | The platform owner account (founder app gates: `requireFounder`). Sees signups, sales leads, feedback, error events. |
| **Firm admin** | A customer firm's administrator (gets portal inbound notifications like new tickets). |
| **Tenant / Resident** | A person living in a managed property — Tenant Portal user, receives rent/service-charge messages. |
| **Client** | A law firm's client — Client Portal user (matters, invoices, documents). |
| **Gatekeeper / Guard** | Estate security staff using the gatehouse VMS portal. |
