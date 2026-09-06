/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, beforeEach, test, expect } from '@jest/globals';
import { createNamedMockModule, createLoggerModuleMock } from './helpers/mockFactory.mjs';

const client = { query: jest.fn() };
const db = { query: jest.fn(), withTransaction: jest.fn(fn => fn(client)) };
jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', db));
jest.unstable_mockModule('../utils/logger.mjs', () => createLoggerModuleMock().module);
jest.unstable_mockModule('../services/feedbackAnalysisCohort.mjs', () => ({
    assertSuggestionCohortCurrent: jest.fn(), assertSuggestionEvidenceCurrent: jest.fn(),
    persistSuggestionCohort: jest.fn(async () => 'a'.repeat(64)),
}));
const cohort = { feedback: [] };
const { storeSuggestions: store } = await import('../services/feedbackAnalysisSuggestionStore.mjs');

const storeSuggestions = (id, entries) => store(id, entries, cohort);

beforeEach(() => {
    client.query.mockReset();
    jest.clearAllMocks();
});

test('the complete batch uses one transaction client and skips an existing pending match', async () => {
    const suggestion = Object.freeze({ type: 'create_pattern', config: Object.freeze({ pattern_value: 'Action' }),
        confidence: 60, impact_estimate: 'Fixture' });
    client.query.mockResolvedValueOnce({ rows: [] }) // Isolation
        .mockResolvedValueOnce({ rows: [{ auto_classify_threshold: 85 }] })
        .mockResolvedValueOnce({ rows: [] }) // Pending freshness check
        .mockResolvedValueOnce({ rows: [] }) // First match check
        .mockResolvedValueOnce({ rows: [{ id: 7, status: 'pending' }] })
        .mockResolvedValueOnce({ rows: [{ id: 7 }] }); // Repeated configuration
    expect(await storeSuggestions(1, Object.freeze([suggestion, suggestion]))).toEqual([{ id: 7, status: 'pending' }]);
    expect(db.withTransaction).toHaveBeenCalledTimes(1);
    expect(db.query).not.toHaveBeenCalled();
    expect(client.query.mock.calls[0][0]).toBe('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
    expect(client.query.mock.calls[1][0]).toContain('FOR NO KEY UPDATE');
    expect(client.query.mock.calls[4][1]).toEqual([1, 'create_pattern', '{"pattern_value":"Action"}', [], 60, 'Fixture', 'a'.repeat(64), expect.stringMatching(/^[a-f0-9]{64}$/)]);
    expect(suggestion.config).toEqual({ pattern_value: 'Action' });
});

test('a missing policy fails before any duplicate lookup or insertion', async () => {
    client.query.mockResolvedValue({ rows: [] });
    await expect(storeSuggestions(1, [{ type: 'create_pattern', config: {} }])).rejects.toThrow('Policy not found');
    expect(client.query).toHaveBeenCalledTimes(2);
    expect(db.query).not.toHaveBeenCalled();
});

test('insertion failures propagate out of the transaction without trying later suggestions', async () => {
    client.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{}] })
        .mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] }).mockRejectedValueOnce(new Error('insert failed'));
    await expect(storeSuggestions(1, [{ type: 'create_pattern', config: {} }, { type: 'create_pattern', config: { next: true } }]))
        .rejects.toThrow('insert failed');
    expect(client.query).toHaveBeenCalledTimes(5);
    expect(db.query).not.toHaveBeenCalled();
});
