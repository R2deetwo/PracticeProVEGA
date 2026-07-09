/**
 * attachmentProcessor — extracts text content from uploaded documents so the
 * AI can read and analyze them.
 *
 * PROBLEM
 * =======
 * When a user uploads a PDF/DOCX/TXT to ALOA, the file is stored in Convex
 * storage. The previous approach fetched the file and passed it to Gemini as
 * `inlineData` — but this only works reliably for images. For PDFs:
 *   - Gemini's inlineData has size limits (~20MB but practically fails earlier)
 *   - btoa() fails on large binary strings
 *   - The mimeType from Convex storage is often empty or octet-stream
 *
 * SOLUTION
 * ========
 * Extract text client-side from the fetched blob:
 *   - PDF  → pdfjs-dist (already in the codebase, used by AloaXView)
 *   - DOCX → JSZip (already in IngestionAgent)
 *   - TXT/MD/CSV → FileReader.readAsText
 *   - Images (PNG/JPG) → pass as inlineData (Gemini handles natively)
 *
 * The extracted text is prepended to the message content as a context block:
 *   "--- ATTACHED DOCUMENT: filename.pdf ---\n<extracted text>\n--- END ---"
 *
 * This way the AI can read, analyze, and answer questions about the document.
 */

import * as pdfjsLib from 'pdfjs-dist';

// Configure the worker. pdfjs-dist v5+ uses a .mjs worker.
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export interface ProcessedAttachment {
  /** The original filename */
  name: string;
  /** The detected mimeType */
  mimeType: string;
  /** Extracted text content (null for images / binary-only files) */
  extractedText: string | null;
  /** Base64 data for inline pass-through (images only) */
  inlineData?: { mimeType: string; data: string };
  /** Whether text extraction succeeded */
  extracted: boolean;
  /** Error message if extraction failed */
  error?: string;
}

/**
 * Detect the true mimeType from a filename, falling back to the blob's type.
 */
function detectMimeType(filename: string, blobType: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const extMap: Record<string, string> = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    txt: 'text/plain',
    md: 'text/markdown',
    csv: 'text/csv',
    json: 'application/json',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
  };
  return extMap[ext] || blobType || 'application/octet-stream';
}

/**
 * Extract text from a PDF blob using pdfjs-dist.
 * Returns up to 50,000 characters (roughly 8,000 words / 20 pages).
 */
async function extractTextFromPdf(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const pdfDoc = await pdfjsLib.getDocument({
    data: arrayBuffer,
    disableRange: true,
    disableStream: true,
  }).promise;

  let fullText = '';
  const maxPages = Math.min(pdfDoc.numPages, 50); // Cap at 50 pages
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (pageText) {
      fullText += `--- Page ${i} ---\n${pageText}\n\n`;
    }
  }

  await pdfDoc.destroy();

  // Cap at 50k chars to stay within Gemini context limits
  if (fullText.length > 50000) {
    fullText = fullText.substring(0, 50000) + '\n\n[... document truncated at 50,000 characters ...]';
  }

  return fullText;
}

/**
 * Extract text from a DOCX blob using JSZip.
 * DOCX files are ZIP archives containing word/document.xml.
 */
async function extractTextFromDocx(blob: Blob): Promise<string> {
  try {
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(blob);
    
    // Try word/document.xml (standard location)
    let documentXml = zip.file('word/document.xml');
    
    // Some DOCX files use different paths
    if (!documentXml) {
      const files = Object.keys(zip.files);
      const docFile = files.find(f => f.includes('document.xml'));
      if (docFile) {
        documentXml = zip.file(docFile);
      }
    }
    
    if (!documentXml) return '';

    const xmlText = await documentXml.async('text');
    
    // Extract text from <w:t> tags (Word text runs)
    // Also handle <w:tab> (tabs) and <w:br> (line breaks)
    let extractedText = '';
    const paragraphs = xmlText.split(/<w:p[ >]/);
    
    for (const p of paragraphs) {
      if (!p.includes('<w:t')) continue;
      
      // Extract all text nodes
      const textMatches = p.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
      const tabCount = (p.match(/<w:tab\/>/g) || []).length;
      const breakCount = (p.match(/<w:br\/>/g) || []).length;
      
      let pText = textMatches
        .map(t => t.replace(/<[^>]+>/g, ''))
        .join('');
      
      // Add tabs
      pText = '\t'.repeat(tabCount) + pText;
      
      if (pText.trim()) {
        extractedText += pText + '\n';
      }
      
      // Add line breaks
      for (let b = 0; b < breakCount; b++) {
        extractedText += '\n';
      }
    }

    // Also check for headers and footers
    const headerFiles = Object.keys(zip.files).filter(f => f.match(/word\/header\d*\.xml/));
    const footerFiles = Object.keys(zip.files).filter(f => f.match(/word\/footer\d*\.xml/));
    
    for (const hf of [...headerFiles, ...footerFiles]) {
      try {
        const headerXml = await zip.file(hf)!.async('text');
        const headerTexts = headerXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
        const headerText = headerTexts.map(t => t.replace(/<[^>]+>/g, '')).join(' ');
        if (headerText.trim()) {
          extractedText = headerText + '\n\n' + extractedText;
        }
      } catch { /* ignore header errors */ }
    }

    if (extractedText.length > 50000) {
      extractedText = extractedText.substring(0, 50000) + '\n\n[... document truncated at 50,000 characters ...]';
    }

    return extractedText.trim();
  } catch (e) {
    console.warn('[extractTextFromDocx] Failed:', e);
    return '';
  }
}

