/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { CANDIDATE_COMPARISON_STATES } from './candidateLibraryComparisonCounts.mjs';

// Only explicit validated capture supplies this ID. Catalog existence is not candidate validity.
export const CANDIDATE_LIBRARY_COMPARISON_SQL = `CASE
    WHEN history.original_candidate_library_id IS NOT NULL THEN CASE
        WHEN history.library_id IS NULL THEN 'unknown_library'
        WHEN history.original_candidate_library_id = history.library_id THEN 'same_library'
        ELSE 'different_library' END
    WHEN history.evidence_candidate_status = 'no_candidate' THEN 'no_candidate'
    WHEN history.evidence_candidate_status = 'invalid_candidate' THEN 'invalid_candidate'
    ELSE NULL END`;

// Other origins never enter the classifier comparison, including legacy ranked candidates.
export const CANDIDATE_LIBRARY_COMPARISON_COUNTS_SQL = CANDIDATE_COMPARISON_STATES.map(state =>
    `count(*) FILTER (WHERE time_scope = 'window' AND observation_type = 'classifier_workflow'
        AND candidate_comparison_state = '${state}') AS ${state}_events`).join(',\n        ');
