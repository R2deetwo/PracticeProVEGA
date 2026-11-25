import { expect, test } from '@playwright/test';

/**
 * Task 97 (2026-11-25) — landing video seat, chat-box focus square,
 * common-questions default, and widget product parity, verified against
 * the local preview build:
 *
 *   1. The /vega hero video band sits FLUSH under the fixed header —
 *      the band's top edge == the header's bottom edge (the retired
 *      top-24 de-shove left a header-height white gap).
 *   2. Opening the ALOA panel does NOT paint a focus outline around
 *      the auto-focused chat textarea (the old global green :focus-visible
 *      square; text entries are excluded now).
 *   3. The COMMON QUESTIONS drawer starts COLLAPSED (aria-expanded=false).
 *   4. The Vega panel's accents are Vega blue (send button + header wash),
 *      never the corporate green ramp.
 *
 * Read-only + anonymous: no account is created and no mutation is fired.
 */

/** A focus outline is visually absent when the style is none OR the color
 *  is transparent (Tailwind's outline-none = 2px solid transparent). */

test('the /vega hero video band starts flush under the fixed header', async ({ page }) => {
    await page.goto('/vega');
    await page.waitForTimeout(1500);

    // The fixed header (h-16 + safe-area) and the video band (the first
    // aspect-video element in the hero section).
    const header = page.locator('header').first();
    const band = page.locator('section#home .aspect-video').first();
    await expect(header).toBeVisible();
    await expect(band).toBeVisible();

    const headerBox = await header.boundingBox();
    const bandBox = await band.boundingBox();
    expect(headerBox).not.toBeNull();
    expect(bandBox).not.toBeNull();

    // Flush: the band's top must sit at (or within 2px of) the header's
    // bottom — the retired top-24 left a ~96px white gap between them.
    const gap = bandBox!.y - (headerBox!.y + headerBox!.height);
    expect(Math.abs(gap)).toBeLessThanOrEqual(2);
});

test('ALOA panel: no focus square on the chat composer, drawer collapsed, Vega-blue accents', async ({ page }) => {
    await page.goto('/vega');
    const fab = page.locator('button[aria-label^="Ask ALOA"]').last();
    await fab.waitFor({ state: 'visible', timeout: 20_000 });
    await fab.click();

    const input = page.locator('textarea[aria-label*="Your question"]').first();
    await input.waitFor({ state: 'visible', timeout: 10_000 });
    await page.waitForTimeout(600); // the autofocus settles

    // 1. NO visible outline on the auto-focused textarea (the green square bug).
    const outlineVisible = await input.evaluate((el: HTMLElement) => {
        const cs = getComputedStyle(el);
        const invisible = cs.outlineStyle === 'none' || cs.outlineColor === 'rgba(0, 0, 0, 0)' || cs.outlineColor === 'transparent';
        return { invisible, style: cs.outlineStyle, color: cs.outlineColor, width: cs.outlineWidth };
    });
    expect(outlineVisible.invisible, `textarea outline visible: style=${outlineVisible.style} color=${outlineVisible.color}`).toBe(true);
    const composerOutline = await input.evaluate((el: HTMLElement) => {
        const box = (el.closest('div') as HTMLElement) ?? el;
        const cs = getComputedStyle(box);
        const invisible = cs.outlineStyle === 'none' || cs.outlineColor === 'rgba(0, 0, 0, 0)' || cs.outlineColor === 'transparent';
        return { invisible, style: cs.outlineStyle, color: cs.outlineColor };
    });
    expect(composerOutline.invisible, `composer outline visible: style=${composerOutline.style} color=${composerOutline.color}`).toBe(true);

    // 2. The common-questions drawer starts collapsed.
    const toggle = page.getByRole('button', { name: /Common questions/i });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    // And no chip is rendered while collapsed.
    expect(await page.locator('button', { hasText: 'Show me how Vega tracks court matters' }).count()).toBe(0);

    // 3. The send button is Vega blue, never the corporate green.
    const send = page.getByRole('button', { name: 'Send question' });
    await expect(send).toBeVisible();
    const bg = await send.evaluate((el: HTMLElement) => getComputedStyle(el).backgroundColor);
    expect(bg).toBe('rgb(30, 58, 138)'); // #1E3A8A — the Vega register

    // 4. The placeholder fits on one line: no vertical scrollbar.
    const overflow = await input.evaluate((el: HTMLTextAreaElement) => el.scrollHeight <= el.clientHeight + 2);
    expect(overflow).toBe(true);
});

test('the Atrium (ARIA) panel mirrors the same fixes with emerald accents', async ({ page }) => {
    await page.goto('/atrium');
    const fab = page.locator('button[aria-label^="Ask ARIA"], button[aria-label^="Ask ALOA"]').last();
    await fab.waitFor({ state: 'visible', timeout: 20_000 });
    await fab.click();

    const input = page.locator('textarea[aria-label*="Your question"]').first();
    await input.waitFor({ state: 'visible', timeout: 10_000 });
    await page.waitForTimeout(600);

    const outlineVisible = await input.evaluate((el: HTMLElement) => {
        const cs = getComputedStyle(el);
        const invisible = cs.outlineStyle === 'none' || cs.outlineColor === 'rgba(0, 0, 0, 0)' || cs.outlineColor === 'transparent';
        return { invisible, style: cs.outlineStyle, color: cs.outlineColor };
    });
    expect(outlineVisible.invisible, `textarea outline visible: style=${outlineVisible.style} color=${outlineVisible.color}`).toBe(true);

    const toggle = page.getByRole('button', { name: /Common questions/i });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    const send = page.getByRole('button', { name: 'Send question' });
    const bg = await send.evaluate((el: HTMLElement) => getComputedStyle(el).backgroundColor);
    expect(['rgb(5, 150, 105)', 'rgb(12, 122, 87)']).toContain(bg); // atrium emerald / jade
});
