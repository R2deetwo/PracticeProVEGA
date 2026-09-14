# Setup Wizard Design — PracticePro (Vega + Atrium + Komplet)

## Research Summary

Top-tier apps that have long setups use these patterns:

### 1. Progressive Disclosure (Stripe, Notion)
- Show only what's needed RIGHT NOW
- Each step has a clear "why" — the user understands what each field does
- Steps can be skipped and completed later
- A progress bar shows how far along they are

### 2. Checklist Model (Linear, Slack)
- After initial signup, show a "getting started" checklist
- Each item is independently actionable
- Progress indicator (3 of 7 completed)
- Items can be done in any order

### 3. Guided Tour (Notion, Loom)
- After the wizard, highlight key features with tooltips
- "Click here to create your first matter"
- Dismissible — experienced users can skip

### 4. Template/Presets (Notion, Canva)
- Pre-configure common settings based on the user's profile
- "You're a property manager with 20+ units? Here are recommended settings"
- Reduces decision fatigue

## PracticePro Setup Wizard Design

### Architecture: Hybrid Wizard + Checklist

**Phase 1: Initial Wizard (modal, 5 steps)**
- Shown immediately after signup/workspace creation
- Cannot be skipped (but steps within can be skipped)
- Sets up the essentials that make the app usable

**Phase 2: Getting Started Checklist (sidebar widget + Dashboard banner)**
- Shown after the wizard completes
- Persists until all items are done
- Each item links to the relevant settings page
- Can be dismissed but reappears if incomplete
- Reset affordance: Settings → Help → "Reset Setup Checklist"

---

### Phase 1: Initial Wizard Steps

#### Shared Step 1: Workspace Basics (all products)
- Workspace/Portfolio/Firm name (pre-filled from signup)
- Address (optional)
- Phone number (for WhatsApp alerts)
- Logo upload (optional)
- Save → creates the firm record

#### Step 2A: Vega (Law Firm) — Practice Setup
- Areas of practice (checkboxes: Litigation, Corporate, Real Estate, Family, Criminal, IP, etc.)
- Court jurisdictions (all 36 states + FCT — multi-select)
- Default billing model (Hourly / Fixed Fee / Retainer / Mixed)
- Default hourly rate (if hourly)
- Trust accounting enabled? (toggle)

#### Step 2B: Atrium (Property Management) — Portfolio Setup
- Property type (Residential / Commercial / Mixed-use / Serviced Apartments / Estate)
- How many properties/units do you manage? (1-5 / 6-20 / 21-100 / 100+)
- Rent collection mode (Full (Collect Rent) / Management Only)
- Default rent frequency (Monthly / Quarterly / Annually)
- Service charge structure? (Diesel / Security / Cleaning / Water / Other — multi-select)
- Bank account for collections (bank name + account number + account name)

#### Step 2C: Komplete — Unified Setup
- Shows BOTH 2A and 2B in sequence
- "Set up your legal practice first, then your property portfolio"

#### Step 3: Communication Channels (all products)

This step records the user's **intent** for outbound communication. No API
keys or phone numbers are collected during onboarding — credentials are
configured later in Settings → Integrations once the user is ready.

The step opens with a short explanation of what each channel does, then asks
the user to pick which channels they intend to use. Pick = "I plan to use
this channel and want PracticePro to remind me to set it up if I haven't
connected it within 7 days."

**Channel relevance (shown to user):**

> **WhatsApp** — Rent reminders, overdue notices, and lease-expiry nudges to
> tenants. Matter status updates, court-date alerts, and document-signing
> requests to clients. Best for time-sensitive, two-way conversations — most
> Nigerian recipients read WhatsApp within minutes.
>
> **Email** — Invoice delivery, monthly statements, formal letters, and
> engagement letters. Best for documents the recipient needs to keep on
> file. Email is also the fallback channel when WhatsApp is undelivered.

**Question 1 — "Will you use WhatsApp to send client/tenant notifications?"**
- Yes — I plan to use WhatsApp
- Not yet — Skip for now, I'll set it up later

**Question 2 — "Will you use Email to send invoices and formal notices?"**
- Yes — I plan to use Email
- Not yet — Skip for now, I'll set it up later

If both are skipped, show a soft note:
> "No problem — we'll send in-app notifications only. You can connect WhatsApp
> and Email anytime from Settings → Integrations."

**What gets saved:** `firmDetails.settings.communicationChannels = { whatsapp: boolean, email: boolean }`
plus a `communicationSetupReminderAt` timestamp 7 days in the future — used
by the existing reminder cron to nudge the user if they opted in but never
configured credentials.

**What is NOT asked:** WhatsApp phone number, WhatsApp Business API access
token, Brevo/Sendgrid API key, SMTP credentials. Those belong on the
Integrations settings page, where the user can paste credentials securely
when they have them ready.

#### Step 4: Team Setup (all products)
- "Will anyone else be working in this workspace?"
- If yes: show invite form (email + role)
- If no: "You can invite team members later from Settings → Team"
- Either way: surface the firm's invite code with a Copy button

#### Step 5: Review & Confirm
- Summary of all choices (workspace, plan, channels as chips, team intent, invite code)
- "Start using PracticePro" button
- Saves all settings via Convex mutations

---

### Phase 2: Getting Started Checklist (persistent widget)

After the wizard completes, show two companion artifacts:

1. **Sidebar widget** (always-visible while incomplete, dismissible, collapsible)
2. **Dashboard banner** (louder, dismissable, auto-hides when complete)

**Vega Checklist:**
- [ ] Create your first matter
- [ ] Add a client contact
- [ ] Set your billing rate
- [ ] Configure court dates for a matter
- [ ] Invite a team member
- [ ] Send your first WhatsApp reminder

**Atrium Checklist:**
- [ ] Add your first property
- [ ] Add a resident to a unit
- [ ] Set up service charges
- [ ] Configure bank account for collections
- [ ] Send your first rent reminder
- [ ] Invite a resident to the portal

**Komplete Checklist:**
- Combined list of both

Each item:
- Links to the relevant page/modal
- Auto-completes when the action is done (detected via Convex query)
- Shows a green checkmark when done
- Can be dismissed entirely ("I'll figure it out myself")

**Reset affordance:** Settings → Help → "Reset Setup Checklist" button clears
both localStorage dismissal flags (sidebar + banner) per-firm, so users who
dismissed the prompts can bring them back. Does NOT reset actual progress —
only re-displays the prompts so the user can see what's left.

---

### Implementation Plan

1. **Extend OnboardingWizard.tsx** — add steps 3-5 (currently only has 1-2) ✅ Done
2. **Add product-specific Step 2** — fork Atrium vs Vega vs Komplet (deferred — Step 2 currently picks plan only)
3. **Create GettingStartedChecklist component** — persistent sidebar widget ✅ Done
4. **Add Convex queries** to detect checklist completion (hasMatter, hasProperty, hasBankAccount, etc.) ✅ Done
5. **Add "Complete Setup" banner** — shows on dashboard until checklist is done ✅ Done
6. **Add communication setup reminder cron** — daily at 08:00 UTC, nudges firms past their 7-day timestamp ✅ Done
7. **Add "Reset Setup Checklist" affordance** — Settings → Help → button clears both localStorage keys per-firm ✅ Done
