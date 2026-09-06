/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import { lockPendingSuggestion, completeSuggestionReview } from '../services/feedbackAnalysisSuggestionLifecycle.mjs';

function clientFor({ location = [{ policy_id: 5 }], policy = [{ id: 5 }], suggestion = [{ id: 1, policy_id: 5, status: 'pending' }] } = {}) {
    return { query: jest.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: location })
        .mockResolvedValueOnce({ rows: policy }).mockResolvedValueOnce({ rows: suggestion }) };
}

test('only the locked re-read supplies the suggestion used for a review', async () => {
    const latest = { id: 1, policy_id: 5, status: 'pending', suggestion_config: { recommended: 90 } };
    const client = clientFor({ suggestion: [latest] });
    expect(await lockPendingSuggestion(client, 1)).toEqual({ suggestion: latest, policy: { id: 5 } });
    expect(client.query.mock.calls[0][0]).toBe('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
    expect(client.query.mock.calls[2][0]).toMatch(/FROM library_policies[\s\S]*FOR UPDATE/);
    expect(client.query.mock.calls[3][0]).toMatch(/policy_tuning_suggestions[\s\S]*FOR UPDATE/);
});

test.each(['applied', 'rejected', 'unknown', null, undefined])('status %s cannot be reviewed again', async status => {
    await expect(lockPendingSuggestion(clientFor({ suggestion: [{ id: 1, policy_id: 5, status }] }), 1))
        .rejects.toMatchObject({ statusCode: 409, code: 'SUGGESTION_NOT_PENDING' });
});

test('a changed policy reference cannot inherit the old policy authority', async () => {
    await expect(lockPendingSuggestion(clientFor({ suggestion: [{ id: 1, policy_id: 6, status: 'pending' }] }), 1))
        .rejects.toMatchObject({ statusCode: 409, code: 'SUGGESTION_POLICY_CHANGED' });
});

test.each([{ location: [] }, { suggestion: [] }, { policy: [] }])('missing rows cannot be reviewed', async fixture => {
    await expect(lockPendingSuggestion(clientFor(fixture), 1)).rejects.toMatchObject({ statusCode: 404 });
});

test('a lost conditional update fails instead of reporting success', async () => {
    await expect(completeSuggestionReview({ query: jest.fn().mockResolvedValue({ rows: [] }) },
        { suggestionId: 1, userId: 2, status: 'applied', beforeAccuracy: 0.8 }))
        .rejects.toMatchObject({ statusCode: 409, code: 'SUGGESTION_NOT_PENDING' });
});

test.each(['applied', 'rejected'])('the %s terminal update is guarded and uses bound values', async status => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }] }) };
    await completeSuggestionReview(client, { suggestionId: 1, userId: 2, status, reason: "User's reason", beforeAccuracy: 0.8 });
    expect(client.query.mock.calls[0][0]).toContain("WHERE id = $1 AND status = 'pending'");
    expect(client.query.mock.calls[0][1]).toEqual([1, status, 2, "User's reason", 0.8]);
});

test('terminal update defaults do not manufacture accuracy or a rejection reason', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }] }) };
    await completeSuggestionReview(client, { suggestionId: 1, userId: 2, status: 'rejected' });
    expect(client.query.mock.calls[0][1]).toEqual([1, 'rejected', 2, null, null]);
});

test('unsupported terminal states are rejected before a query', async () => {
    const client = { query: jest.fn() };
    await expect(completeSuggestionReview(client, { suggestionId: 1, userId: 2, status: 'pending' })).rejects.toMatchObject({ statusCode: 400 });
    expect(client.query).not.toHaveBeenCalled();
});
