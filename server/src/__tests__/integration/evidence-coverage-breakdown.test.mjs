/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, beforeEach, afterEach, test, expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';
import { createMountedTestApp } from '../helpers/setupRouteTest.mjs';
import { buildClassificationCandidateCapture } from '../../services/classificationCandidateCapture.mjs';
import { projectPromptClassification } from '../../services/promptClassificationProjection.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());
const database = await import('../../config/database.mjs');
const { readEvidenceCoverage } = await import('../../services/evidenceCoverageService.mjs');
const { registerPolicyStatsRoutes } = await import('../../routes/statsRoutePolicies.mjs');
const router = express.Router();
registerPolicyStatsRoutes(router, { db: database });
const app = createMountedTestApp({ basePath: '/stats', router });
let db, libraryIds, original, destination, originalPolicy, destinationPolicy;

beforeEach(async () => {
    db = getPool();
    libraryIds = (await db.query(`INSERT INTO libraries(name,external_id,media_type)
        VALUES('Original','coverage-original','movie'),('Selected','coverage-selected','movie') RETURNING id`)).rows.map(row => row.id);
    [original, destination] = libraryIds;
    [originalPolicy, destinationPolicy] = (await db.query(`INSERT INTO library_policies(library_id,name)
        VALUES($1,'Original'),($2,'Selected') RETURNING id`, libraryIds)).rows.map(row => row.id);
});
afterEach(async () => {
    await db.query('DELETE FROM policy_feedback_sources');
    await db.query('DELETE FROM policy_feedback_log');
    await db.query("DELETE FROM classification_history WHERE title='PRIVATE coverage fixture'");
    await db.query('DELETE FROM library_policies WHERE library_id=ANY($1::integer[])', [libraryIds]);
    await db.query('DELETE FROM libraries WHERE id=ANY($1::integer[])', [libraryIds]);
});

async function history({ method = 'source_library', library = original, metadata = {}, status = 'completed' } = {}) {
    return (await db.query(`INSERT INTO classification_history(tmdb_id,media_type,title,metadata,method,library_id,status)
        VALUES(603,'movie','PRIVATE coverage fixture',$1,$2,$3,$4) RETURNING id`, [JSON.stringify(metadata), method, library, status])).rows[0].id;
}
async function feedback({ library = destination, policy = destinationPolicy, candidate = original, correction = true } = {}) {
    return (await db.query(`INSERT INTO policy_feedback_log(tmdb_id,title,media_type,selected_library_id,selected_policy_id,
        top_suggestion_library_id,was_correction,prompted_at,user_reason_text)
        VALUES(603,'PRIVATE feedback fixture','movie',$1,$2,$3,$4,NOW()-INTERVAL '1 day','PRIVATE reason') RETURNING id`,
    [library, policy, candidate, correction])).rows[0].id;
}
async function receipt(classificationId, feedbackId) {
    await db.query(`INSERT INTO policy_feedback_sources(classification_id,feedback_id,intake,request_fingerprint)
        VALUES($1,$2,'standalone',$3)`, [classificationId, feedbackId, 'a'.repeat(64)]);
}
async function seedPopulations() {
    await history();
    const candidateHistory = await history({ method: 'policy_auto', metadata: { classification_details: {
        ranked_candidates: [{ library_id: original, score: 70 }] } } });
    await history({ method: null, library: null, status: 'pending' });
    const importedHistory = await history();
    await receipt(candidateHistory, await feedback());
    await feedback({ library: original, policy: originalPolicy, candidate: null, correction: null });
    await receipt('9223372036854775807', await feedback({ library: original, policy: originalPolicy, correction: false }));
    const deleted = await feedback();
    await receipt(importedHistory, deleted);
    await db.query('DELETE FROM policy_feedback_log WHERE id=$1', [deleted]);
}

