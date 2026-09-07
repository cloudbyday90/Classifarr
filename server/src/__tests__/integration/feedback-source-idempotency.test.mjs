/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, beforeEach, afterEach, test, expect } from '@jest/globals';
import request from 'supertest';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';
import { createMountedTestApp } from '../helpers/setupRouteTest.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());
const { router } = await import('../../routes/feedback.mjs');
const { router: prompts } = await import('../../routes/prompts.mjs');
const app = createMountedTestApp({ basePath: '/feedback', router });
const promptApp = createMountedTestApp({ basePath: '/prompts', router: prompts });
let db, libraryId, originalId, policyId, otherPolicyId, classificationId;

beforeEach(async () => {
    db = getPool();
    [libraryId, originalId] = (await db.query(`INSERT INTO libraries(name,external_id,media_type)
        VALUES('Selected','source-selected','movie'),('Original','source-original','movie') RETURNING id`)).rows.map(row => row.id);
    [policyId, otherPolicyId] = (await db.query(`INSERT INTO library_policies(library_id,name)
        VALUES($1,'Selected policy'),($2,'Original policy') RETURNING id`, [libraryId, originalId])).rows.map(row => row.id);
    classificationId = (await db.query(`INSERT INTO classification_history(tmdb_id,media_type,title,metadata,status,method,library_id,created_at)
        VALUES(603,'movie','Feedback source fixture',$1,'completed','policy_auto',$2,NOW()-INTERVAL '1 day') RETURNING id`,
    [JSON.stringify({ genres: ['Action'], classification_details: { ranked_candidates: [{ library_id: originalId, score: 75 }], scores: { preset: 75 } } }), originalId])).rows[0].id;
});
afterEach(async () => {
    await db.query('DELETE FROM policy_feedback_sources');
    await db.query('DELETE FROM policy_feedback_log');
    await db.query("DELETE FROM classification_history WHERE title='Feedback source fixture'");
    await db.query('DELETE FROM library_policies WHERE id=ANY($1::integer[])', [[policyId, otherPolicyId]]);
    await db.query('DELETE FROM libraries WHERE id=ANY($1::integer[])', [[libraryId, originalId]]);
});

const submit = (body = {}) => request(app).post('/feedback').send({ classification_id: classificationId,
    selected_library_id: libraryId, selected_policy_id: policyId, ...body });
const prompt = () => request(promptApp).post(`/prompts/${classificationId}/respond`).send({ selectedLibraryId: libraryId,
    selectedPolicyId: policyId, patternActions: [] });
async function state() {
    return {
        feedback: (await db.query('SELECT * FROM policy_feedback_log ORDER BY id')).rows,
        receipts: (await db.query('SELECT * FROM policy_feedback_sources ORDER BY classification_id')).rows,
        stats: (await db.query('SELECT * FROM policy_learning_stats ORDER BY policy_id')).rows,
        history: (await db.query("SELECT * FROM classification_history WHERE title='Feedback source fixture' ORDER BY id")).rows,
    };
}

test('derives evidence from history and replays normalized input without another write', async () => {
    const before = await state();
    const first = await submit({ user_reason: ' Selection ' });
    expect(first.status).toBe(201);
    expect(first.body.replayed).toBe(false);
    const saved = await state();
    expect(saved.feedback).toHaveLength(1);
    expect(saved.feedback[0]).toMatchObject({ id: first.body.feedbackId, tmdb_id: 603, title: 'Feedback source fixture',
        was_correction: true, top_suggestion_library_id: originalId, top_suggestion_score: 75,
        original_scores: { preset: 75 }, user_reason: 'Selection', prompt_type: 'auto_classify' });
    expect(saved.receipts[0]).toMatchObject({ classification_id: classificationId, feedback_id: first.body.feedbackId, intake: 'standalone' });
    expect(saved.stats[0].total_decisions).toBe(1);
    expect(saved.history).toEqual(before.history);
    const second = await submit({ classification_id: String(classificationId), user_reason: 'Selection' });
    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({ feedbackId: first.body.feedbackId, replayed: true });
    expect(await state()).toEqual(saved);
});

