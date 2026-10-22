/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterAll, expect, jest, test } from '@jest/globals';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';
import { createInventoryDescriptionRefreshRepository } from '../../services/inventoryDescriptionRefreshRepository.mjs';
import { createInventoryRepresentativeProfileRepository, REPRESENTATIVE_PROFILE_LIBRARIES_SQL } from '../../services/inventoryRepresentativeProfileRepository.mjs';
import { createInventoryRepresentativeProfileRefresh } from '../../services/inventoryRepresentativeProfileRefresh.mjs';
import { registerInventoryRepresentativeProfileSchedule } from '../../services/inventoryRepresentativeProfileScheduler.mjs';
import { createSchedulerTaskExecutionRunner } from '../../services/schedulerTaskExecutionRunner.mjs';
import { LoggerShim, setDb } from '../../utils/logging/loggerShim.mjs';
import { representativeProfileFixture } from '../helpers/inventoryRepresentativeProfileFixture.mjs';

const database = createIntegrationDatabaseModuleMock();
afterAll(() => setDb(null));

test.each([
  ['snapshot_read', 'SELECT pg_sleep(30)'],
  ['state_read', 'SELECT pg_cancel_backend(pg_backend_pid()), pg_sleep(30)'],
])('real PostgreSQL cancellation at %s survives worker/scheduler/persisted log boundaries', async (stage, faultSql) => {
  setDb(database);
  const { state, identity } = representativeProfileFixture();
  const faulty = { withTransaction: callback => database.withTransaction(client => callback({
    // Keep actual configured SET LOCAL limits. Only a disposable SELECT is replaced.
    query: (sql, params) => {
      const fault = stage === 'state_read' ? sql.trimStart().startsWith('SELECT rag_enabled') : sql === REPRESENTATIVE_PROFILE_LIBRARIES_SQL;
      return client.query(fault ? faultSql : sql, fault ? [] : params);
    },
  })) };
  const worker = createInventoryRepresentativeProfileRefresh({ now: () => 0,
    readState: stage === 'state_read' ? createInventoryDescriptionRefreshRepository(faulty).readState : async () => state,
    repository: createInventoryRepresentativeProfileRepository(faulty),
    createEmbedder: () => ({ ...identity, inspect: async () => identity }), fit: jest.fn(),
  });
  const pending = [];
  const logger = new LoggerShim({ bindings: () => ({ module: 'RepresentativeRefreshIntegration' }), error() {} });
  const scheduler = { schedule: jest.fn(), scheduleInitial: jest.fn() };
  registerInventoryRepresentativeProfileSchedule(scheduler, { worker, log: { info: jest.fn() } });
  const runner = createSchedulerTaskExecutionRunner({ withSessionAdvisoryLock: database.withSessionAdvisoryLock,
    logger: { info() {}, debug() {}, error: (...args) => { const result = logger.error(...args); pending.push(result); return result; } } });
  try {
    expect(await runner.run({ name: 'inventory-representative-profile-refresh', handler: scheduler.schedule.mock.calls[0][2] })).toBe(false);
    const ids = await Promise.all(pending);
    expect(ids).toEqual([expect.any(String)]);
    const { rows } = await database.query('SELECT metadata FROM error_log WHERE error_id = $1', [ids[0]]);
    expect(rows).toHaveLength(1);
    expect(rows[0].metadata).toMatchObject({ error: 'inventory_representative_refresh_unavailable', failure: {
      stage, category: 'database_query_cancelled', sqlState: '57014', incidentId: expect.any(String),
      operationDurationMs: expect.any(Number), databaseDurationMs: expect.any(Number),
    } });
    expect(rows[0].metadata.failure).toEqual(worker.getStatus().failure);
    expect(JSON.stringify(rows)).not.toMatch(/pg_sleep|pg_cancel_backend|statement timeout|parameters|PRIVATE|password/);
    expect(worker.getStatus().cacheStored).toBe(false);
    expect((await database.query('SELECT 1 AS healthy')).rows[0].healthy).toBe(1);
  } finally { worker.stop(); }
});