test('persists explicit proposal provenance without changing policy-ranked feedback eligibility', async () => {
    for (const result of [
        { method: 'policy_auto', policyResult: { ranked: [{ library_id: original }] } },
        { method: 'ai_analysis', library: { id: original } },
        { method: 'queued_for_retry', signalContext: { suggestedLibrary: { id: original } } },
        { method: 'queued_for_retry', signalContext: { ranked: [{ library_id: original }] } },
    ]) {
        const capture = buildClassificationCandidateCapture(result);
        const event = await history({ method: result.method, status: result.method === 'queued_for_retry' ? 'pending_retry' : 'completed',
            metadata: { classification_details: { candidate_capture: capture } } });
        await db.query("UPDATE classification_history SET library_id=$1,method='manual_classification',status='completed' WHERE id=$2", [destination, event]);
        const persisted = (await db.query('SELECT metadata FROM classification_history WHERE id=$1', [event])).rows[0];
        expect(persisted.metadata.classification_details.candidate_capture.library_id).toBe(original);
        expect(projectPromptClassification(persisted).evaluation.ranked).toEqual([]);
    }
    const result = await readEvidenceCoverage(database);
    expect(result.history.totals).toMatchObject({ events: 4, original_candidates: 4, candidate_no_proposal: 0,
        candidate_invalid: 0, candidate_not_applicable: 0, candidate_unrecorded: 0 });
    expect(result.history.groups.every(row => row.library_id === destination)).toBe(true);
    expect(result.history_attribution.totals).toEqual({ events: 4, captured_events: 4, unrecorded_events: 0, invalid_events: 0, unsupported_events: 0 });
    expect(result.history_attribution.groups).toHaveLength(4);
    expect(result.history_attribution.groups.map(row => [row.original_method, row.candidate_source])).toEqual([
        ['ai_analysis', 'decision_proposal'], ['policy_auto', 'policy_ranked'],
        ['queued_for_retry', 'signal_proposal'], ['queued_for_retry', 'signal_ranked'],
    ]);
    expect(result.history_attribution.groups.every(row => row.library_id === destination
        && row.recorded_method === 'manual_classification' && row.provenance_status === 'captured' && row.events === 1)).toBe(true);
    expect(result.feedback.totals.evaluated).toBe(0);
});

test('candidate reasons partition legacy, absent, invalid, non-classifier and supported proposals', async () => {
    const candidates = [
        { method: 'ai_analysis', library: { id: original } },
        { method: 'ai_analysis' },
        { method: 'policy_auto', policyResult: { ranked: [null, { library_id: original }] } },
        { method: 'manual_classification', library: { id: original } },
        { method: 'source_library', library: { id: original } },
    ];
    for (const value of candidates) await history({ method: value.method,
        metadata: { classification_details: { candidate_capture: buildClassificationCandidateCapture(value) } } });
    await history({ method: 'ai_analysis' });
    await history({ method: 'policy_auto', metadata: { classification_details: { ranked_candidates: [{ library_id: original }] } } });
    const result = await readEvidenceCoverage(database);
    expect(result.history.totals).toMatchObject({ events: 7, original_candidates: 2, candidate_no_proposal: 1,
        candidate_invalid: 1, candidate_not_applicable: 2, candidate_unrecorded: 1 });
    expect(result.history_attribution.totals).toEqual({ events: 7, captured_events: 5, unrecorded_events: 2, invalid_events: 0, unsupported_events: 0 });
    expect(result.history_attribution.groups).toEqual(expect.arrayContaining([
        expect.objectContaining({ original_method: 'policy_auto', provenance_status: 'captured', candidate_source: 'policy_ranked', events: 1 }),
        expect.objectContaining({ original_method: 'ai_analysis', provenance_status: 'captured', candidate_source: null, events: 1 }),
        expect.objectContaining({ original_method: 'manual_classification', provenance_status: 'captured', candidate_source: null, events: 1 }),
    ]));
});

