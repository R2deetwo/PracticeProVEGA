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

---
Task ID: 2
Agent: Main Agent
Task: Fix footer Company column orphan positioning + Fix portal invite system (spinning button, no actual delivery)

Work Log:
- Fixed footer: Company column now uses md:col-start-4 so it stays on far right even when Product/Portals columns are not rendered
- Changed footer grid to always be 4-column with conditional rendering for Product/Portals
- Diagnosed root cause of spinning invite button: createPortalInvite was a mutation (cannot call actions like sendEmail/sendWhatsApp)
- Converted createPortalInvite from mutation to action — now generates crypto-random token, writes DB record, then calls sendEmail/sendWhatsApp
- Added token field to portal_invites schema + by_token index
- Added channel field to portal_invites schema ("email" | "whatsapp" | "both")
- Created professional HTML email template with branded PracticePro styling
- Created WhatsApp message template with invite link + token
- Added channel picker (Email / WhatsApp / Both) to invite form
- Auto-populate name/phone/email from linked matter (Vega) or property (Atrium) tenant data
- Converted resendPortalInvite to action — refreshes token on SAME record (no duplicates), re-sends via stored channel
- Portal login pages now read ?token= from URL, look up invite via getInviteByToken, auto-fill email, show invite banner, and call acceptPortalInviteByToken on successful login
- Copy invite link now includes token for magic-link sharing
- Added ChannelBadge to invitation list showing delivery method
- Added getInviteByToken query, acceptPortalInviteByToken mutation, _insertInviteRecord mutation, _updateInviteRecord mutation, getPortalInviteById query
- Removed Portal URL section from settings (replaced by per-invite magic links)
- Build passes, pushed to Git

Stage Summary:
- Footer Company column no longer orphaned — stays on far right always
- Portal invites NOW ACTUALLY SEND via Brevo email and/or Chakra WhatsApp
- Magic-link tokens auto-fill email on portal login pages
- Channel picker lets users choose Email, WhatsApp, or Both
- Auto-populate from linked records reduces form filling
- Resend works properly — no more duplicates, refreshes existing record
- All changes pushed to origin/main
