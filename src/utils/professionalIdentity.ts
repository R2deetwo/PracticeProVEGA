/**
 * professionalIdentity — how a firm and its people present themselves
 * legally and professionally, in the app and in every piece of
 * correspondence.
 *
 * CONTEXT (user, 2026-09-12): "when i look at the name at the top of the page
 * i can see that it says the name of the firm but... the person may describe
 * themselves in a limited number of ways and then other such as Property
 * Manager, Facilities Manager, Property Administrator, and other similar
 * legal ways and then other... it may seem a little unprofessional cause
 * there is not LTD or Cooporative or The Estate of X... let this be
 * something the user can do in their onboarding... so that the user can see
 * this reflected in their correspondence."
 */

// ─── The person: how they practise ───────────────────────────────────────────
/** Preset professional titles — 'Other' switches to free text. */
export const PROFESSIONAL_TITLES = [
    'Property Manager',
    'Facilities Manager',
    'Property Administrator',
    'Estate Manager',
    'Portfolio Manager',
    'Operations Manager',
    'Managing Director',
    'Legal Practitioner',
    'Other',
] as const;

// ─── The firm: its legal form ────────────────────────────────────────────────
/** Preset legal entity forms — 'Other' switches to free text (e.g. "The
 *  Estate of A. N. Other"). */
export const LEGAL_ENTITY_TYPES = [
    'Limited Liability Company (Ltd)',
    'Public Limited Company (PLC)',
    'Limited Liability Partnership (LLP)',
    'Registered Partnership',
    'Sole Proprietorship',
    'Cooperative Society',
    'Incorporated Trustees',
    'Trust / Estate Administration',
    'Other',
] as const;

/** Short suffix rendered after the firm name, per legal form. */
const ENTITY_SUFFIX: Record<string, string> = {
    'Limited Liability Company (Ltd)': 'Ltd',
    'Public Limited Company (PLC)': 'PLC',
    'Limited Liability Partnership (LLP)': 'LLP',
    'Registered Partnership': 'Partnership',
    'Sole Proprietorship': '',
    'Cooperative Society': 'Cooperative',
    'Incorporated Trustees': 'Incorporated Trustees',
    'Trust / Estate Administration': '',
};

// Words that already mark a name as carrying its legal form — never
// double-suffix ("Atrium Estates Ltd Ltd").
const ALREADY_SUFFIXED = /\b(ltd|ltd\.|limited|plc|llp|llp\.|partnership|cooperative|coop|inc|incorporated|trustees|estate of)\b/i;

/**
 * The firm's name as it should appear in correspondence: name + legal form.
 * - No legal form set → the bare name (unchanged behaviour).
 * - 'Trust / Estate Administration' and 'Sole Proprietorship' carry no
 *   suffix (the custom text or the name itself speaks).
 * - 'Other' → the custom text is appended in parentheses, or used verbatim
 *   when it already reads like an estate ("The Estate of X").
 * - Never re-suffixes a name that already carries its form.
 */
export function formatFirmLegalName(args: {
    name?: string | null;
    legalEntityType?: string | null;
    legalEntityCustom?: string | null;
}): string {
    const name = (args.name || '').trim();
    const type = (args.legalEntityType || '').trim();
    const custom = (args.legalEntityCustom || '').trim();
    if (!name) return '';
    if (!type) return name;

    if (type === 'Other') {
        if (!custom) return name;
        if (ALREADY_SUFFIXED.test(name) || ALREADY_SUFFIXED.test(custom)) {
            // One of them already carries the form — join without duplicating.
            return ALREADY_SUFFIXED.test(name) ? name : `${name} — ${custom}`;
        }
        return `${name} (${custom})`;
    }

    const suffix = ENTITY_SUFFIX[type] ?? '';
    if (!suffix) return name;
    if (ALREADY_SUFFIXED.test(name)) return name;
    return `${name} ${suffix}`;
}

/** The signer's title line — "Property Manager", custom text for 'Other'. */
export function formatProfessionalTitle(args: {
    professionalTitle?: string | null;
    titleCustom?: string | null;
}): string {
    const title = (args.professionalTitle || '').trim();
    const custom = (args.titleCustom || '').trim();
    if (title === 'Other') return custom;
    return title;
}

/**
 * A one-line signer block for correspondence:
 * "Ada Obi — Property Manager, Atrium Estates Ltd"
 */
export function formatSignerBlock(args: {
    userName?: string | null;
    professionalTitle?: string | null;
    titleCustom?: string | null;
    firmLegalName?: string | null;
}): string {
    const name = (args.userName || '').trim();
    const title = formatProfessionalTitle(args);
    const firm = (args.firmLegalName || '').trim();
    const personPart = title ? (name ? `${name} — ${title}` : title) : name;
    if (personPart && firm) return `${personPart}, ${firm}`;
    return personPart || firm;
}

// ─── Onboarding carry-through ────────────────────────────────────────────────
/**
 * The signup form collects the role + legal form BEFORE a firm exists
 * server-side. The answers are parked in localStorage and applied one-shot
 * on the first app load where the firm + user are available.
 */
export interface PendingIdentity {
    professionalTitle?: string;
    titleCustom?: string;
    legalEntityType?: string;
    legalEntityCustom?: string;
}

const PENDING_KEY = 'practicepro_pending_identity';

export function savePendingIdentity(identity: PendingIdentity): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    const clean: PendingIdentity = {};
    if (identity.professionalTitle) clean.professionalTitle = identity.professionalTitle;
    if (identity.titleCustom) clean.titleCustom = identity.titleCustom;
    if (identity.legalEntityType) clean.legalEntityType = identity.legalEntityType;
    if (identity.legalEntityCustom) clean.legalEntityCustom = identity.legalEntityCustom;
    if (Object.keys(clean).length === 0) return;
    try {
        localStorage.setItem(PENDING_KEY, JSON.stringify(clean));
    } catch { /* storage unavailable — non-fatal */ }
}

export function readPendingIdentity(): PendingIdentity | null {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;
    try {
        const raw = localStorage.getItem(PENDING_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return typeof parsed === 'object' && parsed ? parsed : null;
    } catch {
        return null;
    }
}

export function clearPendingIdentity(): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    try {
        localStorage.removeItem(PENDING_KEY);
    } catch { /* non-fatal */ }
}
