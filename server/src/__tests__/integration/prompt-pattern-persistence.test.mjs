/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, beforeEach, afterEach, test, expect } from '@jest/globals';
import request from 'supertest';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';
import { createMountedTestApp } from '../helpers/setupRouteTest.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());
const { router } = await import('../../routes/prompts.mjs');
const app = createMountedTestApp({ basePath: '/api/prompts', router });
let db, libraryId, otherLibraryId, policyId, otherPolicyId, classificationId;

beforeEach(async () => {
    db = getPool();
    [libraryId, otherLibraryId] = (await db.query(`INSERT INTO libraries(name,external_id,media_type)
        VALUES('Prompt movies','prompt-primary','movie'),('Other movies','prompt-other','movie') RETURNING id`)).rows.map(row => row.id);
    [policyId, otherPolicyId] = (await db.query(`INSERT INTO library_policies(library_id,name)
        VALUES($1,'Prompt policy'),($2,'Other policy') RETURNING id`, [libraryId, otherLibraryId])).rows.map(row => row.id);
    classificationId = (await db.query(`INSERT INTO classification_history(tmdb_id,media_type,title,metadata,confidence,status,method,pending_reason)
        VALUES(603,'movie','Prompt fixture',$1,65,'pending','policy_prompt','low_confidence') RETURNING id`,
    [JSON.stringify({ genres: ['Action'], classification_details: {
        ranked_candidates: [{ library_id: otherLibraryId, library_name: 'Other movies', policy_id: otherPolicyId, score: 65 }],
        scores: { preset: 65 },
    } })])).rows[0].id;
});

afterEach(async () => {
    await db.query('DELETE FROM policy_feedback_log WHERE selected_library_id=ANY($1::integer[])', [[libraryId, otherLibraryId]]);
    await db.query('DELETE FROM classification_history WHERE title=$1', ['Prompt fixture']);
    await db.query('DELETE FROM library_policies WHERE id=ANY($1::integer[])', [[policyId, otherPolicyId]]);
    await db.query('DELETE FROM libraries WHERE id=ANY($1::integer[])', [[libraryId, otherLibraryId]]);
});

const action = (value = 'Fixture Studio', targetLibraryId = libraryId) => ({ type: 'studio', value, targetLibraryId });
const submit = (body = {}, id = classificationId) => request(app).post(`/api/prompts/${id}/respond`)
    .send({ selectedLibraryId: libraryId, selectedPolicyId: policyId, patternActions: [action()], ...body });
async function snapshot() {
    return {
        classifications: (await db.query('SELECT * FROM classification_history WHERE title=$1 ORDER BY id', ['Prompt fixture'])).rows,
        feedback: (await db.query('SELECT * FROM policy_feedback_log ORDER BY id')).rows,
        patterns: (await db.query('SELECT * FROM discovered_patterns ORDER BY id')).rows,
        stats: (await db.query('SELECT * FROM policy_learning_stats ORDER BY policy_id')).rows,
    };
}

