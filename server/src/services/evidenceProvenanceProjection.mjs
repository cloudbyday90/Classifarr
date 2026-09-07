/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { evidenceCounts } from './evidenceCoverageProjection.mjs';

export const PROVENANCE_STATUSES = Object.freeze(['captured', 'unrecorded', 'invalid', 'unsupported']);
export const PROVENANCE_COUNT_FIELDS = Object.freeze(['events', ...PROVENANCE_STATUSES.map(status => `${status}_events`)]);

export function projectProvenanceCounts(row) {
    const counts = evidenceCounts(row, PROVENANCE_COUNT_FIELDS);
    if (PROVENANCE_STATUSES.reduce((sum, status) => sum + counts[`${status}_events`], 0) !== counts.events) {
        throw new Error('Inconsistent provenance counts');
    }
    return counts;
}
