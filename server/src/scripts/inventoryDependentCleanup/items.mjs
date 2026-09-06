/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { cleanupPredicate } from '../inventoryCleanup/sourceBatch.mjs';
import { lockScopedRepairLibraries } from '../libraryScopedRepair/locking.mjs';

async function reserveItem(db, job) {
    const claim = (await db.query(`SELECT c.item_id id,c.source_revision revision,s.library_id
        FROM scoped_repair_lab.cleanup_item_claims c JOIN scoped_repair_lab.scoped_repair_source s ON s.id=c.item_id WHERE c.job_id=$1`, [job.id])).rows[0];
    const row = claim ?? (await db.query(`SELECT s.id,s.library_id,s.xmin::text revision FROM scoped_repair_lab.scoped_repair_source s
        WHERE ${cleanupPredicate(job.kind)} AND s.id>$3 AND s.id<=$4 ORDER BY s.id LIMIT 1`, [job.target_id, job.id, job.cursor_id, job.high_id])).rows[0];
    if (!row) return null;
    await lockScopedRepairLibraries(db, 'disposable', [row.library_id], 'write');
    const current = (await db.query(`SELECT s.id FROM scoped_repair_lab.scoped_repair_source s WHERE ${cleanupPredicate(job.kind)}
        AND s.id=$3 AND s.library_id IS NOT DISTINCT FROM $4::integer AND s.xmin::text=$5 FOR UPDATE`,
    [job.target_id, job.id, row.id, row.library_id, row.revision])).rows[0];
    if (!current) {
        if (claim) throw new Error('Reserved cleanup source changed');
        const moved = (await db.query('SELECT library_id,media_server_id FROM scoped_repair_lab.scoped_repair_source WHERE id=$1', [row.id])).rows[0];
        const out = moved && (job.kind === 'server' ? moved.media_server_id !== job.target_id : moved.library_id !== job.target_id);
        const next = (await db.query(`UPDATE scoped_repair_lab.cleanup_jobs SET cursor_id=$2,visited=visited+1,
            moved=moved+$3,absent=absent+$4,changed=changed+$5 WHERE id=$1 RETURNING *`, [job.id, row.id, out ? 1 : 0, moved ? 0 : 1, moved && !out ? 1 : 0])).rows[0];
        return { skipped: next };
    }
    if (!claim) await db.query('INSERT INTO scoped_repair_lab.cleanup_item_claims(item_id,job_id,source_revision) VALUES($1,$2,$3)', [row.id, job.id, row.revision]);
    return { row, newlyReserved: !claim };
}

export async function stepItemDependents(db, job, budget) {
    const reserved = await reserveItem(db, job);
    if (!reserved) return null;
    if (reserved.skipped) return reserved.skipped;
    let dependents = 0, deleted = 0;
    for (const table of ['cleanup_retries', 'cleanup_previews']) {
        if (dependents === budget) break;
        const result = await db.query(`WITH batch AS (SELECT id FROM scoped_repair_lab.${table} WHERE item_id=$1 ORDER BY id LIMIT $2 FOR UPDATE)
            DELETE FROM scoped_repair_lab.${table} d USING batch b WHERE d.id=b.id`, [reserved.row.id, budget - dependents]);
        dependents += result.rowCount;
    }
    if (dependents < budget) {
        await db.query('DELETE FROM scoped_repair_lab.cleanup_item_claims WHERE item_id=$1 AND job_id=$2', [reserved.row.id, job.id]);
        const result = await db.query('DELETE FROM scoped_repair_lab.scoped_repair_source WHERE id=$1 AND xmin::text=$2', [reserved.row.id, reserved.row.revision]);
        if (result.rowCount !== 1) throw new Error('Reserved source deletion was not exact');
        deleted = 1;
    }
    return (await db.query(`UPDATE scoped_repair_lab.cleanup_jobs SET visited=visited+$2,deleted=deleted+$3,
        dependents_deleted=dependents_deleted+$4,cursor_id=CASE WHEN $3=1 THEN $5 ELSE cursor_id END WHERE id=$1 RETURNING *`,
    [job.id, reserved.newlyReserved ? 1 : 0, deleted, dependents, reserved.row.id])).rows[0];
}