/**
 * Extract text from a legacy .doc blob (binary OLE format).
 * Old .doc files are NOT ZIP archives — they use a binary format.
 * We extract readable text by looking for text runs in the binary data.
 */
async function extractTextFromDoc(blob: Blob): Promise<string> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    // .doc files store text as UTF-16LE or ASCII strings
    // We look for runs of printable ASCII/UTF-8 text
    let extractedText = '';
    let currentRun = '';
    
    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i];
      
      // Printable ASCII range (32-126) plus common whitespace
      if ((byte >= 32 && byte <= 126) || byte === 9 || byte === 10 || byte === 13) {
        currentRun += String.fromCharCode(byte);
      } else {
        // End of text run — save if it's long enough to be meaningful
        if (currentRun.length > 5) {
          extractedText += currentRun + '\n';
        }
        currentRun = '';
      }
    }
    // Don't forget the last run
    if (currentRun.length > 5) {
      extractedText += currentRun + '\n';
    }
    
    // Clean up: remove excessive blank lines and trim
    extractedText = extractedText
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // Remove control chars
      .trim();
    
    if (extractedText.length > 50000) {
      extractedText = extractedText.substring(0, 50000) + '\n\n[... document truncated at 50,000 characters ...]';
    }
    
    return extractedText;
  } catch (e) {
    console.warn('[extractTextFromDoc] Failed:', e);
    return '';
  }
}

/**
 * Extract text from a plain-text blob (TXT, MD, CSV, JSON).
 */
async function extractTextFromPlain(blob: Blob): Promise<string> {
  const text = await blob.text();
  if (text.length > 50000) {
    return text.substring(0, 50000) + '\n\n[... document truncated at 50,000 characters ...]';
  }
  return text;
}

/**
 * Convert a blob to base64 (for images passed as inlineData).
 * Uses chunked processing to avoid btoa() string length limits.
 */
async function blobToBase64(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const chunkSize = 0x8000; // 32KB chunks
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk) as any);
  }
  return btoa(binary);
}

/**
 * Process a single attachment: fetch from Convex storage, extract text or
 * convert to inlineData as appropriate.
 *
 * @param storageId The Convex storage ID
 * @param name The original filename
 * @param convexUrl The Convex backend URL
 */