test.each([null, true, [], {}, { version: 'future' },
    ...[true, -1, 1.5, '2147483648', '1junk'].map(library_id => ({
        version: 'classification.candidate_capture.v1', stage: 'pre_routing', method: 'policy_auto', status: 'recorded', source: 'policy_ranked', library_id })),
    { version: 'classification.candidate_capture.v1', stage: 'post_selection', method: 'policy_auto', status: 'recorded', source: 'policy_ranked', library_id: 1 },
    { version: 'classification.candidate_capture.v1', stage: 'pre_routing', method: 'policy_auto', status: 'recorded', source: 'selected_destination', library_id: 1 },
    { version: 'classification.candidate_capture.v1', stage: 'pre_routing', method: 'policy_auto', status: 'no_candidate', source: null, library_id: 1 },
])('invalid explicit capture %j cannot fall back to legacy rankings', async candidate_capture => {
    await history({ method: 'ai_analysis', metadata: { classification_details: {
        candidate_capture, ranked_candidates: [{ library_id: original }],
    } } });
    const result = await readEvidenceCoverage(database);
    expect(result.history.totals).toMatchObject({ original_candidates: 0, candidate_invalid: 1 });
    expect(result.history_attribution.totals).toMatchObject({ captured_events: 0, invalid_events: 1 });
    expect(result.history_attribution.groups[0]).toMatchObject({ original_method: null, candidate_source: null, provenance_status: 'invalid' });
});

test('legacy membership stays excluded while a policy ranking survives later manual selection', async () => {
    for (const method of ['source_library', 'manual_classification']) {
        await history({ method, metadata: { classification_details: { ranked_candidates: [{ library_id: original }] } } });
    }
    const result = await readEvidenceCoverage(database);
    expect(result.history.totals).toMatchObject({ original_candidates: 1, candidate_not_applicable: 1 });
    expect(result.history_attribution.totals).toMatchObject({ events: 2, captured_events: 0, unrecorded_events: 2 });
    expect(result.history_attribution.groups.every(row => row.original_method === null && row.candidate_source === null)).toBe(true);
});

test('unsupported capture remains unrecorded rather than counting a supplied destination', async () => {
    await history({ method: null, metadata: { classification_details: {
        candidate_capture: buildClassificationCandidateCapture({ method: 'future_method', library: { id: original } }),
    } } });
    const result = await readEvidenceCoverage(database);
    expect(result.history.totals).toMatchObject({ original_candidates: 0, candidate_unrecorded: 1 });
    expect(result.history_attribution.totals).toMatchObject({ unsupported_events: 1 });
    expect(result.history_attribution.groups[0]).toMatchObject({ recorded_method: 'unknown_method', original_method: null, candidate_source: null, provenance_status: 'unsupported' });
});

test('reconciles separate populations without moving feedback into its original history library', async () => {
    await seedPopulations();
    const before = (await db.query('SELECT * FROM policy_feedback_log ORDER BY id')).rows;
    const response = await request(app).get('/stats/overview');
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    const result = response.body.evidence_coverage;
    expect(result.status).toBe('available');
    expect(result.history.totals).toEqual({ events: 4, completed_events: 3, pending_events: 1, retry_events: 0, other_events: 0,
        imported_observations: 2, original_candidates: 1, linked_feedback: 1,
        candidate_no_proposal: 0, candidate_invalid: 0, candidate_not_applicable: 2, candidate_unrecorded: 1 });
    expect(result.feedback.totals).toEqual({ observations: 3, source_bound: 2, evaluated: 2, unevaluated: 1, evaluation_coverage: 2 / 3 });
    expect(result.history.groups.find(row => row.method === 'policy_auto')).toMatchObject({ library_id: original, events: 1, linked_feedback: 1 });
    expect(result.feedback.groups.find(row => row.method === 'policy_auto')).toMatchObject({ library_id: destination, observations: 1 });
    expect(result.feedback.groups.find(row => row.method === 'unlinked_feedback')).toMatchObject({ evaluated: 0, source_bound: 0 });
    expect(result.feedback.groups.find(row => row.method === 'source_history_removed')).toMatchObject({ evaluated: 1, source_bound: 1 });
    expect(result.history.groups.find(row => row.method === 'unknown_method').library_id).toBeNull();
    expect(result.deleted_feedback_receipts).toBe(1);
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE|tmdb_id|classification_id|request_fingerprint|original_scores/);
    expect((await db.query('SELECT * FROM policy_feedback_log ORDER BY id')).rows).toEqual(before);
});

