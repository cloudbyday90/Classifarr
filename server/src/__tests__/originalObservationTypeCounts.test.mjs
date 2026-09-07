/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@jest/globals';
import { projectOriginalObservationTypes } from '../services/originalObservationTypeCounts.mjs';
import { buildLibraryUtcCoverage } from '../services/libraryUtcCoverage.mjs';
import { emptyLibraryUtcSnapshot } from './helpers/libraryUtcCoverageFixture.mjs';
import { emptyUtcProvenanceTrend } from './helpers/evidenceTrendFixture.mjs';

const types = () => ({ imported_membership_events: 3, manual_action_events: 2, classifier_workflow_events: 1, unknown_origin_events: 4 });
test('projects only safe type counts and allows unmapped captured methods to stay unknown', () => {
    expect(projectOriginalObservationTypes({ ...types(), metadata: 'PRIVATE' }, { events: 10, captured_events: 7 })).toEqual(types());
});
test.each([undefined, null, -1, 0.5, false, 'bad', '9007199254740992'])('rejects invalid type count %s', value => {
    expect(() => projectOriginalObservationTypes({ ...types(), unknown_origin_events: value }, { events: 10, captured_events: 6 })).toThrow();
});
test('rejects inferred known origins and partitions that lose events', () => {
    expect(() => projectOriginalObservationTypes(types(), { events: 10, captured_events: 5 })).toThrow();
    expect(() => projectOriginalObservationTypes(types(), { events: 11, captured_events: 6 })).toThrow();
});
test.each([false, true])('reconciles each type across complete or capped groups (capped=%s)', capped => {
    const raw = emptyLibraryUtcSnapshot();
    Object.assign(raw.utc_library_totals, { retained_events: 2, events: 2, captured_events: 2, imported_membership_events: 2 });
    raw.utc_library_group_count = 2;
    raw.utc_library_groups = Array.from({ length: capped ? 1 : 2 }, (_, i) => ({ ...raw.utc_library_totals,
        retained_events: 1, events: 1, captured_events: 1, imported_membership_events: 1,
        library_id: i + 1, library_name: 'Library', library_active: true }));
    const trend = { ...emptyUtcProvenanceTrend(), totals: { events: 2, captured_events: 2, unrecorded_events: 0, invalid_events: 0, unsupported_events: 0 } };
    const build = () => buildLibraryUtcCoverage(raw, trend, 2, capped ? 1 : 200);
    expect(build().totals.observation_types.imported_membership_events).toBe(2);
    Object.assign(raw.utc_library_groups[0], { imported_membership_events: 0, manual_action_events: 1 });
    expect(build).toThrow('Inconsistent evidence group totals');
});