test('concurrent identical requests create one vote and return one result', async () => {
    const results = await Promise.all(Array.from({ length: 6 }, () => submit()));
    expect(results.map(result => result.status).sort()).toEqual([200, 200, 200, 200, 200, 201]);
    expect(new Set(results.map(result => result.body.feedbackId)).size).toBe(1);
    const saved = await state();
    expect(saved.feedback).toHaveLength(1);
    expect(saved.receipts).toHaveLength(1);
    expect(saved.stats[0].total_decisions).toBe(1);
});

test('bigint source identifiers above JavaScript safe integers keep exact identity', async () => {
    const sourceId = '9223372036854775807';
    await db.query('UPDATE classification_history SET id=$1 WHERE id=$2', [sourceId, classificationId]);
    const first = await submit({ classification_id: sourceId });
    expect(first.status).toBe(201);
    expect((await state()).receipts[0].classification_id).toBe(sourceId);
    expect((await submit({ classification_id: sourceId })).body).toMatchObject({ feedbackId: first.body.feedbackId, replayed: true });
});

test('concurrent conflicting selections across policies cannot create a second vote', async () => {
    const results = await Promise.all([submit(), submit({ selected_library_id: originalId, selected_policy_id: otherPolicyId })]);
    expect(results.map(result => result.status).sort()).toEqual([201, 409]);
    expect((await state()).feedback).toHaveLength(1);
});

test.each([{ user_reason: 'changed' }, { user_reason_text: 'changed' }])('conflicting replay %j preserves the original', async change => {
    expect((await submit()).status).toBe(201);
    const saved = await state();
    const response = await submit(change);
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('FEEDBACK_SOURCE_CONFLICT');
    expect(await state()).toEqual(saved);
});

test.each(['policy_feedback_log', 'policy_learning_stats', 'policy_feedback_sources'])('%s failure rolls back the complete intake', async table => {
    const before = await state();
    await db.query(`ALTER TABLE ${table} ADD CONSTRAINT source_fixture_reject CHECK(FALSE) NOT VALID`);
    try {
        expect((await submit()).status).toBe(500);
        expect(await state()).toEqual(before);
    } finally { await db.query(`ALTER TABLE ${table} DROP CONSTRAINT source_fixture_reject`); }
    expect((await submit()).status).toBe(201);
});

test('caller-supplied candidate evidence is rejected before any write', async () => {
    const before = await state();
    expect((await submit({ top_suggestion_library_id: libraryId, was_correction: false, item_metadata: { genres: ['Forged'] } })).status).toBe(400);
    expect(await state()).toEqual(before);
});

test.each([null, true, 'bad'])('missing or malformed original candidate %j remains unknown', async candidate => {
    await db.query('UPDATE classification_history SET metadata=$1 WHERE id=$2',
        [JSON.stringify({ classification_details: { ranked_candidates: [{ library_id: candidate }] } }), classificationId]);
    expect((await submit()).status).toBe(201);
    expect((await state()).feedback[0]).toMatchObject({ top_suggestion_library_id: null, was_correction: null });
    expect((await state()).stats[0].accuracy_rate).toBeNull();
});

test.each(['pending', 'awaiting_decision', 'failed', 'pending_retry', 'reclassified'])('source state %s cannot bypass its workflow', async status => {
    await db.query('UPDATE classification_history SET status=$1 WHERE id=$2', [status, classificationId]);
    expect((await submit()).status).toBe(409);
    expect((await state()).feedback).toEqual([]);
});

test.each([null, 'infinity', '-infinity', '2999-01-01'])('invalid source time %s is not replaced with now', async time => {
    await db.query('UPDATE classification_history SET created_at=$1 WHERE id=$2', [time, classificationId]);
    expect((await submit()).status).toBe(409);
    expect((await state()).feedback).toEqual([]);
});