test('inactive libraries stay visible while canonical evaluation becomes unavailable', async () => {
    await seedPopulations();
    await db.query('UPDATE libraries SET is_active=FALSE WHERE id=$1', [original]);
    const result = await readEvidenceCoverage(database);
    expect(result.history.totals.original_candidates).toBe(1);
    expect(result.history.groups.find(row => row.library_id === original).library_active).toBe(false);
    expect(result.feedback.totals).toMatchObject({ observations: 3, evaluated: 0, unevaluated: 3, evaluation_coverage: 0 });
});

test('empty history and feedback remain known zero with null coverage', async () => {
    const result = await readEvidenceCoverage(database);
    expect(result.history.totals.events).toBe(0);
    expect(result.history.totals).toMatchObject({ completed_events: 0, pending_events: 0, retry_events: 0, other_events: 0 });
    expect(result.history.groups).toEqual([]);
    expect(result.feedback.groups).toEqual([]);
    expect(result.feedback.totals.evaluation_coverage).toBeNull();
});

test('partitions every retained state within each library/method without assuming completion or accuracy', async () => {
    const buckets = {
        completed_events: ['completed', 'corrected', 'verified', 'routed'],
        pending_events: ['pending', 'awaiting_decision'],
        retry_events: ['pending_retry'],
        other_events: [null, 'failed', 'reclassified'],
    };
    const methods = { completed_events: 'source_library', pending_events: 'policy_auto',
        retry_events: 'queued_for_retry', other_events: null };
    for (const [field, statuses] of Object.entries(buckets)) {
        for (const status of statuses) {
            await history({ method: methods[field], status, library: field === 'pending_events' ? null : original });
        }
    }
    const before = (await db.query('SELECT id,status FROM classification_history ORDER BY id')).rows;
    const result = await readEvidenceCoverage(database);
    expect(result.status).toBe('available');
    expect(result.history.totals).toMatchObject({ events: 10, completed_events: 4, pending_events: 2, retry_events: 1, other_events: 3 });
    for (const [field, statuses] of Object.entries(buckets)) {
        const row = result.history.groups.find(group => group.method === (methods[field] ?? 'unknown_method'));
        expect(row.events).toBe(statuses.length);
        for (const bucket of Object.keys(buckets)) expect(row[bucket]).toBe(bucket === field ? statuses.length : 0);
    }
    expect(result.feedback.totals).toMatchObject({ observations: 0, evaluated: 0 });
    expect((await db.query('SELECT id,status FROM classification_history ORDER BY id')).rows).toEqual(before);
});

test('an expanded status vocabulary cannot silently inflate completion', async () => {
    // Simulate a future schema in this disposable suite database only.
    const definition = (await db.query(`SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
        WHERE conrelid='classification_history'::regclass AND conname='classification_history_status_check'`)).rows[0].definition;
    await db.query('ALTER TABLE classification_history DROP CONSTRAINT classification_history_status_check');
    try {
        for (const status of ['', 'resolved', 'future_state', 'COMPLETED']) await history({ status });
        const result = await readEvidenceCoverage(database);
        expect(result.history.totals).toMatchObject({ events: 4, completed_events: 0, pending_events: 0, retry_events: 0, other_events: 4 });
        expect(result.history.groups[0]).toMatchObject({ events: 4, other_events: 4 });
    } finally {
        await db.query("DELETE FROM classification_history WHERE title='PRIVATE coverage fixture'");
        await db.query(`ALTER TABLE classification_history ADD CONSTRAINT classification_history_status_check ${definition}`);
    }
});

test('a superseded retry row and its completed replacement remain separate observations', async () => {
    const superseded = await history({ method: 'queued_for_retry', status: 'pending_retry' });
    await db.query("UPDATE classification_history SET status='reclassified' WHERE id=$1", [superseded]);
    await history({ method: 'policy_auto', status: 'completed' });
    expect((await readEvidenceCoverage(database)).history.totals).toMatchObject({
        events: 2, completed_events: 1, pending_events: 0, retry_events: 0, other_events: 1,
    });
});

