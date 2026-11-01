/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createInventoryDescriptionRefreshRuntime, registerInventoryDescriptionRefreshSchedule } from '../../services/inventoryDescriptionRefreshScheduler.mjs';
import { createInventoryRepresentativeProfileRuntime, registerInventoryRepresentativeProfileSchedule } from '../../services/inventoryRepresentativeProfileScheduler.mjs';
import { INVENTORY_BACKGROUND_READINESS_SQL } from '../../services/inventoryBackgroundReadiness.mjs';
import { representativeProfileFixture } from '../helpers/inventoryRepresentativeProfileFixture.mjs';

const runtimes = [
  ['description', createInventoryDescriptionRefreshRuntime, registerInventoryDescriptionRefreshSchedule, 'inventoryDescriptionRefreshWorker'],
  ['representative', createInventoryRepresentativeProfileRuntime, registerInventoryRepresentativeProfileSchedule, 'inventoryRepresentativeProfileWorker'],
];

test.each(runtimes)('%s pre-aborted caller never starts a preliminary database read', async (_name, create) => {
  const database = { withTransaction: jest.fn(async callback => callback({ query: async () => ({ rows: [{ readiness: 'disabled' }] }) })),
    withSessionAdvisoryLock: jest.fn() };
  const worker = create(database), controller = new AbortController();
  controller.abort('PRIVATE caller reason');
  try {
    expect(await worker.run({ signal: controller.signal })).toEqual({ status: 'cancelled' });
    expect(database.withTransaction).not.toHaveBeenCalled();
    expect(database.withSessionAdvisoryLock).not.toHaveBeenCalled();
  } finally { worker.stop(); }
});

test.each(runtimes)('%s preflight warnings preserve deferral and allow immediate normal admission after a ready probe', async (_name, create, register, workerKey) => {
  const { state } = representativeProfileFixture();
  let fault = true, readiness = 'ready';
  const query = jest.fn(async sql => {
    if (sql === INVENTORY_BACKGROUND_READINESS_SQL) {
      if (fault) throw Object.assign(Error('PRIVATE database file'), { code: '53100' });
      return { rows: [{ readiness }] };
    }
    return { rows: [{ ...state }] };
  });
  const database = { withTransaction: callback => callback({ query }), query: jest.fn(),
    withSessionAdvisoryLock: jest.fn(async () => false) };
  const worker = create(database), log = { info: jest.fn(), warn: jest.fn() };
  const scheduler = { schedule: jest.fn(), scheduleInitial: jest.fn() };
  register(scheduler, { worker, log });
  const tick = scheduler.schedule.mock.calls[0][2];
  try {
    expect(await tick()).toMatchObject({ status: 'deferred', reason: 'unavailable',
      failure: { stage: 'readiness', category: 'database_disk_full', sqlState: '53100' } });
    expect(await tick()).toMatchObject({ status: 'deferred', reason: 'unavailable' });
    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(database.withSessionAdvisoryLock).not.toHaveBeenCalled();
    expect(database.query).not.toHaveBeenCalled();
    fault = false; readiness = 'backfilling';
    expect(await tick()).toEqual({ status: 'deferred', reason: 'backfilling' });
    readiness = 'ready'; await tick();
    expect(database.withSessionAdvisoryLock).toHaveBeenCalledTimes(1);
    fault = true; await tick();
    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(log.info).not.toHaveBeenCalled();
    expect(JSON.stringify(log.warn.mock.calls)).not.toMatch(/PRIVATE|retryAfterSeconds|slowRetry/);
  } finally { scheduler[workerKey].stop(); }
});

test.each(runtimes)('%s coalesces probes and a stop during failure keeps the scheduler quiet', async (_name, create, register, workerKey) => {
  let reject;
  let reached;
  const queryReached = new Promise(resolve => { reached = resolve; });
  const query = jest.fn(sql => {
    if (sql !== INVENTORY_BACKGROUND_READINESS_SQL) return Promise.resolve({ rows: [] });
    return new Promise((_resolve, fail) => { reject = fail; reached(); });
  });
  const database = { withTransaction: callback => callback({ query }), withSessionAdvisoryLock: jest.fn() };
  const worker = create(database), log = { info: jest.fn(), warn: jest.fn() };
  const scheduler = { schedule: jest.fn(), scheduleInitial: jest.fn() };
  register(scheduler, { worker, log });
  const tick = scheduler.schedule.mock.calls[0][2];
  const first = tick(), second = tick();
  await queryReached;
  scheduler[workerKey].stop();
  reject(Object.assign(Error('PRIVATE stopped probe'), { code: '53100' }));
  expect(await first).toEqual({ status: 'stopped' });
  expect(await second).toEqual({ status: 'stopped' });
  expect(query).toHaveBeenCalledTimes(1); // Timeout setup is owned by the read runner.
  expect(log.warn).not.toHaveBeenCalled(); expect(log.info).not.toHaveBeenCalled();
  expect(database.withSessionAdvisoryLock).not.toHaveBeenCalled();
  expect(await tick()).toEqual({ status: 'stopped' });
});
