/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, beforeEach, afterEach, test, expect } from '@jest/globals';
import { seedSuggestionFeedback, attachSuggestionCohort } from '../helpers/suggestionCohortFixture.mjs';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';

let beginRepeatableRead = false;
jest.unstable_mockModule('../../config/database.mjs', () => {
    const module = createIntegrationDatabaseModuleMock();
    return { ...module, withTransaction: fn => module.withTransaction(async client => {
        if (beginRepeatableRead) await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
        return fn(client);
    }) };
});
const { captureSuggestionCohort } = await import('../../services/feedbackAnalysisCohort.mjs');
const { storeSuggestions: persistSuggestions } = await import('../../services/feedbackAnalysisSuggestionStore.mjs');
let db, libraryId, otherLibraryId, policyId, otherPolicyId, feedbackIds, cohorts;
const storeSuggestions = (id, entries) => persistSuggestions(id, entries.map(entry => ({ ...entry,
    supporting_feedback: id === otherPolicyId ? cohorts.get(id).feedback.slice(0, 3).map(row => row.id) : entry.supporting_feedback,
})), cohorts.get(id));

beforeEach(async () => {
    db = getPool();
    beginRepeatableRead = false;
    [libraryId, otherLibraryId] = (await db.query(`INSERT INTO libraries(name,external_id,media_type)
        VALUES('Deduplication','deduplication-fixture','movie'),('Other','deduplication-other','movie') RETURNING id`)).rows.map(row => row.id);
    [policyId, otherPolicyId] = (await db.query(`INSERT INTO library_policies(library_id,name,auto_classify_threshold,prompt_threshold)
        VALUES($1,'Primary policy',85,60),($2,'Other policy',80,55) RETURNING id`, [libraryId, otherLibraryId])).rows.map(row => row.id);
    feedbackIds = await seedSuggestionFeedback(db, policyId, libraryId);
    await seedSuggestionFeedback(db, otherPolicyId, otherLibraryId);
    cohorts = new Map([[policyId, await captureSuggestionCohort(policyId)], [otherPolicyId, await captureSuggestionCohort(otherPolicyId)]]);
});

afterEach(async () => {
    await db.query('DELETE FROM policy_feedback_log WHERE selected_policy_id=ANY($1::integer[])', [[policyId, otherPolicyId]]);
    await db.query('DELETE FROM library_policies WHERE id=ANY($1::integer[])', [[policyId, otherPolicyId]]);
    await db.query('DELETE FROM libraries WHERE id=ANY($1::integer[])', [[libraryId, otherLibraryId]]);
});

function suggestion(config = { pattern_type: 'genre', pattern_value: 'Action', confidence: 60 }, extra = {}) {
    return { type: 'create_pattern', config, supporting_feedback: feedbackIds.slice(0, 3), confidence: 45, impact_estimate: 'Fixture', ...extra };
}
async function storedRows() {
    return (await db.query('SELECT * FROM policy_tuning_suggestions WHERE policy_id=$1 ORDER BY id', [policyId])).rows;
}

test('nested object key order and repeat submissions produce one pending record without overwriting support', async () => {
    const first = suggestion({ pattern_type: 'genre', pattern_value: 'Action', nested: { a: 1, b: 2 } });
    const duplicate = suggestion({ nested: { b: 2, a: 1 }, pattern_value: 'Action', pattern_type: 'genre' },
        { supporting_feedback: [feedbackIds[8]], confidence: 90, impact_estimate: 'Later input' });
    expect(await storeSuggestions(policyId, [first, duplicate])).toHaveLength(1);
    const before = await storedRows();
    expect(await storeSuggestions(policyId, [duplicate])).toEqual([]);
    expect(await storedRows()).toEqual(before);
    expect(before[0].supporting_feedback_ids).toEqual(feedbackIds.slice(0, 3));
});

test('JSON numeric scale is compared structurally even when JSONB text differs', async () => {
    await db.query(`INSERT INTO policy_tuning_suggestions(policy_id,suggestion_type,suggestion_config,status)
        VALUES($1,'create_pattern','{"confidence":60.00,"pattern_value":"Action"}','pending')`, [policyId]);
    await attachSuggestionCohort(db, (await storedRows())[0].id, cohorts.get(policyId));
    expect(await storeSuggestions(policyId, [suggestion({ pattern_value: 'Action', confidence: 60 })])).toEqual([]);
    expect(await storedRows()).toHaveLength(1);
});

test('different configurations, array order, missing/null members, types and policies stay distinct', async () => {
    const configs = [{ values: [1, 2] }, { values: [2, 1] }, { values: [1, 2], extra: null }, { values: [1, 2, 3] }];
    expect(await storeSuggestions(policyId, configs.map(config => suggestion(config)))).toHaveLength(4);
    expect(await storeSuggestions(policyId, [suggestion(configs[0], { type: 'adjust_threshold' })])).toHaveLength(1);
    expect(await storeSuggestions(otherPolicyId, [suggestion(configs[0])])).toHaveLength(1);
    expect(await storeSuggestions(policyId, configs.map(config => suggestion(config)))).toEqual([]);
});

