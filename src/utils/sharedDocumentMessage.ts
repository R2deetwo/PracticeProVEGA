/**
 * sharedDocumentMessage — V4 (V-DOC-18) repair of the document-sharing
 * destination.
 *
 * The pre-V4 ShareDocumentModal appended a raw markdown sentinel
 * `\n\n[FILE: <title>](<documentId>)` to the chat message. The thread then
 * rendered that as literal text — the recipient saw markdown gibberish and
 * could not open the shared document from where it landed.
 *
 * The sentinel format is kept (the sidebar preview already keys on it, and
 * old messages stay renderable); this module parses it into a structured
 * shared-document reference that message surfaces render as a real chip.
 *
 * DOM-free — unit-testable in node vitest.
 */

export interface SharedDocumentRef {
    title: string;
    documentId: string;
}

const SENTINEL = /\[FILE:\s*([^\]]{1,300})\]\(([^)\s]{1,200})\)/;

/** Parse the first shared-document marker in a message, if any. */
export function parseSharedDocumentMessage(content: string | null | undefined): SharedDocumentRef | null {
    if (!content) return null;
    const m = SENTINEL.exec(content);
    if (!m) return null;
    return { title: m[1].trim(), documentId: m[2].trim() };
}

/** The message text with the sentinel marker removed (for clean display). */
export function stripSharedDocumentMarker(content: string | null | undefined): string {
    if (!content) return '';
    return content.replace(SENTINEL, '').replace(/\n{3,}/g, '\n\n').trim();
}

/** Build the marker the ShareDocumentModal appends (kept for compat). */
export function buildSharedDocumentMarker(title: string, documentId: string): string {
    return `\n\n[FILE: ${title}](${documentId})`;
}
