/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, beforeEach, afterEach, test, expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { readFileSync } from 'node:fs';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';
import { createMountedTestApp } from '../helpers/setupRouteTest.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());
const { feedbackAnalysis } = await import('../../services/feedbackAnalysis.mjs');
const { registerPolicyStatsRoutes } = await import('../../routes/statsRoutePolicies.mjs');
const { captureSuggestionCohort } = await import('../../services/feedbackAnalysisCohort.mjs');
const { default: database } = await import('../../config/database.mjs');
const router = express.Router();
registerPolicyStatsRoutes(router, { db: database });
const app = createMountedTestApp({ basePath: '/stats', router });
let db, libraryId, candidateId, policyId;

beforeEach(async () => {
    db = getPool();
    [libraryId, candidateId] = (await db.query(`INSERT INTO libraries(name,external_id,media_type)
        VALUES('Selected','evaluation-selected','movie'),('Original','evaluation-original','movie') RETURNING id`)).rows.map(row => row.id);
    policyId = (await db.query("INSERT INTO library_policies(library_id,name) VALUES($1,'Evaluation') RETURNING id", [libraryId])).rows[0].id;
});
afterEach(async () => {
    await db.query('DELETE FROM policy_feedback_log WHERE selected_policy_id=$1', [policyId]);
    await db.query('DELETE FROM library_policies WHERE id=$1', [policyId]);
    await db.query('DELETE FROM libraries WHERE id=ANY($1::integer[])', [[libraryId, candidateId]]);
});

async function addFeedback({ original = libraryId, selected = libraryId, correction = false, days = 1, mediaType = 'movie' } = {}) {
    return (await db.query(`INSERT INTO policy_feedback_log(tmdb_id, selected_policy_id, selected_library_id,
        top_suggestion_library_id, was_correction, prompt_type, prompted_at, media_type, item_metadata)
        VALUES(603,$1,$2,$3,$4,'auto_classify',NOW()-$5::integer*INTERVAL '1 day',$6,'{"genres":["Action"]}') RETURNING id`,
    [policyId, selected, original, correction, days, mediaType])).rows[0].id;
}
const summary = async () => (await db.query('SELECT * FROM policy_feedback_learning_stats WHERE policy_id=$1', [policyId])).rows[0];
const rawFeedback = async () => (await db.query('SELECT * FROM policy_feedback_log WHERE selected_policy_id=$1 ORDER BY id', [policyId])).rows;

test('migration repairs a legacy success cache without rewriting observations', async () => {
    await addFeedback({ original: null });
    await db.query('INSERT INTO policy_learning_stats(policy_id,total_decisions,accuracy_rate) VALUES($1,1,1)', [policyId]);
    const before = await rawFeedback();
    const migration = readFileSync(new URL('../../../../database/migrations/20260907_010000_add_feedback_evaluation_views.sql', import.meta.url), 'utf8');
    await db.query(migration);
    expect((await db.query('SELECT accuracy_rate FROM policy_learning_stats WHERE policy_id=$1', [policyId])).rows[0].accuracy_rate).toBeNull();
    expect(await rawFeedback()).toEqual(before);
});

