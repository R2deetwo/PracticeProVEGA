/**
 * buildMessage — the single template engine for resident messages.
 *
 * EXTRACTED from ComposeModal.tsx (2026-09-08) so the template logic is
 * unit-testable (the messages-overhaul round kept this in the component
 * file, where the node-environment test suite could not reach it) and so
 * template semantics live next to MSG_TYPE_FINANCE in utils.
 *
 * TOTAL SCOPE FIX (user feedback 2026-09-08): "I'm talking about the
 * service charge but it adds up figures it ought not to have added."
 * Previously EVERY template's {{TOTAL_PAYABLE}} summed rent + service
 * charge + caution + legal + agency — so a service-charge alert about
 * ₦40,000 could end with "Total Payable: ₦1,920,000" (rent + every fee
 * on the resident's record). The total is now computed from the type's
 * DECLARED scope in MSG_TYPE_FINANCE:
 *   • service_charge_alert totals the service charge ONLY;
 *   • payment_receipt states the amount received ONLY;
 *   • formal demands (rent reminder / late notice / penalty / access
 *     restriction) still total the full breakdown, which is correct.
 * Unknown keys (a firm's custom template) keep the legacy full-sum so
 * existing custom {{TOTAL_PAYABLE}} placeholders render as before.
 */
import { AutomationMessageType } from '../types';
import { MSG_TYPE_FINANCE } from './messageTypes';

