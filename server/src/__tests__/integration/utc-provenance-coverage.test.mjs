/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect, beforeEach, afterEach } from '@jest/globals';
import { getPool } from './setup.mjs';
import { EVIDENCE_COVERAGE_SQL } from '../../services/evidenceCoverageQuery.mjs';
import { buildEvidenceCoverage } from '../../services/evidenceCoverageService.mjs';
import { buildClassificationCandidateCapture } from '../../services/classificationCandidateCapture.mjs';

let client;
beforeEach(async () => { client = await getPool().connect(); await client.query('BEGIN'); });
afterEach(async () => { await client.query('ROLLBACK'); client.release(); });
const valid = () => buildClassificationCandidateCapture({ method: 'policy_auto', library: { id: 1 } });
async function history(instant, capture) {
    const metadata = capture === undefined ? {} : { classification_details: { candidate_capture: capture } };
    return (await client.query(`INSERT INTO classification_history(title,media_type,method,status,metadata,created_at,recorded_at)
        VALUES('PRIVATE UTC fixture','movie','policy_auto','pending',$1,'1999-01-01 12:00:00',$2) RETURNING id`,
    [JSON.stringify(metadata), instant])).rows[0].id;
}
async function readAt(instant, zone = 'UTC') {
    await client.query("SELECT set_config('TimeZone',$1,true)", [zone]);
    return buildEvidenceCoverage((await client.query(EVIDENCE_COVERAGE_SQL.replaceAll('statement_timestamp()', '$2::timestamptz'), [200, instant])).rows[0]);
}

test('UTC boundaries and partitions are invariant across session zones, offsets and repeated DST hours', async () => {
    await history('2026-10-19T23:59:59.999999Z');
    const start = await history('2026-10-20T00:00:00Z', valid());
    await history('2026-10-31T23:59:59.999999Z');
    await history('2026-11-01T00:00:00Z', valid());
    await history('2026-11-01T01:30:00-04:00');
    await history('2026-11-01T01:30:00-05:00', { ...valid(), version: 'future' });
    await history('2026-11-02T01:59:59.999999Z', buildClassificationCandidateCapture({ method: 'future' }));
    await history('2026-11-02T02:00:00Z');
    await history('2026-11-02T02:00:00.000001Z', valid());
    await history(null, valid());
    const before = (await client.query('SELECT id,metadata,created_at::text,recorded_at FROM classification_history ORDER BY id')).rows;
    const baseline = await readAt('2026-11-02T02:00:00Z');
    const trend = baseline.utc_provenance_trend;
    expect(trend).toMatchObject({ timestamp_basis: 'recorded_instant_utc', time_zone: 'UTC',
        start_date: '2026-10-20', end_date: '2026-11-02',
        totals: { events: 6, captured_events: 2, unrecorded_events: 2, invalid_events: 1, unsupported_events: 1, capture_coverage: 1 / 3 },
        excluded: { older_events: 1, future_events: 2, unknown_events: 1 } });
    expect(trend.days[0]).toMatchObject({ events: 1, captured_events: 1 });
    expect(trend.days[11]).toMatchObject({ date: '2026-10-31', events: 1 });
    expect(trend.days[12]).toMatchObject({ date: '2026-11-01', events: 3 });
    expect(trend.days[13]).toMatchObject({ events: 1, unsupported_events: 1, is_partial: true });
    for (const zone of ['America/New_York', 'Pacific/Auckland', 'Asia/Kathmandu']) {
        const result = await readAt('2026-11-02T02:00:00Z', zone);
        expect(result.utc_provenance_trend).toEqual(trend);
        expect(result.recording_time_coverage).toEqual({ events: 10, recorded_events: 9, unknown_events: 1 });
        expect(result.provenance_trend).toMatchObject({ timestamp_basis: 'stored_database_calendar', time_zone: zone,
            totals: { events: 0 }, excluded: { older_events: 10 } });
    }
    expect((await client.query('SELECT id,metadata,created_at::text,recorded_at FROM classification_history ORDER BY id')).rows).toEqual(before);
    expect(JSON.stringify(trend)).not.toMatch(/PRIVATE|library_id|metadata|tmdb_id/);
    await client.query("UPDATE classification_history SET method='manual_classification',status='pending_retry' WHERE id=$1", [start]);
    expect((await readAt('2026-11-02T02:00:00Z')).utc_provenance_trend).toEqual(trend);
});

test('leap-day midnight includes the last microsecond of yesterday and excludes the capture instant', async () => {
    await history('2028-02-29T23:59:59.999999Z', valid());
    await history('2028-03-01T00:00:00Z');
    const trend = (await readAt('2028-03-01T00:00:00Z', 'America/New_York')).utc_provenance_trend;
    expect(trend).toMatchObject({ start_date: '2028-02-17', end_date: '2028-03-01', totals: { events: 1 }, excluded: { future_events: 1 } });
    expect(trend.days[12]).toMatchObject({ date: '2028-02-29', events: 1, captured_events: 1 });
    expect(trend.days[13]).toMatchObject({ date: '2028-03-01', events: 0, is_partial: true, capture_coverage: null });
});

test('empty and entirely unknown history retain all 14 dates without borrowing created_at', async () => {
    const empty = (await readAt('2026-09-07T12:00:00Z')).utc_provenance_trend;
    expect(empty.days).toHaveLength(14);
    expect(empty.totals.capture_coverage).toBeNull();
    await history(null, valid());
    const result = await readAt('2026-09-07T12:00:00Z');
    expect(result.utc_provenance_trend.days).toEqual(empty.days);
    expect(result.utc_provenance_trend.excluded.unknown_events).toBe(1);
    expect(result.recording_time_coverage).toEqual({ events: 1, recorded_events: 0, unknown_events: 1 });
});
