---
Task ID: portal-access-dual
Agent: Main
Task: Redesign PortalAccessSettings to show dual portal sections for Komplete/Unified users

Work Log:
- Analyzed current PortalAccessSettings: used `isProperty` to show ONLY one portal type, never both
- For Komplete (unified product), `isProperty=true` meant only "Residents' Portal" shown — wrong for lawyer-first users
- Updated SettingsView nav label for unified to 'Portal Access'
- Completely redesigned PortalAccessSettings with dual sections for Komplete/Unified
- Client Portal (violet, primary) + Residents' Portal (sky, secondary)
- Each section has its own invite button, form, and filtered invite list
- Added contextual hints when no matters/properties exist
- Single-product users (Vega/Atrium) keep existing single-section behavior
- Build succeeded, Convex deployed, pushed to GitHub

Stage Summary:
- PortalAccessSettings now properly shows BOTH portal types for Komplete/Unified
- Client Portal is primary (lawyer-first design), Residents' Portal is secondary
- Both sections always visible with contextual hints, no greyed-out states
- Files changed: SettingsView.tsx, PortalAccessSettings.tsx
---
Task ID: 1
Agent: Main Agent
Task: Fix email logo, setup-password CTA, and feedback button issues

Work Log:
- Examined screenshot showing wrong logo in email (logo.png is actually a JPEG, not the real PracticePro logo)
- Removed all <img> logo references from both createPortalInvite and resendPortalInvite email HTML templates in convex/portals.ts
- Emails now show clean text-only branding: "PracticePro" + product badge (VEGA/ATRIUM) — no wrong logo
- Verified Setup Your Password CTA URL already points to /setup-password?token=... (was fixed in prior session)
- Changed FeedbackButton from fixed floating position to inline component
- Restricted FeedbackButton to only show on Settings > My Profile > General sub-tab
- Deployed Convex backend changes successfully
- Verified Vite build succeeds

Stage Summary:
- Email templates: Removed wrong logo images, keeping text-only brand header (clean, consistent)
- Setup Password CTA: Already correct — links to /setup-password?token=...
- Feedback button: No longer fixed/floating, inline only, restricted to My Profile > General tab
- Convex deployed to gregarious-malamute-537
