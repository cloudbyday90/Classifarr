/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, expect, jest, test } from '@jest/globals';
import { observeRepresentativeStage, observeRepresentativeDatabaseOperation, observeRepresentativeTransaction } from '../../services/inventoryRepresentativeRefreshObservation.mjs';
import { createRepresentativeRefreshFailure, createRepresentativeRefreshTaskError, readRepresentativeRefreshTaskFailure } from '../../services/inventoryRepresentativeRefreshFailure.mjs';
import { createInventoryRepresentativeProfileRefresh } from '../../services/inventoryRepresentativeProfileRefresh.mjs';
import { buildInventoryRepresentativeProfile, inventoryRepresentativeSourceKey } from '../../services/inventoryRepresentativeProfile.mjs';
import { resolveLocalStudyEmbeddingConfig } from '../../services/localStudyEmbeddingClient.mjs';
import { representativeProfileFixture } from '../helpers/inventoryRepresentativeProfileFixture.mjs';
import { providerResponseError } from '../../services/providerResponseDiagnosis.mjs';
import { observeDescriptionDatabaseOperation } from '../../services/inventoryDescriptionRefreshObservation.mjs';
import { createSchedulerTaskExecutionRunner } from '../../services/schedulerTaskExecutionRunner.mjs';
import { registerInventoryRepresentativeProfileSchedule } from '../../services/inventoryRepresentativeProfileScheduler.mjs';
import { discoveryAdmissionFixture } from '../helpers/discoveryAdmissionFixture.mjs';

afterEach(() => jest.restoreAllMocks());
const fail = () => { throw new Error('PRIVATE endpoint/password'); };

function setup() {
  const v = representativeProfileFixture();
  const embedder = { ...v.identity, inspect: jest.fn(async () => v.identity) };
  const dependencies = { now: () => 0, readState: jest.fn(async () => v.state),
    createEmbedder: jest.fn(() => embedder), fit: jest.fn(async snapshot => buildInventoryRepresentativeProfile({ snapshot, dimensions: 2 })),
    repository: { read: jest.fn(async () => v.snapshot), readRepresentativeVerification: jest.fn(async (_identity, { configKey }) =>
      ({ ...v.snapshot, key: inventoryRepresentativeSourceKey(v.snapshot, v.identity, configKey) })) } };
  return { ...v, embedder, dependencies, key: () => inventoryRepresentativeSourceKey(v.snapshot, v.identity,
    JSON.stringify(resolveLocalStudyEmbeddingConfig(v.state))) };
}

test.each([
  ['state_read', v => v.dependencies.readState.mockImplementation(fail)],
  ['admission', v => { v.dependencies.withAdmission = fail; }],
  ['provider_creation', v => v.dependencies.createEmbedder.mockImplementation(fail)],
  ['representation_inspection', v => v.embedder.inspect.mockImplementation(fail)],
  ['snapshot_read', v => v.dependencies.repository.read.mockImplementation(fail)],
  ['fit', v => v.dependencies.fit.mockImplementation(fail)],
  ['verification_read', v => v.dependencies.repository.readRepresentativeVerification.mockImplementation(fail)],
  ['representation_checkpoint', v => v.embedder.inspect.mockResolvedValueOnce(v.identity).mockImplementationOnce(fail)],
  ['final_state_read', v => v.dependencies.readState.mockResolvedValueOnce(v.state).mockImplementationOnce(fail)],
  ['publication', v => { v.dependencies.withAdmission = (callback, { signal }) => callback(signal, fail); }],
])('failure at %s survives worker/scheduler/runner boundaries without raw data', async (stage, inject) => {
  const v = setup(); inject(v);
  const worker = createInventoryRepresentativeProfileRefresh(v.dependencies);
  const scheduler = { schedule: jest.fn(), scheduleInitial: jest.fn() };
  registerInventoryRepresentativeProfileSchedule(scheduler, { worker, log: { info: jest.fn() } });
  const logger = { info: jest.fn(), error: jest.fn(), debug: jest.fn() };
  const runner = createSchedulerTaskExecutionRunner({ withSessionAdvisoryLock: jest.fn(), logger });
  expect(await runner.run({ name: 'inventory-representative-profile-refresh', handler: scheduler.schedule.mock.calls[0][2] })).toBe(false);
  const data = logger.error.mock.calls[0][1];
  expect(data).toMatchObject({ error: 'inventory_representative_refresh_unavailable', failure: {
    stage, category: 'unknown', incidentId: expect.any(String), operationDurationMs: expect.any(Number),
  } });
  expect(data.failure).toEqual(worker.getStatus().failure);
  expect(worker.read(v.key())).toBeUndefined();
  expect(JSON.stringify(data)).not.toMatch(/PRIVATE|password|localhost|description|vectors|cause/);
  // State reads precede retry eligibility even in the existing implementation.
  if (stage !== 'state_read') expect(await worker.run()).toMatchObject({ status: 'cooldown' });
  worker.stop();
});

