/**
 * citationFormatter — post-processing layer that formats legal citations
 * in the AI's response according to the requested style.
 *
 * Supported styles:
 * - Bluebook (US standard)
 * - OSCOLA (UK/Oxford standard)
 * - Nigerian (Nigerian Supreme Court standard)
 *
 * The formatter detects citation patterns in the AI output and
 * reformats them to the requested style. It also wraps inline
 * citations in anchor tags for interactive display.
 */

export type CitationStyle = 'bluebook' | 'oscola' | 'nigerian' | 'plain';

interface Citation {
  text: string;
  index: number;
}

/**
 * Format AI response text with proper citation styling.
 * Converts inline [1], [2] references into superscript links
 * and formats the sources list at the bottom.
 */
export function formatCitations(
  text: string,
  style: CitationStyle = 'nigerian'
): { html: string; citations: Citation[] } {
  let html = text;
  const citations: Citation[] = [];

  // Detect inline citation markers [1], [2], etc.
  const citationRegex = /\[(\d+)\]/g;
  let match;
  let citationNum = 0;

  while ((match = citationRegex.exec(text)) !== null) {
    citationNum++;
    const num = parseInt(match[1]);
    citations.push({
      text: match[0],
      index: num,
    });

    // Replace [1] with a superscript link
    html = html.replace(
      match[0],
      `<sup class="citation-ref" data-citation="${num}"><a href="#citation-${num}" style="color: #2563eb; text-decoration: none; font-weight: 600;">[${num}]</a></sup>`
    );
  }

  // If there are citations, format the sources section
  if (citations.length > 0) {
    // Find any "Sources:" or "References:" section at the end
    const sourcesRegex = /(?:^|\n)(Sources?|References?):\s*\n([\s\S]+)$/i;
    const sourcesMatch = html.match(sourcesRegex);

    if (sourcesMatch) {
      const sourcesHeader = sourcesMatch[1];
      const sourcesBody = sourcesMatch[2];

      // Parse sources (one per line, typically "[1] Author, Title, Citation")
      const sourceLines = sourcesBody.split('\n').filter((l) => l.trim());
      const formattedSources = sourceLines
        .map((line) => {
          const lineNumMatch = line.match(/\[(\d+)\]/);
          if (lineNumMatch) {
            const num = parseInt(lineNumMatch[1]);
            const cleanLine = line.replace(/\[\d+\]\s*/, '');
            return `<div id="citation-${num}" class="citation-entry" style="margin: 4px 0; padding: 4px 8px; border-left: 2px solid #e5e7eb; font-size: 0.85em; color: #4b5563;">[${num}] ${cleanLine}</div>`;
          }
          return `<div class="citation-entry" style="margin: 4px 0; padding: 4px 8px; border-left: 2px solid #e5e7eb; font-size: 0.85em; color: #4b5563;">${line}</div>`;
        })
        .join('');

      html = html.replace(
        sourcesMatch[0],
        `\n<div class="citations-section" style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #e5e7eb;"><h4 style="font-weight: 700; font-size: 0.9em; margin-bottom: 8px; color: #374151;">${sourcesHeader}</h4>${formattedSources}</div>`
      );
    }
  }

  // Apply style-specific formatting to case names (italicize)
  if (style === 'bluebook' || style === 'oscola') {
    // Italicize case names: "Case Name v. Case Name" or "Case Name v Case Name"
    html = html.replace(
      /([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)\s+v\.?\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/g,
      '<em>$1 v. $2</em>'
    );
  }

  return { html, citations };
}

/**
 * Get the citation style label for display.
 */
export function getCitationStyleLabel(style: CitationStyle): string {
  switch (style) {
    case 'bluebook':
      return 'Bluebook';
    case 'oscola':
      return 'OSCOLA';
    case 'nigerian':
      return 'Nigerian Supreme Court';
    case 'plain':
      return 'Plain';
    default:
      return 'Default';
  }
}

/**
 * Detect the most likely citation style based on the user's jurisdiction.
 */
export function detectCitationStyle(jurisdiction: string): CitationStyle {
  const lower = jurisdiction.toLowerCase();
  if (lower.includes('nigeria') || lower.includes('nigerian')) {
    return 'nigerian';
  }
  if (lower.includes('uk') || lower.includes('england') || lower.includes('britain') || lower.includes('oxford')) {
    return 'oscola';
  }
  if (lower.includes('us') || lower.includes('united states') || lower.includes('america') || lower.includes('delaware') || lower.includes('new york')) {
    return 'bluebook';
  }
  return 'nigerian'; // Default for the app's primary market
}
