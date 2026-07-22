/**
 * htmlToPdfBlob — Convert HTML content to a PDF Blob in the browser.
 *
 * Approach: We use a hidden iframe, write the HTML to it with @page CSS,
 * then call iframe.contentWindow.print(). The user saves as PDF.
 *
 * HOWEVER — for in-app preview without user intervention, we need a
 * server-side renderer (Puppeteer). For now, this utility produces a
 * PRINTED PDF (user clicks "Save as PDF" in print dialog).
 *
 * For AUTOMATIC server-side HTML→PDF rendering, see the ANTI-GRAVITY
 * pipeline (Convex action + Vercel function with Puppeteer).
 *
 * In the meantime, for preview purposes, we render the HTML directly
 * via HtmlPagePreview (legacy) OR we pass the HTML to a printable
 * iframe and let the user save as PDF.
 */
import { sanitize } from './sanitization';

export interface HtmlToPdfOptions {
    title?: string;
    /** Page size: 'A4' (default) or 'Letter' */
    pageSize?: 'A4' | 'Letter';
    /** Margins in mm */
    margin?: number;
}

/**
 * Open a print window with the HTML content. The user can then save as PDF
 * via the browser's print dialog. This produces a vector PDF with proper
 * page breaks.
 */
export function printHtmlAsPdf(html: string, options: HtmlToPdfOptions = {}): void {
    const { title = 'Document', pageSize = 'A4', margin = 25 } = options;
    const cleanHtml = sanitize(html);
    const printWin = window.open('', '_blank');
    if (!printWin) {
        alert('Please allow pop-ups to print documents.');
        return;
    }
    const fullDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>
        @page { size: ${pageSize}; margin: ${margin}mm; }
        body {
            font-family: 'Times New Roman', serif;
            font-size: 12pt;
            line-height: 1.5;
            color: #1a1a1a;
        }
        h1 { font-size: 16pt; font-weight: bold; margin: 16pt 0 8pt; break-after: avoid; }
        h2 { font-size: 14pt; font-weight: bold; margin: 14pt 0 6pt; break-after: avoid; }
        h3 { font-size: 12pt; font-weight: bold; margin: 12pt 0 4pt; break-after: avoid; }
        p { margin: 0 0 8pt; text-align: justify; orphans: 2; widows: 2; }
        ul, ol { margin: 0 0 8pt; padding-left: 20pt; }
        li { margin-bottom: 4pt; }
        table { width: 100%; border-collapse: collapse; margin: 8pt 0; }
        td, th { border: 1px solid #ccc; padding: 4pt 8pt; }
        th { background: #f5f5f5; font-weight: bold; }
        strong { font-weight: bold; }
        em { font-style: italic; }
        u { text-decoration: underline; }
        sup { font-size: 0.7em; vertical-align: super; }
    </style>
    </head><body>${cleanHtml}</body></html>`;
    printWin.document.write(fullDoc);
    printWin.document.close();
    setTimeout(() => { printWin.print(); }, 500);
}

/**
 * For in-app PDF preview without user intervention, we'd need server-side
 * rendering. As a stopgap, this function returns a data: URL for a simple
 * HTML wrapper that can be loaded into an iframe for "preview mode".
 *
 * TODO (ANTI-GRAVITY pipeline): Replace this with a real server-side
 * HTML→PDF render via Puppeteer on Vercel serverless.
 */
export function wrapHtmlForIframePreview(html: string, title: string = 'Document'): string {
    const cleanHtml = sanitize(html);
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>
        body {
            font-family: 'Times New Roman', serif;
            font-size: 12pt;
            line-height: 1.5;
            color: #1a1a1a;
            margin: 0;
            padding: 25mm;
            max-width: 210mm;
            margin: 0 auto;
        }
        h1 { font-size: 16pt; font-weight: bold; margin: 16pt 0 8pt; }
        h2 { font-size: 14pt; font-weight: bold; margin: 14pt 0 6pt; }
        h3 { font-size: 12pt; font-weight: bold; margin: 12pt 0 4pt; }
        p { margin: 0 0 8pt; text-align: justify; }
        ul, ol { margin: 0 0 8pt; padding-left: 20pt; }
        li { margin-bottom: 4pt; }
        table { width: 100%; border-collapse: collapse; margin: 8pt 0; }
        td, th { border: 1px solid #ccc; padding: 4pt 8pt; }
        th { background: #f5f5f5; font-weight: bold; }
        strong { font-weight: bold; }
        em { font-style: italic; }
        u { text-decoration: underline; }
        sup { font-size: 0.7em; vertical-align: super; }
    </style>
    </head><body>${cleanHtml}</body></html>`;
}
