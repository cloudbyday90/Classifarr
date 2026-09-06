/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { SCOPED_REPAIR_LIMITS as limits, SCOPED_REPAIR_LOCK_NAMESPACE } from './contract.mjs';

export async function freeScopedPages(db, ns, owner) {
    await db.query(`UPDATE ${ns}.scoped_repair_pages SET owner=NULL,low_id=NULL,high_id=NULL,counts=NULL,digest=NULL,
        dirty_since=NULL,measured_at=NULL,expires_at=NULL WHERE owner=$1`, [owner]);
}

export async function reclaimScopedHeads(db, ns, selectedLibrary, now) {
    const threshold = new Date(Date.parse(now) - limits.maxAgeMs).toISOString();
    const candidates = (await db.query(`SELECT library_id FROM ${ns}.scoped_repair_heads
        WHERE library_id<>$1 AND last_seen_at<$2 ORDER BY library_id`, [selectedLibrary, threshold])).rows;
    for (const candidate of candidates) {
        const acquired = (await db.query('SELECT pg_try_advisory_xact_lock($1::integer,$2::integer) AS acquired',
            [SCOPED_REPAIR_LOCK_NAMESPACE, candidate.library_id])).rows[0].acquired;
        if (!acquired) continue;
        // Recheck after acquiring the nonwaiting lock; another visit may have refreshed this candidate.
        const cleared = (await db.query(`UPDATE ${ns}.scoped_repair_heads SET library_id=NULL,epoch=NULL,revision=0,
            invalidated_through=0,cursor_id=0,built=false,restart_reason=NULL,started_at=NULL,last_seen_at=NULL
            WHERE library_id=$1 AND last_seen_at<$2 RETURNING slot`, [candidate.library_id, threshold])).rows[0];
        if (cleared) await freeScopedPages(db, ns, cleared.slot);
    }
}

export async function claimScopedHead(db, ns, libraryId, now) {
    const existing = (await db.query(`SELECT *,revision::text,invalidated_through::text FROM ${ns}.scoped_repair_heads WHERE library_id=$1`, [libraryId])).rows[0];
    if (existing) return existing;
    const free = (await db.query(`SELECT slot FROM ${ns}.scoped_repair_heads WHERE library_id IS NULL ORDER BY slot FOR UPDATE SKIP LOCKED LIMIT 1`)).rows[0];
    if (!free) return null;
    return (await db.query(`UPDATE ${ns}.scoped_repair_heads SET library_id=$2,epoch=$3,started_at=$4,last_seen_at=$4
        WHERE slot=$1 RETURNING *,revision::text,invalidated_through::text`, [free.slot, libraryId, randomUUID(), now])).rows[0];
}

export async function resetScopedHead(db, ns, head, now, reason) {
    await freeScopedPages(db, ns, head.slot);
    await db.query(`UPDATE ${ns}.scoped_repair_heads SET epoch=$2,cursor_id=0,built=false,restart_reason=NULL,
        invalidated_through=revision,started_at=$3,last_seen_at=$3 WHERE slot=$1`, [head.slot, randomUUID(), now]);
    return { contract: 'library.scoped-repair.prototype.v1', status: 'restart_required', reason, counts: null,
        metadataRowsRead: 0, lookaheadRowsRead: 0 };
}
