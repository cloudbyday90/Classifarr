/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { observeDescriptionRefreshStage, observeDescriptionDatabaseOperation, readDescriptionRefreshObservation } from '../../services/inventoryDescriptionRefreshObservation.mjs';
import { createInventoryDescriptionRecovery } from '../../services/inventoryDescriptionRecovery.mjs';
import { createDescriptionRefreshTaskError, readDescriptionRefreshTaskFailure } from '../../services/inventoryDescriptionRefreshFailure.mjs';
import { createSchedulerTaskExecutionRunner } from '../../services/schedulerTaskExecutionRunner.mjs';

async function observed(error, stage = 'corpus_read', database = true) {
  let tick = 0;
  const clock = () => (tick += 5);
  try {
    await observeDescriptionRefreshStage(stage, () => database
      ? observeDescriptionDatabaseOperation(() => Promise.reject(error), { clock })
      : Promise.reject(error), { clock });
  } catch (failure) { return failure; }
  throw new Error('fixture_did_not_fail');
}

test('preserves error identity while recording bounded stage and database cancellation, not inferred timeout', async () => {
  const error = Object.assign(new Error('PRIVATE query/token'), { code: '57014', detail: 'PRIVATE SQL', cause: new Error('PRIVATE') });
  expect(await observed(error)).toBe(error);
  expect(readDescriptionRefreshObservation(error)).toEqual({
    stage: 'corpus_read', operationDurationMs: 15, databaseDurationMs: 5,
    databaseCategory: 'database_query_cancelled', sqlState: '57014',
  });
  expect(error).not.toHaveProperty('failure');
  const recovery = createInventoryDescriptionRecovery({ now: () => 0, random: () => 0 });
  const report = recovery.failed(error);
  expect(report).toMatchObject({ failureCode: 'database_query_cancelled', retryAfterSeconds: 60,
    failure: { stage: 'corpus_read', category: 'database_query_cancelled', sqlState: '57014', operationDurationMs: 15 } });
  expect(JSON.stringify(report)).not.toMatch(/PRIVATE|query\/token|timeout/);
});

test('provider-supplied SQLSTATE is not attributed to the database', async () => {
  const error = await observed({ code: '57014', message: 'PRIVATE' }, 'representation_inspection', false);
  const report = createInventoryDescriptionRecovery().failed(error);
  expect(report.failure.category).toBe('unknown');
  expect(report.failure).not.toHaveProperty('sqlState');
  expect(report.failure).not.toHaveProperty('databaseDurationMs');
});

test.each([null, 'PRIVATE', { code: 'PRIVATE' }, Object.defineProperty({}, 'code', { get() { throw Error('PRIVATE'); } })])(
  'unknown/hostile thrown values cannot leak through database diagnostics', async value => {
    const report = createInventoryDescriptionRecovery().failed(await observed(value));
    expect(report.failure.category).toBe('database_unknown');
    expect(JSON.stringify(report)).not.toMatch(/PRIVATE/);
    expect(report.failure).not.toHaveProperty('sqlState');
  },
);

test('nested stages retain the innermost failure and malformed durations/stages are bounded', async () => {
  let error;
  try {
    await observeDescriptionRefreshStage('advisory_lock', () => observeDescriptionRefreshStage('PRIVATE',
      () => Promise.reject(new Error('PRIVATE')), { clock: () => Infinity }));
  } catch (failure) { error = failure; }
  expect(readDescriptionRefreshObservation(error)).toEqual({ stage: 'refresh', operationDurationMs: null });
  expect(await observeDescriptionRefreshStage('corpus_read', async () => 42)).toBe(42);
});

test('an incident reference survives warning deduplication, scheduler propagation and recovery completion', async () => {
  const log = { warn: jest.fn(), info: jest.fn() };
  let time = 0;
  const recovery = createInventoryDescriptionRecovery({ log, now: () => time, random: () => 0 });
  const first = recovery.failed(await observed({ code: '57014' }));
  time = 60000;
  const second = recovery.failed(await observed({ code: '57014' }));
  expect(second.failure.incidentId).toBe(first.failure.incidentId);
  expect(log.warn).toHaveBeenCalledTimes(1);
  expect(log.warn.mock.calls[0][1].failure).toEqual(first.failure);
  expect(log.warn.mock.calls[0][0]).not.toMatch(/provider data/i);
  const logger = { error: jest.fn(), info: jest.fn(), debug: jest.fn() };
  const runner = createSchedulerTaskExecutionRunner({ withSessionAdvisoryLock: jest.fn(), logger });
  expect(await runner.run({ name: 'inventory-description-refresh', handler: async () => { throw createDescriptionRefreshTaskError(second); } })).toBe(false);
  expect(logger.error.mock.calls[0][1]).toEqual({ error: 'inventory_description_refresh_unavailable', failure: second.failure, retryAfterSeconds: 120 });
  recovery.completed();
  expect(log.info.mock.calls[0][1].failure.incidentId).toBe(first.failure.incidentId);
  expect(recovery.failed(await observed({ code: '57014' })).failure.incidentId).not.toBe(first.failure.incidentId);
});

