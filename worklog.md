---
Task ID: 1
Agent: Main Agent
Task: Comprehensive portal bug fixes - creation, deletion, and data loading

Work Log:
- Analyzed full portal codebase: 38+ portal-related files across components, backend, contexts, hooks
- Identified root cause of portal creation failure: `sendWhatsApp` action THROWS when config missing, crashing the entire `createPortalInvite` action even after invite record is already inserted
- Identified deletion failure: no fallback mechanism if `deletePortalInviteAndCleanup` mutation fails
- Identified data loading issues: no auto-repair for missing firmId, only property relink was self-healing

- Fixed `convex/communications.ts`: Changed `sendWhatsApp` to return error instead of throwing when env vars are missing
- Fixed `convex/portals.ts`: Wrapped email and WhatsApp sending in try/catch in both `createPortalInvite` and `resendPortalInvite` actions so they NEVER crash after the invite record is created
- Fixed `convex/portals.ts`: Enhanced `repairPortalUserFirmId` to also restore user role and verification status when repairing a "Pending" user
- Fixed `src/components/settings/PortalAccessSettings.tsx`: Added fallback revoke if full delete cleanup fails, added diagnostic logging, improved error feedback for invite creation
- Fixed `src/components/tenant/TenantPortal.tsx`: Added self-healing #1 - auto-repair missing firmId when both direct firmId and invite resolution fail

Stage Summary:
- Portal invite creation: Now robust - email/WhatsApp failures no longer crash the action; invite record is always preserved
- Portal access deletion: Now has fallback - if full cleanup fails, tries simple revoke; better logging
- Portal data loading: Now has 3-layer self-healing (invite resolution → auto firmId repair → auto property relink)
- `repairPortalUserFirmId` now also restores role from "Pending" back to "Client"/"Tenant"
- All TypeScript and Convex type checks pass; production build succeeds
