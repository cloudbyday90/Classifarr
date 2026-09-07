/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { evidenceCount, evidenceCounts } from './evidenceCoverageProjection.mjs';

export const CANDIDATE_COMPARISON_STATES = Object.freeze(['same_library', 'different_library', 'no_candidate', 'invalid_candidate', 'unknown_library']);
export const CANDIDATE_COMPARISON_FIELDS = Object.freeze(CANDIDATE_COMPARISON_STATES.map(state => `${state}_events`));

export function projectCandidateLibraryComparison(row, classifierEvents) {
    const counts = evidenceCounts(row, CANDIDATE_COMPARISON_FIELDS);
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    if (!Number.isSafeInteger(total) || total !== evidenceCount(classifierEvents)) throw new Error('Inconsistent candidate library comparison');
    return counts;
}

export function assertCandidateComparisonLibrary(counts, libraryId) {
    if (libraryId === null ? counts.same_library_events + counts.different_library_events !== 0 : counts.unknown_library_events !== 0) {
        throw new Error('Inconsistent candidate comparison library');
    }
}
