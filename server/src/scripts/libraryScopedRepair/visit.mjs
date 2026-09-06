/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { requireScopedRepairId, SCOPED_REPAIR_LIMITS as limits } from './contract.mjs';
import { withScopedRepairLibraries, lockScopedRepairLibraries } from './locking.mjs';
import { reclaimScopedHeads, claimScopedHead, resetScopedHead } from './registry.mjs';
import { selectScopedPage, measureScopedPage } from './pages.mjs';
import { PAGE_REPAIR_FIELDS } from '../libraryPageRepair/contract.mjs';

async function visitLocked(db, ns, libraryId) {
    const now = (await db.query('SELECT clock_timestamp()::text AS now')).rows[0].now;
    await reclaimScopedHeads(db, ns, libraryId, now);
    const head = await claimScopedHead(db, ns, libraryId, now);
    if (!head) return { contract: 'library.scoped-repair.prototype.v1', status: 'restart_required', reason: 'library_capacity_busy_or_full',
        counts: null, metadataRowsRead: 0, lookaheadRowsRead: 0 };
    const reason = head.restart_reason || (head.revision !== head.invalidated_through ? 'missing_invalidation' : null) ||
        (new Date(head.last_seen_at).getTime() > Date.parse(now) ? 'clock_regression' : null) ||
        (Date.parse(now) - new Date(head.started_at).getTime() > limits.maxAgeMs ? 'state_expired' : null);
    if (reason) return resetScopedHead(db, ns, head, now, reason);
    const page = await selectScopedPage(db, ns, head, now);
    let work = { lookaheadRowsRead: 0, metadataRowsRead: 0 };
    if (page) {
        work = await measureScopedPage(db, ns, head, page, now);
        if (work.capacityRefused) return { ...await resetScopedHead(db, ns, head, now, 'page_capacity_busy_or_full'),
            metadataRowsRead: work.metadataRowsRead, lookaheadRowsRead: work.lookaheadRowsRead };
        if (page.forward) { head.cursor_id = work.high; head.built = work.exhausted; }
    }
    const evaluatedAt = (await db.query('SELECT clock_timestamp()::text AS now')).rows[0].now;
    if (Date.parse(evaluatedAt) < Date.parse(now)) return { ...await resetScopedHead(db, ns, head, evaluatedAt, 'clock_regression'),
        metadataRowsRead: work.metadataRowsRead, lookaheadRowsRead: work.lookaheadRowsRead };
    await db.query(`UPDATE ${ns}.scoped_repair_heads SET cursor_id=$2,built=$3,last_seen_at=$4 WHERE slot=$1`,
        [head.slot, head.cursor_id, head.built, evaluatedAt]);
    const pages = (await db.query(`SELECT counts,dirty_since,measured_at,expires_at FROM ${ns}.scoped_repair_pages WHERE owner=$1`, [head.slot])).rows;
    const complete = head.built && pages.every(item => item.counts && item.dirty_since === null &&
        new Date(item.measured_at).getTime() <= Date.parse(evaluatedAt) &&
        (item.expires_at === null || new Date(item.expires_at).getTime() > Date.parse(evaluatedAt)));
    const counts = complete ? Object.fromEntries(PAGE_REPAIR_FIELDS.map(field => [field, pages.reduce((sum, item) => sum + item.counts[field], 0)])) : null;
    return { contract: 'library.scoped-repair.prototype.v1', status: complete ? 'complete' : 'in_progress', counts,
        epoch: head.epoch, revision: head.revision, evaluatedAt, cachedPages: pages.length,
        metadataRowsRead: work.metadataRowsRead, lookaheadRowsRead: work.lookaheadRowsRead };
}

export async function visitScopedRepair(db, { scope, libraryId }) {
    requireScopedRepairId(libraryId);
    return withScopedRepairLibraries(db, scope, [libraryId], 'read', ns => visitLocked(db, ns, libraryId));
}

/** Caller owns the rollback-only temporary assessment transaction. */
export async function visitScopedRepairInTransaction(db, { scope, libraryId }) {
    requireScopedRepairId(libraryId);
    const ns = await lockScopedRepairLibraries(db, scope, [libraryId], 'read');
    return visitLocked(db, ns, libraryId);
}
