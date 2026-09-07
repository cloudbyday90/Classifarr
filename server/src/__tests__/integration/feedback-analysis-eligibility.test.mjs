/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, beforeEach, afterEach, test, expect } from '@jest/globals';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());
const { feedbackAnalysis } = await import('../../services/feedbackAnalysis.mjs');
const { readEligiblePolicyFeedback } = await import('../../services/feedbackAnalysisEvidence.mjs');
const { COHORT_VERSION } = await import('../../services/feedbackAnalysisCohortContract.mjs');
let db, destination, other, policyId;

beforeEach(async () => {
    db = getPool();
    [destination, other] = (await db.query(`INSERT INTO libraries(name,external_id,media_type,is_active)
        VALUES('Destination','analysis-destination','movie',true),('Other','analysis-other','movie',true)
        RETURNING id`)).rows.map(row => row.id);
    policyId = (await db.query(`INSERT INTO library_policies(library_id,name,auto_classify_threshold,prompt_threshold)
        VALUES($1,'Evidence policy',85,60) RETURNING id`, [destination])).rows[0].id;
});

afterEach(async () => {
    await db.query('DELETE FROM policy_tuning_suggestions WHERE policy_id=$1', [policyId]);
    await db.query('DELETE FROM policy_feedback_log WHERE selected_policy_id=$1', [policyId]);
    await db.query('DELETE FROM library_policies WHERE id=$1', [policyId]);
    await db.query('DELETE FROM libraries WHERE id=ANY($1::integer[])', [[destination, other]]);
});

async function addFeedback(count, { libraryId = destination, correction = false, genre = 'Action', days = 0, top = correction ? other : libraryId } = {}) {
    return (await db.query(`INSERT INTO policy_feedback_log(tmdb_id,selected_policy_id,selected_library_id,
        was_correction,item_metadata,original_scores,top_suggestion_library_id,top_suggestion_score,
        prompt_type,prompted_at,user_reason_text)
        SELECT n,$1,$2,$3,$4,'{"preset":85}',$5,85,'auto_classify',NOW()-$6::integer*INTERVAL '1 day',
            'Preserved historical reason' FROM generate_series(1,$7::integer) n RETURNING id`,
    [policyId, libraryId, correction, { genres: [genre], library_snapshot: { libraryId: destination } }, top, days, count])).rows.map(row => row.id);
}

test('detached and contradictory destinations cannot create patterns, weight or threshold suggestions', async () => {
    await addFeedback(5);
    await addFeedback(10, { libraryId: null, correction: true, genre: 'Detached' });
    await addFeedback(5, { libraryId: other, correction: true, genre: 'Wrong policy' });
    const before = (await db.query('SELECT * FROM policy_feedback_log ORDER BY id')).rows;
    const result = await feedbackAnalysis.analyzePolicy(policyId);
    expect(result.feedbackCount).toBe(5);
    expect(result.suggestions).toEqual([]);
    expect(result.analysis.failurePatterns).toEqual({ falsePositives: [], missedPositives: [], thresholdIssues: [] });
    expect(result.analysis.newPatterns).toEqual([]);
    expect(result.analysis.signalEffectiveness.preset).toMatchObject({ correct: 5, incorrect: 0, accuracy: 1 });
    expect(result.analysis.thresholdAnalysis.autoClassified).toEqual({ count: 5, accuracy: 1, corrections: 0 });
    expect((await db.query('SELECT * FROM policy_tuning_suggestions WHERE policy_id=$1', [policyId])).rows).toEqual([]);
    expect((await db.query('SELECT * FROM policy_feedback_log ORDER BY id')).rows).toEqual(before);
});