test.each([null, {}, [], [null], [true], [{ library_id: true }], [{ library_id: 0 }], [{ library_id: -1 }],
    [{ library_id: '2147483648' }], [{ library_id: '99999999999999999999' }], [{ library_id: '1.5' }],
    [{ library_id: '1junk' }], [{}, { library_id: 1 }], { 0: { library_id: 1 } },
])('malformed original candidates %j do not become available evidence', async candidates => {
    await history({ method: 'policy_auto', metadata: { classification_details: { ranked_candidates: candidates } } });
    expect((await readEvidenceCoverage(database)).history.totals).toMatchObject({ events: 1, original_candidates: 0 });
});

test.each([1, '2147483647'])('valid original ID %s denotes availability even without a current library', async candidate => {
    await history({ method: 'policy_auto', metadata: { classification_details: { ranked_candidates: [{ library_id: candidate }] } } });
    expect((await readEvidenceCoverage(database)).history.totals.original_candidates).toBe(1);
});

test('history retention changes attribution without losing retained feedback counts', async () => {
    const event = await history();
    await receipt(event, await feedback());
    await db.query('DELETE FROM classification_history WHERE id=$1', [event]);
    const result = await readEvidenceCoverage(database);
    expect(result.history.totals.events).toBe(0);
    expect(result.feedback.groups[0]).toMatchObject({ method: 'source_history_removed', observations: 1, source_bound: 1 });
});

test('fixed group caps disclose omissions while preserving global totals', async () => {
    const ids = (await db.query(`INSERT INTO libraries(name,external_id,media_type)
        SELECT 'Coverage '||n,'coverage-cap-'||n,'movie' FROM generate_series(1,201) n RETURNING id`)).rows.map(row => row.id);
    libraryIds.push(...ids);
    await db.query(`INSERT INTO library_policies(library_id,name) SELECT id,name FROM libraries WHERE id=ANY($1::integer[])`, [ids]);
    await db.query(`INSERT INTO classification_history(tmdb_id,media_type,title,method,library_id,status)
        SELECT 603,'movie','PRIVATE coverage fixture','source_library',id,
        CASE WHEN id=$2 THEN 'pending_retry' ELSE 'completed' END FROM libraries WHERE id=ANY($1::integer[])`, [ids, ids[200]]);
    await db.query(`INSERT INTO policy_feedback_log(tmdb_id,selected_library_id,selected_policy_id)
        SELECT 603,library_id,id FROM library_policies WHERE library_id=ANY($1::integer[])`, [ids]);
    const result = await readEvidenceCoverage(database);
    expect(result.history).toMatchObject({ group_count: 201, truncated: true, totals: { events: 201 } });
    expect(result.feedback).toMatchObject({ group_count: 201, truncated: true, totals: { observations: 201 } });
    expect(result.history.groups).toHaveLength(200);
    expect(result.history_attribution).toMatchObject({ group_count: 201, truncated: true, totals: { events: 201, unrecorded_events: 201 } });
    expect(result.history_attribution.groups.map(row => row.library_id)).toEqual(ids.slice(0, 200));
    expect(result.feedback.groups).toHaveLength(200);
    expect(result.history.groups.map(row => row.library_id)).toEqual(ids.slice(0, 200));
    expect(result.history.totals).toMatchObject({ completed_events: 200, pending_events: 0, retry_events: 1, other_events: 0 });
    expect(result.history.groups.every(row => row.completed_events === 1 && row.retry_events === 0)).toBe(true);
    const { provenance_trend, utc_provenance_trend, utc_library_coverage, ...existingCoverage } = result;
    expect(Buffer.byteLength(JSON.stringify(existingCoverage))).toBeLessThan(150000);
    expect(provenance_trend.days).toHaveLength(14);
    expect(Buffer.byteLength(JSON.stringify(provenance_trend))).toBeLessThan(6000);
    expect(utc_provenance_trend.days).toHaveLength(14);
    expect(Buffer.byteLength(JSON.stringify(utc_provenance_trend))).toBeLessThan(6000);
    expect(utc_library_coverage).toMatchObject({ group_count: 201, group_limit: 200, truncated: true,
        totals: { retained_events: 201, events: 201, unrecorded_events: 201 } });
    expect(utc_library_coverage.groups.map(row => row.library_id)).toEqual(ids.slice(0, 200));
    expect(Buffer.byteLength(JSON.stringify(utc_library_coverage))).toBeLessThan(85000);
});

