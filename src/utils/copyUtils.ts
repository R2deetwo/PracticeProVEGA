/**
 * copyUtils — utilities for handling copy events on rich-text content.
 *
 * PROBLEM:
 * ALOA messages are rendered as HTML (via dangerouslySetInnerHTML +
 * parseAloaMarkdown). The on-screen rendering looks perfect — bold,
 * italic, lists, headings, line breaks all display correctly.
 *
 * But when the user selects text and presses Ctrl+C / Cmd+C, the
 * browser copies the PLAIN TEXT version — which still contains the
 * raw markdown syntax (**bold**, *italic*, ### headings, - list items)
 * because those characters are in the text content of the HTML elements.
 *
 * The result: pasted text looks like "**Important:** \n* Item one\n*
 * Item two" instead of "Important: \nItem one\nItem two".
 *
 * SOLUTION:
 * Intercept the `copy` event on message containers. When the user copies:
 *   1. Get the Selection as both HTML and plain text
 *   2. Convert the HTML to clean plain text (strip markdown syntax,
 *      preserve line breaks, list formatting, heading structure)
 *   3. Write the clean text to the clipboard via ClipboardEvent.clipboardData
 *
 * This ensures pasted text matches what the user sees on screen.
 */

/**
 * Convert an HTML string to clean, well-formatted plain text.
 * Strips markdown syntax, preserves structure (headings, lists, line breaks).
 */
export function htmlToCleanPlainText(html: string): string {
    if (!html) return '';

    // Create a temporary DOM element to parse the HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Walk the DOM tree and build clean text
    const result: string[] = [];

    function walk(node: Node, context: { inList?: 'ul' | 'ol'; listIndex?: number } = {}) {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent || '';
            if (text.trim()) {
                result.push(text);
            }
            return;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return;

        const el = node as HTMLElement;
        const tag = el.tagName.toLowerCase();

        // Block-level elements — add line breaks
        const blockTags = ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'tr'];
        if (blockTags.includes(tag)) {
            if (result.length > 0 && result[result.length - 1] !== '\n') {
                result.push('\n');
            }
        }

        // Headings — preserve as uppercase or with markdown-style # prefix
        if (tag.match(/^h[1-6]$/)) {
            const level = parseInt(tag[1]);
            const prefix = '#'.repeat(level) + ' ';
            result.push(prefix);
            for (const child of Array.from(el.childNodes)) {
                walk(child, context);
            }
            result.push('\n\n');
            return;
        }

        // List items
        if (tag === 'li') {
            const parent = el.parentElement;
            const isOrdered = parent?.tagName.toLowerCase() === 'ol';
            if (isOrdered && context.listIndex !== undefined) {
                result.push(`${context.listIndex}. `);
            } else {
                result.push('• ');
            }
            const childContext = { ...context };
            for (const child of Array.from(el.childNodes)) {
                walk(child, childContext);
            }
            result.push('\n');
            return;
        }

        // Ordered list — track item index
        if (tag === 'ol') {
            let idx = 1;
            for (const child of Array.from(el.childNodes)) {
                if (child.nodeType === Node.ELEMENT_NODE && (child as HTMLElement).tagName.toLowerCase() === 'li') {
                    walk(child, { inList: 'ol', listIndex: idx++ });
                } else {
                    walk(child, context);
                }
            }
            return;
        }

        if (tag === 'ul') {
            for (const child of Array.from(el.childNodes)) {
                if (child.nodeType === Node.ELEMENT_NODE && (child as HTMLElement).tagName.toLowerCase() === 'li') {
                    walk(child, { inList: 'ul' });
                } else {
                    walk(child, context);
                }
            }
            return;
        }

        // Bold/strong — just include the text (no ** markers)
        if (tag === 'strong' || tag === 'b') {
            for (const child of Array.from(el.childNodes)) {
                walk(child, context);
            }
            return;
        }

        // Italic/em — just include the text (no * markers)
        if (tag === 'em' || tag === 'i') {
            for (const child of Array.from(el.childNodes)) {
                walk(child, context);
            }
            return;
        }

        // Line break
        if (tag === 'br') {
            result.push('\n');
            return;
        }

        // Links — include the text, and optionally the URL
        if (tag === 'a') {
            const href = el.getAttribute('href');
            const linkText = el.textContent || '';
            if (href && href !== linkText && href.startsWith('http')) {
                result.push(`${linkText} (${href})`);
            } else {
                result.push(linkText);
            }
            return;
        }

        // Citation pills — just include the text
        if (tag === 'span' && el.className.includes('rounded-full')) {
            result.push(`[${el.textContent || ''}]`);
            return;
        }

        // Blockquote
        if (tag === 'blockquote') {
            for (const child of Array.from(el.childNodes)) {
                walk(child, context);
            }
            result.push('\n');
            return;
        }

        // Table cells
        if (tag === 'td' || tag === 'th') {
            for (const child of Array.from(el.childNodes)) {
                walk(child, context);
            }
            result.push('\t');
            return;
        }

        // Default — recurse into children
        for (const child of Array.from(el.childNodes)) {
            walk(child, context);
        }
    }

    walk(temp);

    // Clean up the result
    let text = result.join('');

    // Remove any remaining markdown syntax that might have leaked through
    text = text
        .replace(/\*\*(.*?)\*\*/g, '$1')  // **bold** → bold
        .replace(/(?<!\s)\*(?!\s|\*)/g, '') // *italic* → italic (single asterisks)
        .replace(/^#{1,6}\s/gm, '')         // # headings → plain (already have prefix)
        .replace(/\n{3,}/g, '\n\n')         // collapse multiple blank lines
        .trim();

    return text;
}

/**
 * Attach a copy event handler to a container element that ensures
 * copied text is clean plain text (no markdown syntax, proper line breaks).
 *
 * Usage:
 *   <div ref={ref} onCopy={handleCleanCopy}>...</div>
 *
 * Or attach directly:
 *   useEffect(() => {
 *     const el = ref.current;
 *     if (!el) return;
 *     const handler = createCleanCopyHandler();
 *     el.addEventListener('copy', handler);
 *     return () => el.removeEventListener('copy', handler);
 *   }, []);
 */
export function createCleanCopyHandler() {
    return (e: ClipboardEvent) => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) return;

        // Get the selected HTML
        const range = selection.getRangeAt(0);
        const fragment = range.cloneContents();
        const container = document.createElement('div');
        container.appendChild(fragment);

        const html = container.innerHTML;
        const cleanText = htmlToCleanPlainText(html);

        // Override the clipboard data with our clean text
        if (e.clipboardData) {
            e.clipboardData.setData('text/plain', cleanText);
            // Also set text/html so rich-text paste targets (Word, Gmail)
            // can preserve formatting if they want
            e.clipboardData.setData('text/html', html);
            e.preventDefault();
        }
    };
}

/**
 * React event handler version of the clean copy handler.
 * Use this directly in JSX: <div onCopy={handleCleanCopy}>
 */
export function handleCleanCopy(e: React.ClipboardEvent) {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    const fragment = range.cloneContents();
    const container = document.createElement('div');
    container.appendChild(fragment);

    const html = container.innerHTML;
    const cleanText = htmlToCleanPlainText(html);

    if (e.clipboardData) {
        e.clipboardData.setData('text/plain', cleanText);
        e.clipboardData.setData('text/html', html);
        e.preventDefault();
    }
}
