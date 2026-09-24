/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, beforeEach, test, expect } from '@jest/globals';
import { ReclassificationService } from '../services/reclassificationService.mjs';
import { classificationMoveRevision, moveBlocked } from '../services/reclassificationMoveContract.mjs';
import { registerReclassificationMoveSchedule } from '../services/reclassificationMoveScheduler.mjs';

let repository, adapter, service, row, operation, database, logger, scan, options;
beforeEach(() => {
  row = { id: 1, library_id: 10, tmdb_id: 123, media_type: 'movie', title: 'Synthetic' };
  const plan = { originalLibraryId: 10, targetLibraryId: 20, mediaType: 'movie',
    oldPath: '/old/item', newPath: '/new/item', classificationRevision: classificationMoveRevision(row) };
  operation = { id: 'operation-1', classification_id: 1, target_library_id: 20, state: 'moving', plan };
  repository = {
    find: jest.fn().mockResolvedValue(null), classification: jest.fn().mockImplementation(async () => row),
    reserve: jest.fn().mockResolvedValue(operation), bind: jest.fn(), attempted: jest.fn(), verified: jest.fn(),
    complete: jest.fn(), prune: jest.fn(), due: jest.fn().mockResolvedValue(operation),
    defer: jest.fn().mockResolvedValue(operation),
    byId: jest.fn().mockImplementation(async () => operation), completeBatchReceipt: jest.fn(),
  };
  adapter = { prepare: jest.fn().mockResolvedValue(plan), moveFiles: jest.fn(), reconcile: jest.fn() };
  options = { signal: new AbortController().signal };
  database = { withSessionAdvisoryLock: jest.fn(async (_key, fn) => { await fn(options); return true; }) };
  logger = { info: jest.fn(), warn: jest.fn() };
  scan = jest.fn().mockResolvedValue({ success: true });
  service = new ReclassificationService({ database, repository, adapter, logger, scan });
});
const execute = () => service.executeReclassification({ classificationId: 1, targetLibraryId: 20 });

const recoverBatch = (extra = {}) => service.recoverBatchItem({ operationId: '00000000-0000-4000-8000-000000000001',
  batchItemId: 7, classificationId: 1, targetLibraryId: 20, ...extra });
test.each([null, '', 'invalid'])('invalid exact receipt %s cannot acquire a lock', async operationId => {
  await expect(recoverBatch({ operationId })).rejects.toMatchObject({ code: 'move_journal_missing' });
  expect(database.withSessionAdvisoryLock).not.toHaveBeenCalled();
});
test.each(['missing', 'classification', 'destination'])('%s exact receipt is not substituted', async mismatch => {
  if (mismatch === 'missing') repository.byId.mockResolvedValue(null);
  if (mismatch === 'classification') operation.classification_id = 999;
  if (mismatch === 'destination') operation.target_library_id = 999;
  await expect(recoverBatch()).rejects.toMatchObject({ code: 'move_journal_missing' });
  expect(repository.bind).not.toHaveBeenCalled();
  expect(adapter.moveFiles).not.toHaveBeenCalled();
});
test('completed exact receipt repairs item outcome without touching history or files', async () => {
  operation.state = 'completed';
  expect(await recoverBatch()).toEqual({ status: 'completed' });
  expect(repository.completeBatchReceipt).toHaveBeenCalledWith(operation);
  expect(repository.complete).not.toHaveBeenCalled();
  expect(adapter.reconcile).not.toHaveBeenCalled();
});
test('background exact recovery respects attention and due time', async () => {
  operation.state = 'needs_attention';
  await expect(recoverBatch()).rejects.toMatchObject({ code: 'move_recovery_attention' });
  operation.state = 'moving';
  operation.next_attempt_at = new Date(Date.now() + 60000);
  expect(await recoverBatch()).toEqual({ status: 'waiting' });
  expect(adapter.reconcile).not.toHaveBeenCalled();
});
test('explicit retry reconciles a blocked exact receipt without moving files', async () => {
  operation.state = 'needs_attention';
  operation.next_attempt_at = new Date(Date.now() + 60000);
  expect(await recoverBatch({ retry: true })).toEqual({ status: 'completed' });
  expect(adapter.reconcile).toHaveBeenCalled();
  expect(adapter.prepare).not.toHaveBeenCalled();
  expect(adapter.moveFiles).not.toHaveBeenCalled();
});
test.each(['execute', 'recover'])('coordinator lock loss aborts %s despite a healthy move lock', async action => {
  const signal = AbortSignal.abort(new Error('coordinator lost'));
  const call = action === 'execute' ? service.executeReclassification({ classificationId: 1, targetLibraryId: 20, signal })
    : recoverBatch({ signal });
  await expect(call).rejects.toThrow('coordinator lost');
  expect(adapter.prepare).not.toHaveBeenCalled();
  expect(adapter.reconcile).not.toHaveBeenCalled();
});
test('coordinator abort during preparation reaches the final reservation boundary', async () => {
  const owner = new AbortController();
  adapter.prepare.mockImplementation(async () => { owner.abort(new Error('coordinator lost')); return operation.plan; });
  await expect(service.executeReclassification({ classificationId: 1, targetLibraryId: 20, signal: owner.signal }))
    .rejects.toThrow('coordinator lost');
  expect(repository.reserve).not.toHaveBeenCalled();
});

