/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { buildLibraryObservationHealth } from './libraryObservationHealthService.mjs';

export const OBSERVATION_SCAN_COUNT_FIELDS = Object.freeze(['inventory_rows', 'supported_rows', 'identified_rows',
    'captured_rows', 'fresh_rows', 'keyword_rows', 'language_rows']);

/** Reduce one bounded page; only complete scans may expose coverage counts. */
export function buildLibraryObservationScan(snapshot) {
    const context = snapshot.scan_context;
    const report = buildLibraryObservationHealth({ ...snapshot, observed_at: context?.scan_started_at ?? snapshot.observed_at });
    const library = report.libraries[0];
    if (library && !context) throw new Error('Observation scan context unavailable');
    const previous = context?.previous;
    const pageCounts = library ? [library.inventoryRowCount, library.supportedRowCount, library.identifiedRowCount,
        library.counts.captured, library.states.fresh, library.counts.keywordsKnown, library.counts.languageKnown] : [];
    const counts = Object.fromEntries(OBSERVATION_SCAN_COUNT_FIELDS.map((field,index) =>
        [field, (previous?.[field] ?? 0) + (pageCounts[index] ?? 0)]));
    const digest = library ? createHash('sha256')
        .update(previous?.population_fingerprint ?? 'library.observation.population.v3')
        .update(':').update(snapshot.population_fingerprints[library.id]).digest('hex') : null;
    return { observed_at: snapshot.observed_at, expected_last_sample_at: snapshot.expected_last_sample_at,
        library_id: library?.id ?? null, next_ceiling: snapshot.next_ceiling, active_count: snapshot.active_library_count,
        continuity_since: snapshot.continuity_since, status: snapshot.has_more ? 'in_progress' : 'available',
        acquisition_configured: snapshot.acquisition_configured, ...counts,
        inventory_lower_bound: counts.inventory_rows + (snapshot.has_more ? 1 : 0), population_fingerprint: digest,
        scan_started_at: context?.scan_started_at ?? snapshot.observed_at, scanned_rows: counts.inventory_rows,
        restart_reason: context?.restart_reason ?? null, inventory_revision: context?.inventory_revision ?? '0',
        clock_revision: context?.clock_revision ?? '0', after_id: snapshot.next_after_id ?? 0 };
}
