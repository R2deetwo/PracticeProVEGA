import React from 'react';
import { VegaMark, AtriumMark } from '../marketing/brand/ProductMarks';
import { normalizeSignupProduct } from '../../utils/signupProduct';

/**
 * authTheme — per-product identity for the auth surfaces (R27).
 *
 * Owner direction: "the login and signup modals have not been improved or
 * made to match the products; I am still seeing the old modal that was on
 * the PracticePro web site — sort this out for the vega and atrium."
 *
 * The auth modal now carries the identity of the page that opened it.
 * A login/signup opened from /vega renders in the Warm Chambers register
 * (parchment card on an espresso blur, gilt accent bar, the Seal); from
 * /atrium it renders in the Well-Kept Estate register (cream card,
 * emerald accent, the Coin of the Arch). Opened anywhere else — the hub,
 * the native app, the portals — it stays EXACTLY the modal that has
 * always shipped (chrome: null → Modal's defaults are used untouched),
 * so no other surface moves.
 *
 * This is also the first consumer of the two-distinct-apps theming
 * strategy (see APP_UI_SEPARATION.md): one resolver, product-scoped
 * token classes, zero app-shell changes. The theme is resolved from the
 * modal context ONLY — explicit `productTheme`, or the signup funnel's
 * normalized `selectedProduct` — never from the URL, so a shared
 * component never guesses.
 */

export type AuthThemeId = 'hub' | 'vega' | 'atrium';

export interface AuthChrome {
    /** Backdrop classes replacing Modal's default overlay. */
    overlayClass: string;
    /** Card surface + border classes replacing Modal's default card. */
    cardClass: string;
    /** Top accent bar classes replacing Modal's default gradient bar. */
    accentBarClass: string;
}

export interface AuthThemeDef {
    id: AuthThemeId;
    /** Product name shown in the themed header ('' for hub — no header). */
    name: string;
    /** One-line product tagline under the name. */
    tagline: string;
    /** Mono microlabel above the form (the product's own voice). */
    microlabel: string;
    /** null = hub → Modal renders its default chrome, untouched. */
    chrome: AuthChrome | null;
    /** The product mark; hub has none (its chrome already ships). */
    Mark?: React.FC<{ className?: string; title?: string }>;
    /** Primary submit class string for the auth forms (hub = verbatim
     *  shipped string so the hub modal stays pixel-identical). */
    primaryBtn: string;
    /** Inline link class string (switch-to / forgot-password links). */
    linkBtn: string;
    /** Focus-ring swaps for the shared auth inputs (inputLarge's emerald
     *  ring only belongs to the hub register). '' = keep inputLarge as-is. */
    inputFocus: string;
}

/** The hub / native / portal theme — the modal that has always shipped.
 *  chrome: null means ModalManager passes no overrides and Modal renders
 *  its exact default surface. */
const HUB_THEME: AuthThemeDef = {
    id: 'hub',
    name: '',
    tagline: '',
    microlabel: '',
    chrome: null,
    primaryBtn:
        'bg-primary-600 text-white hover:bg-primary-700 shadow-sm',
    linkBtn: 'text-primary-600 hover:text-primary-700',
    inputFocus: '',
};

const VEGA_THEME: AuthThemeDef = {
    id: 'vega',
    name: 'Vega',
    tagline: 'The Chambers Standard — built by PracticePro.',
    microlabel: 'THE CHAMBERS STANDARD',
    chrome: {
        overlayClass: 'bg-vega-night/75 sm:backdrop-blur-md',
        cardClass: 'bg-vega-parchment border-vega-gilt/30',
        accentBarClass: 'bg-vega-gilt',
    },
    Mark: VegaMark,
    primaryBtn:
        'bg-vega-gilt text-vega-night hover:bg-vega-gilt-bright shadow-sm',
    linkBtn: 'text-vega-gilt hover:text-vega-gilt-bright',
    inputFocus: 'focus:ring-vega-gilt/60 focus:border-vega-gilt',
};

const ATRIUM_THEME: AuthThemeDef = {
    id: 'atrium',
    name: 'Atrium',
    tagline: 'The Well-Kept Estate — built by PracticePro.',
    microlabel: 'THE WELL-KEPT ESTATE',
    chrome: {
        overlayClass: 'bg-zinc-900/70 sm:backdrop-blur-md',
        cardClass: 'bg-atrium-cream border-atrium-clay/30',
        accentBarClass: 'bg-atrium-clay',
    },
    Mark: AtriumMark,
    primaryBtn:
        'bg-atrium-clay text-white hover:bg-atrium-clay-bright shadow-sm',
    linkBtn: 'text-atrium-clay-deep hover:text-atrium-clay',
    inputFocus: 'focus:ring-atrium-clay/60 focus:border-atrium-clay',
};

export const AUTH_THEMES: Record<AuthThemeId, AuthThemeDef> = {
    hub: HUB_THEME,
    vega: VEGA_THEME,
    atrium: ATRIUM_THEME,
};

/**
 * Resolve the auth theme from a modal context. Explicit `productTheme`
 * wins (set by the product sites); then the signup funnel's normalized
 * `selectedProduct` (legal → Vega, property → Atrium); anything else —
 * including 'unified'/Komplete, hub CTAs, native app and portal logins —
 * resolves to the untouched hub modal.
 */
export function resolveAuthThemeId(modalContext: any): AuthThemeId {
    const explicit = modalContext?.productTheme;
    if (explicit === 'vega' || explicit === 'atrium' || explicit === 'hub') {
        return explicit;
    }
    const product = normalizeSignupProduct(modalContext?.selectedProduct);
    if (product === 'legal') return 'vega';
    if (product === 'property') return 'atrium';
    return 'hub';
}

/**
 * AuthHeader — the themed header block rendered INSIDE the auth form
 * when a product theme is active (ModalManager hides the generic modal
 * header for these). Mark + name + tagline, and the mode line the
 * generic header used to carry ("Log in" / "Create your workspace").
 */
export const AuthHeader: React.FC<{
    theme: AuthThemeDef;
    mode: 'login' | 'signup';
}> = ({ theme, mode }) => {
    if (theme.id === 'hub' || !theme.Mark) return null;
    const ModeMark = theme.Mark;
    return (
        <div className="flex flex-col items-center text-center -mt-1 mb-5">
            <ModeMark className="h-12 w-12 mb-3" title={`${theme.name} — a PracticePro product`} />
            <h3 className="text-xl font-bold tracking-tight text-slate-900">
                {mode === 'login' ? `Log in to ${theme.name}` : `Create your ${theme.name} workspace`}
            </h3>
            <p className="text-sm text-slate-500 mt-1.5 max-w-[38ch]">{theme.tagline}</p>
            <p className="mt-3 font-mono text-2xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                {theme.microlabel}
            </p>
        </div>
    );
};
