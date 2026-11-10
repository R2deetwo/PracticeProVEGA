/**
 * tenancyDocumentGeneration — ROUND E (Wave E4): generate tenancy documents
 * from existing templates.
 * ─────────────────────────────────────────────────────────────────────────
 * The owner brief (§4) asks for "template document generation" as a
 * workflow affordance: the manager records a tenancy (E1) and should be
 * able to produce the routine paperwork — agreements, renewal
 * confirmations, demand notices, move-out confirmations — WITHOUT
 * retyping resident/unit/lease facts the ledger already knows.
 *
 * This module is the pure generation brain (no React, no Convex):
 *
 *   buildTenancyTemplateContext(...)  ledger rows → flat {{token}} dict
 *   fillTemplate(content, context)    {{token}} substitution with a
 *                                     visible [FILL: token] marker for
 *                                     anything unknown
 *   BUILT_IN_PROPERTY_TEMPLATES       the starter pack used when the firm
 *                                     has no property templates of its own
 *
 * DESIGN RULES (pinned by tests/unit/roundEWave4.test.ts):
 *   1. NEVER INVENT VALUES. A token the ledger cannot supply stays a
 *      visible [FILL: token] marker — the manager sees exactly what is
 *      missing instead of a plausible-looking blank. The returned
 *      `unfilledKeys` list powers the warning banner in the generator UI.
 *   2. MONEY AS TEXT: amounts are formatted (₦1,500,000.00) exactly once,
 *      here — callers never re-format.
 *   3. The firm's OWN templates (Settings → Templates) take precedence;
 *      the built-in pack only appears when the firm has none.
 *   4. Everything is data-in/data-out: the generator UI (which opens the
 *      real DocumentForm through the E3 propertyId pipeline) owns the
 *      saving, not this module.
 */

// ── Context types ───────────────────────────────────────────────────────────

/** What the ledger + property row know about one tenancy. */
export interface TenancyTemplateInput {
    tenantName: string | null | undefined;
    tenantPhone?: string | null;
    tenantEmail?: string | null;
    unitLabel: string | null | undefined;
    propertyAddress: string | null | undefined;
    leaseStart?: string | null;
    leaseEnd?: string | null;
    rentAmount?: number | null;
    rentFrequency?: string | null;
    cautionDeposit?: number | null;
    emergencyContactName?: string | null;
    emergencyContactPhone?: string | null;
    emergencyContactRelationship?: string | null;
    /** Outstanding service-charge balance on the unit, if computed. */
    outstandingBalance?: number | null;
    firmName: string | null | undefined;
    /** e.g. "Lagos" or "Lagos State" — falls back to firmName's locale. */
    firmState?: string | null;
    /** Optional free-form extras (e.g. renewal end date). */
    extras?: Record<string, string>;
}

export type TemplateContext = Record<string, string>;

// ── Money + date formatting (single place) ──────────────────────────────────

