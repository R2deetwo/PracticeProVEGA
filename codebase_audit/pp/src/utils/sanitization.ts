import DOMPurify from 'dompurify';

/**
 * Sanitizes a string to prevent XSS attacks.
 * It removes any potentially malicious HTML or script tags, but allows a safe subset for rich content.
 * @param dirty The string input to sanitize.
 * @returns A clean, safe string.
 */
export const sanitize = (dirty: string | undefined | null): string => {
    if (!dirty) {
        return '';
    }
    // Allow a safe subset of HTML tags for rich content display from Quill and logs, plus markdown formats
    return DOMPurify.sanitize(dirty, { 
        ALLOWED_TAGS: ['p', 'strong', 'em', 'u', 'ol', 'ul', 'li', 'br', 'b', 'i', 'span', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'div', 'code', 'pre', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
        ALLOWED_ATTR: ['class', 'href', 'target', 'data-task-title', 'title', 'style']
    });
};

/**
 * Sanitizes all string properties of an object recursively.
 * @param obj The object to sanitize.
 * @returns The sanitized object.
 */
export const sanitizeObject = <T extends object>(obj: T): T => {
    const sanitizedObj: any = Array.isArray(obj) ? [] : {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const value = obj[key as keyof T];
            if (typeof value === 'string') {
                sanitizedObj[key] = sanitize(value);
            } else if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
                sanitizedObj[key] = sanitizeObject(value as unknown as object);
            } else {
                sanitizedObj[key] = value;
            }
        }
    }
    return sanitizedObj as T;
};
