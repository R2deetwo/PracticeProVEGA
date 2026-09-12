/**
 * Delivery-error classification + WhatsApp template mapping (client side).
 *
 * WHY THIS EXISTS (2026-09-08): the user's WhatsApp sends failed with
 * "0 sent 1 failed" and NO reason anywhere — not in the toast, not in the
 * logs. The #1 cause for business-initiated WhatsApp (property managers
 * messaging residents) is Meta's customer-service-window rule: free-form
 * messages are only delivered within 24h of the resident's last reply;
 * outside that window an APPROVED TEMPLATE is mandatory. The classifier
 * below detects that error class so the UI can (a) explain it and
 * (b) auto-retry with the firm's registered template when one exists.
 *
 * The server-side twin lives in convex/communications.ts
 * (isWhatsAppWindowError / explainWhatsAppError) — duplicated on purpose:
 * the browser bundle must not import the Convex server module.
 */

import { AutomationMessageType } from '../types';

/** App-side fields a template variable slot can be filled from. */
export type TemplateVarField =
  | 'tenantName' | 'amount' | 'totalPayable' | 'serviceCharge'
  | 'address' | 'firmName' | 'dueDate' | 'messageText';

/**
 * A firm-configured template mapping (whatsapp_template_mappings row).
 * When present it REPLACES the hardcoded legacy guess below — the firm's
 * real Meta template name, its registered language, and which app field
 * fills each {{n}} slot, in order.
 */
export interface FirmTemplateMapping {
  messageType: string;
  templateName: string;
  templateLanguage: string;
  varOrder?: TemplateVarField[] | string[] | null;
}

/**
 * Per-recipient data available when composing a WhatsApp template retry.
 * Mirrors the fields ComposeModal already resolves for each recipient.
 */
export interface TemplateRecipientData {
  tenantName?: string;
  amount?: number;        // rent amount (₦)
  address?: string;       // unit / property address
  totalPayable?: number;
  serviceCharge?: number;
  firmName?: string;
  dueDate?: string;
  messageText?: string;
}

/** Build the ordered variable values from a varOrder + recipient data. */
export function buildVarsForOrder(
  order: readonly (TemplateVarField | string)[] | null | undefined,
  r: TemplateRecipientData
): string[] {
  if (!order || order.length === 0) {
    // Legacy default: [name, amount, address]
    return [
      r.tenantName || 'Resident',
      (r.amount || 0).toLocaleString('en-NG'),
      r.address || 'your unit',
    ];
  }
  const naira = (n?: number) => `₦${(n || 0).toLocaleString('en-NG')}`;
  return order.map((f) => {
    switch (f) {
      case 'tenantName': return r.tenantName || 'Resident';
      case 'amount': return (r.amount || 0).toLocaleString('en-NG');
      case 'totalPayable': return r.totalPayable != null ? r.totalPayable.toLocaleString('en-NG') : naira(r.amount);
      case 'serviceCharge': return (r.serviceCharge || 0).toLocaleString('en-NG');
      case 'address': return r.address || 'your unit';
      case 'firmName': return r.firmName || 'Management';
      case 'dueDate': return r.dueDate || 'the due date';
      case 'messageText': return r.messageText || '';
      default: return String(f);
    }
  });
}

/** Does this provider error mean "outside the 24h window — template required"? */
export function isWhatsAppWindowError(error: string | null | undefined): boolean {
  if (!error) return false;
  const e = error.toLowerCase();
  return (
    e.includes('131047') ||
    e.includes('re-engagement') ||
    e.includes('reengagement') ||
    e.includes('more than 24 hours') ||
    e.includes('24 hours have passed') ||
    e.includes('outside the 24') ||
    e.includes('support window') ||
    e.includes('customer service window') ||
    (e.includes('template') && (e.includes('required') || e.includes('only allowed')))
  );
}

/** Truncate long provider errors for toast display (full text goes to the log/result panel). */
export function summarizeError(error: string | null | undefined, max = 140): string {
  if (!error) return 'Unknown error';
  const oneLine = error.replace(/\s+/g, ' ').trim();
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine;
}

/**
 * Does this provider error mean "the name+language template pair wasn't
 * found on the WhatsApp Business account"? Meta looks up templates by
 * NAME + LOCALE — a template registered under "en_US" (or "en_GB") is
 * invisible to a send that requests "en", and (confusingly) Meta often
 * reports that as "template ... does not exist" / error 132000-class.
 * Locale mismatch is the #1 cause of "my template is approved but the
 * send fails" reports.
 */