const naira = (n: number): string =>
    `NGN ${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Human date ("12 March 2026"); null-safe. */
export function formatTemplateDate(value: string | null | undefined): string {
    if (!value) return '';
    const d = new Date(String(value).length === 10 ? `${value}T00:00:00` : String(value));
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ── Context builder ─────────────────────────────────────────────────────────

/**
 * Ledger rows → the flat token dictionary every template reads. All values
 * are strings (or absent — an absent key becomes a [FILL: …] marker).
 * Today's date tokens are stamped here so a generated document is
 * self-dating.
 */
export function buildTenancyTemplateContext(input: TenancyTemplateInput): TemplateContext {
    const ctx: TemplateContext = {};
    const put = (k: string, v: string | null | undefined) => {
        const s = String(v ?? '').trim();
        if (s) ctx[k] = s;
    };

    put('tenantName', input.tenantName);
    put('tenantPhone', input.tenantPhone);
    put('tenantEmail', input.tenantEmail);
    put('unitLabel', input.unitLabel);
    put('propertyAddress', input.propertyAddress);
    put('leaseStart', formatTemplateDate(input.leaseStart));
    put('leaseEnd', formatTemplateDate(input.leaseEnd));
    put('rentAmount', typeof input.rentAmount === 'number' && input.rentAmount > 0 ? naira(input.rentAmount) : null);
    put('rentFrequency', input.rentFrequency);
    put(
        'cautionDeposit',
        typeof input.cautionDeposit === 'number' && input.cautionDeposit > 0 ? naira(input.cautionDeposit) : null
    );
    put('emergencyContactName', input.emergencyContactName);
    put('emergencyContactPhone', input.emergencyContactPhone);
    put('emergencyContactRelationship', input.emergencyContactRelationship);
    put(
        'outstandingBalance',
        typeof input.outstandingBalance === 'number' && input.outstandingBalance > 0
            ? naira(input.outstandingBalance)
            : null
    );
    put('firmName', input.firmName);
    put('firmState', input.firmState);
    put('today', formatTemplateDate(new Date().toISOString().slice(0, 10)));
    put('todayLong', new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }));

    for (const [k, v] of Object.entries(input.extras ?? {})) put(k, v);
    return ctx;
}

// ── Token substitution ──────────────────────────────────────────────────────

/** {{token}} / {{ token }} (any inner spacing, case-insensitive on the key). */
const TOKEN_RE = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

export interface FilledTemplate {
    /** The substituted document content. */
    content: string;
    /** Tokens the context could not supply, in order of appearance. */
    unfilledKeys: string[];
}

/**
 * Replace every {{token}} with the context value. Unknown/empty values
 * become a visible `[FILL: token]` marker (rule 1: never invent values)
 * and are listed in `unfilledKeys` so the UI can warn before opening the
 * editor.
 */
export function fillTemplate(templateContent: string, context: TemplateContext): FilledTemplate {
    const lower: Record<string, string> = {};
    for (const [k, v] of Object.entries(context)) lower[k.toLowerCase()] = v;

    const unfilled: string[] = [];
    const seen = new Set<string>();
    const content = String(templateContent ?? '').replace(TOKEN_RE, (_m, rawKey: string) => {
        const key = String(rawKey);
        const value = lower[key.toLowerCase()];
        if (value && value.trim()) return value;
        if (!seen.has(key)) {
            seen.add(key);
            unfilled.push(key);
        }
        return `[FILL: ${key}]`;
    });
    return { content, unfilledKeys: unfilled };
}

/** Extract the distinct {{tokens}} a template declares (for template cards). */
export function templateTokens(templateContent: string): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const m of String(templateContent ?? '').matchAll(TOKEN_RE)) {
        const key = String(m[1]);
        if (!seen.has(key)) {
            seen.add(key);
            out.push(key);
        }
    }
    return out;
}

// ── Built-in starter templates ──────────────────────────────────────────────

export interface PropertyDocumentTemplate {
    /** Stable slug used as the template id in the picker. */
    id: string;
    name: string;
    description: string;
    content: string;
}

/**
 * The starter pack for property firms (used only when the firm's own
 * documentTemplates list has nothing to offer — a fresh Atrium firm
 * should not have to author templates before generating its first
 * tenancy agreement). Content is plain HTML paragraphs, the same shape
 * the document editor consumes.
 */
export const BUILT_IN_PROPERTY_TEMPLATES: PropertyDocumentTemplate[] = [
    {
        id: 'builtin-tenancy-agreement',
        name: 'Tenancy Agreement',
        description: 'Residential tenancy agreement pre-filled from the ledger (parties, unit, term, rent).',
        content: `<p style="text-align:center"><strong>TENANCY AGREEMENT</strong></p>
<p>This Tenancy Agreement is made on {{today}}</p>
<p><strong>BETWEEN:</strong></p>
<p>{{firmName}} (the "Landlord" or its authorised agent) of the one part;</p>
<p><strong>AND</strong></p>
<p>{{tenantName}} (the "Tenant") of the other part.</p>
<p><strong>1. PREMISES.</strong> The Landlord agrees to let to the Tenant {{unitLabel}}, {{propertyAddress}} (the "Premises").</p>
<p><strong>2. TERM.</strong> The tenancy commences on {{leaseStart}} and continues until {{leaseEnd}} unless renewed or terminated in accordance with this Agreement.</p>
<p><strong>3. RENT.</strong> The Tenant shall pay rent of {{rentAmount}} {{rentFrequency}}, payable in advance.</p>
<p><strong>4. CAUTION DEPOSIT.</strong> The Tenant has paid a caution deposit of {{cautionDeposit}} refundable at the end of the tenancy, subject to deductions for damage beyond fair wear and tear.</p>
<p><strong>5. TENANT CONTACT.</strong> The Tenant may be reached at {{tenantPhone}} / {{tenantEmail}}.</p>
<p><strong>6. EMERGENCY CONTACT.</strong> {{emergencyContactName}} ({{emergencyContactRelationship}}) — {{emergencyContactPhone}}.</p>
<p><strong>7. USE.</strong> The Premises shall be used exclusively for residential purposes.</p>
<p>EXECUTED by the parties on the date first written above.</p>
<p style="text-align:right">______________________________<br/>For: {{firmName}} (Landlord)</p>
<p style="text-align:right">______________________________<br/>{{tenantName}} (Tenant)</p>`,
    },
    {
        id: 'builtin-renewal-confirmation',
        name: 'Lease Renewal Confirmation',
        description: 'Confirms a renewed term with the new window and rent.',
        content: `<p style="text-align:center"><strong>LEASE RENEWAL CONFIRMATION</strong></p>
