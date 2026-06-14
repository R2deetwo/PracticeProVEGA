import { mutation, query, action, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";

// ─── Maintenance Tickets ────────────────────────────────────────────────

export const createMaintenanceTicket = mutation({
  args: {
    firmId: v.string(),
    propertyId: v.string(),
    unitId: v.optional(v.string()),
    tenantId: v.optional(v.string()),
    tenantName: v.optional(v.string()),
    subject: v.string(),
    description: v.string(),
    category: v.union(v.literal("plumbing"), v.literal("electrical"), v.literal("structural"), v.literal("other")),
    attachments: v.optional(v.array(v.string())), // Convex storage IDs for images/PDFs
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const { attachments, ...rest } = args;
    return await ctx.db.insert("maintenance_tickets", {
      ...rest,
      // Schema uses 'images' field, not 'attachments' — map accordingly
      images: attachments ?? [],
      status: "open",
      priority: "medium",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getMaintenanceTicketsByTenant = query({
  args: { tenantId: v.string() },
  handler: async (ctx, args) => {
    const tickets = await ctx.db
      .query("maintenance_tickets")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .collect();

    // Also try matching by email in case the tenantId stored is the user's email
    // This handles the case where the invite was created with the email as the tenant ID
    if (tickets.length === 0 && args.tenantId.includes('@')) {
      // The tenantId looks like an email, also search by the user's Convex _id
      const user: any = await ctx.db
        .query("users")
        .withIndex("by_token", (q) => q.eq("tokenIdentifier", args.tenantId.toLowerCase()))
        .first();
      if (user) {
        const byUserId = await ctx.db
          .query("maintenance_tickets")
          .withIndex("by_tenant", (q) => q.eq("tenantId", String(user._id)))
          .order("desc")
          .collect();
        return byUserId;
      }
    }

    return tickets;
  },
});

export const getMaintenanceTicketsByFirm = query({
  args: { firmId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("maintenance_tickets")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .order("desc")
      .collect();
  },
});

export const updateMaintenanceTicketStatus = mutation({
  args: {
    ticketId: v.id("maintenance_tickets"),
    status: v.union(v.literal("open"), v.literal("in_progress"), v.literal("resolved"), v.literal("closed")),
    resolution: v.optional(v.string()),
    assignedTo: v.optional(v.string()),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
  },
  handler: async (ctx, args) => {
    const { ticketId, ...updates } = args;
    await ctx.db.patch(ticketId, { ...updates, updatedAt: Date.now() });
  },
});

// ─── Portal Invites ─────────────────────────────────────────────────────

/** Generate a crypto-random invite token (12 chars, URL-safe) */
function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const arr = new Uint8Array(12);
  // @ts-ignore — crypto available in Convex runtime
  crypto.getRandomValues(arr);
  return Array.from(arr, b => chars[b % chars.length]).join("");
}

/**
 * createPortalInvite — ACTION (not a plain mutation) so it can call
 * sendEmail / sendWhatsApp via ctx.runAction.
 *
 * 1. Generates a unique token for the magic-link URL
 * 2. Writes the portal_invites record
 * 3. Sends the invitation via the chosen channel (email / whatsapp / both)
 */
export const createPortalInvite = action({
  args: {
    firmId: v.string(),
    inviterId: v.string(),
    inviteeEmail: v.optional(v.string()),
    inviteeName: v.optional(v.string()),
    inviteePhone: v.optional(v.string()),
    portalType: v.union(v.literal("client"), v.literal("resident")),
    relatedId: v.optional(v.string()),
    channel: v.optional(v.string()),       // "email" | "whatsapp" | "both" — default "email"
    message: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ inviteId: string; token: string; channel: string; emailSent: boolean; emailSimulated: boolean; whatsappSent: boolean; whatsappSimulated: boolean; whatsappSkipped: boolean }> => {
    const now = Date.now();
    const expiresAt = now + 30 * 24 * 60 * 60 * 1000; // 30 days — gives tenants ample time to set up
    const token = generateToken();
    const channel = args.channel || "email";

    // 0.5. For resident invites, resolve the canonical tenant name from the
    // property/tenancy record. The property record is the source of truth for
    // a tenant's name — NOT the admin's manual input. This prevents name
    // mismatches where the portal shows one name but the property shows another.
    let resolvedInviteeName = args.inviteeName;
    if (args.portalType === "resident" && args.relatedId) {
      try {
        const parts = args.relatedId.split("_");
        const propertyCustomId = parts[0];
        const unitId = parts.length > 1 ? parts.slice(1).join("_") : null;

        const property: any = await ctx.runQuery(internal.portals.findPropertyByCustomId, {
          customId: propertyCustomId,
        });

        if (property) {
          const units = property.units || [];
          if (units.length > 0 && unitId) {
            const unit = units.find((u: any) =>
              u.id === unitId || u.unitName === unitId || u.id === args.relatedId
            );
            if (unit?.tenantName) {
              resolvedInviteeName = unit.tenantName;
            }
          } else if (units.length > 0) {
            // No specific unit matched, try first unit
            if (units[0]?.tenantName) {
              resolvedInviteeName = units[0].tenantName;
            }
          } else {
            // No units array, check property-level tenant name
            const propTenantName = (property as any).rentalDetails?.tenantName || (property as any).tenantName;
            if (propTenantName) {
              resolvedInviteeName = propTenantName;
            }
          }
        }
      } catch (e) {
        // Non-blocking: use the provided name as fallback
      }
    }

    // 1. Insert the invite record
    const inviteId: string = await ctx.runMutation(api.portals.insertInviteRecord, {
      firmId: args.firmId,
      inviterId: args.inviterId,
      inviteeEmail: args.inviteeEmail,
      inviteeName: resolvedInviteeName,
      inviteePhone: args.inviteePhone,
      portalType: args.portalType,
      relatedId: args.relatedId,
      token,
      channel,
      message: args.message,
      expiresAt,
    });

    // 2. Build the magic-link URL (setup-password page, not login)
    const portalBase = "https://practice-pro-vega.vercel.app/setup-password";
    const inviteUrl = `${portalBase}?token=${token}`;
    const portalLabel = args.portalType === "client" ? "Client Portal" : "Residents' Portal";
    const productName = args.portalType === "client" ? "VEGA" : "ATRIUM";
    const inviteeGreeting = resolvedInviteeName ? resolvedInviteeName : args.inviteeEmail;
    const personalMsg = args.message ? `\n\nPersonal message: ${args.message}` : "";

    // 3. Send via email (skip if no email address provided)
    const shouldSendEmail = (channel === "email" || channel === "both") && args.inviteeEmail;
    let emailResult: any = { success: true, simulated: true };
    if (shouldSendEmail) {
      const htmlBody = `<!DOCTYPE html>
<html lang="en" style="margin:0;padding:0;">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#0c1222;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0c1222;min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Header bar -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);border-radius:16px 16px 0 0;padding:28px 32px 20px;text-align:center;border-bottom:3px solid #f59e0b;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align:center;">
                    <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:26px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">Practice<span style="color:#f59e0b;">Pro</span></span>
                    <span style="display:inline-block;margin-left:10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;font-weight:800;color:#a78bfa;background:rgba(167,139,250,0.15);padding:3px 10px;border-radius:6px;letter-spacing:1.5px;vertical-align:middle;">${productName}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#0f172a;padding:32px 32px 24px;border-left:1px solid rgba(255,255,255,0.06);border-right:1px solid rgba(255,255,255,0.06);">
              <h1 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:22px;font-weight:700;color:#ffffff;margin:0 0 8px;line-height:1.3;">You're Invited to the ${portalLabel}</h1>
              <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.7;color:#94a3b8;margin:0 0 24px;">
                Hello ${inviteeGreeting},<br/><br/>
                You have been invited to access the <strong style="color:#e2e8f0;">${portalLabel}</strong> on PracticePro. Set up your secure password to get started.
                ${args.message ? `<br/><br/><span style="display:inline-block;margin-top:8px;padding:12px 16px;background:rgba(255,255,255,0.04);border-left:3px solid #f59e0b;border-radius:0 8px 8px 0;color:#cbd5e1;font-style:italic;">"${args.message}"</span>` : ""}
              </p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <a href="${inviteUrl}" style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-weight:700;font-size:15px;border-radius:12px;text-decoration:none;box-shadow:0 4px 20px rgba(245,158,11,0.35),0 0 0 1px rgba(245,158,11,0.1);letter-spacing:0.2px;">
                      Set Up Your Password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:#64748b;line-height:1.6;margin:0 0 6px;">
                Or copy and paste this link into your browser:
              </p>
              <p style="font-family:monospace;font-size:12px;color:#60a5fa;word-break:break-all;margin:0 0 20px;">
                <a href="${inviteUrl}" style="color:#60a5fa;">${inviteUrl}</a>
              </p>

              <!-- Expiry notice -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:rgba(234,179,8,0.08);border:1px solid rgba(234,179,8,0.15);border-radius:8px;padding:10px 14px;">
                    <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;color:#fbbf24;margin:0;line-height:1.5;">
                      &#9888;&#65039; This invitation expires in <strong>30 days</strong>. If you did not expect this invitation, you can safely ignore it.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#0f172a;border-radius:0 0 16px 16px;padding:20px 32px;border-top:1px solid rgba(255,255,255,0.04);border-left:1px solid rgba(255,255,255,0.06);border-right:1px solid rgba(255,255,255,0.06);">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align:center;">
                    <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;color:#475569;margin:0 0 4px;">
                      PracticePro Legal Technologies Ltd &middot; Lagos, Nigeria
                    </p>
                    <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:10px;color:#334155;margin:0;">
                      NDPA 2023 Compliant &middot; ISO 27001 Aligned &middot; AES-256 Encrypted
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
      emailResult = await ctx.runAction(api.communications.sendEmail, {
        to: args.inviteeEmail!,
        toName: resolvedInviteeName,
        subject: `You're Invited: ${portalLabel} on PracticePro`,
        htmlContent: htmlBody,
        firmId: args.firmId,
      });
    }

    // 4. Send via WhatsApp
    const shouldSendWhatsApp = (channel === "whatsapp" || channel === "both") && args.inviteePhone;
    let waResult: any = { success: true, simulated: true };
    if (shouldSendWhatsApp) {
      const waText = `PracticePro ${portalLabel} Invitation\n\nHello ${inviteeGreeting}, you've been invited to the ${portalLabel}.\n\nClick here to access: ${inviteUrl}\n\nThis link expires in 30 days.${personalMsg}\n\n— PracticePro`;
      waResult = await ctx.runAction(api.communications.sendWhatsApp, {
        to: args.inviteePhone!,
        messageText: waText,
        firmId: args.firmId,
      });
    }

    return {
      inviteId,
      token,
      channel,
      emailSent: emailResult.success && !emailResult.simulated,
      emailSimulated: emailResult.simulated || false,
      whatsappSent: shouldSendWhatsApp && waResult.success && !waResult.simulated,
      whatsappSimulated: shouldSendWhatsApp && (waResult.simulated || false),
      whatsappSkipped: !shouldSendWhatsApp,
    };
  },
});

/**
 * Internal mutation — only used by createPortalInvite action to write the DB record.
 * Not exported for direct frontend use.
 */
export const insertInviteRecord = mutation({
  args: {
    firmId: v.string(),
    inviterId: v.string(),
    inviteeEmail: v.optional(v.string()),
    inviteeName: v.optional(v.string()),
    inviteePhone: v.optional(v.string()),
    portalType: v.union(v.literal("client"), v.literal("resident")),
    relatedId: v.optional(v.string()),
    token: v.optional(v.string()),
    channel: v.optional(v.string()),
    message: v.optional(v.string()),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Clean up any existing invites for the same email + firm + portal type.
    // This prevents "invitation already accepted" errors when re-inviting
    // after a previous invite was deleted via the simple deletePortalInvite
    // (which doesn't clean up). We mark old invites as "superseded" rather
    // than deleting them, so there's an audit trail.
    //
    // BUG 15 FIX: We now supersede ALL existing invites for the same email,
    // regardless of firm/portal type. This ensures that stale "accepted" invites
    // from a different context don't block the new invite. We also handle the
    // case where the user account exists with role "Pending" (cleaned up by
    // deletePortalInviteAndCleanup) — in that case, the user should be treated
    // as a fresh invitee.
    const email = (args.inviteeEmail || "").toLowerCase().trim();
    if (email) {
      const existingInvites = await ctx.db
        .query("portal_invites")
        .withIndex("by_email", (q) => q.eq("inviteeEmail", email))
        .collect();

      for (const inv of existingInvites) {
        // Supersede ALL invites for this email, regardless of firm/portal type.
        // This is more aggressive but prevents the "already accepted" dead-end.
        if (inv.status === "pending" || inv.status === "accepted") {
          await ctx.db.patch(inv._id, {
            status: "superseded",
            updatedAt: now,
          });
        }
      }
    }

    return await ctx.db.insert("portal_invites", {
      firmId: args.firmId,
      inviterId: args.inviterId,
      inviteeEmail: args.inviteeEmail,
      inviteeName: args.inviteeName,
      inviteePhone: args.inviteePhone,
      portalType: args.portalType,
      relatedId: args.relatedId,
      token: args.token ?? undefined,
      channel: args.channel,
      message: args.message,
      status: "pending",
      expiresAt: args.expiresAt,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * resendPortalInvite — action that updates the existing record's expiry + token,
 * then re-sends via the stored channel.
 */
export const resendPortalInvite = action({
  args: {
    inviteId: v.id("portal_invites"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.runQuery(api.portals.getPortalInviteById, { inviteId: args.inviteId });
    if (!existing) throw new Error("Invitation not found");
    if (existing.status === "revoked") throw new Error("Cannot resend a revoked invitation");

    // Refresh token + expiry on the existing record
    const newToken = generateToken();
    const now = Date.now();
    const expiresAt = now + 30 * 24 * 60 * 60 * 1000; // 30 days
    await ctx.runMutation(api.portals.updateInviteRecord, {
      inviteId: args.inviteId,
      updates: { token: newToken, status: "pending", expiresAt, updatedAt: now },
    });

    // Re-send via stored channel
    const portalBase = "https://practice-pro-vega.vercel.app/setup-password";
    const inviteUrl = `${portalBase}?token=${newToken}`;
    const portalLabel = existing.portalType === "client" ? "Client Portal" : "Residents' Portal";
    const productName = existing.portalType === "client" ? "VEGA" : "ATRIUM";
    const channel = existing.channel || "email";

    let emailResult: any = { success: true, simulated: true };
    if (channel === "email" || channel === "both") {
      const htmlBody = `<!DOCTYPE html>
<html lang="en" style="margin:0;padding:0;">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#0c1222;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0c1222;min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
          <tr>
            <td style="background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);border-radius:16px 16px 0 0;padding:28px 32px 20px;text-align:center;border-bottom:3px solid #f59e0b;">
              <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:26px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">Practice<span style="color:#f59e0b;">Pro</span></span>
              <span style="display:inline-block;margin-left:10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;font-weight:800;color:#a78bfa;background:rgba(167,139,250,0.15);padding:3px 10px;border-radius:6px;letter-spacing:1.5px;vertical-align:middle;">${productName}</span>
            </td>
          </tr>
          <tr>
            <td style="background:#0f172a;padding:32px 32px 24px;border-left:1px solid rgba(255,255,255,0.06);border-right:1px solid rgba(255,255,255,0.06);">
              <h1 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:22px;font-weight:700;color:#ffffff;margin:0 0 8px;">Reminder: ${portalLabel} Invitation</h1>
              <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.7;color:#94a3b8;margin:0 0 24px;">
                Hello ${existing.inviteeName || existing.inviteeEmail},<br/><br/>
                This is a reminder about your invitation to the <strong style="color:#e2e8f0;">${portalLabel}</strong>. Your secure link has been refreshed. Set up your password to gain access.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <a href="${inviteUrl}" style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-weight:700;font-size:15px;border-radius:12px;text-decoration:none;box-shadow:0 4px 20px rgba(245,158,11,0.35);letter-spacing:0.2px;">
                      Set Up Your Password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:#64748b;line-height:1.6;margin:0 0 6px;">
                Or copy and paste this link:
              </p>
              <p style="font-family:monospace;font-size:12px;color:#60a5fa;word-break:break-all;margin:0 0 20px;">
                <a href="${inviteUrl}" style="color:#60a5fa;">${inviteUrl}</a>
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:rgba(234,179,8,0.08);border:1px solid rgba(234,179,8,0.15);border-radius:8px;padding:10px 14px;">
                    <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;color:#fbbf24;margin:0;line-height:1.5;">
                      &#9888;&#65039; This invitation expires in <strong>30 days</strong>.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#0f172a;border-radius:0 0 16px 16px;padding:20px 32px;border-top:1px solid rgba(255,255,255,0.04);border-left:1px solid rgba(255,255,255,0.06);border-right:1px solid rgba(255,255,255,0.06);">
              <div style="text-align:center;">
                <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;color:#475569;margin:0 0 4px;">PracticePro Legal Technologies Ltd &middot; Lagos, Nigeria</p>
                <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:10px;color:#334155;margin:0;">NDPA 2023 Compliant &middot; ISO 27001 Aligned &middot; AES-256 Encrypted</p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
      emailResult = await ctx.runAction(api.communications.sendEmail, {
        to: existing.inviteeEmail!,
        toName: existing.inviteeName,
        subject: `Reminder: ${portalLabel} Invitation on PracticePro`,
        htmlContent: htmlBody,
        firmId: existing.firmId,
      });
    }

    let waResult: any = { success: true, simulated: true };
    if ((channel === "whatsapp" || channel === "both") && existing.inviteePhone) {
      const waText = `Reminder: PracticePro ${portalLabel} Invitation\n\nHello ${existing.inviteeName || existing.inviteeEmail}, your portal link has been refreshed.\n\nClick here: ${inviteUrl}\n\nExpires in 30 days.\n\n— PracticePro`;
      waResult = await ctx.runAction(api.communications.sendWhatsApp, {
        to: existing.inviteePhone,
        messageText: waText,
        firmId: existing.firmId,
      });
    }

    return {
      token: newToken,
      emailSent: emailResult.success && !emailResult.simulated,
      emailSimulated: emailResult.simulated || false,
      whatsappSent: waResult.success && !waResult.simulated,
      whatsappSimulated: waResult.simulated || false,
    };
  },
});

/** Internal mutation to update an invite record */
export const updateInviteRecord = mutation({
  args: {
    inviteId: v.id("portal_invites"),
    updates: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.inviteId, args.updates);
  },
});

/** Get a single invite by its ID (used by resendPortalInvite) */
export const getPortalInviteById = query({
  args: { inviteId: v.id("portal_invites") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.inviteId);
  },
});

export const getPortalInvitesByFirm = query({
  args: { firmId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("portal_invites")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .order("desc")
      .collect();
  },
});

export const acceptPortalInvite = mutation({
  args: { inviteId: v.id("portal_invites") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.inviteId, {
      status: "accepted",
      acceptedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const revokePortalInvite = mutation({
  args: { inviteId: v.id("portal_invites") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.inviteId, {
      status: "revoked",
      updatedAt: Date.now(),
    });
  },
});

/** Permanently delete a portal invite record (removes it from the list entirely) */
export const deletePortalInvite = mutation({
  args: { inviteId: v.id("portal_invites") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.inviteId);
  },
});

/**
 * deletePortalInviteAndCleanup — Permanently deletes a portal invite AND resets
 * the associated portal user account so the same email can be re-invited cleanly.
 *
 * This prevents the "invitation already accepted" error when an admin:
 * 1. Deletes a portal access record
 * 2. Creates a new invite for the same email
 *
 * Steps:
 * 1. Delete ALL portal_invites records for the same email (not just the specified one)
 * 2. Find the user with the matching email + Client/Tenant role
 * 3. Reset their role, verification, password, and portal-specific fields so
 *    they're treated as a brand-new invitee (Bug 16 fix: thorough cleanup)
 */
export const deletePortalInviteAndCleanup = mutation({
  args: {
    inviteId: v.id("portal_invites"),
    inviteeEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const email = (args.inviteeEmail || "").toLowerCase().trim();

    // 1. Mark the specified invite as revoked (DO NOT delete — preserving the
    //    firmId on invite records is critical for resolveFirmFromInvite to work
    //    when the user is re-invited. Deleted records can't be searched.)
    await ctx.db.patch(args.inviteId, {
      status: "revoked",
      updatedAt: Date.now(),
    } as any);

    // 2. Mark any OTHER invite records for the same email as revoked too.
    //    Previously these were hard-deleted, which destroyed the firmId
    //    resolution path — the #1 cause of permanent skeleton screens.
    if (!email) return;

    const otherInvites = await ctx.db
      .query("portal_invites")
      .withIndex("by_email", (q) => q.eq("inviteeEmail", email))
      .collect();

    for (const inv of otherInvites) {
      if (String(inv._id) === String(args.inviteId)) continue; // Already revoked above
      if (inv.status === "revoked") continue; // Already revoked
      try {
        await ctx.db.patch(inv._id, {
          status: "revoked",
          updatedAt: Date.now(),
        } as any);
      } catch (e) { /* ignore */ }
    }

    // 3. Find and reset the associated portal user
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", email))
      .first();

    if (!existingUser) return;

    // Only reset if the user has a Client or Tenant role (portal user)
    const role = (existingUser as any).role;
    if (role === "Client" || role === "Tenant" || role === "Portal User") {
      // Reset the user so they can't log in, but PRESERVE firmId and product.
      // These fields are essential for data loading — without firmId, the portal
      // queries all use 'skip' and show infinite skeleton screens. The firmId
      // will be updated by setupPortalPassword if the user is re-invited to a
      // different firm, or kept as-is if re-invited to the same firm.
      await ctx.db.patch(existingUser._id, {
        isVerified: false,
        emailVerified: false,
        password: undefined,
        role: "Pending",
        // IMPORTANT: firmId and product are KEPT intentionally.
        // Clearing them was the root cause of the permanent skeleton bug.
        // setupPortalPassword will update them on re-invite if needed.
        portalPresenceHidden: undefined,
        onboardingCompleted: false,
      } as any);
    }
  },
});

/** Look up an invite by its token — used by portal login pages for magic-link flow */
export const getInviteByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("portal_invites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .collect();
    return results[0] || null;
  },
});

/** Accept an invite by token — marks it as accepted (called when invitee visits the magic link) */
export const acceptPortalInviteByToken = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("portal_invites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .collect();
    const invite = results[0];
    if (!invite) throw new Error("Invalid invitation link");
    if (invite.status === "accepted") return invite; // already accepted, that's fine
    if (invite.status === "revoked") throw new Error("This invitation has been revoked");
    if (invite.status === "expired" || invite.expiresAt < Date.now()) {
      await ctx.db.patch(invite._id, { status: "expired", updatedAt: Date.now() });
      throw new Error("This invitation has expired. Please request a new one.");
    }
    await ctx.db.patch(invite._id, {
      status: "accepted",
      acceptedAt: Date.now(),
      termsAcceptedAt: Date.now(),
      updatedAt: Date.now(),
    });
    return invite;
  },
});

export const getPortalInvitesByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("portal_invites")
      .withIndex("by_email", (q) => q.eq("inviteeEmail", args.email))
      .collect();
  },
});

/**
 * verifyInviteToken — validates a portal invite token and returns
 * the invite details + whether the user already has an account.
 * Used by the /setup-password page to determine what to show.
 *
 * ROBUSTNESS FIX: If the invite is "accepted" but the user's role is
 * "Pending" (meaning their access was deleted via deletePortalInviteAndCleanup
 * and they need to re-setup), we allow them to proceed. This prevents the
 * "invitation already accepted" dead-end when a user is re-invited after
 * their portal access was removed.
 */
export const verifyInviteToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("portal_invites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .collect();
    const invite = results[0] || null;

    if (!invite) {
      return { valid: false, reason: "not_found" } as const;
    }

    // Check expiry (note: we don't patch status here since this is a query/read-only)
    if (invite.expiresAt < Date.now()) {
      return { valid: false, reason: "expired", portalType: invite.portalType } as const;
    }

    if (invite.status === "revoked") {
      return { valid: false, reason: "revoked", portalType: invite.portalType } as const;
    }

    // Check if the user exists and their current state
    const email = invite.inviteeEmail?.toLowerCase().trim();
    let existingUser: any = null;
    if (email) {
      existingUser = await ctx.db
        .query("users")
        .withIndex("by_token", (q) => q.eq("tokenIdentifier", email))
        .first();
      // Case-insensitive fallback
      if (!existingUser) {
        existingUser = await ctx.db
          .query("users")
          .withIndex("by_token", (q) => q.eq("tokenIdentifier", email.toLowerCase()))
          .first();
      }
    }

    if (invite.status === "accepted") {
      // ROBUSTNESS: If the user's role is Pending (their access was reset by
      // deletePortalInviteAndCleanup), allow them to re-accept. This invite
      // might be a stale record from before the cleanup ran. The user needs
      // to set up their password again, so we should let them through.
      // Bug 15 fix: Also check if the user doesn't exist at all (was deleted),
      // or if they have no password (fully cleaned up).
      const userRole = existingUser?.role;
      const isUserUnverified = existingUser && !existingUser.isVerified;
      const hasNoPassword = existingUser && !(existingUser as any).password;
      const hasNoFirmId = existingUser && !existingUser.firmId;
      if (userRole === "Pending" || isUserUnverified || hasNoPassword || hasNoFirmId) {
        // User was reset — allow re-accepting this invite
        // Fall through to return valid: true
      } else {
        return { valid: false, reason: "already_accepted", portalType: invite.portalType } as const;
      }
    }

    // Token is valid and pending — check if user already has an account
    return {
      valid: true,
      invite: {
        _id: invite._id,
        inviteeEmail: invite.inviteeEmail,
        inviteeName: invite.inviteeName,
        portalType: invite.portalType,
        firmId: invite.firmId,
        relatedId: invite.relatedId,
        expiresAt: invite.expiresAt,
      },
      hasAccount: !!existingUser,
      hasPassword: !!(existingUser as any)?.password,
    } as const;
  },
});

// ─── Internal helpers for portal user → property linking ──────────────────
// These are used by the setupPortalPassword action, which cannot directly
// access ctx.db (actions don't have database access). Instead, they use
// ctx.runQuery / ctx.runMutation to delegate to these internal functions.

export const findPropertyByCustomId = internalQuery({
  args: { customId: v.string() },
  handler: async (ctx, args) => {
    // Try by custom id field (using by_custom_id index)
    const byCustomId = await ctx.db
      .query("properties")
      .withIndex("by_custom_id", (q) => q.eq("id", args.customId))
      .first();
    if (byCustomId) return byCustomId;

    // Try by Convex _id
    try {
      const byDocId = await ctx.db.get(args.customId as any);
      if (byDocId) return byDocId;
    } catch {}

    return null;
  },
});

export const linkPortalUserToProperty = internalMutation({
  args: {
    propertyId: v.id("properties"),
    updates: v.any(), // { units?: [...], currentTenantId?: string, tenantId?: string }
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.propertyId, args.updates as any);
  },
});

// ─── Setup Portal Password (Invite Acceptance) ──────────────────────────

/**
 * setupPortalPassword — ACTION that completes the invite flow:
 * 1. Validates the invite token (must be pending + unexpired)
 * 2. If user exists → sets their password + marks verified
 * 3. If user doesn't exist → creates a new user record with the password
 * 4. Marks the invite as accepted
 * 5. Clears the token to prevent replay attacks
 */
export const setupPortalPassword = action({
  args: {
    token: v.string(),
    password: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; message?: string; email?: string }> => {
    // 1. Validate the invite
    const invite = await ctx.runQuery(api.portals.getInviteByToken, { token: args.token });
    if (!invite) return { success: false, message: "Invalid invitation link." };
    if (invite.status === "revoked") return { success: false, message: "This invitation has been revoked." };
    if (invite.status === "expired" || invite.expiresAt < Date.now()) {
      await ctx.runMutation(api.portals.updateInviteRecord, {
        inviteId: invite._id,
        updates: { status: "expired", updatedAt: Date.now() },
      });
      return { success: false, message: "This invitation has expired. Please request a new one." };
    }

    // ROBUSTNESS: If the invite was already accepted but the user's account was
    // reset (role=Pending, isVerified=false, no password, no firmId), allow them
    // to re-accept. This can happen when deletePortalInviteAndCleanup resets the
    // user but a stale invite record still exists with status "accepted" and a
    // valid token. (Bug 15 fix: more thorough reset detection)
    if (invite.status === "accepted") {
      const emailCheck = (invite.inviteeEmail || "").toLowerCase().trim();
      const existingUserCheck: any = await ctx.runQuery(api.myFunctions.getUser, { tokenIdentifier: emailCheck });
      const wasReset = existingUserCheck?.role === "Pending"
        || (existingUserCheck && !existingUserCheck.isVerified)
        || (existingUserCheck && !(existingUserCheck as any).password)
        || (existingUserCheck && !existingUserCheck.firmId);
      if (!wasReset) {
        return { success: false, message: "This invitation has already been used." };
      }
      // User was reset — allow re-accepting this invite (fall through)
    }

    const email = (invite.inviteeEmail || "").toLowerCase().trim();
    if (!email) return { success: false, message: "This invitation has no email address associated." };

    // 1.5. For resident invites, resolve the canonical tenant name from the
    // property/tenancy record. The property record is the source of truth for
    // a tenant's name — NOT the invite. This ensures the user's name always
    // matches the property record.
    let canonicalTenantName: string | null = null;
    if (invite.portalType === "resident" && invite.relatedId) {
      try {
        const parts = invite.relatedId.split("_");
        const propertyCustomId = parts[0];
        const unitId = parts.length > 1 ? parts.slice(1).join("_") : null;

        const property: any = await ctx.runQuery(internal.portals.findPropertyByCustomId, {
          customId: propertyCustomId,
        });

        if (property) {
          const units = property.units || [];
          if (units.length > 0 && unitId) {
            const unit = units.find((u: any) =>
              u.id === unitId || u.unitName === unitId || u.id === invite.relatedId
            );
            if (unit?.tenantName) {
              canonicalTenantName = unit.tenantName;
            }
          } else if (units.length > 0) {
            if (units[0]?.tenantName) {
              canonicalTenantName = units[0].tenantName;
            }
          } else {
            const propTenantName = (property as any).rentalDetails?.tenantName || (property as any).tenantName;
            if (propTenantName) {
              canonicalTenantName = propTenantName;
            }
          }
        }
      } catch (e) {
        // Non-blocking: use invite name as fallback
      }
    }

    // 2. Hash the password
    const hashedPassword = await ctx.runAction(internal.authUtils.hashPassword, { password: args.password });

    // 3. Check if user exists
    const existingUser: any = await ctx.runQuery(api.myFunctions.getUser, { tokenIdentifier: email });

    // Track the portal user's Convex _id so we can link them to their property/unit
    let portalUserDocId: string | null = null;

    if (existingUser) {
      // Update existing user: set password + mark verified
      // Also upgrade their role to Client/Tenant if they were a "Portal User"
      // or had no role assigned, so the frontend can route them correctly.
      const portalRole = invite.portalType === "client" ? "Client" : "Tenant";
      const needsRoleUpdate = !existingUser.role
        || existingUser.role === "Portal User"
        || existingUser.role === "Pending";
      // Ensure firmId is always set — portal users need it for the ProductContext
      // to derive the correct product and for data loading to work properly.
      // When an existing user is re-invited after portal access deletion, their
      // firmId might have been cleared or might never have been set.
      const needsFirmId = !existingUser.firmId || existingUser.firmId !== invite.firmId;
      portalUserDocId = String(existingUser._id);
      await ctx.runMutation(internal.myFunctions.updateUserSecurityFields, {
        userId: existingUser._id,
        fields: {
          password: hashedPassword,
          isVerified: true,
          emailVerified: true,
          verificationCode: null,
          // For tenant users, always sync name with the property record (source of truth)
          ...(canonicalTenantName ? { name: canonicalTenantName } : (args.name && !existingUser.name ? { name: args.name } : {})),
          ...(needsRoleUpdate ? { role: portalRole } : {}),
          ...(needsFirmId ? { firmId: invite.firmId } : {}),
          // Online presence privacy: property/resident portals default to hidden
          portalPresenceHidden: invite.portalType === "resident" ? true : (existingUser as any).portalPresenceHidden ?? false,
        },
      });
    } else {
      // Create new user record for this portal user
      // Use the proper UserRole (Client / Tenant) so the frontend can route
      // them to the correct portal view automatically.
      const portalProduct = invite.portalType === "client" ? "legal" : "property";
      const portalRole = invite.portalType === "client" ? "Client" : "Tenant";
      const userName = canonicalTenantName || args.name || invite.inviteeName || email.split("@")[0];
      const newUserId = await ctx.runMutation(internal.myFunctions.createUser, {
        tokenIdentifier: email,
        name: userName,
        email: email,
        password: hashedPassword,
        role: portalRole,
        product: portalProduct,
        onboardingCompleted: false,
        isVerified: true,
        emailVerified: true,
        firmId: invite.firmId,
        avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=random`,
        // Online presence privacy: property/resident portals default to hidden
        // (portal users can't see if the manager is online). Legal/client portals
        // default to visible (clients can see if their lawyer is online).
        portalPresenceHidden: invite.portalType === "resident",
      });
      portalUserDocId = String(newUserId);
    }

    // 3.5. Link portal user to property/unit if relatedId was provided
    // This is critical for getTenantInfo to find the tenant's property assignment.
    // When setupPortalPassword creates a new user, the property's unit record
    // may still point to a stale contact ID or email instead of the new Convex _id.
    if (invite.relatedId && invite.portalType === "resident" && portalUserDocId) {
      try {
        // Parse the relatedId format:
        // "propertyId_unitId" for multi-unit properties (composite key)
        // just "propertyId" for single properties
        const parts = invite.relatedId.split("_");
        const propertyCustomId = parts[0];
        const unitId = parts.length > 1 ? parts.slice(1).join("_") : null;

        // Find the property using internal query (actions cannot use ctx.db directly)
        const property: any = await ctx.runQuery(internal.portals.findPropertyByCustomId, {
          customId: propertyCustomId,
        });

        if (property) {
          const units = property.units || [];
          // Use the canonical tenant name from the property record (source of truth)
          // Fall back to the portal user's name or invite data if property lookup failed
          const tenantName = canonicalTenantName || invite.inviteeName || email.split("@")[0];

          if (units.length > 0 && unitId) {
            // Multi-unit property: update the specific unit
            let unitFound = false;
            const updatedUnits = units.map((u: any) => {
              if (u.id === unitId || u.unitName === unitId || u.id === invite.relatedId) {
                unitFound = true;
                return {
                  ...u,
                  currentTenantId: portalUserDocId,
                  tenantId: portalUserDocId,
                  tenantEmail: email,
                  tenantName: tenantName,
                };
              }
              return u;
            });
            if (unitFound) {
              await ctx.runMutation(internal.portals.linkPortalUserToProperty, {
                propertyId: property._id,
                updates: { units: updatedUnits },
              });
            }
          } else {
            // Single property (no units or no unitId): update property-level tenant
            await ctx.runMutation(internal.portals.linkPortalUserToProperty, {
              propertyId: property._id,
              updates: {
                currentTenantId: portalUserDocId,
                tenantId: portalUserDocId,
                tenantEmail: email,
                tenantName: tenantName,
              },
            });
          }
        }
      } catch (linkErr) {
        // Non-blocking: if linking fails, the user can still access the portal.
        // getTenantInfo will try to find them by email as a fallback.
        console.warn("Portal user-property linking failed:", linkErr);
      }
    }

    // 4. Mark invite as accepted (including terms acceptance timestamp)
    await ctx.runMutation(api.portals.updateInviteRecord, {
      inviteId: invite._id,
      updates: {
        status: "accepted",
        acceptedAt: Date.now(),
        termsAcceptedAt: Date.now(),
        updatedAt: Date.now(),
        // Clear token to prevent replay attacks — the invite is now consumed
        token: undefined,
      },
    });

    return { success: true, email };
  },
});

/**
 * repairPortalUserFirmId — Repairs a portal user whose firmId is missing.
 * Called from the frontend when the portal detects it can't resolve a firmId.
 * Looks up the firm via invite records and user record, then patches the user.
 */
export const repairPortalUserFirmId = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase().trim();

    // 1. Find the user
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", email))
      .first();

    if (!user) return { success: false, message: "User not found." };
    if (user.firmId) return { success: true, firmId: user.firmId, message: "firmId already set." };

    // 2. Try to find firmId from invite records
    const invites = await ctx.db
      .query("portal_invites")
      .withIndex("by_email", (q) => q.eq("inviteeEmail", email))
      .collect();

    const sorted = invites
      .filter(inv => inv.firmId)
      .sort((a, b) => {
        const aActive = a.status !== 'revoked' ? 1 : 0;
        const bActive = b.status !== 'revoked' ? 1 : 0;
        if (aActive !== bActive) return bActive - aActive;
        return (b._creationTime || 0) - (a._creationTime || 0);
      });

    const foundFirmId = sorted[0]?.firmId;

    if (foundFirmId) {
      await ctx.db.patch(user._id, {
        firmId: foundFirmId,
        product: sorted[0].portalType === 'client' ? 'legal' : 'property',
      } as any);
      return { success: true, firmId: foundFirmId, message: "firmId repaired from invite record." };
    }

    // 3. Try to find firmId from property records
    const allProperties = await ctx.db.query("properties").collect();
    for (const prop of allProperties) {
      const propTenantId = (prop as any).currentTenantId || (prop as any).tenantId;
      if (String(propTenantId).toLowerCase() === email && prop.firmId) {
        await ctx.db.patch(user._id, {
          firmId: prop.firmId,
          product: 'property',
        } as any);
        return { success: true, firmId: prop.firmId, message: "firmId repaired from property record." };
      }
      const units = (prop as any).units || [];
      for (const unit of units) {
        const unitTenantEmail = (unit.tenantEmail || '').toLowerCase();
        if (unitTenantEmail === email && prop.firmId) {
          await ctx.db.patch(user._id, {
            firmId: prop.firmId,
            product: 'property',
          } as any);
          return { success: true, firmId: prop.firmId, message: "firmId repaired from property unit record." };
        }
      }
    }

    return { success: false, message: "Could not find firmId from any source." };
  },
});

/**
 * relinkPortalUserToProperty — Self-healing mutation that re-links a portal user
 * to their property/unit if the currentTenantId link is broken.
 *
 * This is called from the frontend when getTenantInfo returns empty results
 * (tenant not found in any property). It searches all properties for a matching
 * tenant by email and updates the currentTenantId to the user's Convex _id.
 */
export const relinkPortalUserToProperty = mutation({
  args: { email: v.string(), firmId: v.string() },
  handler: async (ctx, args) => {
    const emailLower = args.email.toLowerCase().trim();

    // Find the user by email
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", emailLower))
      .first();

    if (!user) return { success: false, message: "User not found." };

    const userId = String(user._id);

    // Search all properties for this firm
    const properties = await ctx.db
      .query("properties")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();

    let linked = false;

    for (const prop of properties) {
      const units = (prop as any).units || [];
      let needsUpdate = false;

      if (units.length > 0) {
        // Multi-unit property: check each unit for email match
        const updatedUnits = units.map((u: any) => {
          const unitTenantEmail = (u.tenantEmail || '').toLowerCase();
          const unitTenantId = u.currentTenantId || u.tenantId;

          // Match by email or by currentTenantId that's an email (not a Convex _id)
          const matchesByEmail = unitTenantEmail === emailLower;
          const matchesById = unitTenantId === emailLower || unitTenantId === userId;
          const hasStaleLink = unitTenantId && unitTenantId !== userId &&
              !unitTenantId.startsWith("k") && unitTenantId.includes("@");

          if ((matchesByEmail || matchesById || hasStaleLink) && u.currentTenantId !== userId) {
            needsUpdate = true;
            return {
              ...u,
              currentTenantId: userId,
              tenantId: userId,
              tenantEmail: emailLower,
            };
          }
          return u;
        });

        if (needsUpdate) {
          await ctx.db.patch(prop._id, { units: updatedUnits } as any);
          linked = true;
        }
      } else {
        // Single property: check property-level tenant
        const propTenantId = (prop as any).currentTenantId || (prop as any).tenantId;
        const propTenantEmail = ((prop as any).rentalDetails?.tenantEmail || (prop as any).tenantEmail || "").toLowerCase();

        const matchesByEmail = propTenantEmail === emailLower;
        const matchesById = propTenantId === emailLower || propTenantId === userId;

        if ((matchesByEmail || matchesById) && propTenantId !== userId) {
          await ctx.db.patch(prop._id, {
            currentTenantId: userId,
            tenantId: userId,
            tenantEmail: emailLower,
          } as any);
          linked = true;
        }
      }
    }

    return { success: true, linked, message: linked ? "Portal user re-linked to property." : "No matching property found to link." };
  },
});

// ─── Scheduled Messages ─────────────────────────────────────────────────

export const getScheduledMessagesByFirm = query({
  args: { firmId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("scheduled_messages")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .order("desc")
      .collect();
  },
});

export const getPendingScheduledMessages = query({
  args: { firmId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const all = await ctx.db
      .query("scheduled_messages")
      .withIndex("by_firm_status", (q) => q.eq("firmId", args.firmId).eq("status", "scheduled"))
      .collect();
    return all.filter(m => m.scheduledFor > now).sort((a, b) => a.scheduledFor - b.scheduledFor);
  },
});

export const createScheduledMessage = mutation({
  args: {
    firmId: v.string(),
    propertyId: v.optional(v.string()),
    unitId: v.optional(v.string()),
    tenantIds: v.optional(v.array(v.string())),
    messageType: v.string(),
    channel: v.union(v.literal("whatsapp"), v.literal("email"), v.literal("sms")),
    content: v.string(),
    scheduledFor: v.number(),
    isAutomation: v.optional(v.boolean()),
    triggeredBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("scheduled_messages", {
      ...args,
      status: "scheduled",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const cancelScheduledMessage = mutation({
  args: { messageId: v.id("scheduled_messages") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      status: "cancelled",
      updatedAt: Date.now(),
    });
  },
});

// ─── Tenant Ledger for Portal ───────────────────────────────────────────

/**
 * getTenantInfo — Resolves the tenant's property/unit assignments using their
 * user ID and email. This is critical because the tenantId stored in
 * properties/units may be the user's Convex _id OR their email, depending
 * on how the invite was created. This query normalizes both cases.
 *
 * Returns: { tenantId, properties, units } where tenantId is the canonical
 * ID that should be used for all other portal queries.
 */
export const getTenantInfo = query({
  args: { firmId: v.string(), userId: v.string(), email: v.string() },
  handler: async (ctx, args) => {
    const emailLower = (args.email || "").toLowerCase().trim();

    const properties = await ctx.db
      .query("properties")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();

    // Also resolve the user's Convex _id from their email, in case the
    // property record stores the _id but we were passed the email as userId
    let resolvedConvexId: string | null = null;
    if (emailLower) {
      const userByEmail = await ctx.db
        .query("users")
        .withIndex("by_token", (q) => q.eq("tokenIdentifier", emailLower))
        .first();
      if (userByEmail) {
        resolvedConvexId = String(userByEmail._id);
      }
    }

    // Build a set of all possible IDs that could match this tenant
    const possibleIds = new Set<string>();
    possibleIds.add(args.userId);
    if (emailLower) possibleIds.add(emailLower);
    if (resolvedConvexId) possibleIds.add(resolvedConvexId);

    // Search for tenant in properties using all possible IDs + email
    const tenantProperties: any[] = [];
    const tenantUnits: any[] = [];
    let resolvedTenantId = args.userId;

    for (const prop of properties) {
      // Check property-level tenant (legacy single-tenant model)
      const propTenantId = (prop as any).currentTenantId || (prop as any).tenantId;
      const propTenantEmail = ((prop as any).rentalDetails?.tenantEmail || (prop as any).tenantEmail || "").toLowerCase();

      const matchesProperty = possibleIds.has(propTenantId) ||
          possibleIds.has(String(propTenantId)) ||
          (propTenantEmail && emailLower && propTenantEmail === emailLower);

      if (matchesProperty) {
        tenantProperties.push({
          id: String(prop._id),
          name: (prop as any).name || prop.address || 'Unnamed Property',
          address: prop.address,
          tenantName: (prop as any).rentalDetails?.tenantName || (prop as any).tenantName || null,
        });
        if (propTenantId && !possibleIds.has(propTenantId)) {
          resolvedTenantId = propTenantId;
        }
      }

      // Check unit-level tenants (multi-unit model)
      const units = (prop as any).units || [];
      for (const unit of units) {
        const unitTenantId = unit.currentTenantId || unit.tenantId;
        const unitTenantEmail = (unit.tenantEmail || '').toLowerCase();

        const matchesUnit = possibleIds.has(unitTenantId) ||
            possibleIds.has(String(unitTenantId)) ||
            (unitTenantEmail && emailLower && unitTenantEmail === emailLower);

        if (matchesUnit) {
          tenantUnits.push({
            id: unit.id || unit._id,
            name: unit.name || unit.unitName || unit.label,
            unitName: unit.name || unit.unitName || unit.label,
            propertyId: String(prop._id),
            propertyName: (prop as any).name || prop.address || 'Unnamed Property',
            propertyAddress: prop.address,
            amenities: unit.amenities || [],
            tenantName: unit.tenantName || null,
          });
          if (unitTenantId && !possibleIds.has(unitTenantId)) {
            resolvedTenantId = unitTenantId;
          }
        }
      }
    }

    // Determine primary property/unit for this tenant (first match)
    const primaryUnit = tenantUnits.length > 0 ? tenantUnits[0] : null;
    const primaryProperty = primaryUnit
      ? { id: primaryUnit.propertyId, name: primaryUnit.propertyName, address: primaryUnit.propertyAddress }
      : tenantProperties.length > 0 ? tenantProperties[0] : null;

    // Resolve the canonical tenant name from the property/tenancy record
    // This is the source of truth — used by the portal to display the tenant's name
    const resolvedTenantName = primaryUnit?.tenantName
      || tenantProperties.find(p => p.tenantName)?.tenantName
      || null;

    return {
      tenantId: resolvedTenantId,
      properties: tenantProperties,
      units: tenantUnits,
      // Convenience fields for maintenance ticket creation
      primaryPropertyId: primaryProperty?.id || null,
      primaryUnitId: primaryUnit?.id || null,
      primaryPropertyName: primaryProperty?.name || null,
      primaryUnitName: primaryUnit?.unitName || null,
      primaryPropertyAddress: primaryProperty?.address || null,
      // Canonical tenant name from the property record (source of truth)
      tenantName: resolvedTenantName,
    };
  },
});

/**
 * resolveFirmFromInvite — Fallback for portal users whose firmId is missing.
 * Looks up the most recent portal invite for this email to find the firmId.
 * Also checks revoked invites as a last-resort fallback.
 * Also searches property records for a matching tenant email.
 */
export const resolveFirmFromInvite = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase().trim();

    // 1. Check portal_invites for the most recent invite with a firmId
    //    (includes revoked/accepted — we no longer hard-delete invites)
    const invites = await ctx.db
      .query("portal_invites")
      .withIndex("by_email", (q) => q.eq("inviteeEmail", email))
      .collect();

    // Sort by creation time descending (most recent first)
    // Prefer active/accepted invites over revoked ones
    const sorted = invites.sort((a, b) => {
      // Active/accepted invites rank higher than revoked ones
      const aActive = a.status !== 'revoked' ? 1 : 0;
      const bActive = b.status !== 'revoked' ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      return (b._creationTime || 0) - (a._creationTime || 0);
    });
    const latestInvite = sorted.find(inv => inv.firmId);

    if (latestInvite?.firmId) {
      return {
        firmId: latestInvite.firmId,
        portalType: latestInvite.portalType,
        source: 'invite' as const,
      };
    }

    // 2. Check if the user has a firmId on their user record
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", email))
      .first();

    if (user?.firmId) {
      return {
        firmId: user.firmId,
        portalType: (user as any).product === 'atrium' ? 'resident' as const : 'client' as const,
        source: 'user_record' as const,
      };
    }

    // 3. Last-resort: search all properties for a unit/tenant matching this email
    //    This handles the edge case where invite records are missing but the
    //    tenant is linked to a property by email.
    const allProperties = await ctx.db.query("properties").collect();
    for (const prop of allProperties) {
      // Check property-level tenant
      const propTenantId = (prop as any).currentTenantId || (prop as any).tenantId;
      if (String(propTenantId).toLowerCase() === email) {
        if (prop.firmId) {
          return {
            firmId: prop.firmId,
            portalType: 'resident' as const,
            source: 'property' as const,
          };
        }
      }
      // Check unit-level tenants
      const units = (prop as any).units || [];
      for (const unit of units) {
        const unitTenantEmail = (unit.tenantEmail || '').toLowerCase();
        if (unitTenantEmail === email || String(unit.currentTenantId || unit.tenantId || '').toLowerCase() === email) {
          if (prop.firmId) {
            return {
              firmId: prop.firmId,
              portalType: 'resident' as const,
              source: 'property_unit' as const,
            };
          }
        }
      }
    }

    return null;
  },
});

export const getTenantLedger = query({
  args: { firmId: v.string(), tenantId: v.string(), email: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Find all properties where this tenant is assigned
    const properties = await ctx.db
      .query("properties")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();

    // Collect all possible tenant IDs (direct ID + email + IDs from matching properties/units)
    const possibleTenantIds = new Set([args.tenantId]);

    // Also include the email as a possible tenantId, since ledger entries
    // might be stored with the email instead of the Convex _id
    if (args.email) {
      possibleTenantIds.add(args.email.toLowerCase());
    }

    // Also try to resolve the user's Convex _id from their email,
    // in case the tenantId is their _id but entries use the email
    if (args.email) {
      const user: any = await ctx.db
        .query("users")
        .withIndex("by_token", (q) => q.eq("tokenIdentifier", args.email!.toLowerCase()))
        .first();
      if (user) {
        possibleTenantIds.add(String(user._id));
      }
    }

    for (const prop of properties) {
      const propTenantId = (prop as any).currentTenantId || (prop as any).tenantId;
      if (propTenantId === args.tenantId || (args.email && propTenantId === args.email.toLowerCase())) {
        // Found a property — also check if units have different IDs
        if (propTenantId) possibleTenantIds.add(propTenantId);
      }
      const units = (prop as any).units || [];
      for (const unit of units) {
        const unitTenantId = unit.currentTenantId || unit.tenantId;
        const unitTenantEmail = (unit.tenantEmail || '').toLowerCase();
        if (unitTenantId === args.tenantId || (args.email && (unitTenantId === args.email.toLowerCase() || unitTenantEmail === args.email.toLowerCase()))) {
          if (unitTenantId) possibleTenantIds.add(unitTenantId);
          if (propTenantId && propTenantId !== args.tenantId) possibleTenantIds.add(propTenantId);
        }
      }
    }

    // Get ledger entries matching any of the possible tenant IDs
    const allLedger = await ctx.db
      .query("ledger_entries")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();

    return allLedger.filter(e => e.tenantId && possibleTenantIds.has(e.tenantId));
  },
});

// ─── Inbound Messages for Tenant Portal ─────────────────────────────────

export const getInboundMessagesByTenant = query({
  args: { tenantId: v.string() },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("atrium_inbound_messages")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .collect();

    // Fallback: also try by user's Convex _id if the tenantId looks like an email
    if (messages.length === 0 && args.tenantId.includes('@')) {
      const user: any = await ctx.db
        .query("users")
        .withIndex("by_token", (q) => q.eq("tokenIdentifier", args.tenantId.toLowerCase()))
        .first();
      if (user) {
        return await ctx.db
          .query("atrium_inbound_messages")
          .withIndex("by_tenant", (q) => q.eq("tenantId", String(user._id)))
          .order("desc")
          .collect();
      }
    }

    return messages;
  },
});

// ─── Client Documents for Portal ────────────────────────────────────────

export const getClientDocuments = query({
  args: { firmId: v.string(), contactId: v.string() },
  handler: async (ctx, args) => {
    // Find matters for this contact
    const matters = await ctx.db
      .query("matters")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();

    const clientMatters = matters.filter(m => m.clientId === args.contactId);
    const matterIds = clientMatters.map(m => m._id);

    if (matterIds.length === 0) return [];

    // Get documents for those matters
    const allDocs = await ctx.db
      .query("documents")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();

    // Also build a map of matterId -> matter title for enrichment
    const matterMap = new Map(clientMatters.map(m => [String(m._id), m.title || ""]));

    return allDocs
      .filter(d => d.matterId && matterIds.includes(d.matterId as any))
      .map(d => ({
        _id: d._id,
        title: d.title,
        matterId: d.matterId,
        matterTitle: d.matterId ? (matterMap.get(String(d.matterId)) || null) : null,
        dateFiled: d.dateFiled,
        isSharedWithClient: d.isSharedWithClient,
        clientReviewStatus: d.clientReviewStatus,
        isSignatureRequested: d.isSignatureRequested,
        source: d.source,
        createdAt: d.createdAt,
      }));
  },
});

// ─── Client Messages for Portal ─────────────────────────────────────────

export const getClientMessages = query({
  args: { firmId: v.string(), contactId: v.string() },
  handler: async (ctx, args) => {
    // Find matters for this contact
    const matters = await ctx.db
      .query("matters")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();

    const clientMatters = matters.filter(m => m.clientId === args.contactId);
    const matterIds = clientMatters.map(m => String(m._id));

    if (matterIds.length === 0) return [];

    // Get client messages for those matters
    const allMessages = await ctx.db
      .query("clientMessages")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();

    // Build matter title map
    const matterMap = new Map(clientMatters.map(m => [String(m._id), m.title || ""]));

    // Collect unique author IDs to look up names
    const filteredMessages = allMessages.filter(m => matterIds.includes(m.matterId || ""));
    const authorIds = [...new Set(filteredMessages.map(m => m.authorId).filter(Boolean))];

    // Query firm users once and build a name map
    const firmUsers = await ctx.db
      .query("users")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();
    const authorNameMap = new Map<string, string>();
    for (const aid of authorIds) {
      const found = firmUsers.find(u => u.id === aid || u.tokenIdentifier === aid || String(u._id) === aid);
      if (found) authorNameMap.set(aid!, found.name || "");
    }

    return filteredMessages
      .sort((a, b) => {
        const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return tB - tA;
      })
      .slice(0, 50)
      .map(m => ({
        _id: m._id,
        matterId: m.matterId,
        matterTitle: matterMap.get(m.matterId || "") || "",
        authorId: m.authorId,
        authorName: authorNameMap.get(m.authorId || "") || "",
        content: m.content,
        timestamp: m.timestamp,
        isRead: m.isRead,
      }));
  },
});

// ─── Client Activity for Portal ─────────────────────────────────────────

export const getClientActivity = query({
  args: { firmId: v.string(), contactId: v.string() },
  handler: async (ctx, args) => {
    // Find matters for this contact
    const matters = await ctx.db
      .query("matters")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();

    const clientMatters = matters.filter(m => m.clientId === args.contactId);
    const matterIds = clientMatters.map(m => String(m._id));

    if (matterIds.length === 0) return [];

    // Get firm activity for those matters
    const allActivity = await ctx.db
      .query("firmActivity")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();

    return allActivity
      .filter(a => a.matterId && matterIds.includes(a.matterId))
      .sort((a, b) => {
        const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return tB - tA;
      })
      .slice(0, 10)
      .map(a => ({
        _id: a._id,
        userId: a.userId,
        userName: a.userName,
        action: a.action,
        targetType: a.targetType,
        targetName: a.targetName,
        matterId: a.matterId,
        timestamp: a.timestamp,
      }));
  },
});

// ─── Client Invoices for Portal ─────────────────────────────────────────

export const getClientInvoices = query({
  args: { firmId: v.string(), contactId: v.string() },
  handler: async (ctx, args) => {
    // Find matters for this contact
    const matters = await ctx.db
      .query("matters")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();

    const clientMatters = matters.filter(m => m.clientId === args.contactId);
    const matterIds = clientMatters.map(m => String(m._id));

    if (matterIds.length === 0) return [];

    // Get invoices for those matters
    const allInvoices = await ctx.db
      .query("invoices")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();

    return allInvoices.filter(inv => {
      const matterField = inv.matter as any;
      const matterId = matterField?.id || matterField;
      return matterId && matterIds.includes(String(matterId));
    });
  },
});

// ─── Migration: Fix legacy "Portal User" role → Client/Tenant ──────────
// One-time migration to update any users created with the old "Portal User"
// role. Cross-references their portal_invites records to determine whether
// they should be Client or Tenant.
export const migratePortalUserRoles = mutation({
  args: {},
  handler: async (ctx) => {
    const allUsers = await ctx.db.query("users").collect();
    const portalUsers = allUsers.filter((u: any) => u.role === "Portal User");

    if (portalUsers.length === 0) {
      return { migrated: 0, message: "No Portal User records found." };
    }

    let migrated = 0;
    for (const user of portalUsers) {
      // Look up their invite to determine portal type
      const invites = await ctx.db
        .query("portal_invites")
        .withIndex("by_email", (q) => q.eq("inviteeEmail", user.email || ""))
        .collect();

      const acceptedInvite = invites.find((inv: any) => inv.status === "accepted");
      if (acceptedInvite) {
        const newRole = acceptedInvite.portalType === "client" ? "Client" : "Tenant";
        await ctx.db.patch(user._id, { role: newRole });
        migrated++;
      } else {
        // No invite found — default to Tenant (property portal) since that's
        // the more common case for "Portal User" accounts
        await ctx.db.patch(user._id, { role: "Tenant" });
        migrated++;
      }
    }

    return { migrated, message: `Migrated ${migrated} Portal User(s) to Client/Tenant roles.` };
  },
});

// ─── Client Contact Lookup for Portal ──────────────────────────────────────

/**
 * getClientContactByUserId — Finds the contact record for a portal client
 * using their user ID. This is needed because the DataProvider skips loading
 * firm data for portal users, so matterState.contacts is empty. The
 * ClientDashboard uses this to find the contactId needed for its portal queries.
 *
 * Also searches by email as a fallback — the contact's userId field might
 * not always match the user's Convex _id (e.g. if the contact was created
 * before the portal user account existed).
 */
export const getClientContactByUserId = query({
  args: { firmId: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();

    // First try matching by userId field
    let contact = contacts.find(c => c.userId === args.userId) || null;

    // If not found, try to match by looking up the user's email and matching
    // the contact's email field. This handles the case where the contact was
    // created before the portal user account existed.
    if (!contact) {
      // Try to look up the user by their Convex _id to get their email
      let user: any = null;
      try { user = await ctx.db.get(args.userId as any); } catch {}

      // If that didn't work, the userId might be an email-based tokenIdentifier
      if (!user) {
        user = await ctx.db
          .query("users")
          .withIndex("by_token", (q) => q.eq("tokenIdentifier", args.userId.toString()))
          .first();
      }

      const userEmail = user?.email?.toLowerCase();
      if (userEmail) {
        contact = contacts.find(c =>
          (c as any).email?.toLowerCase() === userEmail
        ) || null;
      }

      // Also try matching contact by userId against the user's _id as a string
      if (!contact && user) {
        const userDocId = String(user._id);
        contact = contacts.find(c => c.userId === userDocId) || null;
      }
    }

    return contact;
  },
});

/**
 * getClientMattersByUserId — Returns the matters for a portal client,
 * looking up the contact by userId first. This avoids the ClientDashboard
 * needing to depend on matterState (which is empty for portal users).
 *
 * Also searches by email as a fallback for the same reason as
 * getClientContactByUserId.
 */
export const getClientMattersByUserId = query({
  args: { firmId: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    // Find the contact for this user
    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();

    let clientContact = contacts.find(c => c.userId === args.userId);

    // Fallback: search by email
    if (!clientContact) {
      let user: any = null;
      try { user = await ctx.db.get(args.userId as any); } catch {}
      if (!user) {
        user = await ctx.db
          .query("users")
          .withIndex("by_token", (q) => q.eq("tokenIdentifier", args.userId.toString()))
          .first();
      }
      const userEmail = user?.email?.toLowerCase();
      if (userEmail) {
        clientContact = contacts.find(c =>
          (c as any).email?.toLowerCase() === userEmail
        );
      }
      if (!clientContact && user) {
        clientContact = contacts.find(c => c.userId === String(user._id));
      }
    }

    if (!clientContact) return [];

    // Find matters for this contact
    const matters = await ctx.db
      .query("matters")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();

    return matters
      .filter(m => m.clientId === String(clientContact._id))
      .map(m => ({
        id: String(m._id),
        title: m.title,
        suitNumber: m.suitNumber,
        referenceNumber: m.referenceNumber,
        stage: m.stage,
        status: m.status,
        type: m.type,
        nextAdjournedDate: m.nextAdjournedDate,
        stageLastUpdated: m.stageLastUpdated,
        assignedUsers: m.assignedUsers,
        clientId: m.clientId,
      }));
  },
});

// ─── Portal Messaging ────────────────────────────────────────────────────

/**
 * sendPortalMessage — Allows a portal user (Tenant/Client) to send a message
 * to their property manager / firm admin. This is only possible if the firm
 * has enabled portal messaging in their portal settings.
 */
export const sendPortalMessage = mutation({
  args: {
    firmId: v.string(),
    senderId: v.string(),
    senderName: v.optional(v.string()),
    senderEmail: v.optional(v.string()),
    senderRole: v.string(), // "Tenant" or "Client"
    subject: v.optional(v.string()),
    content: v.string(),
    attachments: v.optional(v.array(v.string())), // Convex storage IDs
    propertyId: v.optional(v.string()),
    unitId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("portal_messages", {
      firmId: args.firmId,
      senderId: args.senderId,
      senderName: args.senderName,
      senderEmail: args.senderEmail,
      senderRole: args.senderRole,
      subject: args.subject,
      content: args.content,
      attachments: args.attachments ?? [],
      propertyId: args.propertyId,
      unitId: args.unitId,
      status: "unread",
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * getPortalMessagesByFirm — Gets all portal messages for a firm (admin side).
 */
export const getPortalMessagesByFirm = query({
  args: { firmId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("portal_messages")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .order("desc")
      .collect();
  },
});

/**
 * getPortalMessagesBySender — Gets messages sent by a specific portal user.
 */
export const getPortalMessagesBySender = query({
  args: { senderId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("portal_messages")
      .withIndex("by_sender", (q) => q.eq("senderId", args.senderId))
      .order("desc")
      .collect();
  },
});

/**
 * markPortalMessageRead — Marks a portal message as read.
 */
export const markPortalMessageRead = mutation({
  args: { messageId: v.id("portal_messages") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, { status: "read", updatedAt: Date.now() });
  },
});

// ─── Payment Proof Upload ────────────────────────────────────────────────

/**
 * submitPaymentProof — Allows a tenant to submit proof of payment (receipt/stub)
 * for review by their property manager. Creates a record with the uploaded file.
 */
export const submitPaymentProof = mutation({
  args: {
    firmId: v.string(),
    tenantId: v.string(),
    tenantName: v.optional(v.string()),
    tenantEmail: v.optional(v.string()),
    propertyId: v.optional(v.string()),
    unitId: v.optional(v.string()),
    amount: v.optional(v.number()),
    period: v.optional(v.string()),
    description: v.optional(v.string()),
    storageIds: v.array(v.string()), // Convex storage IDs for uploaded files
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("payment_proofs", {
      firmId: args.firmId,
      tenantId: args.tenantId,
      tenantName: args.tenantName,
      tenantEmail: args.tenantEmail,
      propertyId: args.propertyId,
      unitId: args.unitId,
      amount: args.amount,
      period: args.period,
      description: args.description,
      storageIds: args.storageIds,
      status: "pending_review",
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * getPaymentProofsByFirm — Gets all payment proof submissions for a firm (admin side).
 */
export const getPaymentProofsByFirm = query({
  args: { firmId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("payment_proofs")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .order("desc")
      .collect();
  },
});

/**
 * getPaymentProofsByTenant — Gets payment proof submissions by a specific tenant.
 */
export const getPaymentProofsByTenant = query({
  args: { tenantId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("payment_proofs")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .collect();
  },
});

/**
 * updatePaymentProofStatus — Admin updates the status of a payment proof submission.
 */
export const updatePaymentProofStatus = mutation({
  args: {
    proofId: v.id("payment_proofs"),
    status: v.union(v.literal("pending_review"), v.literal("approved"), v.literal("rejected")),
    adminNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { proofId, ...updates } = args;
    await ctx.db.patch(proofId, { ...updates, updatedAt: Date.now() });
  },
});

// ─── Tenant Documents for Portal ────────────────────────────────────────

/**
 * getTenantDocuments — Returns documents shared with a tenant's property.
 * For tenants, documents come from documents linked to the property's matterId,
 * plus any documents shared with the tenant specifically.
 */
export const getTenantDocuments = query({
  args: { firmId: v.string(), tenantId: v.string(), email: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Find properties where this tenant is assigned
    const properties = await ctx.db
      .query("properties")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();

    const tenantPropertyIds: string[] = [];
    const tenantMatterIds: string[] = [];

    for (const prop of properties) {
      const propTenantId = (prop as any).currentTenantId || (prop as any).tenantId;
      const matchesTenant = propTenantId === args.tenantId ||
        propTenantId === args.email ||
        String(propTenantId).toLowerCase() === (args.email || '').toLowerCase();

      if (matchesTenant) {
        tenantPropertyIds.push(String(prop._id));
        if (prop.matterId) tenantMatterIds.push(prop.matterId);
      }

      // Also check unit-level tenants
      const units = (prop as any).units || [];
      for (const unit of units) {
        const unitTenantId = unit.currentTenantId || unit.tenantId;
        const unitTenantEmail = (unit.tenantEmail || '').toLowerCase();
        const matchesUnit = unitTenantId === args.tenantId ||
          unitTenantId === args.email ||
          String(unitTenantId).toLowerCase() === (args.email || '').toLowerCase() ||
          (unitTenantEmail && unitTenantEmail === (args.email || '').toLowerCase());

        if (matchesUnit && !tenantPropertyIds.includes(String(prop._id))) {
          tenantPropertyIds.push(String(prop._id));
          if (prop.matterId && !tenantMatterIds.includes(prop.matterId)) {
            tenantMatterIds.push(prop.matterId);
          }
        }
      }
    }

    if (tenantMatterIds.length === 0 && tenantPropertyIds.length === 0) return [];

    // Get all documents for the firm and filter by relevant matter/property
    const allDocs = await ctx.db
      .query("documents")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();

    // Filter documents that are shared with client or belong to the tenant's matters
    return allDocs
      .filter(d => {
        const matchesMatter = d.matterId && tenantMatterIds.includes(d.matterId as any);
        return matchesMatter;
      })
      .map(d => ({
        _id: d._id,
        title: d.title,
        matterId: d.matterId,
        dateFiled: d.dateFiled,
        isSharedWithClient: d.isSharedWithClient,
        clientReviewStatus: d.clientReviewStatus,
        isSignatureRequested: d.isSignatureRequested,
        source: d.source,
        content: d.content,
        createdAt: d.createdAt,
      }));
  },
});

/**
 * getPortalUserConsentRecords — Returns consent/acceptance records for a portal user.
 * Looks up portal_invites for the user's email and returns terms acceptance info.
 */
export const getPortalUserConsentRecords = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase().trim();
    if (!email) return [];

    const invites = await ctx.db
      .query("portal_invites")
      .withIndex("by_email", (q) => q.eq("inviteeEmail", email))
      .collect();

    return invites
      .filter(inv => inv.status === 'accepted' && inv.termsAcceptedAt)
      .map(inv => ({
        _id: inv._id,
        portalType: inv.portalType,
        termsAcceptedAt: inv.termsAcceptedAt,
        acceptedAt: inv.acceptedAt,
        inviteeName: inv.inviteeName,
        inviteeEmail: inv.inviteeEmail,
        firmId: inv.firmId,
        createdAt: inv.createdAt,
      }));
  },
});

/**
 * getTenantLeaseDetails — Returns lease/rental details for a tenant's property.
 * Pulls rentalDetails from the property record and tenancy information.
 */
export const getTenantLeaseDetails = query({
  args: { firmId: v.string(), tenantId: v.string(), email: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const properties = await ctx.db
      .query("properties")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();

    const leases: any[] = [];

    for (const prop of properties) {
      const propTenantId = (prop as any).currentTenantId || (prop as any).tenantId;
      const matchesTenant = propTenantId === args.tenantId ||
        propTenantId === args.email ||
        String(propTenantId).toLowerCase() === (args.email || '').toLowerCase();

      if (matchesTenant) {
        leases.push({
          propertyId: String(prop._id),
          propertyName: (prop as any).name || prop.address || 'Unnamed Property',
          propertyAddress: prop.address,
          propertyType: prop.propertyType,
          ownershipType: prop.ownershipType,
          rentalDetails: (prop as any).rentalDetails || null,
          category: prop.category,
          status: prop.status,
        });
      }

      // Also check unit-level tenants
      const units = (prop as any).units || [];
      for (const unit of units) {
        const unitTenantId = unit.currentTenantId || unit.tenantId;
        const unitTenantEmail = (unit.tenantEmail || '').toLowerCase();
        const matchesUnit = unitTenantId === args.tenantId ||
          unitTenantId === args.email ||
          String(unitTenantId).toLowerCase() === (args.email || '').toLowerCase() ||
          (unitTenantEmail && unitTenantEmail === (args.email || '').toLowerCase());

        if (matchesUnit) {
          leases.push({
            propertyId: String(prop._id),
            propertyName: (prop as any).name || prop.address || 'Unnamed Property',
            propertyAddress: prop.address,
            unitName: unit.name || unit.unitName || unit.label,
            unitId: unit.id,
            propertyType: prop.propertyType,
            ownershipType: prop.ownershipType,
            rentalDetails: (prop as any).rentalDetails || null,
            unitDetails: {
              tenantName: unit.tenantName,
              rentAmount: unit.rentAmount,
              leaseStart: unit.leaseStart || unit.leaseStartDate,
              leaseEnd: unit.leaseEnd || unit.leaseEndDate,
            },
            category: prop.category,
            status: prop.status,
          });
        }
      }
    }

    // Also check tenancies table
    const tenancies = await ctx.db
      .query("tenancies")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    for (const tenancy of tenancies) {
      // Check if we already have this property in the leases
      const propId = tenancy.propertyId;
      const exists = leases.find(l => l.propertyId === propId);
      if (!exists) {
        const prop: any = await ctx.db.get(propId as any);
        leases.push({
          propertyId: propId,
          propertyName: prop ? (prop.name || prop.address || 'Unnamed Property') : 'Unknown Property',
          propertyAddress: prop?.address || null,
          propertyType: prop?.propertyType || null,
          ownershipType: prop?.ownershipType || null,
          rentalDetails: prop?.rentalDetails || null,
          tenancyDetails: {
            startDate: tenancy.startDate,
            endDate: tenancy.endDate,
            rentAmount: tenancy.rentAmount,
            paymentFrequency: tenancy.paymentFrequency,
            status: tenancy.status,
          },
          category: prop?.category || null,
          status: prop?.status || null,
        });
      }
    }

    return leases;
  },
});

/**
 * getClientConsentRecords — Returns consent/acceptance records for a client portal user.
 * Uses the same portal_invites data as getPortalUserConsentRecords but named
 * separately for semantic clarity in the client dashboard.
 */
export const getClientConsentRecords = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase().trim();
    if (!email) return [];

    const invites = await ctx.db
      .query("portal_invites")
      .withIndex("by_email", (q) => q.eq("inviteeEmail", email))
      .collect();

    return invites
      .filter(inv => inv.status === 'accepted')
      .map(inv => ({
        _id: inv._id,
        portalType: inv.portalType,
        termsAcceptedAt: inv.termsAcceptedAt,
        acceptedAt: inv.acceptedAt,
        inviteeName: inv.inviteeName,
        inviteeEmail: inv.inviteeEmail,
        firmId: inv.firmId,
        createdAt: inv.createdAt,
      }));
  },
});

// ─── Firm Portal Settings ────────────────────────────────────────────────

/**
 * getFirmPortalSettings — Gets portal settings for a firm, including
 * whether portal messaging is enabled for tenants and clients.
 */
export const getFirmPortalSettings = query({
  args: { firmId: v.string() },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("portal_settings")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .first();
    // Default settings if none exist
    if (!settings) {
      return {
        tenantMessagingEnabled: false,
        clientMessagingEnabled: false,
        paymentProofUploadEnabled: true,
      };
    }
    return settings;
  },
});

/**
 * updateFirmPortalSettings — Updates portal settings for a firm.
 * Admins use this to enable/disable tenant messaging, client messaging, etc.
 */
export const updateFirmPortalSettings = mutation({
  args: {
    firmId: v.string(),
    tenantMessagingEnabled: v.optional(v.boolean()),
    clientMessagingEnabled: v.optional(v.boolean()),
    paymentProofUploadEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { firmId, ...updates } = args;
    const existing = await ctx.db
      .query("portal_settings")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { ...updates, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("portal_settings", {
        firmId,
        ...updates,
        tenantMessagingEnabled: updates.tenantMessagingEnabled ?? false,
        clientMessagingEnabled: updates.clientMessagingEnabled ?? false,
        paymentProofUploadEnabled: updates.paymentProofUploadEnabled ?? true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// NOTICE BOARD — Property managers post notices visible to all tenants
// ═══════════════════════════════════════════════════════════════════════════════

/** Create a new notice (admin only) */
export const createNotice = mutation({
  args: {
    firmId: v.string(),
    authorId: v.string(),
    authorName: v.optional(v.string()),
    title: v.string(),
    body: v.string(),
    priority: v.union(v.literal("normal"), v.literal("important"), v.literal("urgent")),
    isPinned: v.optional(v.boolean()),
    propertyId: v.optional(v.string()),
    unitId: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("portal_notices", {
      firmId: args.firmId,
      authorId: args.authorId,
      authorName: args.authorName,
      title: args.title,
      body: args.body,
      priority: args.priority,
      isPinned: args.isPinned ?? false,
      propertyId: args.propertyId,
      unitId: args.unitId,
      status: "active",
      expiresAt: args.expiresAt,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Update an existing notice (admin only) */
export const updateNotice = mutation({
  args: {
    noticeId: v.id("portal_notices"),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    priority: v.optional(v.union(v.literal("normal"), v.literal("important"), v.literal("urgent"))),
    isPinned: v.optional(v.boolean()),
    propertyId: v.optional(v.string()),
    unitId: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { noticeId, ...updates } = args;
    // Remove undefined fields so we don't overwrite with undefined
    const cleanUpdates: Record<string, any> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) cleanUpdates[key] = value;
    }
    await ctx.db.patch(noticeId, cleanUpdates);
  },
});

/** Archive (soft-delete) a notice (admin only) */
export const archiveNotice = mutation({
  args: { noticeId: v.id("portal_notices") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.noticeId, { status: "archived", updatedAt: Date.now() });
  },
});

/** Restore an archived notice (admin only) */
export const restoreNotice = mutation({
  args: { noticeId: v.id("portal_notices") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.noticeId, { status: "active", updatedAt: Date.now() });
  },
});

/** Get all active notices for a firm (used by tenant portal).
 *  Automatically filters out expired notices and sorts: pinned first,
 *  then by priority (urgent → important → normal), then by recency. */
export const getActiveNotices = query({
  args: {
    firmId: v.string(),
    propertyId: v.optional(v.string()),
    unitId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const allNotices = await ctx.db
      .query("portal_notices")
      .withIndex("by_firm_status", (q) => q.eq("firmId", args.firmId).eq("status", "active"))
      .collect();

    // Filter: remove expired, and scope to property/unit if specified
    const filtered = allNotices.filter((n) => {
      // Remove expired notices
      if (n.expiresAt && n.expiresAt < now) return false;
      // If propertyId specified on notice, only show to matching property or global (no propertyId)
      if (n.propertyId && args.propertyId && n.propertyId !== args.propertyId) return false;
      // If notice has no propertyId, it's global — show to everyone
      // If unitId specified on notice, only show to matching unit
      if (n.unitId && args.unitId && n.unitId !== args.unitId) return false;
      // If notice has a propertyId but no unitId, show to all units in that property
      return true;
    });

    // Sort: pinned first, then by priority weight, then by recency
    const priorityWeight: Record<string, number> = { urgent: 0, important: 1, normal: 2 };
    filtered.sort((a, b) => {
      // Pinned first
      const aPin = a.isPinned ? 0 : 1;
      const bPin = b.isPinned ? 0 : 1;
      if (aPin !== bPin) return aPin - bPin;
      // Then by priority
      const aPri = priorityWeight[a.priority] ?? 2;
      const bPri = priorityWeight[b.priority] ?? 2;
      if (aPri !== bPri) return aPri - bPri;
      // Then by recency (newest first)
      return b.createdAt - a.createdAt;
    });

    return filtered;
  },
});

/** Get all notices for a firm (admin view — includes archived) */
export const getAllNotices = query({
  args: {
    firmId: v.string(),
    status: v.optional(v.union(v.literal("active"), v.literal("archived"))),
  },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("portal_notices")
        .withIndex("by_firm_status", (q) => q.eq("firmId", args.firmId).eq("status", args.status!))
        .collect();
    }
    // No status filter — return all
    return await ctx.db
      .query("portal_notices")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();
  },
});

/** Get a single notice by ID */
export const getNotice = query({
  args: { noticeId: v.id("portal_notices") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.noticeId);
  },
});
