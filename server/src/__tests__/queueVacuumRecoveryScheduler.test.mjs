/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { registerQueueVacuumRecoverySchedule } from '../services/queueVacuumRecoveryScheduler.mjs';
import { QueueVacuumAttemptError } from '../services/queueVacuumFailure.mjs';
import { buildQueueVacuumDiagnosis } from '../services/queueVacuumDiagnosis.mjs';

test('one existing scheduler owns periodic and delayed checks; repairs and transitions are logged', async () => {
  const scheduler = { schedule: jest.fn(), scheduleInitial: jest.fn() };
  const log = { info: jest.fn(), warn: jest.fn(), debug: jest.fn() }, db = {};
  const run = jest.fn(async ({ report }) => { report({ status: 'started' }); return { status: 'complete' }; });
  registerQueueVacuumRecoverySchedule(scheduler, { run, db, log });
  const handler = scheduler.schedule.mock.calls[0][2];
  expect(scheduler.schedule).toHaveBeenCalledWith('queue-vacuum-recovery', '7,22,37,52 * * * *', handler, null, { noOverlap: true });
  expect(scheduler.scheduleInitial).toHaveBeenCalledWith('queue-vacuum-recovery', 600_000, handler);
  await handler();
  expect(run).toHaveBeenCalledWith({ database: db, automatic: true, report: expect.any(Function) });
  expect(log.info).toHaveBeenCalledTimes(2);
  run.mockResolvedValue({ status: 'deferred', reason: 'attempt_limit', log: true });
  await handler(); expect(log.warn).toHaveBeenCalledTimes(1);
  run.mockResolvedValue({ status: 'deferred', reason: 'observing_pressure', log: true });
  await handler(); expect(log.info).toHaveBeenCalledTimes(3);
  run.mockResolvedValue({ status: 'idle', log: false });
  await handler(); expect(log.debug).toHaveBeenCalledTimes(1);
  run.mockRejectedValue(new Error('password=secret'));
  await handler(); await handler();
  expect(log.warn).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(log.warn.mock.calls)).not.toContain('secret');
});

test('diagnoses are logged with one fixed next step, and real failed attempts are not suppressed', async () => {
  const scheduler = { schedule: jest.fn(), scheduleInitial: jest.fn() };
  const log = { info: jest.fn(), warn: jest.fn(), debug: jest.fn() };
  const diagnosis = buildQueueVacuumDiagnosis(null, 'deadline');
  const run = jest.fn().mockResolvedValue({ status: 'deferred', reason: 'cooldown', diagnosis });
  registerQueueVacuumRecoverySchedule(scheduler, { run, db: {}, log });
  const handler = scheduler.schedule.mock.calls[0][2];
  await handler();
  expect(log.warn).toHaveBeenCalledWith(diagnosis.message, diagnosis);
  run.mockRejectedValue(new QueueVacuumAttemptError('deadline', diagnosis));
  await expect(handler()).resolves.toEqual({ status: 'unavailable', failureCategory: 'deadline' });
  await handler();
  expect(log.warn).toHaveBeenCalledTimes(3);
});

test('restricted scheduler uses read-only assessment and capability, never a direct privileged fallback', async () => {
  const scheduler = { schedule: jest.fn(), scheduleInitial: jest.fn() };
  const log = { info: jest.fn(), warn: jest.fn(), debug: jest.fn() }, run = jest.fn();
  const handoff = { request: jest.fn(async () => ({ status: 'complete' })) };
  const assessHandoff = jest.fn(async () => ({ request: false, status: 'idle' }));
  registerQueueVacuumRecoverySchedule(scheduler, { run, db: {}, log, handoff, assessHandoff });
  const handler = scheduler.schedule.mock.calls[0][2];
  await handler(); expect(handoff.request).not.toHaveBeenCalled();
  assessHandoff.mockResolvedValue({ request: true });
  await handler(); expect(handoff.request).toHaveBeenCalledTimes(1);
  handoff.request.mockResolvedValue({ status: 'unavailable' });
  expect((await handler()).status).toBe('unavailable');
  await handler(); expect(log.warn).toHaveBeenCalledTimes(1);
  expect(run).not.toHaveBeenCalled();
});