test('separate failure stages do not hide each other under one deduplication key', async () => {
  const log = { warn: jest.fn() };
  const recovery = createInventoryDescriptionRecovery({ log });
  const first = recovery.failed(await observed({ code: '57014' }, 'state_read'));
  const second = recovery.failed(await observed({ code: '57014' }, 'corpus_read'));
  expect(first.failure.incidentId).not.toBe(second.failure.incidentId);
  expect(log.warn).toHaveBeenCalledTimes(2);
});

test('only branded, allowlisted scheduler diagnostics can be read', () => {
  expect(readDescriptionRefreshTaskFailure({ failure: { stage: 'PRIVATE' } })).toBeNull();
  const error = createDescriptionRefreshTaskError({ failure: {
    incidentId: 'PRIVATE', stage: 'PRIVATE', category: 'PRIVATE', sqlState: 'PRIVATE',
    operationDurationMs: Infinity, databaseDurationMs: -1, extra: 'PRIVATE',
  }, retryAfterSeconds: Infinity });
  expect(JSON.stringify(readDescriptionRefreshTaskFailure(error))).not.toMatch(/PRIVATE|extra/);
  expect(readDescriptionRefreshTaskFailure(error)).toEqual({});
  const hostile = Object.defineProperty({}, 'failure', { get() { throw Error('PRIVATE'); } });
  expect(() => createDescriptionRefreshTaskError(hostile)).not.toThrow();
});

test.each([
  ['55P03', 'database_lock_unavailable'], ['40P01', 'database_deadlock'], ['40001', 'database_serialization'],
  ['08006', 'database_connection'], ['53300', 'database_capacity'], ['57P01', 'database_shutdown'],
  ['42501', 'database_permission'], ['42P01', 'database_schema'],
])('database %s attribution does not alter the original short-retry budget', async (code, category) => {
  const report = createInventoryDescriptionRecovery({ random: () => 0 }).failed(await observed(Object.freeze({ code })));
  expect(report).toMatchObject({ failureCode: category, retryAfterSeconds: 60, failure: { sqlState: code, category } });
});

test('consumed observation cannot misattribute a reused error to an earlier stage', async () => {
  const error = new Error('PRIVATE');
  const recovery = createInventoryDescriptionRecovery();
  const first = recovery.failed(await observed(error, 'state_read', false));
  const second = recovery.failed(await observed(error, 'corpus_read', false));
  expect(first.failure.stage).toBe('state_read');
  expect(second.failure.stage).toBe('corpus_read');
  expect(first.failure.incidentId).not.toBe(second.failure.incidentId);
});

test.each([() => 1n, () => ({ valueOf() { throw Error('PRIVATE'); } }), () => { throw Error('PRIVATE'); }])(
  'invalid clocks never replace an operational failure', async clock => {
    const error = new Error('PRIVATE original');
    await expect(observeDescriptionRefreshStage('corpus_read', () => { throw error; }, { clock })).rejects.toBe(error);
    expect(readDescriptionRefreshObservation(error).operationDurationMs).toBeNull();
  },
);

test('scheduler envelope caps durations and drops inconsistent SQLSTATE and arbitrary fields', () => {
  const incidentId = '12345678-1234-1234-1234-123456789abc';
  const failure = { incidentId, category: 'unknown', stage: 'PRIVATE', sqlState: '57014',
    operationDurationMs: Number.MAX_VALUE, databaseDurationMs: null, sql: 'PRIVATE' };
  const error = createDescriptionRefreshTaskError({ failure, retryAfterSeconds: 3600 });
  expect(readDescriptionRefreshTaskFailure(error)).toEqual({ retryAfterSeconds: 3600,
    failure: { incidentId, category: 'unknown', stage: 'refresh', operationDurationMs: 86_400_000, databaseDurationMs: null } });
  failure.incidentId = 'PRIVATE';
  expect(readDescriptionRefreshTaskFailure(error).failure.incidentId).toBe(incidentId);
  expect(JSON.stringify(readDescriptionRefreshTaskFailure(error))).not.toContain('PRIVATE');
});
