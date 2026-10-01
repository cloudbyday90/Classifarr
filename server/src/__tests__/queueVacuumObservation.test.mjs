/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { inspectQueueVacuum } from '../services/queueVacuumObservation.mjs';
import { queueVacuumRow } from './helpers/queueVacuumFixture.mjs';

test('fresh statistics are not failed health or proof of completion; fixed projection excludes internals', async () => {
  const query = jest.fn().mockResolvedValue({ rows: [queueVacuumRow({
    n_live_tup: '0', n_dead_tup: '0', secret: 'private', last_vacuum: 'invalid',
    last_analyze: new Date('2026-10-01T00:00:00Z'),
  })] });
  const result = await inspectQueueVacuum({ database: { query } });
  expect(result).toMatchObject({ status: 'autovacuum_enabled', reason: null,
    estimates: { liveRows: 0, deadRows: 0 }, lastVacuum: null, lastAutovacuum: null,
    lastAnalyze: '2026-10-01T00:00:00.000Z' });
  expect(result).not.toHaveProperty('relation_oid');
  expect(JSON.stringify(result)).not.toContain('private');
  expect(query).toHaveBeenCalledTimes(1);
  expect(query.mock.calls[0][0]).toContain("c.relname = 'task_queue'");
});
test.each([
  [null, 'queue_relation_missing'], [{ relation_supported: false }, 'queue_relation_unsupported'],
  [{ autovacuum: false }, 'autovacuum_disabled'], [{ table_enabled: false }, 'queue_autovacuum_disabled'],
  [{ track_counts: false }, 'statistics_disabled'], [{ statistics_available: false }, 'statistics_unavailable'],
  [{ n_dead_tup: '9007199254740993' }, 'statistics_unavailable'], [{ n_dead_tup: '-1' }, 'statistics_unavailable'],
  [{ n_dead_tup: null }, 'statistics_unavailable'], [{ n_dead_tup: 1.2 }, 'statistics_unavailable'],
])('unavailable configuration %j never reports enabled', async (change, reason) => {
  const database = { query: jest.fn().mockResolvedValue({ rows: change === null ? [] : [queueVacuumRow(change)] }) };
  expect(await inspectQueueVacuum({ database })).toMatchObject({ status: 'attention', reason });
});
