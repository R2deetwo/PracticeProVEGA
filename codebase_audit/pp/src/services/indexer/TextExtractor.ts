// ALOA-X: Text Extractor — PDF page → raw text OR base64 image
export class TextExtractor {
  /**
   * Extract text from a range of pages in a PDF document.
   * Returns formatted string with page markers.
   */
  async extractFromPages(pdfDoc: any, startPage: number, endPage: number): Promise<string> {
    const textParts: string[] = [];
    const safEnd = Math.min(endPage, pdfDoc.numPages);

    for (let pageNum = startPage; pageNum <= safEnd; pageNum++) {
      try {
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();

        let pageText = '';
        let lastY: number | null = null;

        for (const item of textContent.items as any[]) {
          const str: string = item.str || '';
          const y: number = item.transform?.[5] ?? 0;
          if (lastY !== null && Math.abs(y - lastY) > 5) pageText += '\n';
          pageText += str;
          lastY = y;
        }

        textParts.push(`[PAGE ${pageNum}]\n${pageText.trim()}`);
      } catch (err) {
        console.warn(`TextExtractor: skipped page ${pageNum} — ${err}`);
        textParts.push(`[PAGE ${pageNum}]\n[TEXT EXTRACTION FAILED]`);
      }
    }

    return textParts.join('\n\n');
  }

  /**
   * Quick extraction of first N pages for classification only.
   */
  async extractFirstPages(pdfDoc: any, count = 3): Promise<string> {
    return this.extractFromPages(pdfDoc, 1, Math.min(count, pdfDoc.numPages));
  }

  /**
   * Render a single PDF page to a base64 JPEG image using canvas.
   * Used when text extraction yields sparse/empty content (scanned PDFs).
   */
  async renderPageToImage(pdfDoc: any, pageNum: number, scale = 1.5): Promise<string | null> {
    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);

      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      await page.render({ canvasContext: ctx, viewport }).promise;

      // Return base64 data only (no data:image/jpeg;base64, prefix)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
      return dataUrl.split(',')[1] ?? null;
    } catch (err) {
      console.warn(`TextExtractor: image render failed for page ${pageNum}:`, err);
      return null;
    }
  }

  /**
   * Check text density across a range of pages.
   * Returns average characters per page.
   */
  async getTextDensity(pdfDoc: any, startPage: number, endPage: number): Promise<number> {
    let totalChars = 0;
    const pages = Math.min(endPage, pdfDoc.numPages) - startPage + 1;

    for (let i = startPage; i <= Math.min(endPage, pdfDoc.numPages); i++) {
      try {
        const page = await pdfDoc.getPage(i);
        const content = await page.getTextContent();
        totalChars += content.items.reduce((sum: number, item: any) => sum + (item.str?.length ?? 0), 0);
      } catch { /* skip */ }
    }

    return pages > 0 ? totalChars / pages : 0;
  }

  /**
   * Quick check: is this PDF likely a scanned image?
   */
  async isLikelyScanned(pdfDoc: any): Promise<boolean> {
    const density = await this.getTextDensity(pdfDoc, 1, Math.min(3, pdfDoc.numPages));
    return density < 50;
  }
}
