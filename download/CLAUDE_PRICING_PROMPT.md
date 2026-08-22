# Claude Prompt — PracticePro Product Tier & Pricing Redefinition

## Context to Share with Claude

Copy everything below this line into your conversation with Claude.

---

## What PracticePro Is

PracticePro builds dedicated operating systems for the organizations that run modern Africa. We have two specialized products on one platform:

1. **Vega** — Legal practice management for Nigerian law firms. Case management, AI-assisted drafting, court date reminders, automated billing, client portal.
2. **Atrium** — Property management for Nigerian property managers and real estate firms. Revenue monitoring, rent collection, service charge tracking, tenant portal, WhatsApp reminders.
3. **Komplete** — Unified platform combining both Vega + Atrium in one workspace. Single tier, all features, unlimited seats.

## Current Tier Structure

### VEGA (Legal) — 4 Tiers

| Tier | Label | Monthly | Annual | Users | Active Matters | Storage | Key Features |
|------|-------|---------|--------|-------|---------------|---------|-------------|
| Core | Free | ₦0 | ₦0 | 1 | 10 | 1 GB | Legal billing & ledger |
| Growth | Growth | ₦45,000 | ₦432,000 | 5 | Unlimited | 20 GB | Court rules, Client Portal (20 clients), ALOA™ AI (Standard), Retainer billing |
| Pro | Pro | ₦80,000 | ₦768,000 | Unlimited | Unlimited | 100 GB | Advanced billing & analytics, Uncapped Client Portal, ALOA™ AI (Priority), Court Date Reminders (WhatsApp) |
| Enterprise | Enterprise | Custom | Custom | Unlimited | Unlimited | Custom | All features + dedicated onboarding |

### ATRIUM (Property) — 4 Tiers

| Tier | Label | Monthly | Annual | Users | Units | Tenants | WhatsApp | Key Features |
|------|-------|---------|--------|-------|-------|---------|----------|-------------|
| Core | Starter | ₦49,000 | ₦490,000 | 1 | 10 | 15 | 250/mo | Lease tracking, maintenance log. Overage: ₦2,700/unit/mo (units 11-25, forced upgrade at 25) |
| Growth | Growth | ₦96,500 | ₦965,000 | 5 | 25 | 40 | 500/mo | Service charge tracking, rent demand notices, Residents' Portal. Overage: ₦2,100/unit/mo (units 26-100, forced upgrade at 100) |
| Pro | Pro | ₦200,000 | ₦2,100,000 | Unlimited | 100 | Unlimited | Unlimited | Estate document generation, live defaulter dashboard, uncapped Residents' Portal. Overage: ₦1,600/unit/mo (units 101-400, forced upgrade at 400). SCE shows "Scale-based" |
| Enterprise | Enterprise | Custom | Custom | Unlimited | Unlimited | Unlimited | Unlimited | 400+ units, custom scaling, dedicated support |

### KOMPLETE (Unified) — 1 Tier

| Tier | Label | Monthly | Annual | Users | Key Features |
|------|-------|---------|--------|-------|-------------|
| Core | Komplete | N/A (annual only) | ₦2,200,000 | Unlimited | Everything from Vega Pro + Atrium Pro + Sentry Pass (VMS) included + 500 GB storage + dedicated account manager |

## SCE (Service Charge Equivalent) — Atrium Only

SCE is a framing device for Atrium pricing. It represents the cost per tenant unit per month, calculated as:
```
SCE = Annual Price ÷ 12 months ÷ Included Units
```

Current SCE values:
- Starter: ₦490,000 ÷ 12 ÷ 10 = **₦4,083/unit/month**
- Growth: ₦965,000 ÷ 12 ÷ 25 = **₦3,217/unit/month**
- Pro: Shows **"Scale-based"** — this is where we need help. Pro includes 100 units, then ₦1,600/unit/month overage for units 101-400. The "scale-based" label means the effective SCE decreases as the portfolio grows:
  - At 100 units: ₦2,100,000 ÷ 12 ÷ 100 = ₦1,750/unit/month
  - At 200 units: (₦2,100,000 + 100 × ₦1,600 × 12) ÷ 12 ÷ 200 = ₦2,500/unit/month (overage kicks in)
  - At 400 units: (₦2,100,000 + 300 × ₦1,600 × 12) ÷ 12 ÷ 400 = ₦2,425/unit/month
- Enterprise: Shows **"Scale-based"** — 400+ units, custom pricing

## Feature Gates (What Each Plan Unlocks)

### All Products
| Feature | Core/Free | Growth | Pro | Enterprise | Komplete |
|---------|-----------|--------|-----|------------|----------|
| AI Copilot (ALOA™/ARIA™) | ❌ | ✅ Standard | ✅ Priority | ✅ Priority | ✅ Priority |
| Team Members | 1 | 5 | Unlimited | Unlimited | Unlimited |
| Advanced Reporting | ❌ | ❌ | ✅ | ✅ | ✅ |
| Audit Logs | ❌ | ❌ | ❌ | ✅ | ✅ |
| External Counsel | ❌ | ❌ | ❌ | ✅ | ✅ |
| Advanced Security | ❌ | ❌ | ❌ | ✅ | ✅ |

