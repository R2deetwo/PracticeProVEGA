# PracticePro — Handoff Document for GLM 5.2

> **Purpose:** This document gives a new GLM 5.2 session the complete context needed to continue work on the PracticePro codebase without re-explaining the project, the open bugs, or where everything lives.
>
> **How to use:** Paste this entire file as your first message in the new GLM 5.2 conversation. The model will then have full project context, environment pointers, current git state, the critical open bug, and pending tasks.

---

## 0. Tldr; — Read This First

You are picking up an in-progress Next.js + Convex project called **PracticePro**. Two product variants share one codebase:

- **Atrium** — property management (green branding) for property managers / landlords
- **Vega** — legal practice management (blue branding) for Nigerian law firms

The codebase is at `/home/z/my-project/`. Convex backend deployment name is `gregarious-malamute-537`.

**There is one critical, still-open bug** the user is frustrated about: residents logging in (or being previewed via impersonation) see the admin dashboard instead of the simple `TenantPortal` component. Three fix attempts have already been committed (`072e6f0`, `b8c66b1`, `2afdac4`) — none have fully resolved it. The user is extremely frustrated. **This is your top priority.**

The expected resident portal has tabs: **Notices / Ledger / Receipts / Maintenance / Messages / Payments / Documents**. No admin dashboard. No property counts. No "X units under management" widgets.

---

## 1. Project Identity

| Field | Value |
|---|---|
| Project name | `practice-pro` (see `package.json`) |
| Root directory | `/home/z/my-project/` |
| Frontend | React 18 + TypeScript + Vite (App Router style via `src/main.tsx`) |
| Backend | Convex (`convex/` directory) |
| Deployment name | `gregarious-malamute-537` |
| Convex config | `convex.json` |
| Build | `npm run build` (Vite) — deploys with `npm run deploy` |
| Dev server | `npm run dev` (Vite, host mode) |
| Package manager | `bun` (lockfile `bun.lock`) or `npm` (lockfile `package-lock.json`) — both work |
| Last commit on `main` | `245a20f docs: update worklog with race condition fix (task 6)` |
| Git remote | `origin` → push to `main` after committing |