export function buildMessage(
  type: AutomationMessageType,
  unitLabel: string,
  tenantName?: string,
  amount?: number,
  customText?: string,
  customTemplates?: Record<string, string>,
  extraData?: {
    serviceCharge?: number;
    legalFee?: number;
    agencyFee?: number;
    cautionDeposit?: number;
    dueDate?: string;
    firmName?: string;
  }
): string {
  if (customText) return customText;

  const name = tenantName || 'Resident';
  const addr = unitLabel;
  const baseRent = amount || 0;

  const sc = extraData?.serviceCharge || 0;
  const lf = extraData?.legalFee || 0;
  const af = extraData?.agencyFee || 0;
  const cd = extraData?.cautionDeposit || 0;

  // ── TOTAL SCOPE FIX ───────────────────────────────────────────────────
  const typeFinance = (MSG_TYPE_FINANCE as Record<string, { total: string[] } | undefined>)[type];
  const totalScope: string[] = typeFinance
    ? typeFinance.total
    : ['amount', 'serviceCharge', 'cautionDeposit', 'legalFee', 'agencyFee'];
  const figureOf = (f: string): number =>
    f === 'amount' ? baseRent
    : f === 'serviceCharge' ? sc
    : f === 'cautionDeposit' ? cd
    : f === 'legalFee' ? lf
    : f === 'agencyFee' ? af
    : 0;
  const totalPayable = totalScope.reduce((sum, f) => sum + figureOf(f), 0);

  const amtStr = `₦${baseRent.toLocaleString('en-NG')}`;
  const totalStr = `₦${totalPayable.toLocaleString('en-NG')}`;

  let message = customTemplates?.[type];

  if (!message) {
    switch (type) {
      case 'rent_reminder':
        message = `OFFICIAL DEMAND NOTICE\n\nDear {{TENANT_NAME}},\n\nThis is a formal reminder that your payment for {{PROPERTY_ADDRESS}} is due on or before {{DUE_DATE}}.\n\nFinancial Breakdown:\n- Rent: {{AMOUNT}}\n{{SERVICE_CHARGE_LINE}}{{CAUTION_DEPOSIT_LINE}}{{FEES_LINE}}\nTotal Payable: {{TOTAL_PAYABLE}}\n\nPlease ensure payment is made promptly. Thank you.\n\n— {{FIRM_NAME}}`;
        break;
      case 'late_notice':
        message = `URGENT: OVERDUE PAYMENT\n\nDear {{TENANT_NAME}},\n\nYour payment of {{TOTAL_PAYABLE}} for {{PROPERTY_ADDRESS}} is now OVERDUE.\n\nPlease make payment immediately to avoid late penalties or access restrictions. Contact management at {{FIRM_NAME}} to confirm your payment.\n\n— {{FIRM_NAME}}`;
        break;
      case 'payment_receipt':
        message = `PAYMENT RECEIPT\n\nDear {{TENANT_NAME}},\n\nWe confirm receipt of {{TOTAL_PAYABLE}} for {{PROPERTY_ADDRESS}}.\n\nThank you for your prompt payment.\n\n— {{FIRM_NAME}}`;
        break;
      case 'service_charge_alert':
        message = `SERVICE CHARGE ALERT\n\nDear {{TENANT_NAME}},\n\nYour service charge of ₦${sc.toLocaleString('en-NG')} for {{PROPERTY_ADDRESS}} is outstanding. Please settle this at your earliest convenience to avoid access restrictions.\n\nTotal Payable: {{TOTAL_PAYABLE}}`;
        break;
      case 'access_restriction':
        message = `NOTICE OF ACCESS RESTRICTION\n\nAccess to {{PROPERTY_ADDRESS}} has been restricted due to non-payment of outstanding charges totaling {{TOTAL_PAYABLE}}. Please contact {{FIRM_NAME}} immediately to resolve.`;
        break;
      case 'penalty_notice':
        message = `PENALTY NOTICE\n\nDear {{TENANT_NAME}},\n\nA late payment penalty has been applied to your account for {{PROPERTY_ADDRESS}}.\n\nRevised Total Payable: {{TOTAL_PAYABLE}}\n\nPlease settle the outstanding balance urgently. — {{FIRM_NAME}}`;
        break;
      case 'lease_renewal':
        message = `LEASE RENEWAL\n\nDear {{TENANT_NAME}},\n\nYour lease for {{PROPERTY_ADDRESS}} is expiring soon. We invite you to renew your tenancy agreement. Please contact {{FIRM_NAME}} to discuss renewal terms.`;
        break;
      case 'welcome_note':
        message = `Welcome to your new home at {{PROPERTY_ADDRESS}}, {{TENANT_NAME}}! We are excited to have you. Please find the resident handbook in your portal. — {{FIRM_NAME}}`;
        break;
      case 'promotion':
        message = `Hello {{TENANT_NAME}}, we have a special offer for our residents! Get 10% off professional cleaning services this month. Use code: CLEAN10. — {{FIRM_NAME}}`;
        break;
      case 'vendor_update':
        message = `Dear {{TENANT_NAME}}, we have partnered with new verified maintenance vendors to serve you better. You can now request plumbing and electrical repairs directly from the app. — {{FIRM_NAME}}`;
        break;
      case 'general_announcement':
        message = `Attention residents of {{PROPERTY_ADDRESS}}: Routine maintenance will be carried out on the central generators this Saturday. Expect intermittent power supply between 10am and 2pm. — {{FIRM_NAME}}`;
        break;
      case 'maintenance_update':
        message = `Update on your maintenance request for {{PROPERTY_ADDRESS}}: The vendor has confirmed your appointment for tomorrow. Please ensure someone is available to grant access. — {{FIRM_NAME}}`;
        break;
      default:
        message = '';
        break;
    }
  }

  if (!message) return '';

  const scLine = sc > 0 ? `- Service Charge: ₦${sc.toLocaleString('en-NG')}\n` : '';
  const cdLine = cd > 0 ? `- Caution Deposit: ₦${cd.toLocaleString('en-NG')}\n` : '';
  const feesLine = (lf + af) > 0 ? `- Legal/Agency Fees: ₦${(lf + af).toLocaleString('en-NG')}\n` : '';

  let result = message
    .replace(/\{\{TENANT_NAME\}\}/g, name)
    .replace(/\{\{AMOUNT\}\}/g, amtStr)
    .replace(/\{\{TOTAL_PAYABLE\}\}/g, totalStr)
    .replace(/\{\{SERVICE_CHARGE_LINE\}\}/g, scLine)
    .replace(/\{\{CAUTION_DEPOSIT_LINE\}\}/g, cdLine)
    .replace(/\{\{FEES_LINE\}\}/g, feesLine)
    .replace(/\{\{FIRM_NAME\}\}/g, extraData?.firmName || 'Management');

  // Handle Unit Context smartly
  if (addr === 'General' || addr === 'All Residents') {
      result = result.replace(/ for \{\{PROPERTY_ADDRESS\}\}/g, '');
      result = result.replace(/ at \{\{PROPERTY_ADDRESS\}\}/g, '');
      result = result.replace(/\{\{PROPERTY_ADDRESS\}\}/g, 'your unit');
  } else {
      result = result.replace(/\{\{PROPERTY_ADDRESS\}\}/g, addr);
  }

  // PLACEHOLDER BUG FIX: these replacements were previously gated behind
  // `if (extraData)` — but callers like AutomationCenter's bulk rent reminder
  // invoke buildMessage WITHOUT extraData, so tenants received messages with
  // a literal {{DUE_DATE}} (and fee placeholders) in the text. All placeholders
  // are now replaced unconditionally; sc/lf/af/cd already default to 0 and
  // DUE_DATE falls back to a natural-language phrase.
  result = result.replace(/\{\{SERVICE_CHARGE\}\}/g, `₦${sc.toLocaleString('en-NG')}`);
  result = result.replace(/\{\{LEGAL_FEE\}\}/g, `₦${lf.toLocaleString('en-NG')}`);
  result = result.replace(/\{\{AGENCY_FEE\}\}/g, `₦${af.toLocaleString('en-NG')}`);
  result = result.replace(/\{\{CAUTION_DEPOSIT\}\}/g, `₦${cd.toLocaleString('en-NG')}`);
  result = result.replace(/\{\{DUE_DATE\}\}/g, extraData?.dueDate || 'the due date');

  return result;
}
