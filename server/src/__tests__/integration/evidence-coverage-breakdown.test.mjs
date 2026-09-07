/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, beforeEach, afterEach, test, expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';
import { createMountedTestApp } from '../helpers/setupRouteTest.mjs';

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

test('reconciles separate populations without moving feedback into its original history library', async () => {
    await seedPopulations();
    const before = (await db.query('SELECT * FROM policy_feedback_log ORDER BY id')).rows;
    const response = await request(app).get('/stats/overview');
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    const result = response.body.evidence_coverage;
    expect(result.status).toBe('available');
    expect(result.history.totals).toEqual({ events: 4, imported_observations: 2, original_candidates: 1, linked_feedback: 1 });
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
    expect(result.history.groups).toEqual([]);
    expect(result.feedback.groups).toEqual([]);
    expect(result.feedback.totals.evaluation_coverage).toBeNull();
});

test.each([null, {}, [], [null], [true], [{ library_id: true }], [{ library_id: 0 }], [{ library_id: -1 }],
    [{ library_id: '2147483648' }], [{ library_id: '99999999999999999999' }], [{ library_id: '1.5' }],
    [{ library_id: '1junk' }], [{}, { library_id: 1 }], { 0: { library_id: 1 } },
])('malformed original candidates %j do not become available evidence', async candidates => {
    await history({ metadata: { classification_details: { ranked_candidates: candidates } } });
    expect((await readEvidenceCoverage(database)).history.totals).toMatchObject({ events: 1, original_candidates: 0 });
});

test.each([1, '2147483647'])('valid original ID %s denotes availability even without a current library', async candidate => {
    await history({ metadata: { classification_details: { ranked_candidates: [{ library_id: candidate }] } } });
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
    await db.query(`INSERT INTO classification_history(tmdb_id,media_type,title,method,library_id)
        SELECT 603,'movie','PRIVATE coverage fixture','source_library',id FROM libraries WHERE id=ANY($1::integer[])`, [ids]);
    await db.query(`INSERT INTO policy_feedback_log(tmdb_id,selected_library_id,selected_policy_id)
        SELECT 603,library_id,id FROM library_policies WHERE library_id=ANY($1::integer[])`, [ids]);
    const result = await readEvidenceCoverage(database);
    expect(result.history).toMatchObject({ group_count: 201, truncated: true, totals: { events: 201 } });
    expect(result.feedback).toMatchObject({ group_count: 201, truncated: true, totals: { observations: 201 } });
    expect(result.history.groups).toHaveLength(200);
    expect(result.feedback.groups).toHaveLength(200);
    expect(result.history.groups.map(row => row.library_id)).toEqual(ids.slice(0, 200));
    expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThan(150000);
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

test('records local aggregate cost over 5000 retained import events', async () => {
    await db.query(`INSERT INTO classification_history(tmdb_id,media_type,title,method,library_id)
        SELECT 603,'movie','PRIVATE coverage fixture','source_library',$1 FROM generate_series(1,5000)`, [original]);
    const started = performance.now();
    const result = await readEvidenceCoverage(database);
    expect(result.history.totals).toMatchObject({ events: 5000, imported_observations: 5000, original_candidates: 0 });
    process.stdout.write(`Evidence coverage fixture: ${JSON.stringify({ events: 5000, elapsedMs: Number((performance.now() - started).toFixed(3)) })}\n`);
});
