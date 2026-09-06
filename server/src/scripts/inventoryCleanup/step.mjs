/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { cleanupBudget, cleanupId, parentTable, CLEANUP_LOCK_NAMESPACE } from './contract.mjs';
import { cleanupTransaction } from './transaction.mjs';
import { readCleanupJob } from './jobs.mjs';
import { cleanupPredicate, deleteCleanupSourceBatch } from './sourceBatch.mjs';
import { lockScopedRepairLibraries } from '../libraryScopedRepair/locking.mjs';

async function finishCleanup(db, job) {
    const remaining = (await db.query(`SELECT EXISTS(SELECT 1 FROM scoped_repair_lab.scoped_repair_source s
        WHERE ${cleanupPredicate(job.kind)}) remaining`, [job.target_id, job.id])).rows[0].remaining;
    if (remaining) {
        // An optimistic conflict cannot disappear behind a cursor or be called complete.
        return (await db.query(`UPDATE scoped_repair_lab.cleanup_jobs SET cursor_id=0,
            high_id=(SELECT COALESCE(max(id),0) FROM scoped_repair_lab.scoped_repair_source)
            WHERE id=$1 RETURNING *`, [job.id])).rows[0];
    }
    if (job.kind === 'server') {
        const library = (await db.query('SELECT id FROM scoped_repair_lab.sync_libraries WHERE media_server_id=$1 ORDER BY id LIMIT 1', [job.target_id])).rows[0];
        if (library) {
            await lockScopedRepairLibraries(db, 'disposable', [library.id], 'write');
            await db.query('DELETE FROM scoped_repair_lab.sync_libraries WHERE id=$1', [library.id]);
            return (await db.query('UPDATE scoped_repair_lab.cleanup_jobs SET parents_deleted=parents_deleted+1 WHERE id=$1 RETURNING *', [job.id])).rows[0];
        }
    }
    const table = parentTable(job.kind);
    if (job.kind === 'prune') await db.query(`UPDATE ${table} SET cleanup_job=NULL WHERE id=$1 AND cleanup_job=$2`, [job.target_id, job.id]);
    else {
        if (job.kind === 'library') await lockScopedRepairLibraries(db, 'disposable', [job.target_id], 'write');
        await db.query(`DELETE FROM ${table} WHERE id=$1 AND cleanup_job=$2`, [job.target_id, job.id]);
    }
    return (await db.query(`UPDATE scoped_repair_lab.cleanup_jobs SET state='completed',completed_at=clock_timestamp(),
        parents_deleted=parents_deleted+$2 WHERE id=$1 RETURNING *`, [job.id, job.kind === 'prune' ? 0 : 1])).rows[0];
}

/** One bounded transaction. Completion is a separate, fenced absence check, never an empty skipped batch. */
export async function stepInventoryCleanup(db, id, { budget = 128 } = {}) {
    cleanupId(id); cleanupBudget(budget);
    return cleanupTransaction(db, async () => {
        const owner = await readCleanupJob(db, id);
        await db.query('SELECT pg_advisory_xact_lock($1::integer,$2::integer)', [CLEANUP_LOCK_NAMESPACE, owner.server_id]);
        const job = await readCleanupJob(db, id, true);
        if (job.state === 'completed') return job;
        if (job.state !== 'running') throw new Error('Cleanup is not ready for deletion');
        const gate = (await db.query(`SELECT cleanup_job FROM ${parentTable(job.kind)} WHERE id=$1`, [job.target_id])).rows[0];
        if (gate?.cleanup_job !== job.id) throw new Error('Cleanup admission fence is missing');
        return await deleteCleanupSourceBatch(db, job, budget) ?? finishCleanup(db, job);
    });
}
