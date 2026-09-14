/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createInventoryDescriptionIsolationRepository } from '../../services/inventoryDescriptionIsolationRepository.mjs';

const identity = { provider: 'ollama', model: 'test:latest', digest: 'a'.repeat(64), dimensions: 3 };
const hash = 'b'.repeat(64);
test('validates scope before parameterized queries and never retains descriptions', async () => {
  const query = jest.fn(async () => ({ rows: [{ description_hash: hash, attempts: 0, due: false }] }));
  const repository = createInventoryDescriptionIsolationRepository({ query });
  expect(await repository.read(identity, [hash])).toEqual(new Map([[hash, { attempts: 0, due: false }]]));
  await repository.defer(identity, [hash], { code: 'batch', attempts: 0, delayMs: 60000 });
  expect(query.mock.calls[1][1]).toEqual([expect.any(String), 'test:latest', identity.digest, 3, [hash], 0, 'batch', 60000]);
  expect(query.mock.calls[1][0]).toContain('<= 20000');
  await repository.clear(identity, [hash]);
  await repository.pruneExpired();
  expect(query.mock.calls[3][0]).toContain('LIMIT 1000');
  const count = query.mock.calls.length;
  expect(await repository.read(identity, [])).toEqual(new Map());
  await repository.clear(identity, []);
  expect(query).toHaveBeenCalledTimes(count);
  for (const hashes of [[hash, hash], ['PRIVATE'], new Array(2), Array(10001).fill(hash)]) {
    await expect(repository.read(identity, hashes)).rejects.toThrow('description_isolation_hashes_invalid');
  }
  expect(query).toHaveBeenCalledTimes(count);
});

test.each([
  { description_hash: 'c'.repeat(64), attempts: 0, due: true },
  { description_hash: hash, attempts: 8, due: true },
  { description_hash: hash, attempts: 1, due: 'true' },
])('rejects malformed or cross-scope stored state %#', async row => {
  const repository = createInventoryDescriptionIsolationRepository({ query: async () => ({ rows: [row] }) });
  await expect(repository.read(identity, [hash])).rejects.toThrow('description_isolation_state_invalid');
});

test('rejects duplicate stored state and incomplete capacity admission', async () => {
  const row = { description_hash: hash, attempts: 0, due: true };
  const query = jest.fn(async () => ({ rows: [row, row] }));
  const repository = createInventoryDescriptionIsolationRepository({ query });
  await expect(repository.read(identity, [hash])).rejects.toThrow('description_isolation_state_invalid');
  query.mockResolvedValue({ rows: [] });
  await expect(repository.defer(identity, [hash], { code: 'batch', attempts: 0, delayMs: 60000 })).rejects.toThrow('description_isolation_capacity_exceeded');
  for (const bad of [{ code: 'transport' }, { attempts: 8 }, { delayMs: 0 }, { delayMs: 3600001 }]) {
    await expect(repository.defer(identity, [hash], { code: 'batch', attempts: 0, delayMs: 60000, ...bad })).rejects.toThrow('description_isolation_record_invalid');
  }
});
