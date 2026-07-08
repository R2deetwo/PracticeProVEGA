interface ValidationResult {
  valid: boolean;
  sanitized: string;
  issues: string[];
}

const BLOCK_TAGS = ['p', 'div', 'table', 'tr', 'td', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'section', 'article'];

export function validateStreamedHtml(html: string): ValidationResult {
  const issues: string[] = [];

  if (!html || !html.trim()) {
    return { valid: false, sanitized: '', issues: ['Empty input'] };
  }

  // 1. Parse with DOMParser
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(html, 'text/html');
  } catch (e) {
    return { valid: false, sanitized: '', issues: ['DOMParser threw exception'] };
  }

  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    return { valid: false, sanitized: '', issues: ['Parser error: ' + parserError.textContent?.slice(0, 100)] };
  }

  // 2. Tag balance check
  const openCounts: Record<string, number> = {};
  const closeCounts: Record<string, number> = {};
  for (const tag of BLOCK_TAGS) {
    openCounts[tag] = (html.match(new RegExp(`<${tag}[\\s>]`, 'gi')) || []).length;
    closeCounts[tag] = (html.match(new RegExp(`</${tag}>`, 'gi')) || []).length;
    if (openCounts[tag] !== closeCounts[tag]) {
      issues.push(`Unmatched <${tag}>: ${openCounts[tag]} open, ${closeCounts[tag]} close`);
    }
  }

  // 3. Truncation check — ends mid-tag
  const trimmed = html.trimEnd();
  const lastOpen = trimmed.lastIndexOf('<');
  if (lastOpen !== -1 && lastOpen > trimmed.lastIndexOf('>')) {
    issues.push('Content ends mid-tag (truncated)');
  }

  if (issues.length === 0) {
    return { valid: true, sanitized: html, issues: [] };
  }

  // 4. Attempt repair — truncate to last fully-closed top-level block
  try {
    const body = doc.body;
    const children = Array.from(body.children);
    // Walk backwards, find the last child that is a complete element
    let lastValidIndex = -1;
    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i];
      const tag = child.tagName.toLowerCase();
      if (BLOCK_TAGS.includes(tag)) {
        // Check if this element is complete (has closing tag)
        const outerHTML = child.outerHTML;
        if (outerHTML.endsWith(`</${tag}>`)) {
          lastValidIndex = i;
          break;
        }
      }
    }

    if (lastValidIndex >= 0) {
      const repairedChildren = children.slice(0, lastValidIndex + 1);
      const repairedHTML = repairedChildren.map(c => c.outerHTML).join('\n');
      // Re-validate
      const reCheck = validateStreamedHtml(repairedHTML);
      if (reCheck.valid) {
        return {
          valid: true,
          sanitized: reCheck.sanitized,
          issues: [...issues, `Auto-repaired: dropped ${children.length - lastValidIndex - 1} incomplete trailing element(s)`],
        };
      }
    }
  } catch {
    // Repair failed
  }

  // 5. Repair failed
  return { valid: false, sanitized: '', issues: [...issues, 'Auto-repair failed'] };
}