test('new batch moves bind during reservation before file work', async () => {
  await service.executeReclassification({ classificationId: 1, targetLibraryId: 20, batchItemId: 7 });
  expect(repository.reserve).toHaveBeenCalledWith(1, 20, 'user', operation.plan, 7);
  expect(repository.reserve.mock.invocationCallOrder[0]).toBeLessThan(adapter.moveFiles.mock.invocationCallOrder[0]);
});
test('existing moves bind a retry before reconciliation without repeating file work', async () => {
  repository.find.mockResolvedValue(operation);
  await service.executeReclassification({ classificationId: 1, targetLibraryId: 20, batchItemId: 7 });
  expect(repository.bind).toHaveBeenCalledWith(operation, 7);
  expect(repository.bind.mock.invocationCallOrder[0]).toBeLessThan(adapter.reconcile.mock.invocationCallOrder[0]);
  expect(adapter.moveFiles).not.toHaveBeenCalled();
});
test('invalid batch references cannot reserve or move', async () => {
  await expect(service.executeReclassification({ classificationId: 1, targetLibraryId: 20, batchItemId: -1 })).rejects.toThrow();
  expect(repository.reserve).not.toHaveBeenCalled();
});
test('reserves before any file operation, verifies before committing, and scans after commit', async () => {
  await expect(execute()).resolves.toMatchObject({ success: true, details: { newPath: '/new/item' } });
  expect(repository.reserve.mock.invocationCallOrder[0]).toBeLessThan(adapter.moveFiles.mock.invocationCallOrder[0]);
  expect(adapter.reconcile.mock.invocationCallOrder[0]).toBeLessThan(repository.complete.mock.invocationCallOrder[0]);
  expect(repository.complete.mock.invocationCallOrder[0]).toBeLessThan(scan.mock.invocationCallOrder[0]);
});
test.each(['moving', 'files_verified', 'needs_attention'])('retries %s using evidence, never repeats file work', async state => {
  repository.find.mockResolvedValue({ ...operation, state });
  await execute();
  expect(adapter.reconcile).toHaveBeenCalled();
  expect(adapter.moveFiles).not.toHaveBeenCalled();
  expect(adapter.prepare).not.toHaveBeenCalled();
});
test('duplicate completed request returns success without new effects', async () => {
  repository.find.mockResolvedValue({ ...operation, state: 'completed' });
  row = { ...row, library_id: 20, status: 'reclassified' };
  await expect(execute()).resolves.toMatchObject({ success: true });
  expect(adapter.moveFiles).not.toHaveBeenCalled();
  expect(repository.complete).not.toHaveBeenCalled();
});
test('different destination cannot supersede an unfinished operation', async () => {
  repository.find.mockResolvedValue({ ...operation, target_library_id: 30 });
  await expect(execute()).rejects.toMatchObject({ code: 'move_target_conflict' });
  expect(adapter.prepare).not.toHaveBeenCalled();
});
test('database failure after verified movement retains recovery and does not claim rollback', async () => {
  repository.complete.mockRejectedValue(new Error('database unavailable secret'));
  await expect(execute()).rejects.toMatchObject({ code: 'move_dependency_unavailable', status: 503, isOperational: true });
  expect(repository.defer).toHaveBeenCalledWith(operation, 'move_dependency_unavailable', false);
  expect(scan).not.toHaveBeenCalled();
  expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('secret');
});
test('crashed file operation retains intent and does not commit a correction', async () => {
  adapter.moveFiles.mockRejectedValue(new Error('interrupted'));
  await expect(execute()).rejects.toMatchObject({ code: 'move_dependency_unavailable' });
  expect(repository.reserve).toHaveBeenCalled();
  expect(repository.complete).not.toHaveBeenCalled();
});
test('ambiguous evidence requires attention with useful instructions', async () => {
  adapter.reconcile.mockRejectedValue(moveBlocked('move_source_remains', 'Inspect both folders; neither was removed.'));
  await expect(execute()).rejects.toThrow('Inspect both folders');
  expect(repository.defer).toHaveBeenCalledWith(operation, 'move_source_remains', true);
  expect(repository.complete).not.toHaveBeenCalled();
});
test('repeated identical warnings are suppressed across instances', async () => {
  operation.reason_code = 'move_dependency_unavailable';
  repository.find.mockResolvedValue(operation);
  adapter.reconcile.mockRejectedValue(new Error('offline'));
  await expect(execute()).rejects.toThrow('Recovery reference: operation-1');
  expect(logger.warn).not.toHaveBeenCalled();
});
test('classification drift blocks remote effects as well as correction persistence', async () => {
  repository.find.mockResolvedValue(operation);
  row.tmdb_id = 456;
  await expect(execute()).rejects.toMatchObject({ code: 'move_classification_changed' });
  expect(adapter.reconcile).not.toHaveBeenCalled();
});
test('busy lock cannot create or recover a move', async () => {
  database.withSessionAdvisoryLock.mockResolvedValue(false);
  await expect(execute()).rejects.toMatchObject({ code: 'move_busy' });
  await expect(service.recoverDue()).resolves.toEqual({ status: 'busy' });
  expect(repository.find).not.toHaveBeenCalled();
});
test('aborted owner cannot begin a reserved file operation', async () => {
  options.signal = AbortSignal.abort(new Error('lost lease'));
  await expect(execute()).rejects.toThrow('lost lease');
  expect(repository.reserve).not.toHaveBeenCalled();
  expect(adapter.moveFiles).not.toHaveBeenCalled();
});
test('background recovery processes one due operation without file movement', async () => {
  await expect(service.recoverDue()).resolves.toEqual({ status: 'completed' });
  expect(repository.due).toHaveBeenCalledTimes(1);
  expect(repository.prune).toHaveBeenCalledTimes(1);
  expect(adapter.moveFiles).not.toHaveBeenCalled();
});
test('idle recovery and transient deferral return bounded status', async () => {
  repository.due.mockResolvedValueOnce(null);
  await expect(service.recoverDue()).resolves.toEqual({ status: 'idle' });
  adapter.reconcile.mockRejectedValue(new Error('offline'));
  await expect(service.recoverDue()).resolves.toEqual({ status: 'deferred' });
});
test('scan failure cannot turn a committed move into another correction', async () => {
  scan.mockResolvedValue({ success: false });
  await expect(execute()).resolves.toMatchObject({ success: true });
  expect(repository.defer).not.toHaveBeenCalled();
  expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Plex scan'), { operationId: operation.id });
});
test.each([0, -1, '1x', null])('invalid ID %s is rejected before lock or effects', async classificationId => {
  await expect(service.executeReclassification({ classificationId, targetLibraryId: 20 })).rejects.toThrow('Valid classification');
  expect(database.withSessionAdvisoryLock).not.toHaveBeenCalled();
});
test('invalid correction actor fails before files can move', async () => {
  await expect(service.executeReclassification({ classificationId: 1, targetLibraryId: 20, correctedBy: 'x'.repeat(101) })).rejects.toThrow('actor');
  expect(adapter.prepare).not.toHaveBeenCalled();
});
test('scheduler registers bounded startup and non-overlapping periodic recovery', async () => {
  const scheduler = { schedule: jest.fn(), scheduleInitial: jest.fn() };
  registerReclassificationMoveSchedule(scheduler, service);
  expect(scheduler.schedule).toHaveBeenCalledWith('reclassification-move-recovery', '*/5 * * * *', expect.any(Function), null, { noOverlap: true });
  expect(scheduler.scheduleInitial).toHaveBeenCalledWith('reclassification-move-recovery', 120_000, expect.any(Function));
  await scheduler.schedule.mock.calls[0][2]();
  expect(repository.due).toHaveBeenCalledTimes(1);
});
