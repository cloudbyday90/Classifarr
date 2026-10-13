/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createQueueIdentityRepairBackfill, parseRepairBackfill } from '../services/queueIdentityRepairBackfill.mjs';

const item = { taskId: '23', receiptId: '00000000-0000-4000-8000-000000000001' };
test('normalizes exact task/receipt selection without accepting replacement data', () => {
  expect(parseRepairBackfill({ items: [{ ...item, taskId: 23 }], confirmRetry: true })).toEqual([item]);
});
test.each([null, {}, { items: [], confirmRetry: true }, { items: [item], confirmRetry: false },
  { items: [item], confirmRetry: true, tmdbId: 99 }, { items: [{ ...item, tmdbId: 99 }], confirmRetry: true },
  { items: [item, item], confirmRetry: true }, { items: [{ ...item, taskId: '01' }], confirmRetry: true },
  { items: [{ ...item, receiptId: 'invalid' }], confirmRetry: true },
  { items: [item, { ...item, taskId: '24' }], confirmRetry: true },
  { items: Array(6).fill(item), confirmRetry: true }])('rejects malformed selection %j', body => {
  expect(() => parseRepairBackfill(body)).toThrow();
});
test.each([{ afterId: '0' }, { afterId: ['2', '3'] }, { limit: 500 }, { afterId: '1 OR true' }])('rejects cursor %j before I/O', async query => {
  const db = { withTransaction: jest.fn() };
  await expect(createQueueIdentityRepairBackfill({ db }).list(1, query)).rejects.toMatchObject({ statusCode: 400 });
  expect(db.withTransaction).not.toHaveBeenCalled();
});
test('single-flight admission is released after failure; cancelled commands never start', async () => {
  let reject;
  const db = { withTransaction: jest.fn(() => new Promise((_, fail) => { reject = fail; })) };
  const service = createQueueIdentityRepairBackfill({ db });
  const body = { items: [item], confirmRetry: true };
  const pending = service.run(1, body);
  await expect(service.run(1, body)).rejects.toMatchObject({ statusCode: 409 });
  reject({ code: '55P03' });
  await expect(pending).rejects.toMatchObject({ statusCode: 409 });
  db.withTransaction.mockRejectedValueOnce(new Error('fixture'));
  await expect(service.run(1, body)).rejects.toThrow('fixture');
  await expect(service.run(1, body, AbortSignal.abort())).rejects.toThrow();
  expect(db.withTransaction).toHaveBeenCalledTimes(2);
});
