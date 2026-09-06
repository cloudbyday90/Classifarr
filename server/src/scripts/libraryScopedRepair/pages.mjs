/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { SCOPED_REPAIR_LIMITS as limits } from './contract.mjs';
import { PAGE_REPAIR_SOURCE_COLUMNS, reducePageRepairRows } from '../libraryPageRepair/projection.mjs';

async function freeSlot(db, ns) {
    return (await db.query(`SELECT slot FROM ${ns}.scoped_repair_pages WHERE owner IS NULL ORDER BY slot FOR UPDATE SKIP LOCKED LIMIT 1`)).rows[0]?.slot ?? null;
}

export async function selectScopedPage(db, ns, head, now) {
    await db.query(`UPDATE ${ns}.scoped_repair_pages SET dirty_since=COALESCE(dirty_since,$2::bigint)
        WHERE owner=$1 AND expires_at<=$3`, [head.slot, head.revision, now]);
    if (!head.built) return { slot: null, low_id: head.cursor_id, high_id: limits.maxId, forward: true };
    return (await db.query(`SELECT * FROM ${ns}.scoped_repair_pages WHERE owner=$1 AND dirty_since IS NOT NULL
        ORDER BY dirty_since,low_id LIMIT 1`, [head.slot])).rows[0] ?? null;
}

/** Source rows are never skipped. Capacity selection alone uses SKIP LOCKED. */
export async function measureScopedPage(db, ns, head, page, now) {
    const ids = (await db.query(`SELECT id FROM ${ns}.scoped_repair_source
        WHERE (library_id,id)>($1::integer,$2::integer) AND (library_id,id)<=($1::integer,$3::integer)
        ORDER BY library_id,id LIMIT ${limits.rows + 1}`, [head.library_id, page.low_id, page.high_id])).rows;
    if (!ids.length) {
        if (page.slot !== null) await db.query(`UPDATE ${ns}.scoped_repair_pages SET owner=NULL,low_id=NULL,high_id=NULL,
            counts=NULL,digest=NULL,dirty_since=NULL,measured_at=NULL,expires_at=NULL WHERE slot=$1`, [page.slot]);
        return { lookaheadRowsRead: 0, metadataRowsRead: 0, high: page.high_id, exhausted: true, capacityRefused: false };
    }
    const split = ids.length > limits.rows;
    const high = split ? ids[limits.rows - 1].id : page.high_id;
    const slot = page.slot ?? await freeSlot(db, ns);
    if (slot === null) return { capacityRefused: true, lookaheadRowsRead: ids.length, metadataRowsRead: 0 };
    // A new forward page only stores its measured prefix. A split repair must retain both old subranges.
    const tailSlot = split && !page.forward ? await freeSlot(db, ns) : null;
    if (split && !page.forward && tailSlot === null) return { capacityRefused: true, lookaheadRowsRead: ids.length, metadataRowsRead: 0 };
    const items = (await db.query(`SELECT ${PAGE_REPAIR_SOURCE_COLUMNS} FROM ${ns}.scoped_repair_source
        WHERE library_id=$1 AND id>$2 AND id<=$3 ORDER BY id LIMIT ${limits.rows}`, [head.library_id, page.low_id, high])).rows;
    const projection = reducePageRepairRows(items, Date.parse(now));
    await db.query(`UPDATE ${ns}.scoped_repair_pages SET owner=$2,low_id=$3,high_id=$4,counts=$5,digest=$6,
        dirty_since=NULL,measured_at=$7,expires_at=$8 WHERE slot=$1`,
    [slot, head.slot, page.low_id, high, projection.counts, projection.digest, now, projection.expiresAt]);
    if (tailSlot !== null) await db.query(`UPDATE ${ns}.scoped_repair_pages SET owner=$2,low_id=$3,high_id=$4,dirty_since=$5,
        counts=NULL,digest=NULL,measured_at=NULL,expires_at=NULL WHERE slot=$1`,
    [tailSlot, head.slot, high, page.high_id, page.dirty_since ?? head.revision]);
    return { lookaheadRowsRead: ids.length, metadataRowsRead: items.length, high, exhausted: !split, capacityRefused: false };
}