test('genuine corrections still store supported patterns and threshold suggestions', async () => {
    await addFeedback(3);
    const support = await addFeedback(3, { correction: true, top: other });
    await addFeedback(6, { libraryId: null, correction: true, genre: 'Detached' });
    const result = await feedbackAnalysis.analyzePolicy(policyId);
    expect(result.feedbackCount).toBe(6);
    expect(result.analysis.failurePatterns.missedPositives).toEqual([
        { type: 'genre', value: 'Action', count: 3, feedbackIds: expect.arrayContaining(support) },
    ]);
    expect(result.analysis.signalEffectiveness.preset.accuracy).toBe(0.5);
    const stored = (await db.query('SELECT * FROM policy_tuning_suggestions WHERE policy_id=$1', [policyId])).rows;
    expect(stored).toHaveLength(2);
    const patternSuggestions = stored.filter(row => row.suggestion_type === 'create_pattern');
    expect(patternSuggestions).toHaveLength(1);
    for (const pattern of patternSuggestions) {
        expect(pattern).toMatchObject({
            suggestion_config: { pattern_type: 'genre', pattern_value: 'Action' },
            supporting_feedback_ids: expect.arrayContaining(support), status: 'pending',
        });
        expect(pattern.supporting_feedback_ids).toHaveLength(3);
    }
    expect(stored.filter(row => row.suggestion_type === 'adjust_weight')).toEqual([]);
    expect(stored.filter(row => row.suggestion_type === 'adjust_threshold')).toHaveLength(1);
    expect(stored.find(row => row.suggestion_type === 'adjust_threshold').suggestion_config.recommended).toBe(90);
});

test('eligible signal failures still generate weight suggestions', async () => {
    await addFeedback(5, { correction: true });
    const result = await feedbackAnalysis.analyzePolicy(policyId);
    expect(result.suggestions.find(row => row.suggestion_type === 'adjust_weight')).toMatchObject({
        suggestion_config: { signal: 'preset', reason: 'Low accuracy (0.0%)' }, status: 'pending',
    });
});

test.each([false, null])('a destination with active state %s supplies no evidence', async active => {
    await addFeedback(6, { correction: true });
    await db.query('UPDATE libraries SET is_active=$1 WHERE id=$2', [active, destination]);
    expect(await feedbackAnalysis.analyzePolicy(policyId)).toMatchObject({ feedbackCount: 0, suggestions: [] });
});

test('detached rows cannot meet the sample minimum or generate suggestions with a zero minimum', async () => {
    await addFeedback(5, { libraryId: null, correction: true });
    expect(await feedbackAnalysis.analyzePolicy(policyId, { minFeedback: 0 })).toMatchObject({ feedbackCount: 0, suggestions: [] });
    await addFeedback(1);
    expect(await feedbackAnalysis.analyzePolicy(policyId)).toMatchObject({ feedbackCount: 1, suggestions: [],
        message: 'Insufficient feedback for meaningful analysis' });
});

test('every pattern branch respects short and extended lookbacks', async () => {
    await addFeedback(3);
    await addFeedback(3, { correction: true, days: 10, genre: 'Ten days' });
    await addFeedback(3, { correction: true, days: 40, genre: 'Forty days' });
    const short = await feedbackAnalysis.analyzePolicy(policyId, { days: 7, minFeedback: 3 });
    expect(short.feedbackCount).toBe(3);
    expect(short.analysis.failurePatterns.missedPositives).toEqual([]);
    expect(short.suggestions).toEqual([]);
    const extended = await feedbackAnalysis.analyzePolicy(policyId, { days: 60, minFeedback: 3 });
    expect(extended.feedbackCount).toBe(9);
    expect(extended.analysis.failurePatterns.missedPositives.map(row => row.value).sort()).toEqual(['Forty days', 'Ten days']);
});

test('detachment stays ineligible when the numeric library ID is reused', async () => {
    await addFeedback(5, { libraryId: other, correction: true });
    await db.query('UPDATE policy_feedback_log SET selected_library_id=NULL WHERE selected_policy_id=$1', [policyId]);
    await db.query('DELETE FROM libraries WHERE id=$1', [other]);
    await db.query(`INSERT INTO libraries(id,name,external_id,media_type,is_active)
        VALUES($1,'Replacement','analysis-reused','movie',true)`, [other]);
    await db.query('UPDATE library_policies SET library_id=$1 WHERE id=$2', [other, policyId]);
    expect(await feedbackAnalysis.analyzePolicy(policyId)).toMatchObject({ feedbackCount: 0, suggestions: [] });
    expect((await db.query('SELECT count(*)::integer count FROM policy_feedback_log WHERE selected_policy_id=$1', [policyId])).rows[0].count).toBe(5);
});

