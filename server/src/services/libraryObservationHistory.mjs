/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { projectLibraryCoverageHistory } from './libraryObservationCoverageTrends.mjs';

/** One read snapshot, fixed seven-day window, and at most 168 rows per source. */
export async function readLibraryObservationHistory(db) {
    const { rows } = await db.query(`WITH clock AS (SELECT statement_timestamp() AS now),
        activity AS (SELECT bucket_at AS "bucketAt", captured, unavailable, captured + unavailable AS attempted
            FROM inventory_observation_activity, clock
            WHERE bucket_at > date_trunc('hour', clock.now, 'UTC') - INTERVAL '168 hours'
                AND bucket_at <= clock.now ORDER BY bucket_at DESC LIMIT 168),
        samples AS (SELECT observed_at AS "observedAt", status, library_ids AS "libraryIds",
            excluded_library_count AS "excludedLibraryCount", acquisition_configured AS "acquisitionConfigured",
            inventory_rows AS "inventoryRows", supported_rows AS "supportedRows", identified_rows AS "identifiedRows",
            captured_rows AS "capturedRows", fresh_rows AS "freshRows", keyword_rows AS "keywordRows", language_rows AS "languageRows",
            library_coverage_v1 AS "libraryCoverage"
            FROM library_observation_samples, clock
            WHERE observed_at >= date_trunc('hour', clock.now, 'UTC') - INTERVAL '167 hours'
                AND observed_at <= clock.now ORDER BY observed_at DESC LIMIT 168)
        SELECT clock.now::text AS observed_at,
            COALESCE((SELECT jsonb_agg(activity ORDER BY "bucketAt" DESC) FROM activity), '[]'::jsonb) AS activity,
            COALESCE((SELECT jsonb_agg(samples ORDER BY "observedAt" DESC) FROM samples), '[]'::jsonb) AS samples
        FROM clock`);
    const row = rows[0];
    return { version: 'library.observation_history.v1', observedAt: new Date(row.observed_at).toISOString(),
        retentionHours: 168, activityPopulation: 'all_guarded_inventory_acquisition_attempts',
        coveragePopulation: 'bounded_active_library_inventory_rows',
        activity: row.activity, samples: projectLibraryCoverageHistory(row.samples) };
}
