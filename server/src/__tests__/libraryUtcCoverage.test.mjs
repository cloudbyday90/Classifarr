/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@jest/globals';
import { buildLibraryUtcCoverage } from '../services/libraryUtcCoverage.mjs';
import { emptyLibraryUtcSnapshot } from './helpers/libraryUtcCoverageFixture.mjs';
import { emptyUtcProvenanceTrend } from './helpers/evidenceTrendFixture.mjs';

const fixture = () => {
    const raw = emptyLibraryUtcSnapshot();
    Object.assign(raw.utc_library_totals, { retained_events: '8', events: '4', captured_events: '1', unrecorded_events: '1',
        invalid_events: '1', unsupported_events: '1', older_events: '1', future_events: '1', unknown_events: '2' });
    const empty = emptyLibraryUtcSnapshot().utc_library_totals;
    raw.utc_library_groups = [
        { ...empty, retained_events: 5, events: 4, captured_events: 1, unrecorded_events: 1, invalid_events: 1,
            unsupported_events: 1, older_events: 1, library_id: 1, library_name: 'Library', library_active: false, metadata: 'PRIVATE' },
        { ...empty, retained_events: 3, future_events: 1, unknown_events: 2, library_id: null, library_name: null, library_active: null },
    ];
    raw.utc_library_group_count = '2';
    return raw;
};
const trend = () => ({ ...emptyUtcProvenanceTrend(),
    totals: { events: 4, captured_events: 1, unrecorded_events: 1, invalid_events: 1, unsupported_events: 1 },
    excluded: { older_events: 1, future_events: 1, unknown_events: 2 } });
const build = (raw = fixture(), limit = 200) => buildLibraryUtcCoverage(raw, trend(), 8, limit);

test('reconciles known and unknown recording times and projects only catalog/count fields', () => {
    const result = build();
    expect(result).toMatchObject({ group_count: 2, truncated: false, timestamp_basis: 'recorded_instant_utc', time_zone: 'UTC',
        totals: { retained_events: 8, events: 4, capture_coverage: 0.25 } });
    expect(result.groups[1]).toMatchObject({ library_id: null, retained_events: 3, events: 0, capture_coverage: null });
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
});

test.each(['partition', 'provenance', 'total', 'order', 'duplicate', 'identity', 'name', 'active', 'missing', 'empty_group', 'unsafe', 'group_count'])('rejects inconsistent %s', kind => {
    const raw = fixture();
    if (kind === 'partition') raw.utc_library_groups[0].unknown_events = 1;
    if (kind === 'provenance') raw.utc_library_groups[0].captured_events = 0;
    if (kind === 'total') Object.assign(raw.utc_library_totals, { captured_events: 0, unrecorded_events: 2 });
    if (kind === 'order') raw.utc_library_groups.reverse();
    if (kind === 'duplicate') raw.utc_library_groups[1].library_id = 1;
    if (kind === 'identity') raw.utc_library_groups[0].library_id = '1';
    if (kind === 'name') raw.utc_library_groups[0].library_name = 'x'.repeat(256);
    if (kind === 'active') raw.utc_library_groups[1].library_active = true;
    if (kind === 'missing') raw.utc_library_groups.pop();
    if (kind === 'empty_group') Object.assign(raw.utc_library_groups[1], emptyLibraryUtcSnapshot().utc_library_totals);
    if (kind === 'unsafe') raw.utc_library_totals.retained_events = '9007199254740992';
    if (kind === 'group_count') raw.utc_library_group_count = 9;
    expect(() => build(raw)).toThrow();
});

test('capped groups retain full totals but cannot exceed any global status or time count', () => {
    const raw = fixture();
    raw.utc_library_groups.pop();
    expect(build(raw, 1)).toMatchObject({ truncated: true, group_count: 2, totals: { retained_events: 8, unknown_events: 2 } });
    expect(() => build({ ...raw, utc_library_group_count: 5 }, 1)).toThrow('Inconsistent omitted library groups');
    Object.assign(raw.utc_library_groups[0], { captured_events: 2, unrecorded_events: 0 });
    expect(() => build(raw, 1)).toThrow('Inconsistent evidence group totals');
});

test('zero retained history produces no measured libraries', () => {
    expect(buildLibraryUtcCoverage(emptyLibraryUtcSnapshot(), emptyUtcProvenanceTrend(), 0, 200))
        .toMatchObject({ groups: [], group_count: 0, truncated: false, totals: { events: 0, capture_coverage: null } });
});
