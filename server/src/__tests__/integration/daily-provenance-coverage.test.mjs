/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect, beforeEach, afterEach } from '@jest/globals';
import { getPool } from './setup.mjs';
import { EVIDENCE_COVERAGE_SQL } from '../../services/evidenceCoverageQuery.mjs';
import { buildEvidenceCoverage } from '../../services/evidenceCoverageService.mjs';
import { buildClassificationCandidateCapture } from '../../services/classificationCandidateCapture.mjs';

let libraryId;
beforeEach(async () => {
    libraryId = (await getPool().query(`INSERT INTO libraries(name,external_id,media_type)
        VALUES('Daily provenance','daily-provenance-fixture','movie') RETURNING id`)).rows[0].id;
});
afterEach(async () => {
    await getPool().query("DELETE FROM classification_history WHERE title='PRIVATE daily provenance fixture'");
    await getPool().query('DELETE FROM libraries WHERE id=$1', [libraryId]);
});
async function history(createdAt, capture) {
    const metadata = capture === undefined ? {} : { classification_details: { candidate_capture: capture } };
    return (await getPool().query(`INSERT INTO classification_history(tmdb_id,media_type,title,method,metadata,created_at,library_id)
        VALUES(603,'movie','PRIVATE daily provenance fixture','policy_auto',$1,$2::timestamp,$3) RETURNING id`,
    [JSON.stringify(metadata), createdAt, libraryId])).rows[0].id;
}
async function readAt(capturedAt, timeZone = 'America/New_York') {
    const client = await getPool().connect();
    try {
        await client.query('BEGIN READ ONLY');
        await client.query("SELECT set_config('TimeZone', $1, true)", [timeZone]);
        // Only the test clock is replaced. Bound values still exercise the production SQL and projection.
        const sql = EVIDENCE_COVERAGE_SQL.replaceAll('statement_timestamp()', '$2::timestamptz');
        return buildEvidenceCoverage((await client.query(sql, [200, capturedAt])).rows[0]);
    } finally { await client.query('ROLLBACK'); client.release(); }
}
const valid = () => buildClassificationCandidateCapture({ method: 'policy_auto', library: { id: libraryId } });

test('preserves database calendar boundaries, partial today, DST dates and excluded timestamps', async () => {
    await history('2026-10-19 23:59:59.999999');
    await history('2026-10-20 00:00:00', valid());
    await history('2026-11-01 01:30:00');
    await history('2026-11-01 01:30:00', { ...valid(), version: 'future' });
    await history('2026-11-02 06:59:59.999999', buildClassificationCandidateCapture({ method: 'future' }));
    await history('2026-11-02 07:00:00');
    await history('2026-11-02 08:00:00');
    for (const date of [null, 'infinity', '-infinity']) await history(date);
    const before = (await getPool().query('SELECT id,created_at,metadata FROM classification_history ORDER BY id')).rows;
    const result = await readAt('2026-11-02T12:00:00Z');
    const trend = result.provenance_trend;
    expect(result.history.totals.events).toBe(10);
    expect(trend).toMatchObject({ day_count: 14, time_zone: 'America/New_York', timestamp_basis: 'stored_database_calendar',
        start_date: '2026-10-20', end_date: '2026-11-02',
        totals: { events: 4, captured_events: 1, unrecorded_events: 1, invalid_events: 1, unsupported_events: 1, capture_coverage: 0.25 },
        excluded: { older_events: 1, future_events: 2, undated_events: 3 } });
    expect(trend.days.map(day => day.date)).toEqual([
        '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26',
        '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02',
    ]);
    expect(trend.days[1]).toMatchObject({ events: 0, capture_coverage: null, is_partial: false });
    expect(trend.days[12]).toMatchObject({ events: 2, captured_events: 0, capture_coverage: 0, is_partial: false });
    expect(trend.days[13]).toMatchObject({ events: 1, unsupported_events: 1, is_partial: true });
    expect((await getPool().query('SELECT id,created_at,metadata FROM classification_history ORDER BY id')).rows).toEqual(before);
    expect(JSON.stringify(trend)).not.toMatch(/PRIVATE|library_id|metadata|tmdb_id/);
    const utc = (await readAt('2026-11-02T12:00:00Z', 'UTC')).provenance_trend;
    expect(utc).toMatchObject({ time_zone: 'UTC', totals: { events: 6 }, excluded: { future_events: 0 } });
    expect(utc.days.map(day => day.date)).toEqual(trend.days.map(day => day.date));
});

test('an empty leap-day window contains every date and never invents coverage', async () => {
    const trend = (await readAt('2028-03-01T03:00:00Z')).provenance_trend;
    expect(trend).toMatchObject({ start_date: '2028-02-16', end_date: '2028-02-29', totals: { events: 0, capture_coverage: null } });
    expect(trend.days).toHaveLength(14);
    expect(trend.days.at(-1)).toMatchObject({ date: '2028-02-29', is_partial: true });
    expect(trend.days.every(day => day.events === 0 && day.capture_coverage === null)).toBe(true);
});

test('resolution changes do not move original provenance to the resolution date or method', async () => {
    const id = await history('2026-09-06 09:00:00', valid());
    const before = await readAt('2026-09-07T12:00:00Z');
    await getPool().query("UPDATE classification_history SET method='manual_classification',status='completed' WHERE id=$1", [id]);
    const after = await readAt('2026-09-07T12:00:00Z');
    expect(after.provenance_trend).toEqual(before.provenance_trend);
    expect(after.provenance_trend.days.at(-2)).toMatchObject({ date: '2026-09-06', events: 1, captured_events: 1 });
    expect(after.provenance_trend.days.at(-1).events).toBe(0);
    expect(after.history_attribution.groups[0].recorded_method).toBe('manual_classification');
});
