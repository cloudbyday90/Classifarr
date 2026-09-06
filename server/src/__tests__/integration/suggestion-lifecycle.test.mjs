/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, beforeEach, afterEach, test, expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';
import { createMountedTestApp } from '../helpers/setupRouteTest.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());
const { applySuggestion, rejectSuggestion } = await import('../../services/feedbackAnalysisSuggestionApply.mjs');
const { router: suggestionsRouter } = await import('../../routes/suggestions.mjs');
const { router: feedbackRouter } = await import('../../routes/feedback.mjs');
let db, libraryId, otherLibraryId, policyId, otherPolicyId, userId, suggestionId;
const app = createMountedTestApp({ basePath: '/api',
    router: express.Router().use('/suggestions', suggestionsRouter).use('/feedback', feedbackRouter),
    middleware: [(req, _res, next) => { req.user = { id: userId }; next(); }] });

beforeEach(async () => {
    db = getPool();
    userId = (await db.query("INSERT INTO users(username,password_hash,role) VALUES('lifecycle-reviewer','fixture','admin') RETURNING id")).rows[0].id;
    [libraryId, otherLibraryId] = (await db.query(`INSERT INTO libraries(name,external_id,media_type)
        VALUES('Lifecycle','lifecycle-primary','movie'),('Other','lifecycle-other','movie') RETURNING id`)).rows.map(row => row.id);
    [policyId, otherPolicyId] = (await db.query(`INSERT INTO library_policies(library_id,name,auto_classify_threshold,prompt_threshold)
        VALUES($1,'Primary',85,60),($2,'Other',80,55) RETURNING id`, [libraryId, otherLibraryId])).rows.map(row => row.id);
    await db.query('INSERT INTO policy_learning_stats(policy_id,accuracy_rate) VALUES($1,0.8)', [policyId]);
    suggestionId = (await db.query(`INSERT INTO policy_tuning_suggestions(policy_id,suggestion_type,suggestion_config,before_accuracy)
        VALUES($1,'adjust_threshold','{"threshold_type":"auto_classify","recommended":90}',0.5) RETURNING id`, [policyId])).rows[0].id;
});
afterEach(async () => {
    await db.query('DELETE FROM library_policies WHERE id=ANY($1::integer[])', [[policyId, otherPolicyId]]);
    await db.query('DELETE FROM libraries WHERE id=ANY($1::integer[])', [[libraryId, otherLibraryId]]);
    await db.query('DELETE FROM users WHERE id=$1', [userId]);
});

const review = action => action === 'apply' ? applySuggestion(suggestionId, userId) : rejectSuggestion(suggestionId, userId, 'Fixture reason');
async function snapshot() {
    return {
        suggestion: (await db.query('SELECT * FROM policy_tuning_suggestions WHERE id=$1', [suggestionId])).rows[0],
        policy: (await db.query('SELECT * FROM library_policies WHERE id=$1', [policyId])).rows[0],
        audit: (await db.query('SELECT * FROM policy_change_log WHERE policy_id=$1 ORDER BY id', [policyId])).rows
    };
}
async function waitForReviews(count) {
    let waiting = 0;
    for (let attempt = 0; attempt < 100 && waiting < count; attempt++) {
        waiting = (await db.query(`SELECT count(*)::integer count FROM pg_stat_activity WHERE datname=current_database()
            AND wait_event_type='Lock' AND query LIKE '%FOR UPDATE%' AND cardinality(pg_blocking_pids(pid))>0`)).rows[0].count;
        if (waiting < count) await new Promise(resolve => { setTimeout(resolve, 20); });
    }
    expect(waiting).toBe(count);
}

test.each([['apply', 'apply'], ['apply', 'reject'], ['reject', 'apply'], ['reject', 'reject']])(
    '%s followed by %s preserves the first completed review', async (first, second) => {
        await review(first);
        const before = await snapshot();
        await expect(review(second)).rejects.toMatchObject({ statusCode: 409, code: 'SUGGESTION_NOT_PENDING' });
        expect(await snapshot()).toEqual(before);
        expect(before.suggestion.reviewed_by).toBe(userId);
        expect(before.suggestion.reviewed_at).toBeInstanceOf(Date);
        expect(before.audit).toHaveLength(first === 'apply' ? 1 : 0);
        if (first === 'apply') {
            expect(before.suggestion.applied_at).toBeInstanceOf(Date);
            expect(before.suggestion.applied_by).toBe(userId);
            expect(before.suggestion.before_accuracy).toBeCloseTo(0.8);
        } else {
            expect(before.suggestion.before_accuracy).toBe(0.5);
            expect(before.suggestion.applied_at).toBeNull();
        }
    });

test.each([['apply', null], ['reject', null], ['apply', 'unknown'], ['reject', 'unknown']])(
    '%s rejects unrecognized status %s without changing data', async (action, status) => {
        await db.query('UPDATE policy_tuning_suggestions SET status=$1 WHERE id=$2', [status, suggestionId]);
        const before = await snapshot();
        await expect(review(action)).rejects.toMatchObject({ statusCode: 409, code: 'SUGGESTION_NOT_PENDING' });
        expect(await snapshot()).toEqual(before);
    });

