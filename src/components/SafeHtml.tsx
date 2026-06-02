import React from 'react';
import { sanitize } from '../utils/sanitization';
import { parseAloaMarkdown } from '../utils/markdownUtils';

interface SafeHtmlProps {
    html?: string;
    markdown?: string;
    className?: string;
}

/**
 * Enterprise-grade Safe HTML renderer.
 * Enforces DOMPurify sanitization globally to prevent XSS vulnerabilities.
 */
export const SafeHtml: React.FC<SafeHtmlProps> = ({ html, markdown, className }) => {
    let rawContent = '';
    
    if (markdown) {
        rawContent = parseAloaMarkdown(markdown);
    } else if (html) {
        rawContent = sanitize(html);
    }

    if (!rawContent) return null;

    return (
        <div 
            className={className} 
            dangerouslySetInnerHTML={{ __html: rawContent }} 
        />
    );
};
