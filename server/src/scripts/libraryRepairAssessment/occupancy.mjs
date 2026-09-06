/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { PAGE_REPAIR_LIMITS } from '../libraryPageRepair/contract.mjs';

export const REPAIR_OCCUPANCY_LIMITS = Object.freeze({ libraries: 32, items: 200000 });

function sourceNames(source) {
    if (source === 'inventory') return { catalog: 'public.libraries', items: 'public.media_server_items' };
    if (source === 'prototype') return { catalog: 'page_repair_lab.page_repair_catalog', items: 'page_repair_lab.page_repair_source' };
    throw new Error('Unsupported repair occupancy source');
}

/** Requires a dedicated idle client. Application assessment performs SELECTs only. */
export async function readRepairOccupancy(db, source) {
    const names = sourceNames(source);
    await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    try {
        await db.query("SET LOCAL statement_timeout='10s'; SET LOCAL lock_timeout='2s'; SET LOCAL idle_in_transaction_session_timeout='30s'");
        const measuredAt = (await db.query('SELECT transaction_timestamp()::text AS measured_at')).rows[0].measured_at;
        const catalog = (await db.query(`SELECT id FROM ${names.catalog} WHERE is_active=true ORDER BY id LIMIT ${REPAIR_OCCUPANCY_LIMITS.libraries + 1}`)).rows;
        const libraries = [];
        let observedItems = 0, observedRanges = 0, itemRowsRead = 0;
        for (const [ordinal, library] of catalog.slice(0, REPAIR_OCCUPANCY_LIMITS.libraries).entries()) {
            const remaining = REPAIR_OCCUPANCY_LIMITS.items - observedItems;
            const items = (await db.query(`SELECT id FROM ${names.items}
                WHERE (library_id,id)>($1::integer,0) AND (library_id,id)<=($1::integer,2147483647)
                ORDER BY library_id,id LIMIT $2`, [library.id, remaining + 1])).rows;
            itemRowsRead += items.length;
            const complete = items.length <= remaining;
            const included = complete ? items : items.slice(0, remaining);
            const ranges = new Set(included.map(item => Math.floor((item.id - 1) / PAGE_REPAIR_LIMITS.pageWidth))).size;
            observedItems += included.length; observedRanges += ranges;
            libraries.push({ ordinal: ordinal + 1, observedItems: included.length, observedRanges: ranges, complete,
                rangeUtilizationPercent: ranges ? Number((included.length / (ranges * PAGE_REPAIR_LIMITS.pageWidth) * 100).toFixed(4)) : null,
                fitsPageCapacity: ranges > PAGE_REPAIR_LIMITS.pages ? false : complete ? true : null });
            if (!complete) break;
        }
        const complete = catalog.length <= REPAIR_OCCUPANCY_LIMITS.libraries && libraries.length === catalog.length && libraries.every(item => item.complete);
        await db.query('COMMIT');
        return { contract: 'library.repair.occupancy.v1', measuredAt, source, complete,
            catalogRowsRead: catalog.length, itemRowsRead, metadataRowsRead: 0, observedItems, observedRanges, libraries,
            pageWidth: PAGE_REPAIR_LIMITS.pageWidth, pageCapacity: PAGE_REPAIR_LIMITS.pages, libraryCapacity: PAGE_REPAIR_LIMITS.libraries,
            fitsGlobalCapacity: catalog.length > PAGE_REPAIR_LIMITS.libraries || observedRanges > PAGE_REPAIR_LIMITS.pages ? false : complete ? true : null,
            limits: REPAIR_OCCUPANCY_LIMITS };
    } catch (error) {
        await db.query('ROLLBACK');
        throw error;
    }
}
