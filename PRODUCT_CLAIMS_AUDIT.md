# Product Claims Audit — Vega & Atrium (R27)

Owner direction (2026-10-16): *"I am not sure whether my app can do all the
things that are mentioned in the One System / Six Instruments. I think it can
do all the things it says — but how WELL can it do the things it claims?
Look at the stuff I have in the app and see if it can be improved even better
than it is."* This document is the honest ledger: every public claim on
/vega and /atrium, what actually ships behind it, the verdict, and where
improvement and further development should go next.

Method: each claim was traced to the shipping module (not the marketing
copy). "Shipped" means a user can perform the claim end-to-end in the app
today. "Shipped — strengthen next" means the capability exists but has a
known ceiling listed in the improvement column.

---

## 1. Vega — "One system, six instruments" (VegaSuite)

| # | Claim (verbatim from the site) | Backing module(s) | Verdict |
|---|---|---|---|
| 01 | *Cases organised by court, jurisdiction and matter type — documents, parties and deadlines in one workspace.* | `MatterDetailView`, `matterService`, jurisdiction config | Shipped |
| 02 | *DraftPro Editor — A4 pagination, Nigerian legal fonts, placeholder guardrails that block printing until every blank is filled.* | `DraftProEditor` (tiptap), `LegalPlaceholder` extension, `PrintPreviewDrawer` | Shipped — strengthened this round (see §4) |
| 03 | *ALOA AI Copilot — drafts, case summaries and precedent research — trained on Nigerian legal terminology and court rules.* | `AloaChat`, `geminiService` + precision protocol, `ResearchAgent` | Shipped |
| 04 | *Court Rules Agent — filing deadlines computed from the Civil Procedure Rules of the matter's court — 36 states and the FCT.* | `jurisdictionConfig.ts` (per-state rules + captions), `RpcGuidanceAgent`, `NigerianLegalJurisdictionAgent`, `ProceduralComplianceReport` | Shipped (coverage verified: FCT + 36 states present in config) |
| 05 | *Billing on the Scale — fee notes computed under the Scale of Charges (Remuneration Order 2023), with naira-first bank transfer flows.* | `ScaleOfChargesAgent`, finance services, invoice generation | Shipped |
| 06 | *Client Portal — clients track milestones, upload documents and submit KYC at any hour.* | Client portal (`/portal/client/*`), `ClientDashboard`, KYC intake | Shipped |

### Notes on "how well" (the owner's actual question)

- **02 DraftPro** was the weakest link: long-form legal drafting ran on the
  *flash* tier first with a chat-grade temperature (0.7), while the code
  already acknowledged pro-class models are the long-document tier (32k
  output budget vs 8k). **Fixed this round** — see §4.
- **03 ALOA** and **04 Court Rules** share the same jurisdiction brain, so
  their accuracy rises and falls together; the pro-first drafting change
  (§4) also improves every ALOA product that routes through `streamDraft`.
- **05 Billing**: the Scale data is real, but the *narrative* around fees
  (why a fee note came to that figure) is thin — see §5, item V-3.

## 2. Vega — ALOA band claims (`VegaAIDrafting`)

| Claim | Backing | Verdict |
|---|---|---|
| *Draft writs, affidavits, and motions with Nigerian court-specific formatting.* | ALOA precision protocol (`aloaPrompts.ts`) + `streamDraft`; document-type honesty rule (court captions only on court processes) | Shipped — strengthened (§4) |
| *Analyze opposing counsel's arguments, identify weaknesses, research locus classicus.* | `ResearchAgent`, research notebooks + citation extraction | Shipped |
| *PII Shield — NIN, BVN, bank accounts stripped before AI processing; NDPA 2023 compliant.* | PII redaction in `aiUtils`/`geminiService` pre-flight | Shipped |
| *Firm-grade security — data isolated between organizations; matter-level access control; audit trail on AI activity.* | Convex auth retrofit (rounds 7-8), firm-scoped reads, AI audit log | Shipped |

## 3. Atrium claims (AtriumFeatures / AtriumAI)

