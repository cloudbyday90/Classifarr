/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { pageRepairNamespace } from './contract.mjs';

export const PAGE_REPAIR_BENCHMARK_TIME = Date.parse('2026-08-02T00:00:00Z');

export async function seedPageRepairFixture(db, scope, rows) {
    const ns = pageRepairNamespace(scope);
    if (!Number.isInteger(rows) || rows < 1 || rows > 80001) throw new Error('Invalid page repair fixture size');
    await db.query(`INSERT INTO ${ns}.page_repair_source(id,library_id,media_type,tmdb_id,metadata,
        inventory_tmdb_attempted_at,inventory_tmdb_fetched_at)
        SELECT id,1,'movie',id,jsonb_build_object('inventory_tmdb',jsonb_build_object('version',1,'tmdb_id',id,
            'media_type','movie','keywords',jsonb_build_array('space'),'original_language','en')),
            '2026-08-01T00:00:00Z','2026-08-01T00:00:00Z' FROM generate_series(1,$1::integer) id`, [rows]);
    await db.query(`ANALYZE ${ns}.page_repair_source`);
}

/** Simulation clock affects only the two explicit visit evaluation reads, never source SQL. */
export function pageRepairClock(db, now) {
    if (!Number.isFinite(now) || !Number.isFinite(new Date(now).getTime())) throw new Error('Invalid page repair clock');
    return { query: (sql, values) => sql === 'SELECT clock_timestamp()::text AS now' ?
        Promise.resolve({ rows: [{ now: new Date(now).toISOString() }] }) : db.query(sql, values) };
}
