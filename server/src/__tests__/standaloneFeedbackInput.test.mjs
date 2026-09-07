/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@jest/globals';
import { normalizeStandaloneFeedback } from '../services/standaloneFeedbackInput.mjs';
import { feedbackRequestFingerprint } from '../services/feedbackSourceReceipt.mjs';

const body = { classification_id: 42, selected_library_id: 3, selected_policy_id: 7 };

test('normalizes exact bigint source IDs, numeric library IDs and bounded annotations', () => {
    expect(normalizeStandaloneFeedback({ ...body, classification_id: '9223372036854775807', selected_library_id: '3', user_reason: ' reason ' }))
        .toEqual({ classification_id: '9223372036854775807', selected_library_id: 3, selected_policy_id: 7, user_reason: 'reason', user_reason_text: null });
});

test('semantically equivalent requests have the same fingerprint', () => {
    expect(feedbackRequestFingerprint(normalizeStandaloneFeedback(body)))
        .toBe(feedbackRequestFingerprint(normalizeStandaloneFeedback({ selected_policy_id: '7', selected_library_id: '3', classification_id: '42', user_reason: ' ' })));
});

test.each([null, [], {}, { ...body, tmdb_id: 1 }, { ...body, was_correction: false },
    { ...body, classification_id: true }, { ...body, classification_id: '42junk' },
    { ...body, classification_id: '9223372036854775808' }, { ...body, classification_id: 9007199254740992 },
    { ...body, selected_library_id: 2147483648 }, { ...body, selected_policy_id: 0 },
    { ...body, user_reason: ['reason'] }, { ...body, user_reason: 'é'.repeat(51) },
    { ...body, user_reason_text: 'x'.repeat(4001) }, { ...body, user_reason_text: 'a\0b' },
])('rejects invalid or caller-owned evidence input %j', invalid => {
    expect(() => normalizeStandaloneFeedback(invalid)).toThrow();
});
