/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, beforeEach, afterEach, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import express from 'express';
import request from 'supertest';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';
import { seedSuggestionFeedback, attachSuggestionCohort } from '../helpers/suggestionCohortFixture.mjs';
import { createMountedTestApp } from '../helpers/setupRouteTest.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());
const { storeSuggestions } = await import('../../services/feedbackAnalysisSuggestionStore.mjs');
const { feedbackAnalysis } = await import('../../services/feedbackAnalysis.mjs');
const { captureSuggestionCohort, assertSuggestionCohortCurrent } = await import('../../services/feedbackAnalysisCohort.mjs');
const { applySuggestion, rejectSuggestion } = await import('../../services/feedbackAnalysisSuggestionApply.mjs');
const { router: suggestionsRouter } = await import('../../routes/suggestions.mjs');
const { router: feedbackRouter } = await import('../../routes/feedback.mjs');
const { authenticateToken } = await import('../../middleware/auth.mjs');
const { generateAccessToken, generateScopedAccessToken } = await import('../../services/auth.mjs');
let db, libraryId, otherLibraryId, policyId, otherPolicyId, userId, memberId, suggestionId;
let adminToken, memberToken, scopedToken;
const app = createMountedTestApp({ basePath: '/api',
    router: express.Router().use('/suggestions', suggestionsRouter).use('/feedback', feedbackRouter),
    middleware: [authenticateToken] });

function signedIn(httpRequest, token = adminToken) {
    return httpRequest.set('Authorization', `Bearer ${token}`);
}

beforeEach(async () => {
    db = getPool();
    const [admin, member] = (await db.query(`INSERT INTO users(username,password_hash,role)
        VALUES('lifecycle-reviewer','fixture','admin'),('lifecycle-member','fixture','user') RETURNING id,username,role`)).rows;
    userId = admin.id;
    memberId = member.id;
    [adminToken, memberToken, scopedToken] = await Promise.all([
        generateAccessToken(admin), generateAccessToken(member), generateScopedAccessToken(admin),
    ]);
    [libraryId, otherLibraryId] = (await db.query(`INSERT INTO libraries(name,external_id,media_type)
        VALUES('Lifecycle','lifecycle-primary','movie'),('Other','lifecycle-other','movie') RETURNING id`)).rows.map(row => row.id);
    [policyId, otherPolicyId] = (await db.query(`INSERT INTO library_policies(library_id,name,auto_classify_threshold,prompt_threshold)
        VALUES($1,'Primary',85,60),($2,'Other',80,55) RETURNING id`, [libraryId, otherLibraryId])).rows.map(row => row.id);
    await db.query('INSERT INTO policy_learning_stats(policy_id,accuracy_rate) VALUES($1,0.8)', [policyId]);
    suggestionId = (await db.query(`INSERT INTO policy_tuning_suggestions(policy_id,suggestion_type,suggestion_config,before_accuracy)
        VALUES($1,'adjust_threshold','{"threshold_type":"auto_classify","recommended":90}',0.5) RETURNING id`, [policyId])).rows[0].id;
    await seedSuggestionFeedback(db, policyId, libraryId);
    await attachSuggestionCohort(db, suggestionId, await captureSuggestionCohort(policyId));
});
afterEach(async () => {
    await db.query('DELETE FROM policy_feedback_log WHERE selected_policy_id=ANY($1::integer[])', [[policyId, otherPolicyId]]);
    await db.query('DELETE FROM library_policies WHERE id=ANY($1::integer[])', [[policyId, otherPolicyId]]);
    await db.query('DELETE FROM libraries WHERE id=ANY($1::integer[])', [[libraryId, otherLibraryId]]);
    await db.query('DELETE FROM users WHERE id=ANY($1::integer[])', [[userId, memberId]]);
});

