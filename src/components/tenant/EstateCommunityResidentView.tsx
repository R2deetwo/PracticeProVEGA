/**
 * EstateCommunityResidentView.tsx — resident-facing view of admin-enabled
 * Estate Community modules.
 *
 * Renders different section based on which modules the admin has enabled:
 *   - Amenity Booking: list amenities + create booking + MY BOOKINGS
 *   - Estate Bulletin: read community announcements
 *   - Service Provider Directory: browse vetted vendors
 *
 * ROUND D (Wave 2, D3) — the auth fix this view always needed:
 * it used to call the STAFF endpoints (estateCommunity.getAmenities etc.,
 * guarded by requireFirmUser) with NO session token — dead under R16
 * Phase B strict identity — and even with a token, Tenants are rejected by
 * requireFirmUser by design. Every call threw "Unauthenticated"; the
 * Community tab rendered its loading/empty states forever. The view now
 * calls the D3 PORTAL surface (getAmenitiesForResident, …ForResident,
 * createBookingAsResident, getMyBookings, cancelMyBooking) with the
 * resident's bearer session — the same convention as the maintenance,
 * messages and ledger portal tabs.
 *
 * It also finally shows the resident their OWN bookings (status + cancel) —
 * before D3 a resident could submit a booking and then never see it again.
 */

import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useUI } from '../../contexts/UIContext';
// D3 / ADR-0004: this file's raw form elements migrated to the ui/
// primitives ('bare' + the exact legacy class strings — zero visual change)
// so the D3 additions (My Bookings cancel button) don't grow the
// ui-primitives ratchet.
import { Button, Input, Select } from '../ui';

interface Props {
  firmId: string;
  propertyId: string;
  residentUserId: string;
  residentName: string;
  bearerToken?: string | null;
  communityFeatures: {
    amenityBooking?: boolean;
    bulletin?: boolean;
    serviceProviderDirectory?: boolean;
  } | null;
  userEmail: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  event: 'Event',
  meeting: 'Meeting',
  announcement: 'Announcement',
  holiday: 'Holiday',
  alert: 'Alert',
};

const CATEGORY_COLORS: Record<string, string> = {
  event: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  meeting: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  announcement: 'bg-slate-50 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300 border-slate-200 dark:border-zinc-700',
  holiday: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  alert: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800',
};

const PROVIDER_CATEGORIES = [
  { value: 'plumber', label: 'Plumber', icon: '🔧' },
  { value: 'electrician', label: 'Electrician', icon: '⚡' },
  { value: 'cleaner', label: 'Cleaner', icon: '🧹' },
  { value: 'gardener', label: 'Gardener', icon: '🌱' },
  { value: 'security', label: 'Security', icon: '🛡️' },
  { value: 'other', label: 'Other', icon: '👷' },
];

