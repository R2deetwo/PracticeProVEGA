/**
 * documentVersions — the V4 (V-DOC-13) version-history engine.
 *
 * Before V4 the `versions` field on documents was declared in the schema
 * and the client type, and written by nothing. Every committed edit
 * silently overwrote the prior state; there was no way to see or restore
 * what a document said last week.
 *
 * This module is the pure, testable core:
 *   buildVersionSnapshot — snapshot the PRIOR state of a document before
 *     a committed change overwrites it (what changed, who did it, when).
 *   capVersions           — bounded, newest-first list (default 20).
 *   restoreFromVersion    — the update payload that restores a prior
 *     version WITHOUT discarding the current state (the current state is
 *     snapshotted first, so a restore is itself reversible).
 *   summarizeChanges      — the human-readable change summary.
 *
 * Riding inside the document row via the generic updateItem path means
 * no schema change: the `versions` column already exists
 * (v.optional(v.array(v.any())) in convex/schema.ts).
 */
import type { Document, DocumentVersion, FileDetails } from '../types';

export const VERSIONS_CAP = 20;

/** Snapshot the prior state of a document before an edit overwrites it. */
export function buildVersionSnapshot(
    prior: Pick<Document, 'title' | 'content' | 'file' | 'matter' | 'categoryId'> & {
        versions?: DocumentVersion[];
    },
    next: Pick<Document, 'title' | 'content' | 'file' | 'matter' | 'categoryId'>,
    actorId: string,
    nowIso: string,
): DocumentVersion {
    return {
        id: `ver_${nowIso}_${Math.random().toString(36).slice(2, 10)}`,
        title: prior.title,
        content: prior.content,
        file: prior.file,
        uploadedBy: actorId,
        uploadedAt: nowIso,
        changesSummary: summarizeChanges(prior, next),
    };
}

/** Human-readable summary of what the committed change actually changed. */
export function summarizeChanges(
    prior: Pick<Document, 'title' | 'content' | 'file' | 'categoryId' | 'matter'>,
    next: Pick<Document, 'title' | 'content' | 'file' | 'categoryId' | 'matter'>,
): string {
    const changes: string[] = [];
    if ((prior.title || '') !== (next.title || '')) changes.push('title');
    if ((prior.content || '') !== (next.content || '')) changes.push('content');
    if ((prior.file?.storageId || prior.file?.dataUrl || '') !== (next.file?.storageId || next.file?.dataUrl || '')) changes.push('file');
    if ((prior.categoryId || '') !== (next.categoryId || '')) changes.push('folder');
    if ((prior.matter?.id || '') !== (next.matter?.id || '')) changes.push('matter link');
    if (changes.length === 0) return 'No material change';
    return `Changed ${changes.join(', ')}`;
}

/** Bounded, newest-first list. */
export function capVersions(versions: DocumentVersion[], cap: number = VERSIONS_CAP): DocumentVersion[] {
    const list = Array.isArray(versions) ? versions.filter((v) => v && typeof v === 'object') : [];
    return list.slice(0, cap);
}

/**
 * The update payload that restores a prior version. The CURRENT state is
 * snapshotted into the history first (by the caller, via
 * buildVersionSnapshot) so a restore is reversible like any other change.
 */
export interface RestoredVersion {
    title?: string;
    content?: string;
    file?: FileDetails;
}
export function restoreFromVersion(
    version: DocumentVersion,
    actorId: string,
    nowIso: string,
): RestoredVersion {
    void actorId; void nowIso; // reserved for the audit extension; the current-state snapshot is built by the caller
    return {
        title: version.title,
        // Restoring a version restores what THAT version carried; older
        // snapshots have no content field (pre-V4 rows) — undefined leaves
        // the current content untouched instead of silently blanking it.
        content: version.content,
        file: version.file,
    };
}

/** Oldest-first view for UIs that want chronological order. */
export function chronologicalVersions(versions: DocumentVersion[]): DocumentVersion[] {
    return [...(versions || [])].reverse();
}
