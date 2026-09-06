/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { projectLibraryCoverageHistory } from './libraryObservationCoverageTrends.mjs';
import { projectLibraryObservationPoints } from './libraryObservationPointHistory.mjs';

/** One read snapshot: at most 168 activity/legacy frames and 2,016 library points. */
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
                AND observed_at <= clock.now ORDER BY observed_at DESC LIMIT 168),
        points AS (SELECT observed_at AS "observedAt", library_id AS "libraryId", status,
            measurement_version AS "measurementVersion", scan_started_at AS "scanStartedAt",
            scanned_rows AS "scannedRows", restart_reason AS "restartReason",
            acquisition_configured AS "acquisitionConfigured", continuity_since AS "continuitySince",
            inventory_lower_bound AS "inventoryLowerBound", population_fingerprint AS "populationFingerprint",
            inventory_rows AS "inventoryRows", supported_rows AS "supportedRows", identified_rows AS "identifiedRows",
            captured_rows AS "capturedRows", fresh_rows AS "freshRows", keyword_rows AS "keywordRows", language_rows AS "languageRows"
            FROM library_observation_points, clock
            WHERE observed_at >= date_bin('5 minutes',clock.now,'2000-01-01T00:00:00Z'::timestamptz) - INTERVAL '10075 minutes'
                AND observed_at <= clock.now ORDER BY observed_at DESC LIMIT 2016)
        SELECT clock.now::text AS observed_at,
            COALESCE((SELECT jsonb_agg(activity ORDER BY "bucketAt" DESC) FROM activity), '[]'::jsonb) AS activity,
            COALESCE((SELECT jsonb_agg(samples ORDER BY "observedAt" DESC) FROM samples), '[]'::jsonb) AS samples,
            COALESCE((SELECT jsonb_agg(points ORDER BY "observedAt" DESC) FROM points), '[]'::jsonb) AS library_points,
            (SELECT jsonb_build_object('version','library.observation_sampling.v3',
                'intervalMinutes',5,'libraryLimitPerVisit',1,'rowLimitPerVisit',20000,'maximumScanHours',168,'retainedPointLimit',2016,
                'status',CASE WHEN last_sample_at IS NULL THEN 'awaiting_samples'
                    WHEN last_sample_at > clock.now THEN 'clock_anomaly'
                    WHEN last_sample_at < date_bin('5 minutes',clock.now,'2000-01-01T00:00:00Z'::timestamptz) - INTERVAL '5 minutes'
                        THEN 'sampling_delayed' ELSE 'available' END,
                'activeLibraryCount',active_library_count,'lastSampleAt',last_sample_at)
                FROM library_observation_sampling_state WHERE singleton = true) AS library_sampling
        FROM clock`);
    const row = rows[0];
    return { version: 'library.observation_history.v1', observedAt: new Date(row.observed_at).toISOString(),
        retentionHours: 168, activityPopulation: 'all_guarded_inventory_acquisition_attempts',
        coveragePopulation: 'bounded_active_library_inventory_rows',
        activity: row.activity, samples: projectLibraryCoverageHistory(row.samples),
        librarySampling: row.library_sampling ?? null,
        librarySamples: projectLibraryObservationPoints(row.library_points ?? []) };
}
