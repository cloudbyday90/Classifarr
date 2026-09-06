/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@jest/globals';
import { cohortDigest, projectFeedback, projectPolicy, assertCohortShape, COHORT_VERSION } from '../services/feedbackAnalysisCohortContract.mjs';
import { groupByMetadataField } from '../services/feedbackAnalysisUtils.mjs';
import { captureSuggestionCohort } from '../services/feedbackAnalysisCohort.mjs';
import { generateSuggestions } from '../services/feedbackAnalysisSuggestions.mjs';
import { analyzeThresholds } from '../services/feedbackAnalysisPatternDetection.mjs';

test('fingerprints preserve reserved keys and array order, ignoring object key order', () => {
    const reserved = JSON.parse('{"__proto__":{"value":1},"constructor":2}');
    expect(cohortDigest(reserved)).not.toBe(cohortDigest({ constructor: 2 }));
    expect(cohortDigest({ b: 2, a: 1 })).toBe(cohortDigest({ a: 1, b: 2 }));
    expect(cohortDigest([1, 2])).not.toBe(cohortDigest([2, 1]));
    expect({}.value).toBeUndefined();
});

test('metadata grouping treats reserved names as ordinary own keys', () => {
    const groups = groupByMetadataField([{ id: 7, item_metadata: { genres: ['__proto__', 'constructor'] } }], 'genres');
    expect(groups.__proto__).toEqual({ count: 1, feedbackIds: [7] });
    expect(groups.constructor).toEqual({ count: 1, feedbackIds: [7] });
    expect(Object.prototype.count).toBeUndefined();
});

test('the projection retains consumed input while excluding unrelated private data', () => {
    const row = projectFeedback({ id: 1, prompted_at: new Date('2026-08-01T00:00:00Z'), title: 'Private', user_reason_text: 'Private',
        item_metadata: { genres: ['Action'], provider_token: 'Private' }, original_scores: { preset: 80, unrelated: 'Private' } });
    expect(row.item_metadata).toEqual({ genres: ['Action'] });
    expect(row.original_scores).toEqual({ preset: 80 });
    expect(JSON.stringify(row)).not.toContain('Private');
    expect(projectPolicy({ id: 1, name: 'Cosmetic', native_intent_active: false, enabled: true })).toEqual({ id: 1, enabled: true });
});

test('invalid and oversized manifests cannot be used as evidence', () => {
    const base = { version: COHORT_VERSION, policy: {}, destination: {}, days: 30, captured_at: '2026-08-01T00:00:00Z',
        feedback: [{ id: 1, prompted_at: '2026-08-01T00:00:00Z' }] };
    expect(() => assertCohortShape(base)).not.toThrow();
    for (const change of [{ version: 'unknown' }, { days: 0 }, { captured_at: 'invalid' }, { feedback: [] },
        { feedback: [null] }, { feedback: [base.feedback[0], base.feedback[0]] }]) {
        expect(() => assertCohortShape({ ...base, ...change })).toThrow();
    }
    expect(() => assertCohortShape({ ...base, extra: 'x'.repeat(2 * 1024 * 1024) })).toThrow(/2 MiB/);
});

test('threshold support includes the denominator; weight support includes every scored member', async () => {
    const feedback = [{ id: 1, original_scores: { preset: 80 } }, { id: 2, original_scores: { preset: 0 } }, { id: 3 }];
    const suggestions = await generateSuggestions(1, {
        failurePatterns: { thresholdIssues: [{ recommendation: 'increase_auto_classify_threshold', correctionRate: 0.6 }] },
        signalEffectiveness: { preset: { accuracy: 0.4, correct: 2, incorrect: 3 } },
    }, feedback);
    expect(suggestions.find(row => row.type === 'adjust_threshold').supporting_feedback).toEqual([1, 2, 3]);
    expect(suggestions.find(row => row.type === 'adjust_weight').supporting_feedback).toEqual([1, 2]);
});

test('captured policy analysis preserves the existing public threshold result shape', async () => {
    const analysis = await analyzeThresholds(1, [], { id: 1, auto_classify_threshold: 85, prompt_threshold: 60, internal_config: 'excluded' });
    expect(analysis.current).toEqual({ auto_classify_threshold: 85, prompt_threshold: 60 });
});


test.each([null, 0, -1, '1', true, 1.5, NaN, Infinity, 2147483648])('capture rejects invalid policy %s before database work', async policyId => {
    await expect(captureSuggestionCohort(policyId)).rejects.toMatchObject({ statusCode: 400 });
});

test.each([null, 0, -1, '30', true, 1.5, NaN, Infinity, 366])('capture rejects invalid lookback %s before database work', async days => {
    await expect(captureSuggestionCohort(1, days)).rejects.toMatchObject({ statusCode: 400 });
});
