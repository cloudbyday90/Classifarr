/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { registerInventoryRepresentativeProfileSchedule, INVENTORY_REPRESENTATIVE_PROFILE_TASK,
  createInventoryRepresentativeProfileRuntime } from '../../services/inventoryRepresentativeProfileScheduler.mjs';

test('startup/cron share a coalesced automatic handler, replacing and stopping the previous owner', async () => {
  const previous = { stop: jest.fn() };
  const scheduler = { inventoryRepresentativeProfileWorker: previous, schedule: jest.fn(), scheduleInitial: jest.fn() };
  const report = { status: 'published', groups: 3 };
  const worker = { run: jest.fn(async () => report), stop: jest.fn() }, log = { info: jest.fn() };
  registerInventoryRepresentativeProfileSchedule(scheduler, { worker, log });
  const handler = scheduler.schedule.mock.calls[0][2];
  expect(scheduler.schedule).toHaveBeenCalledWith(INVENTORY_REPRESENTATIVE_PROFILE_TASK, '30 * * * * *', handler, null, { noOverlap: true });
  expect(scheduler.scheduleInitial).toHaveBeenCalledWith(INVENTORY_REPRESENTATIVE_PROFILE_TASK, 90_000, handler);
  expect(previous.stop).toHaveBeenCalledTimes(1);
  expect(await handler()).toEqual(report);
  expect(log.info).toHaveBeenCalledTimes(1);
  worker.run.mockResolvedValueOnce({ status: 'up_to_date' }); await handler();
  expect(log.info).toHaveBeenCalledTimes(1);
  worker.run.mockResolvedValueOnce({ status: 'failed' });
  await expect(handler()).rejects.toThrow('inventory_representative_refresh_unavailable');
});

test('runtime uses existing config admission and shutdown without starting provider work', async () => {
  const database = { withTransaction: jest.fn(callback => callback({ query: async () => ({ rows: [{ rag_enabled: false }] }) })) };
  const worker = createInventoryRepresentativeProfileRuntime(database);
  expect(await worker.run()).toMatchObject({ status: 'disabled', mode: 'shadow_cache' });
  worker.stop(); expect(await worker.run()).toMatchObject({ status: 'cancelled' });
});
