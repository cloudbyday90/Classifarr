/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { evidenceCounts } from './evidenceCoverageProjection.mjs';
import { PROVENANCE_COUNT_FIELDS, projectProvenanceCounts } from './evidenceProvenanceProjection.mjs';

export const LIBRARY_UTC_COUNT_FIELDS = Object.freeze([
    'retained_events', ...PROVENANCE_COUNT_FIELDS, 'older_events', 'future_events', 'unknown_events',
]);

export function projectLibraryUtcCounts(row) {
    const counts = evidenceCounts(row, LIBRARY_UTC_COUNT_FIELDS);
    projectProvenanceCounts(counts);
    const retained = counts.events + counts.older_events + counts.future_events + counts.unknown_events;
    if (!Number.isSafeInteger(retained) || retained !== counts.retained_events) throw new Error('Inconsistent library UTC partition');
    return { ...counts, capture_coverage: counts.events === 0 ? null : counts.captured_events / counts.events };
}
