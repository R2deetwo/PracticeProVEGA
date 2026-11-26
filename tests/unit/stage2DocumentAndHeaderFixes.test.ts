/**
 * Stage 2 regression pins (2026-11-25) — the four GitHub-agent task groups
 * the owner asked to be verified and completed:
 *
 *   2A — Documents dark-mode contrast + bracketed-title pill wrapping
 *   2B — full-screen document reader: selection, find, and the portal fix
 *         for the lingering "Documents" header over the viewer
 *   2C — landing Kanban copy retired (see websiteRepositioning.test.ts),
 *         Research header simplified, Contract Analyzer tab icon removed
 *   2D — Messages "New Message" pill centered; Help Center duplicate copy
 *         removed; page headers aligned (Research matches Tasks rhythm)
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = join(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(join(repoRoot, ...p), "utf-8");

describe("Stage 2A — Documents dark-mode contrast + bracketed pills", () => {
    it("the Documents master-row litigation pill carries dark text/border variants in every branch", () => {
        const list = read("src", "components", "DocumentList.tsx");
        expect(list).toContain("dark:text-green-300 dark:border-green-800");
        expect(list).toContain("dark:text-blue-300 dark:border-blue-800");
        expect(list).toContain("dark:text-orange-300 dark:border-orange-800");
        expect(list).toContain("dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700");
    });

    it("bracketed qualifiers render as their own fully-wrapping pill on document rows", () => {
        const list = read("src", "components", "DocumentList.tsx");
        expect(list).toContain("splitBracketedTitle");
        expect(list).toContain("whitespace-normal break-words rounded-md");
    });

    it("the matter documents tab extension badge is readable in dark mode", () => {
        const tab = read("src", "components", "details", "DocumentsTab.tsx");
        expect(tab).toContain("dark:text-zinc-300 font-black uppercase tracking-widest bg-slate-100 dark:bg-zinc-800");
    });

    it("the breadcrumb keeps the whole bracketed phrase instead of clipping mid-bracket", () => {
        const crumbs = read("src", "components", "Breadcrumbs.tsx");
        expect(crumbs).toContain("splitBracketedTitle");
        expect(crumbs).toContain("whitespace-normal break-words");
    });
});

describe("Stage 2B — full-screen document reader: selection, find, portal", () => {
    it("the full-screen preview modal portals to document.body so no pane header can overlap it", () => {
        const modal = read("src", "components", "documents", "DocumentPreviewModal.tsx");
        expect(modal).toContain("createPortal");
        expect(modal).toContain("document.body");
        expect(modal).toContain("Z_CLASS.modalPeak");
    });

    it("the HTML page sheets are selectable and carry the find machinery", () => {
        const preview = read("src", "components", "documents", "HtmlPagePreview.tsx");
        expect(preview).toContain('className="html-page-sheet selectable"');
        expect(preview).toContain("countHtmlMatches");
        expect(preview).toContain("highlightHtmlMatches");
        expect(preview).toContain("Find in document");
        expect(preview).toContain("Ctrl/Cmd+F opens the in-document find bar");
    });

    it("the PDF viewer renders the pdf.js text layer for selection and find", () => {
        const viewer = read("src", "components", "documents", "PdfViewer.tsx");
        expect(viewer).toContain("pdfjsLib.TextLayer");
        expect(viewer).toContain("renderPdfTextLayer");
        expect(viewer).toContain("highlightTextLayerMatches");
        expect(viewer).toContain("Find in document");
        expect(viewer).toContain("textLayer selectable");
    });

    it("the textLayer css ships with the pdf.js viewer rules and find mark styles", () => {
        const css = read("src", "index.css");
        expect(css).toContain(".textLayer {");
        expect(css).toContain(".textLayer :is(span, br)");
        expect(css).toContain("mark.pp-pdf-find");
        expect(css).toContain("--total-scale-factor");
    });
});

describe("Stage 2C/2D — header uniformity and copy cleanup", () => {
    it("Research header: plain title, no icon box, no redundant subtitle, Tasks-matched height", () => {
        const research = read("src", "components", "ResearchView.tsx");
        expect(research).toContain('<h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Research</h2>');
        expect(research).toContain("py-2.5 px-4 sm:px-6 lg:px-8");
        expect(research).not.toContain("PracticePro Research</p>");
        expect(research).not.toContain("{tab.id === 'contract_analyzer' && <ScalesIcon");
    });

    it("Messages: the New Message pill is vertically centered with balanced padding", () => {
        const messages = read("src", "components", "MessagesView.tsx");
        expect(messages).toContain('className="px-4 py-2.5 bg-primary-600 text-white rounded-lg');
        expect(messages).not.toContain("text-xs font-bold min-h-[40px]");
        expect(messages).toContain('aria-label="New Message"');
    });

    it("Help Center: the repeated 'Find answers' intro is gone — the header says it once", () => {
        const help = read("src", "components", "HelpView.tsx");
        // The rendered subtitle exists exactly once (the only other mention is
        // this task's own code comment, not rendered copy).
        const rendered = help.match(/>Find answers and master workflows\.</g) ?? [];
        expect(rendered.length).toBe(1);
        expect(help).not.toContain("Find answers, master workflows, and learn how to get the most out of PracticePro.");
    });
});
