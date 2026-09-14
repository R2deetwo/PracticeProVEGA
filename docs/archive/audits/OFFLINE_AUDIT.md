# Offline Resilience Audit

Total `useMutation(api.*)` call sites: **198** across 75 files.

## Coverage Summary

- **QUEUED**: 12 sites
- **PARTIAL**: 11 sites
- **NON_QUEUEABLE**: 17 sites
- **DIRECT**: 158 sites

## Mutation Names NOT Yet in the Queue Registry

- `analytics.trackEvent`
- `broadcasts.archiveBroadcast`
- `broadcasts.bulkArchiveBroadcasts`
- `broadcasts.cleanupDuplicateBroadcasts`
- `broadcasts.purgeAllBroadcasts`
- `feedback.adminReplyToFeedback`
- `feedback.deleteFeedbackThread`
- `feedback.purgeLeakedAloaEchoes`
- `feedback.submitDataRestoreRequest`
- `feedback.submitFeedback`
- `feedback.updateFeedbackStatus`
- `feedback.userReplyToFeedback`
- `founderMetrics.approveSubscriptionRequestAsFounder`
- `founderMetrics.logAdminAction`
- `founderMetrics.rejectSubscriptionRequestAsFounder`
- `founderMetrics.updateFirmAdminSettings`
- `indexer.saveAloaDocument`
- `legalRepo.grantLicense`
- `legalRepo.revokeLicense`
- `myFunctions.addUnitToProperty`
- `myFunctions.adminDeleteUser`
- `myFunctions.adminForceVerify`
- `myFunctions.cancelVmsAddon`
- `myFunctions.clearAllNotifications`
- `myFunctions.createAloaConversation`
- `myFunctions.createFirm`
- `myFunctions.createSubscriptionRequest`
- `myFunctions.deactivateTeamMember`
- `myFunctions.deleteAccount`
- `myFunctions.deleteAloaConversation`
- `myFunctions.deleteFirm`
- `myFunctions.deleteMatterCascade`
- `myFunctions.deletePropertyCascade`
- `myFunctions.diagnoseConnectivity`
- `myFunctions.fixProductMode`
- `myFunctions.forceDeleteItem`
- `myFunctions.joinFirm`
- `myFunctions.leaveFirm`
- `myFunctions.markNotificationsAsRead`
- `myFunctions.purgeFirmData`
- ... and 66 more

## DIRECT (highest priority for future wiring)

### `sentry.logAutomation` (9 sites)
  - `src/components/MessagesView.tsx:699`
  - `src/components/atrium/AutomationCenter.tsx:67`
  - `src/components/atrium/AtriumInbox.tsx:72`
  - ... and 6 more

### `myFunctions.repairAccountConnection` (5 sites)
  - `src/components/Sidebar.tsx:181`
  - `src/contexts/AuthContext.tsx:252`
  - `src/contexts/AuthContext.tsx:257`
  - ... and 2 more

### `founderMetrics.logAdminAction` (4 sites)
  - `src/admin/views/FeedbackInbox.tsx:101`
  - `src/admin/views/BroadcastConsole.tsx:75`
  - `src/admin/views/FirmManagement.tsx:23`
  - ... and 1 more

### `myFunctions.diagnoseConnectivity` (3 sites)
  - `src/components/Sidebar.tsx:180`
  - `src/components/auth/Login.tsx:88`
  - `src/components/auth/ConnectionStatus.tsx:17`

### `myFunctions.updateFirmSettings` (3 sites)
  - `src/components/LocalDocumentManager.tsx:54`
  - `src/components/atrium/AutomationCenter.tsx:77`
  - `src/components/settings/IntegrationSettings.tsx:27`

### `myFunctions.markNotificationsAsRead` (2 sites)
  - `src/components/BroadcastBanner.tsx:253`
  - `src/contexts/DataProvider.tsx:288`

### `sentry.markMessageAsRead` (2 sites)
  - `src/components/MessagesView.tsx:700`
  - `src/components/atrium/AtriumInbox.tsx:71`

### `sentry.deleteInboundMessage` (2 sites)
  - `src/components/MessagesView.tsx:701`
  - `src/components/atrium/AtriumInbox.tsx:70`

### `pushNotifications.markNotificationRead` (2 sites)
  - `src/components/NotificationCenter.tsx:30`
  - `src/components/Header.tsx:58`

### `pushNotifications.markAllNotificationsRead` (2 sites)
  - `src/components/NotificationCenter.tsx:31`
  - `src/components/Header.tsx:59`

### `myFunctions.deleteFirm` (2 sites)
  - `src/contexts/AuthContext.tsx:256`
  - `src/components/auth/ConnectionStatus.tsx:19`

### `myFunctions.updateItem` (2 sites)
  - `src/contexts/DataProvider.tsx:39`
  - `src/hooks/useFirm.ts:20`

### `myFunctions.deleteMatterCascade` (2 sites)
  - `src/contexts/MatterContext.tsx:32`
  - `src/hooks/useMatters.ts:18`

### `portals.repairPortalUserFirmId` (2 sites)
  - `src/components/tenant/TenantPortal.tsx:148`
  - `src/components/client/ClientDashboard.tsx:180`

### `portals.markConversationReadByParticipant` (2 sites)
  - `src/components/tenant/TenantPortal.tsx:1869`
  - `src/components/client/ClientDashboard.tsx:321`

### `feedback.submitDataRestoreRequest` (2 sites)
  - `src/components/auth/Signup.tsx:43`
  - `src/components/forms/FeedbackForm.tsx:24`

### `sentry.addLeadToPipeline` (2 sites)
  - `src/components/atrium/VacancyPipeline.tsx:76`
  - `src/components/atrium/AtriumPublicApplicationForm.tsx:24`

### `myFunctions.updateUserSecurity` (2 sites)
  - `src/components/settings/SecuritySettings.tsx:202`
  - `src/components/settings/AccountRecoverySettings.tsx:21`

### `portals.createNotice` (2 sites)
  - `src/components/messaging/NoticeBoardTab.tsx:37`
  - `src/components/details/PropertyDetailView.tsx:2559`

### `portals.archiveNotice` (2 sites)
  - `src/components/messaging/NoticeBoardTab.tsx:38`
  - `src/components/details/PropertyDetailView.tsx:2560`

## NON_QUEUEABLE — Sites Needing Offline Guards

### `myFunctions.generateUploadUrl` (7 sites)
  - `src/components/MessagesView.tsx:873`
  - `src/components/tenant/TenantPortal.tsx:1379`
  - `src/components/tenant/TenantPortal.tsx:1876`
  - `src/components/tenant/TenantPortal.tsx:2474`
  - `src/components/aloa/AloaChat.tsx:126`
  - `src/components/client/ClientDashboard.tsx:322`
  - `src/components/documents/tiptap/DraftProEditor.tsx:452`

### `portals.replyToPortalMessage` (1 sites)
  - `src/components/MessagesView.tsx:937`

### `portals.sendAdminReply` (1 sites)
  - `src/components/MessagesView.tsx:938`

### `myFunctions.sendChatMessage` (3 sites)
  - `src/components/MessagesView.tsx:949`
  - `src/components/modals/TeamMessageModal.tsx:32`
  - `src/hooks/useMessaging.ts:26`

### `portals.sendPortalMessage` (5 sites)
  - `src/components/tenant/TenantPortal.tsx:150`
  - `src/components/tenant/TenantPortal.tsx:1868`
  - `src/components/details/ServiceChargeBars.tsx:704`
  - `src/components/modals/ReceiptModal.tsx:50`
  - `src/components/client/ClientDashboard.tsx:181`

