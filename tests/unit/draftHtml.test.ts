/**
 * draftHtml tests — the shared deterministic post-processing pipeline
 * (2026-09-24, user feedback round 3: "weird gaps in the drafts so they
 * do not look professional or well formatted — sort this out once and
 * for all").
 *
 * The models sometimes emit empty paragraphs, <br><br> spacing, markdown
 * bold and code fences despite prompt instructions. These tests pin the
 * deterministic cleanup that every AI draft now passes through, in both
 * DraftProEditor and ALOA's background packet drafting.
 */
import { describe, it, expect } from 'vitest';
import {
    cleanDraftHtml,
    placeholdersToSpans,
    finalizeDraftHtml,
    draftHasSubstance,
    guessPlaceholderCategory,
} from '../../src/utils/draftHtml';

describe('cleanDraftHtml — the "weird gaps" fix', () => {
    it('strips empty paragraphs wherever they appear', () => {
        const raw = '<p></p><p>First real paragraph.</p><p></p><p>Second.</p><p></p>';
        expect(cleanDraftHtml(raw)).toBe('<p>First real paragraph.</p><p>Second.</p>');
    });

    it('strips &nbsp;-only and whitespace-only paragraphs', () => {
        const raw = '<p>&nbsp;</p><p>Real text</p><p>   </p>';
        expect(cleanDraftHtml(raw)).toBe('<p>Real text</p>');
    });

    it('strips paragraphs containing only a <br>', () => {
        const raw = '<p>Intro</p><p><br></p><p>Body</p>';
        expect(cleanDraftHtml(raw)).toBe('<p>Intro</p><p>Body</p>');
    });

    it('converts doubled <br><br> into a real paragraph break (not a gap line)', () => {
        const raw = '<p>Line one.<br><br>Line two after a gap.</p>';
        const out = cleanDraftHtml(raw);
        expect(out).toContain('</p><p>');
        expect(out).not.toContain('<br');
        expect(out).toContain('Line one.');
        expect(out).toContain('Line two after a gap.');
    });

    it('keeps a single soft <br> inside a paragraph (no gap intended)', () => {
        const raw = '<p>Line one.<br>Line two.</p>';
        expect(cleanDraftHtml(raw)).toBe('<p>Line one.<br>Line two.</p>');
    });

    it('strips ```html fences the model was told not to use', () => {
        const raw = '```html\n<p>Fenced draft.</p>\n```';
        expect(cleanDraftHtml(raw)).toContain('<p>Fenced draft.</p>');
        expect(cleanDraftHtml(raw)).not.toContain('```');
    });

    it('converts markdown bold to real <strong>', () => {
        const raw = '<p>This is <strong>important</strong> and stays.</p>';
        expect(cleanDraftHtml(raw)).toBe('<p>This is <strong>important</strong> and stays.</p>');
    });

    it('handles literal \\n escapes and stray \\r', () => {
        const raw = '<p>One.</p>\\n<p>Two.</p>\r\n<p>Three.</p>';
        const out = cleanDraftHtml(raw);
        expect(out).toContain('One.');
        expect(out).toContain('Two.');
        expect(out).toContain('Three.');
        expect(out).not.toContain('\\n');
        expect(out).not.toContain('\r');
    });

    it('removes multi-space runs between tags but never inside sentences', () => {
        const raw = '<p>Keep this   spacing.</p>    <p>Next.</p>';
        const out = cleanDraftHtml(raw);
        expect(out).toContain('Keep this   spacing.');
        expect(out).not.toMatch(/>\s{2,}</);
    });

    it('returns empty string for empty input', () => {
        expect(cleanDraftHtml('')).toBe('');
    });

    it('cleans a realistic gappy affidavit excerpt end-to-end', () => {
        const raw = [
            '```html',
            '<p style="text-align:center;"><strong>IN THE HIGH COURT OF LAGOS STATE</strong></p>',
            '<p></p>',
            '<p style="text-align:center;">HOLDEN AT LAGOS</p>',
            '<p><br></p>',
            '<p>I, [DEPONENT NAME], make oath and say:</p>',
            '<p>1. That I am the deponent.<br><br>2. That I know the facts.</p>',
            '<p>&nbsp;</p>',
            '```',
        ].join('\n');
        const out = cleanDraftHtml(raw);
        expect(out).not.toContain('```');
        expect(out).not.toMatch(/<p(\s[^>]*)?>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/i);
        expect(out).toContain('IN THE HIGH COURT OF LAGOS STATE');
        // The <br><br> between numbered facts became a paragraph break.
        expect(out).toContain('</p><p>2. That I know the facts.</p>');
    });
});

describe('placeholdersToSpans', () => {
    it('converts bracketed placeholders into legal-placeholder spans', () => {
        const out = placeholdersToSpans('<p>To [TENANT NAME] of [PROPERTY ADDRESS].</p>');
        expect(out).toContain('data-type="legal-placeholder"');
        expect(out).toContain('data-label="TENANT NAME"');
        expect(out).toContain('data-label="PROPERTY ADDRESS"');
        expect(out).not.toContain('[TENANT NAME]');
    });

    it('keeps citation markers like [1] as plain text', () => {
        const out = placeholdersToSpans('<p>See the authorities [1] and [12].</p>');
        expect(out).not.toContain('legal-placeholder');
        expect(out).toContain('[1]');
        expect(out).toContain('[12]');
    });

    it('guesses sensible categories', () => {
        expect(guessPlaceholderCategory('Tenant Full Name')).toBe('parties');
        expect(guessPlaceholderCategory('Date of Service')).toBe('dates');
        expect(guessPlaceholderCategory('Rent Amount')).toBe('financial');
        expect(guessPlaceholderCategory('Property Address')).toBe('location');
        expect(guessPlaceholderCategory('Suit Number')).toBe('court');
        expect(guessPlaceholderCategory('Number of Days')).toBe('freetext');
    });
});

describe('finalizeDraftHtml + draftHasSubstance', () => {
    it('runs cleanup then placeholder conversion', () => {
        const out = finalizeDraftHtml('```html\n<p></p><p>Draft for [CLIENT NAME].</p>\n```');
        expect(out).toContain('data-label="CLIENT NAME"');
        expect(out).not.toContain('<p></p>');
    });

    it('treats a real draft as substantial', () => {
        expect(draftHasSubstance('<p>A properly drafted demand letter with real content here.</p>')).toBe(true);
    });

    it('rejects empty/whitespace/tag-only output', () => {
        expect(draftHasSubstance('')).toBe(false);
        expect(draftHasSubstance('<p></p>')).toBe(false);
        expect(draftHasSubstance('<p>&nbsp;  </p>')).toBe(false);
        expect(draftHasSubstance('<p>Short.</p>')).toBe(false);
    });
});
