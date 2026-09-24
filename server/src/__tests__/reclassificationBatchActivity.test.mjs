/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { getBatchActivity } from '../services/reclassificationBatchActivity.mjs';

describe('batch activity read model', () => {
  test.each(['', '0:0', '0:-1', '0:2147483648', '2:1', '0:1junk', ' 0:1', ['0:1'], {}, null, '0:1;DELETE'])('rejects malformed cursor %p before querying', async after => {
    const database = { query: jest.fn() };
    await expect(getBatchActivity(after, database)).rejects.toThrow('Invalid batch activity cursor');
    expect(database.query).not.toHaveBeenCalled();
  });

  test('uses bounded parameterized reads and returns an empty page', async () => {
    const database = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    await expect(getBatchActivity(undefined, database)).resolves.toEqual({ batches: [], nextCursor: null });
    expect(database.query).toHaveBeenCalledWith(expect.not.stringMatching(/\b(UPDATE|INSERT|DELETE)\b/), [-1, 0, 11]);
  });

  test('returns an allowlisted page with a cursor at its last visible row', async () => {
    const rows = Array.from({ length: 11 }, (_, i) => ({ id: 100 - i, priority: 0, status: 'paused',
      total_items: 3, completed: 1, failed: 1, skipped: 0, cancelled: 0, recovering: 1, attention: 0,
      error_message: 'secret', plan: { path: '/private' } }));
    const database = { query: jest.fn().mockResolvedValue({ rows }) };
    const page = await getBatchActivity('0:101', database);
    expect(database.query).toHaveBeenCalledWith(expect.any(String), [0, 101, 11]);
    expect(page.batches).toHaveLength(10);
    expect(page.nextCursor).toBe('0:91');
    expect(page.batches[0]).toEqual({ id: 100, status: 'paused', total: 3, completed: 1,
      failed: 1, skipped: 0, cancelled: 0, recovering: 1, attention: 0 });
  });
});
