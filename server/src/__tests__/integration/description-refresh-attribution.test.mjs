/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterAll, expect, jest, test } from '@jest/globals';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';
import { createInventoryDescriptionRefreshRepository, INVENTORY_DESCRIPTION_REFRESH_CORPUS_SQL } from '../../services/inventoryDescriptionRefreshRepository.mjs';
import { createInventoryDescriptionRefreshWorker } from '../../services/inventoryDescriptionRefreshWorker.mjs';
import { createInventoryDescriptionRecovery } from '../../services/inventoryDescriptionRecovery.mjs';
import { registerInventoryDescriptionRefreshSchedule } from '../../services/inventoryDescriptionRefreshScheduler.mjs';
import { createSchedulerTaskExecutionRunner } from '../../services/schedulerTaskExecutionRunner.mjs';
import { LoggerShim, setDb } from '../../utils/logging/loggerShim.mjs';

const database = createIntegrationDatabaseModuleMock();
afterAll(() => setDb(null));

test.each([
  ['statement deadline', 'SELECT pg_sleep(30)'],
  ['explicit self-cancellation', 'SELECT pg_cancel_backend(pg_backend_pid()), pg_sleep(30)'],
])('real PostgreSQL %s survives worker, recovery, scheduler and persisted log boundaries', async (_name, faultSql) => {
  setDb(database);
  const pending = [];
  const pino = module => ({ bindings: () => ({ module }), error() {}, warn() {}, info() {} });
  const recoveryLogger = new LoggerShim(pino('DescriptionRefreshIntegration'));
  const schedulerLogger = new LoggerShim(pino('SchedulerIntegration'));
  const persist = (logger, level) => (...args) => {
    const result = logger[level](...args); pending.push(result); return result;
  };
  const recovery = createInventoryDescriptionRecovery({ now: () => 0, random: () => 0,
    log: { warn: persist(recoveryLogger, 'warn'), info: jest.fn() } });
  const repository = createInventoryDescriptionRefreshRepository({
    withTransaction: callback => database.withTransaction(client => callback({
      // Retain the real SET LOCAL deadlines. Only this disposable test's SELECT is delayed.
      query: (sql, params) => client.query(sql === INVENTORY_DESCRIPTION_REFRESH_CORPUS_SQL ? faultSql : sql,
        sql === INVENTORY_DESCRIPTION_REFRESH_CORPUS_SQL ? [] : params),
    })),
  });
  const createEmbedder = jest.fn();
  const worker = createInventoryDescriptionRefreshWorker({
    repository: { ...repository, readState: async () => ({ rag_enabled: true, embedding_provider_mode: 'same',
      primary_provider: 'ollama', embedding_model: 'test', ollama_host: 'localhost', ollama_port: 11434, busy: false }) },
    cache: { pruneExpired: async () => 0 }, isolation: { pruneExpired: async () => {} },
    createEmbedder, withSessionAdvisoryLock: database.withSessionAdvisoryLock, recovery,
  });
  const scheduler = { schedule: jest.fn(), scheduleInitial: jest.fn() };
  registerInventoryDescriptionRefreshSchedule(scheduler, { worker, log: { info: jest.fn() } });
  const runner = createSchedulerTaskExecutionRunner({ withSessionAdvisoryLock: database.withSessionAdvisoryLock,
    logger: { info: jest.fn(), debug: jest.fn(), error: persist(schedulerLogger, 'error') } });
  expect(await runner.run({ name: 'inventory-description-refresh', handler: scheduler.schedule.mock.calls[0][2] })).toBe(false);
  const ids = await Promise.all(pending);
  expect(ids).toHaveLength(2);
  expect(ids.every(id => typeof id === 'string')).toBe(true);
  const { rows } = await database.query('SELECT level, metadata FROM error_log WHERE error_id = ANY($1::uuid[]) ORDER BY level', [ids]);
  expect(rows).toHaveLength(2);
  expect(rows[0].metadata.failure).toEqual(rows[1].metadata.failure);
  expect(rows[0].metadata).toMatchObject({ retryAfterSeconds: 60, failure: {
    stage: 'corpus_read', category: 'database_query_cancelled', sqlState: '57014',
    incidentId: expect.any(String), operationDurationMs: expect.any(Number), databaseDurationMs: expect.any(Number),
  } });
  expect(JSON.stringify(rows)).not.toMatch(/pg_sleep|pg_cancel_backend|canceling statement due to statement timeout|parameters|password/i);
  expect(createEmbedder).not.toHaveBeenCalled();
  expect(await worker.run()).toMatchObject({ status: 'cooldown' });
  // A rolled-back deadline does not contaminate a pooled connection's later query.
  expect((await repository.query('SELECT 1 AS healthy')).rows[0].healthy).toBe(1);
});
