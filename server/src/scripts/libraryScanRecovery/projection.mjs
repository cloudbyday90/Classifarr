/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { measureLibraryObservationRow } from '../../services/libraryObservationHealthState.mjs';

export const RECOVERY_BENCHMARK_TIME = '2026-08-02T00:00:00Z';
export const RECOVERY_COUNT_FIELDS = Object.freeze(['inventory', 'supported', 'identified', 'captured', 'fresh', 'keywords', 'language']);

/** Apply the production observation predicate, then retain only compact coverage flags. */
export function projectRecoveryBenchmarkRows(items) {
    return items.map(item => {
        const row = measureLibraryObservationRow(item, Date.parse(RECOVERY_BENCHMARK_TIME));
        return { id: item.id, supported: row.supported, identified: row.identified, captured: row.captured,
            fresh: row.state === 'fresh', keywords: row.keywordsKnown, language: row.languageKnown };
    });
}

export function countRecoveryBenchmarkRows(items) {
    const counts = Object.fromEntries(RECOVERY_COUNT_FIELDS.map(field => [field, 0]));
    for (const item of items) {
        counts.inventory++;
        for (const field of RECOVERY_COUNT_FIELDS.slice(1)) if (item[field]) counts[field]++;
    }
    return counts;
}

export const RECOVERY_SOURCE_SQL = `WITH lookahead AS MATERIALIZED (
    SELECT id FROM pg_temp.recovery_benchmark_source
    WHERE (library_id,id) > (1,0) AND (library_id,id) <= (1,2147483647)
    ORDER BY library_id,id LIMIT $1
), bounded AS MATERIALIZED (SELECT id FROM lookahead ORDER BY id LIMIT $2),
projected AS MATERIALIZED (
    SELECT s.id,s.library_id,s.media_type,s.tmdb_id,
        s.inventory_tmdb_attempted_at::text,s.inventory_tmdb_fetched_at::text,
        COALESCE(s.metadata ? 'inventory_tmdb',false) AS has_observation,
        COALESCE(octet_length((s.metadata->'inventory_tmdb')::text)>4096,false) AS observation_withheld,
        jsonb_build_object('inventory_tmdb',CASE WHEN octet_length((s.metadata->'inventory_tmdb')::text)<=4096
            THEN s.metadata->'inventory_tmdb' END) AS metadata
    FROM bounded b CROSS JOIN LATERAL (SELECT * FROM pg_temp.recovery_benchmark_source WHERE id=b.id LIMIT 1) s
    WHERE NOT $3::boolean OR (SELECT count(*) FROM lookahead)<=$2
) SELECT (SELECT count(*) FROM lookahead)::integer AS lookahead_rows,
    COALESCE((SELECT jsonb_agg(p ORDER BY id) FROM projected p),'[]'::jsonb) AS items`;