test('missing policies and stale destinations yield no eligible evidence', async () => {
    const peer = await db.connect();
    try {
        await peer.query('BEGIN');
        // Corrupt historical references only in the disposable integration database.
        await peer.query('ALTER TABLE policy_feedback_log DISABLE TRIGGER ALL');
        await peer.query('ALTER TABLE library_policies DISABLE TRIGGER ALL');
        await peer.query('UPDATE library_policies SET library_id=2147483647 WHERE id=$1', [policyId]);
        await peer.query(`INSERT INTO policy_feedback_log(tmdb_id,selected_policy_id,selected_library_id,was_correction)
            VALUES(1,$1,2147483647,true)`, [policyId]);
        await peer.query('ALTER TABLE policy_feedback_log ENABLE TRIGGER ALL');
        await peer.query('ALTER TABLE library_policies ENABLE TRIGGER ALL');
        await peer.query('COMMIT');
    } finally { await peer.query('ROLLBACK'); peer.release(); }
    expect(await feedbackAnalysis.analyzePolicy(policyId, { minFeedback: 1 })).toMatchObject({ feedbackCount: 0, suggestions: [] });
    expect(await readEligiblePolicyFeedback(db, 2147483647)).toEqual([]);
});

test('disabled policies can still be explicitly analyzed using a read-only evidence query', async () => {
    await addFeedback(3);
    await db.query('UPDATE library_policies SET enabled=false WHERE id=$1', [policyId]);
    const peer = await db.connect();
    try {
        await peer.query('BEGIN READ ONLY');
        expect(await readEligiblePolicyFeedback(peer, policyId)).toHaveLength(3);
        await peer.query('COMMIT');
    } finally { await peer.query('ROLLBACK'); peer.release(); }
});

test.each(['genres', 'keywords', 'production_companies'].flatMap(field => [1, 2, 3].map(count => [field, count])))(
    '%s repeats in %i correction records cannot inflate stored pattern confidence', async (field, count) => {
        const support = await addFeedback(count, { correction: true });
        await addFeedback(5 - count);
        const metadata = { [field]: [' Action ', { name: 'Action' }, { tag: 'Action' }, { title: 'Action' }] };
        await db.query('UPDATE policy_feedback_log SET item_metadata=$1 WHERE id=ANY($2::integer[])', [metadata, support]);
        const before = (await db.query('SELECT * FROM policy_feedback_log WHERE selected_policy_id=$1 ORDER BY id', [policyId])).rows;
        const result = await feedbackAnalysis.analyzePolicy(policyId);
        expect(result.feedbackCount).toBe(5);
        const suggestions = result.suggestions.filter(row => row.suggestion_type === 'create_pattern');
        if (count === 1) {
            expect(result.analysis.newPatterns).toEqual([]);
            expect(result.analysis.failurePatterns.missedPositives).toEqual([]);
            expect(suggestions).toEqual([]);
        } else {
            expect(suggestions).toHaveLength(1);
            expect(suggestions[0]).toMatchObject({ suggestion_config: { pattern_value: 'Action', confidence: count * 20 }, confidence: count * 15 });
            const stored = (await db.query(`SELECT pts.supporting_feedback_ids,c.manifest FROM policy_tuning_suggestions pts
                JOIN policy_tuning_cohorts c ON c.fingerprint=pts.cohort_fingerprint WHERE pts.id=$1`, [suggestions[0].id])).rows[0];
            expect(stored.supporting_feedback_ids.sort((a, b) => a - b)).toEqual(support.sort((a, b) => a - b));
            expect(stored.manifest.version).toBe(COHORT_VERSION);
            expect(stored.manifest.feedback.find(row => row.id === support[0]).item_metadata).toEqual(metadata);
        }
        expect((await db.query('SELECT * FROM policy_feedback_log WHERE selected_policy_id=$1 ORDER BY id', [policyId])).rows).toEqual(before);
    });
