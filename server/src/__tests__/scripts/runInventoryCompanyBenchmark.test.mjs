/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { runInventoryCompanyBenchmark } from '../../scripts/runInventoryCompanyBenchmark.mjs';
import { inventoryCompanyFixture } from '../fixtures/inventoryCompanyFixture.mjs';

const argv = ['--seed', 'company-study-20260922', '--size', '300', '--folds', '3'];
test('CLI reads a bounded read-only snapshot, closes resources, and prints only aggregate data', async () => {
  const fixture = inventoryCompanyFixture(), close = jest.fn();
  const query = jest.fn(async sql => ({ rows: sql.startsWith('SELECT id, media_type') ? fixture.libraries : sql.includes('company_observation') ? fixture.rows : [] }));
  const result = await runInventoryCompanyBenchmark({ argv, load: async () => ({ withTransaction: callback => callback({ query }), close }) });
  expect(result.sampleSize).toBe(300);
  expect(query.mock.calls[0][0]).toContain('REPEATABLE READ READ ONLY');
  expect(query.mock.calls.every(([sql]) => !/^(INSERT|UPDATE|DELETE)/.test(sql.trim()))).toBe(true);
  expect(close).toHaveBeenCalledTimes(1);
});
test('invalid options never open the database, and database failure still closes it', async () => {
  const load = jest.fn();
  await expect(runInventoryCompanyBenchmark({ argv: ['--seed', 'bad'], load })).rejects.toThrow('invalid');
  await expect(runInventoryCompanyBenchmark({ argv: [...argv, '--folds', '0'], load })).rejects.toThrow();
  expect(load).not.toHaveBeenCalled();
  const close = jest.fn();
  await expect(runInventoryCompanyBenchmark({ argv, load: async () => ({ close, withTransaction: async () => { throw new Error('fixture'); } }) })).rejects.toThrow('fixture');
  expect(close).toHaveBeenCalledTimes(1);
});
