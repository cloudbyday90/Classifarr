/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

/** Claim and write atomically; query() can be a pool without pinning a transaction connection. */
export async function persistLibraryObservationSample(db, snapshot, report) {
    const library = report.libraries[0];
    const available = library && report.status === 'available';
    const values = [snapshot.observed_at, snapshot.expected_last_sample_at, library?.id ?? null,
        snapshot.next_ceiling, snapshot.active_library_count, snapshot.continuity_since,
        report.status, report.acquisitionConfigured, snapshot.row_count,
        available ? snapshot.population_fingerprints[library.id] : null,
        available ? library.inventoryRowCount : null, available ? library.supportedRowCount : null,
        available ? library.identifiedRowCount : null, available ? library.counts.captured : null,
        available ? library.states.fresh : null, available ? library.counts.keywordsKnown : null,
        available ? library.counts.languageKnown : null];
    const { rows } = await db.query(`WITH claim AS (
        UPDATE library_observation_sampling_state SET last_sample_at=$1::timestamptz,
            last_library_id=COALESCE($3::integer,0), ceiling_library_id=$4, active_library_count=$5,
            continuity_since=$6::timestamptz
        WHERE singleton = true AND last_sample_at IS NOT DISTINCT FROM $2::timestamptz
            AND (last_sample_at IS NULL OR last_sample_at < date_bin('5 minutes',$1::timestamptz,'2000-01-01T00:00:00Z'::timestamptz))
            AND ($3::integer IS NULL OR NOT EXISTS (SELECT 1 FROM library_observation_points
                WHERE sample_slot=mod(floor(extract(epoch FROM $1::timestamptz)/300)::bigint,2016)
                AND observed_at >= date_bin('5 minutes',$1::timestamptz,'2000-01-01T00:00:00Z'::timestamptz)))
        RETURNING 1
    ), point AS (
        INSERT INTO library_observation_points AS existing (sample_slot,observed_at,library_id,status,
            acquisition_configured,continuity_since,inventory_lower_bound,population_fingerprint,
            inventory_rows,supported_rows,identified_rows,captured_rows,fresh_rows,keyword_rows,language_rows)
        SELECT mod(floor(extract(epoch FROM $1::timestamptz)/300)::bigint,2016),$1,$3,$7,$8,$6,$9,$10,$11,$12,$13,$14,$15,$16,$17
        FROM claim WHERE $3::integer IS NOT NULL
        ON CONFLICT(sample_slot) DO UPDATE SET observed_at=EXCLUDED.observed_at,library_id=EXCLUDED.library_id,
            status=EXCLUDED.status,acquisition_configured=EXCLUDED.acquisition_configured,
            continuity_since=EXCLUDED.continuity_since,inventory_lower_bound=EXCLUDED.inventory_lower_bound,
            population_fingerprint=EXCLUDED.population_fingerprint,inventory_rows=EXCLUDED.inventory_rows,
            supported_rows=EXCLUDED.supported_rows,identified_rows=EXCLUDED.identified_rows,
            captured_rows=EXCLUDED.captured_rows,fresh_rows=EXCLUDED.fresh_rows,
            keyword_rows=EXCLUDED.keyword_rows,language_rows=EXCLUDED.language_rows
        WHERE existing.observed_at < date_bin('5 minutes',EXCLUDED.observed_at,'2000-01-01T00:00:00Z'::timestamptz)
        RETURNING 1
    ) SELECT EXISTS(SELECT 1 FROM point) AS captured`, values);
    return { captured: rows[0].captured };
}
