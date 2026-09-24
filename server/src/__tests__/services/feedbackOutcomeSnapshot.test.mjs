/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import { buildFeedbackOutcomeSnapshot, readFeedbackOutcomeSnapshot, pruneFeedbackOutcomeSnapshots } from '../../services/feedbackOutcomeSnapshot.mjs';
import { buildClassificationDestinationDecision } from '../../services/classificationDestinationDecision.mjs';

const capture = buildClassificationDestinationDecision({ metadata: { media_type: 'movie', tmdb_id: 42 },
  method: 'ai_analysis', status: 'completed', libraryId: 2 });
const source = { id: 1, media_type: 'movie', tmdb_id: 42, method: 'ai_analysis',
  title: 'Do not retain', metadata: { classification_details: { destination_decision: capture } } };

test('retains only typed original context and validated explicit selection', () => {
  const snapshot = buildFeedbackOutcomeSnapshot(source, 3);
  expect(snapshot).toEqual({ version: 'classification.feedback_outcome.v1', mediaType: 'movie', tmdbId: 42,
    selectedLibraryId: 3, decisionContext: { classificationId: 1, capture } });
  expect(readFeedbackOutcomeSnapshot(snapshot)).toEqual(snapshot);
  expect(JSON.stringify(snapshot)).not.toContain('Do not retain');
  expect(buildFeedbackOutcomeSnapshot({ ...source, metadata: {}, library_id: 3 }, 3).decisionContext).toBeNull();
  expect(buildFeedbackOutcomeSnapshot({ ...source, id: '9223372036854775807' }, 3).decisionContext).toBeNull();
  expect(buildFeedbackOutcomeSnapshot(null, 3)).toBeNull();
});

test.each([null, [], {}])('rejects absent or incomplete snapshot %j', value => {
  expect(readFeedbackOutcomeSnapshot(value)).toBeNull();
});

test.each([{ extra: 'private' }, { version: 'unknown' }, { mediaType: 'music' },
  { tmdbId: '42' }, { tmdbId: 0 }, { selectedLibraryId: false }, { decisionContext: {} },
  { decisionContext: { classificationId: 1, capture: { ...capture, mediaType: 'tv' } } },
  { decisionContext: { classificationId: 1, capture: { ...capture, tmdbId: 43 } } }])('rejects malformed snapshot %j', change => {
  expect(readFeedbackOutcomeSnapshot({ ...buildFeedbackOutcomeSnapshot(source, 3), ...change })).toBeNull();
});

test.each(['music', 'audio', null])('unsupported media %s never becomes a confirmation', media_type => {
  expect(buildFeedbackOutcomeSnapshot({ ...source, media_type }, 3)).toBeNull();
});

test('expiry is bounded and clears evidence without deleting replay protection', async () => {
  const client = { query: jest.fn().mockResolvedValue({ rowCount: 2 }) };
  expect(await pruneFeedbackOutcomeSnapshots(client)).toBe(2);
  const sql = client.query.mock.calls[0][0];
  expect(sql).toContain('outcome_snapshot = NULL');
  expect(sql).toContain('LIMIT 1000 FOR UPDATE SKIP LOCKED');
  expect(sql).not.toMatch(/DELETE|SET created_at/);
  client.query.mockRejectedValueOnce(new Error('unavailable'));
  await expect(pruneFeedbackOutcomeSnapshots(client)).rejects.toThrow('unavailable');
});
