/**
 * estateCommunity.ts — Convex mutations and queries for Estate Community Features.
 *
 * Three modules, each can be toggled on/off per-firm via
 * firmDetails.settings.communityFeatures:
 *   1. Amenity Booking — admin-defined bookable resources + resident bookings
 *   2. Estate Bulletin — community announcements (events, meetings)
 *   3. Service Provider Directory — admin-curated vendor list
 *
 * All mutations require admin role (requireAdmin). Queries are resident-facing
 * but scoped to the resident's firm.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { requireFirmUser, requireAdmin } from "./authHelpers";

// ════════════════════════════════════════════════════════════════════════
// AMENITIES (admin CRUD)
// ════════════════════════════════════════════════════════════════════════

export const createAmenity = mutation({
  args: {
    firmId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    location: v.optional(v.string()),
    slotDurationMinutes: v.number(),
    operatingHours: v.optional(v.any()),
    maxConcurrentBookings: v.optional(v.number()),
    bookingWindowDays: v.optional(v.number()),
    requiresApproval: v.optional(v.boolean()),
    imageUrl: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAdmin(ctx, args.userEmail);
    const firmId = auth.firmId || args.firmId;
    const now = Date.now();
    return await ctx.db.insert("estate_amenities", {
      firmId,
      name: args.name,
      description: args.description,
      location: args.location,
      slotDurationMinutes: args.slotDurationMinutes,
      operatingHours: args.operatingHours,
      maxConcurrentBookings: args.maxConcurrentBookings ?? 1,
      bookingWindowDays: args.bookingWindowDays ?? 14,
      requiresApproval: args.requiresApproval ?? false,
      isActive: true,
      imageUrl: args.imageUrl,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateAmenity = mutation({
  args: {
    amenityId: v.id("estate_amenities"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    location: v.optional(v.string()),
    slotDurationMinutes: v.optional(v.number()),
    operatingHours: v.optional(v.any()),
    maxConcurrentBookings: v.optional(v.number()),
    bookingWindowDays: v.optional(v.number()),
    requiresApproval: v.optional(v.boolean()),
    imageUrl: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAdmin(ctx, args.userEmail);
    const amenity = await ctx.db.get(args.amenityId);
    if (!amenity) throw new Error("Amenity not found");
    if (amenity.firmId !== auth.firmId) throw new Error("Not authorized");
    const { amenityId, userEmail, ...updates } = args;
    const cleanUpdates: Record<string, any> = { updatedAt: Date.now() };
    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined) cleanUpdates[k] = v;
    }
    await ctx.db.patch(args.amenityId, cleanUpdates);
  },
});

export const deleteAmenity = mutation({
  args: { amenityId: v.id("estate_amenities"), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const auth = await requireAdmin(ctx, args.userEmail);
    const amenity = await ctx.db.get(args.amenityId);
    if (!amenity) throw new Error("Amenity not found");
    if (amenity.firmId !== auth.firmId) throw new Error("Not authorized");
    // Soft-delete (preserve booking history)
    await ctx.db.patch(args.amenityId, { isActive: false, updatedAt: Date.now() });
  },
});

// ════════════════════════════════════════════════════════════════════════
// AMENITY BOOKINGS (resident creates, admin reviews)
// ════════════════════════════════════════════════════════════════════════

export const createBooking = mutation({
  args: {
    firmId: v.string(),
    amenityId: v.id("estate_amenities"),
    bookingDate: v.string(),
    slotStart: v.number(),
    slotEnd: v.number(),
    residentNotes: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail);
    const firmId = auth.firmId || args.firmId;

    const amenity = await ctx.db.get(args.amenityId);
    if (!amenity || !amenity.isActive) throw new Error("Amenity not available");
    if (amenity.firmId !== firmId) throw new Error("Not authorized");

    // Check for conflicts (unless maxConcurrentBookings > current count)
    const existing = await ctx.db
      .query("estate_amenity_bookings")
      .withIndex("by_amenity", (q) => q.eq("amenityId", args.amenityId))
      .filter((q) =>
        q.and(
          q.eq(q.field("bookingDate"), args.bookingDate),
          q.or(
            q.eq(q.field("status"), "approved"),
            q.eq(q.field("status"), "pending"),
          ),
          q.lt(q.field("slotStart"), args.slotEnd),
          q.gt(q.field("slotEnd"), args.slotStart),
        ),
      )
      .collect();

    const maxConcurrent = amenity.maxConcurrentBookings ?? 1;
    if (existing.length >= maxConcurrent) {
      throw new Error("This slot is fully booked. Please pick another time.");
    }

    const now = Date.now();
    const bookingId = await ctx.db.insert("estate_amenity_bookings", {
      firmId,
      amenityId: args.amenityId,
      residentUserId: auth.userId,
      residentName: auth.user?.name || "Resident",
      propertyId: undefined,
      unitId: undefined,
      bookingDate: args.bookingDate,
      slotStart: args.slotStart,
      slotEnd: args.slotEnd,
      status: amenity.requiresApproval ? "pending" : "approved",
      residentNotes: args.residentNotes,
      createdAt: now,
      updatedAt: now,
    });

    // Log activity (non-blocking)
    try {
      await ctx.runMutation(api.myFunctions.logActivity, {
        firmId,
        userId: auth.userId,
        userName: auth.user?.name || undefined,
        action: `Booked ${amenity.name} for ${args.bookingDate}`,
        targetType: "amenity_booking",
        targetId: String(bookingId),
        targetName: amenity.name,
      });
    } catch {}

    return bookingId;
  },
});

export const reviewBooking = mutation({
  args: {
    bookingId: v.id("estate_amenity_bookings"),
    status: v.union(v.literal("approved"), v.literal("rejected")),
    adminNotes: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAdmin(ctx, args.userEmail);
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) throw new Error("Booking not found");
    if (booking.firmId !== auth.firmId) throw new Error("Not authorized");

    await ctx.db.patch(args.bookingId, {
      status: args.status,
      adminNotes: args.adminNotes,
      reviewedBy: auth.userId,
      reviewedAt: Date.now(),
      updatedAt: Date.now(),
    });

    // TODO: Send push notification to resident when push infra is wired.
    // For now, the resident sees status changes on next portal visit.
  },
});

export const cancelBooking = mutation({
  args: {
    bookingId: v.id("estate_amenity_bookings"),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail);
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) throw new Error("Booking not found");
    // Resident can cancel their own; admin can cancel any in their firm
    if (booking.residentUserId !== auth.userId && booking.firmId !== auth.firmId) {
      // Check admin role for cross-resident cancels
      try {
        await requireAdmin(ctx, args.userEmail);
      } catch {
        throw new Error("Not authorized to cancel this booking");
      }
    }
    await ctx.db.patch(args.bookingId, { status: "cancelled", updatedAt: Date.now() });
  },
});

// ════════════════════════════════════════════════════════════════════════
// ESTATE BULLETIN (admin CRUD, resident read)
// ════════════════════════════════════════════════════════════════════════

export const createBulletin = mutation({
  args: {
    firmId: v.string(),
    title: v.string(),
    body: v.string(),
    category: v.optional(v.string()),
    eventDate: v.optional(v.number()),
    eventLocation: v.optional(v.string()),
    eventEndDate: v.optional(v.number()),
    propertyIds: v.optional(v.array(v.string())),
    isPinned: v.optional(v.boolean()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAdmin(ctx, args.userEmail);
    const firmId = auth.firmId || args.firmId;
    const now = Date.now();
    return await ctx.db.insert("estate_bulletins", {
      firmId,
      authorId: auth.userId,
      authorName: auth.user?.name || undefined,
      title: args.title,
      body: args.body,
      category: args.category || "announcement",
      eventDate: args.eventDate,
      eventLocation: args.eventLocation,
      eventEndDate: args.eventEndDate,
      propertyIds: args.propertyIds,
      isPinned: args.isPinned ?? false,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateBulletin = mutation({
  args: {
    bulletinId: v.id("estate_bulletins"),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    category: v.optional(v.string()),
    eventDate: v.optional(v.number()),
    eventLocation: v.optional(v.string()),
    eventEndDate: v.optional(v.number()),
    propertyIds: v.optional(v.array(v.string())),
    isPinned: v.optional(v.boolean()),
    status: v.optional(v.string()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAdmin(ctx, args.userEmail);
    const bulletin = await ctx.db.get(args.bulletinId);
    if (!bulletin) throw new Error("Bulletin not found");
    if (bulletin.firmId !== auth.firmId) throw new Error("Not authorized");
    const { bulletinId, userEmail, ...updates } = args;
    const cleanUpdates: Record<string, any> = { updatedAt: Date.now() };
    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined) cleanUpdates[k] = v;
    }
    await ctx.db.patch(args.bulletinId, cleanUpdates);
  },
});

export const archiveBulletin = mutation({
  args: { bulletinId: v.id("estate_bulletins"), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const auth = await requireAdmin(ctx, args.userEmail);
    const bulletin = await ctx.db.get(args.bulletinId);
    if (!bulletin) throw new Error("Bulletin not found");
    if (bulletin.firmId !== auth.firmId) throw new Error("Not authorized");
    await ctx.db.patch(args.bulletinId, { status: "archived", updatedAt: Date.now() });
  },
});

// ════════════════════════════════════════════════════════════════════════
// SERVICE PROVIDERS (admin CRUD, resident read)
// ════════════════════════════════════════════════════════════════════════

export const createServiceProvider = mutation({
  args: {
    firmId: v.string(),
    name: v.string(),
    category: v.string(),
    specialty: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    whatsapp: v.optional(v.string()),
    address: v.optional(v.string()),
    serviceArea: v.optional(v.string()),
    rating: v.optional(v.number()),
    isVerified: v.boolean(),
    notes: v.optional(v.string()),
    isActive: v.boolean(),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAdmin(ctx, args.userEmail);
    const firmId = auth.firmId || args.firmId;
    const now = Date.now();
    return await ctx.db.insert("estate_service_providers", {
      firmId,
      name: args.name,
      category: args.category,
      specialty: args.specialty,
      phone: args.phone,
      email: args.email,
      whatsapp: args.whatsapp,
      address: args.address,
      serviceArea: args.serviceArea,
      rating: args.rating,
      isVerified: args.isVerified,
      notes: args.notes,
      isActive: args.isActive,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateServiceProvider = mutation({
  args: {
    providerId: v.id("estate_service_providers"),
    name: v.optional(v.string()),
    category: v.optional(v.string()),
    specialty: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    whatsapp: v.optional(v.string()),
    address: v.optional(v.string()),
    serviceArea: v.optional(v.string()),
    rating: v.optional(v.number()),
    isVerified: v.optional(v.boolean()),
    notes: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAdmin(ctx, args.userEmail);
    const provider = await ctx.db.get(args.providerId);
    if (!provider) throw new Error("Service provider not found");
    if (provider.firmId !== auth.firmId) throw new Error("Not authorized");
    const { providerId, userEmail, ...updates } = args;
    const cleanUpdates: Record<string, any> = { updatedAt: Date.now() };
    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined) cleanUpdates[k] = v;
    }
    await ctx.db.patch(args.providerId, cleanUpdates);
  },
});

export const deleteServiceProvider = mutation({
  args: { providerId: v.id("estate_service_providers"), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const auth = await requireAdmin(ctx, args.userEmail);
    const provider = await ctx.db.get(args.providerId);
    if (!provider) throw new Error("Service provider not found");
    if (provider.firmId !== auth.firmId) throw new Error("Not authorized");
    // Soft-delete (preserve historical references)
    await ctx.db.patch(args.providerId, { isActive: false, updatedAt: Date.now() });
  },
});

// ════════════════════════════════════════════════════════════════════════
// QUERIES (resident-facing + admin-facing)
// ════════════════════════════════════════════════════════════════════════

// Get all amenities for a firm (resident view — only active)
export const getAmenities = query({
  args: { firmId: v.string(), includeInactive: v.optional(v.boolean()), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireFirmUser(ctx, args.userEmail);
    let q = ctx.db
      .query("estate_amenities")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId));
    const all = await q.collect();
    return args.includeInactive ? all : all.filter((a) => a.isActive);
  },
});

// Get bookings for a resident
export const getBookingsForResident = query({
  args: { firmId: v.string(), residentUserId: v.string(), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail);
    // Resident can only see their own bookings unless admin/founder
    const isAdmin = auth.user?.role === "Admin" || auth.user?.role === "Founder";
    const targetResidentId = (args.residentUserId === auth.userId) || isAdmin
      ? args.residentUserId
      : auth.userId;
    return await ctx.db
      .query("estate_amenity_bookings")
      .withIndex("by_resident", (q) => q.eq("residentUserId", targetResidentId))
      .collect();
  },
});

// Get all bookings for a firm (admin view — for approval queue)
export const getBookingsForFirm = query({
  args: { firmId: v.string(), status: v.optional(v.string()), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.userEmail);
    let q = ctx.db
      .query("estate_amenity_bookings")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId));
    const all = await q.collect();
    return args.status ? all.filter((b) => b.status === args.status) : all;
  },
});

// Get active bulletins for a firm (resident view)
export const getBulletins = query({
  args: { firmId: v.string(), propertyId: v.optional(v.string()), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireFirmUser(ctx, args.userEmail);
    const all = await ctx.db
      .query("estate_bulletins")
      .withIndex("by_firm_status", (q) => q.eq("firmId", args.firmId).eq("status", "active"))
      .collect();
    // Filter by property scope — show estate-wide + scoped to this property
    if (!args.propertyId) return all;
    return all.filter((b) => {
      if (!b.propertyIds || b.propertyIds.length === 0) return true; // estate-wide
      return b.propertyIds.includes(args.propertyId as any);
    });
  },
});

// Get active service providers for a firm (resident view)
export const getServiceProviders = query({
  args: { firmId: v.string(), category: v.optional(v.string()), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireFirmUser(ctx, args.userEmail);
    let q = ctx.db
      .query("estate_service_providers")
      .withIndex("by_firm_active", (q) => q.eq("firmId", args.firmId).eq("isActive", true));
    const all = await q.collect();
    if (args.category) {
      return all.filter((p) => p.category === args.category);
    }
    return all;
  },
});

// Get a single service provider (resident view — strips internal notes)
export const getServiceProvider = query({
  args: { providerId: v.id("estate_service_providers"), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireFirmUser(ctx, args.userEmail);
    const provider = await ctx.db.get(args.providerId);
    if (!provider || !provider.isActive) return null;
    // Strip internal admin notes from resident view
    const { notes, ...publicFields } = provider as any;
    return publicFields;
  },
});
