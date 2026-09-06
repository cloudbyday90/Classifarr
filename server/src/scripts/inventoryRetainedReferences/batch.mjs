/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { lockScopedRepairLibraries } from '../libraryScopedRepair/locking.mjs';
import { RETAINED_REFERENCES } from './definitions.mjs';

/** The caller holds the schema contract and job/coordinator locks in a cleanup transaction. */
export async function stepRetainedReferences(db, job, budget) {
    if (job.kind === 'prune' || budget === 0) return { job, used: 0 };
    const scope = job.kind === 'server' ? 'l.media_server_id=$1' : 'l.id=$1';
    let used = 0;
    for (const { table, column, counter } of RETAINED_REFERENCES) {
        if (used === budget) break;
        const rows = (await db.query(`SELECT r.id,r.${column} library_id FROM scoped_repair_lab.${table} r
            JOIN scoped_repair_lab.sync_libraries l ON l.id=r.${column} WHERE ${scope}
            ORDER BY r.id LIMIT $2`, [job.target_id, budget - used])).rows;
        if (!rows.length) continue;
        await lockScopedRepairLibraries(db, 'disposable', rows.map(row => row.library_id), 'write');
        const result = await db.query(`UPDATE scoped_repair_lab.${table} r SET ${column}=NULL,
            library_snapshot=scoped_repair_lab.retained_library_snapshot(r.${column},$3)
            FROM scoped_repair_lab.sync_libraries l WHERE r.${column}=l.id AND ${scope}
                AND r.id=ANY($2::integer[])`, [job.target_id, rows.map(row => row.id), job.id]);
        used += result.rowCount;
        job = (await db.query(`UPDATE scoped_repair_lab.cleanup_jobs SET ${counter}=${counter}+$2
            WHERE id=$1 RETURNING *`, [job.id, result.rowCount])).rows[0];
    }
    return { job, used };
}
