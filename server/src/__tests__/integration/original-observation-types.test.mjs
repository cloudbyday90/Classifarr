/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect, beforeEach, afterEach } from '@jest/globals';
import { getPool } from './setup.mjs';
import { EVIDENCE_COVERAGE_SQL } from '../../services/evidenceCoverageQuery.mjs';
import { buildEvidenceCoverage } from '../../services/evidenceCoverageService.mjs';
import { buildClassificationCandidateCapture, CLASSIFIER_CAPTURE_METHODS, NON_CLASSIFIER_CAPTURE_METHODS } from '../../services/classificationCandidateCapture.mjs';

let client, library;
beforeEach(async () => {
    client = await getPool().connect();
    await client.query('BEGIN');
    library = (await client.query("INSERT INTO libraries(name,external_id,media_type) VALUES('Observation types','original-types','movie') RETURNING id")).rows[0].id;
});
afterEach(async () => { await client.query('ROLLBACK'); client.release(); });
const capture = method => buildClassificationCandidateCapture({ method, library: { id: library } });
async function insert(envelope, instant = '2026-09-07T11:00:00Z', recordedMethod = 'policy_auto') {
    const metadata = envelope === undefined ? {} : { classification_details: { candidate_capture: envelope } };
    return (await client.query(`INSERT INTO classification_history(title,media_type,status,method,library_id,metadata,recorded_at)
        VALUES('PRIVATE original types','movie','pending',$1,$2,$3,$4) RETURNING id`,
    [recordedMethod, library, JSON.stringify(metadata), instant])).rows[0].id;
}
async function read(zone = 'UTC') {
    await client.query("SELECT set_config('TimeZone',$1,true)", [zone]);
    return buildEvidenceCoverage((await client.query(EVIDENCE_COVERAGE_SQL.replaceAll('statement_timestamp()', '$2::timestamptz'),
        [200, '2026-09-07T12:00:00Z'])).rows[0]);
}
test('all supported original methods map once to explicit observation types despite a different recorded method', async () => {
    const imported = ['source_library', 'authoritative_source_library', 'existing_media'];
    const manual = ['manual_classification', 'manual_correction'];
    expect([...NON_CLASSIFIER_CAPTURE_METHODS].sort()).toEqual([...imported, ...manual].sort());
    for (const method of [...NON_CLASSIFIER_CAPTURE_METHODS, ...CLASSIFIER_CAPTURE_METHODS]) await insert(capture(method));
    const baseline = await read();
    expect(baseline.utc_library_coverage.totals.observation_types).toEqual({ imported_membership_events: 3,
        manual_action_events: 2, classifier_workflow_events: CLASSIFIER_CAPTURE_METHODS.length, unknown_origin_events: 0 });
    expect(baseline.utc_library_coverage.groups[0].observation_types).toEqual(baseline.utc_library_coverage.totals.observation_types);
    for (const zone of ['America/New_York', 'Pacific/Auckland']) expect((await read(zone)).utc_library_coverage).toEqual(baseline.utc_library_coverage);
    expect(JSON.stringify(baseline.utc_library_coverage)).not.toMatch(/PRIVATE|metadata/);
});
test('missing, invalid and unsupported provenance stay unknown while valid candidate failures identify the workflow', async () => {
    await insert(undefined, undefined, 'source_library');
    await insert({ ...capture('manual_classification'), stage: 'forged' });
    await insert(capture('future_method'));
    await insert(buildClassificationCandidateCapture({ method: 'policy_auto', library: { id: 'invalid' } }));
    await insert(buildClassificationCandidateCapture({ method: 'policy_auto' }));
    const result = (await read()).utc_library_coverage;
    expect(result.totals).toMatchObject({ events: 5, captured_events: 2, unrecorded_events: 1, invalid_events: 1, unsupported_events: 1,
        observation_types: { imported_membership_events: 0, manual_action_events: 0, classifier_workflow_events: 2, unknown_origin_events: 3 } });
});
test('window boundaries exclude older, at-cutoff and unknown times without guessing origin dates', async () => {
    await insert(capture('source_library'), '2026-08-24T23:59:59.999999Z');
    await insert(capture('source_library'), '2026-08-25T00:00:00Z');
    await insert(capture('manual_correction'), '2026-09-07T11:59:59.999999Z');
    await insert(capture('manual_correction'), '2026-09-07T12:00:00Z');
    await insert(capture('policy_auto'), null);
    expect((await read()).utc_library_coverage.totals).toMatchObject({ retained_events: 5, events: 2, older_events: 1, future_events: 1, unknown_events: 1,
        observation_types: { imported_membership_events: 1, manual_action_events: 1, classifier_workflow_events: 0, unknown_origin_events: 0 } });
});
test('resolution and library removal preserve global origin composition', async () => {
    const id = await insert(capture('policy_auto'));
    await insert(undefined);
    const before = (await read()).utc_library_coverage.totals;
    await client.query("UPDATE classification_history SET method='manual_classification' WHERE id=$1", [id]);
    expect((await read()).utc_library_coverage.totals).toEqual(before);
    await client.query('DELETE FROM libraries WHERE id=$1', [library]);
    const after = (await read()).utc_library_coverage;
    expect(after.totals).toEqual(before);
    expect(after.groups[0]).toMatchObject({ library_id: null, observation_types: { classifier_workflow_events: 1, unknown_origin_events: 1 } });
});
