import { describe, expect, it } from "vitest";
import {
    countHtmlMatches,
    escapeRegExp,
    highlightHtmlMatches,
    tokenizeHtml,
} from "../../src/components/documents/findInDocument";

describe("findInDocument (Stage 2B — find in full-screen document reader)", () => {
    it("tokenizes html into tag and text segments", () => {
        const tokens = tokenizeHtml('<p class="x">Smith &amp; Sons</p>');
        expect(tokens.filter(t => t.isTag).map(t => t.value)).toEqual(['<p class="x">', '</p>']);
        expect(tokens.filter(t => !t.isTag).map(t => t.value)).toEqual(['Smith &amp; Sons']);
    });

    it("escapes regex metacharacters in user queries", () => {
        expect(escapeRegExp("a.b*(c)+")).toBe(String.raw`a\.b\*\(c\)\+`);
    });

    it("counts case-insensitive matches in text only, never in tags or attributes", () => {
        const html = '<p title="court">Court hearing adjourned to a new court date</p>';
        expect(countHtmlMatches(html, "court")).toBe(2); // title attribute ignored
        expect(countHtmlMatches(html, "COURT")).toBe(2);
        expect(countHtmlMatches(html, "hearing")).toBe(1);
        expect(countHtmlMatches(html, "")).toBe(0);
    });

    it("never matches inside html entities", () => {
        expect(countHtmlMatches("Smith &amp; Co", "amp")).toBe(0);
        expect(countHtmlMatches("Smith &amp; Co", "Co")).toBe(1);
    });

    it("wraps matches in marks and marks the active occurrence stronger", () => {
        const html = "<p>alpha beta alpha</p>";
        const none = highlightHtmlMatches(html, "alpha", null);
        expect(none.count).toBe(2);
        expect(none.html).toContain('<mark class="pp-find-mark">alpha</mark>');
        expect(none.html).not.toContain("pp-find-active");

        const active = highlightHtmlMatches(html, "alpha", 1);
        expect(active.count).toBe(2);
        expect(active.html).toContain('<mark class="pp-find-mark pp-find-active">alpha</mark>');
        expect(active.html.match(/<mark/g)?.length).toBe(2);
    });

    it("preserves surrounding text and tags when wrapping matches", () => {
        const html = "<p>The witness<b>es</b> were absent.</p>";
        const result = highlightHtmlMatches(html, "witness", null);
        expect(result.count).toBe(1);
        expect(result.html).toBe('<p>The <mark class="pp-find-mark">witness</mark><b>es</b> were absent.</p>');
    });

    it("returns the html untouched for blank queries", () => {
        const html = "<p>same</p>";
        expect(highlightHtmlMatches(html, "   ", 0)).toEqual({ html, count: 0 });
    });

    it("escapes raw angle brackets in the matched text so the result stays valid html", () => {
        // A text segment can carry a bare ">" (tokenizer only splits on "<").
        const result = highlightHtmlMatches("<p>a > b</p>", "a > b", null);
        expect(result.count).toBe(1);
        expect(result.html).toContain("<mark class=\"pp-find-mark\">a &gt; b</mark>");
    });
});
