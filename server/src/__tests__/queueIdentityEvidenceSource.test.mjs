/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { planQueueIdentityEvidence } from '../services/queueIdentityEvidenceSource.mjs';

const task = { tmdb_id: '42', media_type: 'tv', task_imdb_id: 'tt123', task_tvdb_id: 7 };
const source = { webhook_log_id: 9, source_id: 9, source_tmdb_id: 42, source_media_type: 'tv' };

test('task and directly linked declarations normalize into at most two requests', () => {
  expect(planQueueIdentityEvidence({ ...task, ...source, source_imdb_id: 'tt123', source_imdb_legacy_id: 'tt123',
    source_tvdb_id: 7, source_payload_tvdb_id: '7', source_payload_tvdb_legacy_id: 7 })).toEqual({
    reason: null, requests: [{ source: 'imdb_id', externalId: 'tt123' }, { source: 'tvdb_id', externalId: 7 }],
  });
});
test('a task without a linked webhook can use its own retained IDs', () => {
  expect(planQueueIdentityEvidence(task).requests).toHaveLength(2);
});
test('unlinked fields and TVDB movie declarations cannot supply evidence', () => {
  expect(planQueueIdentityEvidence({ media_type: 'movie', task_tvdb_id: 7, source_imdb_id: 'tt123' }).reason)
    .toBe('external_ids_missing');
});
test.each([
  [{ source_id: null }, 'source_unavailable'], [{ source_id: 10 }, 'source_unavailable'],
  [{ source_tmdb_id: 99 }, 'source_conflict'], [{ source_tmdb_id: null }, 'source_conflict'],
  [{ source_media_type: 'movie' }, 'source_conflict'],
  [{ source_imdb_id: 'tt456' }, 'conflicting_external_ids'],
  [{ source_imdb_legacy_id: 'tt456' }, 'conflicting_external_ids'],
  [{ source_payload_tvdb_id: 8 }, 'conflicting_external_ids'],
  [{ source_payload_tvdb_legacy_id: 8 }, 'conflicting_external_ids'],
  [{ task_imdb_id: [] }, 'invalid_external_id'], [{ task_tvdb_id: {} }, 'invalid_external_id'],
  [{ source_imdb_id: '' }, 'invalid_external_id'], [{ source_tvdb_id: 0 }, 'invalid_external_id'],
])('blocks incomplete/conflicting evidence %j', (patch, reason) => {
  expect(planQueueIdentityEvidence({ ...task, ...source, ...patch })).toEqual({ reason, requests: [] });
});
