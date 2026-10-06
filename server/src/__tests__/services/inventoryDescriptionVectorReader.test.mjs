/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createHash } from 'node:crypto';
import { readInventoryDescriptionVectors } from '../../services/inventoryDescriptionVectorReader.mjs';
import { updateInventoryVectorFingerprint } from '../../services/inventoryVectorFingerprint.mjs';

const identity = { provider: 'ollama', model: 'test:latest', digest: 'a'.repeat(64), dimensions: 3 };
const hashes = count => Array.from({ length: count }, (_, i) => i.toString(16).padStart(64, '0'));
const vector = [0.100000001, -0.900000001, 0];
const rows = selected => selected.map(description_hash => ({ description_hash, embedding: JSON.stringify(vector) }));
const fingerprint = vectors => {
  const digest = createHash('sha256');
  updateInventoryVectorFingerprint(digest, vectors, identity.dimensions);
  return digest.digest('hex');
};

test('each encoded batch is decoded before the next query without rounding or normalization', async () => {
  const requested = hashes(600);
  let decoded = 0, queries = 0;
  const query = jest.fn(async (_sql, params) => {
    expect(decoded).toBe(queries * 256);
    queries++;
    return { rows: rows(params[4]).map(row => ({ description_hash: row.description_hash,
      get embedding() { decoded++; return row.embedding; } })) };
  });
  const result = await readInventoryDescriptionVectors(query, identity, requested);
  expect(query.mock.calls.map(([, params]) => params[4].length)).toEqual([256, 256, 88]);
  expect(result).toEqual(new Map(requested.map(hash => [hash, vector])));
  expect(result.get(requested[0])).not.toBe(vector);
  expect(fingerprint(result)).toBe(fingerprint(new Map(requested.map(hash => [hash, vector]))));
  expect(decoded).toBe(600);
});

test('high-dimensional batches obey the component bound as well as the row bound', async () => {
  const representation = { ...identity, dimensions: 16000 }, query = jest.fn(async () => ({ rows: [] }));
  expect((await readInventoryDescriptionVectors(query, representation, hashes(33))).size).toBe(0);
  expect(query.mock.calls.map(([, params]) => params[4].length)).toEqual([16, 16, 1]);
});

test.each([[], hashes(257).map((hash, i) => i === 256 ? 'bad' : hash), [...hashes(256), hashes(1)[0]], hashes(10001)].map(requested => ({ requested })))(
  'empty or invalid complete input cannot issue partial SQL', async ({ requested }) => {
    const query = jest.fn();
    if (requested.length) await expect(readInventoryDescriptionVectors(query, identity, requested)).rejects.toThrow('hashes_invalid');
    else expect(await readInventoryDescriptionVectors(query, identity, requested)).toEqual(new Map());
    expect(query).not.toHaveBeenCalled();
  });

test.each(['[0,0,0]', '[1,2]', '[null,1,0]', 'not-json', '[1e99,0,0]'])(
  'a corrupt row %s rejects the entire read before another batch', async embedding => {
    const query = jest.fn(async (_sql, params) => ({ rows: [{ description_hash: params[4][0], embedding }] }));
    await expect(readInventoryDescriptionVectors(query, identity, hashes(300))).rejects.toThrow();
    expect(query).toHaveBeenCalledTimes(1);
  });

test.each(['duplicate', 'out-of-scope'])('%s rows still fail closed', async scenario => {
  const requested = hashes(300), query = jest.fn(async (_sql, params) => {
    const answer = rows(params[4]);
    answer.push(scenario === 'duplicate' ? answer[0] : rows([requested[299]])[0]);
    return { rows: answer };
  });
  await expect(readInventoryDescriptionVectors(query, identity, requested)).rejects.toThrow('scope_invalid');
});

test('pre-abort performs no SQL; abort during a query prevents decoding or further reads', async () => {
  const stopped = new AbortController(); stopped.abort(new Error('stopped'));
  const query = jest.fn();
  await expect(readInventoryDescriptionVectors(query, identity, hashes(1), { signal: stopped.signal })).rejects.toThrow('stopped');
  expect(query).not.toHaveBeenCalled();
  const active = new AbortController(), decode = jest.fn(() => '[1,0,0]');
  query.mockImplementation(async (_sql, params) => {
    active.abort(new Error('stopped'));
    return { rows: [{ description_hash: params[4][0], get embedding() { return decode(); } }] };
  });
  await expect(readInventoryDescriptionVectors(query, identity, hashes(300), { signal: active.signal })).rejects.toThrow('stopped');
  expect(query).toHaveBeenCalledTimes(1); expect(decode).not.toHaveBeenCalled();
});

test('cooperative yield processes shutdown before the next batch', async () => {
  const controller = new AbortController();
  const query = jest.fn(async (_sql, params) => {
    setImmediate(() => controller.abort());
    return { rows: rows(params[4]) };
  });
  await expect(readInventoryDescriptionVectors(query, identity, hashes(300), { signal: controller.signal })).rejects.toThrow();
  expect(query).toHaveBeenCalledTimes(1);
});