export function isTemplateNotFoundError(error: string | null | undefined): boolean {
  if (!error) return false;
  const e = error.toLowerCase();
  return (
    e.includes('132000') ||
    e.includes('132001') ||
    e.includes('132002') ||
    (/template/.test(e) && /does not exist|not found|not exist|unavailable|no template/.test(e)) ||
    (/language/.test(e) && /does not match|not match|mismatch/.test(e))
  );
}

/**
 * LEGACY fallback mapping — used ONLY when the firm hasn't configured a
 * real mapping in Settings → Communications → WhatsApp Templates.
 *
 * 2026-09-12: "my template is not the same as what you have in the app" —
 * hardcoded guesses like this NEVER match what the firm actually
 * registered in Meta Business Manager (name, language, variable order).
 * The configured mapping (FirmTemplateMapping) always wins; this object
 * remains only as the last-resort default for rent_reminder.
 */
export const WHATSAPP_TEMPLATES: Partial<Record<AutomationMessageType, {
  name: string;
  buildVars: (r: TemplateRecipientData) => string[];
}>> = {
  rent_reminder: {
    name: 'atrium_rent_reminder',
    buildVars: (r) => buildVarsForOrder(null, r),
  },
};

/**
 * Resolve the template definition to use for a message type:
 * 1. the firm's CONFIGURED mapping (Settings → WhatsApp Templates) —
 *    exact name/language the firm registered in Meta, with the variable
 *    order they chose;
 * 2. otherwise the legacy hardcoded default (rent_reminder only);
 * 3. otherwise null (no template retry for this message type).
 */
export function resolveTemplateFor(
  messageType: AutomationMessageType,
  firmMappings?: FirmTemplateMapping[] | null
): { name: string; languages: string[]; buildVars: (r: TemplateRecipientData) => string[] } | null {
  const configured = firmMappings?.find((m) => m.messageType === messageType);
  if (configured?.templateName) {
    // Language chain: the configured language first, then the common
    // English fallbacks (covers Meta's en/en_US/en_US lookup strictness).
    const langs = [configured.templateLanguage || 'en', 'en', 'en_US', 'en_GB']
      .filter((l, i, a) => a.indexOf(l) === i);
    return {
      name: configured.templateName,
      languages: langs,
      buildVars: (r) => buildVarsForOrder(configured.varOrder, r),
    };
  }
  const legacy = WHATSAPP_TEMPLATES[messageType];
  if (legacy) {
    return {
      name: legacy.name,
      languages: ['en', 'en_US', 'en_GB'],
      buildVars: legacy.buildVars,
    };
  }
  return null;
}

/**
 * One free-form WhatsApp send with the server-side template fallback.
 *
 * 2026-09-12 rework: the retry used to happen HERE (client called the
 * gateway twice, once free-form and once per locale, double-charging the
 * monthly WhatsApp quota and only covering ComposeModal). The fallback now
 * lives inside the sendWhatsApp Convex action: this helper makes ONE call
 * passing `fallback` (messageType + the recipient's data); when Meta
 * rejects the free-form text with the 24-hour-window error (131047), the
 * server resolves the firm's mapping, builds the variables, walks the
 * locale chain and retries — all inside the same quota charge. Every
 * server-initiated send (crons, scheduled dispatch) gets the identical
 * treatment.
 *
 * Returns the provider result — free-form success, or the template retry's
 * outcome (`usedTemplate: true`), or the original failure with its reason.
 */
export async function sendWhatsAppWithTemplateFallback(
  send: (args: {
    fallback?: {
      messageType: AutomationMessageType;
      templateVarsData?: TemplateRecipientData;
    };
  }) => Promise<{ success: boolean; simulated?: boolean; error?: string; messageId?: string; usedTemplate?: boolean }>,
  opts: {
    messageType: AutomationMessageType;
    recipient: TemplateRecipientData;
    firmMappings?: FirmTemplateMapping[] | null;
  }
): Promise<{ success: boolean; simulated?: boolean; error?: string; messageId?: string; usedTemplate?: boolean }> {
  // firmMappings is still accepted for signature compatibility, but the
  // server resolves the mapping itself from whatsapp_template_mappings —
  // the server's copy is authoritative (it's the one that retries).
  return await send({
    fallback: {
      messageType: opts.messageType,
      templateVarsData: opts.recipient,
    },
  });
}