### Tech stack details
- **React 18** (not 19 — explicit in `package.json`)
- **TypeScript 5.3+**
- **Vite 5** (NOT Next.js despite the system prompt's framing — this is a Vite SPA)
- **Convex 1.32** for backend (schema in `convex/schema.ts`)
- **Tailwind 3.4** + custom design tokens
- **TipTap 3.20** for the DraftPro rich-text editor
- **`@google/genai` 2.8** for AI (Gemini 2.5 Flash / 3 Pro)
- **lucide-react** for icons
- **framer-motion 12** for animations
- **react-router-dom 6** for routing
- **jsPDF + autoTable** for PDF generation
- **zod 4** for validation

### Note about "Next.js" mentions in older docs
The README and some docs call this "Next.js" but the actual build tool is **Vite** (`vite.config.ts`). Do not try to convert it to Next.js. The `src/app/page.tsx` file is a leftover marketing landing page and has a pre-existing TypeScript error that's been ignored.

---

## 2. Codebase Layout

```
/home/z/my-project/
├── convex/                       # Convex backend (functions + schema)
│   ├── schema.ts                 # Master schema (~50KB, all tables)
│   ├── myFunctions.ts            # Main API (~120KB — auth, users, firms, matters, etc.)
│   ├── portals.ts                # Portal/tenant API (~157KB — large, includes tenant/landlord ops)
│   ├── authHelpers.ts            # Auth utilities
│   ├── authUtils.ts              # Auth token utilities
│   ├── communications.ts         # Email/WhatsApp sending
│   ├── conversationMemory.ts     # ARIA conversation memory
│   ├── crons.ts                  # Scheduled jobs
│   ├── legalRepo.ts              # Legal document repository
│   ├── indexer.ts                # Brain/RAG ingestion
│   ├── embeddings.ts             # Vector embedding helpers
│   ├── proactive.ts              # Proactive AI nudges
│   ├── sentry.ts                 # Issue/error tracking tables
│   ├── auditLog.ts               # Audit trail
│   ├── validation.ts             # Server-side validation helpers
│   └── _generated/               # Convex auto-generated (do not edit)
│
├── src/
│   ├── main.tsx                  # App entry — mounts <App />
│   ├── App.tsx is NOT the entry — actual app component is:
│   ├── components/App.tsx        # Main app shell + routing (~1003 lines, the routing brain)
│   ├── index.css                 # Tailwind + custom CSS (~25KB)
│   ├── types.ts                  # All TypeScript types (~54KB)
│   ├── constants.tsx             # View definitions, nav config (~63KB)
│   ├── onboardingConfig.ts       # Tour/onboarding steps
│   │
│   ├── contexts/                 # React Context providers (global state)
│   │   ├── AuthContext.tsx       # ★ Auth, session, role, impersonation
│   │   ├── DataContext.tsx       # Data orchestrator
│   │   ├── UIContext.tsx         # View state, modals, navigation
│   │   ├── ProductContext.tsx    # Atrium vs Vega product mode
│   │   └── (several other split contexts under hooks/)
│   │
│   ├── hooks/                    # Context hooks (useMatterState, useFinanceState, etc.)
│   │   └── usePermissions.ts     # ★ Role-based permission gates
│   │
│   ├── components/
│   │   ├── App.tsx               # ★★★ Main routing + role guards (the bug lives here)
│   │   ├── Header.tsx            # Top bar — has impersonation banner
│   │   ├── Sidebar.tsx           # Left nav (admin only)
│   │   ├── BottomNav.tsx         # Mobile bottom nav
│   │   ├── Dashboard.tsx         # Admin dashboard (NOT for residents)
│   │   ├── TenantPortal.tsx is at:
│   │   ├── tenant/
│   │   │   └── TenantPortal.tsx  # ★★★ The correct resident portal (NOT being shown)
│   │   ├── portal/
│   │   │   └── TenantPortalLogin.tsx
│   │   ├── client/               # Client (Vega) portal views
│   │   ├── settings/
│   │   │   └── PortalAccessSettings.tsx  # ★ Where admin "Preview as tenant" lives
│   │   ├── modals/               # Modal layouts + DockedModal.tsx
│   │   ├── forms/                # All create/edit forms
│   │   ├── aloa/                 # ARIA / ALOA AI agent chat
│   │   ├── documents/            # DraftPro editor
│   │   ├── atrium/               # Atrium-specific components
│   │   ├── auth/                 # Login/signup
│   │   └── ui/                   # shadcn-style primitives
│   │
│   ├── services/                 # External API wrappers (Gemini, etc.)
│   ├── lib/                      # Pure utility libs
│   ├── utils/                    # Helpers (date, format, tax)
│   ├── agents/                   # ALOA agent definitions
│   ├── config/                   # Static config
│   └── constants/                # Static constants
│
├── prisma/                       # Legacy Prisma schema (deprecated — Convex is the source of truth)
├── db/                           # Legacy DB scripts
├── scripts/                      # One-off scripts (use this for any Python/Node utilities you write)
├── download/                     # ★ All deliverables go here (user-visible)
├── agent-ctx/                    # Prior agent task records (read for context)
├── worklog.md                    # ★★ Multi-agent shared work log — READ BEFORE STARTING
├── skills/                       # System skills (do not edit)
├── package.json
├── convex.json
├── vite.config.ts
├── tsconfig.json
└── tailwind.config.{js,ts}
```

★ = important for the open bug
★★ = read first

---

## 3. Environment & Access

### 3.1 Where secrets live
- `.env` — currently only contains `DATABASE_URL=<redacted>`. Minimal.
- `.env.example` — full template with all variables the project supports. Variables you'll need:
  - `VITE_CONVEX_URL` — Convex HTTP endpoint (frontend uses this)
  - `VITE_CONVEX_SITE_URL` — Convex site URL
  - `CONVEX_URL` — internal Convex URL
  - `CONVEX_DEPLOYMENT` — deployment identifier (`gregarious-malamute-537`-style)
  - `CONVEX_DEPLOY_KEY` — **deployment write access** (server-side only, never commit)
  - `API_KEY` / `GEMINI_API_KEY` / `VITE_GEMINI_API_KEY` — Google Gemini
  - `BREVO_API_KEY` / `BREVO_SENDER_EMAIL` — transactional email
  - `CHAKRA_ACCESS_TOKEN` / `CHAKRA_PLUGIN_ID` / `CHAKRA_PHONE_NUMBER_ID` / `CHAKRA_WA_API_VERSION` — WhatsApp

**IMPORTANT:** I do not have permission to print actual secret values. The new GLM 5.2 session running in the same environment will have file system access — just read `.env` directly, or use the Convex dashboard (`dashboard.convex.dev`) to inspect the live deployment.

### 3.2 Convex backend access
- **Deployment name:** `gregarious-malamute-537`
- **Dashboard:** https://dashboard.convex.dev/ → select `gregarious-malamute-537`
- **CLI:** `npx convex dev` (from project root) starts dev sync; `npx convex deploy` ships to prod
- **Schema:** `convex/schema.ts` — defines all tables. Major tables:
  - `firms` — organizations (each firm has a `product` field: `'atrium'` or `'vega'`)
  - `users` — has `role` (string), `firmId`, `tokenIdentifier`, `portalAccessToken`, `isVerified`, `password`, etc.
  - `matters`, `contacts`, `tasks`, `documents`, `messages`, `events` — operational data
  - `properties`, `units`, `tenants`, `leases`, `rentPayments`, `maintenanceRequests` — Atrium-specific
  - `invoices`, `expenses`, `bankAccounts`, `transactions` — finance
  - `auditLogs`, `sentry*` — observability
  - `legalRepository`, `legalNotebooks` — Vega legal research
  - `invitations`, `notifications` — comms
- **Key user role values** (stored as string in `users.role`):
  - `'Admin'` — full firm admin (sees Dashboard)
  - `'Lawyer'`, `'Paralegal'`, `'ExternalCounsel'` — Vega internal roles
  - `'Client'` — Vega client portal user (sees `ClientDashboard`)
  - `'Tenant'` — Atrium tenant portal user (should see `TenantPortal`)
  - `'Pending'` — user invited but not yet activated

### 3.3 How to inspect live data
```bash
# From project root:
npx convex dashboard     # Opens browser dashboard for gregarious-malamute-537
# Or browse to https://dashboard.convex.dev/ and select the deployment
```
You can run ad-hoc queries in the dashboard's "Data" tab.

### 3.4 Common dev commands
```bash
npm run dev              # Vite dev server with host binding
npm run build            # Vite production build (fails on TS errors except page.tsx)
npm run deploy           # convex deploy + vite build (full prod ship)
npx convex dev           # Convex dev sync (run in parallel with vite dev)
npx tsc --noEmit         # Type-check without emit
git log --oneline -20    # Recent commits
git status               # Working tree state
```

### 3.5 Pre-existing build quirk
`src/app/page.tsx` (a marketing landing page) has a TypeScript error that's been intentionally ignored for weeks. `npm run build` may fail unless you also see this error pass. Verify by running `npx tsc --noEmit` — if the only error is in `src/app/page.tsx`, you're fine.

---

## 4. Critical Open Bug — Residents See Admin Dashboard

### 4.1 User's exact complaint
> *"i am looking at a tenants portal and it looks like the main app this is not what the residents portal should look like. you already successfully did the residents portal and it looked great!!! tell me why on earth i would want the residents to be seeing the number of properties or units under management or a dashboard like what the ordinary app user sees?? please fix this!!!!!! the residents portal is a much simpler space which you have done in the past but for some reason now you cant seem to get it right!!! fix it!!!!"*

> *"you claimed to know what the issue is and know how the portal layout ought to be (with the Notices/Ledger/Receipts/Maintenance/Messages/Payments/Documents tabs — no admin dashboard, no property counts) but you are still showing the dashboard to residents !!??? what is going on!!!!????"*

### 4.2 What the resident portal SHOULD be
- Component: `src/components/tenant/TenantPortal.tsx`
- Internal tabs (see `tabs` array around line 338): **Notices / Ledger / Receipts / Maintenance / Messages / Payments / Documents**
- Each tab is a separate sub-component (`NoticesTab`, `LedgerTab`, `ReceiptsTab`, `MaintenanceTab`, `MessagesTab`, `PaymentsTab`, `DocumentsTab`) all in the same file
- Wrapped in `TabErrorBoundary` so a broken tab doesn't crash the portal
- Has its own header with dark/light mode toggle
- Fetches tenant info via `tenantInfo` resolved once at top level, then threaded to all tabs
- No sidebar, no Header component, no BottomNav, no admin shell, no Dashboard widget

### 4.3 What residents are ACTUALLY seeing
- The full admin Dashboard (property counts, units under management, overdue tasks, outstanding rent widgets)
- Sidebar + Header + BottomNav admin chrome
- Sometimes a yellow "Viewing as Marcos Gilliam (Admin) ← Return" impersonation banner

### 4.4 Three attempted fixes (ALL committed, NONE confirmed working by user)

#### Attempt 1 — commit `072e6f0` (initial layered fix)
Files changed:
- `src/contexts/AuthContext.tsx` — reject missing/null roles instead of defaulting to Admin
- `src/contexts/AuthContext.tsx` — `loginAsUser` access control (admin-only, portal-user-only, cross-firm guard)
- `src/components/App.tsx` — defensive guard: if `currentUser && isPortalUser` returns "Access restricted" screen
- `src/hooks/usePermissions.ts` — Tenant role added to allFalse gate (matches Client gating)

#### Attempt 2 — commit `b8c66b1` (impersonation auto-revert)
Files changed:
- `src/contexts/AuthContext.tsx` — `useEffect` watches `userData` while `originalSessionToken` is active; auto-reverts if actual DB role is not Client/Tenant. Dispatches `practicepro:impersonation-rejected` window event.
- `src/contexts/AuthContext.tsx` — `originalUser` memo rejects missing/null role
- `src/components/App.tsx` — defensive guard: if `originalUser && currentUser.role NOT Client/Tenant` → amber "Impersonation failed" screen with "Return to Admin Session" button. Listens for `practicepro:impersonation-rejected` and shows toast.
- `src/components/settings/PortalAccessSettings.tsx` — `handlePreview()` checks `invite.status === 'accepted'` before allowing impersonation
- `src/hooks/usePermissions.ts` — Tenant gating

#### Attempt 3 — commit `2afdac4` (race condition + persistence fix)
**This is the most recent fix.** User reported the previous fix didn't work.
- Root cause identified: `originalUser` requires `originalUserData` query (async). `currentUser` (impersonated admin) loads first → admin dashboard flashes before the guard can trigger.
- Files changed:
  - `src/contexts/AuthContext.tsx`:
    - Added `isImpersonating: boolean` to `AuthContextType` (line 43)
    - `isImpersonating = !!originalSessionToken` (synchronous — derives from state, no query wait)
    - `loginAsUser` persists original admin token to `sessionStorage` key `'practicepro_original_session'`
    - `originalSessionToken` initializer reads from `sessionStorage` on mount (survives refresh)
    - `revertToOriginalUser` falls back to `sessionStorage` if state is lost
    - `logout()` and auto-revert effect both clear the `sessionStorage` flag
  - `src/components/App.tsx`:
    - `MainContent` destructures `isImpersonating` from `useAuth()`
    - Guard changed from `if (currentUser && originalUser && !isPortalUser)` to `if (currentUser && isImpersonating && !isPortalUser)` (line 411) — fires synchronously the moment `currentUser` loads with a non-portal role
    - Amber screen fallback: if `originalUser` hasn't loaded yet, show "Restoring your admin session…"

### 4.5 What I suspect is still wrong (DO NOT TRUST — RE-INVESTIGATE)

Looking at `src/components/App.tsx` carefully, the `MainContent` component has THREE guard layers (lines 379, 411, then the main render at 447+). But there's a TOP-LEVEL `<App />` component (defined later in the same file, around lines 556–820+) that does the initial routing. The user's screenshot may be coming from a code path that bypasses `MainContent` entirely.

Specifically, look at these references in App.tsx (from grep):
- Line 556: `const isPortalUser = currentUser?.role === UserRole.Client || currentUser?.role === UserRole.Tenant;`
- Line 651, 692, 726: `const isPortal = currentUser.role === UserRole.Client || currentUser.role === UserRole.Tenant;`
- Line 736: `const isPortalUserRole = currentUser?.role === UserRole.Client || currentUser?.role === UserRole.Tenant;`
- Line 769: `if (currentUser && isPortalUserRole) { ... }` — routes to portal
- Line 774: `const portalPath = currentUser.role === UserRole.Client ? ...`
- Line 796: `if (currentUser && !isPortalUserRole) { ... }` — admin path
- Line 808: `if (currentUser && currentUser.role === UserRole.Client) { ... }`
- Line 816: `if (currentUser && currentUser.role === UserRole.Tenant) { ... }`
- Line 821: `return <TenantPortalLogin />;`
- Line 895: `if (currentUser && !currentUser.firmId && currentUser.role !== UserRole.Client && currentUser.role !== UserRole.Tenant) { ... }`
- Line 905: `if (currentUser?.role === 'Pending') { ... }`

**The actual failing case:** When an admin uses the "Preview as tenant" button in `PortalAccessSettings`, `loginAsUser()` is called with a hardcoded role object. The user being impersonated apparently has `role = 'Admin'` in the DB (or null/undefined), so when `userData` loads from Convex, `currentUser.role` becomes `'Admin'` (or the AuthContext reject-and-return-null path fires, which logs the user out). If it becomes Admin, the `isPortalUser` checks fail and the admin routing block runs — admin sees the dashboard.

The auto-revert effect in AuthContext *should* catch this, but the user reports it's not catching it in time. Possible explanations to investigate:
1. The auto-revert effect's dependency array might be missing a state, causing it to never fire
2. There's a SECOND path where `loginAsUser` is called that doesn't go through the PortalAccessSettings guard
3. The user is testing with an ACTUAL resident account (not impersonation) — in which case the resident's `role` field in the DB might literally be `'Admin'` due to a data migration issue
4. There's a stale `sessionStorage` value from a previous session that's causing `isImpersonating` to be true when it shouldn't be, OR false when it should be true
5. The `userData` query is returning a cached value from before the role was fixed

### 4.6 How to debug (start here)
1. **Read `worklog.md` lines covering Task IDs 2, 5, 6** — full history of what's been tried
2. **Read `src/components/App.tsx` in full** (1003 lines) — pay special attention to the top-level `<App />` component (after line 480), not just `MainContent`
3. **Read `src/contexts/AuthContext.tsx` in full** (~730 lines) — understand `loginAsUser`, `revertToOriginalUser`, the auto-revert effect, and the `isImpersonating` flag
4. **Read `src/components/settings/PortalAccessSettings.tsx` `handlePreview()`** — see exactly what object is passed to `loginAsUser`
5. **Check the Convex dashboard** for the actual `role` field on the tenant user the admin is previewing
6. **Add temporary debug logging** to AuthContext: log `userData.role`, `currentUser.role`, `isImpersonating`, `originalSessionToken` on every state change
7. **Consider simplifying**: maybe the entire impersonation feature should be removed and replaced with a simple "view as" that opens the tenant portal in a new tab using the tenant's `portalAccessToken`

### 4.7 The cleanest possible fix direction (suggestion, not prescription)
Consider removing impersonation entirely. The simpler approach:
- Admin clicks "View portal" on a tenant → opens `/portal/tenant/<portalAccessToken>` in a new tab
- That tab loads `TenantPortalLogin` which uses the token to authenticate as the tenant
- No `loginAsUser`, no `originalSessionToken`, no race conditions, no admin dashboard leak

This is a bigger change but eliminates the entire class of bug.

---

## 5. Pending Tasks (Beyond the Critical Bug)

These are documented in `worklog.md` but not yet started or only partially done:

### 5.1 Expand docked modal support to ALL modules including mini calendar
- **Status:** Partially done. Commit `072e6f0` added 18 new modal types including `viewEvent` (mini calendar clicks).
- **Remaining:** Verify every modal triggered from the admin app now docks properly. Check `MiniCalendar.tsx` event click handler — it should call `openModal({ type: 'viewEvent', ... })` and that should hit the `viewEvent` case in `DockedModal.tsx`.
- **Test:** Click events in the dashboard mini calendar; the event detail should slide out in the right-side docked panel, not a center modal.

### 5.2 API Key Error UX
- **Status:** Partially done. Commit `9cb7656` ("Improve API key UX + replace Firm RAG toggle with intelligent auto-RAG") addressed some of this.
- **Remaining:** When ARIA shows "API key missing" error, the error message should include a clickable link to https://aistudio.google.com/apikey so users can grab a key immediately. Verify the error component renders the link with `target="_blank" rel="noopener noreferrer"`.

### 5.3 Firm RAG Toggle Architecture Review
- **Status:** Partially done. Commit `9cb7656` replaced the manual toggle with "intelligent auto-RAG".
- **Remaining:** Evaluate whether the auto-RAG logic is correctly detecting when to engage RAG. The original concern was: should the firm-level RAG toggle be automatic (smart) or manual (admin control)? If you keep auto-RAG, document the heuristic. If you revert to manual, make sure the toggle is in firm settings.

---

## 6. Recent Commit History (last 20)

```
245a20f docs: update worklog with race condition fix (task 6)
2afdac4 fix: race condition in impersonation guard + persist impersonation state across refresh
3119714 640da4d4-60b9-4381-9e21-0f178b3265f1
b8c66b1 fix: residents seeing admin dashboard via failed impersonation
072e6f0 fix: residents seeing admin dashboard + comprehensive docked modal expansion
ead2d7c e6f153e2-3918-451a-9d39-c235bfd0bb1f
9cb7656 Improve API key UX + replace Firm RAG toggle with intelligent auto-RAG
cb9aac1 Legal terminology deep audit: Fix 80+ legal-specific terms visible to Atrium users
0701f69 Fix: Service Charge labels clarity + mobile scroll glitch
b0a9a1a 00e7ca61-3857-4ffd-9c35-5789cfd31261
218d02f fix: remove all law-specific references from Atrium/property mode
e165dbf 963d64f4-3cd6-4ab8-9662-f01c7bf130d2
402dbf0 ab29095c-1042-425a-9325-65cb147a79c0
39f104d feat: Deep modal audit & simplification — fix 14 issues across all modals
5027ea8 8b6a0548-6b56-418b-aa23-af6710e101ef
392af1d Pre-launch audit fixes: security hardening, data integrity, marketing honesty
f19ba67 37c21eae-d541-485f-a8f6-31ad60861b46
f2ebb1a fix: tour auto-start, data migration card, bold rendering, remove paste box, smaller toggle
86154a9 ab392863-f2da-4095-94cd-1d3f6ffc3dc3
79bc866 fix: comprehensive onboarding & UX overhaul
```

Note: commits with UUIDs as messages (`3119714`, `ead2d7c`, `b0a9a1a`, etc.) are auto-generated by the dev environment's commit-on-save flow. They usually contain small fixes.

---

## 7. Key Files for the Open Bug

| File | Purpose | Lines | Why it matters |
|---|---|---|---|
| `src/components/App.tsx` | Main routing + role guards | ~1003 | Both `<App />` (top-level routing) and `<MainContent />` (admin shell) live here. The bug is in how these two components decide what to render. |
| `src/contexts/AuthContext.tsx` | Auth, session, role, impersonation | ~730 | `loginAsUser`, `revertToOriginalUser`, `isImpersonating`, `originalSessionToken`, auto-revert effect — all here. |
| `src/components/tenant/TenantPortal.tsx` | The correct resident portal | ~650 | This is what residents SHOULD see. Tabs: Notices / Ledger / Receipts / Maintenance / Messages / Payments / Documents. |
| `src/components/settings/PortalAccessSettings.tsx` | Admin "Preview as tenant" UI | ~1000 | `handlePreview()` is where impersonation starts. |
| `src/hooks/usePermissions.ts` | Role-based permission gates | ~150 | Tenant and Client both gated to allFalse permissions. |
| `src/components/Header.tsx` | Top bar with impersonation banner | ~700 | Shows "Viewing as X" banner when `isImpersonating` is true. |
| `convex/myFunctions.ts` | Backend auth + user queries | ~120KB | `getUser` query returns the user record that becomes `userData` in AuthContext. |
| `convex/portals.ts` | Portal backend (tenant + client) | ~157KB | All tenant-side queries the TenantPortal uses. |
| `worklog.md` | Multi-agent work log | growing | READ THIS FIRST — full history of what's been tried. |

---

## 8. How to Resume Work — Suggested First Message to GLM 5.2

When you start the new GLM 5.2 conversation, paste this entire handoff document first. Then add a short prompt like:

```
This is a handoff from a previous session. The critical bug to fix is documented in section 4 —
residents still see the admin dashboard instead of the TenantPortal. Three fix attempts have
already been committed (072e6f0, b8c66b1, 2afdac4) and none have worked.

Please:
1. Read worklog.md to see what's been tried
2. Read src/components/App.tsx in FULL — focus on both <App /> (after line ~480) AND
   <MainContent /> (lines ~100-479). I suspect the bug is in the top-level <App /> routing.
3. Read src/contexts/AuthContext.tsx in FULL — understand isImpersonating, loginAsUser,
   the auto-revert effect, and originalSessionToken
4. Read src/components/settings/PortalAccessSettings.tsx handlePreview()
5. Then propose a fix. Don't just patch — consider whether the impersonation feature should
   be replaced with a simpler "open portal in new tab via portalAccessToken" approach.

Don't ask me clarifying questions about the bug — just dig in and propose a fix.
```

---

## 9. Things to NOT Waste Time On

- **Don't** try to convert this from Vite to Next.js — the system prompt mentions Next.js but this is a Vite SPA. The `src/app/page.tsx` is a leftover.
- **Don't** fix the pre-existing TypeScript error in `src/app/page.tsx` — it's been ignored for weeks and is unrelated.
- **Don't** refactor the Convex schema — it's working, just verbose.
- **Don't** try to merge the dual lockfiles (`bun.lock` + `package-lock.json`) — both work, pick one and move on.
- **Don't** add new tests infrastructure — there are no tests and that's by design (it's a fast-moving startup codebase).
- **Don't** ask the user clarifying questions about audience/tone/style for code tasks — they want working code, not process.
- **Don't** trust the README — it describes an older "PracticePro v6.1" iteration and doesn't mention Atrium at all.

---

## 10. Quick Reference — Auth Flow

```
User visits app
  ↓
<App /> (src/components/App.tsx, top-level)
  ├─ If no currentUser → <Login />
  ├─ If currentUser.role === 'Pending' → verification screen
  ├─ If currentUser.role === 'Client' → /portal/client path → <ClientDashboard />
  ├─ If currentUser.role === 'Tenant' → /portal/tenant path → <TenantPortal />
  ├─ If currentUser && !firmId && !portalRole → firm selection
  └─ Else (admin/internal) → <MainContent />
       ├─ Guard: if isPortalUser → "Access restricted" screen (shouldn't reach here)
       ├─ Guard: if isImpersonating && !isPortalUser → "Impersonation failed" screen
       └─ Else: render admin shell (Sidebar + Header + renderView() + BottomNav)
```

`loginAsUser(targetUser)` (impersonation):
1. Save current `sessionToken` to `originalSessionToken` state AND `sessionStorage['practicepro_original_session']`
2. Set `sessionToken` to target user's token
3. Convex `getUser` query loads target user → `userData` → memoized into `currentUser`
4. Auto-revert effect watches: if `userData.role` not in (Client, Tenant) → revert
5. `revertToOriginalUser()` restores `originalSessionToken` and clears `sessionStorage`

---

## 11. Code Style Notes

- React components are `React.FC<Props>` style (not function declarations) in most places
- Tailwind class strings are LONG — embrace it, don't refactor to extract
- shadcn/ui components live in `src/components/ui/`
- Forms use controlled inputs with `useState` (no react-hook-form)
- Modals are managed via `UIContext.openModal({ type, data })` and rendered by `ModalManager` (center) or `DockedModal` (right panel)
- Convex queries use the `useQuery(api.module.function, args)` hook pattern
- All Convex mutations go through `useMutation(api.module.function)`
- Toasts via `useToast()` hook (custom implementation, not a library)
- Dark mode via `theme` state in UIContext (toggle in Header)

---

## 12. Final Notes for the New Model

The user is **extremely frustrated** with the resident portal bug. Three fix attempts have failed. They are considering switching models to get a fresh perspective. You have an opportunity to:

1. **Actually read the code** before proposing fixes — don't pattern-match on past attempts
2. **Consider radical simplification** — maybe impersonation should be removed entirely
3. **Test your fix mentally end-to-end** before committing
4. **Commit with a clear message** and update `worklog.md` with Task ID 7 (next available)
5. **Push to main** with `git push origin main`
6. **Report back concisely** — the user does not want a long write-up, they want to know if the bug is fixed

Good luck. The codebase is solid; this is a routing/auth edge case, not a fundamental architecture problem.
