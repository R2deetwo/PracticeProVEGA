/**
 * convexUpload — utility for uploading files to Convex storage.
 *
 * Convex provides a simple file storage system:
 *   1. Call `generateUploadUrl` mutation to get a one-time upload URL
 *   2. POST the file Blob to that URL
 *   3. Receive a `storageId` in the response
 *   4. Store the `storageId` on your document record
 *   5. Later, use `${VITE_CONVEX_URL}/api/storage/${storageId}` to access the file
 *
 * This utility wraps that flow in a single function.
 */

/**
 * Upload a Blob to Convex storage.
 *
 * P1 FIX: Added 2-minute timeout. Was hanging forever on slow networks.
 *
 * @param blob The file data as a Blob
 * @param generateUploadUrlFn The Convex mutation function (from useMutation)
 * @returns The storageId string
 */
const UPLOAD_TIMEOUT_MS = 120_000; // 2 minutes

export async function uploadBlobToConvex(
    blob: Blob,
    generateUploadUrlFn: () => Promise<string>
): Promise<string> {
    const postUrl = await generateUploadUrlFn();

    // P1 FIX: Add timeout so uploads don't hang forever
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), UPLOAD_TIMEOUT_MS);

    try {
        const res = await fetch(postUrl, {
            method: 'POST',
            body: blob,
            signal: timeoutController.signal,
        });
        if (!res.ok) {
            // Read error details if available
            let errorDetail = '';
            try {
                const errBody = await res.json();
                errorDetail = errBody?.message || errBody?.error || '';
            } catch { /* ignore */ }
            throw new Error(`Upload failed: ${res.status} ${res.statusText}${errorDetail ? ` — ${errorDetail}` : ''}`);
        }
        const { storageId } = await res.json();
        return storageId;
    } catch (err: any) {
        if (err?.name === 'AbortError') {
            throw new Error(`Upload timed out after ${UPLOAD_TIMEOUT_MS / 1000}s. Check your network connection and try again.`);
        }
        throw err;
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Get the public URL for a stored file.
 *
 * @param storageId The storageId from Convex storage
 * @returns The URL to access the file
 */
export function getStorageFileUrl(storageId: string): string {
    const convexUrl = import.meta.env.VITE_CONVEX_URL || 'https://gregarious-malamute-537.convex.cloud';
    return `${convexUrl}/api/storage/${storageId}`;
}

/**
 * Download a file from Convex storage by its storageId.
 * Fetches the file and triggers a browser download.
 *
 * P1 FIX: Added 2-minute timeout.
 *
 * @param storageId The storageId from Convex storage
 * @param filename The name to save the file as
 */
export async function downloadFromConvex(storageId: string, filename: string): Promise<void> {
    const url = getStorageFileUrl(storageId);
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), UPLOAD_TIMEOUT_MS);
    try {
        const res = await fetch(url, { signal: timeoutController.signal });
        if (!res.ok) {
            throw new Error(`Failed to download: ${res.status}`);
        }
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
        if (err?.name === 'AbortError') {
            throw new Error(`Download timed out after ${UPLOAD_TIMEOUT_MS / 1000}s.`);
        }
        throw err;
    } finally {
        clearTimeout(timeoutId);
    }
}