const review = action => action === 'apply' ? applySuggestion(suggestionId, userId) : rejectSuggestion(suggestionId, userId, 'Fixture reason');
async function snapshot() {
    return {
        suggestion: (await db.query('SELECT * FROM policy_tuning_suggestions WHERE id=$1', [suggestionId])).rows[0],
        policy: (await db.query('SELECT * FROM library_policies WHERE id=$1', [policyId])).rows[0],
        audit: (await db.query('SELECT * FROM policy_change_log WHERE policy_id=$1 ORDER BY id', [policyId])).rows
    };
}
async function waitForReviews(count, lockClause = 'FOR UPDATE', blockingPid = null) {
    let waiting = 0;
    for (let attempt = 0; attempt < 100 && waiting < count; attempt++) {
        waiting = (await db.query(`SELECT count(*)::integer count FROM pg_stat_activity WHERE datname=current_database()
            AND wait_event_type='Lock' AND query LIKE $1 AND cardinality(pg_blocking_pids(pid))>0
            AND ($2::integer IS NULL OR $2 = ANY(pg_blocking_pids(pid)))`, [`%${lockClause}%`, blockingPid])).rows[0].count;
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
            expect(before.suggestion.before_accuracy).toBeCloseTo(0.5);
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

const suggestionPaths = ['/api/suggestions', '/api/feedback/suggestions'];
const reviewRoutes = suggestionPaths.flatMap(base => ['apply', 'reject'].map(action => [base, action]));

test.each(reviewRoutes)('%s %s denies writes before changing the suggestion, policy or audit', async (base, action) => {
    const path = `${base}/${suggestionId}/${action}`;
    const before = await snapshot();
    await request(app).post(path).expect(401);
    await signedIn(request(app).post(path), memberToken).expect(403);
    await signedIn(request(app).post(`${base}/invalid/${action}`), memberToken).expect(403);
    await signedIn(request(app).post(path), scopedToken).expect(403);

    for (const id of [undefined, '01', 0, 2147483648]) {
        const invalidActor = await generateAccessToken({ id, username: 'lifecycle-reviewer', role: 'admin' });
        const response = await signedIn(request(app).post(path), invalidActor).expect(403);
        expect(response.body.error).toBe('Valid administrator identity required');
    }

    for (const id of [`${suggestionId}x`, `0${suggestionId}`, `${suggestionId}\n`, '0', '-1', '1.5', '1e0', '2147483648']) {
        const response = await signedIn(request(app).post(`${base}/${encodeURIComponent(id)}/${action}`)).expect(400);
        expect(response.body.error).toContain('1 to 2147483647');
    }
    expect(await snapshot()).toEqual(before);
});

test.each(suggestionPaths)('%s preserves member reads and records the administrator who rejects', async base => {
    const readPath = base === '/api/suggestions' ? `${base}/${suggestionId}` : `/api/feedback/policies/${policyId}/suggestions`;
    await signedIn(request(app).get(readPath), memberToken).expect(200);
    const rejection = await signedIn(request(app).post(`${base}/${suggestionId}/reject`))
        .send({ reason: 'Dismiss', userId: memberId }).expect(200);
    expect(rejection.body).toEqual(base === '/api/suggestions'
        ? { success: true, result: { success: true, suggestionId: String(suggestionId), status: 'rejected' } }
        : { success: true, suggestionId, status: 'rejected', message: 'Suggestion rejected' });
    const after = await snapshot();
    expect(after.suggestion).toMatchObject({ status: 'rejected', reviewed_by: userId, applied_by: null, rejection_reason: 'Dismiss' });
    expect(after.audit).toEqual([]);
    const otherBase = suggestionPaths.find(path => path !== base);
    const repeat = await signedIn(request(app).post(`${otherBase}/${suggestionId}/reject`)).send({ reason: 'Later' }).expect(409);
    expect(repeat.body.code).toBe('SUGGESTION_NOT_PENDING');
    expect(await snapshot()).toEqual(after);
});

test.each([['apply', 'applied'], ['reject', 'rejected']])(
    'a dropped %s response leaves one saved transition visible through the proposal route', async (action, status) => {
        const path = `/api/suggestions/${suggestionId}`;
        const droppingApp = createMountedTestApp({ basePath: '/api/suggestions', router: suggestionsRouter,
            middleware: [authenticateToken, (req, res, next) => {
                if (req.method === 'POST' && req.path === `${path}/${action}`) {
                    const sendJson = res.json.bind(res);
                    res.json = body => {
                        if (res.statusCode !== 200) return sendJson(body);
                        res.destroy();
                        return res;
                    };
                }
                next();
            }] });
        const write = signedIn(request(droppingApp).post(`${path}/${action}`)).send({ reason: 'Fixture reason' });
        await expect(write).rejects.toMatchObject({ code: 'ECONNRESET' });

        const saved = await signedIn(request(app).get(`${path}/proposal`)).expect(200).expect('Cache-Control', 'no-store');
        expect(saved.body).toMatchObject({ id: suggestionId, policy_id: policyId, status });
        expect(saved.body).not.toHaveProperty('reviewed_by');
        const after = await snapshot();
        expect(after.suggestion).toMatchObject({ status, reviewed_by: userId });
        expect(after.audit).toHaveLength(action === 'apply' ? 1 : 0);
        expect(after.policy.auto_classify_threshold).toBe(action === 'apply' ? 90 : 85);
    });

test('a saved pending status can precede completion of the review already in flight', async () => {
    const path = `/api/suggestions/${suggestionId}`;
    const blocker = await db.connect();
    let completion;
    try {
        await blocker.query('BEGIN');
        await blocker.query('SELECT id FROM library_policies WHERE id=$1 FOR UPDATE', [policyId]);
        const write = signedIn(request(app).post(`${path}/reject`)).send({ reason: 'Fixture reason' });
        completion = Promise.allSettled([write]);
        await waitForReviews(1);
        const whileWaiting = await signedIn(request(app).get(`${path}/proposal`)).expect(200);
        expect(whileWaiting.body.status).toBe('pending');
        await blocker.query('COMMIT');
        const [finished] = await completion;
        expect(finished.value?.status).toBe(200);
        const saved = await signedIn(request(app).get(`${path}/proposal`)).expect(200);
        expect(saved.body.status).toBe('rejected');
        expect((await snapshot()).suggestion.reviewed_by).toBe(userId);
    } finally {
        await blocker.query('ROLLBACK');
        if (completion) await completion;
        blocker.release();
    }
});

test('the bounded list authenticates and rejects invalid query shapes before reading suggestions', async () => {
    const path = '/api/suggestions/page';
    const read = jest.spyOn(db, 'query');
    try {
        await request(app).get(path).expect(401);
        await signedIn(request(app).get(path), scopedToken).expect(403);
        for (const query of [
            'status=', 'status=unknown', 'status=all&status=pending', 'status[]=pending',
            'policyId=01', 'policyId=1&policyId=1', 'policyId=', 'policyId=2147483648',
            'beforeId=0', 'beforeId=1e1', 'beforeId=1%0A', 'beforeId=1&beforeId=2',
            'beforeId%5B%5D=1', 'limit=100',
        ]) {
            await signedIn(request(app).get(`${path}?${query}`), memberToken)
                .expect(400).expect('Cache-Control', 'no-store');
        }
        expect(read.mock.calls.filter(([sql]) => typeof sql === 'string' &&
            sql.includes('policy_tuning_suggestions'))).toEqual([]);
    } finally {
        read.mockRestore();
    }
    await signedIn(request(app).get(path)).expect(200);
});

test('the bounded list pages live matches in exact ID order with the legacy lists still available', async () => {
    const inserted = (await db.query(`INSERT INTO policy_tuning_suggestions
        (policy_id,suggestion_type,suggestion_config,status,confidence,created_at)
        SELECT $1,'adjust_threshold','{}',
            (ARRAY['pending','applied','rejected','superseded'])[1+(n % 4)],
            CASE WHEN n % 2 = 0 THEN NULL ELSE 100-n END,
            CASE WHEN n % 2 = 0 THEN NULL ELSE now() END
        FROM generate_series(1,44) n RETURNING id,status`, [policyId])).rows;
    await db.query(`INSERT INTO policy_tuning_suggestions(policy_id,suggestion_type,suggestion_config)
        VALUES($1,'adjust_weight','{}')`, [otherPolicyId]);
    const expected = [...inserted.map(row => row.id), suggestionId].sort((a, b) => b - a);
    const path = '/api/suggestions/page';
    const filters = { status: 'all', policyId };
    const page = query => signedIn(request(app).get(path).query(query), memberToken)
        .expect(200).expect('Content-Type', /application\/json/).expect('Cache-Control', 'no-store');
    const ids = response => response.body.items.map(row => row.id);

    const first = await page(filters);
    expect(ids(first)).toEqual(expected.slice(0, 20));
    expect(first.body.nextBeforeId).toBe(expected[19]);
    const newer = (await db.query(`INSERT INTO policy_tuning_suggestions(policy_id,suggestion_type,suggestion_config)
        VALUES($1,'adjust_threshold','{}') RETURNING id`, [policyId])).rows[0].id;
    await db.query('DELETE FROM policy_tuning_suggestions WHERE id=$1', [first.body.nextBeforeId]);
    const second = await page({ ...filters, beforeId: first.body.nextBeforeId });
    expect(ids(second)).toEqual(expected.slice(20, 40));
    expect(second.body.nextBeforeId).toBe(expected[39]);
    const last = await page({ ...filters, beforeId: second.body.nextBeforeId });
    expect(ids(last)).toEqual(expected.slice(40));
    expect(last.body.nextBeforeId).toBeNull();
    const exact = await page({ ...filters, beforeId: expected[24] });
    expect(ids(exact)).toEqual(expected.slice(25));
    expect(exact.body.nextBeforeId).toBeNull();
    expect(ids(await page(filters))[0]).toBe(newer);
    expect((await page({ ...filters, beforeId: 1 })).body).toEqual({ items: [], nextBeforeId: null });
    expect((await page({ ...filters, beforeId: 2147483647 })).body).toEqual((await page(filters)).body);
    expect((await page({ policyId })).body.items.every(row => row.status === 'pending')).toBe(true);
    expect(ids(await page({ status: 'applied', policyId }))).toEqual(inserted
        .filter(row => row.status === 'applied' && row.id !== first.body.nextBeforeId)
        .map(row => row.id).sort((a, b) => b - a));

    const legacy = await signedIn(request(app).get('/api/suggestions').query({ policyId }), memberToken).expect(200);
    expect(legacy.body.find(row => row.id === suggestionId)).toHaveProperty('suggestion_config');
    const policyList = await signedIn(request(app).get(`/api/feedback/policies/${policyId}/suggestions`), memberToken).expect(200);
    expect(policyList.body).toMatchObject({ policyId, suggestions: expect.any(Array) });
});

test('the bounded list limits serialized output and excludes saved configuration and feedback fields', async () => {
    const label = '\u0001'.repeat(161);
    const path = '/api/suggestions/page';
    await db.query('UPDATE library_policies SET name=$2 WHERE id=$1', [policyId, label]);
    await db.query('UPDATE libraries SET name=$2 WHERE id=$1', [libraryId, label]);
    await db.query(`INSERT INTO policy_tuning_suggestions
        (policy_id,suggestion_type,suggestion_config,impact_estimate,status,confidence,
            applied_at,superseded_at,rejection_reason,supporting_feedback_ids)
        SELECT $1,repeat($2,30),jsonb_build_object('private',repeat('X',70000)),repeat($2,100),
            repeat($2,20),'NaN'::real,'infinity','2026-11-23T12:00:00Z','private',ARRAY[1,2]
        FROM generate_series(1,20)`, [policyId, '\u0001']);
    const result = await signedIn(request(app).get(path).query({ status: 'all', policyId }), memberToken).expect(200);
    expect(result.body.items).toHaveLength(20);
    expect(Buffer.byteLength(result.text)).toBeGreaterThan(55 * 1024);
    expect(Buffer.byteLength(result.text)).toBeLessThanOrEqual(64 * 1024);
    const row = result.body.items[0];
    expect(row).toEqual({
        id: expect.any(Number), policy_id: policyId, policy_name: label.slice(0, 160),
        library_name: label.slice(0, 160), suggestion_type: '\u0001'.repeat(30), status: '\u0001'.repeat(20),
        confidence: null, impact_estimate: '\u0001'.repeat(100), created_at: expect.any(String),
        applied_at: null, superseded_at: '2026-11-23T12:00:00.000Z',
    });
    expect(result.body.nextBeforeId).toBe(result.body.items[19].id);
});

test('the saved evidence route requires a genuine administrator and exact inputs before reading', async () => {
    const detail = `/api/suggestions/${suggestionId}`;
    const evidence = `${detail}/evidence`;
    const read = jest.spyOn(db, 'query');
    try {
        await request(app).get(evidence).expect(401);
        await signedIn(request(app).get(evidence), memberToken).expect(403);
        await signedIn(request(app).get(evidence), scopedToken).expect(403);
        const invalidActor = await generateAccessToken({ id: '01', username: 'lifecycle-reviewer', role: 'admin' });
        await signedIn(request(app).get(evidence), invalidActor).expect(403);
        await signedIn(request(app).get(`/api/suggestions/0${suggestionId}/evidence`)).expect(400);
        for (const query of ['afterPosition=0', 'afterPosition=01', 'afterPosition=1e0', 'afterPosition=5001',
            'afterPosition=1&afterPosition=2', 'afterPosition%5B%5D=1', 'limit=20']) {
            await signedIn(request(app).get(`${evidence}?${query}`)).expect(400);
        }
        const evidenceReads = read.mock.calls.filter(([sql]) =>
            /policy_tuning_suggestions|policy_feedback_log/.test(sql));
        expect(evidenceReads).toEqual([]);
    } finally {
        read.mockRestore();
    }
    await signedIn(request(app).get('/api/suggestions/2147483647/evidence')).expect(404);
    await signedIn(request(app).get(detail), memberToken).expect(200);
    await db.query('UPDATE policy_tuning_suggestions SET policy_id=NULL WHERE id=$1', [suggestionId]);
    try {
        await signedIn(request(app).get(evidence)).expect(404);
    } finally {
        await db.query('UPDATE policy_tuning_suggestions SET policy_id=$1 WHERE id=$2', [policyId, suggestionId]);
    }
});

test('saved evidence pages follow stored positions and preserve gaps across feedback changes', async () => {
    const { rows: [first, next, removed] } = await db.query(`SELECT id FROM policy_feedback_log
        WHERE selected_policy_id=$1 ORDER BY id LIMIT 3`, [policyId]);
    const [foreign] = await seedSuggestionFeedback(db, otherPolicyId, otherLibraryId, 1);
    const [wrongLibrary] = await seedSuggestionFeedback(db, policyId, otherLibraryId, 1);
    const support = [next.id, null, foreign, wrongLibrary, ...Array(16).fill(first.id), removed.id, next.id];
    await db.query(`UPDATE policy_feedback_log SET title=$1, was_correction=NULL, top_suggestion_library_id=$2,
        item_metadata='{"private":"omitted"}', user_reason_text='omitted note',
        prompted_at='2026-11-23T12:34:56Z' WHERE id=$3`, ['Observed title', otherLibraryId, next.id]);
    await db.query('UPDATE policy_tuning_suggestions SET supporting_feedback_ids=$1 WHERE id=$2', [support, suggestionId]);
    const before = await snapshot();
    const path = `/api/suggestions/${suggestionId}/evidence`;
    const page = await signedIn(request(app).get(path)).expect(200).expect('Cache-Control', 'no-store');
    expect(page.body).toMatchObject({ suggestionId, referenceCount: 22, nextAfterPosition: 20 });
    expect(page.body.items.map(item => item.position)).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
    const visible = { status: 'available', feedbackId: next.id, title: 'Observed title',
        promptedAt: '2026-11-23T12:34:56.000Z', wasCorrection: null, originalLibrary: 'Other', selectedLibrary: 'Lifecycle' };
    expect(page.body.items[0]).toEqual({ position: 1, ...visible });
    expect(page.body.items.slice(1, 4)).toEqual([2, 3, 4].map(position => ({ position, status: 'unavailable' })));
    expect(page.body.items.slice(4).map(item => item.feedbackId)).toEqual(Array(16).fill(first.id));
    expect(await snapshot()).toEqual(before);

    await db.query('DELETE FROM policy_feedback_log WHERE id=$1', [removed.id]);
    const continuation = await signedIn(request(app).get(path).query({ afterPosition: 20 })).expect(200);
    expect(continuation.body).toEqual({ suggestionId, referenceCount: 22, nextAfterPosition: null, items: [
        { position: 21, status: 'unavailable' }, { position: 22, ...visible },
    ] });
    const end = await signedIn(request(app).get(path).query({ afterPosition: 5000 })).expect(200);
    expect(end.body).toEqual({ suggestionId, referenceCount: 22, nextAfterPosition: null, items: [] });
    const legacy = await signedIn(request(app).get(`/api/suggestions/${suggestionId}`), memberToken).expect(200);
    expect(legacy.body.supporting_feedback.find(item => item.id === next.id)).toMatchObject({ user_reason_text: 'omitted note' });
    expect(legacy.headers.deprecation).toBe(`@${Date.parse('2026-11-23T00:00:00-05:00') / 1000}`);
    expect(legacy.headers.link).toBe('</api/docs/>; rel="deprecation"');
    expect(legacy.headers.sunset).toBeUndefined();
});

test('legacy detail preserves shipped fields and ordering when both tables gain private columns', async () => {
    const { rows: [older, newer] } = await db.query(`SELECT id FROM policy_feedback_log
        WHERE selected_policy_id=$1 ORDER BY id LIMIT 2`, [policyId]);
    await db.query("UPDATE policy_feedback_log SET prompted_at='2026-11-22T12:00:00Z' WHERE id=$1", [older.id]);
    await db.query(`UPDATE policy_feedback_log SET prompted_at='2026-11-23T12:00:00Z',
        user_reason_text='Legacy note', signal_analysis='{"fixture":true}' WHERE id=$1`, [newer.id]);
    await db.query('UPDATE policy_tuning_suggestions SET supporting_feedback_ids=$1 WHERE id=$2', [[older.id, newer.id], suggestionId]);

    const path = `/api/suggestions/${suggestionId}`;
    await request(app).get(path).expect(401);
    const original = await signedIn(request(app).get(path), memberToken).expect(200).expect('Cache-Control', 'no-store');
    expect(Object.keys(original.body)).toEqual([
        'id', 'policy_id', 'suggestion_type', 'suggestion_config', 'supporting_feedback_ids', 'confidence',
        'impact_estimate', 'status', 'reviewed_at', 'reviewed_by', 'rejection_reason', 'created_at', 'applied_at',
        'applied_by', 'before_accuracy', 'cohort_fingerprint', 'evidence_fingerprint', 'superseded_at',
        'policy_name', 'library_name', 'supporting_feedback',
    ]);
    const feedback = original.body.supporting_feedback;
    expect(feedback.map(row => row.id)).toEqual([newer.id, older.id]);
    expect(Object.keys(feedback[0])).toEqual([
        'id', 'tmdb_id', 'media_type', 'title', 'item_metadata', 'prompt_type', 'original_scores',
        'top_suggestion_library_id', 'top_suggestion_score', 'selected_library_id', 'selected_policy_id',
        'was_correction', 'user_reason', 'user_reason_text', 'patterns_created', 'signal_analysis',
        'prompted_at', 'responded_at', 'response_time_seconds', 'source', 'original_library', 'selected_library',
    ]);
    expect(feedback[0]).toMatchObject({ user_reason_text: 'Legacy note', signal_analysis: { fixture: true } });

    try {
        await db.query("ALTER TABLE policy_tuning_suggestions ADD COLUMN private_fixture TEXT DEFAULT 'private-suggestion'");
        await db.query("ALTER TABLE policy_feedback_log ADD COLUMN private_fixture TEXT DEFAULT 'private-feedback'");
        const next = await signedIn(request(app).get(path), memberToken).expect(200).expect('Cache-Control', 'no-store');
        expect(next.text).toBe(original.text);
        expect(next.headers.etag).toBe(original.headers.etag);
        await signedIn(request(app).head(path), memberToken).expect(200).expect('Cache-Control', 'no-store');
        const conditional = await signedIn(request(app).get(path), memberToken)
            .set('If-None-Match', original.headers.etag).expect(304).expect('Cache-Control', 'no-store');
        expect(conditional.headers.deprecation).toBe(original.headers.deprecation);
        expect(conditional.headers.sunset).toBeUndefined();
    } finally {
        await db.query('ALTER TABLE policy_feedback_log DROP COLUMN IF EXISTS private_fixture');
        await db.query('ALTER TABLE policy_tuning_suggestions DROP COLUMN IF EXISTS private_fixture');
    }
});

test('a suggestion without its analysis snapshot can be read and still cannot be applied', async () => {
    const { rows: [feedback] } = await db.query('SELECT id FROM policy_feedback_log WHERE selected_policy_id=$1 ORDER BY id LIMIT 1', [policyId]);
    await db.query("UPDATE policy_feedback_log SET prompted_at='2026-07-31T12:00:00Z' WHERE id=$1", [feedback.id]);
    await db.query(`UPDATE policy_tuning_suggestions SET cohort_fingerprint=NULL, evidence_fingerprint=NULL,
        supporting_feedback_ids=$1, created_at='2026-08-01T12:00:00Z' WHERE id=$2`, [[feedback.id], suggestionId]);
    const before = await snapshot();
    const path = `/api/suggestions/${suggestionId}`;
    const legacy = await signedIn(request(app).get(path), memberToken).expect(200);
    expect(legacy.body).toMatchObject({ status: 'pending', cohort_fingerprint: null, evidence_fingerprint: null });
    expect(legacy.body.supporting_feedback.map(row => row.id)).toEqual([feedback.id]);
    const proposal = await signedIn(request(app).get(`${path}/proposal`), memberToken).expect(200);
    expect(proposal.body).toMatchObject({ reference_count: 1, proposal_status: 'available',
        suggestion_config: { threshold_type: 'auto_classify', current: null, recommended: 90 },
    });
    await signedIn(request(app).get(`${path}/evidence`), memberToken).expect(403);
    const evidence = await signedIn(request(app).get(`${path}/evidence`)).expect(200);
    expect(evidence.body.items).toMatchObject([{ position: 1, feedbackId: feedback.id, status: 'available' }]);
    const apply = await signedIn(request(app).post(`${path}/apply`)).expect(409);
    expect(apply.body.code).toBe('SUGGESTION_EVIDENCE_REQUIRED');
    expect(await snapshot()).toEqual(before);
});

test('the signed-in proposal read projects one row without expanding or returning feedback', async () => {
    const { rows: [feedback] } = await db.query(`SELECT id FROM policy_feedback_log
        WHERE selected_policy_id=$1 ORDER BY id LIMIT 1`, [policyId]);
    await db.query(`UPDATE policy_tuning_suggestions SET supporting_feedback_ids=$1,
        suggestion_config=$2, confidence=74, impact_estimate='Fixture impact', rejection_reason='private note',
        reviewed_by=$3, created_at='2026-11-23T12:00:00Z' WHERE id=$4`, [[feedback.id, null], {
        threshold_type: 'auto_classify', current: 85, recommended: 90, reason: 'private rationale', extra: { raw: true },
    }, userId, suggestionId]);
    const before = await snapshot();
    const path = `/api/suggestions/${suggestionId}/proposal`;
    const read = jest.spyOn(db, 'query');
    try {
        await request(app).get(path).expect(401);
        await signedIn(request(app).get(path), scopedToken).expect(403);
        for (const id of ['01', '1x', '1.5', '2147483648']) {
            await signedIn(request(app).get(`/api/suggestions/${id}/proposal`), memberToken).expect(400);
        }
        expect(read.mock.calls.filter(([sql]) => sql.includes('policy_tuning_suggestions'))).toEqual([]);
        const member = await signedIn(request(app).get(path), memberToken).expect(200).expect('Cache-Control', 'no-store');
        const reads = read.mock.calls.filter(([sql]) => sql.includes('policy_tuning_suggestions'));
        expect(reads).toHaveLength(1);
        expect(reads[0][0]).not.toContain('policy_feedback_log');
        expect(member.headers.deprecation).toBeUndefined();
        expect(member.body).toEqual({ id: suggestionId, policy_id: policyId, policy_name: 'Primary', library_name: 'Lifecycle',
            suggestion_type: 'adjust_threshold', status: 'pending', confidence: 74, impact_estimate: 'Fixture impact',
            created_at: '2026-11-23T12:00:00.000Z', reference_count: 2, proposal_status: 'available',
            suggestion_config: { threshold_type: 'auto_classify', current: 85, recommended: 90 },
        });
        const admin = await signedIn(request(app).get(path)).expect(200);
        expect(admin.body).toEqual(member.body);
    } finally {
        read.mockRestore();
    }
    expect(await snapshot()).toEqual(before);
    await signedIn(request(app).get('/api/suggestions/2147483647/proposal'), memberToken).expect(404);
    const impact = await signedIn(request(app).get(`/api/suggestions/${suggestionId}/impact`), memberToken).expect(200);
    expect(impact.headers.deprecation).toBeUndefined();
});

test('proposal reads preserve known bounded config and report unsupported saved config as unavailable', async () => {
    const path = `/api/suggestions/${suggestionId}/proposal`;
    const label = '\u0001';
    await db.query('UPDATE library_policies SET name=$1 WHERE id=$2', [label.repeat(160), policyId]);
    await db.query('UPDATE libraries SET name=$1 WHERE id=$2', [label.repeat(180), libraryId]);
    const weight = { signal: 'rag', current: 0.3, recommended: 0.2 };
    const pattern = { pattern_type: 'collection', pattern_value: label.repeat(240), confidence: 75 };
    for (const [type, config, expected] of [
        ['adjust_weight', { ...weight, comment: 'omitted' }, weight],
        ['create_pattern', pattern, pattern],
        ['create_pattern', { ...pattern, pattern_value: 'x'.repeat(241) }, null],
        ['adjust_weight', { ...weight, recommended: '0.2' }, null],
        ['adjust_weight', { ...weight, legacy_payload: 'x'.repeat(4096) }, null],
        ['unknown_type', weight, null],
    ]) {
        await db.query('UPDATE policy_tuning_suggestions SET suggestion_type=$1,suggestion_config=$2 WHERE id=$3',
            [type, config, suggestionId]);
        const response = await signedIn(request(app).get(path), memberToken).expect(200);
        expect(response.body).toMatchObject({ suggestion_type: type, proposal_status: expected ? 'available' : 'unavailable',
            suggestion_config: expected, policy_name: label.repeat(160), library_name: label.repeat(160),
        });
        expect(Buffer.byteLength(response.text)).toBeLessThanOrEqual(8 * 1024);
    }
});

test('saved evidence keeps the largest valid page bounded and distinguishes unsupported arrays', async () => {
    const { rows: [feedback] } = await db.query(`SELECT id FROM policy_feedback_log
        WHERE selected_policy_id=$1 ORDER BY id LIMIT 1`, [policyId]);
    const escaped = '\u0001';
    await db.query('UPDATE libraries SET name=$1 || id::text WHERE id=ANY($2::integer[])',
        [escaped.repeat(244), [libraryId, otherLibraryId]]);
    await db.query(`UPDATE policy_feedback_log SET title=$1, top_suggestion_library_id=$2,
        prompted_at='infinity' WHERE id=$3`, [escaped.repeat(500), otherLibraryId, feedback.id]);
    await db.query(`UPDATE policy_tuning_suggestions SET supporting_feedback_ids=array_fill($1::integer, ARRAY[5000])
        WHERE id=$2`, [feedback.id, suggestionId]);
    const path = `/api/suggestions/${suggestionId}/evidence`;
    const response = await signedIn(request(app).get(path)).query({ afterPosition: 4980 }).expect(200);
    expect(response.body).toMatchObject({ suggestionId, referenceCount: 5000, nextAfterPosition: null });
    expect(response.body.items.map(item => item.position)).toEqual(Array.from({ length: 20 }, (_, index) => 4981 + index));
    expect(response.body.items[0]).toMatchObject({ title: escaped.repeat(160), originalLibrary: escaped.repeat(80),
        selectedLibrary: escaped.repeat(80), promptedAt: null });
    expect(Buffer.byteLength(response.text)).toBeLessThanOrEqual(48 * 1024);

    for (const [support, referenceCount] of [[null, 0], ['{}', 0], ['[0:1]={1,2}', null], ['{{1,2},{3,4}}', null]]) {
        await db.query('UPDATE policy_tuning_suggestions SET supporting_feedback_ids=$1::integer[] WHERE id=$2', [support, suggestionId]);
        const page = await signedIn(request(app).get(path)).expect(200);
        expect(page.body).toEqual({ suggestionId, referenceCount, nextAfterPosition: null, items: [] });
    }
    await db.query(`UPDATE policy_tuning_suggestions SET supporting_feedback_ids=array_fill($1::integer, ARRAY[5001])
        WHERE id=$2`, [feedback.id, suggestionId]);
    const oversized = await signedIn(request(app).get(path)).expect(200);
    expect(oversized.body).toEqual({ suggestionId, referenceCount: null, nextAfterPosition: null, items: [] });
});

test.each(['policy', 'all'])('manual %s analysis requires an exact administrator before superseding a suggestion', async scope => {
    const path = scope === 'policy' ? `/api/feedback/policies/${policyId}/analyze` : '/api/feedback/analyze-all';
    await db.query('UPDATE policy_tuning_suggestions SET cohort_fingerprint=NULL,evidence_fingerprint=NULL WHERE id=$1', [suggestionId]);
    const before = await snapshot();
    const missingActor = await generateAccessToken({ username: 'lifecycle-reviewer', role: 'admin' });
    await request(app).post(path).send({}).expect(401);
    await signedIn(request(app).post(path), memberToken).send({}).expect(403);
    await signedIn(request(app).post(path), scopedToken).send({}).expect(403);
    await signedIn(request(app).post(path), missingActor).send({}).expect(403);

    if (scope === 'policy') {
        for (const id of [`${policyId}x`, `0${policyId}`, '0', '1.5', '2147483648']) {
            await signedIn(request(app).post(`/api/feedback/policies/${id}/analyze`)).send({}).expect(400);
        }
    }
    expect(await snapshot()).toEqual(before);

    const response = await signedIn(request(app).post(path)).send({}).expect(200);
    const analyzed = scope === 'policy' ? response.body : response.body.results.find(result => result.policyId === policyId);
    expect(response.body.success).toBe(true);
    expect(analyzed).toMatchObject({ policyId, feedbackCount: 10 });
    expect(analyzed.suggestions.length).toBeGreaterThan(0);
    const after = await snapshot();
    expect(after.suggestion).toMatchObject({ status: 'superseded', reviewed_by: null, reviewed_at: null, applied_by: null });
    expect(after.suggestion.superseded_at).toBeInstanceOf(Date);
    expect(after.policy).toEqual(before.policy);
    expect(after.audit).toEqual(before.audit);
});

test('a waiting policy write retains admission and refuses full analysis before dispatch', async () => {
    const policyPath = `/api/feedback/policies/${policyId}/analyze`;
    const fullPath = '/api/feedback/analyze-all';
    const blocker = await db.connect();
    let first;
    try {
        await blocker.query('BEGIN');
        await blocker.query('SELECT id FROM library_policies WHERE id=$1 FOR NO KEY UPDATE', [policyId]);
        first = signedIn(request(app).post(policyPath)).send({}).then(response => response);
        await waitForReviews(1, 'FOR NO KEY UPDATE', blocker.processID);
        const before = await snapshot();
        await request(app).post(fullPath).send({}).expect(401);
        await signedIn(request(app).post(fullPath), memberToken).send({}).expect(403);
        const busy = await signedIn(request(app).post(fullPath)).send({}).timeout(3000).expect(503);
        expect(busy.body.code).toBe('SUGGESTION_ANALYSIS_BUSY');
        expect(await snapshot()).toEqual(before);
    } finally {
        try { await blocker.query('ROLLBACK'); }
        finally { blocker.release(); }
        if (first) expect(await first).toMatchObject({ status: 200, body: { success: true, policyId } });
    }
    await signedIn(request(app).post(fullPath)).send({}).expect(200);
});

test('full analysis retains successful writes and ordinary per-policy errors', async () => {
    await seedSuggestionFeedback(db, otherPolicyId, otherLibraryId, 5001);
    await db.query('UPDATE policy_tuning_suggestions SET cohort_fingerprint=NULL,evidence_fingerprint=NULL WHERE id=$1', [suggestionId]);
    const full = await signedIn(request(app).post('/api/feedback/analyze-all')).send({}).expect(200);
    expect(full.body.success).toBe(true);
    expect(full.body.results).toEqual(expect.arrayContaining([
        expect.objectContaining({ policyId, feedbackCount: 10, suggestions: expect.any(Array) }),
        expect.objectContaining({ policyId: otherPolicyId, error: expect.stringContaining('exceeds 5,000 rows') }),
    ]));
    expect(full.body.policiesAnalyzed).toBe(full.body.results.length);
    expect((await snapshot()).suggestion).toMatchObject({ status: 'superseded', reviewed_by: null, applied_by: null });
    const saved = await db.query('SELECT id FROM policy_tuning_suggestions WHERE policy_id=$1 AND status=$2', [policyId, 'pending']);
    expect(saved.rows.length).toBeGreaterThan(0);
});

test('bounded summary visits an ordered active batch and reports uncertain writes without replay', async () => {
    const path = '/api/feedback/analyze-all?format=summary-v1';
    await seedSuggestionFeedback(db, otherPolicyId, otherLibraryId);
    const { rows: extraLibraries } = await db.query(`INSERT INTO libraries(external_id,name,media_type,is_active)
        SELECT 'summary-fixture-'||n,'Summary fixture '||n,'movie',true FROM generate_series(1,25) n RETURNING id`);
    const extraIds = extraLibraries.map(row => row.id);
    const analyze = feedbackAnalysis.analyzePolicy.bind(feedbackAnalysis);
    const observed = jest.spyOn(feedbackAnalysis, 'analyzePolicy').mockImplementation(async id => {
        const result = await analyze(id);
        if (id === otherPolicyId) throw new Error('Synthetic loss of the analysis result after commit');
        return result;
    });
    try {
        await db.query(`INSERT INTO library_policies(library_id,name,enabled)
            SELECT id,name,id<>$2 FROM libraries WHERE id=ANY($1::integer[])`, [extraIds, Math.min(...extraIds)]);
        const expected = (await db.query('SELECT id FROM library_policies WHERE enabled IS TRUE ORDER BY id')).rows.map(row => row.id);
        expect(expected).toHaveLength(26);
        await request(app).post(path).send({}).expect(401);
        await signedIn(request(app).post(path), memberToken).send({}).expect(403);
        expect(observed).not.toHaveBeenCalled();

        const first = await signedIn(request(app).post(path)).send({}).expect(200);
        expect(first.headers['cache-control']).toBe('no-store');
        expect(Buffer.byteLength(first.text)).toBeLessThanOrEqual(4096);
        expect(first.body).toMatchObject({ success: true, format: 'summary-v1', policiesAttempted: 24,
            counts: { completed: 1, insufficient_feedback: 22, unconfirmed: 1 }, nextAfterPolicyId: expected[23] });
        expect(first.body.results.map(entry => entry.policyId)).toEqual(expected.slice(0, 24));
        expect(first.body.results.find(entry => entry.policyId === policyId)).toMatchObject({ status: 'completed', feedbackCount: 10 });
        expect(first.body.results.find(entry => entry.policyId === otherPolicyId)).toEqual({
            policyId: otherPolicyId, status: 'unconfirmed', feedbackCount: null, suggestionsCreated: null,
        });
        expect(first.text).not.toContain('Synthetic loss');
        const otherWrites = await db.query('SELECT id FROM policy_tuning_suggestions WHERE policy_id=$1', [otherPolicyId]);
        expect(otherWrites.rows.length).toBeGreaterThan(0);

        const next = await signedIn(request(app).post(`${path}&afterPolicyId=${first.body.nextAfterPolicyId}`)).send({}).expect(200);
        expect(next.body).toMatchObject({ policiesAttempted: 2, nextAfterPolicyId: null });
        expect(next.body.results.map(entry => entry.policyId)).toEqual(expected.slice(24));
        const empty = await signedIn(request(app).post(`${path}&afterPolicyId=2147483647`)).send({}).expect(200);
        expect(empty.body).toMatchObject({ policiesAttempted: 0, nextAfterPolicyId: null, results: [] });
        expect(observed.mock.calls).toEqual(expected.map(id => [id]));
    } finally {
        observed.mockRestore();
        await db.query('DELETE FROM library_policies WHERE library_id=ANY($1::integer[])', [extraIds]);
        await db.query('DELETE FROM libraries WHERE id=ANY($1::integer[])', [extraIds]);
    }
});

test.each(suggestionPaths)('%s preserves its response and protects the saved outcome across aliases', async base => {
    const otherBase = suggestionPaths.find(path => path !== base);
    const result = { success: true, policyId, type: 'adjust_threshold' };
    const success = await signedIn(request(app).post(`${base}/${suggestionId}/apply`))
        .send({ userId: memberId }).expect(200);
    expect(success.body).toEqual(base === '/api/suggestions'
        ? { success: true, result: { ...result, suggestionId: String(suggestionId) } }
        : { ...result, suggestionId, message: 'Suggestion applied successfully' });
    const before = await snapshot();
    expect(before.suggestion).toMatchObject({ status: 'applied', applied_by: userId, reviewed_by: userId });
    expect(before.policy.auto_classify_threshold).toBe(90);
    expect(before.audit).toMatchObject([{ applied_by: userId }]);
    await db.query('UPDATE policy_learning_stats SET accuracy_rate=0.9 WHERE policy_id=$1', [policyId]);
    for (const path of [base, otherBase]) {
        const response = await signedIn(request(app).post(`${path}/${suggestionId}/apply`)).expect(409);
        expect(response.body.code).toBe('SUGGESTION_NOT_PENDING');
    }
    await signedIn(request(app).post(`${base}/${suggestionId}/reject`)).send({ reason: 'Late request' }).expect(409);
    expect(await snapshot()).toEqual(before);
    for (const action of ['apply', 'reject']) {
        await signedIn(request(app).post(`${base}/2147483647/${action}`)).send({ reason: 'Missing' }).expect(404);
    }
});


test.each([
    ['policy destination', 'UPDATE library_policies SET library_id=$2 WHERE id=$1'],
    ['policy threshold', 'UPDATE library_policies SET auto_classify_threshold=91 WHERE id=$1'],
    ['inactive library', 'UPDATE libraries SET is_active=false WHERE id=$1'],
    ['changed library identity', "UPDATE libraries SET external_id='changed' WHERE id=$1"],
    ['deleted evidence', 'DELETE FROM policy_feedback_log WHERE selected_policy_id=$1'],
    ['detached evidence', 'UPDATE policy_feedback_log SET selected_library_id=NULL WHERE selected_policy_id=$1'],
    ['changed scores', `UPDATE policy_feedback_log SET original_scores='{"preset":0}' WHERE selected_policy_id=$1`],
    ['changed metadata', `UPDATE policy_feedback_log SET item_metadata='{"genres":["Different"]}' WHERE selected_policy_id=$1`],
    ['changed configuration', `UPDATE policy_tuning_suggestions SET suggestion_config='{"threshold_type":"auto_classify","recommended":95}' WHERE id=$1`],
    ['changed support', 'UPDATE policy_tuning_suggestions SET supporting_feedback_ids=ARRAY[2147483647] WHERE id=$1'],
])('%s invalidates application without effects', async (kind, sql) => {
    if (kind === 'policy destination') await db.query('DELETE FROM library_policies WHERE id=$1', [otherPolicyId]);
    const id = sql.includes('UPDATE libraries') ? libraryId : sql.includes('UPDATE policy_tuning_suggestions') ? suggestionId : policyId;
    await db.query(sql, sql.includes('$2') ? [id, otherLibraryId] : [id]);
    const before = await snapshot();
    await expect(applySuggestion(suggestionId, userId)).rejects.toMatchObject({ statusCode: 409, code: 'SUGGESTION_EVIDENCE_STALE' });
    expect(await snapshot()).toEqual(before);
});

test.each(['/api/suggestions', '/api/feedback/suggestions'])('%s rejects legacy evidence but permits rejection', async route => {
    await db.query('UPDATE policy_tuning_suggestions SET cohort_fingerprint=NULL,evidence_fingerprint=NULL WHERE id=$1', [suggestionId]);
    const before = await snapshot();
    const response = await signedIn(request(app).post(`${route}/${suggestionId}/apply`));
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('SUGGESTION_EVIDENCE_REQUIRED');
    expect(await snapshot()).toEqual(before);
    await signedIn(request(app).post(`${route}/${suggestionId}/reject`)).send({ reason: 'Dismiss' }).expect(200);
});

test('new feedback and cosmetic edits do not invalidate a frozen cohort', async () => {
    await seedSuggestionFeedback(db, policyId, libraryId, 1);
    await db.query("UPDATE library_policies SET name='Renamed',updated_at=NOW() WHERE id=$1", [policyId]);
    await db.query("UPDATE policy_feedback_log SET title='New title',user_reason_text='New reason' WHERE selected_policy_id=$1", [policyId]);
    await expect(applySuggestion(suggestionId, userId)).resolves.toMatchObject({ success: true });
});

test('unchanged evidence outside the requested rolling window is stale', async () => {
    const manifest = await captureSuggestionCohort(policyId);
    const oldDate = new Date(Date.now() - 31 * 86400000).toISOString();
    await db.query('UPDATE policy_feedback_log SET prompted_at=$1 WHERE selected_policy_id=$2', [oldDate, policyId]);
    manifest.feedback.forEach(row => { row.prompted_at = oldDate; });
    await attachSuggestionCohort(db, suggestionId, manifest);
    await expect(applySuggestion(suggestionId, userId)).rejects.toMatchObject({ code: 'SUGGESTION_EVIDENCE_STALE' });
});

test.each(['libraries', 'original_candidate', 'policy_feedback_log'])('busy %s returns a conflict without effects or supersession', async table => {
    const blocker = await db.connect();
    const before = await snapshot();
    const cohort = await captureSuggestionCohort(policyId);
    try {
        await blocker.query('BEGIN');
        await blocker.query(table !== 'policy_feedback_log' ? 'SELECT id FROM libraries WHERE id=$1 FOR UPDATE'
            : 'SELECT id FROM policy_feedback_log WHERE selected_policy_id=$1 FOR UPDATE',
        [table === 'libraries' ? libraryId : table === 'original_candidate' ? otherLibraryId : policyId]);
        await expect(applySuggestion(suggestionId, userId)).rejects.toMatchObject({ code: 'SUGGESTION_EVIDENCE_BUSY' });
        await expect(storeSuggestions(policyId, [], cohort)).rejects.toMatchObject({ code: 'SUGGESTION_EVIDENCE_BUSY' });
        expect(await snapshot()).toEqual(before);
    } finally { await blocker.query('ROLLBACK'); blocker.release(); }
});

test('normal analysis captures all input and automatically supersedes missing or stale provenance', async () => {
    const first = await feedbackAnalysis.analyzePolicy(policyId);
    expect(first.suggestions.length).toBeGreaterThan(1);
    expect((await snapshot()).suggestion.status).toBe('pending'); // Its original cohort remains current.
    await db.query('UPDATE policy_tuning_suggestions SET cohort_fingerprint=NULL,evidence_fingerprint=NULL WHERE id=$1', [suggestionId]);
    await db.query("UPDATE policy_feedback_log SET original_scores=$2 WHERE selected_policy_id=$1", [policyId, { preset: 60 }]);
    const second = await feedbackAnalysis.analyzePolicy(policyId);
    expect(second.suggestions.length).toBeGreaterThan(0);
    const original = (await snapshot()).suggestion;
    expect(original.status).toBe('superseded');
    expect(original.superseded_at).toBeInstanceOf(Date);
    expect(original.reviewed_at).toBeNull();
    expect(original.applied_at).toBeNull();
    const rows = (await db.query(`SELECT pts.*,c.manifest FROM policy_tuning_suggestions pts
        JOIN policy_tuning_cohorts c ON c.fingerprint=pts.cohort_fingerprint WHERE pts.policy_id=$1 AND pts.status='pending'`, [policyId])).rows;
    expect(new Set(rows.map(row => row.cohort_fingerprint)).size).toBe(1);
    for (const row of rows) {
        expect(row.manifest.feedback).toHaveLength(10);
        if (row.suggestion_type === 'adjust_threshold' || row.suggestion_type === 'adjust_weight') expect(row.supporting_feedback_ids).toHaveLength(10);
    }
    expect(await feedbackAnalysis.analyzePolicy(policyId)).toMatchObject({ suggestions: [] });
});

test('cohorts reject updates and oversized capture fails explicitly', async () => {
    await expect(db.query('UPDATE policy_tuning_cohorts SET manifest=manifest WHERE policy_id=$1', [policyId])).rejects.toMatchObject({ code: '23514' });
    await seedSuggestionFeedback(db, policyId, libraryId, 4991);
    await expect(captureSuggestionCohort(policyId)).rejects.toMatchObject({ code: 'SUGGESTION_COHORT_TOO_LARGE' });
});

test('the cohort migration can be repeated without rewriting existing evidence', async () => {
    const migration = readFileSync(new URL('../../../../database/migrations/20260906_230000_add_suggestion_cohort_provenance.sql', import.meta.url), 'utf8');
    const before = await snapshot();
    const cohorts = (await db.query('SELECT * FROM policy_tuning_cohorts WHERE policy_id=$1', [policyId])).rows;
    await db.query(migration);
    await db.query(migration);
    expect(await snapshot()).toEqual(before);
    expect((await db.query('SELECT * FROM policy_tuning_cohorts WHERE policy_id=$1', [policyId])).rows).toEqual(cohorts);
});

test('evidence share locks protect the validation-to-commit interval', async () => {
    const cohort = await captureSuggestionCohort(policyId);
    const client = await db.connect();
    const writer = await db.connect();
    try {
        await client.query('BEGIN');
        const policy = (await client.query('SELECT * FROM library_policies WHERE id=$1 FOR UPDATE', [policyId])).rows[0];
        await assertSuggestionCohortCurrent(client, cohort, policy);
        await writer.query('BEGIN');
        await writer.query("SET LOCAL lock_timeout='100ms'");
        await expect(writer.query('UPDATE policy_feedback_log SET was_correction=false WHERE selected_policy_id=$1', [policyId])).rejects.toMatchObject({ code: '55P03' });
        await writer.query('ROLLBACK');
        await client.query('COMMIT');
        await expect(writer.query('UPDATE policy_feedback_log SET was_correction=false WHERE selected_policy_id=$1', [policyId])).resolves.toMatchObject({ rowCount: 10 });
    } finally { await client.query('ROLLBACK'); await writer.query('ROLLBACK'); client.release(); writer.release(); }
});

test('v1 analysis cannot be applied even when its feedback and configuration are unchanged', async () => {
    const cohort = await captureSuggestionCohort(policyId);
    cohort.version = 'feedback_suggestions.v1';
    await attachSuggestionCohort(db, suggestionId, cohort);
    const before = await snapshot();
    await expect(applySuggestion(suggestionId, userId)).rejects.toMatchObject({ statusCode: 409, code: 'SUGGESTION_EVIDENCE_STALE' });
    expect(await snapshot()).toEqual(before);
    await expect(rejectSuggestion(suggestionId, userId, 'Obsolete analysis')).resolves.toMatchObject({ success: true });
});

test.each([1, 3])('normal analysis supersedes an inflated v1 pattern supported by %i correction records', async count => {
    const feedback = (await db.query('SELECT id FROM policy_feedback_log WHERE selected_policy_id=$1 ORDER BY id', [policyId])).rows;
    const support = feedback.slice(0, count).map(row => row.id);
    await db.query('UPDATE policy_feedback_log SET was_correction=(id=ANY($2::integer[])),item_metadata=$3, top_suggestion_library_id=CASE WHEN id=ANY($2::integer[]) THEN $4::integer ELSE $5::integer END WHERE selected_policy_id=$1',
        [policyId, support, { genres: ['Action', 'Action', 'Action'] }, otherLibraryId, libraryId]);
    await db.query(`UPDATE policy_tuning_suggestions SET suggestion_type='create_pattern',suggestion_config=$2,
        supporting_feedback_ids=$3,confidence=85 WHERE id=$1`,
    [suggestionId, { pattern_type: 'genre', pattern_value: 'Action', confidence: 90 }, support]);
    const cohort = await captureSuggestionCohort(policyId);
    cohort.version = 'feedback_suggestions.v1';
    await attachSuggestionCohort(db, suggestionId, cohort);
    const before = (await snapshot()).suggestion;
    const first = await feedbackAnalysis.analyzePolicy(policyId);
    const original = (await snapshot()).suggestion;
    expect(original).toEqual({ ...before, status: 'superseded', superseded_at: expect.any(Date) });
    const replacements = first.suggestions.filter(row => row.suggestion_type === 'create_pattern');
    if (count === 1) {
        expect(replacements).toEqual([]);
    } else {
        expect(replacements).toHaveLength(1);
        expect(replacements[0]).toMatchObject({ suggestion_config: { confidence: 60 }, confidence: 45 });
        await expect(applySuggestion(replacements[0].id, userId)).resolves.toMatchObject({ success: true });
        expect((await db.query('SELECT confidence,library_name FROM discovered_patterns WHERE library_id=$1', [libraryId])).rows).toEqual([{ confidence: '60.00', library_name: 'Lifecycle' }]);
    }
    expect((await db.query('SELECT manifest FROM policy_tuning_cohorts WHERE fingerprint=$1', [before.cohort_fingerprint])).rows[0].manifest).toEqual(cohort);
});

test.each(['applied', 'rejected'])('analysis preserves existing %s v1 history', async status => {
    const cohort = await captureSuggestionCohort(policyId);
    cohort.version = 'feedback_suggestions.v1';
    await attachSuggestionCohort(db, suggestionId, cohort);
    await db.query('UPDATE policy_tuning_suggestions SET status=$1,reviewed_at=NOW(),reviewed_by=$2 WHERE id=$3', [status, userId, suggestionId]);
    const before = (await snapshot()).suggestion;
    await feedbackAnalysis.analyzePolicy(policyId);
    expect((await snapshot()).suggestion).toEqual(before);
});


test.each([false, true])('failed pattern audit rolls back the %s existing-pattern branch', async existing => {
    await db.query(`UPDATE policy_tuning_suggestions SET suggestion_type='create_pattern',suggestion_config=$2 WHERE id=$1`,
        [suggestionId, { pattern_type: 'genre', pattern_value: 'Action', confidence: 60 }]);
    await attachSuggestionCohort(db, suggestionId, await captureSuggestionCohort(policyId));
    if (existing) await db.query(`INSERT INTO discovered_patterns(pattern_type,pattern_value,library_id,library_name,confidence,status)
        VALUES('genre','Action',$1,'Previous name',75,'discovered')`, [libraryId]);
    const before = await snapshot();
    const patternsBefore = (await db.query('SELECT * FROM discovered_patterns WHERE library_id=$1', [libraryId])).rows;
    await db.query("ALTER TABLE policy_change_log ADD CONSTRAINT metadata_votes_fixture_failure CHECK(change_type <> 'create_pattern') NOT VALID");
    try {
        await expect(applySuggestion(suggestionId, userId)).rejects.toThrow(/metadata_votes_fixture_failure/);
        expect(await snapshot()).toEqual(before);
        expect((await db.query('SELECT * FROM discovered_patterns WHERE library_id=$1', [libraryId])).rows).toEqual(patternsBefore);
    } finally { await db.query('ALTER TABLE policy_change_log DROP CONSTRAINT metadata_votes_fixture_failure'); }
    await expect(applySuggestion(suggestionId, userId)).resolves.toMatchObject({ success: true });
    expect((await db.query('SELECT confidence,library_name,status FROM discovered_patterns WHERE library_id=$1', [libraryId])).rows)
        .toEqual([{ confidence: existing ? '75.00' : '60.00', library_name: 'Lifecycle', status: 'approved' }]);
    expect((await snapshot()).audit).toHaveLength(1);
});


test('v2 evidence must be regenerated before application', async () => {
    const cohort = await captureSuggestionCohort(policyId);
    cohort.version = 'feedback_suggestions.v2';
    await attachSuggestionCohort(db, suggestionId, cohort);
    await expect(applySuggestion(suggestionId, userId)).rejects.toMatchObject({ code: 'SUGGESTION_EVIDENCE_STALE' });
    await feedbackAnalysis.analyzePolicy(policyId);
    expect((await snapshot()).suggestion.status).toBe('superseded');
});

test('original candidate deactivation invalidates frozen evidence without changing its history', async () => {
    const before = await snapshot();
    await db.query('UPDATE libraries SET is_active=FALSE WHERE id=$1', [otherLibraryId]);
    await expect(applySuggestion(suggestionId, userId)).rejects.toMatchObject({ code: 'SUGGESTION_EVIDENCE_STALE' });
    expect(await snapshot()).toEqual(before);
});