test.each([['apply', 'apply'], ['reject', 'reject'], ['apply', 'reject']])(
    'concurrent %s/%s produces one terminal transition', async (first, second) => {
        const blocker = await db.connect();
        let pending;
        try {
            await blocker.query('BEGIN');
            await blocker.query('SELECT id FROM library_policies WHERE id=$1 FOR UPDATE', [policyId]);
            pending = Promise.allSettled([review(first), review(second)]);
            await waitForReviews(2);
            await blocker.query('COMMIT');
            const results = await pending;
            expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
            expect(results.find(result => result.status === 'rejected').reason).toMatchObject({ code: 'SUGGESTION_NOT_PENDING', statusCode: 409 });
            const winner = [first, second][results.findIndex(result => result.status === 'fulfilled')];
            const state = await snapshot();
            expect(state.suggestion.status).toBe(winner === 'apply' ? 'applied' : 'rejected');
            expect(state.audit).toHaveLength(winner === 'apply' ? 1 : 0);
            expect(state.policy.auto_classify_threshold).toBe(winner === 'apply' ? 90 : 85);
        } finally {
            await blocker.query('ROLLBACK');
            if (pending) await pending;
            blocker.release();
        }
    });

test('a changed policy reference while waiting fails without applying to either policy', async () => {
    const blocker = await db.connect();
    let pending;
    try {
        await blocker.query('BEGIN');
        await blocker.query('SELECT id FROM library_policies WHERE id=$1 FOR UPDATE', [policyId]);
        pending = Promise.allSettled([review('apply')]);
        await waitForReviews(1);
        await blocker.query('UPDATE policy_tuning_suggestions SET policy_id=$1 WHERE id=$2', [otherPolicyId, suggestionId]);
        await blocker.query('COMMIT');
        expect((await pending)[0].reason).toMatchObject({ code: 'SUGGESTION_POLICY_CHANGED', statusCode: 409 });
        const state = await snapshot();
        expect(state.suggestion.status).toBe('pending');
        expect(state.policy.auto_classify_threshold).toBe(85);
        expect(state.audit).toEqual([]);
        expect((await db.query('SELECT auto_classify_threshold FROM library_policies WHERE id=$1', [otherPolicyId])).rows[0].auto_classify_threshold).toBe(80);
    } finally {
        await blocker.query('ROLLBACK');
        if (pending) await pending;
        blocker.release();
    }
});

test('an audit insertion failure rolls back policy, terminal state and baseline together', async () => {
    const before = await snapshot();
    await db.query("ALTER TABLE policy_change_log ADD CONSTRAINT lifecycle_fixture_failure CHECK(change_type <> 'adjust_threshold') NOT VALID");
    try {
        await expect(review('apply')).rejects.toThrow(/lifecycle_fixture_failure/);
        expect(await snapshot()).toEqual(before);
    } finally { await db.query('ALTER TABLE policy_change_log DROP CONSTRAINT lifecycle_fixture_failure'); }
    await expect(review('apply')).resolves.toMatchObject({ success: true });
});

test('native intent blocks apply before bookkeeping but allows dismissing the pending suggestion', async () => {
    const setup = await db.connect();
    try {
        await setup.query('BEGIN');
        const intent = (await setup.query(`INSERT INTO policy_intents(policy_id,library_id,intent_version,source,inference_state,review_behavior,validation_status)
            VALUES($1,$2,1,'native_intent','inferred','{}','valid') RETURNING id`, [policyId, libraryId])).rows[0];
        await setup.query(`INSERT INTO policy_intent_rules(intent_id,intent_role,collection,signal_type,operator,values,inference_state)
            VALUES($1,'purpose','purpose','genres','require_any','{"require_any":["Animation"]}','inferred')`, [intent.id]);
        await setup.query('COMMIT');
    } finally { await setup.query('ROLLBACK'); setup.release(); }
    const before = await snapshot();
    await expect(review('apply')).rejects.toMatchObject({ code: 'POLICY_NATIVE_INTENT_LEGACY_WRITE_BLOCKED', statusCode: 409 });
    expect(await snapshot()).toEqual(before);
    await expect(review('reject')).resolves.toMatchObject({ status: 'rejected' });
});

test.each(['/api/suggestions', '/api/feedback/suggestions'])('%s protects baseline and audit data across retries', async base => {
    expect((await request(app).post(`${base}/${suggestionId}/apply`)).status).toBe(200);
    const before = await snapshot();
    await db.query('UPDATE policy_learning_stats SET accuracy_rate=0.9 WHERE policy_id=$1', [policyId]);
    const response = await request(app).post(`${base}/${suggestionId}/apply`);
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('SUGGESTION_NOT_PENDING');
    expect(await snapshot()).toEqual(before);
    expect((await request(app).post(`${base}/${suggestionId}/reject`).send({ reason: 'Late request' })).status).toBe(409);
    expect(await snapshot()).toEqual(before);
    for (const action of ['apply', 'reject']) {
        expect((await request(app).post(`${base}/2147483647/${action}`).send({ reason: 'Missing' })).status).toBe(404);
    }
});
