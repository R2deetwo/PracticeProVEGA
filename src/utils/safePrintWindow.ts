export function escapeHtml(str: string | undefined | null): string {
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
export function openHtmlInNewWindow(html: string, options?: { onOpen?: (win: Window | null) => void }): Window | null {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch {} }, 60000);
    if (win && options?.onOpen) { win.addEventListener('load', () => options.onOpen!(win)); }
    return win;
}
export function openUrlSafely(url: string): Window | null {
    return window.open(url, '_blank', 'noopener,noreferrer');
}
