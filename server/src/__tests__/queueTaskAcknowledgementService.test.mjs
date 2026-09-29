/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { QueueTaskAcknowledgementService, releaseQueueClaim } from '../services/queueTaskAcknowledgementService.mjs';

const token = '11111111-1111-4111-8111-111111111111';
const task = { id: 1, claim_token: token };
let db, logger, receiptService, service;
beforeEach(() => {
  db = { query: jest.fn().mockResolvedValue({ rows: [] }) };
  logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  receiptService = { recordTerminal: jest.fn().mockResolvedValue(true) };
  service = new QueueTaskAcknowledgementService({ db, logger, receiptService });
});

test.each([null, undefined, '', 'private-token', {}, token + 'x'])('missing/malformed token %j never queries or logs the token', async invalid => {
  expect(await service.complete(1, {}, invalid)).toBe(false);
  expect(await service.fail(1, 'private error', invalid)).toBe(false);
  expect(await releaseQueueClaim(db, { id: 1, claim_token: invalid })).toBe(false);
  expect(db.query).not.toHaveBeenCalled();
  expect(logger.debug).toHaveBeenCalledWith(expect.any(String), { taskId: 1, reasonCode: 'queue_claim_not_owned' });
});

test('stale acknowledgements produce no success or intake receipt', async () => {
  expect(await service.complete(1, { owner: 'stale' }, token)).toBe(false);
  expect(await service.fail(1, 'private error', token)).toBe(false);
  expect(receiptService.recordTerminal).not.toHaveBeenCalled();
  expect(logger.info).not.toHaveBeenCalled();
  expect(logger.warn).not.toHaveBeenCalled();
  expect(logger.error).not.toHaveBeenCalled();
  for (const [sql] of db.query.mock.calls) {
    expect(sql).toContain("status = 'processing' AND claim_token = $3::uuid");
  }
});

test.each(['classification', 'metadata_enrichment'])('accepted %s completion records only the appropriate receipt', async taskType => {
  db.query.mockResolvedValue({ rows: [{ task_type: taskType, attempts: 1 }] });
  expect(await service.complete(1, { success: true }, token)).toBe(true);
  expect(db.query).toHaveBeenCalledWith(expect.stringContaining('claim_token = NULL'), [1, '{"result":{"success":true}}', token]);
  expect(receiptService.recordTerminal).toHaveBeenCalledTimes(taskType === 'classification' ? 1 : 0);
  expect(logger.info).toHaveBeenCalledWith('Task completed', { taskId: 1 });
});

test.each(['pending', 'failed'])('accepted %s failure uses returned authoritative attempts', async status => {
  db.query.mockResolvedValue({ rows: [{ task_type: 'classification', status, attempts: 3 }] });
  expect(await service.fail(1, 'url=https://private/?token=secret', token)).toBe(true);
  expect(receiptService.recordTerminal).toHaveBeenCalledWith(1, status === 'failed' ? 'failed' : 'retry_scheduled', 3, 'task_processing_failed');
  expect(db.query.mock.calls[0][1]).toEqual([1, 'task_processing_failed', token, [30, 60, 120, 300, 600]]);
});

test('query errors fail closed without logging private details', async () => {
  db.query.mockRejectedValue(new Error('secret database connection'));
  expect(await service.complete(1, {}, token)).toBe(false);
  expect(await service.fail(1, 'private', token)).toBe(false);
  expect(JSON.stringify(logger.error.mock.calls)).not.toContain('secret');
  expect(receiptService.recordTerminal).not.toHaveBeenCalled();
  await expect(releaseQueueClaim(db, task)).rejects.toThrow('secret database connection');
});

test('release reports accepted/stale separately and requires the exact claim', async () => {
  expect(await releaseQueueClaim(db, task)).toBe(false);
  db.query.mockResolvedValue({ rows: [{ id: 1 }] });
  expect(await releaseQueueClaim(db, task, 'task_graceful_shutdown_recovered')).toBe(true);
  expect(db.query).toHaveBeenLastCalledWith(expect.stringContaining("status = 'processing' AND claim_token = $2::uuid"), [1, token, 'task_graceful_shutdown_recovered']);
  expect(await releaseQueueClaim(db, undefined)).toBe(false);
});
