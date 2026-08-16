/**
 * notificationConfig.ts — Van Clief-inspired unified notification registry.
 *
 * PRINCIPLE: "The structure IS the orchestration."
 *
 * Instead of scattered email/WhatsApp calls across 5+ files with
 * inconsistent patterns (some use ctx.runAction, some use
 * ctx.scheduler.runAfter, some use internal actions), this file
 * defines ALL notification triggers as a single structured registry.
 *
 * Each notification event has:
 *   - channel: 'email' | 'whatsapp' | 'push' | 'in_app' (or combination)
 *   - trigger: what mutation/event fires it
 *   - recipient: who receives it
 *   - template: the email/WhatsApp template to use
 *   - condition: optional gating logic
 *
 * This makes it trivial to:
 *   1. Audit which notifications exist (one file, not 5)
 *   2. Add new notifications (add an entry to the registry)
 *   3. Debug missing notifications (check the registry, not grep 5 files)
 *   4. Eventually auto-generate the notification dispatch code
 */

export type NotificationChannel = 'email' | 'whatsapp' | 'push' | 'in_app';
export type NotificationRecipient = 'user' | 'founder' | 'team' | 'resident' | 'client';

export interface NotificationEventDef {
  id: string;
  event: string;          // what happened
  trigger: string;        // which mutation fires it
  channels: NotificationChannel[];
  recipient: NotificationRecipient;
  template: string;       // email template name or WhatsApp template
  condition?: string;     // gating logic description
  sourceFile: string;     // where the dispatch code lives
  working: boolean;       // verified working?
  notes?: string;
}

// ─── Complete Notification Registry ──────────────────────────────────────

