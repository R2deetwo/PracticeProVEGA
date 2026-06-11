# Client Portal Dashboard Build-out

## Task
Rewrite `/home/z/my-project/src/components/client/ClientDashboard.tsx` as a full client-facing portal experience with real Convex data connections.

## Summary of Changes

### 1. Updated Convex Generated API Types (`convex/_generated/api.d.ts`)
- Added `portals` module import and type mapping to the generated API types so TypeScript recognizes `api.portals.*`

### 2. Added New Convex Portal Queries (`convex/portals.ts`)
- **`getClientDocuments`** (enhanced existing) — Now returns enriched document data with `matterTitle` for display
- **`getClientMessages`** (new) — Fetches client messages for all of a client's matters, sorted by timestamp, limited to 50, includes `matterTitle`
- **`getClientActivity`** (new) — Fetches recent firm activity for a client's matters, sorted by timestamp, limited to 10 entries
- **`getClientInvoices`** (new) — Fetches invoices linked to a client's matters for outstanding invoice counting

### 3. Rewrote ClientDashboard Component (`src/components/client/ClientDashboard.tsx`)

**Architecture:**
- All React hooks called before conditional returns (Rules of Hooks compliance)
- Uses `useQuery(api.portals.*)` for real-time Convex data
- Uses `useDataActions()` for `handleSendClientMessage`
- Preserves existing `canUseClientPortal` feature gate and "Portal Unavailable" message

**Dashboard Overview (top section):**
- Welcome message with client first name
- 3 summary cards: Active Matters, Pending Documents, Outstanding Invoices
- Recent Activity feed from `api.portals.getClientActivity` (last 5 items)
- Quick-link cards to Matters, Documents, and Messages tabs

**Tab-based layout (Overview, Matters, Documents, Messages):**
- Each tab has badge count
- Responsive tab navigation

**Matters Section:**
- List of client matters with: title, suit number, reference number
- Stage badges with colour-coded styling (amber=filing, sky=discovery, violet=trial, emerald=judgment, etc.)
- Assigned lawyer names
- Upcoming deadlines (next adjourned date)
- Last updated timestamp via `timeAgo()`
- Practice area and status tags
- Click navigates to `ClientMatterDetailView` via `navigateTo('matterDetail', matter.id)`
- "Request Another Service" button preserved with `openModal('newLead', ...)`

**Documents Section:**
- Uses `useQuery(api.portals.getClientDocuments, ...)` for real-time document data
- Document list with: title, matter name, date filed, status badges
- File type icons based on source/title
- Status badges: "Signature Requested", "Review Requested", "Shared"
- Filter by matter dropdown
- Upload button (shows toast "Upload coming soon")
- Loading skeletons while data loads
- Empty state: "No Documents Shared With You Yet"

**Messages Section:**
- Uses `useQuery(api.portals.getClientMessages, ...)` for real-time message data
- Thread-style list with: author avatar/initials, name, matter tag, content, timestamp
- Unread indicator (green dot + left border highlight)
- "Send Message" compose form:
  - Matter selector dropdown
  - Text area for message
  - Send/Cancel buttons
  - Uses `handleSendClientMessage` from DataContext
- Empty state: "No Messages Yet"

**Style:**
- Professional legal aesthetic — clean white cards, subtle borders, formal typography
- Emerald/green primary colour scheme throughout
- Mobile-responsive design
- Loading skeleton states
- Friendly empty states

## Build Verification
- `npx vite build` completes successfully with no errors