test.each(['applied', 'rejected'])('%s history is preserved and does not suppress a new pending record', async status => {
    const [first] = await storeSuggestions(policyId, [suggestion()]);
    await db.query('UPDATE policy_tuning_suggestions SET status=$1 WHERE id=$2', [status, first.id]);
    const before = (await storedRows())[0];
    expect(await storeSuggestions(policyId, [suggestion()])).toHaveLength(1);
    expect((await storedRows())[0]).toEqual(before);
    expect(await storeSuggestions(policyId, [suggestion()])).toEqual([]);
});

test('existing duplicate records remain intact and block further duplicates', async () => {
    const config = suggestion().config;
    await db.query(`INSERT INTO policy_tuning_suggestions(policy_id,suggestion_type,suggestion_config,supporting_feedback_ids)
        SELECT $1,'create_pattern',$2,ARRAY[n] FROM generate_series(1,2) n`, [policyId, config]);
    for (const row of await storedRows()) {
        await db.query('UPDATE policy_tuning_suggestions SET supporting_feedback_ids=$1 WHERE id=$2', [feedbackIds.slice(0, 3), row.id]);
        await attachSuggestionCohort(db, row.id, cohorts.get(policyId));
    }
    const before = await storedRows();
    expect(await storeSuggestions(policyId, [suggestion()])).toEqual([]);
    expect(await storedRows()).toEqual(before);
});

test('large metadata-derived configurations are accepted and deduplicated', async () => {
    const value = Array.from({ length: 1000 }, (_, i) => `metadata-${i}-value`).join('|');
    const entry = suggestion({ pattern_type: 'keyword', pattern_value: value });
    expect(await storeSuggestions(policyId, [entry])).toHaveLength(1);
    expect(await storeSuggestions(policyId, [entry])).toEqual([]);
});

test('a failed batch rolls back its earlier inserts and subsequent storage can acquire the lock', async () => {
    const invalid = suggestion({ pattern_value: 'Invalid' }, { impact_estimate: 'x'.repeat(101) });
    await expect(storeSuggestions(policyId, [suggestion(), invalid])).rejects.toThrow(/value too long/);
    expect(await storedRows()).toEqual([]);
    expect(await storeSuggestions(policyId, [suggestion()])).toHaveLength(1);
});

test('missing policies fail without orphan suggestions', async () => {
    await expect(storeSuggestions(2147483647, [suggestion()])).rejects.toThrow('Policy not found');
    expect(await storedRows()).toEqual([]);
});

test('concurrent stores serialize and read committed inserts after the lock wait even from Repeatable Read', async () => {
    beginRepeatableRead = true;
    const blocker = await db.connect();
    let pending;
    try {
        await blocker.query('BEGIN');
        await blocker.query('SELECT id FROM library_policies WHERE id=$1 FOR NO KEY UPDATE', [policyId]);
        pending = Promise.allSettled(Array.from({ length: 3 }, () => storeSuggestions(policyId, [suggestion()])));
        let waiting = 0;
        for (let attempt = 0; attempt < 100 && waiting < 3; attempt++) {
            waiting = (await db.query(`SELECT count(*)::integer count FROM pg_stat_activity
                WHERE datname=current_database() AND wait_event_type='Lock'
                    AND query LIKE '%FOR NO KEY UPDATE%' AND cardinality(pg_blocking_pids(pid))>0`)).rows[0].count;
            if (waiting < 3) await new Promise(resolve => { setTimeout(resolve, 20); });
        }
        expect(waiting).toBe(3);
        // Another policy remains writable while all three stores are blocked.
        expect(await storeSuggestions(otherPolicyId, [suggestion()])).toHaveLength(1);
        await blocker.query('COMMIT');
        const results = await pending;
        expect(results.every(result => result.status === 'fulfilled')).toBe(true);
        expect(results.map(result => result.value.length).sort()).toEqual([0, 0, 1]);
        expect(await storedRows()).toHaveLength(1);
    } finally {
        await blocker.query('ROLLBACK');
        if (pending) await pending;
        blocker.release();
    }
});

test('a policy change committed during the wait rejects the previously captured input', async () => {
    const blocker = await db.connect();
    let pending;
    try {
        await blocker.query('BEGIN');
        await blocker.query('UPDATE library_policies SET auto_classify_threshold=90 WHERE id=$1', [policyId]);
        const entry = suggestion({ threshold_type: 'auto_classify', reason: 'High false positive rate' }, { type: 'adjust_threshold' });
        pending = Promise.allSettled([storeSuggestions(policyId, [entry])]);
        await blocker.query('COMMIT');
        const [result] = await pending;
        expect(result.status).toBe('rejected');
        expect(result.reason).toMatchObject({ code: 'SUGGESTION_EVIDENCE_STALE' });
        expect(await storedRows()).toEqual([]);
        expect(entry.config).toEqual({ threshold_type: 'auto_classify', reason: 'High false positive rate' });
    } finally {
        await blocker.query('ROLLBACK');
        if (pending) await pending;
        blocker.release();
    }
});
