/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterAll, expect, jest, test } from '@jest/globals';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';
import { createInventoryDescriptionRefreshRuntime, registerInventoryDescriptionRefreshSchedule } from '../../services/inventoryDescriptionRefreshScheduler.mjs';
import { createInventoryRepresentativeProfileRuntime, registerInventoryRepresentativeProfileSchedule } from '../../services/inventoryRepresentativeProfileScheduler.mjs';
import { INVENTORY_BACKGROUND_READINESS_SQL } from '../../services/inventoryBackgroundReadiness.mjs';
import { createSchedulerTaskExecutionRunner } from '../../services/schedulerTaskExecutionRunner.mjs';
import { LoggerShim, setDb } from '../../utils/logging/loggerShim.mjs';

const database = createIntegrationDatabaseModuleMock();
afterAll(() => setDb(null));
const runtimes = [
  ['description', createInventoryDescriptionRefreshRuntime, registerInventoryDescriptionRefreshSchedule, 'inventoryDescriptionRefreshWorker'],
  ['representative', createInventoryRepresentativeProfileRuntime, registerInventoryRepresentativeProfileSchedule, 'inventoryRepresentativeProfileWorker'],
];
const faults = [
  ['simulated disk-full', "DO $fault$ BEGIN RAISE EXCEPTION USING ERRCODE='53100', MESSAGE='PRIVATE file/token'; END; $fault$", 'database_disk_full', '53100'],
  ['simulated permission refusal', "DO $fault$ BEGIN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='PRIVATE role'; END; $fault$", 'database_permission', '42501'],
  ['statement deadline', 'SELECT pg_sleep(30)', 'database_query_cancelled', '57014'],
];

test.each(runtimes.flatMap(([name, create, register, workerKey]) =>
  faults.map(([faultName, sql, category, sqlState]) => ({ name, create, register, workerKey, faultName, sql, category, sqlState }))))(
  '$name readiness ($faultName) remains deferred with a safe persisted warning',
  async ({ create, register, workerKey, sql, category, sqlState }) => {
    setDb(database);
    await database.query('UPDATE ai_provider_config SET rag_enabled=false WHERE id=1');
    let inject = true;
    const lock = jest.fn();
    const runtime = create({ ...database, withSessionAdvisoryLock: lock,
      withTransaction: callback => database.withTransaction(client => callback({ query: (query, parameters) =>
        client.query(inject && query === INVENTORY_BACKGROUND_READINESS_SQL ? sql : query, parameters) })),
    });
    const pending = [], pino = { bindings: () => ({ module: 'RefreshReadinessIntegration' }), warn() {} };
    const logger = new LoggerShim(pino);
    const log = { info: jest.fn(), warn: (...args) => { const saved = logger.warn(...args); pending.push(saved); return saved; } };
    const scheduler = { schedule: jest.fn(), scheduleInitial: jest.fn() };
    register(scheduler, { worker: runtime, log });
    const receiptRecorder = { record: jest.fn() }, schedulerLogger = { info: jest.fn(), debug: jest.fn(), error: jest.fn() };
    const runner = createSchedulerTaskExecutionRunner({ withSessionAdvisoryLock: lock, logger: schedulerLogger, receiptRecorder });
    try {
      const tick = scheduler.schedule.mock.calls[0][2];
      // The callback returned a deferral, preserving the existing completed execution receipt.
      expect(await runner.run({ name: scheduler.schedule.mock.calls[0][0], handler: tick, quiet: true })).toBe(true);
      expect(receiptRecorder.record).toHaveBeenCalledWith(expect.objectContaining({ outcomeId: 'completed' }));
      expect(schedulerLogger.error).not.toHaveBeenCalled();
      const ids = await Promise.all(pending);
      expect(ids).toEqual([expect.any(String)]);
      const { rows } = await database.query('SELECT level, metadata, stack_trace FROM error_log WHERE error_id=$1', [ids[0]]);
      expect(rows).toEqual([{ level: 'WARN', stack_trace: null, metadata: expect.objectContaining({
        failure: { incidentId: expect.any(String), stage: 'readiness', category, sqlState, databaseDurationMs: expect.any(Number) },
        steps: expect.stringContaining('existing schedule'), routingAffected: false,
      }) }]);
      expect(JSON.stringify(rows)).not.toMatch(/PRIVATE|file\/token|pg_sleep|parameters|one hour|retryAfterSeconds|slowRetry/);
      expect(lock).not.toHaveBeenCalled();
      expect((await database.query('SELECT 1 AS healthy')).rows[0].healthy).toBe(1);
      inject = false;
      // The isolated fresh setup still refuses heavy work; no preflight failure creates a worker hold.
      expect(await tick()).toMatchObject({ status: 'deferred', reason: 'disabled' });
      expect(pending).toHaveLength(1); expect(log.info).not.toHaveBeenCalled();
      expect(lock).not.toHaveBeenCalled();
    } finally { scheduler[workerKey].stop(); setDb(null); }
  },
);
