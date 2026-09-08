# Messaging Unification — Path B (Presentation-Layer)

Status: **Shipped (staff app)** · Full backend consolidation (**Path A**) intentionally NOT started — requires explicit owner sign-off.

## The diagnosis (confirmed 2026-09-08)

Eight backend tables store what users experience as "messaging", plus a ninth conversation container the original audit missed (`portal_conversations`). They disagree on the three fundamentals:

| Table | Timestamp | Sender identity | Read status | Threading |
|---|---|---|---|---|
| `chatMessages` | `timestamp` **string** | `authorId` | none (delivery `status` only) | `conversationId` → `chatConversations` |
| `clientMessages` | `timestamp` **string** | `authorId` | `isRead` **boolean** | **none** — tied to `matterId` (one stream per matter, forever) |
| `portal_messages` | `createdAt` **number** | `senderId` + `senderName` + `senderEmail` + `senderRole` | `status` **string enum** AND `isRead` **boolean** (both!) | `conversationId` → `portal_conversations`, `threadTicketId` sub-threads |
| `aloaMessages` | `createdAt` **number** | `role` (user/model/tool) | none (`isError`) | AI conversation id |
| `researchMessages` | `timestamp` **string** | `role` | none | `notebookId` |
| `atrium_inbound_messages` | `receivedAt` **number** | `senderName` + `senderContact` (**no id**) | `isRead` **boolean** | none — flat inbound log |
| `scheduled_messages` | `scheduledFor` **number** | recipient phone/email/name | n/a (status enum) | none — outbound queue |
| `chatConversations` / `portal_conversations` | string vs number `createdAt` | members vs participant | `hiddenForUserIds` vs unread counters | two containers that never reference each other |

Consequences that were live in the UI: string/number timestamps mixed in one sort (`new Date(...)` conversions sprinkled per view), four sender-resolution code paths, and `MessagesView.tsx` carrying **two overlapping type unions** — `ConversationType` (5 values, derived by sniffing `T:`/`R:`/`A:`/`🚫` prefixes out of `lastMessagePreview`) and `selectedInboxType` (6 values) — that don't map cleanly onto each other. One concrete bug found during the fix: clicking a WhatsApp & Email inbox row set the row id but never the inbox *type*, so the detail pane spun on "Loading conversation…" forever.

## The decision: (a) vs (b)

- **(a) Full backend migration** — normalize into fewer tables, migrate production data. ~99 distinct messaging-related API functions are called from the frontend across these families; every conversation a customer ever had sits in these tables. Highest blast radius, needs downtime or dual-write, and irreversibly touches production data.
- **(b) Presentation-layer unification** — keep the 8 tables, introduce ONE canonical model + adapters and ONE shared thread renderer. Reversible, zero data risk, delivers most of the user-facing consistency immediately.

**Chosen: (b).** Path (a) remains the recommended *eventual* end-state (fewer tables, one shape) and should be scheduled as its own project with backups + dual-write + explicit owner approval. It is explicitly blocked pending that sign-off.

## What shipped (Path B)

1. **`src/messaging/model.ts`** — the canonical `UnifiedMessage` (epoch-ms `sentAt` always a number; `UnifiedSender`; `ReadState` union; attachments; ticket/request wiring; `raw` escape hatch). One adapter per table. `deriveClientThreadTag()` replaces preview-prefix sniffing with STORED-FIELD derivation (`linkedTicketId`/`linkedRequestId`/`lastMessageBy`). `InboxSection` collapses the two old unions; `mapLegacyInboxType()` keeps old deep-links working. `normalizePortalMessage` supports `perspective: 'participant'` for portal-side rendering (identity inverts — the portal user is "me").
2. **`src/components/messaging/MessageThread.tsx`** — the ONE thread renderer: scroll + auto-scroll + jump-to-latest, day dividers, sender grouping, bubble frames (team / client_tenant / ai variants), shared attachment grid, deleted placeholders, failed/retry. Slots: `renderBubble` (full replacement — team's interactive ChatMessageBubble), `renderBubbleContent`, `renderAboveBubble`, `renderBelowBubble`, `renderAvatar`, `bubbleClassName`. `embedded` mode lets a parent keep its own scroll architecture.
3. **Consumers now rendering through it**:
   - Team thread (MessagesView inbox) — `variant="team"` + `renderBubble` (ChatMessageBubble keeps its edit/delete menu).
   - Client & Tenant conversations (MessagesView portal thread) — `variant="client_tenant"`; ticket badges/controls, sub-thread replies and the inline ticket composer ride the slots.
   - ResearchChat (AI Assistant, mode 2) — `variant="ai"`; markdown + citations + copy ride the slots.
   - AloaChat (AI Assistant, mode 1) — `variant="ai"` + `embedded` (keeps its scroll-to-top/jump-to-bottom architecture); markdown, streaming cursors, interactive forms, jurisdiction/action cards, PII shield ride the slots.
4. **MessagesView.tsx cleanup** — dead `ChatWindow` deleted (−219 lines); `ConversationType` + `CONVERSATION_TYPE_STYLES` + `detectConversationType` removed; `selectedInboxType` (6 values) collapsed to `selectedSection: InboxSection` (4 sections: team / client_tenant / flat / system); the eternal-loading bug on inbound row clicks fixed; dead team scroll ref/effect removed.
5. **Portals (TenantPortal, ClientDashboard)** — deliberately NOT rewired yet; reasons documented at both sites: identity perspective inversion (model now supports it, render adoption staged), signed `fileUrls` attachment access vs the shared grid's public storage URLs, and the portals' deliberate design language. ClientDashboard keeps its card-style reading view; TenantPortal keeps its emerald bubble view.
6. **Tests** — `tests/unit/unifiedMessaging.test.ts` (25 cases: timestamp divergence, sender resolution per table, read-state mapping, participant perspective, tag derivation from stored fields, legacy inbox mapping). One real bug caught by the tests: `toEpochMs` misparsed pure-numeric strings via `Date.parse` (now digit-checked first).

## Gates

- `tsc --noEmit`: 128 errors = exact pre-change baseline (0 new)
- `vitest run`: 265/265 (was 240; +25)
- `vite build`: green
- Browser smoke (`scripts/smoke-unified-messaging.mjs`): boots, 0 console/page errors, shared thread code confirmed in the shipped bundle

## Path A (future, blocked on owner sign-off)

When approved: collapse to ~3 tables (`conversations`, `messages`, `automated_message_log`) with the Path-B canonical shape as the schema; dual-write during migration; per-firm verification counts before cutover. Until then, every new messaging surface MUST go through `src/messaging/model.ts` + `MessageThread` — no new bespoke thread renderers.
