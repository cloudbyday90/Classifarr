/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { registerQueueMetadataRecoverySchedule } from '../services/queueMetadataRecoveryScheduler.mjs';

function fixture(run) {
  const scheduler = { schedule: jest.fn(), queueMetadataRecoveryWorker: { stop: jest.fn() } };
  const previous = scheduler.queueMetadataRecoveryWorker;
  const service = { run: jest.fn(run) };
  const logger = { info: jest.fn(), warn: jest.fn() };
  registerQueueMetadataRecoverySchedule(scheduler, { service, logger });
  expect(previous.stop).toHaveBeenCalledTimes(1);
  expect(scheduler.schedule).toHaveBeenCalledWith('queue-metadata-recovery', '*/5 * * * *',
    expect.any(Function), null, { noOverlap: true, maxRandomDelay: 5000, quiet: true });
  return { scheduler, service, logger, tick: scheduler.schedule.mock.calls[0][2] };
}

test('prevents overlapping work and aborts in-flight work on stop', async () => {
  let finish;
  const { scheduler, service, tick, logger } = fixture(() => new Promise(resolve => { finish = resolve; }));
  const first = tick();
  await tick();
  expect(service.run).toHaveBeenCalledTimes(1);
  const signal = service.run.mock.calls[0][0];
  scheduler.queueMetadataRecoveryWorker.stop();
  expect(signal.aborted).toBe(true);
  finish({ queued: 0 });
  await first;
  await tick();
  expect(service.run).toHaveBeenCalledTimes(1);
  expect(logger.warn).not.toHaveBeenCalled();
});

test('projects a fixed failure and permits the next scheduled attempt', async () => {
  const { service, tick, logger } = fixture(async () => { throw new Error('private provider data'); });
  await tick();
  expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('private provider data');
  expect(logger.warn).toHaveBeenCalledWith(expect.any(String), { reasonCode: 'metadata_recovery_unavailable' },
    { dedupeKey: 'metadata-recovery', dedupeWindowMs: 3600000 });
  service.run.mockResolvedValue({ queued: 1 });
  await tick();
  expect(logger.info).toHaveBeenCalledWith(expect.any(String), { count: 1 });
});
