# PracticePro — Complete Context & Handoff Document for Mobile App Improvement

## CRITICAL: Read This First

This document is a comprehensive handoff for an LLM/developer who will be improving the PracticePro mobile app. It contains the full project context, current state, known issues, architecture, and what needs to be done. Read it entirely before proposing any changes.

---

## 1. Project Identity

| Field | Value |
|---|---|
| Project name | PracticePro |
| Root directory | `/home/z/my-project/` |
| Frontend | React 18 + TypeScript + Vite 5 (NOT Next.js) |
| Backend | Convex (deployment: `gregarious-malamute-537`) |
| Mobile shell | Capacitor v8 (Android APK) |
| Build/deploy | Vercel (web) + GitHub Actions (APK) |
| Repo | https://github.com/R2deetwo/PracticeProVEGA |
| Live URL | https://practice-pro-vega.vercel.app |
| Total LOC | ~107,000 lines across 312 components |
| Git commits | 60+ (see git log for full history) |

## 2. Product Architecture

PracticePro is a **multi-product SaaS platform** with three product variants sharing one codebase:

- **Vega** — Legal practice management for Nigerian law firms (amber branding)
- **Atrium** — Property management for Nigerian property managers (emerald branding)
- **Komplet** — Unified workspace combining both (indigo branding, premium tier)

### User Roles
- `Admin` — Full firm admin (sees Dashboard, Sidebar, all views)
- `Lawyer`, `Paralegal`, `ExternalCounsel` — Vega internal roles
- `Client` — Vega client portal user (sees `ClientDashboard`)
- `Tenant` — Atrium resident portal user (sees `TenantPortal`)
- `Pending` — User invited but not yet activated

### Portal Architecture
- Admin app: `/` (root) — full dashboard with sidebar + bottom nav
- Resident portal: `/portal/tenant/<token>` — simple 7-tab portal (Notices/Ledger/Receipts/Maintenance/Messages/Payments/Documents)
- Client portal: `/portal/client/<token>` — legal client portal
- Portal login: `/portal/tenant/login`, `/portal/client/login`
- Landing pages: `/` (hub), `/vega`, `/atrium`, `/komplet`

## 3. Tech Stack Details

### Frontend
- React 18 (NOT 19)
- TypeScript 5.3+
- Vite 5 (build tool — NOT Next.js despite some docs saying so)
- Tailwind CSS 3.4 + custom design tokens
- TipTap 3.20 (rich-text editor for legal documents)
- `@google/genai` 2.8 (Gemini AI integration)
- lucide-react (icons)
- framer-motion 12 (animations)
- react-router-dom 6 (routing)
- jsPDF + autoTable (PDF generation)
- zod 4 (validation)
- Fuse.js (search)

### Backend (Convex)
- `convex/portals.ts` — 4,133 lines, 84 exported functions (portal/tenant API)
- `convex/myFunctions.ts` — 3,328 lines, 73 exported functions (auth, users, firms, matters)
- `convex/sentry.ts` — 30 exported functions (analytics, audit, inbound messages)
- `convex/schema.ts` — 68 tables, ~1,378 lines
- `convex/communications.ts` — Email (Brevo) + WhatsApp (Chakra) sending
- `convex/auditLog.ts` — Server-side audit trail (newly added table)

### Mobile (Capacitor)
- `@capacitor/core` v8.4
- `@capacitor/android` v8.4
- `@capacitor/cli` v8.4
- Config: `capacitor.config.ts`
- Android platform: `android/` directory
- Build: GitHub Actions (`.github/workflows/build-apk.yml`)
- Current mode: **Option A** (loads live Vercel URL — thin native shell)
- APK: Debug builds via `./gradlew assembleDebug`

