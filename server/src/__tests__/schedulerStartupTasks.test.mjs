/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

import { expect, jest, test } from '@jest/globals';
import {
  registerSchedulerStartupTasks,
  SCHEDULER_STARTUP_TASKS,
} from '../services/schedulerStartupTasks.mjs';

test('registers every core startup task through the cancellable scheduler interface', () => {
  const scheduler = { scheduleInitial: jest.fn() };
  const handlers = {
    runGapAnalysis: jest.fn(),
    runLibraryWatchdog: jest.fn(),
    runPeriodicLibrarySync: jest.fn(),
    processRetryQueue: jest.fn(),
  };
  const advisoryLocks = { GAP_ANALYSIS: 1, LIBRARY_SYNC: 2, RETRY_QUEUE: 3 };

  expect(registerSchedulerStartupTasks(scheduler, { advisoryLocks, handlers }))
    .toBe(SCHEDULER_STARTUP_TASKS.length);
  expect(scheduler.scheduleInitial).toHaveBeenNthCalledWith(1, 'gap-analysis', 30_000, handlers.runGapAnalysis, 1);
  expect(scheduler.scheduleInitial).toHaveBeenNthCalledWith(2, 'library-watchdog', 5_000, handlers.runLibraryWatchdog, null);
  expect(scheduler.scheduleInitial).toHaveBeenNthCalledWith(3, 'library-sync', 120_000, handlers.runPeriodicLibrarySync, 2);
  expect(scheduler.scheduleInitial).toHaveBeenNthCalledWith(4, 'retry-queue', 60_000, handlers.processRetryQueue, 3);
});

test('rejects an incomplete scheduler startup contract', () => {
  expect(() => registerSchedulerStartupTasks({}, {})).toThrow('Scheduler startup tasks require');
  expect(() => registerSchedulerStartupTasks({ scheduleInitial: jest.fn() }, {
    advisoryLocks: {},
    handlers: {},
  })).toThrow('gap-analysis requires a handler');
});
