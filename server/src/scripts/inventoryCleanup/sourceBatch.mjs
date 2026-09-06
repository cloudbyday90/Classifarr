/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { lockScopedRepairLibraries } from '../libraryScopedRepair/locking.mjs';
import { sourcePredicate } from './contract.mjs';

export function cleanupPredicate(kind) {
    return `${sourcePredicate(kind)}${kind === 'prune' ? ` AND NOT EXISTS(SELECT 1 FROM scoped_repair_lab.cleanup_seen seen
        WHERE seen.job_id=$2 AND seen.external_id=s.external_id)` : ' AND $2::uuid IS NOT NULL'}`;
}

/** Caller holds job lock. Select without row locks, declare libraries, then compare actual source revisions. */
export async function deleteCleanupSourceBatch(db, job, budget) {
    const predicate = cleanupPredicate(job.kind);
    const candidates = (await db.query(`SELECT s.id,s.library_id,s.xmin::text revision
        FROM scoped_repair_lab.scoped_repair_source s WHERE ${predicate}
        AND s.id>$3 AND s.id<=$4 ORDER BY s.id LIMIT $5`, [job.target_id, job.id, job.cursor_id, job.high_id, budget])).rows;
    if (!candidates.length) return null;
    await lockScopedRepairLibraries(db, 'disposable', candidates.map(row => row.library_id), 'write');
    const counts = { deleted: 0, moved: 0, absent: 0, changed: 0 };
    for (const row of candidates) {
        const result = await db.query(`DELETE FROM scoped_repair_lab.scoped_repair_source s WHERE ${predicate}
            AND s.id=$3 AND s.library_id IS NOT DISTINCT FROM $4::integer AND s.xmin::text=$5`,
        [job.target_id, job.id, row.id, row.library_id, row.revision]);
        if (result.rowCount) counts.deleted++;
        else {
            const current = (await db.query('SELECT library_id,media_server_id FROM scoped_repair_lab.scoped_repair_source WHERE id=$1', [row.id])).rows[0];
            if (!current) counts.absent++;
            else if (job.kind === 'server' ? current.media_server_id !== job.target_id : current.library_id !== job.target_id) counts.moved++;
            else counts.changed++;
        }
    }
    return (await db.query(`UPDATE scoped_repair_lab.cleanup_jobs SET cursor_id=$2,visited=visited+$3,
        deleted=deleted+$4,moved=moved+$5,absent=absent+$6,changed=changed+$7 WHERE id=$1 RETURNING *`,
    [job.id, candidates.at(-1).id, candidates.length, counts.deleted, counts.moved, counts.absent, counts.changed])).rows[0];
}
