/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { measureLibraryObservationRow } from '../../services/libraryObservationHealthState.mjs';
import { INVENTORY_TMDB_CACHE_DAYS } from '../../services/inventoryTmdbObservation.mjs';
import { pageRepairNamespace, PAGE_REPAIR_FIELDS, PAGE_REPAIR_LIMITS } from './contract.mjs';

export const PAGE_REPAIR_SOURCE_COLUMNS = `id,library_id,media_type,tmdb_id,
        inventory_tmdb_attempted_at::text,inventory_tmdb_fetched_at::text,
        COALESCE(metadata ? 'inventory_tmdb',false) AS has_observation,
        COALESCE(octet_length((metadata->'inventory_tmdb')::text)>4096,false) AS observation_withheld,
        jsonb_build_object('inventory_tmdb',CASE WHEN octet_length((metadata->'inventory_tmdb')::text)<=4096
            THEN metadata->'inventory_tmdb' END) AS metadata`;

export function pageRepairSourceSql(scope) {
    const ns = pageRepairNamespace(scope);
    return `SELECT ${PAGE_REPAIR_SOURCE_COLUMNS}
        FROM ${ns}.page_repair_source WHERE library_id=$1 AND id BETWEEN $2 AND $3 ORDER BY id LIMIT ${PAGE_REPAIR_LIMITS.pageWidth}`;
}

/** The expiry describes these counters, not the unrelated six-hour retry/backoff state. */
export function reducePageRepairRows(items, nowMs) {
    if (!Number.isFinite(nowMs) || items.length > PAGE_REPAIR_LIMITS.pageWidth) throw new Error('Invalid page repair projection');
    const counts = Object.fromEntries(PAGE_REPAIR_FIELDS.map(field => [field, 0]));
    const hash = createHash('sha256').update('library.page-repair.prototype.v1\n');
    let expires = Infinity;
    for (const item of items) {
        const row = measureLibraryObservationRow(item, nowMs);
        counts.inventory++;
        for (const field of ['supported', 'identified', 'captured']) if (row[field]) counts[field]++;
        if (row.state === 'fresh') counts.fresh++;
        if (row.keywordsKnown) counts.keywords++;
        if (row.languageKnown) counts.language++;
        hash.update(`${JSON.stringify(item)}\n`);
        for (const field of ['inventory_tmdb_fetched_at', 'inventory_tmdb_attempted_at']) {
            const value = item[field];
            const time = typeof value === 'string' || value instanceof Date ? new Date(value).getTime() : NaN;
            if (time > nowMs) expires = Math.min(expires, time);
            const stale = time + INVENTORY_TMDB_CACHE_DAYS * 86400000;
            if (field === 'inventory_tmdb_fetched_at' && stale > nowMs) expires = Math.min(expires, stale);
        }
    }
    return { counts, digest: hash.digest('hex'), expiresAt: Number.isFinite(expires) ? new Date(expires).toISOString() : null };
}
