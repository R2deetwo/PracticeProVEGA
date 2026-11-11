/**
 * letterhead — standalone HTML rendering of a firm's letterhead
 * configuration (V4, V-DOC-12: "Include letterhead in print output").
 *
 * Before V4 the print pipeline wrote `<div class="letterhead"></div>` —
 * an EMPTY div whenever the firm had configured a letterhead, and the
 * Print Preview drawer was passed `letterheadHtml={undefined}`. Printed
 * and previewed documents therefore never carried the firm's letterhead
 * even though the canvas did.
 *
 * `letterheadToStaticHtml` produces the same layout as the on-canvas
 * HeaderRenderer (logo left, firm name + address block, hairline rule)
 * using only inline styles, so it works inside the print iframe and the
 * preview drawer where no React tree or Tailwind runtime exists.
 *
 * DOM-free (pure string building) — unit-testable in node vitest.
 */
import type { HeaderConfiguration } from '../types';

function esc(text: string | undefined | null): string {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Render a HeaderConfiguration to standalone HTML. Returns '' when there
 * is no meaningful configuration (nothing configured → nothing printed,
 * which is honest: no fake empty letterhead block).
 */
export function letterheadToStaticHtml(config?: HeaderConfiguration | null): string {
    if (!config) return '';

    const hasLogo = !!(config.logo && config.logo.url);
    const hasName = !!(config.firmName && typeof config.firmName.text === 'string' && config.firmName.text.trim() !== '');
    const hasAddress = !!(config.address && typeof config.address.text === 'string' && config.address.text.trim() !== '');
    if (!hasLogo && !hasName && !hasAddress) return '';

    // The canvas HeaderRenderer is a 180px-tall band. The print variant is
    // flow content (the @page margin already reserves 25mm), so we keep the
    // same visual hierarchy in a compact block: logo, name, address, rule.
    const parts: string[] = [];

    if (hasLogo) {
        const logo = config.logo!;
        parts.push(
            `<img src="${esc(logo.url)}" alt="Firm logo" style="height:${Number(logo.height ?? 80) || 80}px; width:auto; object-fit:contain;" />`
        );
    }

    if (hasName) {
        const fn = config.firmName!;
        parts.push(
            `<div style="font-family:'Times New Roman',serif; font-size:${Number(fn.fontSize ?? 24) || 24}px; font-weight:${fn.fontWeight ?? 'bold'}; color:${fn.color ?? '#000000'}; text-align:${esc(fn.alignment ?? 'left') || 'left'}; margin-top:8px;">${esc(fn.text)}</div>`
        );
    }

    if (hasAddress) {
        const ad = config.address!;
        // Read side-by-side with the name when both exist, stacked under the logo.
        parts.push(
            `<div style="font-family:'Times New Roman',serif; font-size:${Number(ad.fontSize ?? 12) || 12}px; color:#666666; opacity:0.85; white-space:pre-line; text-align:${esc(ad.alignment ?? 'left') || 'left'}; margin-top:4px;">${esc(ad.text)}</div>`
        );
    }

    return `<div class="letterhead" style="margin-bottom:16pt; text-align:left;">${parts.join('')}<div style="height:1px; background:#d4d4d4; margin-top:10px;"></div></div>`;
}

/** True when the firm has a real letterhead worth printing. */
export function hasLetterhead(config?: HeaderConfiguration | null): boolean {
    return letterheadToStaticHtml(config) !== '';
}