test('accuracy and every dashboard slice exclude unknown evidence while reporting coverage', async () => {
    await addFeedback();
    await addFeedback({ original: candidateId, correction: true });
    await addFeedback({ original: null });
    await addFeedback({ correction: null });
    const before = await rawFeedback();
    expect(await summary()).toMatchObject({ total_decisions: 4, evaluated_decisions: 2, unevaluated_decisions: 2,
        evaluated_auto_classified: 2, evaluation_coverage: 0.5, accuracy_rate: 0.5, auto_accuracy_rate: 0.5,
        user_corrections: 1, last_7_days_accuracy: 0.5, last_30_days_accuracy: 0.5 });
    const overview = await request(app).get('/stats/overview');
    expect(overview.status).toBe(200);
    expect(overview.body).toMatchObject({ total_decisions: 4, evaluated_decisions: 2, evaluation_coverage: 0.5 });
    const detail = await request(app).get(`/stats/policies/${policyId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.time_series[0]).toMatchObject({ decisions: 4, evaluated_decisions: 2, correct: 1, corrections: 1 });
    expect(Number(detail.body.prompt_breakdown[0].accuracy)).toBe(0.5);
    const comparison = await request(app).get(`/stats/policies/${policyId}/compare`);
    expect(comparison.status).toBe(200);
    expect(comparison.body[0]).toMatchObject({ decisions: 4, evaluated_decisions: 2, evaluation_coverage: 0.5 });
    expect(Number(comparison.body[0].accuracy)).toBe(0.5);
    expect((await captureSuggestionCohort(policyId)).feedback).toHaveLength(2);
    expect(await rawFeedback()).toEqual(before);
});

test.each([
    ['missing original', { original: null }], ['missing selected', { selected: null }],
    ['unknown correction', { correction: null }], ['contradictory correction', { correction: true }],
    ['future timestamp', { days: -1 }], ['incompatible media', { mediaType: 'tv' }],
])('%s remains an observation with unavailable accuracy', async (_label, data) => {
    await addFeedback(data);
    const before = await rawFeedback();
    const stats = await feedbackAnalysis.updateLearningStats(policyId);
    expect(stats).toMatchObject({ total_decisions: 1, evaluated_decisions: 0, unevaluated_decisions: 1,
        evaluation_coverage: 0, accuracy_rate: null, auto_accuracy_rate: null, user_corrections: 0, trend: 'unknown' });
    expect((await captureSuggestionCohort(policyId)).feedback).toEqual([]);
    expect(await rawFeedback()).toEqual(before);
});

test('empty policy has null accuracy and null coverage, clearing stale cached success', async () => {
    await db.query('INSERT INTO policy_learning_stats(policy_id,total_decisions,accuracy_rate) VALUES($1,99,1)', [policyId]);
    expect(await summary()).toMatchObject({ total_decisions: 0, evaluated_decisions: 0, evaluation_coverage: null, accuracy_rate: null });
    await feedbackAnalysis.updateLearningStats(policyId);
    expect((await db.query('SELECT total_decisions,accuracy_rate FROM policy_learning_stats WHERE policy_id=$1', [policyId])).rows[0])
        .toEqual({ total_decisions: 0, accuracy_rate: null });
});

test.each([null, '-infinity', 'infinity'])('missing or nonfinite time %s is not evaluated', async timestamp => {
    const id = await addFeedback();
    await db.query('UPDATE policy_feedback_log SET prompted_at=$1 WHERE id=$2', [timestamp, id]);
    expect(await summary()).toMatchObject({ total_decisions: 1, evaluated_decisions: 0, accuracy_rate: null, last_decision_at: null });
});

test.each(['inactive original', 'inactive selected', 'policy reassignment', 'original media change', 'detached original'])(
    '%s immediately invalidates live metrics without an operator refresh', async change => {
        const id = await addFeedback({ original: candidateId, correction: true });
        await feedbackAnalysis.updateLearningStats(policyId);
        const before = await rawFeedback();
        if (change === 'inactive original') await db.query('UPDATE libraries SET is_active=FALSE WHERE id=$1', [candidateId]);
        if (change === 'inactive selected') await db.query('UPDATE libraries SET is_active=FALSE WHERE id=$1', [libraryId]);
        if (change === 'policy reassignment') await db.query('UPDATE library_policies SET library_id=$1 WHERE id=$2', [candidateId, policyId]);
        if (change === 'original media change') await db.query("UPDATE libraries SET media_type='tv' WHERE id=$1", [candidateId]);
        if (change === 'detached original') await db.query('UPDATE policy_feedback_log SET top_suggestion_library_id=NULL WHERE id=$1', [id]);
        expect(await summary()).toMatchObject({ total_decisions: 1, evaluated_decisions: 0, accuracy_rate: null });
        const detail = await request(app).get(`/stats/policies/${policyId}`);
        expect(detail.body.accuracy_rate).toBeNull();
        if (change !== 'detached original') expect(await rawFeedback()).toEqual(before);
    });

test.each([undefined, null, 'false', 0, true, false])('writer preserves explicit boolean evidence only: %s', async flag => {
    const id = await feedbackAnalysis.recordFeedback({ tmdb_id: 603, media_type: 'movie', selected_library_id: libraryId,
        selected_policy_id: policyId, top_suggestion_library_id: libraryId, was_correction: flag });
    const row = (await db.query('SELECT was_correction FROM policy_feedback_log WHERE id=$1', [id])).rows[0];
    expect(row.was_correction).toBe(typeof flag === 'boolean' ? flag : null);
});

test('period accuracy and trend ignore unevaluated observations', async () => {
    await addFeedback();
    await addFeedback({ original: candidateId, correction: true, days: 10 });
    await addFeedback({ original: null });
    expect(await summary()).toMatchObject({ last_7_days_accuracy: 1, last_30_days_accuracy: 0.5, trend: 'improving' });
    const response = await request(app).get(`/stats/policies/${policyId}/compare`);
    expect(Number(response.body[0].accuracy)).toBe(1);
    expect(Number(response.body[1].accuracy)).toBe(0);
});

test('live views retain invoker permissions instead of granting access to base data', async () => {
    const role = `evaluation_reader_${process.pid}`;
    const client = await db.connect();
    await client.query(`CREATE ROLE ${role}`);
    try {
        await client.query(`GRANT SELECT ON policy_feedback_evaluation TO ${role}`);
        await client.query(`SET ROLE ${role}`);
        await expect(client.query('SELECT id FROM policy_feedback_evaluation')).rejects.toMatchObject({ code: '42501' });
    } finally {
        await client.query('RESET ROLE');
        await client.query(`REVOKE SELECT ON policy_feedback_evaluation FROM ${role}`);
        await client.query(`DROP ROLE ${role}`);
        client.release();
    }
});


test('the database default also preserves a missing correction label as unknown', async () => {
    await db.query(`INSERT INTO policy_feedback_log(tmdb_id,selected_policy_id,selected_library_id,top_suggestion_library_id)
        VALUES(603,$1,$2,$2)`, [policyId, libraryId]);
    expect((await rawFeedback())[0].was_correction).toBeNull();
    expect(await summary()).toMatchObject({ total_decisions: 1, evaluated_decisions: 0, accuracy_rate: null });
});

test('aggregates a bounded 5000-observation fixture and records the query plan timing', async () => {
    await db.query(`INSERT INTO policy_feedback_log(tmdb_id,selected_policy_id,selected_library_id,
        top_suggestion_library_id,was_correction,prompt_type,prompted_at)
        SELECT n,$1,$2,CASE WHEN n % 4 = 0 THEN $2::integer ELSE $3::integer END,
            CASE WHEN n % 2 = 0 THEN n % 4 <> 0 ELSE NULL END,'auto_classify',NOW()-INTERVAL '1 day'
        FROM generate_series(1,5000) n`, [policyId, libraryId, candidateId]);
    expect(await summary()).toMatchObject({ total_decisions: 5000, evaluated_decisions: 2500,
        unevaluated_decisions: 2500, evaluation_coverage: 0.5, accuracy_rate: 0.5 });
    const result = await db.query('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT * FROM policy_feedback_learning_stats WHERE policy_id=$1', [policyId]);
    const plan = result.rows[0]['QUERY PLAN'][0];
    process.stdout.write(`Evaluation aggregate fixture: ${JSON.stringify({ observations: 5000,
        executionMs: plan['Execution Time'], planningMs: plan['Planning Time'], resultRows: plan.Plan['Actual Rows'] })}\n`);
});
