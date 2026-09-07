/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect, beforeEach, afterEach } from '@jest/globals';
import { getPool } from './setup.mjs';
import { EVIDENCE_COVERAGE_SQL } from '../../services/evidenceCoverageQuery.mjs';
import { buildEvidenceCoverage } from '../../services/evidenceCoverageService.mjs';
import { buildClassificationCandidateCapture, CLASSIFIER_CAPTURE_METHODS, NON_CLASSIFIER_CAPTURE_METHODS } from '../../services/classificationCandidateCapture.mjs';

let client, original, destination;
beforeEach(async () => {
    client = await getPool().connect();
    await client.query('BEGIN');
    [original, destination] = (await client.query(`INSERT INTO libraries(name,external_id,media_type)
        VALUES('Candidate','comparison-a','movie'),('Recorded','comparison-b','movie') RETURNING id`)).rows.map(row => row.id);
});
afterEach(async () => { await client.query('ROLLBACK'); client.release(); });
const capture = (method = 'policy_auto', id = original) => buildClassificationCandidateCapture({ method, policyResult: { ranked: [{ library_id: id }] } });
const empty = () => ({ same_library_events: 0, different_library_events: 0, no_candidate_events: 0, invalid_candidate_events: 0, unknown_library_events: 0 });
async function insert(envelope, library = original, instant = '2026-09-07T11:00:00Z', method = 'manual_classification') {
    const metadata = { classification_details: { candidate_capture: envelope, ranked_candidates: [{ library_id: destination }] } };
    return (await client.query(`INSERT INTO classification_history(title,media_type,status,method,library_id,metadata,recorded_at)
        VALUES('PRIVATE comparison','movie','pending',$1,$2,$3,$4) RETURNING id`, [method, library, JSON.stringify(metadata), instant])).rows[0].id;
}
async function read(zone = 'UTC') {
    await client.query("SELECT set_config('TimeZone',$1,true)", [zone]);
    return buildEvidenceCoverage((await client.query(EVIDENCE_COVERAGE_SQL.replaceAll('statement_timestamp()', '$2::timestamptz'),
        [200, '2026-09-07T12:00:00Z'])).rows[0]);
}
test('partitions all classifier methods independently of recorded method, lifecycle and conflicting legacy rankings', async () => {
    for (const method of CLASSIFIER_CAPTURE_METHODS) await insert(capture(method));
    await insert(capture(), destination);
    const retry = await insert(buildClassificationCandidateCapture({ method: 'queued_for_retry' }), null);
    await client.query("UPDATE classification_history SET status='reclassified' WHERE id=$1", [retry]);
    await insert(capture('policy_auto', 'invalid'), null);
    await insert(capture(), null);
    for (const method of NON_CLASSIFIER_CAPTURE_METHODS) await insert(capture(method));
    const result = await read();
    expect(result.utc_library_coverage.totals.candidate_comparison).toEqual({ same_library_events: CLASSIFIER_CAPTURE_METHODS.length,
        different_library_events: 1, no_candidate_events: 1, invalid_candidate_events: 1, unknown_library_events: 1 });
    expect(result.utc_library_coverage.totals.observation_types.classifier_workflow_events).toBe(CLASSIFIER_CAPTURE_METHODS.length + 4);
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE|original_candidate_library_id|ranked_candidates|metadata/);
    for (const zone of ['America/New_York', 'Pacific/Auckland']) expect((await read(zone)).utc_library_coverage).toEqual(result.utc_library_coverage);
});
test.each([null, true, 0, -1, 1.5, '01', '1junk', '2147483648', '999999999999999999999999999999999999999999'])('untrusted candidate ID %j never casts or compares', async id => {
    await insert({ ...capture(), library_id: id });
    const result = (await read()).utc_library_coverage.totals;
    expect(result.observation_types.unknown_origin_events).toBe(1);
    expect(result.candidate_comparison).toEqual(empty());
});
test('missing, unsupported and malformed capture cannot borrow legacy rankings or mutable classifier methods', async () => {
    await insert(undefined, original, undefined, 'policy_auto');
    await insert({ ...capture(), stage: 'post_routing' });
    await insert({ ...capture(), version: 'future' });
    await insert(buildClassificationCandidateCapture({ method: 'future_method' }));
    expect((await read()).utc_library_coverage.totals.candidate_comparison).toEqual(empty());
});
test('candidate and recorded library changes have distinct effects without requiring an active candidate catalog entry', async () => {
    const event = await insert(capture());
    expect((await read()).utc_library_coverage.totals.candidate_comparison).toEqual({ ...empty(), same_library_events: 1 });
    await client.query('UPDATE libraries SET is_active=false WHERE id=$1', [original]);
    expect((await read()).utc_library_coverage.totals.candidate_comparison.same_library_events).toBe(1);
    await client.query("UPDATE classification_history SET library_id=$1, method='manual_classification',status='corrected' WHERE id=$2", [destination, event]);
    expect((await read()).utc_library_coverage.totals.candidate_comparison).toEqual({ ...empty(), different_library_events: 1 });
    await client.query('DELETE FROM libraries WHERE id=$1', [original]);
    expect((await read()).utc_library_coverage.totals.candidate_comparison.different_library_events).toBe(1);
    expect((await client.query("SELECT metadata #>> '{classification_details,candidate_capture,library_id}' AS candidate FROM classification_history WHERE id=$1", [event])).rows[0].candidate).toBe(String(original));
    await client.query('DELETE FROM libraries WHERE id=$1', [destination]);
    expect((await read()).utc_library_coverage.totals.candidate_comparison).toEqual({ ...empty(), unknown_library_events: 1 });
});
test('UTC half-open window excludes unknown times, older events and the cutoff without moving them into missing-candidate counts', async () => {
    for (const instant of [null, '2026-08-24T23:59:59.999999Z', '2026-09-07T12:00:00Z']) await insert(capture(), original, instant);
    await insert(capture(), original, '2026-08-25T00:00:00Z');
    await insert(capture(), destination, '2026-09-07T11:59:59.999999Z');
    expect((await read()).utc_library_coverage.totals).toMatchObject({ events: 2, older_events: 1, future_events: 1, unknown_events: 1,
        candidate_comparison: { ...empty(), same_library_events: 1, different_library_events: 1 } });
});
test('201-library cap preserves nonzero omitted comparison totals and bounded payload', async () => {
    const ids = (await client.query(`INSERT INTO libraries(name,external_id,media_type)
        SELECT 'Comparison '||n,'comparison-cap-'||n,'movie' FROM generate_series(1,201) n RETURNING id`)).rows.map(row => row.id);
    for (const [index, id] of ids.entries()) await insert(capture('policy_auto', index === 200 ? original : id), id);
    const result = (await read()).utc_library_coverage;
    expect(result).toMatchObject({ group_count: 201, truncated: true, totals: { candidate_comparison: { ...empty(), same_library_events: 200, different_library_events: 1 } } });
    expect(result.groups.map(row => row.library_id)).toEqual(ids.slice(0, 200));
    expect(result.groups.every(row => row.candidate_comparison.same_library_events === 1 && row.candidate_comparison.different_library_events === 0)).toBe(true);
    expect(Buffer.byteLength(JSON.stringify([result.totals.candidate_comparison, ...result.groups.map(row => row.candidate_comparison)]))).toBeLessThan(32000);
});
