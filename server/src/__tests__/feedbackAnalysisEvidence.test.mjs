/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, beforeEach, afterEach, test, expect } from '@jest/globals';
import { createNamedMockModule, createLoggerModuleMock } from './helpers/mockFactory.mjs';

const db = { query: jest.fn() };
jest.unstable_mockModule('../services/feedbackAnalysisCohort.mjs', () => ({
    captureSuggestionCohort: jest.fn(async () => ({ feedback: (await db.query()).rows,
        policy: { auto_classify_threshold: 80, prompt_threshold: 65 } })),
    assertSuggestionCohortCurrent: jest.fn(), assertSuggestionEvidenceCurrent: jest.fn(), persistSuggestionCohort: jest.fn(),
}));
jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', db));
jest.unstable_mockModule('../utils/logger.mjs', () => createLoggerModuleMock().module);
const { readEligiblePolicyFeedback } = await import('../services/feedbackAnalysisEvidence.mjs');
const { feedbackAnalysis } = await import('../services/feedbackAnalysis.mjs');

beforeEach(() => db.query.mockReset());
afterEach(() => jest.restoreAllMocks());

test.each([null, undefined, 0, -1, '5', true, 5.5, NaN, Infinity, 2147483648])(
    'invalid policy ID %s cannot query for evidence', async policyId => {
        expect(await readEligiblePolicyFeedback(db, policyId)).toEqual([]);
        expect(db.query).not.toHaveBeenCalled();
    });

test.each([null, 0, -1, '7', true, 7.5, NaN, Infinity, 366])(
    'invalid lookback %s cannot query for evidence', async days => {
        expect(await readEligiblePolicyFeedback(db, 1, days)).toEqual([]);
        expect(db.query).not.toHaveBeenCalled();
    });

test('malformed returned references cannot count toward the eligible sample', async () => {
    const valid = { id: 1, selected_library_id: 5, selected_policy_id: 1 };
    db.query.mockResolvedValue({ rows: [valid, null, { ...valid, selected_policy_id: 2 },
        ...[null, undefined, 0, -1, '5', true, 5.2, NaN, Infinity, 2147483648]
            .map(id => ({ ...valid, selected_library_id: id }))] });
    expect(await readEligiblePolicyFeedback(db, 1)).toEqual([valid]);
    expect(db.query.mock.calls[0][1]).toEqual([1, 30]);
});

test.each([1, 7, 365])('passes valid %i-day lookback as a bound parameter', async days => {
    db.query.mockResolvedValue({ rows: [] });
    expect(await readEligiblePolicyFeedback(db, 1, days)).toEqual([]);
    expect(db.query.mock.calls[0][1]).toEqual([1, days]);
});

test('an empty eligible cohort cannot generate or store suggestions with a zero minimum', async () => {
    db.query.mockResolvedValue({ rows: [] });
    const generate = jest.spyOn(feedbackAnalysis, 'generateSuggestions');
    const store = jest.spyOn(feedbackAnalysis, 'storeSuggestions');
    expect(await feedbackAnalysis.analyzePolicy(1, { minFeedback: 0 })).toMatchObject({
        feedbackCount: 0, suggestions: [], message: 'Insufficient feedback for meaningful analysis',
    });
    expect(generate).not.toHaveBeenCalled();
    expect(store).not.toHaveBeenCalled();
});

test('a failed eligibility read propagates without generating or storing suggestions', async () => {
    db.query.mockRejectedValue(new Error('evidence unavailable'));
    const generate = jest.spyOn(feedbackAnalysis, 'generateSuggestions');
    const store = jest.spyOn(feedbackAnalysis, 'storeSuggestions');
    await expect(feedbackAnalysis.analyzePolicy(1)).rejects.toThrow('evidence unavailable');
    expect(generate).not.toHaveBeenCalled();
    expect(store).not.toHaveBeenCalled();
    expect(db.query).toHaveBeenCalledTimes(1);
});

test('failure patterns use only the supplied cohort and never fetch more feedback', async () => {
    const feedback = [1, 2, 3].map(id => ({ id, selected_policy_id: 1, selected_library_id: 5,
        top_suggestion_library_id: null, top_suggestion_score: null, was_correction: true,
        item_metadata: { genres: ['Action'] } }));
    feedback.push({ ...feedback[0], id: 4, selected_policy_id: 2 });
    const patterns = await feedbackAnalysis.detectFailurePatterns(1, feedback);
    expect(patterns.missedPositives).toEqual([
        { type: 'genre', value: 'Action', count: 3, feedbackIds: [1, 2, 3] },
    ]);
    expect(db.query).not.toHaveBeenCalled();
});
