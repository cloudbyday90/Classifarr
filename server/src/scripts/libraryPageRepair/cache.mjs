/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { PAGE_REPAIR_LIMITS as limits } from './contract.mjs';

export async function restartPageRepair(db, ns, libraryId, reason) {
    await db.query(`DELETE FROM ${ns}.page_repair_state WHERE library_id=$1`, [libraryId]);
    return { contract: 'library.page-repair.prototype.v1', status: 'restart_required', reason, counts: null,
        metadataRowsRead: 0, lookaheadRowsRead: 0 };
}

export async function applyPageRepairEvents(db, ns, state, head, events, now) {
    const pages = (await db.query(`SELECT page_id FROM ${ns}.page_repair_pages WHERE library_id=$1`, [state.library_id])).rows;
    const known = new Set(pages.map(page => page.page_id));
    const dirty = new Map();
    for (const event of events) {
        if (event.library_id === state.library_id && (known.has(event.page_id) || event.page_id <= state.cursor_page)) {
            if (!dirty.has(event.page_id)) dirty.set(event.page_id, event.sequence);
        }
    }
    const additions = [...dirty.keys()].filter(page => !known.has(page)).length;
    const total = (await db.query(`SELECT count(*)::integer n FROM ${ns}.page_repair_pages`)).rows[0].n;
    if (total + additions > limits.pages) return false;
    if (dirty.size) {
        await db.query(`INSERT INTO ${ns}.page_repair_pages(library_id,page_id,dirty_since)
            SELECT $1,p.page_id,p.sequence FROM jsonb_to_recordset($2::jsonb) AS p(page_id integer,sequence bigint)
            ON CONFLICT(library_id,page_id) DO UPDATE SET dirty_since=COALESCE(page_repair_pages.dirty_since,EXCLUDED.dirty_since)`,
        [state.library_id, JSON.stringify([...dirty].map(([page_id, sequence]) => ({ page_id, sequence })))]);
    }
    await db.query(`UPDATE ${ns}.page_repair_pages SET dirty_since=COALESCE(dirty_since,$2::bigint)
        WHERE library_id=$1 AND expires_at<=$3::timestamptz`, [state.library_id, head.sequence, now]);
    return true;
}

export async function nextPageRepairRange(db, ns, state) {
    const lower = (state.cursor_page + 1) * limits.pageWidth;
    const next = (await db.query(`SELECT id FROM ${ns}.page_repair_source
        WHERE (library_id,id)>($1::integer,$2::bigint) AND (library_id,id)<=($1::integer,${limits.maxId})
        ORDER BY library_id,id LIMIT 1`, [state.library_id, lower])).rows[0];
    if (next) return { page: Math.floor((next.id - 1) / limits.pageWidth), forward: true, lookaheadRowsRead: 1 };
    const dirty = (await db.query(`SELECT page_id FROM ${ns}.page_repair_pages
        WHERE library_id=$1 AND dirty_since IS NOT NULL ORDER BY dirty_since,page_id LIMIT 1`, [state.library_id])).rows[0];
    return { page: dirty?.page_id ?? null, forward: false, lookaheadRowsRead: 0 };
}
