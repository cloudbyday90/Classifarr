/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { buildLibraryObservationScan, OBSERVATION_SCAN_COUNT_FIELDS as countFields } from './libraryObservationScan.mjs';

const inputTypes = `observed_at timestamptz,expected_last_sample_at timestamptz,library_id integer,
    next_ceiling integer,active_count integer,continuity_since timestamptz,status text,
    acquisition_configured boolean,inventory_lower_bound integer,population_fingerprint text,
    ${countFields.map(field => `${field} integer`).join(',')},
    scan_started_at timestamptz,scanned_rows integer,restart_reason text,
    inventory_revision bigint,clock_revision bigint,after_id integer`;
const progressFields = ['library_id','inventory_revision','clock_revision','after_id','scan_started_at',
    'last_visit_at','continuity_since','acquisition_configured','population_fingerprint',...countFields];
const pointFields = ['observed_at','library_id','status','acquisition_configured','continuity_since',
    'inventory_lower_bound','population_fingerprint',...countFields,'measurement_version','scan_started_at','scanned_rows','restart_reason'];

/** Cursor claim, revision validation, progress and history are one atomic pool-safe statement. */
export async function persistLibraryObservationSample(db, snapshot) {
    const scan = buildLibraryObservationScan(snapshot);
    const { rows } = await db.query(`WITH input AS (
        SELECT * FROM jsonb_to_record($1::jsonb) AS input(${inputTypes})
    ), checked AS MATERIALIZED (
        SELECT a.*, COALESCE(r.revision,0)=a.inventory_revision
            AND COALESCE(r.observation_clock_revision,0)=a.clock_revision
            AND a.acquisition_configured=EXISTS(SELECT 1 FROM tmdb_config
                WHERE is_active=true AND NULLIF(BTRIM(api_key),'') IS NOT NULL)
            AND (a.library_id IS NULL OR COALESCE(l.is_active,false)) AS valid
        FROM input a LEFT JOIN library_profile_inventory_state r ON r.library_id=a.library_id
        LEFT JOIN libraries l ON l.id=a.library_id
    ), prepared AS MATERIALIZED (
        SELECT checked.*, CASE WHEN valid THEN status ELSE 'invalidated' END AS result_status FROM checked
    ), claim AS (
        UPDATE library_observation_sampling_state state SET last_sample_at=a.observed_at,
            last_library_id=COALESCE(a.library_id,0),ceiling_library_id=a.next_ceiling,
            active_library_count=a.active_count,continuity_since=a.continuity_since
        FROM prepared a WHERE singleton=true AND state.last_sample_at IS NOT DISTINCT FROM a.expected_last_sample_at
            AND (state.last_sample_at IS NULL OR state.last_sample_at <
                date_bin('5 minutes',a.observed_at,'2000-01-01T00:00:00Z'::timestamptz))
            AND (a.library_id IS NULL OR NOT EXISTS(SELECT 1 FROM library_observation_points
                WHERE sample_slot=mod(floor(extract(epoch FROM a.observed_at)/300)::bigint,2016)
                AND observed_at>=date_bin('5 minutes',a.observed_at,'2000-01-01T00:00:00Z'::timestamptz)))
        RETURNING 1
    ), progress AS (
        INSERT INTO library_observation_scan_progress (${progressFields.join(',')})
        SELECT a.library_id,a.inventory_revision,a.clock_revision,a.after_id,a.scan_started_at,a.observed_at,
            a.continuity_since,a.acquisition_configured,a.population_fingerprint,${countFields.map(field => `a.${field}`).join(',')}
        FROM prepared a,claim WHERE a.library_id IS NOT NULL AND a.result_status='in_progress'
        ON CONFLICT(library_id) DO UPDATE SET ${progressFields.slice(1).map(field => `${field}=EXCLUDED.${field}`).join(',')}
        RETURNING 1
    ), finished AS (
        DELETE FROM library_observation_scan_progress p USING prepared a,claim
        WHERE p.library_id=a.library_id AND a.result_status<>'in_progress' RETURNING 1
    ), point AS (
        INSERT INTO library_observation_points AS existing (sample_slot,${pointFields.join(',')})
        SELECT mod(floor(extract(epoch FROM a.observed_at)/300)::bigint,2016),
            a.observed_at,a.library_id,a.result_status,a.acquisition_configured,a.continuity_since,
            CASE WHEN valid THEN a.inventory_lower_bound ELSE 0 END,
            CASE WHEN result_status='available' THEN a.population_fingerprint END,
            ${countFields.map(field => `CASE WHEN result_status='available' THEN a.${field} END`).join(',')},
            3,CASE WHEN valid THEN a.scan_started_at ELSE a.observed_at END,
            CASE WHEN valid THEN a.scanned_rows ELSE 0 END,
            CASE WHEN valid THEN a.restart_reason ELSE 'changed_before_write' END
        FROM prepared a,claim WHERE a.library_id IS NOT NULL
        ON CONFLICT(sample_slot) DO UPDATE SET ${pointFields.map(field => `${field}=EXCLUDED.${field}`).join(',')}
        WHERE existing.observed_at < date_bin('5 minutes',EXCLUDED.observed_at,'2000-01-01T00:00:00Z'::timestamptz)
        RETURNING 1
    ) SELECT EXISTS(SELECT 1 FROM point) AS captured`, [JSON.stringify(scan)]);
    return { captured: rows[0].captured };
}
