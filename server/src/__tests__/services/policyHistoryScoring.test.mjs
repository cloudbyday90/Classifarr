/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';
import { createPolicyHistoryScorer, scoreHistory } from '../../services/policyHistoryScoring.mjs';
import { scoreHistory as facadeScoreHistory } from '../../services/policyEngineSourceScoring.mjs';
import { buildPolicyHistoryScoringQuery } from '../../services/policyHistoryScoringQuery.mjs';

const movie = { tmdb_id: 42, media_type: 'movie' };

describe('policy history scoring', () => {
  test('preserves the source-scoring named export', () => {
    expect(facadeScoreHistory).toBe(scoreHistory);
  });

  test('normalizes the typed identity and keeps values outside SQL text', async () => {
    const query = jest.fn(async () => ({ rows: [{ library_id: 10, confidence: '58.25', match_count: '2' }] }));
    const scorer = createPolicyHistoryScorer({ query });
    expect(await scorer('10', { tmdb_id: ' 0042 ', media_type: ' TV ' })).toBe(78.25);
    expect(query).toHaveBeenCalledWith(expect.any(String), [42, 'tv']);
    expect(query.mock.calls[0][0]).not.toContain('0042');
  });

  test.each([
    undefined, null, {}, { tmdb_id: 42 }, { media_type: 'movie' },
    { ...movie, media_type: '' }, { ...movie, media_type: 'series' },
    { ...movie, media_type: 'person' }, { ...movie, media_type: ['movie'] },
    { ...movie, media_type: "movie' OR true --" },
    ...[0, -1, 1.5, NaN, Infinity, 2_147_483_648, '', '1e2', '0x2a', '42x', '42 OR 1=1', true, [42], {}]
      .map((tmdb_id) => ({ ...movie, tmdb_id })),
  ])('invalid media identity contributes no score or database request (%p)', async (item) => {
    const query = jest.fn();
    expect(await createPolicyHistoryScorer({ query })(10, item)).toBe(0);
    expect(query).not.toHaveBeenCalled();
  });

  test.each([null, 0, -1, true, [10], '10x', 2_147_483_648])('rejects invalid destination ID %p before database access', async (libraryId) => {
    const query = jest.fn();
    expect(await createPolicyHistoryScorer({ query })(libraryId, movie)).toBe(0);
    expect(query).not.toHaveBeenCalled();
  });

  test('retains PostgreSQL integer endpoints without widening the type', () => {
    expect(buildPolicyHistoryScoringQuery(1, { ...movie, tmdb_id: 2_147_483_647 }).values).toEqual([2_147_483_647, 'movie']);
  });

  test.each([
    [{ confidence: 99, match_count: 4 }, 95],
    [{ confidence: '60.00', match_count: '1' }, 70],
    [{ confidence: 25, match_count: 10 }, 65],
    [{ confidence: null, match_count: 1 }, 0],
    [{ confidence: -1, match_count: 1 }, 0],
    [{ confidence: 101, match_count: 1 }, 0],
    [{ confidence: 'bad', match_count: 1 }, 0],
    [{ confidence: 60, match_count: '1x' }, 0],
    [{ confidence: 60, match_count: 0 }, 0],
    [{ confidence: 60, match_count: 1.5 }, 0],
  ])('scores bounded aggregates %p as %p', async (aggregate, expected) => {
    const query = async () => ({ rows: [{ library_id: 10, ...aggregate }] });
    expect(await createPolicyHistoryScorer({ query })(10, movie)).toBe(expected);
  });

  test('unmatched libraries and database failures contribute zero without exposing details', async () => {
    const logger = { debug: jest.fn() };
    const query = jest.fn(async () => ({ rows: [{ library_id: 20, confidence: 99, match_count: 4 }] }));
    const scorer = createPolicyHistoryScorer({ query, logger });
    expect(await scorer(10, movie)).toBe(0);
    query.mockRejectedValueOnce(new Error('Private item title, database host and SQL parameters'));
    expect(await scorer(10, movie)).toBe(0);
    expect(logger.debug).toHaveBeenCalledWith('History scoring unavailable', { reason: 'history_query_failed' });
    expect(JSON.stringify(logger.debug.mock.calls)).not.toMatch(/Private|parameters|42/u);
  });
});
