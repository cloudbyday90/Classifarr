/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { runManualSuggestionAnalysisSummary, serializeSuggestionAnalysisSummary,
  SUGGESTION_ANALYSIS_INSUFFICIENT_FEEDBACK } from '../../services/manualSuggestionAnalysisSummary.mjs';

test('packs all attempted outcomes while keeping the lookahead policy untouched', async () => {
  const rows = Array.from({ length: 25 }, (_, index) => ({ id: 101 + index }));
  const db = { query: jest.fn().mockResolvedValue({ rows }) };
  const analyze = jest.fn(async policyId => ({ policyId, feedbackCount: 128,
    analysis: { keyword: 'discard this detail' }, suggestions: [{ evidence: 'discard this detail' }] }));
  analyze.mockResolvedValueOnce({ policyId: 101, feedbackCount: 3, suggestions: [], message: SUGGESTION_ANALYSIS_INSUFFICIENT_FEEDBACK });
  analyze.mockRejectedValueOnce(new Error('private database error'));
  analyze.mockResolvedValueOnce({ policyId: 103, feedbackCount: 128, suggestions: [] });

  const result = await runManualSuggestionAnalysisSummary(db, analyze, 100);
  expect(db.query).toHaveBeenCalledWith(expect.stringContaining('ORDER BY id LIMIT $2'), [100, 25]);
  expect(analyze.mock.calls).toEqual(rows.slice(0, 24).map(row => [row.id]));
  expect(result).toMatchObject({ format: 'summary-v1', policiesAttempted: 24,
    counts: { completed: 21, insufficient_feedback: 1, unconfirmed: 2 }, nextAfterPolicyId: 124 });
  expect(result.results.slice(0, 4)).toEqual([
    { policyId: 101, status: 'insufficient_feedback', feedbackCount: 3, suggestionsCreated: 0 },
    { policyId: 102, status: 'unconfirmed', feedbackCount: null, suggestionsCreated: null },
    { policyId: 103, status: 'unconfirmed', feedbackCount: null, suggestionsCreated: null },
    { policyId: 104, status: 'completed', feedbackCount: 128, suggestionsCreated: 1 },
  ]);
  expect(serializeSuggestionAnalysisSummary(result)).not.toMatch(/private database error|discard this detail/);
});

test('serializes maximum-width fixed fields inside 4 KiB', () => {
  const results = Array.from({ length: 24 }, (_, index) => ({ policyId: 2147483623 + index,
    status: 'insufficient_feedback', feedbackCount: 5000, suggestionsCreated: 4294967295 }));
  const summary = { format: 'summary-v1', policiesAttempted: 24,
    counts: { completed: 0, insufficient_feedback: 24, unconfirmed: 0 }, nextAfterPolicyId: 2147483646, results };

  expect(Buffer.byteLength(serializeSuggestionAnalysisSummary(summary))).toBeLessThanOrEqual(4096);
  expect(() => serializeSuggestionAnalysisSummary({ ...summary, extra: '😀'.repeat(1025) })).toThrow(/response limit/);
});
