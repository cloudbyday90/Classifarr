/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readLibraryObservationHealth } from './libraryObservationHealthService.mjs';

/** Aggregate only explicit health fields; no names, traits or provider metadata survive. */
function observationSampleValues(report) {
    const available = report.status === 'available';
    const sum = select => available ? report.libraries.reduce((total, library) => total + select(library), 0) : null;
    return [report.observedAt, report.status, report.libraries.map(library => library.id),
        report.scope.excludedLibraryCount, report.acquisitionConfigured,
        available ? report.inventoryRowCount : null, sum(library => library.supportedRowCount),
        sum(library => library.identifiedRowCount), sum(library => library.counts.captured),
        sum(library => library.states.fresh), sum(library => library.counts.keywordsKnown),
        sum(library => library.counts.languageKnown)];
}

export async function captureLibraryObservationSample(db) {
    const { rows } = await db.query(`SELECT EXISTS (SELECT 1 FROM library_observation_samples
        WHERE observed_at >= date_trunc('hour', statement_timestamp(), 'UTC')
        AND observed_at <= statement_timestamp()) AS sampled`);
    if (rows[0].sampled) return { captured: false };
    const report = await readLibraryObservationHealth(db);
    const result = await db.query(`INSERT INTO library_observation_samples AS existing
        (hour_slot, observed_at, status, library_ids, excluded_library_count, acquisition_configured,
            inventory_rows, supported_rows, identified_rows, captured_rows, fresh_rows, keyword_rows, language_rows)
        VALUES (mod(floor(extract(epoch FROM $1::timestamptz) / 3600)::bigint, 168), $1, $2, $3, $4, $5,
            $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (hour_slot) DO UPDATE SET observed_at = EXCLUDED.observed_at, status = EXCLUDED.status,
            library_ids = EXCLUDED.library_ids, excluded_library_count = EXCLUDED.excluded_library_count,
            acquisition_configured = EXCLUDED.acquisition_configured, inventory_rows = EXCLUDED.inventory_rows,
            supported_rows = EXCLUDED.supported_rows, identified_rows = EXCLUDED.identified_rows,
            captured_rows = EXCLUDED.captured_rows, fresh_rows = EXCLUDED.fresh_rows,
            keyword_rows = EXCLUDED.keyword_rows, language_rows = EXCLUDED.language_rows
        WHERE existing.observed_at < date_trunc('hour', EXCLUDED.observed_at, 'UTC')`, observationSampleValues(report));
    return { captured: result.rowCount === 1 };
}