| Claim | Backing | Verdict |
|---|---|---|
| Property portfolio + occupancy, photos, tenancy links | `PropertyManagerView`, property detail views | Shipped |
| Resident management + KYC + lifecycle | resident profiles, KYC intake in portal | Shipped |
| Residents' portal (SC/MV status, receipts, tickets) | `/portal/tenant/*`, `MessagesTab`, maintenance tickets | Shipped |
| Revenue Monitor (defaulter dashboard, analytics) | Revenue monitor + lease bridge for service charges (round 5) | Shipped |
| Rent collection in naira + receipts + tracking | `CollectRentModal`, payments, receipts | Shipped |
| SC/MV itemized tracking per unit + compliance reports | `unitLookup`, service charge flows | Shipped |
| WhatsApp share (pre-written to the right number, review-and-send) | `ComposeModal` + `sendWhatsAppWithTemplateFallback` (locale retry chain) | Shipped — the template name/language retry was the round-16 fix |
| Lease expiry alerts + calendar | lease management + alerts | Shipped |
| Sentry Pass visitor codes + offline fallback | Sentry Pass module (site + app) | Shipped |
| Amenity booking w/ conflict detection | Amenity booking module | Shipped |
| Estate Bulletin; Service Provider Directory | bulletin + directory modules | Shipped |
| ARIA copilot — 36 state property/tenancy laws + FCT, applies the state where the property is located | same jurisdiction brain as Vega (property mode) | Shipped |
| Estate administration documents | ARIA drafting (property protocol) | Shipped — strengthened (§4 applies to ARIA drafts too) |

**Known claim-accuracy fixes already shipped earlier (context):** the
existing-resident rent reminder no longer includes move-in fees (round-16
financial scoping), and WhatsApp template sends retry across
en/en_US/en_GB locales.

## 4. Improvements made THIS round (2026-10-16)

1. **DraftPro drafting now runs pro-first** (`AI_CONFIG.gemini.draftingPlan`
   in `aiUtils.ts` + `streamDraft` in `geminiService.ts`): long-form legal
   and property documents are generated on `gemini-2.5-pro` first — deeper
   reasoning, 32k output budget — with the flash chain kept as graceful
   fallback. Affects every ALOA/ARIA draft, not just DraftPro's editor tab.
2. **Drafting temperature 0.7 → 0.45**: 0.7 was inherited from chat. Drafting
   is precision work — the ALOA protocol demands real citations only and no
   invented structure; the lower temperature directly suppresses the
   hallucination class the owner is worried about.