const BOOKING_STATUS: Record<string, { label: string; badge: string }> = {
  pending: { label: 'Pending approval', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  approved: { label: 'Approved', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  rejected: { label: 'Rejected', badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  cancelled: { label: 'Cancelled', badge: 'bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-400' },
};

const EstateCommunityResidentView: React.FC<Props> = ({
  firmId, propertyId, bearerToken, communityFeatures, userEmail,
}) => {
  const { addToast } = useUI();
  const [activeSection, setActiveSection] = useState<'bulletin' | 'amenities' | 'providers'>(
    communityFeatures?.bulletin ? 'bulletin' :
    communityFeatures?.amenityBooking ? 'amenities' :
    'providers'
  );

  // D3: portal-caller queries — the resident's own firm, session-verified.
  const sessionArgs = { sessionToken: bearerToken ?? undefined };

  const bulletins = useQuery(
    api.estateCommunity.getBulletinsForResident,
    bearerToken ? { ...sessionArgs, propertyId: propertyId || undefined } : 'skip'
  );

  const amenities = useQuery(
    api.estateCommunity.getAmenitiesForResident,
    bearerToken ? sessionArgs : 'skip'
  );

  const providers = useQuery(
    api.estateCommunity.getServiceProvidersForResident,
    bearerToken ? sessionArgs : 'skip'
  );

  // ─── D3: MY BOOKINGS — the list that never existed ──────────────────
  const myBookings = useQuery(
    api.estateCommunity.getMyBookings,
    bearerToken ? sessionArgs : 'skip'
  );

  const cancelMyBooking = useMutation(api.estateCommunity.cancelMyBooking);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const handleCancelBooking = async (bookingId: string) => {
    setCancellingId(bookingId);
    try {
      await cancelMyBooking({ sessionToken: bearerToken ?? undefined, bookingId: bookingId as any });
      addToast('Booking cancelled.', { type: 'success' });
    } catch (e: any) {
      addToast(e?.message || 'Failed to cancel booking.', { type: 'error' });
    } finally {
      setCancellingId(null);
    }
  };

  // ─── Booking creation (portal mutation) ────────────────────────────
  const createBooking = useMutation(api.estateCommunity.createBookingAsResident);
  const [bookingAmenityId, setBookingAmenityId] = useState<string | null>(null);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingStartHour, setBookingStartHour] = useState('10');
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);

  const handleCreateBooking = async () => {
    if (!bookingAmenityId || !bookingDate) {
      addToast('Please pick an amenity and a date.', { type: 'info' });
      return;
    }
    const amenity = (amenities || []).find((a: any) => a._id === bookingAmenityId);
    if (!amenity) return;

    // Build slot start/end from the picked hour + amenity's slot duration
    const [y, m, d] = bookingDate.split('-').map(Number);
    const slotStart = new Date(y, m - 1, d, parseInt(bookingStartHour), 0, 0).getTime();
    const slotEnd = slotStart + (amenity.slotDurationMinutes || 60) * 60 * 1000;

    // Don't allow past bookings
    if (slotStart < Date.now()) {
      addToast('Please pick a future time slot.', { type: 'info' });
      return;
    }

    setIsSubmittingBooking(true);
    try {
      await createBooking({
        amenityId: bookingAmenityId as any,
        bookingDate,
        slotStart,
        slotEnd,
        sessionToken: bearerToken ?? undefined,
      });
      addToast(`Booking request submitted for ${amenity.name}.${amenity.requiresApproval ? ' Pending admin approval.' : ' Confirmed.'}`, { type: 'success', duration: 6000 });
      setBookingAmenityId(null);
      setBookingDate('');
    } catch (e: any) {
      addToast(e.message || 'Failed to create booking.', { type: 'error' });
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────
  const enabledModules = [
    ...(communityFeatures?.bulletin ? ['bulletin' as const] : []),
    ...(communityFeatures?.amenityBooking ? ['amenities' as const] : []),
    ...(communityFeatures?.serviceProviderDirectory ? ['providers' as const] : []),
  ];

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-zinc-100">Estate Community</h2>
        <p className="text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
          Community features managed by your property manager.
        </p>
      </div>

      {/* Module switcher — only show enabled modules */}
      {enabledModules.length > 1 && (
        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-zinc-800 rounded-lg overflow-x-auto">
          {enabledModules.map((m) => (
            <Button
              key={m}
              variant="bare"
              className={`flex-1 min-w-[100px] py-2 px-3 rounded-md text-xs font-bold transition-colors ${
                activeSection === m
                  ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300'
              }`}
              onClick={() => setActiveSection(m)}
            >
              {m === 'bulletin' && 'Bulletin'}
              {m === 'amenities' && 'Amenities'}
              {m === 'providers' && 'Providers'}
            </Button>
          ))}
        </div>
      )}

      {/* ─── BULLETIN ──────────────────────────────────────────────────── */}
      {activeSection === 'bulletin' && communityFeatures?.bulletin && (
        <div className="space-y-3">
          {bulletins === undefined ? (
            <p className="text-sm text-slate-400 text-center py-8">Loading bulletins…</p>
          ) : bulletins.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">
                  No community bulletins right now. Check back for events, meetings, and announcements.
            </p>
          ) : (
            bulletins
              .sort((a: any, b: any) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0) || (b.createdAt || 0) - (a.createdAt || 0))
              .map((b: any) => (
                <div
                  key={b._id}
                  className={`p-4 rounded-lg border ${
                    b.isPinned
                      ? 'border-amber-200 bg-amber-50/30 dark:bg-amber-900/10 dark:border-amber-800'
                      : 'border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {b.category && (
                        <span className={`text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${CATEGORY_COLORS[b.category] || CATEGORY_COLORS.announcement}`}>
                          {CATEGORY_LABELS[b.category] || b.category}
                        </span>
                      )}
                      {b.isPinned && (
                        <span className="text-2xs font-bold text-amber-600 dark:text-amber-400">📌 Pinned</span>
                      )}
                    </div>
                    <span className="text-3xs text-slate-400 flex-shrink-0">
                      {new Date(b.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 mb-1">{b.title}</h3>
                  <p className="text-sm text-slate-600 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">{b.body}</p>
                  {(b.eventDate || b.eventLocation) && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800 text-xs text-slate-500 dark:text-zinc-400 space-y-0.5">
                      {b.eventDate && (
                        <p>📅 {new Date(b.eventDate).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                      )}
                      {b.eventLocation && <p>📍 {b.eventLocation}</p>}
                    </div>
                  )}
                </div>
              ))
          )}
        </div>
      )}

      {/* ─── AMENITIES ──────────────────────────────────────────────────── */}
      {activeSection === 'amenities' && communityFeatures?.amenityBooking && (
        <div className="space-y-4">
          {/* D3: MY BOOKINGS — submitted bookings finally visible to the
              resident who submitted them, with status + cancel. */}
          <div className="p-4 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
            <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100 mb-3">My Bookings</h4>
            {myBookings === undefined ? (
              <p className="text-xs text-slate-400 py-2">Loading your bookings…</p>
            ) : myBookings.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">
                You have no amenity bookings yet. Pick an amenity below to book a slot.
              </p>
            ) : (
              <div className="space-y-2">
                {myBookings.map((b: any) => {
                  const st = BOOKING_STATUS[b.status] || BOOKING_STATUS.pending;
                  const canCancel = (b.status === 'pending' || b.status === 'approved') && b.slotEnd > Date.now();
                  return (
                    <div
                      key={b._id}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-700/50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className={`text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded ${st.badge}`}>
                            {st.label}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-slate-900 dark:text-zinc-100 truncate">{b.amenityName || 'Amenity'}</p>
                        <p className="text-2xs text-slate-500 dark:text-zinc-400">
                          {new Date(b.slotStart).toLocaleString('en-GB', {
                            weekday: 'short', day: 'numeric', month: 'short',
                            hour: 'numeric', minute: '2-digit',
                          })}
                          {' – '}
                          {new Date(b.slotEnd).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })}
                        </p>
                        {b.adminNotes && b.status === 'rejected' && (
                          <p className="text-2xs text-red-500 mt-1 italic">{b.adminNotes}</p>
                        )}
                      </div>
                      {canCancel && (
                        <Button
                          variant="bare"
                          className="flex-shrink-0 px-3 py-1.5 text-2xs font-bold text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
                          disabled={cancellingId === b._id}
                          onClick={() => handleCancelBooking(b._id)}
                        >
                          {cancellingId === b._id ? 'Cancelling…' : 'Cancel'}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {amenities === undefined ? (
              <p className="text-sm text-slate-400 col-span-2 text-center py-8">Loading amenities…</p>
            ) : amenities.length === 0 ? (
              <p className="text-sm text-slate-400 col-span-2 text-center py-8">
                No bookable amenities configured yet. Your property manager can add amenities from Settings.
              </p>
            ) : (
              amenities.map((a: any) => (
                <Button
                  key={a._id}
                  variant="bare"
                  className={`p-4 text-left rounded-lg border-2 transition-all ${
                    bookingAmenityId === a._id
                      ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-900/10'
                      : 'border-slate-200 dark:border-zinc-700 hover:border-slate-300 dark:hover:border-zinc-600 bg-white dark:bg-zinc-900'
                  }`}
                  onClick={() => { setBookingAmenityId(a._id); setBookingDate(''); }}
                >
                  <div className="w-full">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100">{a.name}</h4>
                      {a.requiresApproval && (
                        <span className="text-2xs text-amber-600 dark:text-amber-400 font-medium">approval</span>
                      )}
                    </div>
                    {a.description && <p className="text-xs text-slate-500 dark:text-zinc-400 mb-2">{a.description}</p>}
                    <div className="text-2xs text-slate-400 dark:text-zinc-500 space-y-0.5">
                      <p>⏱ {a.slotDurationMinutes}min slots</p>
                      {a.location && <p>📍 {a.location}</p>}
                    </div>
                  </div>
                </Button>
              ))
            )}
          </div>

          {/* Booking form — shown when an amenity is selected */}
          {bookingAmenityId && (
            <div className="p-4 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/50 space-y-3">
              <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Book a slot</h4>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-bold text-slate-500 uppercase mb-1">Date</label>
                  <Input
                    styleVariant="bare"
                    inputClassName="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
                    type="date"
                    value={bookingDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={e => setBookingDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold text-slate-500 uppercase mb-1">Start hour</label>
                  <Select
                    styleVariant="bare"
                    selectClassName="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
                    value={bookingStartHour}
                    onChange={e => setBookingStartHour(e.target.value)}
                  >
                    {Array.from({ length: 16 }, (_, i) => i + 6).map(h => (
                      <option key={h} value={String(h)}>{h}:00</option>
                    ))}
                  </Select>
                </div>
              </div>
              <Button
                variant="bare"
                className="w-full py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                disabled={!bookingDate || isSubmittingBooking}
                onClick={handleCreateBooking}
              >
                {isSubmittingBooking ? 'Submitting…' : 'Request Booking'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ─── SERVICE PROVIDERS ─────────────────────────────────────────── */}
      {activeSection === 'providers' && communityFeatures?.serviceProviderDirectory && (
        <div className="space-y-3">
          {providers === undefined ? (
            <p className="text-sm text-slate-400 text-center py-8">Loading providers…</p>
          ) : providers.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">
              No vetted service providers listed yet. Your property manager can add them from Settings.
            </p>
          ) : (
            providers.map((p: any) => {
              const cat = PROVIDER_CATEGORIES.find(c => c.value === p.category) || PROVIDER_CATEGORIES[5];
              return (
                <div key={p._id} className="p-4 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-xl">
                      {cat.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100">{p.name}</h4>
                        <span className="text-2xs font-bold text-slate-500 uppercase tracking-wider">{cat.label}</span>
                        {p.isVerified && (
                          <span className="text-2xs font-bold text-emerald-600 dark:text-emerald-400">✓ Verified</span>
                        )}
                        {p.rating && (
                          <span className="text-2xs text-amber-500">★ {p.rating.toFixed(1)}</span>
                        )}
                      </div>
                      {p.specialty && <p className="text-xs text-slate-600 dark:text-zinc-400 mb-2">{p.specialty}</p>}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        {p.phone && (
                          <a href={`tel:${p.phone}`} className="text-emerald-600 dark:text-emerald-400 hover:underline">📞 {p.phone}</a>
                        )}
                        {p.whatsapp && (
                          <a href={`https://wa.me/${p.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400 hover:underline">💬 WhatsApp</a>
                        )}
                        {p.email && (
                          <a href={`mailto:${p.email}`} className="text-emerald-600 dark:text-emerald-400 hover:underline">✉ {p.email}</a>
                        )}
                      </div>
                      {p.serviceArea && (
                        <p className="text-2xs text-slate-400 mt-2">Service area: {p.serviceArea}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default EstateCommunityResidentView;
