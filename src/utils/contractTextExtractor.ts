/**
 * contractTextExtractor — file → plain text for the DraftPro analyzer (R48).
 *
 * Same extraction stack the rest of the app already uses (no new deps):
 *   .pdf  → pdfjs-dist (the attachmentProcessor pattern, worker configured
 *            identically so the worker is shared, not duplicated)
 *   .docx → JSZip + word/document.xml (the IngestionAgent pattern)
 *   .txt/.md → read directly
 *
 * Pure utility for useContractAnalysis; deliberately not unit-tested (it is
 * a thin wrapper over browser libraries) — the analysis engine and the
 * audit engine carry the tested logic.
 */

import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';

// Configure the worker — same expression as attachmentProcessor.ts so Vite
// resolves a single worker asset for both modules.
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
).toString();

const MAX_CHARS = 60000; // ~100 pages; analysis quality caps long before this

export type ExtractedContract = {
    text: string;
    kind: 'pdf' | 'docx' | 'txt';
};

export async function extractContractText(file: File): Promise<ExtractedContract> {
    const name = file.name.toLowerCase();
    if (name.endsWith('.pdf') || file.type === 'application/pdf') {
        return { text: await extractPdf(file), kind: 'pdf' };
    }
    if (name.endsWith('.docx') || name.endsWith('.doc')) {
        return { text: await extractDocx(file), kind: 'docx' };
    }
    if (name.endsWith('.txt') || name.endsWith('.md') || file.type.startsWith('text/')) {
        return { text: (await file.text()).slice(0, MAX_CHARS), kind: 'txt' };
    }
    throw new Error('Unsupported file type — upload a .docx, .pdf or .txt contract.');
}

async function extractPdf(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    const maxPages = Math.min(pdfDoc.numPages, 60);
    for (let i = 1; i <= maxPages; i++) {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = (textContent.items as Array<{ str?: string }>)
            .map((item) => item.str ?? '')
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (pageText) fullText += `${pageText}\n\n`;
    }
    await pdfDoc.destroy();
    if (!fullText.trim()) {
        throw new Error('No selectable text in this PDF — it may be a scan. Upload a text-based PDF or a .docx.');
    }
    return fullText.slice(0, MAX_CHARS);
}

async function extractDocx(file: File): Promise<string> {
    const zip = await JSZip.loadAsync(file);
    const documentXml = zip.file('word/document.xml');
    if (!documentXml) throw new Error('This .docx has no readable document body.');
    const xmlText = await documentXml.async('text');
    const paragraphs = xmlText.match(/<w:p.*?>.*?<\/w:p>/g) || [];
    let out = '';
    for (const p of paragraphs) {
        const textNodes = p.match(/<w:t.*?>.*?<\/w:t>/g) || [];
        if (textNodes.length > 0) {
            out += textNodes.map((t) => t.replace(/<[^>]+>/g, '')).join('') + '\n';
        }
    }
    if (!out.trim()) throw new Error('No text could be extracted from this .docx.');
    return out.slice(0, MAX_CHARS);
}
