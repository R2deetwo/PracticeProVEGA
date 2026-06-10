
---
Task ID: 1
Agent: Main
Task: Implement unauthenticated Contact Sales drawer — decouple from auth modal

Work Log:
- Explored codebase to identify all "Contact Sales" touchpoints: Enterprise pricing CTA, Komplete callout button, Footer Contact link
- Found that all CTAs currently route to `openModal('signup')` — classic conversion killer
- Created `/home/z/my-project/src/components/marketing/ContactSalesDrawer.tsx` — right-side slide-out drawer with form (email, name, company, message), inline validation, success state
- Created `/home/z/my-project/convex/salesInquiries.ts` — unauthenticated Convex mutations for lead capture (no auth token required)
- Added `sales_inquiries` table to Convex schema with status pipeline (new → contacted → qualified → closed → spam)
- Updated `LandingPage.tsx`:
  - Added `isContactDrawerOpen` + `contactDrawerSource` state (separate from auth modal)
  - Enterprise pricing CTA now calls `onContactSales('Enterprise Pricing CTA')` instead of `onSignup`
  - Komplete callout "Contact Sales" calls `onContactSales('Komplete Callout')` instead of `onSignup`
  - Footer gets new "Contact Sales" link that opens drawer
  - Footer's old "Contact" mailto link renamed to "Email Us" for clarity
- Verified clean Vite build (0 errors)
- Committed and pushed to GitHub (c092266)

Stage Summary:
- Contact Sales now fully decoupled from auth — zero-friction lead capture
- Source tracking implemented for all 3 entry points
- Backend operates independently of user authentication
- Build passes clean
