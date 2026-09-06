/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { lockScopedRepairLibraries } from '../libraryScopedRepair/locking.mjs';

export async function stepParentDependents(db, job, budget) {
    if (job.kind === 'prune') return { job, used: 0 };
    const predicate = job.kind === 'server' ? 'd.media_server_id=$1' : 'd.library_id=$1';
    let deleted = 0, detached = 0;
    for (const table of ['cleanup_collections', 'cleanup_status']) {
        if (deleted === budget) break;
        const result = await db.query(`WITH batch AS (SELECT d.id FROM scoped_repair_lab.${table} d WHERE ${predicate} ORDER BY d.id LIMIT $2 FOR UPDATE)
            DELETE FROM scoped_repair_lab.${table} d USING batch b WHERE d.id=b.id`, [job.target_id, budget - deleted]);
        deleted += result.rowCount;
    }
    if (deleted < budget) {
        const scope = job.kind === 'server' ? 'l.media_server_id=$1' : 'l.id=$1';
        const rows = (await db.query(`SELECT h.id,h.library_id FROM scoped_repair_lab.cleanup_history h
            JOIN scoped_repair_lab.sync_libraries l ON l.id=h.library_id WHERE ${scope} ORDER BY h.id LIMIT $2`, [job.target_id, budget - deleted])).rows;
        await lockScopedRepairLibraries(db, 'disposable', rows.map(row => row.library_id), 'write');
        detached = (await db.query(`UPDATE scoped_repair_lab.cleanup_history h SET library_id=NULL,
            status=CASE WHEN h.status='completed' THEN 'failed' ELSE h.status END,
            error_message=CASE WHEN h.status='completed' THEN COALESCE(h.error_message,'Library was deleted after this item was classified') ELSE h.error_message END,
            library_name=CASE WHEN h.status='completed' THEN COALESCE(h.library_name,l.name) ELSE h.library_name END
            FROM scoped_repair_lab.sync_libraries l WHERE h.library_id=l.id AND ${scope} AND h.id=ANY($2::integer[])`,
        [job.target_id, rows.map(row => row.id)])).rowCount;
    }
    const next = (await db.query(`UPDATE scoped_repair_lab.cleanup_jobs SET dependents_deleted=dependents_deleted+$2,
        history_detached=history_detached+$3 WHERE id=$1 RETURNING *`, [job.id, deleted, detached])).rows[0];
    return { job: next, used: deleted + detached };
}
