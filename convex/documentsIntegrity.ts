/**
 * documentsIntegrity — V4 (V-DOC-5) server-side document fences.
 *
 * The generic CRUD path (createItem / updateItem) previously persisted
 * whatever `file` object the client sent — including multi-megabyte base64
 * data URLs inline in the row, with no size/type/shape validation, and a
 * fake `file: { dataUrl: '' }` stub on records that had no real bytes at
 * all. These fences run inside the SAME transaction as the user's save:
 *
 * CREATE (sanitizeDocumentFileForCreate):
 *   - `file` absent            → legal (content-only / marker documents).
 *   - bare string              → kept (legacy storage-id string shape read
 *                                 by the download path); length-bounded.
 *   - object WITH storageId    → validate name/type/size bounds, strip
 *                                 `dataUrl` (base64 never enters the row;
 *                                 the bytes live in Convex storage).
 *   - object WITHOUT storageId → keep { name, type, size } as an index
 *                                 marker only (honest: downloads no-op);
 *                                 `dataUrl` is stripped either way.
 *
 * UPDATE (mergeDocumentFileForUpdate) — additionally protects LEGACY rows:
 *   - incoming object with a dataUrl and no storageId is a legacy row
 *     round-tripping through a metadata edit. The patch DROPS the `file`
 *     key (db.patch semantics: the stored file is untouched) so legacy
 *     inline bytes survive until the additive backfill migrates them to
 *     storage. A file replaced with a fresh upload carries a storageId and
 *     takes the validated path.
 *
 * Versions (sanitizeDocumentVersions): bounded (≤20), shape-checked,
 * additive — rides inside the row, no schema change.
 *
 * Pure functions, no ctx — unit-tested directly in
 * tests/unit/roundV4DocumentIntegrity.test.ts.
 */

export const MAX_DOC_FILE_SIZE = 10 * 1024 * 1024; // 10MB — matches the client-side gate
export const MAX_FILE_NAME_LENGTH = 200;
export const MAX_STORAGE_ID_LENGTH = 200;
export const VERSIONS_CAP = 20;

/** Document file types the product accepts (mirrors the client allowlist). */
export const ALLOWED_DOC_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif',
]);

function extensionOf(name: unknown): string {
  const s = typeof name === 'string' ? name.toLowerCase() : '';
  const idx = s.lastIndexOf('.');
  return idx === -1 ? '' : s.substring(idx);
}

function boundedString(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  if (t === '') return undefined;
  return t.slice(0, max);
}

export interface FileSanitizeResult {
  file: any;
  strippedDataUrl: boolean;
  warnings: string[];
}

/** CREATE-path fence. Returns the file value to persist. */
export function sanitizeDocumentFileForCreate(rawFile: any): FileSanitizeResult {
  const warnings: string[] = [];
  if (rawFile === undefined || rawFile === null) {
    return { file: undefined, strippedDataUrl: false, warnings };
  }

  // Legacy bare storage-id string (portal attachment shape on some rows).
  if (typeof rawFile === 'string') {
    const storageId = boundedString(rawFile, MAX_STORAGE_ID_LENGTH);
    if (!storageId) return { file: undefined, strippedDataUrl: false, warnings: ['empty file string dropped'] };
    return { file: storageId, strippedDataUrl: false, warnings };
  }

  if (typeof rawFile !== 'object') {
    return { file: undefined, strippedDataUrl: false, warnings: [`unsupported file shape: ${typeof rawFile}`] };
  }

  const src: Record<string, any> = rawFile;
  const hadDataUrl = typeof src.dataUrl === 'string' && src.dataUrl.length > 0;
  if (hadDataUrl) warnings.push('inline dataUrl stripped (bytes belong in storage)');

  const storageId = boundedString(src.storageId, MAX_STORAGE_ID_LENGTH);
  const name = boundedString(src.name, MAX_FILE_NAME_LENGTH) ?? 'file';
  const type = boundedString(src.type, 100) ?? 'application/octet-stream';
  const size = typeof src.size === 'number' && Number.isFinite(src.size) ? Math.max(0, Math.floor(src.size)) : 0;

  if (storageId) {
    if (size > MAX_DOC_FILE_SIZE) {
      throw new Error(`File exceeds the ${Math.round(MAX_DOC_FILE_SIZE / (1024 * 1024))}MB limit (${Math.round(size / (1024 * 1024))}MB).`);
    }
    const ext = extensionOf(name);
    if (ext !== '' && !ALLOWED_DOC_EXTENSIONS.has(ext)) {
      throw new Error(`File type "${ext}" is not allowed. Supported: ${[...ALLOWED_DOC_EXTENSIONS].join(', ')}`);
    }
    return {
      file: {
        name,
        type,
        size,
        filePath: boundedString(src.filePath, 300) ?? '',
        storageId,
      },
      strippedDataUrl: hadDataUrl,
      warnings,
    };
  }

  // No storageId: an index-marker only (e.g. the rent-receipt record whose
  // PDF is generated client-side). Keep the display shape, drop any bytes.
  return {
    file: { name, type, size },
    strippedDataUrl: hadDataUrl,
    warnings,
  };
}