test('nested observation preserves original identity, first inner stage and bounded clocks', async () => {
  const error = new Error('PRIVATE');
  await expect(observeRepresentativeStage('admission', () => observeRepresentativeStage('fit', () => { throw error; },
    { clock: () => Infinity }))).rejects.toBe(error);
  expect(createRepresentativeRefreshFailure(error)).toMatchObject({ stage: 'fit', category: 'unknown', operationDurationMs: null });
  expect(createRepresentativeRefreshFailure(error).stage).toBe('refresh'); // consumed, never stale
  expect(await observeRepresentativeStage('fit', async () => 42)).toBe(42);
});

test.each(['57014', '55P03', '40P01', '40001', '08006', '53300', '57P01', '42501', '42P01'])('trusted database code %s is retained, not its message', async code => {
  let error;
  try { await observeRepresentativeStage('snapshot_read', () => observeRepresentativeDatabaseOperation(() => { throw Object.assign(Error('PRIVATE SQL'), { code }); })); }
  catch (caught) { error = caught; }
  const failure = createRepresentativeRefreshFailure(error);
  expect(failure.sqlState).toBe(code);
  expect(failure.category).toMatch(/^database_/);
  expect(failure.databaseDurationMs).toEqual(expect.any(Number));
  expect(JSON.stringify(failure)).not.toContain('PRIVATE');
});

test('transaction callbacks cannot impersonate database origin; acquisition and commit failures can', async () => {
  const error = Object.assign(Error('PRIVATE'), { code: '57014' });
  for (const mode of ['callback', 'acquire', 'commit']) {
    const transaction = async callback => { if (mode === 'acquire') throw error; await callback({}); if (mode === 'commit') throw error; };
    await expect(observeRepresentativeTransaction(transaction, async () => { if (mode === 'callback') throw error; })).rejects.toBe(error);
    const failure = createRepresentativeRefreshFailure(error);
    expect(failure.category).toBe(mode === 'callback' ? 'unknown' : 'database_query_cancelled');
    expect(failure.sqlState).toBe(mode === 'callback' ? undefined : '57014');
  }
});

test('state reads bridge trusted description DB observations; arbitrary provider SQLSTATE does not', async () => {
  const v = setup();
  v.dependencies.readState.mockImplementation(() => observeDescriptionDatabaseOperation(() => { throw Object.assign(Error('PRIVATE'), { code: '53300' }); }));
  expect((await createInventoryRepresentativeProfileRefresh(v.dependencies).run()).failure).toMatchObject({ stage: 'state_read', category: 'database_capacity', sqlState: '53300' });
  const other = setup(); other.embedder.inspect.mockRejectedValue(Object.assign(Error('PRIVATE'), { code: '57014' }));
  expect((await createInventoryRepresentativeProfileRefresh(other.dependencies).run()).failure).toMatchObject({ category: 'unknown' });
});

test('provider and representative validation categories retain only fixed codes', async () => {
  expect(createRepresentativeRefreshFailure(providerResponseError('http_auth', 'inspection')).category).toBe('http_auth');
  expect(createRepresentativeRefreshFailure({ representativeIssue: 'profile_structure', detail: 'PRIVATE' }).category).toBe('profile_structure');
});