export async function processAttachment(
  storageId: string,
  name: string,
  convexUrl: string
): Promise<ProcessedAttachment> {
  // CRITICAL FIX: Convex storage does NOT support direct HTTP GET to
  // /api/storage/{storageId}. We must use the Convex client to call the
  // getFileUrl query, which returns a signed URL that can be fetched.
  let fileUrl: string;
  try {
    const { ConvexHttpClient } = await import('convex/browser');
    const convexClient = new ConvexHttpClient(convexUrl);
    const url = await convexClient.query('myFunctions:getFileUrl' as any, { storageId });
    if (!url) {
      return {
        name,
        mimeType: 'unknown',
        extractedText: null,
        extracted: false,
        error: 'File not found in storage (storageId returned null URL)',
      };
    }
    fileUrl = url as string;
  } catch (e: any) {
    return {
      name,
      mimeType: 'unknown',
      extractedText: null,
      extracted: false,
      error: `Failed to get file URL from Convex: ${e.message || e}`,
    };
  }

  const fileRes = await fetch(fileUrl);
  if (!fileRes.ok) {
    return {
      name,
      mimeType: 'unknown',
      extractedText: null,
      extracted: false,
      error: `Failed to fetch file (HTTP ${fileRes.status})`,
    };
  }

  const blob = await fileRes.blob();
  const mimeType = detectMimeType(name, blob.type);

  try {
    // ── Images: pass as inlineData ──────────────────────────────────
    if (mimeType.startsWith('image/')) {
      const base64 = await blobToBase64(blob);
      return {
        name,
        mimeType,
        extractedText: null,
        inlineData: { mimeType, data: base64 },
        extracted: true,
      };
    }

    // ── PDF: extract text with pdfjs ────────────────────────────────
    if (mimeType === 'application/pdf') {
      const text = await extractTextFromPdf(blob);
      if (text.trim()) {
        return { name, mimeType, extractedText: text, extracted: true };
      }
      // PDF had no extractable text (scanned/image PDF) — try inlineData
      // as a fallback (Gemini can OCR some scanned PDFs)
      const base64 = await blobToBase64(blob);
      if (base64.length < 15_000_000) { // ~20MB base64 limit safety
        return {
          name,
          mimeType,
          extractedText: null,
          inlineData: { mimeType, data: base64 },
          extracted: true,
        };
      }
      return {
        name,
        mimeType,
        extractedText: null,
        extracted: false,
        error: 'PDF appears to be scanned (no text layer) and is too large for inline processing.',
      };
    }

    // ── DOCX (.docx): extract text with JSZip ──────────────────────
    if (mimeType.includes('wordprocessingml.document')) {
      const text = await extractTextFromDocx(blob);
      if (text.trim()) {
        return { name, mimeType, extractedText: text, extracted: true };
      }
      return {
        name,
        mimeType,
        extractedText: null,
        extracted: false,
        error: 'No text could be extracted from this DOCX file.',
      };
    }

    // ── DOC (.doc — legacy binary format): extract text ────────────
    if (mimeType === 'application/msword' || name.toLowerCase().endsWith('.doc')) {
      const text = await extractTextFromDoc(blob);
      if (text.trim()) {
        return { name, mimeType, extractedText: text, extracted: true };
      }
      // If .doc extraction failed, try as plain text (sometimes .doc
      // files are actually RTF or plain text with wrong extension)
      try {
        const plainText = await extractTextFromPlain(blob);
        if (plainText.trim() && !plainText.includes('\ufffd')) {
          return { name, mimeType, extractedText: plainText, extracted: true };
        }
      } catch { /* fall through */ }
      return {
        name,
        mimeType,
        extractedText: null,
        extracted: false,
        error: 'No text could be extracted from this DOC file. Try converting to DOCX or PDF.',
      };
    }

    // ── Plain text formats ──────────────────────────────────────────
    if (mimeType.startsWith('text/') || mimeType === 'application/json') {
      const text = await extractTextFromPlain(blob);
      return { name, mimeType, extractedText: text, extracted: true };
    }

    // ── Unknown type: try plain text extraction as a last resort ────
    try {
      const text = await extractTextFromPlain(blob);
      if (text.trim() && !text.includes('\ufffd')) {
        return { name, mimeType, extractedText: text, extracted: true };
      }
    } catch { /* fall through */ }

    return {
      name,
      mimeType,
      extractedText: null,
      extracted: false,
      error: `Unsupported file type: ${mimeType}`,
    };
  } catch (err: any) {
    return {
      name,
      mimeType,
      extractedText: null,
      extracted: false,
      error: err.message || 'Unknown extraction error',
    };
  }
}

/**
 * Process all attachments for a message and return Gemini-ready parts.
 *
 * Returns an object with:
 *   - textParts: array of text strings to be added to the message content
 *   - inlineParts: array of inlineData objects (for images / scanned PDFs)
 *   - errors: array of error messages for failed attachments
 */
export async function processAttachments(
  storageIds: string[],
  attachmentNames: string[] | undefined,
  convexUrl: string
): Promise<{
  textParts: string[];
  inlineParts: { inlineData: { mimeType: string; data: string } }[];
  errors: string[];
}> {
  const results = await Promise.all(
    storageIds.map((id, i) =>
      processAttachment(id, attachmentNames?.[i] || `attachment-${i}`, convexUrl)
    )
  );

  const textParts: string[] = [];
  const inlineParts: { inlineData: { mimeType: string; data: string } }[] = [];
  const errors: string[] = [];

  for (const r of results) {
    if (r.extractedText) {
      textParts.push(
        `--- ATTACHED DOCUMENT: ${r.name} ---\n${r.extractedText}\n--- END OF DOCUMENT: ${r.name} ---`
      );
    }
    if (r.inlineData) {
      inlineParts.push({ inlineData: r.inlineData });
    }
    if (!r.extracted && r.error) {
      errors.push(`${r.name}: ${r.error}`);
    }
  }

  return { textParts, inlineParts, errors };
}
