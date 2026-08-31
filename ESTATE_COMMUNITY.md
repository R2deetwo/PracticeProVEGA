# Estate Community — Feature Guide (Atrium OS)

**Estate Community** is the community-management layer of Atrium OS. It gives gated estates and managed portfolios three resident-facing services that remove the classic "phone-call bottleneck" from daily estate life:

1. **Amenity Booking** — residents book shared facilities themselves
2. **Estate Bulletin** — admin-posted community announcements
3. **Service Provider Directory** — a curated vendor list residents can contact directly

All three are plan-gated (**Pro**, or the Estate Community add-on). The backend enforces the gate server-side (`requireEstateCommunity` in `convex/estateCommunity.ts`) — clients cannot bypass it.

---

## 1. Amenity Booking

Residents book shared amenities — gym, pool, clubhouse, meeting rooms — directly from their portal.

**Admin side** (`src/components/settings/EstateCommunitySettings.tsx`):
- Define amenities with slot duration, operating hours, and approval rules
- Approve / reject pending bookings (manual approval mode) or let conflicts auto-resolve (auto mode)
- Set `maxConcurrentBookings` where a facility legitimately supports multiple simultaneous users (e.g., two tennis courts)

**Resident side** (`src/components/tenant/EstateCommunityResidentView.tsx`):
- Pick an amenity, date, and time slot; see availability before submitting
- View upcoming and past bookings; cancel their own pending bookings

**Conflict detection (server-side):** on booking creation, `createBooking` in `convex/estateCommunity.ts` checks overlapping bookings in the same window. A proposed slot that would exceed `maxConcurrentBookings` is rejected with an explicit error, so double-booking is impossible even under concurrent taps.

**Cancellations:** `cancelBooking` frees the slot immediately; a resident cancelling their own booking is always permitted, while admin cancellation notifies the resident via the notification bell.

---

## 2. Estate Bulletin

Post community announcements — estate meetings, holiday hours, social events, security alerts.

- **Distinct from operational notices:** rent reminders, SC updates, and demand notices flow through Messaging/Communications, NOT the bulletin. The bulletin is for community life.
- **Pinned posts** surface at the top of the residents' feed (`pinned: true`).
- **Event metadata:** optional date, time, and location fields render as a highlighted event card instead of plain text.
- **Visibility scoping:** a bulletin can be estate-wide (all properties) or scoped to specific properties — residents only see bulletins for their property.

**Lifecycle:** `createBulletin` → visible immediately → `archiveBulletin` removes it from the feed (retained for audit, not hard-deleted).

---

## 3. Service Provider Directory

A curated list of vetted plumbers, electricians, cleaners, gardeners, and security vendors.

- **Residents browse and contact directly** — the estate manager stays out of the middle; contact happens via the provider's listed phone/WhatsApp.
- **"Verified" badge:** admin marks providers as Verified based on track record. Unverified providers display a neutral listing so residents can weigh the difference.
- **Internal admin notes** (never shown to residents) record why a provider was added, quotes received, or issues — institutional memory that survives staff turnover.
- **CRUD:** `createServiceProvider`, `updateServiceProvider`, `deleteServiceProvider` (admin only).

---

## Plan Gating

| Capability | Requirement |
|------------|-------------|
| All Estate Community features | Pro plan, or Estate Community add-on active |
| Enforcement point | `requireEstateCommunity()` — server-side, per function |
| Upgrade prompt | Inline message with deep-link to Settings → Subscription |

Admins can activate or trial the add-on from **Settings → Subscription**. A 30-day trial is available once per firm.

---

## Backend API (convex/estateCommunity.ts)

| Function | Type | Purpose |
|----------|------|---------|
| `getAmenities` / `createAmenity` / `updateAmenity` / `deleteAmenity` | query/mutation | Amenity catalog CRUD |
| `getBookingsForFirm` / `getBookingsForResident` | query | Booking views (admin / resident) |
| `createBooking` / `reviewBooking` / `cancelBooking` | mutation | Booking lifecycle + conflict checks |
| `getBulletins` / `createBulletin` / `updateBulletin` / `archiveBulletin` | query/mutation | Bulletin lifecycle |
| `getServiceProviders` / `getServiceProvider` / `createServiceProvider` / `updateServiceProvider` / `deleteServiceProvider` | query/mutation | Directory CRUD |

All mutations require firm authentication (`requireFirmUser`); residents are scoped to their own records via portal user resolution.
