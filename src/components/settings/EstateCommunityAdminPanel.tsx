/**
 * EstateCommunityAdminPanel.tsx — the firm-side Estate Community
 * management console (ROUND D, Wave 2 — D3).
 *
 * The settings card has PROMISED this surface since the feature shipped
 * ("Manage amenities and review booking requests from the Estate tab") but
 * no Estate tab existed: createAmenity / reviewBooking / getBookingsForFirm
 * / createBulletin / createServiceProvider all had ZERO callers. The entire
 * booking loop was dead past the initial submission — approval-needed
 * bookings stayed pending forever, and amenities could only be created by
 * direct API calls.
 *
 * This panel mounts under Settings → Firm → Estate Community (below the
 * module toggles) and wires the EXISTING staff endpoints — no backend
 * changes needed for the firm side:
 *   • Amenities   — create / edit / deactivate (estateCommunity.*)
 *   • Bookings    — the approval queue (pending → approved/rejected)
 *   • Bulletins   — post / edit / archive community announcements
 *   • Providers   — add / edit / deactivate vetted vendors
 *
 * All calls carry the bearer sessionToken (R16 strict identity) and the
 * caller must be a firm Admin or Founding Partner (requireEstateAdmin —
 * the D3 gate that also un-blocked Founding Partners, whom the old
 * Admin-only requireAdmin locked out of this entire surface).
 *
 * ADR-0004: new code uses the ui/ primitives (Button/Input/Select/
 * Textarea) — zero raw form elements (the ui-primitives ratchet).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useMutation, useConvex } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useCoreState } from '../../contexts/CoreContext';
import { useUI } from '../../contexts/UIContext';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Input, Select, Textarea } from '../ui';

interface Props {
  communityFeatures: {
    amenityBooking?: boolean;
    bulletin?: boolean;
    serviceProviderDirectory?: boolean;
  };
}

type SectionId = 'amenities' | 'bookings' | 'bulletins' | 'providers';

const PROVIDER_CATEGORIES = [
  { value: 'plumber', label: '🔧 Plumber' },
  { value: 'electrician', label: '⚡ Electrician' },
  { value: 'cleaner', label: '🧹 Cleaner' },
  { value: 'gardener', label: '🌱 Gardener' },
  { value: 'security', label: '🛡️ Security' },
  { value: 'other', label: '👷 Other' },
];

const BULLETIN_CATEGORIES = [
  { value: 'announcement', label: 'Announcement' },
  { value: 'event', label: 'Event' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'holiday', label: 'Holiday' },
  { value: 'alert', label: 'Alert' },
];

const BOOKING_FILTERS = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: undefined, label: 'All' },
] as const;

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  cancelled: 'bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-400',
};

const EstateCommunityAdminPanel: React.FC<Props> = ({ communityFeatures }) => {
  const { coreState } = useCoreState();
  const { addToast } = useUI();
  const { currentUser, bearerToken } = useAuth();
  const convex = useConvex();

  const firm = coreState.firmDetails as any;
  const firmId = firm?.id || currentUser?.firmId || '';
  const authArgs = { userEmail: currentUser?.email, sessionToken: bearerToken ?? undefined };

  const enabledSections: SectionId[] = [
    ...(communityFeatures.amenityBooking ? (['amenities', 'bookings'] as SectionId[]) : []),
    ...(communityFeatures.bulletin ? (['bulletins'] as SectionId[]) : []),
    ...(communityFeatures.serviceProviderDirectory ? (['providers'] as SectionId[]) : []),
  ];
  const [section, setSection] = useState<SectionId>(enabledSections[0] || 'amenities');

  // ─── Amenities ───────────────────────────────────────────────────────
  const [amenities, setAmenities] = useState<any[] | null>(null);
  const [amenityForm, setAmenityForm] = useState<Record<string, any> | null>(null); // null = closed
  const refreshAmenities = useCallback(async () => {
    if (!convex || !firmId) return;
    try {
      const rows = await convex.query(api.estateCommunity.getAmenities, {
        firmId, includeInactive: true, ...authArgs,
      });
      setAmenities(rows || []);
    } catch (e: any) {
      console.warn('[EstateAdmin] getAmenities failed:', e?.message || e);
      setAmenities([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convex, firmId, currentUser?.email, bearerToken]);

  const createAmenity = useMutation(api.estateCommunity.createAmenity);
  const updateAmenity = useMutation(api.estateCommunity.updateAmenity);
  const deleteAmenity = useMutation(api.estateCommunity.deleteAmenity);

  const handleSaveAmenity = async () => {
    if (!amenityForm) return;
    const f = amenityForm;
    if (!f.name?.trim()) { addToast('Amenity name is required.', { type: 'error' }); return; }
    try {
      const base = {
        name: f.name.trim(),
        description: f.description?.trim() || undefined,
        location: f.location?.trim() || undefined,
        slotDurationMinutes: Number(f.slotDurationMinutes) || 60,
        maxConcurrentBookings: Number(f.maxConcurrentBookings) || 1,
        bookingWindowDays: Number(f.bookingWindowDays) || 14,
        requiresApproval: !!f.requiresApproval,
        ...authArgs,
      };
      if (f._id) {
        await updateAmenity({ ...base, amenityId: f._id, isActive: f.isActive !== false });
        addToast('Amenity updated.', { type: 'success' });
      } else {
        await createAmenity({ ...base, firmId });
        addToast('Amenity created — residents can now book it.', { type: 'success' });
      }
      setAmenityForm(null);
      refreshAmenities();
    } catch (e: any) {
      addToast(e?.message || 'Failed to save amenity.', { type: 'error' });
    }
  };

  const handleDeactivateAmenity = async (amenityId: any) => {
    try {
      await deleteAmenity({ amenityId, ...authArgs });
      addToast('Amenity deactivated (booking history preserved).', { type: 'success' });
      refreshAmenities();
    } catch (e: any) {
      addToast(e?.message || 'Failed to deactivate amenity.', { type: 'error' });
    }
  };

  // ─── Bookings (approval queue) ───────────────────────────────────────
  const [bookingFilter, setBookingFilter] = useState<string | undefined>('pending');
  const [bookings, setBookings] = useState<any[] | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);
  const reviewBooking = useMutation(api.estateCommunity.reviewBooking);

  const refreshBookings = useCallback(async () => {
    if (!convex || !firmId) return;
    try {
      const rows = await convex.query(api.estateCommunity.getBookingsForFirm, {
        firmId, status: bookingFilter, ...authArgs,
      });
      setBookings(rows || []);
    } catch (e: any) {
      console.warn('[EstateAdmin] getBookingsForFirm failed:', e?.message || e);
      setBookings([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convex, firmId, currentUser?.email, bearerToken, bookingFilter]);

  const handleReview = async (bookingId: any, status: 'approved' | 'rejected') => {
    setProcessingId(String(bookingId));
    try {
      await reviewBooking({
        bookingId,
        status,
        adminNotes: reviewNotes[String(bookingId)] || undefined,
        ...authArgs,
      });
      addToast(status === 'approved' ? 'Booking approved.' : 'Booking rejected.', { type: 'success' });
      setReviewNotes(prev => { const n = { ...prev }; delete n[String(bookingId)]; return n; });
      refreshBookings();
    } catch (e: any) {
      addToast(e?.message || 'Failed to review booking.', { type: 'error' });
    } finally {
      setProcessingId(null);
    }
  };

  // ─── Bulletins ───────────────────────────────────────────────────────
  const [bulletins, setBulletins] = useState<any[] | null>(null);
  const [bulletinForm, setBulletinForm] = useState<Record<string, any> | null>(null);
  const createBulletin = useMutation(api.estateCommunity.createBulletin);
  const updateBulletin = useMutation(api.estateCommunity.updateBulletin);
  const archiveBulletin = useMutation(api.estateCommunity.archiveBulletin);

  const refreshBulletins = useCallback(async () => {
    if (!convex || !firmId) return;
    try {
      const rows = await convex.query(api.estateCommunity.getBulletins, {
        firmId, ...authArgs,
      });
      setBulletins(rows || []);
    } catch (e: any) {
      console.warn('[EstateAdmin] getBulletins failed:', e?.message || e);
      setBulletins([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convex, firmId, currentUser?.email, bearerToken]);

  const handleSaveBulletin = async () => {
    if (!bulletinForm) return;
    const f = bulletinForm;
    if (!f.title?.trim() || !f.body?.trim()) {
      addToast('Title and body are required.', { type: 'error' });
      return;
    }
    try {
      const eventDate = f.eventDateLocal ? new Date(f.eventDateLocal).getTime() : undefined;
      const base = {
        title: f.title.trim(),
        body: f.body.trim(),
        category: f.category || 'announcement',
        eventDate,
        eventLocation: f.eventLocation?.trim() || undefined,
        isPinned: !!f.isPinned,
        ...authArgs,
      };
      if (f._id) {
        await updateBulletin({ ...base, bulletinId: f._id, status: 'active' });
        addToast('Bulletin updated.', { type: 'success' });
      } else {
        await createBulletin({ ...base, firmId });
        addToast('Bulletin posted — residents see it immediately.', { type: 'success' });
      }
      setBulletinForm(null);
      refreshBulletins();
    } catch (e: any) {
      addToast(e?.message || 'Failed to save bulletin.', { type: 'error' });
    }
  };

  const handleArchiveBulletin = async (bulletinId: any) => {
    try {
      await archiveBulletin({ bulletinId, ...authArgs });
      addToast('Bulletin archived.', { type: 'success' });
      refreshBulletins();
    } catch (e: any) {
      addToast(e?.message || 'Failed to archive bulletin.', { type: 'error' });
    }
  };

  // ─── Providers ───────────────────────────────────────────────────────
  const [providers, setProviders] = useState<any[] | null>(null);
  const [providerForm, setProviderForm] = useState<Record<string, any> | null>(null);
  const createServiceProvider = useMutation(api.estateCommunity.createServiceProvider);
  const updateServiceProvider = useMutation(api.estateCommunity.updateServiceProvider);
  const deleteServiceProvider = useMutation(api.estateCommunity.deleteServiceProvider);

  const refreshProviders = useCallback(async () => {
    if (!convex || !firmId) return;
    try {
      const rows = await convex.query(api.estateCommunity.getServiceProviders, {
        firmId, ...authArgs,
      });
      setProviders(rows || []);
    } catch (e: any) {
      console.warn('[EstateAdmin] getServiceProviders failed:', e?.message || e);
      setProviders([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convex, firmId, currentUser?.email, bearerToken]);

  const handleSaveProvider = async () => {
    if (!providerForm) return;
    const f = providerForm;
    if (!f.name?.trim() || !f.category) {
      addToast('Name and category are required.', { type: 'error' });
      return;
    }
    try {
      const base = {
        name: f.name.trim(),
        category: f.category,
        specialty: f.specialty?.trim() || undefined,
        phone: f.phone?.trim() || undefined,
        whatsapp: f.whatsapp?.trim() || undefined,
        email: f.email?.trim() || undefined,
        serviceArea: f.serviceArea?.trim() || undefined,
        rating: f.rating ? Number(f.rating) : undefined,
        isVerified: !!f.isVerified,
        isActive: f.isActive !== false,
        ...authArgs,
      };
      if (f._id) {
        await updateServiceProvider({ ...base, providerId: f._id });
        addToast('Provider updated.', { type: 'success' });
      } else {
        await createServiceProvider({ ...base, firmId });
        addToast('Provider added to the directory.', { type: 'success' });
      }
      setProviderForm(null);
      refreshProviders();
    } catch (e: any) {
      addToast(e?.message || 'Failed to save provider.', { type: 'error' });
    }
  };

  const handleDeactivateProvider = async (providerId: any) => {
    try {
      await deleteServiceProvider({ providerId, ...authArgs });
      addToast('Provider removed from the directory.', { type: 'success' });
      refreshProviders();
    } catch (e: any) {
      addToast(e?.message || 'Failed to remove provider.', { type: 'error' });
    }
  };

  // ─── Data loading ────────────────────────────────────────────────────
  useEffect(() => { if (section === 'amenities' || section === 'bookings') refreshAmenities(); },
    [section, refreshAmenities]);
  useEffect(() => { if (section === 'bookings') refreshBookings(); },
    [section, refreshBookings]);
  useEffect(() => { if (section === 'bulletins') refreshBulletins(); },
    [section, refreshBulletins]);
  useEffect(() => { if (section === 'providers') refreshProviders(); },
    [section, refreshProviders]);

  if (enabledSections.length === 0) return null;

  const amenityName = (id: string) =>
    (amenities || []).find((a) => a._id === id)?.name || 'Amenity';

  const rowCard = 'p-3 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900';
  const formCard = 'p-4 rounded-lg border-2 border-primary-200 dark:border-primary-800 bg-primary-50/30 dark:bg-primary-900/10 space-y-3';

  return (
    <div className="mt-6 pt-5 border-t border-slate-200 dark:border-zinc-700">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">
            Manage Community
          </h4>
          <p className="text-2xs text-slate-500 dark:text-zinc-400 mt-0.5">
            The modules you enable above are managed here.
          </p>
        </div>
        {/* Section switcher (segmented control) */}
        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-zinc-800 rounded-lg overflow-x-auto">
          {enabledSections.map((s) => (
            <Button
              key={s}
              variant={section === s ? 'segmented-active' : 'segmented'}
              size="sm"
              onClick={() => setSection(s)}
            >
              {s === 'amenities' && 'Amenities'}
              {s === 'bookings' && 'Bookings'}
              {s === 'bulletins' && 'Bulletins'}
              {s === 'providers' && 'Providers'}
            </Button>
          ))}
        </div>
      </div>

      {/* ═══ AMENITIES ═══ */}
      {section === 'amenities' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setAmenityForm({
                slotDurationMinutes: 60, maxConcurrentBookings: 1,
                bookingWindowDays: 14, requiresApproval: false,
              })}
            >
              + Add Amenity
            </Button>
          </div>

          {amenityForm && (
            <div className={formCard}>
              <h5 className="text-sm font-bold text-slate-900 dark:text-white">
                {amenityForm._id ? 'Edit Amenity' : 'New Amenity'}
              </h5>
              <div className="grid sm:grid-cols-2 gap-3">
                <Input
                  styleVariant="settings"
                  label="Name *"
                  value={amenityForm.name || ''}
                  onChange={e => setAmenityForm({ ...amenityForm, name: e.target.value })}
                  placeholder="e.g. Clubhouse Gym"
                />
                <Input
                  styleVariant="settings"
                  label="Location"
                  value={amenityForm.location || ''}
                  onChange={e => setAmenityForm({ ...amenityForm, location: e.target.value })}
                  placeholder="e.g. Block B, Ground Floor"
                />
              </div>
              <Input
                styleVariant="settings"
                label="Description"
                value={amenityForm.description || ''}
                onChange={e => setAmenityForm({ ...amenityForm, description: e.target.value })}
                placeholder="e.g. Gym with cardio equipment — residents only"
              />
              <div className="grid grid-cols-3 gap-3">
                <Input
                  styleVariant="settings" label="Slot (min)" type="number" min={15} step={15}
                  value={amenityForm.slotDurationMinutes ?? 60}
                  onChange={e => setAmenityForm({ ...amenityForm, slotDurationMinutes: Number(e.target.value) })}
                />
                <Input
                  styleVariant="settings" label="Max concurrent" type="number" min={1}
                  value={amenityForm.maxConcurrentBookings ?? 1}
                  onChange={e => setAmenityForm({ ...amenityForm, maxConcurrentBookings: Number(e.target.value) })}
                />
                <Input
                  styleVariant="settings" label="Window (days)" type="number" min={1}
                  value={amenityForm.bookingWindowDays ?? 14}
                  onChange={e => setAmenityForm({ ...amenityForm, bookingWindowDays: Number(e.target.value) })}
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant={amenityForm.requiresApproval ? 'segmented-active' : 'segmented'}
                  size="sm"
                  aria-pressed={!!amenityForm.requiresApproval}
                  onClick={() => setAmenityForm({ ...amenityForm, requiresApproval: !amenityForm.requiresApproval })}
                >
                  {amenityForm.requiresApproval ? '✓' : '○'} Requires approval
                </Button>
                {amenityForm._id && (
                  <Button
                    variant={amenityForm.isActive !== false ? 'segmented-active' : 'segmented'}
                    size="sm"
                    aria-pressed={amenityForm.isActive !== false}
                    onClick={() => setAmenityForm({ ...amenityForm, isActive: !(amenityForm.isActive !== false) })}
                  >
                    {amenityForm.isActive !== false ? '✓' : '○'} Active
                  </Button>
                )}
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setAmenityForm(null)}>Cancel</Button>
                <Button variant="primary" size="sm" onClick={handleSaveAmenity}>
                  {amenityForm._id ? 'Save Changes' : 'Create Amenity'}
                </Button>
              </div>
            </div>
          )}

          {amenities === null ? (
            <p className="text-xs text-slate-400 text-center py-6">Loading amenities…</p>
          ) : amenities.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">
              No amenities yet. Add the shared spaces residents can book (gym, pool, clubhouse…).
            </p>
          ) : (
            <div className="space-y-2">
              {amenities.map((a) => (
                <div key={a._id} className={`p-3 rounded-lg border ${a.isActive
                  ? 'border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900'
                  : 'border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/50 opacity-60'}`}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">{a.name}</span>
                        {a.requiresApproval && (
                          <span className="text-2xs font-bold text-amber-600 dark:text-amber-400">approval required</span>
                        )}
                        {!a.isActive && (
                          <span className="text-2xs font-bold text-slate-400 uppercase">inactive</span>
                        )}
                      </div>
                      <p className="text-2xs text-slate-500 dark:text-zinc-400 mt-0.5">
                        ⏱ {a.slotDurationMinutes}min slots • max {a.maxConcurrentBookings ?? 1} concurrent • book up to {a.bookingWindowDays ?? 14} days ahead
                        {a.location ? ` • 📍 ${a.location}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => setAmenityForm({ ...a })}>
                        Edit
                      </Button>
                      {a.isActive && (
                        <Button variant="danger" size="sm" onClick={() => handleDeactivateAmenity(a._id)}>
                          Deactivate
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ BOOKINGS (approval queue) ═══ */}
      {section === 'bookings' && (
        <div className="space-y-3">
          <div className="flex gap-1 p-1 bg-slate-100 dark:bg-zinc-800 rounded-lg overflow-x-auto w-fit">
            {BOOKING_FILTERS.map(f => (
              <Button
                key={f.label}
                variant={bookingFilter === f.id ? 'segmented-active' : 'segmented'}
                size="sm"
                onClick={() => setBookingFilter(f.id)}
              >
                {f.label}
              </Button>
            ))}
          </div>

          {bookings === null ? (
            <p className="text-xs text-slate-400 text-center py-6">Loading bookings…</p>
          ) : bookings.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">
              {bookingFilter === 'pending'
                ? 'No pending bookings. New resident requests appear here for approval.'
                : `No ${bookingFilter || ''} bookings.`}
            </p>
          ) : (
            <div className="space-y-2">
              {bookings.map((b) => (
                <div key={b._id} className={rowCard}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {amenityName(b.amenityId)}
                        </span>
                        <span className={`text-2xs font-bold uppercase px-2 py-0.5 rounded ${STATUS_BADGE[b.status] || STATUS_BADGE.pending}`}>
                          {b.status}
                        </span>
                      </div>
                      <p className="text-2xs text-slate-500 dark:text-zinc-400">
                        {b.residentName} • {new Date(b.slotStart).toLocaleString('en-GB', {
                          weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
                        })} – {new Date(b.slotEnd).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })}
                      </p>
                      {b.residentNotes && (
                        <p className="text-2xs text-slate-500 dark:text-zinc-400 mt-1 italic">"{b.residentNotes}"</p>
                      )}
                      {b.status === 'pending' && (
                        <div className="mt-2">
                          <Input
                            styleVariant="settings"
                            placeholder="Note for the resident (optional)"
                            value={reviewNotes[String(b._id)] || ''}
                            onChange={e => setReviewNotes(prev => ({ ...prev, [String(b._id)]: e.target.value }))}
                          />
                        </div>
                      )}
                    </div>
                    {b.status === 'pending' && (
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          variant="success" size="sm"
                          loading={processingId === String(b._id)}
                          onClick={() => handleReview(b._id, 'approved')}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="danger" size="sm"
                          disabled={processingId === String(b._id)}
                          onClick={() => handleReview(b._id, 'rejected')}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ BULLETINS ═══ */}
      {section === 'bulletins' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button variant="primary" size="sm"
              onClick={() => setBulletinForm({ category: 'announcement', isPinned: false })}>
              + Post Bulletin
            </Button>
          </div>

          {bulletinForm && (
            <div className={formCard}>
              <h5 className="text-sm font-bold text-slate-900 dark:text-white">
                {bulletinForm._id ? 'Edit Bulletin' : 'New Bulletin'}
              </h5>
              <div className="grid sm:grid-cols-2 gap-3">
                <Input
                  styleVariant="settings" label="Title *"
                  value={bulletinForm.title || ''}
                  onChange={e => setBulletinForm({ ...bulletinForm, title: e.target.value })}
                  placeholder="e.g. Estate General Meeting"
                />
                <Select
                  styleVariant="settings" label="Category"
                  value={bulletinForm.category || 'announcement'}
                  options={BULLETIN_CATEGORIES}
                  onChange={e => setBulletinForm({ ...bulletinForm, category: e.target.value })}
                />
              </div>
              <Textarea
                styleVariant="settings" label="Body *" rows={4}
                value={bulletinForm.body || ''}
                onChange={e => setBulletinForm({ ...bulletinForm, body: e.target.value })}
                placeholder="The message residents will read…"
              />
              <div className="grid sm:grid-cols-2 gap-3">
                <Input
                  styleVariant="settings" label="Event date (optional)" type="datetime-local"
                  value={bulletinForm.eventDateLocal || ''}
                  onChange={e => setBulletinForm({ ...bulletinForm, eventDateLocal: e.target.value })}
                />
                <Input
                  styleVariant="settings" label="Event location (optional)"
                  value={bulletinForm.eventLocation || ''}
                  onChange={e => setBulletinForm({ ...bulletinForm, eventLocation: e.target.value })}
                  placeholder="e.g. Main Clubhouse"
                />
              </div>
              <Button
                variant={bulletinForm.isPinned ? 'segmented-active' : 'segmented'}
                size="sm"
                aria-pressed={!!bulletinForm.isPinned}
                onClick={() => setBulletinForm({ ...bulletinForm, isPinned: !bulletinForm.isPinned })}
              >
                {bulletinForm.isPinned ? '📌' : '○'} Pin to the top of residents' bulletin board
              </Button>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setBulletinForm(null)}>Cancel</Button>
                <Button variant="primary" size="sm" onClick={handleSaveBulletin}>
                  {bulletinForm._id ? 'Save Changes' : 'Post Bulletin'}
                </Button>
              </div>
            </div>
          )}

          {bulletins === null ? (
            <p className="text-xs text-slate-400 text-center py-6">Loading bulletins…</p>
          ) : bulletins.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">
              No active bulletins. Post announcements, events, and meetings for your residents.
            </p>
          ) : (
            <div className="space-y-2">
              {bulletins.map((b) => (
                <div key={b._id} className={rowCard}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {b.isPinned && <span className="text-2xs">📌</span>}
                        <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{b.title}</span>
                        <span className="text-2xs font-bold text-slate-400 uppercase">{b.category}</span>
                      </div>
                      <p className="text-2xs text-slate-500 dark:text-zinc-400 mt-0.5 line-clamp-2">{b.body}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => setBulletinForm({ ...b })}>
                        Edit
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => handleArchiveBulletin(b._id)}>
                        Archive
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ PROVIDERS ═══ */}
      {section === 'providers' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button variant="primary" size="sm"
              onClick={() => setProviderForm({ category: 'plumber', isVerified: false, isActive: true })}>
              + Add Provider
            </Button>
          </div>

          {providerForm && (
            <div className={formCard}>
              <h5 className="text-sm font-bold text-slate-900 dark:text-white">
                {providerForm._id ? 'Edit Provider' : 'New Provider'}
              </h5>
              <div className="grid sm:grid-cols-2 gap-3">
                <Input
                  styleVariant="settings" label="Name *"
                  value={providerForm.name || ''}
                  onChange={e => setProviderForm({ ...providerForm, name: e.target.value })}
                  placeholder="e.g. Chidi Plumbing Works"
                />
                <Select
                  styleVariant="settings" label="Category *"
                  value={providerForm.category || 'plumber'}
                  options={PROVIDER_CATEGORIES}
                  onChange={e => setProviderForm({ ...providerForm, category: e.target.value })}
                />
              </div>
              <Input
                styleVariant="settings" label="Specialty"
                value={providerForm.specialty || ''}
                onChange={e => setProviderForm({ ...providerForm, specialty: e.target.value })}
                placeholder="e.g. Water heaters, pipe repairs"
              />
              <div className="grid sm:grid-cols-3 gap-3">
                <Input
                  styleVariant="settings" label="Phone"
                  value={providerForm.phone || ''}
                  onChange={e => setProviderForm({ ...providerForm, phone: e.target.value })}
                  placeholder="+234…"
                />
                <Input
                  styleVariant="settings" label="WhatsApp"
                  value={providerForm.whatsapp || ''}
                  onChange={e => setProviderForm({ ...providerForm, whatsapp: e.target.value })}
                  placeholder="+234…"
                />
                <Input
                  styleVariant="settings" label="Email"
                  value={providerForm.email || ''}
                  onChange={e => setProviderForm({ ...providerForm, email: e.target.value })}
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <Input
                  styleVariant="settings" label="Service area"
                  value={providerForm.serviceArea || ''}
                  onChange={e => setProviderForm({ ...providerForm, serviceArea: e.target.value })}
                  placeholder="e.g. Lekki Phase 1"
                />
                <div className="flex items-end gap-2 flex-wrap">
                  <Button
                    variant={providerForm.isVerified ? 'segmented-active' : 'segmented'}
                    size="sm"
                    aria-pressed={!!providerForm.isVerified}
                    onClick={() => setProviderForm({ ...providerForm, isVerified: !providerForm.isVerified })}
                  >
                    {providerForm.isVerified ? '✓' : '○'} Verified vendor
                  </Button>
                  {providerForm._id && (
                    <Button
                      variant={providerForm.isActive !== false ? 'segmented-active' : 'segmented'}
                      size="sm"
                      aria-pressed={providerForm.isActive !== false}
                      onClick={() => setProviderForm({ ...providerForm, isActive: !(providerForm.isActive !== false) })}
                    >
                      {providerForm.isActive !== false ? '✓' : '○'} Listed
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setProviderForm(null)}>Cancel</Button>
                <Button variant="primary" size="sm" onClick={handleSaveProvider}>
                  {providerForm._id ? 'Save Changes' : 'Add Provider'}
                </Button>
              </div>
            </div>
          )}

          {providers === null ? (
            <p className="text-xs text-slate-400 text-center py-6">Loading providers…</p>
          ) : providers.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">
              No providers listed yet. Add the vetted plumbers, electricians and cleaners your residents can call directly.
            </p>
          ) : (
            <div className="space-y-2">
              {providers.map((p) => {
                const cat = PROVIDER_CATEGORIES.find(c => c.value === p.category) || PROVIDER_CATEGORIES[5];
                return (
                  <div key={p._id} className={rowCard}>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>{cat.label.split(' ')[0]}</span>
                          <span className="text-sm font-bold text-slate-900 dark:text-white">{p.name}</span>
                          <span className="text-2xs font-bold text-slate-400 uppercase">{cat.label.split(' ').slice(1).join(' ')}</span>
                          {p.isVerified && (
                            <span className="text-2xs font-bold text-emerald-600 dark:text-emerald-400">✓ Verified</span>
                          )}
                        </div>
                        <p className="text-2xs text-slate-500 dark:text-zinc-400 mt-0.5">
                          {[p.phone, p.whatsapp, p.email].filter(Boolean).join(' • ') || 'No contact details'}
                          {p.serviceArea ? ` • ${p.serviceArea}` : ''}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => setProviderForm({ ...p })}>
                          Edit
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => handleDeactivateProvider(p._id)}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EstateCommunityAdminPanel;
