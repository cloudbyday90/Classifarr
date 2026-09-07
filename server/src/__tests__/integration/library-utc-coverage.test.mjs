/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect, beforeEach, afterEach } from '@jest/globals';
import { getPool } from './setup.mjs';
import { EVIDENCE_COVERAGE_SQL } from '../../services/evidenceCoverageQuery.mjs';
import { buildEvidenceCoverage } from '../../services/evidenceCoverageService.mjs';
import { buildClassificationCandidateCapture } from '../../services/classificationCandidateCapture.mjs';

let client, ids;
beforeEach(async () => {
    client = await getPool().connect();
    await client.query('BEGIN');
    ids = (await client.query(`INSERT INTO libraries(name,external_id,media_type,is_active)
        VALUES('Active','library-utc-active','movie',true),('Inactive','library-utc-inactive','movie',false),
        ('No history','library-utc-empty','movie',true) RETURNING id`)).rows.map(row => row.id);
});
afterEach(async () => { await client.query('ROLLBACK'); client.release(); });
const valid = () => buildClassificationCandidateCapture({ method: 'policy_auto', library: { id: ids[0] } });
async function history(library, instant, capture) {
    const metadata = capture === undefined ? {} : { classification_details: { candidate_capture: capture } };
    return (await client.query(`INSERT INTO classification_history(title,media_type,method,status,library_id,created_at,recorded_at,metadata)
        VALUES('PRIVATE library UTC','movie','policy_auto','pending',$1,'1999-01-01',$2,$3) RETURNING id`,
    [library, instant, JSON.stringify(metadata)])).rows[0].id;
}
async function readAt(zone = 'UTC') {
    await client.query("SELECT set_config('TimeZone',$1,true)", [zone]);
    return buildEvidenceCoverage((await client.query(EVIDENCE_COVERAGE_SQL.replaceAll('statement_timestamp()', '$2::timestamptz'),
        [200, '2026-11-02T02:00:00Z'])).rows[0]);
}

test('library windows partition retained history with UTC boundaries, inactive and unassigned groups', async () => {
    await history(ids[0], '2026-10-19T23:59:59.999999Z');
    await history(ids[0], '2026-10-20T00:00:00Z', valid());
    await history(ids[0], '2026-11-01T01:30:00-04:00');
    await history(ids[0], '2026-11-01T01:30:00-05:00', { ...valid(), version: 'future' });
    await history(ids[0], '2026-11-02T01:59:59.999999Z', buildClassificationCandidateCapture({ method: 'future' }));
    await history(ids[0], '2026-11-02T02:00:00Z');
    await history(ids[1], null, valid());
    await history(null, '2026-11-02T01:00:00Z', valid());
    const before = (await client.query('SELECT id,library_id,recorded_at,metadata FROM classification_history ORDER BY id')).rows;
    const baseline = await readAt();
    const result = baseline.utc_library_coverage;
    expect(result.groups.map(row => row.library_id)).toEqual([ids[0], ids[1], null]);
    expect(result.groups[0]).toMatchObject({ retained_events: 6, events: 4, captured_events: 1, unrecorded_events: 1,
        invalid_events: 1, unsupported_events: 1, older_events: 1, future_events: 1, unknown_events: 0, capture_coverage: 0.25 });
    expect(result.groups[1]).toMatchObject({ library_active: false, retained_events: 1, events: 0, unknown_events: 1, capture_coverage: null });
    expect(result.groups[2]).toMatchObject({ library_name: null, library_active: null, events: 1, captured_events: 1 });
    expect(result.totals).toMatchObject({ retained_events: 8, events: 5, captured_events: 2, unknown_events: 1 });
    for (const zone of ['America/New_York', 'Pacific/Auckland']) expect((await readAt(zone)).utc_library_coverage).toEqual(result);
    expect((await client.query('SELECT id,library_id,recorded_at,metadata FROM classification_history ORDER BY id')).rows).toEqual(before);
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE|metadata|tmdb_id/);
});

test('resolution moves the recorded library group while preserving original capture and global counts', async () => {
    const event = await history(ids[0], '2026-11-01T12:00:00Z', valid());
    const before = await readAt();
    await client.query("UPDATE classification_history SET library_id=$1,method='manual_classification',status='completed' WHERE id=$2", [ids[1], event]);
    const after = await readAt();
    expect(after.utc_library_coverage.groups[0]).toMatchObject({ library_id: ids[1], captured_events: 1 });
    expect(after.utc_library_coverage.totals).toEqual(before.utc_library_coverage.totals);
    expect(after.utc_provenance_trend).toEqual(before.utc_provenance_trend);
});

test('removed pending-history libraries join the unassigned group without losing counts', async () => {
    await history(ids[0], '2026-11-01T12:00:00Z', valid());
    await history(null, null);
    const before = await readAt();
    await client.query('DELETE FROM libraries WHERE id=$1', [ids[0]]);
    const removed = await readAt();
    expect(removed.utc_library_coverage.totals).toEqual(before.utc_library_coverage.totals);
    expect(removed.utc_library_coverage.groups).toHaveLength(1);
    expect(removed.utc_library_coverage.groups[0]).toMatchObject({ library_id: null, retained_events: 2, captured_events: 1, unknown_events: 1 });
});

test('an empty catalog observation produces zero library groups rather than invented zero-history rows', async () => {
    const result = (await readAt()).utc_library_coverage;
    expect(result).toMatchObject({ group_count: 0, groups: [], totals: { retained_events: 0, events: 0, capture_coverage: null } });
});