### Key Files (by importance for mobile UX)
| File | Lines | Purpose |
|---|---|---|
| `src/components/App.tsx` | 1,107 | Main routing + role guards + native detection |
| `src/components/BottomNav.tsx` | 270 | Mobile bottom navigation (haptics, badges) |
| `src/components/Dashboard.tsx` | 247 | Admin dashboard (stats + widgets) |
| `src/components/MessagesView.tsx` | 1,605 | Admin messaging (inbox, conversations, bulk delete) |
| `src/components/details/PropertyDetailView.tsx` | 2,274 | Property detail (tabs: summary, units, notices, revenue, tracking, docs) |
| `src/components/tenant/TenantPortal.tsx` | 2,899 | Resident portal (7 tabs) |
| `src/components/LandingPage.tsx` | 1,075 | Marketing landing page (hub + product pages) |
| `src/components/auth/Signup.tsx` | 576 | Signup flow (product selection → form → verify) |
| `src/contexts/AuthContext.tsx` | 855 | Auth, session, impersonation, role override |
| `src/hooks/useContentProtection.ts` | 169 | Copy/paste protection + screenshot deterrent (toggleable) |
| `src/hooks/useHapticFeedback.ts` | 41 | Vibration feedback for mobile |
| `src/utils/capacitor.ts` | 82 | Native platform detection |
| `src/components/ui/ConfirmDialog.tsx` | 233 | Reusable in-app confirmation dialog |
| `src/components/modals/DeleteConfirmationModal.tsx` | 188 | Delete confirmation (matched to ConfirmDialog style) |

## 4. Current Mobile State

### What's DONE (working):
- ✅ Capacitor APK builds via GitHub Actions (Node 22, JDK 21, Android SDK 36)
- ✅ APK installs and loads in BlueStacks + real devices
- ✅ Network security config allows WebView to load Vercel URL
- ✅ Native platform detection (`isNativePlatform()`)
- ✅ Landing page bypassed in native app — goes straight to signup
- ✅ Real splash screen (cinematic Vega→Atrium morph) plays after native splash
- ✅ Portal login buttons in native app (Resident Portal + Client Portal)
- ✅ Bottom navigation with haptic feedback (vibration on tap)
- ✅ Safe area handling (notch, status bar, gesture bar)
- ✅ Touch targets minimum 44×44px
- ✅ Active press states (scale-down on tap)
- ✅ No browser tap highlight (no blue flash)
- ✅ Content protection toggle (copy/paste blocking — toggleable in Settings)
- ✅ In-app confirmation dialogs (replaced all browser confirm/alert)
- ✅ Dashboard mobile optimization (Phase 2A — responsive widgets)
- ✅ Message delete (individual + bulk multi-select)
- ✅ Message badge auto-clear on view
- ✅ Notice board working (create, archive, restore)
- ✅ Portal access delete (hard-delete, not just revoke)
- ✅ Email branding correct per product (ref-based, bulletproof)
- ✅ URL routing: `/vega`, `/atrium`, `/komplet` for landing pages
- ✅ URL shows product: `?app=atrium` or `?app=vega` in admin app

### What's PARTIALLY DONE (needs improvement):
- ⚠️ Phase 2B (Property & Matter Detail Views) — NOT started (2,274 lines of dense tables/tabs)
- ⚠️ Phase 2C (Messages & Communications) — partially done, needs bottom sheet patterns
- ⚠️ Phase 2D (Billing, Calendar, Tasks, Settings) — NOT started
- ⚠️ Phase 3 (Native features) — haptics done, but no deep-linking, no bottom sheets, no pull-to-refresh
- ⚠️ Phase 4 (Hardening) — NOT started