export const NOTIFICATION_REGISTRY: NotificationEventDef[] = [
  // ─── Authentication ──────────────────────────────────────────────────
  {
    id: 'signup_verification',
    event: 'User signs up → verification code email',
    trigger: 'startSignup / startRegistration',
    channels: ['email'],
    recipient: 'user',
    template: 'verification_code',
    sourceFile: 'myFunctions.ts → sendVerificationEmail',
    working: true,
    notes: 'Uses Brevo. PracticePro_Vega_Mailer env var.',
  },
  {
    id: 'welcome_email',
    event: 'User verifies email → welcome email',
    trigger: 'verifyCode',
    channels: ['email'],
    recipient: 'user',
    template: 'welcome',
    sourceFile: 'myFunctions.ts → sendWelcomeEmail',
    working: true,
  },

  // ─── Portal Invitations ──────────────────────────────────────────────
  {
    id: 'portal_invite_email',
    event: 'Admin invites resident/client → invitation email',
    trigger: 'createPortalInvite',
    channels: ['email'],
    recipient: 'resident',
    template: 'portal_invite',
    sourceFile: 'portals.ts → createPortalInvite',
    working: true,
    notes: 'Also sends WhatsApp if phone provided.',
  },
  {
    id: 'portal_invite_whatsapp',
    event: 'Admin invites resident/client → WhatsApp invite',
    trigger: 'createPortalInvite',
    channels: ['whatsapp'],
    recipient: 'resident',
    template: 'portal_invite_wa',
    sourceFile: 'portals.ts → createPortalInvite',
    working: true,
    condition: 'Phone number provided',
  },
  {
    id: 'portal_resend_invite',
    event: 'Admin resends portal invite → email + WhatsApp',
    trigger: 'resendPortalInvite',
    channels: ['email', 'whatsapp'],
    recipient: 'resident',
    template: 'portal_invite',
    sourceFile: 'portals.ts → resendPortalInvite',
    working: true,
  },

  // ─── Feedback / Support ──────────────────────────────────────────────
  {
    id: 'feedback_auto_reply',
    event: 'User submits feedback → auto-reply notification',
    trigger: 'submitFeedback',
    channels: ['in_app'],
    recipient: 'user',
    template: 'feedback_auto_reply',
    sourceFile: 'feedback.ts → submitFeedback',
    working: true,
    notes: 'Creates notification record. No email sent for auto-reply.',
  },
  {
    id: 'feedback_admin_reply_email',
    event: 'Founder replies to feedback → email to user',
    trigger: 'adminReplyToFeedback',
    channels: ['email', 'in_app'],
    recipient: 'user',
    template: 'feedback_reply',
    sourceFile: 'feedback.ts → sendReplyEmail',
    working: true,
    condition: 'sendEmail === true AND userEmail exists',
    notes: 'Email is OPTIONAL (toggle in admin). In-app always fires.',
  },
  {
    id: 'feedback_user_reply_founder',
    event: 'User replies to support thread → founder notification',
    trigger: 'userReplyToFeedback',
    channels: ['in_app'],
    recipient: 'founder',
    template: 'feedback_user_reply',
    sourceFile: 'feedback.ts → userReplyToFeedback',
    working: true,
    notes: 'Only in-app notification. No email or push to founder.',
  },

  // ─── Sales Pipeline ──────────────────────────────────────────────────
  {
    id: 'sales_lead_founder',
    event: 'Contact Sales form submitted → founder notification',
    trigger: 'submitSalesInquiry',
    channels: ['in_app', 'push'],
    recipient: 'founder',
    template: 'sales_lead',
    sourceFile: 'salesInquiries.ts → notifyFounders',
    working: true,
    notes: 'Uses unified notifyFounders() helper. No email to founder.',
  },

  // ─── Add-on Requests ─────────────────────────────────────────────────
  {
    id: 'addon_request_founder',
    event: 'User requests add-on → founder notification',
    trigger: 'createAddonRequest',
    channels: ['in_app', 'push'],
    recipient: 'founder',
    template: 'addon_request',
    sourceFile: 'myFunctions.ts → notifyFounders',
    working: true,
  },

  // ─── Maintenance ─────────────────────────────────────────────────────
  {
    id: 'maintenance_ticket_created',
    event: 'Resident creates maintenance ticket → admin notification',
    trigger: 'createMaintenanceTicket',
    channels: ['in_app'],
    recipient: 'team',
    template: 'maintenance_ticket',
    sourceFile: 'portals.ts → createMaintenanceTicket',
    working: false,
    notes: 'MISSING: No email or WhatsApp sent to admin on new ticket. Only in-app notification.',
  },
  {
    id: 'maintenance_status_update',
    event: 'Admin updates maintenance ticket → resident notification',
    trigger: 'updateMaintenanceTicketStatus',
    channels: ['in_app'],
    recipient: 'resident',
    template: 'maintenance_status',
    sourceFile: 'portals.ts → updateMaintenanceTicketStatus',
    working: false,
    notes: 'MISSING: No email/WhatsApp to resident when ticket status changes.',
  },

  // ─── Rent / Billing ──────────────────────────────────────────────────
  {
    id: 'rent_reminder_whatsapp',
    event: 'Rent due reminder → WhatsApp to resident',
    trigger: 'cron (automated)',
    channels: ['whatsapp'],
    recipient: 'resident',
    template: 'rent_reminder',
    sourceFile: 'myFunctions.ts → sendWhatsApp',
    working: true,
    condition: 'WhatsApp enabled + within tier limit',
    notes: 'Automated via cron. Tier-limited (Core: 100/mo, Growth: 500/mo, Pro: unlimited).',
  },
  {
    id: 'court_date_reminder_whatsapp',
    event: 'Court date approaching → WhatsApp to lawyer',
    trigger: 'cron (automated)',
    channels: ['whatsapp'],
    recipient: 'user',
    template: 'court_date_reminder',
    sourceFile: 'myFunctions.ts → sendWhatsApp',
    working: true,
    condition: 'Vega Pro plan only',
  },

  // ─── Sentry Pass ─────────────────────────────────────────────────────
  {
    id: 'visitor_code_whatsapp',
    event: 'Resident generates visitor code → WhatsApp to visitor',
    trigger: 'generateVisitorToken (portal_api delivery)',
    channels: ['whatsapp'],
    recipient: 'resident',
    template: 'visitor_pass',
    sourceFile: 'visitorManagement.ts → sendVisitorWhatsApp',
    working: true,
    condition: 'deliveryMethod === portal_api AND visitorPhone provided',
  },

  // ─── Team Chat ───────────────────────────────────────────────────────
  {
    id: 'team_chat_message',
    event: 'Team member sends message → notification to recipients',
    trigger: 'sendChatMessage',
    channels: ['in_app'],
    recipient: 'team',
    template: 'chat_message',
    sourceFile: 'myFunctions.ts → sendChatMessage',
    working: true,
    notes: 'Only in-app notification. No email or push for chat messages.',
  },

  // ─── Portal Password Setup ───────────────────────────────────────────
  {
    id: 'portal_password_setup_email',
    event: 'Resident sets up portal password → confirmation email',
    trigger: 'setupPortalPassword',
    channels: ['email'],
    recipient: 'resident',
    template: 'portal_password_set',
    sourceFile: 'portals.ts → setupPortalPassword',
    working: true,
  },
];

// ─── Helper: Get all broken/missing notifications ───────────────────────

export function getBrokenNotifications(): NotificationEventDef[] {
  return NOTIFICATION_REGISTRY.filter(n => !n.working);
}

export function getNotificationsByChannel(channel: NotificationChannel): NotificationEventDef[] {
  return NOTIFICATION_REGISTRY.filter(n => n.channels.includes(channel));
}

export function getNotificationsByRecipient(recipient: NotificationRecipient): NotificationEventDef[] {
  return NOTIFICATION_REGISTRY.filter(n => n.recipient === recipient);
}
