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
 * @param blob The file data as a Blob
 * @param generateUploadUrlFn The Convex mutation function (from useMutation)
 * @returns The storageId string
 */
export async function uploadBlobToConvex(
    blob: Blob,
    generateUploadUrlFn: () => Promise<string>
): Promise<string> {
    const postUrl = await generateUploadUrlFn();

    // 2-minute upload timeout. Large PDFs / audio recordings on slow
    // Nigerian mobile networks can legitimately take a while, but if we
    // pass 2 minutes the connection is effectively dead and continuing to
    // wait just leaks an open socket + a hung UI spinner. Aborting lets
    // the caller surface a clear "Upload timed out" message and retry.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120_000);

    let res: Response;
    try {
        res = await fetch(postUrl, {
            method: 'POST',
            body: blob,
            signal: controller.signal,
        });
    } catch (e: any) {
        clearTimeout(timeoutId);
        if (e?.name === 'AbortError') {
            throw new Error('Upload timed out.');
        }
        throw e;
    }

    clearTimeout(timeoutId);

    if (!res.ok) {
        throw new Error(`Upload failed: ${res.status} ${res.statusText}`);
    }
    const { storageId } = await res.json();
    return storageId;
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
 * @param storageId The storageId from Convex storage
 * @param filename The name to save the file as
 */
export async function downloadFromConvex(storageId: string, filename: string): Promise<void> {
    const url = getStorageFileUrl(storageId);
    const res = await fetch(url);
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
}
