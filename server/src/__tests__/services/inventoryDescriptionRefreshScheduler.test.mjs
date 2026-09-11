/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { registerInventoryDescriptionRefreshSchedule, INVENTORY_DESCRIPTION_REFRESH_TASK } from '../../services/inventoryDescriptionRefreshScheduler.mjs';
import { getInventoryDescriptionRefreshRevision, requestInventoryDescriptionRefresh } from '../../services/inventoryDescriptionRefreshSignal.mjs';

test('schedule registration coalesces work, cancels the replaced worker, and shares startup handler', async () => {
  const previous = { stop: jest.fn() };
  const scheduler = { inventoryDescriptionRefreshWorker: previous, schedule: jest.fn(), scheduleInitial: jest.fn() };
  const report = { status: 'up_to_date', embeddedDescriptions: 0 };
  const worker = { run: jest.fn(async () => report), stop: jest.fn() };
  const log = { info: jest.fn(), warn: jest.fn() };
  registerInventoryDescriptionRefreshSchedule(scheduler, { worker, log });
  expect(previous.stop).toHaveBeenCalledTimes(1);
  const handler = scheduler.schedule.mock.calls[0][2];
  expect(scheduler.schedule).toHaveBeenCalledWith(INVENTORY_DESCRIPTION_REFRESH_TASK, '* * * * *', handler, null, { noOverlap: true });
  expect(scheduler.scheduleInitial).toHaveBeenCalledWith(INVENTORY_DESCRIPTION_REFRESH_TASK, 60_000, handler);
  expect(await handler()).toEqual(report);
  expect(log.info).toHaveBeenCalledWith('Inventory description refresh completed', report);
  worker.run.mockResolvedValueOnce({ status: 'failed' });
  await expect(handler()).rejects.toThrow('inventory_description_refresh_unavailable');
  expect(log.warn).toHaveBeenCalledTimes(1);
  worker.run.mockResolvedValueOnce({ status: 'cooldown' });
  await handler();
  expect(log.info).toHaveBeenCalledTimes(1);
});

test('sync requests retain only a process-local change revision', () => {
  const before = getInventoryDescriptionRefreshRevision();
  requestInventoryDescriptionRefresh();
  expect(getInventoryDescriptionRefreshRevision()).toBe(before + 1);
});
