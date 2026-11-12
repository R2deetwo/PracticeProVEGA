/**
 * UX-12 (Phase 1): client mirror of the portal-invite origin resolver
 * (convex/portals.ts `resolvePortalBase` — keep the two lists in sync).
 *
 * The client passes `window.location.origin` to createPortalInvite /
 * resendPortalInvite so invite links point at the deployment the admin is
 * actually using (production, the Cloudflare mirror, or a Vercel preview of
 * this project) instead of a hard-coded Vega-branded domain. The server
 * re-validates against its own allowlist — this mirror exists so the UI can
 * display the SAME link the email will contain (copy-link, manual WhatsApp
 * share) without asking the server twice.
 */

const PRODUCTION_PORTAL_ORIGIN = 'https://practice-pro-vega.vercel.app';
const ALLOWED_PORTAL_ORIGINS = [
    PRODUCTION_PORTAL_ORIGIN,
    'https://practice-pro-vega.prototypechigo.workers.dev',
];
const PREVIEW_ORIGIN_PATTERN = /^https:\/\/practice-pro-vega(-[\w-]+)?\.vercel\.app$/;

/** The allowlisted origin for this deployment (falls back to production). */
export function allowedPortalOrigin(origin?: string | null): string {
    const candidate = (origin ?? '').trim().replace(/\/+$/, '');
    const allowed =
        ALLOWED_PORTAL_ORIGINS.includes(candidate) ||
        PREVIEW_ORIGIN_PATTERN.test(candidate);
    return allowed ? candidate : PRODUCTION_PORTAL_ORIGIN;
}

/** The setup-password base URL the server would use for this origin. */
export function portalSetupPasswordBase(origin?: string | null): string {
    return `${allowedPortalOrigin(origin)}/setup-password`;
}

/** The current deployment's invite link for a token. */
export function portalInviteUrl(token: string, origin?: string | null): string {
    return `${portalSetupPasswordBase(origin)}?token=${encodeURIComponent(token)}`;
}