test('missing coverage schema does not suppress existing overview metrics or invent zero', async () => {
    await db.query('ALTER TABLE policy_feedback_sources RENAME TO coverage_receipts_unavailable');
    try {
        const response = await request(app).get('/stats/overview');
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('total_decisions');
        expect(response.body.evidence_coverage).toMatchObject({ status: 'unavailable', history: null, feedback: null });
    } finally { await db.query('ALTER TABLE coverage_receipts_unavailable RENAME TO policy_feedback_sources'); }
});

test('attribution is capped independently when original methods and sources expand a recorded group', async () => {
    await db.query(`INSERT INTO classification_history(tmdb_id,media_type,title,method,library_id,status,metadata)
        SELECT 603,'movie','PRIVATE coverage fixture',recorded_method,$1,'pending',
            jsonb_build_object('classification_details',jsonb_build_object('candidate_capture',jsonb_build_object(
                'version','classification.candidate_capture.v1','stage','pre_routing','status','recorded',
                'method',original_method,'source',candidate_source,'library_id',$1::integer)))
        FROM unnest(ARRAY['existing_media','manual_correction','manual_classification','exact_match',
            'learned_pattern','source_library','policy_auto','policy_prompt','policy_recheck','ai_verified',
            'ai_analysis','ai_rerun','signal_calculation','fallback','queued_for_retry','custom_rule','rule_match']) recorded_method
        CROSS JOIN unnest(ARRAY['policy_auto','ai_analysis','queued_for_retry']) original_method
        CROSS JOIN unnest(ARRAY['policy_ranked','signal_ranked','decision_proposal','signal_proposal']) candidate_source`, [original]);
    const result = await readEvidenceCoverage(database);
    expect(result.history).toMatchObject({ group_count: 17, truncated: false, totals: { events: 204, pending_events: 204 } });
    expect(result.history_attribution).toMatchObject({ group_count: 204, truncated: true, totals: { events: 204, captured_events: 204 } });
    expect(result.history_attribution.groups).toHaveLength(200);
    expect(result.history_attribution.groups.reduce((sum, row) => sum + row.events, 0)).toBe(200);
    expect((await readEvidenceCoverage(database)).history_attribution.groups).toEqual(result.history_attribution.groups);
});

test('normalizes an unknown current method without inventing an original method or duplicate attribution', async () => {
    // The current schema excludes this explicit method; simulate a future vocabulary only in the disposable database.
    const definition = (await db.query(`SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
        WHERE conrelid='classification_history'::regclass AND conname='classification_history_method_check'`)).rows[0].definition;
    await db.query('ALTER TABLE classification_history DROP CONSTRAINT classification_history_method_check');
    try {
        await history({ method: null });
        await history({ method: 'unknown_method' });
        const result = await readEvidenceCoverage(database);
        expect(result.history_attribution).toMatchObject({ group_count: 1, totals: { events: 2, unrecorded_events: 2 } });
        expect(result.history_attribution.groups[0]).toMatchObject({ recorded_method: 'unknown_method', original_method: null, candidate_source: null, events: 2 });
    } finally {
        await db.query("DELETE FROM classification_history WHERE title='PRIVATE coverage fixture'");
        await db.query(`ALTER TABLE classification_history ADD CONSTRAINT classification_history_method_check ${definition}`);
    }
});

test('records local aggregate cost over 5000 retained import events', async () => {
    await db.query(`INSERT INTO classification_history(tmdb_id,media_type,title,method,library_id)
        SELECT 603,'movie','PRIVATE coverage fixture','source_library',$1 FROM generate_series(1,5000)`, [original]);
    const started = performance.now();
    const result = await readEvidenceCoverage(database);
    expect(result.history.totals).toMatchObject({ events: 5000, imported_observations: 5000, original_candidates: 0 });
    process.stdout.write(`Evidence coverage fixture: ${JSON.stringify({ events: 5000, elapsedMs: Number((performance.now() - started).toFixed(3)) })}\n`);
});
