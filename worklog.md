---
Task ID: 1
Agent: Main Agent
Task: Portal invite flow, landing page footer fix, text change, responsive optimization

Work Log:
- Fixed landing page footer: when no product selected, only Brand + Company columns show (2-col grid); when product selected, grid expands to 4 columns with Product and Portals columns animating in (opacity + max-h transitions)
- Changed "Building systems for Nigerian Firms" → "Building systems for Nigerian organizations" to avoid confusing non-lawyer users
- Created PortalAccessSettings.tsx component with full invite flow: invite form, invitation list, status badges (pending/accepted/expired/revoked), filter tabs, portal URL copy, revoke access
- Added PortalAccessSettings to SettingsView as "Client Portal" / "Residents' Portal" nav item in the Practice/Workspace Configuration section
- Added Convex backend mutations: revokePortalInvite, resendPortalInvite, getPortalInvitesByEmail
- Updated HelpSettings with comprehensive portal invite flow documentation referencing the new Settings → Portal Access page
- Updated portal URL references from practicepro.ng to practice-pro-vega.vercel.app
- Responsive optimization across 7 files: LandingPage footer, PortalAccessSettings, SettingsView nav, ClientDashboard tabs/cards/docs, TenantPortal header/receipts/tickets, ClientPortalLogin, TenantPortalLogin

Stage Summary:
- Landing page footer now correctly hides Product list when no product selected; animates transitions
- "Nigerian Firms" → "Nigerian organizations" text change applied
- Portal invite flow is fully integrated: Settings → Client Portal / Residents' Portal
- Help section updated with accurate portal management instructions
- Convex backend extended with revoke/resend invite mutations
- All recent changes are responsive across mobile/tablet/desktop
- Build passes successfully
