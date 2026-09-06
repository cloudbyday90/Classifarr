/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { cleanupId, cleanupTarget, manifestIds, parentTable, sourcePredicate, CLEANUP_LOCK_NAMESPACE } from './contract.mjs';
import { cleanupTransaction } from './transaction.mjs';

export async function readCleanupJob(db, id, lock = false) {
    cleanupId(id);
    const row = (await db.query(`SELECT * FROM scoped_repair_lab.cleanup_jobs WHERE id=$1${lock ? ' FOR UPDATE' : ''}`, [id])).rows[0];
    if (!row) throw new Error('Cleanup job not found');
    return row;
}

async function fenceJob(db, job) {
    if (job.kind !== 'server') {
        const server = (await db.query('SELECT cleanup_job FROM scoped_repair_lab.sync_servers WHERE id=$1 FOR SHARE NOWAIT', [job.server_id])).rows[0];
        if (!server || server.cleanup_job) throw new Error('Cleanup server admission unavailable');
    }
    const table = parentTable(job.kind);
    const parent = (await db.query(`SELECT cleanup_job FROM ${table} WHERE id=$1 FOR UPDATE NOWAIT`, [job.target_id])).rows[0];
    if (!parent || parent.cleanup_job) throw new Error('Cleanup parent admission unavailable');
    await db.query(`UPDATE ${table} SET cleanup_job=$2 WHERE id=$1`, [job.target_id, job.id]);
    const high = (await db.query(`SELECT COALESCE(max(s.id),0) high FROM scoped_repair_lab.scoped_repair_source s
        WHERE ${sourcePredicate(job.kind)}`, [job.target_id])).rows[0].high;
    return (await db.query(`UPDATE scoped_repair_lab.cleanup_jobs SET state='running',high_id=$2,sealed_at=clock_timestamp()
        WHERE id=$1 RETURNING *`, [job.id, high])).rows[0];
}

/** Scope ownership persists; only one collecting/running cleanup per server. */
export async function beginInventoryCleanup(db, { kind, targetId }) {
    cleanupTarget(kind, targetId);
    return cleanupTransaction(db, async () => {
        const parent = (await db.query(`SELECT * FROM ${parentTable(kind)} WHERE id=$1`, [targetId])).rows[0];
        if (!parent) throw new Error('Cleanup parent not found');
        const serverId = kind === 'server' ? targetId : parent.media_server_id;
        await db.query('SELECT pg_advisory_xact_lock($1::integer,$2::integer)', [CLEANUP_LOCK_NAMESPACE, serverId]);
        const job = (await db.query(`INSERT INTO scoped_repair_lab.cleanup_jobs(id,kind,target_id,server_id,state)
            VALUES($1,$2,$3,$4,'collecting') RETURNING *`, [randomUUID(), kind, targetId, serverId])).rows[0];
        return kind === 'prune' ? job : fenceJob(db, job);
    });
}

export async function appendCleanupManifest(db, id, externalIds) {
    cleanupId(id); const ids = manifestIds(externalIds);
    return cleanupTransaction(db, async () => {
        const job = await readCleanupJob(db, id, true);
        if (job.kind !== 'prune' || job.state !== 'collecting') throw new Error('Cleanup manifest is not collecting');
        const inserted = await db.query(`INSERT INTO scoped_repair_lab.cleanup_seen(job_id,external_id)
            SELECT $1,unnest($2::text[]) ON CONFLICT DO NOTHING`, [id, ids]);
        return (await db.query('UPDATE scoped_repair_lab.cleanup_jobs SET seen_count=seen_count+$2 WHERE id=$1 RETURNING *', [id, inserted.rowCount])).rows[0];
    });
}

export async function sealCleanupManifest(db, id, { traversalComplete, expectedUniqueCount }) {
    cleanupId(id);
    if (traversalComplete !== true || !Number.isInteger(expectedUniqueCount) || expectedUniqueCount < 0 || expectedUniqueCount > 2147483647) {
        throw new Error('Cleanup requires complete traversal evidence');
    }
    return cleanupTransaction(db, async () => {
        const job = await readCleanupJob(db, id, true);
        if (job.kind !== 'prune' || job.seen_count !== expectedUniqueCount || job.state === 'cancelled') throw new Error('Cleanup manifest evidence mismatch');
        return job.state === 'collecting' ? fenceJob(db, job) : job;
    });
}

export async function cancelCollectingCleanup(db, id) {
    cleanupId(id);
    return cleanupTransaction(db, async () => {
        const job = await readCleanupJob(db, id, true);
        if (job.state !== 'collecting') throw new Error('Only collecting cleanup can be cancelled');
        return (await db.query("UPDATE scoped_repair_lab.cleanup_jobs SET state='cancelled',completed_at=clock_timestamp() WHERE id=$1 RETURNING *", [id])).rows[0];
    });
}
