/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { withScopedRepairLibraries } from '../libraryScopedRepair/locking.mjs';
import { createScopedSyncAdapter } from '../inventoryWriterCompatibility/syncAdapter.mjs';
import { persistSyncedMediaItem } from '../../services/mediaSyncItemPersistence.mjs';
import { stepInventoryCleanup } from './step.mjs';

export async function seedCleanupItems(db, { serverId = 1, libraryId = 1, count, prefix = 'fixture-' }) {
    for (let offset = 1; offset <= count; offset += 128) {
        await withScopedRepairLibraries(db, 'disposable', [libraryId], 'write', () =>
            db.query(`INSERT INTO scoped_repair_lab.scoped_repair_source(media_server_id,library_id,external_id,title,media_type,metadata)
                SELECT $1,$2,$3||n::text,'Cleanup fixture','movie','{}'::jsonb FROM generate_series($4::integer,$5::integer) n`,
            [serverId, libraryId, prefix, offset, Math.min(count, offset + 127)]));
    }
}

export function syncCleanupItem(db, { serverId = 1, libraryId = 1, externalId = 'new-item' } = {}) {
    return persistSyncedMediaItem(serverId, libraryId, { external_id: externalId, title: 'Cleanup fixture', media_type: 'movie', metadata: {} },
        { query: createScopedSyncAdapter(db), analyze: async () => ({ analyzed: false }) });
}

export async function drainCleanup(db, job, budget = 128) {
    let steps = 0, maxSourceDeletes = 0, maxParentDeletes = 0;
    while (job.state !== 'completed') {
        if (++steps > 10000) throw new Error('Cleanup fixture step limit exceeded');
        const next = await stepInventoryCleanup(db, job.id, { budget });
        const sourceDeletes = Number(next.deleted) - Number(job.deleted), parentDeletes = Number(next.parents_deleted) - Number(job.parents_deleted);
        if (sourceDeletes + parentDeletes > budget) throw new Error('Cleanup mutation budget exceeded');
        maxSourceDeletes = Math.max(maxSourceDeletes, sourceDeletes); maxParentDeletes = Math.max(maxParentDeletes, parentDeletes);
        job = next;
    }
    return { job, steps, maxSourceDeletes, maxParentDeletes };
}
