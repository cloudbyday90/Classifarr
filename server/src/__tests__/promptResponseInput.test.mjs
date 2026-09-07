/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { normalizePromptResponse } from '../services/promptResponseInput.mjs';

test.each([
    { selectedLibraryId: null }, { selectedLibraryId: true }, { selectedLibraryId: '1x' },
    { selectedLibraryId: 0 }, { selectedLibraryId: 1.5 }, { selectedLibraryId: 2147483648 },
    { selectedPolicyId: [] }, { patternActions: null }, { patternActions: {} },
    { patternActions: Array(51).fill({ type: 'studio', value: 'Fixture' }) },
    { patternActions: [null] }, { patternActions: [[]] }, { patternActions: [{}] },
    { patternActions: [{ type: 'a'.repeat(51), value: 'Fixture' }] },
    { patternActions: [{ type: 'studio', value: ' ' }] },
    { patternActions: [{ type: 'studio', value: 'bad\0value' }] },
    { patternActions: [{ type: 'studio', value: '😀'.repeat(257) }] },
    { patternActions: [{ type: 'studio', value: 'Fixture', targetLibraryId: null }] },
    { patternActions: [{ type: 'studio', value: 'Fixture', targetLibraryId: '1oops' }] },
    { reasons: null }, { reasons: Array(21).fill('genre') }, { reasons: [{}] },
    { customReason: 'x'.repeat(4001) },
])('rejects malformed or unbounded input %#', payload => {
    expect(() => normalizePromptResponse({ selectedLibraryId: 1, ...payload })).toThrow(expect.objectContaining({ statusCode: 400 }));
});

test.each([null, [], 'invalid', {}])('rejects missing library or malformed body %#', body => {
    expect(() => normalizePromptResponse(body)).toThrow(expect.objectContaining({ statusCode: 400 }));
});

test('deduplicates exact trimmed identities without case or Unicode conflation, preserving input', () => {
    const body = { selectedLibraryId: '1', selectedPolicyId: '2', patternActions: [
        { type: 'studio', value: ' Fixture ' }, { type: 'studio', value: 'Fixture', targetLibraryId: '1' },
        { type: 'studio', value: 'fixture' }, { type: 'studio', value: 'Fixture', targetLibraryId: 2 },
    ] };
    const before = structuredClone(body);
    expect(normalizePromptResponse(body)).toEqual({ selectedLibraryId: 1, selectedPolicyId: 2,
        reasons: [], customReason: null, patternActions: [
            { type: 'studio', value: 'Fixture', targetLibraryId: 1 },
            { type: 'studio', value: 'fixture', targetLibraryId: 1 },
            { type: 'studio', value: 'Fixture', targetLibraryId: 2 },
        ] });
    expect(body).toEqual(before);
});
