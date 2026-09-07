/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@jest/globals';
import { buildNonClassifierHistoryMetadata } from '../services/nonClassifierHistoryMetadata.mjs';
test.each(['source_library', 'manual_classification'])('captures fixed %s origin and replaces caller-supplied candidates without mutation', method => {
    const source = { title: 'Fixture', classification_details: { retained: true, candidate_capture: { method: 'policy_auto', library_id: 88 } } };
    const before = structuredClone(source);
    expect(buildNonClassifierHistoryMetadata(source, method)).toEqual({ title: 'Fixture', classification_details: { retained: true,
        candidate_capture: { version: 'classification.candidate_capture.v1', stage: 'pre_routing', status: 'not_applicable', source: null, library_id: null, method } } });
    expect(source).toEqual(before);
});
test.each([null, [], 'invalid'])('normalizes malformed details %s without treating them as capture evidence', details => {
    expect(buildNonClassifierHistoryMetadata({ classification_details: details }, 'source_library').classification_details)
        .toEqual({ candidate_capture: expect.objectContaining({ method: 'source_library', status: 'not_applicable' }) });
});
test('rejects classifier methods rather than fabricating a candidate', () => {
    expect(() => buildNonClassifierHistoryMetadata({}, 'policy_auto')).toThrow('Expected a non-classifier');
});