<p>Date: {{today}}</p>
<p>Dear {{tenantName}},</p>
<p>We are pleased to confirm the renewal of your tenancy of {{unitLabel}}, {{propertyAddress}}.</p>
<p><strong>Renewed term:</strong> {{leaseStart}} to {{leaseEnd}}.</p>
<p><strong>Rent:</strong> {{rentAmount}} {{rentFrequency}}.</p>
<p>All other terms of your existing Tenancy Agreement remain in force. Kindly contact us with any questions.</p>
<p>Yours faithfully,</p>
<p style="text-align:right"><strong>{{firmName}}</strong></p>`,
    },
    {
        id: 'builtin-rent-demand-notice',
        name: 'Rent / Service Charge Demand Notice',
        description: 'Formal demand for the outstanding balance on the unit.',
        content: `<p style="text-align:center"><strong>DEMAND NOTICE</strong></p>
<p>Date: {{today}}</p>
<p>To: {{tenantName}}<br/>{{unitLabel}}, {{propertyAddress}}</p>
<p>Dear {{tenantName}},</p>
<p>Our records show an outstanding balance of {{outstandingBalance}} on your account for {{unitLabel}}, {{propertyAddress}}.</p>
<p>You are required to settle this balance within seven (7) days of the date of this notice. Rent of {{rentAmount}} {{rentFrequency}} continues to fall due in accordance with your Tenancy Agreement.</p>
<p>If the balance remains unsettled, the Landlord shall be entitled to enforce its rights, including recovery of possession.</p>
<p>Yours faithfully,</p>
<p style="text-align:right"><strong>{{firmName}}</strong></p>`,
    },
    {
        id: 'builtin-vacate-notice',
        name: 'Notice to Vacate / Termination',
        description: 'Landlord\u2019s notice terminating the tenancy at the end of the term.',
        content: `<p style="text-align:center"><strong>NOTICE OF TERMINATION OF TENANCY</strong></p>
<p>Date: {{today}}</p>
<p>To: {{tenantName}}<br/>{{unitLabel}}, {{propertyAddress}}</p>
<p>Dear {{tenantName}},</p>
<p>Take notice that your tenancy of {{unitLabel}}, {{propertyAddress}}, which commenced on {{leaseStart}} and expires on {{leaseEnd}}, shall terminate on {{leaseEnd}} and shall not be renewed.</p>
<p>You are required to vacate and deliver up possession of the Premises on or before {{leaseEnd}}, in good repair, subject to fair wear and tear. Your caution deposit of {{cautionDeposit}} shall be refunded after inspection and set-off of any sums lawfully due.</p>
<p>Yours faithfully,</p>
<p style="text-align:right"><strong>{{firmName}}</strong></p>`,
    },
    {
        id: 'builtin-moveout-confirmation',
        name: 'Move-out & Inspection Confirmation',
        description: 'Confirms the end of the tenancy and the final account position.',
        content: `<p style="text-align:center"><strong>MOVE-OUT AND INSPECTION CONFIRMATION</strong></p>
<p>Date: {{today}}</p>
<p>Tenant: {{tenantName}}<br/>Premises: {{unitLabel}}, {{propertyAddress}}<br/>Tenancy period: {{leaseStart}} to {{leaseEnd}}</p>
<p>This is to confirm that the Tenant has vacated the Premises and a joint inspection has been carried out.</p>
<p><strong>Final account:</strong></p>
<p>Caution deposit held: {{cautionDeposit}}<br/>Outstanding balance on account: {{outstandingBalance}}</p>
<p>Any refund due will be paid within a reasonable period after this confirmation.</p>
<p>We thank you for your tenancy and wish you well.</p>
<p style="text-align:right"><strong>{{firmName}}</strong></p>`,
    },
    {
        id: 'builtin-welcome-letter',
        name: 'Welcome Letter',
        description: 'Move-in welcome note with contacts and payment details.',
        content: `<p style="text-align:center"><strong>WELCOME TO YOUR NEW HOME</strong></p>
<p>Date: {{today}}</p>
<p>Dear {{tenantName}},</p>
<p>Welcome to {{unitLabel}}, {{propertyAddress}}! Your tenancy runs from {{leaseStart}} to {{leaseEnd}}, at a rent of {{rentAmount}} {{rentFrequency}}.</p>
<p>For maintenance requests, rent payments or any questions, contact {{firmName}} at {{tenantEmail}} or {{tenantPhone}} on file — we are happy to help.</p>
<p>In case of emergency, your designated contact is {{emergencyContactName}} ({{emergencyContactPhone}}).</p>
<p>Once again, welcome — we hope you enjoy your new home.</p>
<p>Warm regards,</p>
<p style="text-align:right"><strong>{{firmName}}</strong></p>`,
    },
];
