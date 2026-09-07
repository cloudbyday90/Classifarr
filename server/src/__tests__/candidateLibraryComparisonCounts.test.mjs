/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@jest/globals';
import { projectCandidateLibraryComparison, assertCandidateComparisonLibrary } from '../services/candidateLibraryComparisonCounts.mjs';
import { buildLibraryUtcCoverage } from '../services/libraryUtcCoverage.mjs';
import { emptyLibraryUtcSnapshot } from './helpers/libraryUtcCoverageFixture.mjs';
import { emptyUtcProvenanceTrend } from './helpers/evidenceTrendFixture.mjs';

const counts = () => ({ same_library_events: 3, different_library_events: 2, no_candidate_events: 1,
    invalid_candidate_events: 1, unknown_library_events: 1 });
test('projects only comparison counts and accepts database integer strings', () => {
    expect(projectCandidateLibraryComparison({ ...counts(), same_library_events: '3', metadata: 'PRIVATE' }, 8)).toEqual(counts());
});
test.each([undefined, null, -1, 0.5, false, 'bad', '9007199254740992'])('rejects invalid comparison count %s', value => {
    expect(() => projectCandidateLibraryComparison({ ...counts(), same_library_events: value }, 8)).toThrow();
});
test('rejects lost events, invented comparisons and unsafe totals', () => {
    expect(() => projectCandidateLibraryComparison(counts(), 9)).toThrow();
    expect(() => projectCandidateLibraryComparison(counts(), 7)).toThrow();
    expect(() => projectCandidateLibraryComparison({ ...counts(), same_library_events: Number.MAX_SAFE_INTEGER }, Number.MAX_SAFE_INTEGER)).toThrow();
});
test('unknown library cannot match or differ, and known libraries cannot be unknown', () => {
    expect(() => assertCandidateComparisonLibrary(counts(), null)).toThrow();
    expect(() => assertCandidateComparisonLibrary(counts(), 1)).toThrow();
    expect(() => assertCandidateComparisonLibrary({ ...counts(), unknown_library_events: 0 }, 1)).not.toThrow();
    expect(() => assertCandidateComparisonLibrary({ ...counts(), same_library_events: 0, different_library_events: 0 }, null)).not.toThrow();
});
test.each([false, true])('reconciles each comparison across complete or capped groups (capped=%s)', capped => {
    const raw = emptyLibraryUtcSnapshot();
    Object.assign(raw.utc_library_totals, { retained_events: 2, events: 2, captured_events: 2, classifier_workflow_events: 2, same_library_events: 2 });
    raw.utc_library_group_count = 2;
    raw.utc_library_groups = Array.from({ length: capped ? 1 : 2 }, (_, i) => ({ ...raw.utc_library_totals,
        retained_events: 1, events: 1, captured_events: 1, classifier_workflow_events: 1, same_library_events: 1,
        library_id: i + 1, library_name: 'Library', library_active: true }));
    const trend = { ...emptyUtcProvenanceTrend(), totals: { events: 2, captured_events: 2, unrecorded_events: 0, invalid_events: 0, unsupported_events: 0 } };
    const build = () => buildLibraryUtcCoverage(raw, trend, 2, capped ? 1 : 200);
    expect(build().totals.candidate_comparison.same_library_events).toBe(2);
    Object.assign(raw.utc_library_groups[0], { same_library_events: 0, different_library_events: 1 });
    expect(build).toThrow('Inconsistent evidence group totals');
});
