/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { evidenceCount, reconcileEvidenceGroups } from './evidenceCoverageProjection.mjs';
import { LIBRARY_UTC_COUNT_FIELDS, projectLibraryUtcCounts as project } from './libraryUtcCoverageCounts.mjs';
import { OBSERVATION_TYPE_FIELDS } from './originalObservationTypeCounts.mjs';
import { CANDIDATE_COMPARISON_FIELDS, assertCandidateComparisonLibrary } from './candidateLibraryComparisonCounts.mjs';

export function buildLibraryUtcCoverage(snapshot, utcTrend, retainedEvents, limit) {
    const totals = project(snapshot.utc_library_totals);
    const expected = { retained_events: retainedEvents, ...utcTrend.totals, ...utcTrend.excluded };
    if (LIBRARY_UTC_COUNT_FIELDS.some(field => totals[field] !== expected[field])) throw new Error('Inconsistent library UTC totals');
    const groupCount = evidenceCount(snapshot.utc_library_group_count);
    if (groupCount > retainedEvents || !Array.isArray(snapshot.utc_library_groups)
        || snapshot.utc_library_groups.length !== Math.min(groupCount, limit)) throw new Error('Incomplete library UTC groups');
    let previous = 0;
    const groups = snapshot.utc_library_groups.map(row => {
        const id = row.library_id;
        const order = id === null ? Infinity : id;
        if ((id !== null && (!Number.isInteger(id) || id < 1 || id > 2147483647)) || order <= previous
            || (row.library_name !== null && (typeof row.library_name !== 'string' || [...row.library_name].length > 255))
            || ![true, false, null].includes(row.library_active)
            || (id === null && (row.library_name !== null || row.library_active !== null))) throw new Error('Invalid library UTC identity');
        previous = order;
        const counts = project(row);
        assertCandidateComparisonLibrary(counts.candidate_comparison, id);
        if (counts.retained_events === 0) throw new Error('Empty library UTC group');
        return { library_id: id, library_name: row.library_name, library_active: row.library_active, ...counts };
    });
    const truncated = groupCount > groups.length;
    reconcileEvidenceGroups(totals, groups, LIBRARY_UTC_COUNT_FIELDS, truncated);
    reconcileEvidenceGroups(totals.observation_types, groups.map(row => row.observation_types), OBSERVATION_TYPE_FIELDS, truncated);
    reconcileEvidenceGroups(totals.candidate_comparison, groups.map(row => row.candidate_comparison), CANDIDATE_COMPARISON_FIELDS, truncated);
    const omittedEvents = totals.retained_events - groups.reduce((sum, row) => sum + row.retained_events, 0);
    if (omittedEvents < groupCount - groups.length) throw new Error('Inconsistent omitted library groups');
    return { timestamp_basis: utcTrend.timestamp_basis, time_zone: utcTrend.time_zone, day_count: utcTrend.day_count,
        start_date: utcTrend.start_date, end_date: utcTrend.end_date,
        totals, group_limit: limit, group_count: groupCount, truncated, groups };
}