test('validates source existence and current policy/library compatibility', async () => {
    expect((await submit({ classification_id: '9223372036854775807' })).status).toBe(404);
    expect((await submit({ selected_policy_id: otherPolicyId })).status).toBe(400);
    await db.query('UPDATE libraries SET is_active=FALSE WHERE id=$1', [libraryId]);
    expect((await submit()).status).toBe(400);
    await db.query("UPDATE libraries SET is_active=TRUE,media_type='tv' WHERE id=$1", [libraryId]);
    expect((await submit()).status).toBe(400);
    expect((await state()).receipts).toEqual([]);
});

test('history retention and later metadata/library changes do not reinterpret a committed replay', async () => {
    const first = await submit();
    expect(first.status).toBe(201);
    await db.query('UPDATE libraries SET is_active=FALSE WHERE id=$1', [libraryId]);
    await db.query('DELETE FROM classification_history WHERE id=$1', [classificationId]);
    const saved = await state();
    const replay = await submit();
    expect(replay.status).toBe(200);
    expect(replay.body.feedbackId).toBe(first.body.feedbackId);
    expect(await state()).toEqual(saved);
});

test('feedback deletion keeps a tombstone and cannot recreate the vote', async () => {
    expect((await submit()).status).toBe(201);
    await db.query('DELETE FROM policy_feedback_log');
    const saved = await state();
    expect(saved.receipts[0].feedback_id).toBeNull();
    const replay = await submit();
    expect(replay.status).toBe(409);
    expect(replay.body.code).toBe('FEEDBACK_RESULT_UNAVAILABLE');
    expect(await state()).toEqual(saved);
});

test('prompt responses bind the same event and block standalone or reopened prompt duplication', async () => {
    await db.query("UPDATE classification_history SET status='pending' WHERE id=$1", [classificationId]);
    expect((await prompt()).status).toBe(200);
    const saved = await state();
    expect(saved.receipts[0].intake).toBe('prompt');
    expect((await submit()).status).toBe(409);
    expect(await state()).toEqual(saved);
    await db.query("UPDATE classification_history SET status='pending' WHERE id=$1", [classificationId]);
    expect((await prompt()).status).toBe(409);
    expect((await state()).feedback).toHaveLength(1);
});

test('receipt failure rolls back prompt effects and permits a clean retry', async () => {
    await db.query("UPDATE classification_history SET status='pending' WHERE id=$1", [classificationId]);
    const before = await state();
    await db.query('ALTER TABLE policy_feedback_sources ADD CONSTRAINT source_prompt_reject CHECK(FALSE) NOT VALID');
    try {
        expect((await prompt()).status).toBe(500);
        expect(await state()).toEqual(before);
    } finally { await db.query('ALTER TABLE policy_feedback_sources DROP CONSTRAINT source_prompt_reject'); }
    expect((await prompt()).status).toBe(200);
});

test('a pending prompt raced with standalone intake creates at most its one receipt', async () => {
    await db.query("UPDATE classification_history SET status='pending' WHERE id=$1", [classificationId]);
    const [fromPrompt, standalone] = await Promise.all([prompt(), submit()]);
    expect(fromPrompt.status).toBe(200);
    expect(standalone.status).toBe(409);
    expect((await state()).feedback).toHaveLength(1);
    expect((await state()).receipts).toHaveLength(1);
});

test('distinct source events for the same media retain distinct observations', async () => {
    expect((await submit()).status).toBe(201);
    const second = (await db.query(`INSERT INTO classification_history(tmdb_id,media_type,title,metadata,status,library_id,created_at)
        SELECT tmdb_id,media_type,title,metadata,status,library_id,created_at FROM classification_history WHERE id=$1 RETURNING id`, [classificationId])).rows[0].id;
    expect((await submit({ classification_id: second })).status).toBe(201);
    expect((await state()).feedback).toHaveLength(2);
    expect((await state()).stats[0].total_decisions).toBe(2);
});
