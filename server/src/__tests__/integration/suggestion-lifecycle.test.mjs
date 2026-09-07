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
    await seedSuggestionFeedback(db, policyId, libraryId);
    await attachSuggestionCohort(db, suggestionId, await captureSuggestionCohort(policyId));
});
afterEach(async () => {
    await db.query('DELETE FROM policy_feedback_log WHERE selected_policy_id=ANY($1::integer[])', [[policyId, otherPolicyId]]);
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
    const response = await request(app).post(`${route}/${suggestionId}/apply`);
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('SUGGESTION_EVIDENCE_REQUIRED');
    expect(await snapshot()).toEqual(before);
    expect((await request(app).post(`${route}/${suggestionId}/reject`).send({ reason: 'Dismiss' })).status).toBe(200);
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

test.each(['libraries', 'policy_feedback_log'])('busy %s returns a conflict without effects or supersession', async table => {
    const blocker = await db.connect();
    const before = await snapshot();
    const cohort = await captureSuggestionCohort(policyId);
    try {
        await blocker.query('BEGIN');
        await blocker.query(table === 'libraries' ? 'SELECT id FROM libraries WHERE id=$1 FOR UPDATE'
            : 'SELECT id FROM policy_feedback_log WHERE selected_policy_id=$1 FOR UPDATE', [table === 'libraries' ? libraryId : policyId]);
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
    await db.query('UPDATE policy_feedback_log SET was_correction=(id=ANY($2::integer[])),item_metadata=$3 WHERE selected_policy_id=$1',
        [policyId, support, { genres: ['Action', 'Action', 'Action'] }]);
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
