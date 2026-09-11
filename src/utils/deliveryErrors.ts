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
 * Per-recipient data available when composing a WhatsApp template retry.
 * Mirrors the fields ComposeModal already resolves for each recipient.
 */
export interface TemplateRecipientData {
  tenantName?: string;
  amount?: number;        // rent amount (₦)
  address?: string;       // unit / property address
}

/**
 * Registered Meta templates usable as an automatic fallback when a
 * free-form send hits the 24h window error. The names MUST match the
 * templates registered on the firm's WhatsApp Business account —
 * `atrium_rent_reminder` is the same template AutomationCenter's bulk
 * rent reminders already use, with variables in the order
 * [tenant name, rent amount, address].
 */
export const WHATSAPP_TEMPLATES: Partial<Record<AutomationMessageType, {
  name: string;
  buildVars: (r: TemplateRecipientData) => string[];
}>> = {
  rent_reminder: {
    name: 'atrium_rent_reminder',
    buildVars: (r) => [
      r.tenantName || 'Resident',
      (r.amount || 0).toLocaleString('en-NG'),
      r.address || 'your unit',
    ],
  },
};

/**
 * One free-form WhatsApp send, with automatic template retry when the
 * free-form attempt fails with a window-class error AND a template is
 * registered for the message type. Returns the LAST provider result —
 * either the free-form success, the template retry's result, or the
 * original failure (with its reason) when no retry was possible.
 *
 * TEMPLATE LOCALE CHAIN (2026-09-11, "my template is approved but the
 * message failed"): Meta matches templates by name + language. The
 * first template attempt uses the default "en" locale; when Meta
 * reports the name+language pair as not found (registered under
 * en_US/en_GB instead), we retry the SAME template under the other
 * common English locales before giving up. This covers the most common
 * approval/send mismatch without the firm needing to know the exact
 * locale their template was registered under.
 */
const TEMPLATE_LANGUAGE_CHAIN = ['en', 'en_US', 'en_GB'] as const;

export async function sendWhatsAppWithTemplateFallback(
  send: (args: { templateName?: string; templateVars?: string[]; templateLanguage?: string }) => Promise<{ success: boolean; simulated?: boolean; error?: string; messageId?: string }>,
  opts: {
    messageType: AutomationMessageType;
    recipient: TemplateRecipientData;
  }
): Promise<{ success: boolean; simulated?: boolean; error?: string; messageId?: string; usedTemplate?: boolean }> {
  const first = await send({});
  if (first.success) return first;

  const template = WHATSAPP_TEMPLATES[opts.messageType];
  if (template && isWhatsAppWindowError(first.error)) {
    // Try the template under each common English locale in order. Most
    // sends succeed on the first ("en"); the retries only fire when Meta
    // says the name+locale pair wasn't found (locale mismatch).
    let last: { success: boolean; simulated?: boolean; error?: string; messageId?: string } | null = null;
    for (const locale of TEMPLATE_LANGUAGE_CHAIN) {
      const attempt = await send({
        templateName: template.name,
        templateVars: template.buildVars(opts.recipient),
        templateLanguage: locale,
      });
      if (attempt.success) return { ...attempt, usedTemplate: true };
      last = attempt;
      // Only a name+language lookup miss justifies trying another locale —
      // any other error (quota, auth, network) won't improve with retries.
      if (!isTemplateNotFoundError(attempt.error)) break;
    }
    // Template send failed — report the last error (usually the more
    // actionable template-locale/registration one).
    return { ...(last ?? first), usedTemplate: true };
  }
  return first;
}
