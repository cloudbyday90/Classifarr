/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { getPool } from './setup.mjs';
import { createLiveMultiScaleRefresh } from '../../services/liveMultiScaleRefresh.mjs';
import { withInventoryBackgroundReadiness } from '../../services/inventoryBackgroundReadiness.mjs';
import { diagnoseLiveMultiScaleFailure } from '../../services/liveMultiScaleFailure.mjs';

test.each([
  ["SELECT * FROM comparison_failure_fixture_missing_table", 'database_schema'],
  ['SELECT pg_sleep(1)', 'database_query_cancelled'],
])('classifies actual isolated PostgreSQL failure without returning SQL: %s', async (sql, code) => {
  const client = await getPool().connect();
  const createEmbedder = jest.fn();
  const readState = async () => {
    await client.query('BEGIN READ ONLY');
    try {
      await client.query("SET LOCAL statement_timeout='25ms'");
      await client.query(sql);
      throw new Error('Expected the synthetic query to fail');
    } finally { await client.query('ROLLBACK'); }
  };
  const worker = createLiveMultiScaleRefresh({ repository: { read: jest.fn() }, readState, createEmbedder, random: () => 0 });
  try {
    expect(await worker.run()).toEqual({ status: 'unavailable', failure: { stage: 'state_read', code } });
    expect(createEmbedder).not.toHaveBeenCalled();
    const wrapped = withInventoryBackgroundReadiness(worker, {}, readState, error => diagnoseLiveMultiScaleFailure('readiness', error));
    expect(await wrapped.run()).toEqual({ status: 'deferred', reason: 'unavailable', failure: { stage: 'readiness', code } });
    expect((await client.query('SELECT 1 AS healthy')).rows).toEqual([{ healthy: 1 }]);
  } finally { worker.stop(); client.release(); }
});
