/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@jest/globals';
import { resolveSuggestionConfig } from '../services/feedbackAnalysisSuggestionConfig.mjs';

const policy = { auto_classify_threshold: 85, prompt_threshold: 60,
    preset_weight: 0.4, pattern_weight: 0.3, rag_weight: 0.2, history_weight: 0.1 };

test.each([
    ['auto_classify', 'High false positive rate', {}, 85, 90],
    ['auto_classify', 'High false positive rate', { auto_classify_threshold: 94 }, 94, 95],
    ['auto_classify', 'Low auto-classification rate', {}, 85, 80],
    ['auto_classify', 'Low auto-classification rate', { auto_classify_threshold: 61 }, 61, 60],
    ['prompt', 'Low rate', {}, 60, 55],
    ['prompt', 'Low rate', { prompt_threshold: 52 }, 52, 50],
])('resolves %s threshold for %s without mutating input', (type, reason, overrides, current, recommended) => {
    const config = Object.freeze({ threshold_type: type, reason });
    const suggestion = Object.freeze({ type: 'adjust_threshold', config });
    expect(resolveSuggestionConfig({ ...policy, ...overrides }, suggestion)).toEqual({ ...config, current, recommended });
    expect(suggestion.config).toEqual({ threshold_type: type, reason });
});

test.each(['preset', 'pattern', 'rag', 'history'])('resolves %s weight with existing defaults and bounds', signal => {
    const config = Object.freeze({ signal, reason: 'Low accuracy' });
    const suggestion = Object.freeze({ type: 'adjust_weight', config });
    const result = resolveSuggestionConfig(policy, suggestion);
    expect(result.current).toBe(policy[`${signal}_weight`]);
    expect(result.recommended).toBeCloseTo(Math.max(result.current - 0.1, 0.05));
    expect(resolveSuggestionConfig({}, suggestion)).toEqual(result);
    expect(resolveSuggestionConfig({ ...policy, [`${signal}_weight`]: 0.59 },
        { type: 'adjust_weight', config: { signal, reason: 'High accuracy' } }).recommended).toBe(0.6);
    expect(resolveSuggestionConfig(policy,
        { type: 'adjust_weight', config: { signal, reason: 'High accuracy' } }).recommended)
        .toBeCloseTo(policy[`${signal}_weight`] + 0.1);
});

test.each(['create_pattern', 'adjust_threshold'])('%s preserves configuration members outside resolution', type => {
    const config = Object.freeze({ pattern_type: 'genre', pattern_value: 'Action', confidence: 60 });
    const result = resolveSuggestionConfig(policy, { type, config });
    expect(result).toEqual(config);
    expect(result).not.toBe(config);
});

test.each([null, undefined, false, 1, 'config', []])('rejects malformed configuration %s', config => {
    expect(() => resolveSuggestionConfig(policy, { type: 'create_pattern', config })).toThrow('must be an object');
});
