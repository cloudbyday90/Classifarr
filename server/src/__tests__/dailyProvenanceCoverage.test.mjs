/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@jest/globals';
import { buildDailyProvenanceCoverage } from '../services/dailyProvenanceCoverage.mjs';
import { emptyProvenanceTrend } from './helpers/evidenceTrendFixture.mjs';

const fixture = () => {
    const trend = emptyProvenanceTrend();
    Object.assign(trend.totals, { events: '4', captured_events: '1', unrecorded_events: '1', invalid_events: '1', unsupported_events: '1' });
    Object.assign(trend.days[13], trend.totals, { metadata: 'PRIVATE' });
    trend.excluded = { older_events: '2', future_events: '1', undated_events: '1' };
    return trend;
};
const retained = { events: 8, captured_events: 2, unrecorded_events: 4, invalid_events: 1, unsupported_events: 1 };
const build = trend => buildDailyProvenanceCoverage(trend ?? fixture(), retained);

test('projects a complete bounded series with partial today, explicit exclusions and nullable coverage', () => {
    const result = build();
    expect(result.days).toHaveLength(14);
    expect(result.days[0]).toMatchObject({ date: '2026-08-25', events: 0, capture_coverage: null, is_partial: false });
    expect(result.days.at(-1)).toMatchObject({ date: '2026-09-07', events: 4, capture_coverage: 0.25, is_partial: true });
    expect(result.totals.capture_coverage).toBe(0.25);
    expect(result.excluded).toEqual({ older_events: 2, future_events: 1, undated_events: 1 });
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
});

test.each([null, false, -1, 1.5, '9007199254740992'])('rejects malformed daily count %s', value => {
    const trend = fixture();
    trend.days[0].events = value;
    expect(() => build(trend)).toThrow('Invalid evidence count');
});

test.each(['length', 'duplicate', 'out_of_order', 'invalid_date', 'end', 'partial', 'partition', 'daily_total', 'excluded', 'retained_status', 'zone', 'basis'])('rejects inconsistent %s', kind => {
    const trend = fixture();
    if (kind === 'length') trend.days.pop();
    if (kind === 'duplicate') trend.days[1] = trend.days[0];
    if (kind === 'out_of_order') trend.days.reverse();
    if (kind === 'invalid_date') trend.start_date = '2026-02-30';
    if (kind === 'end') trend.end_date = '2026-09-08';
    if (kind === 'partial') trend.days[0].is_partial = true;
    if (kind === 'partition') trend.days[0].captured_events = 1;
    if (kind === 'daily_total') Object.assign(trend.days[0], { events: 1, captured_events: 1 });
    if (kind === 'excluded') trend.excluded.older_events = 3;
    if (kind === 'retained_status') Object.assign(trend.totals, { invalid_events: 2, unrecorded_events: 0 });
    if (kind === 'zone') trend.time_zone = '';
    if (kind === 'basis') trend.timestamp_basis = 'utc_inferred';
    expect(() => build(trend)).toThrow();
});

test('empty retained history is a known zero window, not missing data', () => {
    const trend = emptyProvenanceTrend();
    const result = buildDailyProvenanceCoverage(trend, trend.totals);
    expect(result.totals.capture_coverage).toBeNull();
    expect(result.days.every(day => day.events === 0 && day.capture_coverage === null)).toBe(true);
    expect(() => buildDailyProvenanceCoverage(null, trend.totals)).toThrow('Invalid provenance window');
});