### What's NOT DONE (known gaps):
- ❌ No deep-linking (email links don't open the app)
- ❌ No bottom sheet modals (everything uses center-screen modals)
- ❌ No pull-to-refresh on list views
- ❌ No offline support (Option A requires network)
- ❌ No push notifications
- ❌ No biometric authentication
- ❌ No native camera integration (maintenance requests use file input)
- ❌ No native file storage (documents use Convex storage only)
- ❌ No skeleton loaders on most pages (only Dashboard has them)
- ❌ No swipe gestures (swipe to delete, swipe to navigate)
- ❌ Property detail view has horizontal overflow on mobile (dense tables)
- ❌ Calendar view shows month grid on mobile (too cramped)
- ❌ Tasks view shows Kanban board on mobile (should be vertical list)
- ❌ Settings forms are desktop-sized (not optimized for touch)
- ❌ No loading states on many actions (buttons just spin or nothing happens)
- ❌ No error boundaries on most pages (crashes take down the whole app)
- ❌ App feels slow in BlueStacks (Option A loads from network every time)
- ❌ No APK versioning or update mechanism
- ❌ No release signing (only debug builds)

## 5. Known Issues & Bugs

### Recently Fixed (verify they stay fixed):
1. Residents seeing admin dashboard — fixed via `impersonationRoleOverride` + `preferPortalRole` in getUser
2. Duplicate emails causing wrong role resolution — fixed via `preferPortalRole` flag
3. Message delete not working — fixed via `adminDeletePortalMessage` mutation + isDeleted filter
4. Notification badge won't clear — fixed by auto-marking all 3 message types as read
5. Notice board crash — fixed (missing `TrashIcon` import + `firmId` scoping)
6. Email branding wrong (Vega email from Atrium signup) — fixed via `useRef` for product
7. Portal delete showing as "revoked" — fixed via `deletePortalInviteAndCleanup` hard-delete
8. White screen in BlueStacks — fixed via `network_security_config.xml` + `usesCleartextTraffic`
9. 404 on `/vega` for authenticated users — fixed via redirect to `/`

### Potentially Still Broken (needs testing):
- Content protection toggle may not fully disable copy/paste CSS
- Screenshot protection doesn't work (OS-level — impossible in web/WebView)
- Some delete confirmation dialogs may still use old styling
- `src/app/page.tsx` has a pre-existing TypeScript error (ignored for weeks)
- Convex `audit_logs` table was newly added — may have issues
- Portal login from native app may not persist session correctly
- The app may be slow because Option A loads everything from Vercel

## 6. Architecture Decisions Made

### Auth Flow
```
User visits app
  ↓
<App /> (src/components/App.tsx)
  ├─ If native app → bypass landing, auto-open signup modal
  ├─ If no currentUser → <Login /> or <Signup />
  ├─ If currentUser.role === 'Pending' → verification screen
  ├─ If currentUser.role === 'Client' → /portal/client → <ClientDashboard />
  ├─ If currentUser.role === 'Tenant' → /portal/tenant → <TenantPortal />
  ├─ If currentUser && !firmId && !portalRole → OnboardingWizard
  └─ Else (admin/internal) → <MainContent />
       ├─ Guard: if isImpersonating && !isPortalUser → "Impersonation failed" screen
       └─ Else: Sidebar + Header + renderView() + BottomNav
```

### Impersonation Flow (admin previews tenant portal)
1. Admin clicks "Preview" in PortalAccessSettings
2. `loginAsUser()` saves admin token to `sessionStorage['practicepro_original_session']`
3. Sets `impersonationRoleOverride` (ref + sessionStorage) = 'Tenant'/'Client'
4. `currentUser` memo uses override role instead of DB role
5. App routes to TenantPortal (because role is now 'Tenant')
6. Admin sees the portal with "Return to Admin" banner
7. `revertToOriginalUser()` restores admin session + clears override

### Convex getUser Resolution (critical for duplicate emails)
- `getUser` now accepts `preferPortalRole?: boolean`
- When true: collects ALL matching records, prefers Client/Tenant over Admin
- This fixes the case where the same email exists as both Admin and Tenant
- `verifyLogin` accepts `portalType?: 'tenant' | 'client'` — refuses login if resolved role isn't portal

### Content Protection
- Toggleable in Settings → Data Management
- When ON: `user-select: none` CSS + copy/cut/paste event prevention + right-click disabled
- When OFF: all protection removed, user can copy/paste freely
- Screenshot protection: IMPOSSIBLE in web/WebView — toggle only controls copy/paste
- `useContentProtection` hook polls localStorage every 500ms for toggle changes

### Mobile Navigation
- Desktop: Sidebar (left, 256px) + Header (top)
- Mobile: BottomNav (5 items: 4 primary + "More") with haptic feedback
- "More" opens a grid of secondary nav items in a bottom sheet
- Safe areas handled via CSS `env(safe-area-inset-*)` utilities

## 7. Key Configuration Files

### capacitor.config.ts
- `appId: 'com.practicepro.app'`
- `appName: 'PracticePro'`
- `server.url: 'https://practice-pro-vega.vercel.app'` (Option A — live URL)
- `android.allowMixedContent: true`
- `android.webContentsDebuggingEnabled: true`
- Splash: 100ms native → web splash takes over

### Android Build
- `compileSdkVersion = 36`
- `minSdkVersion = 24`
- `targetSdkVersion = 36`
- Android Gradle Plugin: `8.13.0`
- Java: VERSION_21 (explicit compileOptions)
- Gradle: `./gradlew assembleDebug --no-daemon`

### GitHub Actions Workflow
- Node.js 22 (required by Capacitor v8)
- JDK 21 (required by AGP 8.13)
- Android SDK API 36 + build-tools 36.0.0
- `npm install --no-audit --no-fund` (not `npm ci` — more forgiving)
- `npx vite build` (not `npm run build` — bypasses script issues)
- `npx cap sync android`
- `./gradlew assembleDebug`
- APK uploaded as artifact (30-day retention)

### Vercel
- Auto-deploys on push to `main`
- `vercel.json` has SPA rewrite: `/(.*) → /index.html`
- No Edge Middleware (was removed — caused build failures)

## 8. Mobile UX Patterns Already Implemented

### CSS Utilities (src/index.css)
```css
.pb-safe, .pt-safe, .pl-safe, .pr-safe, .px-safe, .py-safe  /* Safe area insets */
.touch-target  /* min 44×44px */
.active-press  /* scale(0.96) on :active */
.active-press-lg  /* scale(0.98) on :active */
.animate-slide-up-sheet  /* Bottom sheet animation */
.animate-slide-in-left  /* Drawer animation */
.skeleton-shimmer  /* Loading skeleton */
.mobile-scroll  /* Momentum scrolling */
.no-select-mobile  /* Disable text selection on mobile UI chrome */
```

### Hooks
- `useHapticFeedback()` — light/medium/heavy/success/error vibration patterns
- `useContentProtection(enabled)` — copy/paste protection with toggle
- `useConfirm()` — in-app confirmation dialog (replaces window.confirm)

### Component Patterns
- `ConfirmDialog` — themed modal with icon, title, message, danger button
- `DeleteConfirmationModal` — matches ConfirmDialog style, supports verification/password
- `BottomNav` — 5-item bottom nav with haptics + More menu bottom sheet
- `isNativePlatform()` — detects Capacitor vs web browser

## 9. What Needs Improvement (Priority List)

### HIGH PRIORITY — User-Facing Issues
1. **Property Detail View** (2,274 lines) — horizontal overflow, dense tables, tab bar cramping on mobile
2. **Matter Detail View** — same issues as Property Detail
3. **Messages View** — needs bottom sheet for quick reply, conversation list needs better mobile layout
4. **Calendar View** — month grid is unusable on mobile, needs day/agenda view
5. **Tasks View** — Kanban board doesn't work on mobile, needs vertical swipeable list
6. **Settings** — forms are desktop-sized, need accordion + full-width inputs
7. **Billing View** — tables overflow, need card-list transformation
8. **App speed** — Option A loads from network every time; consider Option B (bundled) or caching
9. **Loading states** — many actions have no feedback (buttons spin or nothing happens)
10. **Error handling** — most pages have no error boundaries, crashes take down the whole app

### MEDIUM PRIORITY — Native Features
11. **Deep-linking** — email links should open the app directly (need intent-filter in AndroidManifest)
12. **Bottom sheet modals** — replace center-screen modals for mobile micro-tasks
13. **Pull-to-refresh** — on all list views
14. **Push notifications** — via Firebase Cloud Messaging
15. **Biometric auth** — fingerprint/face unlock
16. **Native camera** — for maintenance requests and document uploads
17. **Offline support** — cache data locally, sync when online
18. **Swipe gestures** — swipe to delete, swipe to navigate

### LOW PRIORITY — Polish
19. **Skeleton loaders** — on all pages (only Dashboard has them)
20. **Native transitions** — page slide animations
21. **Dark mode verification** — ensure all new components support dark mode
22. **Accessibility** — screen reader support, text scaling
23. **Performance** — lazy load heavy views, code splitting
24. **APK versioning** — version codes, update mechanism
25. **Release signing** — currently only debug builds

## 10. Things to NOT Do

- **DO NOT** convert from Vite to Next.js (it's a Vite SPA, not Next.js)
- **DO NOT** fix the pre-existing TypeScript error in `src/app/page.tsx` (intentionally ignored)
- **DO NOT** refactor the Convex schema (it's working, just verbose)
- **DO NOT** try to merge the dual lockfiles (`bun.lock` + `package-lock.json`)
- **DO NOT** add new test infrastructure (no tests by design — fast-moving startup)
- **DO NOT** trust the README (describes an older "PracticePro v6.1" iteration)
- **DO NOT** remove the `next.config.ts` file (leftover, but Vercel needs it to not exist — it was causing build issues)
- **DO NOT** push `.github/workflows/` files without `workflow` scope token
- **DO NOT** attempt screenshot prevention (impossible in WebView — be honest about it)
- **DO NOT** break existing auth flow (it's fragile but working)
- **DO NOT** refactor business logic or state machines (only layout/interaction layer)

## 11. Build & Deploy Commands

```bash
# Web (Vercel auto-deploys on push to main)
npm run build          # Vite production build
npm run dev            # Vite dev server

# Convex backend
npx convex deploy      # Deploy Convex functions
npx convex dev         # Dev sync (run alongside vite dev)

# Android APK
npm run cap:sync       # Build web + sync to Android
npm run apk:debug      # Full debug APK build (local)
# OR via GitHub Actions (cloud build — recommended)

# Type check
npx tsc --noEmit       # Check for TS errors (expect 1 pre-existing in src/app/page.tsx)
```

## 12. Convex Deployment Access

- **Deployment name:** `gregarious-malamute-537`
- **Dashboard:** https://dashboard.convex.dev/t/practicepro-vega/practice-pro-production/gregarious-malamute-537
- **Deploy key:** Available in the conversation context (CONVEX_DEPLOY_KEY env var)
- **URL:** https://gregarious-malamute-537.convex.cloud

## 13. User's Stated Preferences & Requirements

1. **Top-tier SaaS quality** — "mobile apps that are beautifully done tend to be quite successful"
2. **No browser messages** — all alerts/confirms must be in-app themed modals
3. **Consistent styling** — all delete warnings must look identical
4. **Product-specific branding** — Vega emails say Vega, Atrium emails say Atrium
5. **Clear URL architecture** — user should tell which product they're in from the URL
6. **Light/dark mode** — landing page must respect theme (was hardcoded dark)
7. **Content protection toggleable** — user needs to take screenshots for support
8. **Native app feel** — no landing pages in the APK, straight to auth
9. **Portal access in app** — tenants and clients should be able to log in from the app
10. **Zero regression** — don't break existing functionality when improving mobile

## 14. Mobile Transformation Progress

### Phase 1: Core Shell ✅ COMPLETE
- Safe area handling (notch, status bar, gesture bar)
- Bottom nav with haptics + active press states
- Touch targets (44×44px minimum)
- Viewport meta tags (no zoom, theme-color)
- Splash screen handoff (native → web splash)

### Phase 2A: Dashboard ✅ COMPLETE
- Responsive stats widgets (stack on mobile)
- Tasks widget header restructured for mobile
- Recent matters widget optimized
- Tier access banner stacks vertically
- All interactive elements have active-press

### Phase 2B: Property & Matter Detail ❌ NOT STARTED
- PropertyDetailView (2,274 lines) — needs:
  - Tab bar → horizontal scroll on mobile
  - Unit cards → stacked layout
  - Revenue tables → card-list transformation
  - Notice board → already fixed, verify mobile layout
  - Activity tracking → vertical timeline on mobile

### Phase 2C: Messages & Communications ⚠️ PARTIAL
- MessagesView (1,605 lines) — partially done:
  - Multi-select bulk delete ✅
  - Auto-mark-as-read ✅
  - Individual message delete ✅
  - Still needs: bottom sheet for quick reply, better mobile conversation layout

### Phase 2D: Billing, Calendar, Tasks, Settings ❌ NOT STARTED
- BillingView — tables need card-list transformation
- CalendarView — needs mobile day/agenda view
- TasksView — Kanban needs vertical list on mobile
- Settings — needs accordion sections + full-width forms

### Phase 3: Native Features ❌ NOT STARTED
- Deep-linking
- Bottom sheet modals
- Pull-to-refresh
- Push notifications
- Biometric auth
- Native camera
- Offline support

### Phase 4: Hardening ❌ NOT STARTED
- Error boundaries on all pages
- Skeleton loaders
- Performance optimization (lazy loading, code splitting)
- Dark mode verification
- Accessibility (text scaling, screen reader)
- Release signing

## 15. Final Notes

The codebase is **solid but large** (107K LOC, 312 components). The main issues are:
1. **Mobile responsiveness** — most views were designed desktop-first
2. **Performance** — Option A (live URL) is slow on mobile; consider Option B (bundled)
3. **Consistency** — multiple dialog systems, styling patterns need unification
4. **Error handling** — most pages crash the whole app on error

The user is **launching soon** and wants the app to feel like a top-tier SaaS. They are detail-oriented and frustrated by repeated issues. Any improvement plan should:
- Be phased (small, testable commits)
- Not break existing functionality
- Be honest about limitations (e.g., screenshot prevention)
- Prioritize user-facing issues over technical debt
- Include APK testing after each phase
