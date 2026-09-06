/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { pageRepairNamespace, pageRepairRange, journalContinuity, PAGE_REPAIR_FIELDS, PAGE_REPAIR_LIMITS as limits } from './contract.mjs';
import { pageRepairSourceSql, reducePageRepairRows } from './projection.mjs';
import { restartPageRepair, applyPageRepairEvents, nextPageRepairRange } from './cache.mjs';

/** Dedicated idle client required; each call commits/releases the publication lock. */
export async function visitPageRepair(db, options) {
    await db.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    try {
        const result = await visitPageRepairInTransaction(db, options);
        await db.query('COMMIT');
        return result;
    } catch (error) {
        await db.query('ROLLBACK');
        throw error;
    }
}

/** Internal transaction-owned variant for rollback-only temporary Compose assessments. */
export async function visitPageRepairInTransaction(db, { scope, libraryId }) {
    const ns = pageRepairNamespace(scope);
    if (!Number.isInteger(libraryId) || libraryId < 1 || libraryId > limits.maxId) throw new Error('Invalid page repair library');
    if ((await db.query('SHOW transaction_isolation')).rows[0].transaction_isolation !== 'read committed') {
        throw new Error('Page repair requires read committed isolation');
    }
    await db.query("SET LOCAL statement_timeout='15s'; SET LOCAL lock_timeout='2s'; SET LOCAL idle_in_transaction_session_timeout='30s'");
    const head = (await db.query(`SELECT generation::text,sequence::text,reason FROM ${ns}.page_repair_head WHERE singleton FOR UPDATE`)).rows[0];
    if (!head) throw new Error('Page repair head missing');
    const now = (await db.query('SELECT clock_timestamp()::text AS now')).rows[0].now;
    let state = (await db.query(`SELECT *,generation::text,acknowledged_sequence::text FROM ${ns}.page_repair_state WHERE library_id=$1`, [libraryId])).rows[0];
    if (!state) {
        const total = (await db.query(`SELECT count(*)::integer n FROM ${ns}.page_repair_state`)).rows[0].n;
        if (total >= limits.libraries) return restartPageRepair(db, ns, libraryId, 'library_capacity');
        state = (await db.query(`INSERT INTO ${ns}.page_repair_state(library_id,generation,acknowledged_sequence,started_at,last_observed_at)
            VALUES($1,$2,$3,$4,$4) RETURNING *,generation::text,acknowledged_sequence::text`, [libraryId, head.generation, head.sequence, now])).rows[0];
    }
    const events = (await db.query(`SELECT sequence::text,library_id,page_id FROM ${ns}.page_repair_journal
        WHERE sequence>$1::bigint AND sequence<=$2::bigint ORDER BY page_repair_journal.sequence LIMIT ${limits.journal}`, [state.acknowledged_sequence, head.sequence])).rows;
    const reason = journalContinuity(state, head, events) ||
        (new Date(state.last_observed_at).getTime() > Date.parse(now) ? 'clock_regression' : null) ||
        (Date.parse(now) - new Date(state.started_at).getTime() > limits.maxAgeMs ? 'state_expired' : null);
    if (reason) return restartPageRepair(db, ns, libraryId, reason);
    if (!await applyPageRepairEvents(db, ns, state, head, events, now)) return restartPageRepair(db, ns, libraryId, 'page_capacity');
    const selected = await nextPageRepairRange(db, ns, state);
    let metadataRowsRead = 0;
    if (selected.page !== null) {
        const capacity = (await db.query(`SELECT count(*)::integer n,
            count(*) FILTER(WHERE library_id=$1 AND page_id=$2)::integer existing FROM ${ns}.page_repair_pages`, [libraryId, selected.page])).rows[0];
        if (!capacity.existing && capacity.n >= limits.pages) {
            return { ...await restartPageRepair(db, ns, libraryId, 'page_capacity'), lookaheadRowsRead: selected.lookaheadRowsRead };
        }
        const items = (await db.query(pageRepairSourceSql(scope), [libraryId, ...pageRepairRange(selected.page)])).rows;
        metadataRowsRead = items.length;
        const projection = reducePageRepairRows(items, Date.parse(now));
        await db.query(`INSERT INTO ${ns}.page_repair_pages(library_id,page_id,counts,digest,measured_at,expires_at)
            VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(library_id,page_id) DO UPDATE
            SET counts=EXCLUDED.counts,digest=EXCLUDED.digest,measured_at=EXCLUDED.measured_at,expires_at=EXCLUDED.expires_at,dirty_since=NULL`,
        [libraryId, selected.page, projection.counts, projection.digest, now, projection.expiresAt]);
        if (selected.forward) state.cursor_page = selected.page;
    }
    const evaluatedAt = (await db.query('SELECT clock_timestamp()::text AS now')).rows[0].now;
    if (Date.parse(evaluatedAt) < Date.parse(now)) {
        return { ...await restartPageRepair(db, ns, libraryId, 'clock_regression'), metadataRowsRead,
            lookaheadRowsRead: selected.lookaheadRowsRead };
    }
    await db.query(`UPDATE ${ns}.page_repair_state SET cursor_page=$2,acknowledged_sequence=$3,last_observed_at=$4 WHERE library_id=$1`,
        [libraryId, state.cursor_page, head.sequence, evaluatedAt]);
    // One extra indexed ID lookup establishes exhaustion after a forward range; no metadata is read here.
    const remaining = selected.forward ? await nextPageRepairRange(db, ns, state) : { forward: false, lookaheadRowsRead: 0 };
    const pages = (await db.query(`SELECT counts,dirty_since,expires_at,measured_at FROM ${ns}.page_repair_pages WHERE library_id=$1`, [libraryId])).rows;
    const complete = !remaining.forward && pages.every(page => page.counts && page.dirty_since === null &&
        new Date(page.measured_at).getTime() <= Date.parse(evaluatedAt) &&
        (page.expires_at === null || new Date(page.expires_at).getTime() > Date.parse(evaluatedAt)));
    const counts = complete ? Object.fromEntries(PAGE_REPAIR_FIELDS.map(field => [field,
        pages.reduce((sum, page) => sum + page.counts[field], 0)])) : null;
    return { contract: 'library.page-repair.prototype.v1', status: complete ? 'complete' : 'in_progress', counts,
        metadataRowsRead, lookaheadRowsRead: selected.lookaheadRowsRead + remaining.lookaheadRowsRead,
        generation: head.generation, sequence: head.sequence, evaluatedAt, cachedPages: pages.length };
}