/**
 * UPDATE-path fence. Returns the value to patch, or the string
 * "__keep_stored__" when the incoming file is a legacy round-trip and the
 * stored file must be left untouched (the caller then deletes the key from
 * the patch entirely).
 */
export function mergeDocumentFileForUpdate(incomingFile: any, storedFile: any): { file?: any; mode: 'validated' | 'marker' | 'keep-stored' | 'absent' | 'clear' } {
  if (incomingFile === undefined) {
    return { mode: 'absent' };
  }
  if (incomingFile === null) {
    // Explicit clear (no UI does this today, but the contract allows it).
    return { file: undefined, mode: 'clear' };
  }
  if (typeof incomingFile === 'string') {
    const storageId = boundedString(incomingFile, MAX_STORAGE_ID_LENGTH);
    return storageId ? { file: storageId, mode: 'validated' } : { mode: 'keep-stored' };
  }
  if (typeof incomingFile !== 'object') {
    return { mode: 'keep-stored' };
  }

  const src: Record<string, any> = incomingFile;
  const hasDataUrl = typeof src.dataUrl === 'string' && src.dataUrl.length > 0;
  const storageId = boundedString(src.storageId, MAX_STORAGE_ID_LENGTH);

  if (storageId) {
    // Fresh upload (or a row already on storage): validated shape wins.
    const result = sanitizeDocumentFileForCreate({ ...src, dataUrl: undefined });
    return { file: result.file, mode: 'validated' };
  }

  if (hasDataUrl) {
    // Legacy inline round-trip: leave the stored file alone. The additive
    // backfill (convex/backfillDocumentFiles.ts) migrates these to storage;
    // an update must never destroy the bytes before that runs.
    return { mode: 'keep-stored' };
  }

  // Marker shape without bytes: treat as a marker update.
  const result = sanitizeDocumentFileForCreate({ ...src, dataUrl: undefined });
  return { file: result.file, mode: 'marker' };
}

/** Versions: bounded, shape-checked, additive. */
export function sanitizeDocumentVersions(rawVersions: any): any[] {
  if (!Array.isArray(rawVersions)) return [];
  const out: any[] = [];
  for (const v of rawVersions) {
    if (!v || typeof v !== 'object') continue;
    out.push({
      id: boundedString((v as any).id, 100) ?? `ver_${Date.now().toString(36)}_${out.length}`,
      title: boundedString((v as any).title, 300),
      content: typeof (v as any).content === 'string' ? (v as any).content.slice(0, 400_000) : undefined,
      file: (v as any).file && typeof (v as any).file === 'object'
        ? sanitizeDocumentFileForCreate({ ...(v as any).file, dataUrl: undefined }).file
        : (typeof (v as any).file === 'string' ? boundedString((v as any).file, MAX_STORAGE_ID_LENGTH) : undefined),
      uploadedBy: boundedString((v as any).uploadedBy, 100) ?? 'unknown',
      uploadedAt: boundedString((v as any).uploadedAt, 40) ?? new Date().toISOString(),
      changesSummary: boundedString((v as any).changesSummary, 300),
    });
    if (out.length >= VERSIONS_CAP) break;
  }
  return out;
}
