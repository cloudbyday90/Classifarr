/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@jest/globals';
import { buildClassificationCandidateCapture as capture } from '../services/classificationCandidateCapture.mjs';

test('policy ranking retains priority over a different AI proposal and becomes a detached scalar snapshot', () => {
    const result = { method: 'ai_analysis', library: { id: 2 }, policyResult: { ranked: [{ library_id: 1, secret: 'PRIVATE' }] } };
    const snapshot = capture(result);
    result.policyResult.ranked[0].library_id = 3;
    result.library.id = 4;
    expect(snapshot).toEqual({ version: 'classification.candidate_capture.v1', stage: 'pre_routing',
        status: 'recorded', source: 'policy_ranked', library_id: 1, method: 'ai_analysis' });
    expect(JSON.stringify(snapshot)).not.toContain('PRIVATE');
});

test.each(['ai_analysis', 'ai_verified', 'ai_rerun', 'policy_auto', 'policy_recheck', 'policy_engine',
    'policy_candidate_adjudication', 'learned_pattern', 'exact_match', 'custom_rule', 'rule_match',
    'library_rule', 'holiday_detection', 'rag_improved', 'ai_fallback', 'policy_prompt', 'signal_calculation'])
('captures an explicit %s proposal without fabricating a policy ranking', method => {
    const result = { method, library: { id: '12', name: 'PRIVATE' } };
    expect(capture(result)).toMatchObject({ status: 'recorded', source: 'decision_proposal', library_id: 12 });
    expect(result).not.toHaveProperty('policyResult');
});

test.each(['source_library', 'authoritative_source_library', 'existing_media', 'manual_classification', 'manual_correction'])
('%s cannot become a classifier prediction', method => {
    expect(capture({ method, library: { id: 1 }, policyResult: { ranked: [{ library_id: 2 }] } }))
        .toMatchObject({ status: 'not_applicable', source: null, library_id: null });
});

test.each([true, false, 0, -1, 1.5, '1e2', '1.0', 2147483648, Number.MAX_SAFE_INTEGER, {}, [], '1junk', null])
('invalid leading ID %j cannot fall through to a later candidate or final proposal', id => {
    expect(capture({ method: 'ai_analysis', library: { id: 2 }, policyResult: { ranked: [{ library_id: id }, { library_id: 3 }] } }))
        .toMatchObject({ status: 'invalid_candidate', source: 'policy_ranked', library_id: null });
});

test.each([{}, 'bad', [null, { library_id: 2 }], [true]])('malformed ranking %j is explicit invalid evidence', ranked => {
    expect(capture({ method: 'policy_auto', policyResult: { ranked }, library: { id: 3 } }).status).toBe('invalid_candidate');
});

test('empty policy rankings allow an explicit signal ranking or proposal', () => {
    expect(capture({ method: 'queued_for_retry', policyResult: { ranked: [] },
        signalContext: { ranked: [{ library_id: 1 }], suggestedLibrary: { id: 2 } } }))
        .toMatchObject({ status: 'recorded', source: 'signal_ranked', library_id: 1 });
    expect(capture({ method: 'queued_for_retry', signalContext: { suggestedLibrary: { id: 2 } } }))
        .toMatchObject({ status: 'recorded', source: 'signal_proposal', library_id: 2 });
});

test('default fallback is not a proposal, but preserves a real upstream policy candidate', () => {
    expect(capture({ method: 'fallback', library: { id: 9 } }).status).toBe('no_candidate');
    expect(capture({ method: 'fallback', library: { id: 9 }, policyResult: { ranked: [{ library_id: 1 }] } }))
        .toMatchObject({ status: 'recorded', source: 'policy_ranked', library_id: 1 });
});

test('conflicting identifiers, unsupported methods and absent proposals do not manufacture evidence', () => {
    expect(capture({ method: 'ai_analysis', library: { id: 1, library_id: 2 } }).status).toBe('invalid_candidate');
    expect(capture({ method: 'unknown', library: { id: 1 } }).status).toBe('unsupported_method');
    expect(capture({ method: 'ai_analysis' }).status).toBe('no_candidate');
    expect(capture().status).toBe('unsupported_method');
});