### Vega-Specific
| Feature | Free | Growth | Pro | Enterprise |
|---------|------|--------|-----|------------|
| Active Matters | 10 | Unlimited | Unlimited | Unlimited |
| Case File Storage | 1 GB | 20 GB | 100 GB | Custom |
| Client Portal | ❌ | ✅ (20 clients) | ✅ (Unlimited) | ✅ (Unlimited) |
| Court Rules & Procedural Intelligence | ❌ | ✅ | ✅ | ✅ |
| Retainer Auto-Billing | ❌ | ✅ | ✅ | ✅ |
| Billing Monitor | ❌ | ❌ | ✅ | ✅ |
| Court Date Reminders (WhatsApp) | ❌ | ❌ | ✅ | ✅ |
| Research Studio | ❌ | ✅ | ✅ | ✅ |

### Atrium-Specific
| Feature | Starter | Growth | Pro | Enterprise |
|---------|---------|--------|-----|------------|
| Managed Units | 10 | 25 | 100 | Unlimited |
| WhatsApp Notices | 250/mo | 500/mo | Unlimited | Custom |
| Residents' Portal | ❌ | ✅ | ✅ (Uncapped) | ✅ (Uncapped) |
| Service Charge Tracking | ❌ | ✅ | ✅ | ✅ |
| Rent Demand Notices | ❌ | ✅ | ✅ | ✅ |
| Estate Document Generation | ❌ | ❌ | ✅ | ✅ |
| Live Defaulter Dashboard | ❌ | ❌ | ✅ | ✅ |
| Overage Rate | ₦2,700/unit/mo | ₦2,100/unit/mo | ₦1,600/unit/mo | Custom |
| Forced Upgrade Cap | 25 units | 100 units | 400 units | N/A |

## Overage Pricing Model (Atrium Only)

Atrium uses a **tiered overage model** — when a firm exceeds their included units, they pay per additional unit per month until they hit the forced upgrade cap:

| Tier | Included Units | Overage Rate | Forced Upgrade At |
|------|----------------|-------------|-------------------|
| Starter | 10 | ₦2,700/unit/mo | 25 units |
| Growth | 25 | ₦2,100/unit/mo | 100 units |
| Pro | 100 | ₦1,600/unit/mo | 400 units |
| Enterprise | Unlimited | N/A | N/A |

## What We Need Help With

1. **Pro tier "Scale-based" SCE** — We currently show "Scale-based" for the Pro tier's SCE because the effective cost per unit changes as the portfolio grows (base price covers 100 units, then overage kicks in). We're not sure if this is the right approach or if there's a cleaner way to communicate the value.

2. **Pricing strategy validation** — Are our prices competitive for the Nigerian market? Are the tier boundaries (unit caps, feature gates) in the right places? Should we adjust any prices or limits?

3. **Feature gate optimization** — Are there features that should be gated differently? For example, should Court Date Reminders be available on Growth instead of Pro-only? Should the Residents' Portal be available on Starter?

4. **Overage model** — Is the tiered overage model (included units → per-unit overage → forced upgrade) the right approach? Or should we consider a simpler model (e.g., flat per-unit pricing with no tiers)?

5. **Komplete positioning** — At ₦2.2M/year, Komplete is positioned just above Atrium Pro (₦2.1M/year). Is this the right price point? Should it be higher to reflect the value of getting both products?

6. **Trial system** — We offer a 30-day free trial of any paid tier. The firm is created at Core billing but granted the trial plan's entitlements. After 30 days, it reverts to Core. Is this the right trial duration and mechanism?

## Technical Context

- **Backend:** Convex (serverless functions, real-time subscriptions)
- **Frontend:** React + Vite + TailwindCSS
- **Mobile:** Capacitor (APK wrapper around the web app)
- **Auth:** Custom email/password with PBKDF2 hashing
- **Payments:** Paystack (card) + manual bank transfer (founder verifies)
- **AI:** Google Gemini API (ALOA™ for legal, ARIA™ for property)
- **WhatsApp:** ChakraHQ integration (or direct WhatsApp Business API)
- **Email:** Brevo (Sendinblue)

## Files to Reference

If Claude needs to see the actual implementation:
- `src/constants/tiers.ts` — Complete tier definitions, pricing, limits, features
- `src/hooks/useFeatures.ts` — Feature gate logic (what each plan unlocks)
- `convex/tierLimits.ts` — Backend enforcement of tier limits
- `src/components/modals/OnboardingWizard.tsx` — Plan selection UI
- `src/components/modals/PaymentGatewayModal.tsx` — Payment flow UI

## What We Want from Claude

Help us:
1. Validate or redefine the pricing strategy
2. Clarify the "Scale-based" SCE communication for Pro tier
3. Optimize feature gates for conversion
4. Evaluate the overage model
5. Position Komplete correctly
6. Produce a revised tier matrix (if changes are recommended) that we can implement
