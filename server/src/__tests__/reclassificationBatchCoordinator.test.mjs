/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, beforeEach, test, expect } from '@jest/globals';
import { createBatchCoordinator } from '../services/reclassificationBatchCoordinator.mjs';
import { registerReclassificationBatchSchedule } from '../services/reclassificationBatchScheduler.mjs';
import { AppError } from '../utils/appError.mjs';

let repository, service, database, controller, claim, worker;
beforeEach(() => {
  controller = new AbortController();
  claim = { batch: { id: 1, created_by: 'user', pause_on_error: true },
    item: { id: 2, classification_id: 3, target_library_id: 4 }, interrupted: false };
  repository = { claim: jest.fn(async () => claim), success: jest.fn(), failure: jest.fn(), defer: jest.fn(), stopped: jest.fn() };
  service = { executeReclassification: jest.fn().mockResolvedValue({ success: true }),
    recoverBatchItem: jest.fn().mockResolvedValue({ status: 'completed' }) };
  database = { withSessionAdvisoryLock: jest.fn(async (_key, callback) => {
    await callback({ signal: controller.signal }); return true;
  }) };
  worker = createBatchCoordinator({ database, repository, service });
});
test('admits one item with the coordinator abort signal', async () => {
  expect(await worker.runOnce()).toEqual({ status: 'completed' });
  expect(service.executeReclassification).toHaveBeenCalledWith({ classificationId: 3, targetLibraryId: 4,
    correctedBy: 'user', batchItemId: 2, signal: controller.signal });
  expect(repository.success).toHaveBeenCalledWith(claim.item, { success: true });
  expect(repository.claim).toHaveBeenCalledTimes(1);
});
test('idle does not start provider work', async () => {
  claim = null;
  expect(await worker.runOnce()).toEqual({ status: 'idle' });
  expect(service.executeReclassification).not.toHaveBeenCalled();
});
test('another coordinator owns admission', async () => {
  database.withSessionAdvisoryLock.mockResolvedValue(false);
  expect(await worker.runOnce()).toEqual({ status: 'busy' });
  expect(repository.claim).not.toHaveBeenCalled();
});
test('modern interrupted unbound claim can retry preparation', async () => {
  claim.interrupted = true;
  claim.item.execution_version = 1;
  await worker.runOnce();
  expect(service.executeReclassification).toHaveBeenCalledTimes(1);
});
test('legacy unbound interruption requires inspection even without pause-on-error', async () => {
  claim.interrupted = true;
  claim.batch.pause_on_error = false;
  expect(await worker.runOnce()).toEqual({ status: 'needs_attention' });
  expect(repository.failure).toHaveBeenCalledWith(claim, expect.stringContaining('Inspect'), true);
  expect(service.executeReclassification).not.toHaveBeenCalled();
});
test.each([false, true])('bound attempt uses exact recovery, interrupted=%s', async interrupted => {
  claim.interrupted = interrupted;
  claim.item.execution_result = { moveOperationId: 'reference' };
  await worker.runOnce();
  expect(service.recoverBatchItem).toHaveBeenCalledWith(expect.objectContaining({ operationId: 'reference',
    batchItemId: 2, classificationId: 3, targetLibraryId: 4, retry: !interrupted }));
  expect(service.executeReclassification).not.toHaveBeenCalled();
});
test('journal backoff does not become an item error', async () => {
  claim.item.execution_result = { moveOperationId: 'reference' };
  service.recoverBatchItem.mockResolvedValue({ status: 'waiting' });
  expect(await worker.runOnce()).toEqual({ status: 'waiting' });
  expect(repository.defer).toHaveBeenCalledWith(1, 300);
  expect(repository.failure).not.toHaveBeenCalled();
});
test('move contention leaves intent retryable', async () => {
  service.executeReclassification.mockRejectedValue(new AppError('busy', 409, { code: 'move_busy' }));
  expect(await worker.runOnce()).toEqual({ status: 'busy' });
  expect(repository.defer).toHaveBeenCalledWith(1);
  expect(repository.failure).not.toHaveBeenCalled();
});
test('stopping during preparation restores a nonexecuting item', async () => {
  service.executeReclassification.mockRejectedValue(new AppError('stopped', 409, { code: 'move_batch_changed' }));
  expect(await worker.runOnce()).toEqual({ status: 'stopped' });
  expect(repository.stopped).toHaveBeenCalledWith(claim.item);
});
test('untrusted errors are not stored verbatim', async () => {
  service.executeReclassification.mockRejectedValue(new Error('token=secret private path'));
  expect(await worker.runOnce()).toEqual({ status: 'failed' });
  expect(JSON.stringify(repository.failure.mock.calls)).not.toContain('secret');
});
test('missing receipt forces inspection and operational messages are bounded', async () => {
  service.executeReclassification.mockRejectedValue(new AppError('x'.repeat(2000), 409, { code: 'move_journal_missing' }));
  await worker.runOnce();
  expect(repository.failure).toHaveBeenCalledWith(claim, 'x'.repeat(1000), true);
});
test.each(['claim', 'execution'])('lock loss during %s stops outcome writes', async phase => {
  if (phase === 'claim') repository.claim.mockImplementation(async () => { controller.abort(); return claim; });
  else service.executeReclassification.mockImplementation(async () => { controller.abort(); throw new Error('lost'); });
  await expect(worker.runOnce()).rejects.toThrow();
  expect(repository.success).not.toHaveBeenCalled();
  expect(repository.failure).not.toHaveBeenCalled();
});
test('registers bounded startup and recurring work without fire-and-forget execution', async () => {
  const scheduler = { schedule: jest.fn(), scheduleInitial: jest.fn() };
  const runOnce = jest.fn();
  registerReclassificationBatchSchedule(scheduler, { runOnce });
  expect(scheduler.schedule).toHaveBeenCalledWith('reclassification-batch-coordinator', '*/30 * * * * *',
    expect.any(Function), null, { noOverlap: true });
  expect(scheduler.scheduleInitial).toHaveBeenCalledWith('reclassification-batch-coordinator', 30000, expect.any(Function));
  await scheduler.schedule.mock.calls[0][2]();
  expect(runOnce).toHaveBeenCalledTimes(1);
});
