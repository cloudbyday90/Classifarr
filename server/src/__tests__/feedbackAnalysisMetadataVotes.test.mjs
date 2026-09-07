/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@jest/globals';
import { groupByMetadataField } from '../services/feedbackAnalysisUtils.mjs';
import { detectFailurePatterns, detectNewPatterns, analyzeSignalEffectiveness, analyzeThresholds } from '../services/feedbackAnalysisPatternDetection.mjs';
import { generateSuggestions } from '../services/feedbackAnalysisSuggestions.mjs';

const record = (id, metadata, correction = true) => ({ id, selected_policy_id: 1, selected_library_id: 2,
    top_suggestion_library_id: 3, top_suggestion_score: 85, was_correction: correction,
    prompt_type: 'auto_classify', original_scores: { preset: 85 }, item_metadata: metadata });

test.each(['genres', 'keywords', 'production_companies'])('%s contributes one vote after normalizing mixed representations', field => {
    const values = Object.freeze([' Action ', Object.freeze({ name: 'Action' }), Object.freeze({ tag: 'Action' }),
        Object.freeze({ title: 'Action' }), 'Drama', null, '', 99, Object.freeze({ id: 1 })]);
    const feedback = Object.freeze([Object.freeze(record(7, Object.freeze({ [field]: values }))),
        Object.freeze(record(3, Object.freeze({ [field]: JSON.stringify(['Action', ' Action ', 'Comedy']) })))]);
    const before = JSON.stringify(feedback);
    const groups = groupByMetadataField(feedback, field);
    expect(Object.keys(groups)).toEqual(['Action', 'Drama', 'Comedy']);
    expect(groups.Action).toEqual({ count: 2, feedbackIds: [7, 3] });
    expect(groups.Drama).toEqual({ count: 1, feedbackIds: [7] });
    expect(groups.Comedy).toEqual({ count: 1, feedbackIds: [3] });
    expect(JSON.stringify(feedback)).toBe(before);
});

test('reserved names are ordinary unique metadata values', () => {
    const groups = groupByMetadataField([record(1, { genres: ['__proto__', 'constructor', '__proto__', 'constructor'] })], 'genres');
    expect(Object.getPrototypeOf(groups)).toBeNull();
    expect(groups.__proto__).toEqual({ count: 1, feedbackIds: [1] });
    expect(groups.constructor).toEqual({ count: 1, feedbackIds: [1] });
    expect(Object.prototype.count).toBeUndefined();
});

test('case and Unicode variants retain their existing identities', () => {
    const values = ['Action', 'action', '\u00e9', 'e\u0301'];
    const groups = groupByMetadataField([record(1, { genres: values })], 'genres');
    expect(Object.keys(groups)).toEqual(values);
    expect(Object.values(groups).map(group => group.count)).toEqual([1, 1, 1, 1]);
});

test('a single correction cannot cross pattern thresholds by repeating its tags', async () => {
    const feedback = [record(1, { genres: ['Action', 'Action', 'Action'],
        keywords: ['hero', 'hero', 'hero'], production_companies: ['Studio', 'Studio', 'Studio'] })];
    const failurePatterns = await detectFailurePatterns(1, feedback);
    expect(failurePatterns.falsePositives).toEqual([]);
    expect(failurePatterns.missedPositives).toEqual([]);
    expect(await detectNewPatterns(1, feedback)).toEqual([]);
});

test.each([2, 3, 5])('duplicate metadata cannot change analysis or confidence across %i genuine corrections', async count => {
    const feedback = Array.from({ length: count }, (_, i) => record(i + 1,
        { genres: ['Action'], keywords: ['hero'], production_companies: ['Studio'], belongs_to_collection: { name: 'Saga' } }));
    feedback.push(record(count + 1, { genres: ['Action'] }, false));
    const duplicated = feedback.map(row => ({ ...row, item_metadata: Object.fromEntries(Object.entries(row.item_metadata)
        .map(([field, values]) => [field, Array.isArray(values) ? values.flatMap(value => [value, { name: value }, value]) : values])) }));
    const analyze = async rows => ({ failurePatterns: await detectFailurePatterns(1, rows),
        newPatterns: await detectNewPatterns(1, rows), signalEffectiveness: await analyzeSignalEffectiveness(1, rows),
        thresholdAnalysis: await analyzeThresholds(1, rows, { auto_classify_threshold: 85, prompt_threshold: 60 }) });
    const expected = await analyze(feedback);
    const actual = await analyze(duplicated);
    expect(actual).toEqual(expected);
    expect(await generateSuggestions(1, actual, duplicated)).toEqual(await generateSuggestions(1, expected, feedback));
    for (const pattern of actual.newPatterns) {
        expect(pattern.count).toBe(count);
        expect(pattern.feedbackIds).toEqual(Array.from({ length: count }, (_, i) => i + 1));
    }
});