test.each([false, true])('task deadline remains failed/backed off when fit/admission replace errors (admission=%s)', async admitted => {
  const deadline = new AbortController();
  jest.spyOn(AbortSignal, 'timeout').mockImplementationOnce(ms => { expect(ms).toBe(120_000); return deadline.signal; });
  const v = setup(); v.dependencies.fit.mockImplementation(() => { deadline.abort(); throw Error('inventory_representative_fit_cancelled'); });
  if (admitted) v.dependencies.withAdmission = discoveryAdmissionFixture({
    withSessionAdvisoryLock: async (_key, callback) => { await callback({}); return true; },
    readMemory: () => ({ available: 2 ** 31, constrained: 2 ** 31, total: 2 ** 34 }),
  });
  const worker = createInventoryRepresentativeProfileRefresh(v.dependencies);
  expect(await worker.run()).toMatchObject({ status: 'failed', failure: { stage: 'fit', category: 'task_deadline' } });
  expect(await worker.run()).toMatchObject({ status: 'cooldown' });
});

test('warm preparation failures keep their stage without guessing DB origin', async () => {
  // Pending observations bypass the existing quiet interval without changing time or retries.
  const pending = setup();
  pending.dependencies.observer = { hasPending: () => true, stop() {} };
  const warmWorker = createInventoryRepresentativeProfileRefresh(pending.dependencies);
  expect((await warmWorker.run()).status).toBe('published');
  pending.dependencies.repository.prepareRepresentative = () => { throw Object.assign(Error('PRIVATE'), { code: '57014' }); };
  expect(await warmWorker.run()).toMatchObject({ status: 'failed', failure: { stage: 'warm_preparation', category: 'unknown' } });
  warmWorker.stop();
});

test('cancelled attempts forget inner observations before the same error is reused', async () => {
  const v = setup(), controller = new AbortController(), shared = Error('PRIVATE');
  v.dependencies.fit.mockImplementationOnce(() => { controller.abort(); throw shared; });
  const worker = createInventoryRepresentativeProfileRefresh(v.dependencies);
  expect(await worker.run({ signal: controller.signal })).toMatchObject({ status: 'cancelled' });
  expect(worker.getStatus()).not.toHaveProperty('failure');
  v.dependencies.readState.mockRejectedValueOnce(shared);
  expect(await worker.run()).toMatchObject({ status: 'failed', failure: { stage: 'state_read', category: 'unknown' } });
  worker.stop();
});

test.each([null, 'PRIVATE', new Proxy({}, { getOwnPropertyDescriptor() { throw Error('PRIVATE'); } })])('hostile errors stay unknown and do not enter diagnostics', value => {
  expect(createRepresentativeRefreshFailure(value)).toMatchObject({ stage: 'refresh', category: 'unknown' });
  expect(JSON.stringify(createRepresentativeRefreshFailure(value))).not.toContain('PRIVATE');
});

test('scheduler envelope is immutable, branded, bounded and never executes getters', () => {
  const getter = jest.fn(() => { throw Error('PRIVATE'); });
  const hostile = Object.defineProperty({}, 'failure', { get: getter });
  expect(readRepresentativeRefreshTaskFailure(createRepresentativeRefreshTaskError(hostile))).toEqual({});
  const error = createRepresentativeRefreshTaskError({ failure: { incidentId: '12345678-1234-1234-1234-123456789abc',
    stage: 'PRIVATE', category: 'unknown', operationDurationMs: Number.MAX_VALUE, databaseDurationMs: -1, sqlState: '57014', extra: 'PRIVATE' } });
  expect(readRepresentativeRefreshTaskFailure(error)).toEqual({ failure: {
    incidentId: '12345678-1234-1234-1234-123456789abc', stage: 'refresh', category: 'unknown', operationDurationMs: 86_400_000,
  } });
  expect(Object.isFrozen(readRepresentativeRefreshTaskFailure(error).failure)).toBe(true);
  expect(readRepresentativeRefreshTaskFailure({ failure: {} })).toBeNull();
  const thrown = Object.defineProperty({}, 'code', { get: getter });
  expect(createRepresentativeRefreshFailure(thrown).category).toBe('unknown');
  expect(getter).not.toHaveBeenCalled();
});