test('reads list, batch and detail against the current schema', async () => {
    const pending = await request(app).get('/api/prompts/pending');
    expect(pending.status).toBe(200);
    expect(pending.body.data.items[0].classification_method).toBe('policy_prompt');
    const batch = await request(app).get('/api/prompts/batch');
    expect(batch.status).toBe(200);
    const detail = await request(app).get(`/api/prompts/${classificationId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.prompt.topSuggestion).toMatchObject({ libraryId: otherLibraryId, score: 65 });
});

test('commits distinct actions with correct feedback, classification and learning statistics', async () => {
    const response = await submit({ patternActions: [action(), action(), action('Other Studio', otherLibraryId)] });
    expect(response.status).toBe(200);
    expect(response.body.data.patternsCreated).toBe(2);
    const state = await snapshot();
    expect(state.patterns).toHaveLength(2);
    expect(state.patterns[0]).toMatchObject({ library_id: libraryId, library_name: 'Prompt movies', confidence: '75.00', status: 'approved' });
    expect(state.patterns[1].library_name).toBe('Other movies');
    expect(state.feedback).toHaveLength(1);
    expect(state.feedback[0]).toMatchObject({ id: response.body.data.feedbackId, was_correction: true,
        original_scores: { preset: 65 }, patterns_created: [action(), action('Other Studio', otherLibraryId)] });
    expect(state.classifications[0]).toMatchObject({ status: 'completed', library_id: libraryId, library_name: 'Prompt movies', confidence: '65.00', pending_reason: null });
    expect(state.classifications[0].metadata.genres).toEqual(['Action']);
    expect(state.stats[0]).toMatchObject({ total_decisions: 1, user_corrections: 1 });
});

test('counts an existing-pattern upsert once and preserves higher confidence', async () => {
    await db.query(`INSERT INTO discovered_patterns(pattern_type,pattern_value,library_id,library_name,confidence,status)
        VALUES('studio','Fixture Studio',$1,'Old name',90,'discovered')`, [libraryId]);
    const response = await submit({ selectedLibraryId: String(libraryId), patternActions: [action(), action()] });
    expect(response.status).toBe(200);
    expect(response.body.data.patternsCreated).toBe(1);
    const state = await snapshot();
    expect(state.patterns).toHaveLength(1);
    expect(state.patterns[0]).toMatchObject({ library_name: 'Prompt movies', confidence: '90.00', status: 'approved' });
});

test('supports feedback without a policy or pattern action', async () => {
    const response = await submit({ selectedLibraryId: otherLibraryId, selectedPolicyId: null, patternActions: [] });
    expect(response.status).toBe(200);
    expect(response.body.data.patternsCreated).toBe(0);
    const state = await snapshot();
    expect(state.feedback[0]).toMatchObject({ was_correction: false, patterns_created: [], selected_policy_id: null });
    expect(state.stats).toEqual([]);
});

test.each(['discovered_patterns', 'policy_feedback_log', 'policy_learning_stats', 'classification_history'])(
    '%s failure rolls back every write and allows a clean retry', async table => {
        // Static test-only table allowlist; each suite owns its disposable database.
        const before = await snapshot();
        await db.query(`ALTER TABLE ${table} ADD CONSTRAINT prompt_fixture_reject CHECK (FALSE) NOT VALID`);
        try {
            expect((await submit()).status).toBe(500);
            expect(await snapshot()).toEqual(before);
        } finally {
            await db.query(`ALTER TABLE ${table} DROP CONSTRAINT prompt_fixture_reject`);
        }
        expect((await submit()).status).toBe(200);
        expect((await snapshot()).feedback).toHaveLength(1);
    });

test('later failure rolls back an existing pattern update and a preceding new pattern', async () => {
    await db.query(`INSERT INTO discovered_patterns(pattern_type,pattern_value,library_id,library_name,confidence,status)
        VALUES('studio','Fixture Studio',$1,'Old name',50,'discovered')`, [libraryId]);
    const before = await snapshot();
    await db.query('ALTER TABLE policy_feedback_log ADD CONSTRAINT prompt_fixture_reject CHECK (FALSE) NOT VALID');
    try {
        expect((await submit({ patternActions: [action('New Studio'), action()] })).status).toBe(500);
        expect(await snapshot()).toEqual(before);
    } finally {
        await db.query('ALTER TABLE policy_feedback_log DROP CONSTRAINT prompt_fixture_reject');
    }
});

test('commit-time failure never returns success or leaves feedback behind', async () => {
    const before = await snapshot();
    await db.query(`CREATE FUNCTION prompt_fixture_commit_failure() RETURNS trigger LANGUAGE plpgsql AS
        $$ BEGIN RAISE EXCEPTION 'fixture commit failure'; END $$`);
    await db.query(`CREATE CONSTRAINT TRIGGER prompt_fixture_commit_failure AFTER INSERT ON policy_feedback_log
        DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION prompt_fixture_commit_failure()`);
    try {
        expect((await submit()).status).toBe(500);
        expect(await snapshot()).toEqual(before);
    } finally {
        await db.query('DROP TRIGGER prompt_fixture_commit_failure ON policy_feedback_log');
        await db.query('DROP FUNCTION prompt_fixture_commit_failure()');
    }
});

test.each(['missing', 'inactive', 'wrong_media', 'wrong_policy', 'bad_action'])(
    'rejects %s destinations/input without writes', async mode => {
        const body = {};
        if (mode === 'missing') body.patternActions = [action('Missing', 2147483647)];
        if (mode === 'inactive') await db.query('UPDATE libraries SET is_active=FALSE WHERE id=$1', [libraryId]);
        if (mode === 'wrong_media') await db.query("UPDATE libraries SET media_type='tv' WHERE id=$1", [libraryId]);
        if (mode === 'wrong_policy') body.selectedPolicyId = otherPolicyId;
        if (mode === 'bad_action') body.patternActions = [action(), null];
        const before = await snapshot();
        expect((await submit(body)).status).toBe(400);
        expect(await snapshot()).toEqual(before);
    });

test('missing classification returns 404', async () => {
    const before = await snapshot();
    expect((await submit({}, 2147483647)).status).toBe(404);
    expect(await snapshot()).toEqual(before);
});

test.each(['completed', 'awaiting_decision', 'failed'])('rejects %s records as outside the pending prompt lifecycle', async status => {
    await db.query('UPDATE classification_history SET status=$1,library_id=$2 WHERE id=$3', [status, libraryId, classificationId]);
    const before = await snapshot();
    const response = await submit();
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('PROMPT_NOT_PENDING');
    expect(await snapshot()).toEqual(before);
});

test('concurrent responses commit exactly one feedback event and replay cannot overwrite it', async () => {
    const results = await Promise.all([submit(), submit({ selectedLibraryId: otherLibraryId, selectedPolicyId: otherPolicyId })]);
    expect(results.map(result => result.status).sort()).toEqual([200, 409]);
    const before = await snapshot();
    expect(before.feedback).toHaveLength(1);
    expect((await submit()).status).toBe(409);
    expect(await snapshot()).toEqual(before);
});

test('legacy pattern actions cannot change a native-intent policy', async () => {
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const intent = (await client.query(`INSERT INTO policy_intents(policy_id,library_id,intent_version,source,inference_state,review_behavior,validation_status)
            VALUES($1,$2,1,'native_intent','inferred','{}','valid') RETURNING id`, [policyId, libraryId])).rows[0];
        await client.query(`INSERT INTO policy_intent_rules(intent_id,intent_role,collection,signal_type,operator,values,inference_state)
            VALUES($1,'purpose','purpose','genres','require_any','{"require_any":["Animation"]}','inferred')`, [intent.id]);
        await client.query('COMMIT');
    } finally { await client.query('ROLLBACK'); client.release(); }
    const before = await snapshot();
    const response = await submit();
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('POLICY_NATIVE_INTENT_LEGACY_WRITE_BLOCKED');
    expect(await snapshot()).toEqual(before);
    expect((await submit({ patternActions: [] })).status).toBe(200);
});

test.each([true, false])('independent prompts preserve both votes and avoid reversed pattern lock order (policy=%s)', async withPolicy => {
    const secondId = (await db.query(`INSERT INTO classification_history(tmdb_id,media_type,title,metadata,status)
        VALUES(604,'movie','Prompt fixture','{}','pending') RETURNING id`)).rows[0].id;
    if (!withPolicy) await db.query('DELETE FROM library_policies WHERE id=ANY($1::integer[])', [[policyId, otherPolicyId]]);
    const selectedPolicyId = withPolicy ? policyId : null;
    const results = await Promise.all([
        submit({ selectedPolicyId, patternActions: [action('A'), action('Z')] }),
        submit({ selectedPolicyId, patternActions: [action('Z'), action('A')] }, secondId),
    ]);
    expect(results.map(result => result.status)).toEqual([200, 200]);
    const state = await snapshot();
    expect(state.feedback).toHaveLength(2);
    expect(state.patterns).toHaveLength(2);
    if (withPolicy) expect(state.stats[0].total_decisions).toBe(2);
    else expect(state.stats).toEqual([]);
});