3. **Signup product identity bug** (`Signup.tsx`): the mount effect's
   dependency array read `odalContext` (an unbound identifier — a
   long-standing typo that made the effect's behavior undefined). Now
   `[modalContext]` as intended.
4. **Signup product accents re-registered**: Vega's chip/chooser accent was
   amber (#D97706) and Atrium's was *blue* (#2563EB) — both mis-registered
   vs the live product identities. Now Vega = burnt orange #E07A3F, Atrium =
   emerald #059669.
5. **Messages read model** (owner report: badges vanished on page open):
   opening the Messages page no longer marks everything read. Per-section
   counts, per-row bold/badges and the sidebar badge now persist until each
   thread is actually opened; the badge counts live per-thread state
   (`unreadByAdmin`) instead of legacy flat rows nothing could ever clear.

## 4b. Improvements made R28 (2026-10-17 — the backlog round)

Owner direction: *"You mentioned worth a look next; do the claims-audit
backlog as well please."* Six of the seven backlog items shipped:

1. **V-1 Drafting citations pass — SHIPPED (as the ALOA self-review).**
   `reviewDraft()` in `geminiService.ts` runs after every draft: a
   deterministic layer cross-checks every citation-shaped string in the
   draft against the researched source set (fabricated citations are
   flagged as errors before the user files), plus spacing/date/placeholder
   hygiene; a best-effort model layer re-reads the draft against the
   quality bar. DraftPro surfaces the verdict in a Self-Review card
   ("passed" / "N issues" with an itemized list).
2. **V-2 Court Rules surfacing — SHIPPED.** `CourtRuleBasis` on the
   matter's statutory timeline: the governing rule stack for the matter's
   originating process + court (from `PROCEDURAL_RULES`), the registry's
   deadline entries, and the day-counting basis (business days under 6;
   Interpretation Act shift) — inline, not buried in the compliance report.
3. **V-3 Scale of Charges narrative — SHIPPED.** Percentage-billed matters
   now generate a Scale fee line item whose description carries the full
   derivation ("{p}% of {base} assessed at value") — it rides the line
   item onto the invoice detail, the fee-note PDF and the client portal
   unchanged. Never offered without an assessed value on the matter.
4. **A-1 WhatsApp template health — SHIPPED.** A Template Health summary
   on Integration Settings: N/M automation types send-ready at a glance,
   with itemized issues — unmapped types, mappings whose name+language
   pair no longer resolves in the synced registry, and templates not
   APPROVED in Meta. The "approved but failed" class is now visible
   before sends.
5. **A-2 Revenue Monitor projections — SHIPPED.** The Service Charge
   Monitor header now projects 30/60/90-day billings (each charge billed
   forward from its next due date at its cycle) alongside current
   outstanding — scheduled revenue, explicitly labelled as not a
   collection promise.
6. **S-1 Per-product app skins — SHIPPED (owner-directed).** The Vega app
   skin (`app-skin-vega`, Warm Chambers burnt-orange accent ramp) — see
   APP_UI_SEPARATION.md Stage 3. Marketing imagery on /vega now comes from
   the real app.
7. **A-3 Amenity booking calendar view — DEFERRED.** The month-grid admin
   view needs role-aware booking queries plumbed into the Estate tab
   (`getBookingsForFirm` is admin-authenticated; the shared Estate view
   has no role context today). Next round.

Also this round (owner round 2026-10-17, beyond the backlog): the Atrium
mark v3 (the Coin of the House — Monopoly-style house void, two VLM design
rounds), the Komplete Twin Coins mark + per-product favicon/title inside
the app, the tenancy-expiry banner rebuild (tenant + unit + building named
in the message; reason-aware deep link that opens the EXPIRED unit, never
an unrelated one; embedded units now scanned by the cron), the distinct
striped EXPIRED treatment on unit cards and the sidebar, ALOA's
institutional roll call (per-matter filings, deadlines, assignments in
every legal chat prompt), the flat-message modern chat register with
Regenerate, and the hub hero copy ("We build software and custom systems
for businesses like yours").

## 5. Further development — prioritized backlog

**Vega (V):**
- **V-1 — Drafting citations pass**: a post-draft verification step that
  parses citations out of the finished draft and flags any that don't match
  the researched set (defense against fabricated citations surviving the
  lower temperature). Medium effort, high trust value.
- **V-2 — Court Rules surfacing**: the deadline engine computes correctly
  but its *reasoning* ("two clear days per Order 23 r.5 of the Ikeja
  Division rules") is only visible in the compliance report. Surface the
  rule citation inline on the matter + calendar entries.
- **V-3 — Scale of Charges narrative**: fee notes show figures; add the
  derivation note ("₦X = 5% of value assessed at ₦Y under the 2023 Order")
  to the fee note PDF and the client portal.

**Atrium (A):**
- **A-1 — WhatsApp template health dashboard**: a small panel in settings
  showing each registered template's name/language/status against what the
  app sends — the "approved but failed" class becomes visible before sends.
- **A-2 — Revenue Monitor projections**: the defaulter dashboard is
  present-tense; add 30/60/90-day projections (data already in payments).
- **A-3 — Amenity booking calendar view**: booking exists with conflict
  detection; a month-grid view for admins would complete it.

**Shared (S):**
- **S-1 — Per-product app skins**: the two-distinct-apps UI strategy
  (APP_UI_SEPARATION.md) — auth surfaces done this round; app shell next,
  behind a flag, zero visual change until the owner signs off a prototype.

## 6. Standing owner actions (unchanged)

- Rotate `CLOUDFLARE_API_TOKEN` (mirror stuck at `04d798b3`).
- Renew `practicepro.ng` (NXDOMAIN — app reachable only at
  practice-pro-vega.vercel.app).
- Rotate the GitHub PAT when deployment sessions end (shared in chat again).
