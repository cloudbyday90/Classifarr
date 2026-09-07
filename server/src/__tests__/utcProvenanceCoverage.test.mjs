/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@jest/globals';
import { buildUtcProvenanceCoverage } from '../services/utcProvenanceCoverage.mjs';
import { emptyUtcProvenanceTrend } from './helpers/evidenceTrendFixture.mjs';

const totals = { events: 8, captured_events: 2, unrecorded_events: 4, invalid_events: 1, unsupported_events: 1 };
const recording = { events: 8, recorded_events: 6, unknown_events: 2 };
const fixture = () => {
    const trend = emptyUtcProvenanceTrend();
    Object.assign(trend.totals, { events: '4', captured_events: '1', unrecorded_events: '1', invalid_events: '1', unsupported_events: '1' });
    Object.assign(trend.days[13], trend.totals, { metadata: 'PRIVATE' });
    trend.excluded = { older_events: '1', future_events: '1', unknown_events: '2' };
    return trend;
};
const build = (trend = fixture(), coverage = recording, date = '2026-09-07') => buildUtcProvenanceCoverage(trend, totals, coverage, date);

test('projects the UTC window and unknown-time exclusions with no metadata leakage', () => {
    const result = build();
    expect(result).toMatchObject({ timestamp_basis: 'recorded_instant_utc', time_zone: 'UTC',
        totals: { events: 4, capture_coverage: 0.25 }, excluded: { older_events: 1, future_events: 1, unknown_events: 2 } });
    expect(result.days[0].capture_coverage).toBeNull();
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
});

test.each(['basis', 'zone', 'date', 'order', 'missing_day', 'partial', 'partition', 'daily_total', 'exclusion', 'unsafe_count'])('rejects inconsistent %s', kind => {
    const trend = fixture();
    if (kind === 'basis') trend.timestamp_basis = 'stored_database_calendar';
    if (kind === 'zone') trend.time_zone = 'America/New_York';
    if (kind === 'date') trend.start_date = '2026-02-30';
    if (kind === 'order') trend.days.reverse();
    if (kind === 'missing_day') trend.days[1] = null;
    if (kind === 'partial') trend.days[0].is_partial = true;
    if (kind === 'partition') trend.days[0].captured_events = 1;
    if (kind === 'daily_total') Object.assign(trend.days[0], { events: 1, captured_events: 1 });
    if (kind === 'exclusion') trend.excluded.unknown_events = 3;
    if (kind === 'unsafe_count') trend.excluded.unknown_events = '9007199254740992';
    expect(() => build(trend)).toThrow();
});

test('requires the actual capture date and reconciliation to known/unknown recording counts', () => {
    expect(() => build(fixture(), recording, '2026-09-08')).toThrow('Invalid UTC provenance window');
    expect(() => build(fixture(), { ...recording, unknown_events: 1 })).toThrow('Inconsistent UTC recording-time coverage');
    expect(() => build(fixture(), { ...recording, recorded_events: 5 })).toThrow('Inconsistent UTC recording-time coverage');
});

test('all unknown history produces a zero window with N/A, not invented dates', () => {
    const trend = emptyUtcProvenanceTrend();
    trend.excluded.unknown_events = 8;
    const result = build(trend, { events: 8, recorded_events: 0, unknown_events: 8 });
    expect(result.totals.capture_coverage).toBeNull();
    expect(result.days.every(day => day.events === 0 && day.capture_coverage === null)).toBe(true);
});
