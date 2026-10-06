/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { fingerprintMultiScaleVerification } from '../../services/inventoryMultiScaleVerification.mjs';
import { inspectUnseenMultiScaleSource } from '../../services/inventoryMultiScaleSource.mjs';
import { representativeProfileFixture } from '../helpers/inventoryRepresentativeProfileFixture.mjs';

function setup(perLibrary = 150, dimensions = 2) {
  const value = representativeProfileFixture({ perLibrary });
  value.identity.dimensions = dimensions;
  if (dimensions !== 2) for (const [hash] of value.snapshot.vectors) value.snapshot.vectors.set(hash, Array(dimensions).fill(0.5));
  const query = jest.fn(async (_sql, params) => ({ rows: [...params[4]].reverse().map(hash => ({
    description_hash: hash, embedding: JSON.stringify(value.snapshot.vectors.get(hash)),
  })) }));
  return { ...value, query, verify: signal => fingerprintMultiScaleVerification(query, value.identity, value.snapshot, signal) };
}

test('canonical source key matches the pre-refactor implementation at e376a142', async () => {
  const v = setup(3);
  expect(await v.verify()).toBe('1b29633ba4b39a0db203592c05810197f2afa2bb7f9686e0932ab39ccf569a3d');
  expect(inspectUnseenMultiScaleSource(v.snapshot, v.identity).key).toBe(await v.verify());
});

test.each([2, 16000])('streamed verification preserves exact full-source keys with bounded %i-dimensional batches', async dimensions => {
  const v = setup(dimensions === 2 ? 150 : 20, dimensions), before = structuredClone(v.snapshot);
  expect(await v.verify()).toBe(inspectUnseenMultiScaleSource(v.snapshot, v.identity).key);
  expect(v.query.mock.calls.length).toBeGreaterThan(1);
  for (const [, params] of v.query.mock.calls) {
    expect(params[4].length).toBeLessThanOrEqual(256);
    expect(params[4].length * dimensions).toBeLessThanOrEqual(262144);
  }
  expect(v.snapshot).toEqual(before);
});

test('canonical order, shared membership, orphan descriptions and signed zero match the fitting key', async () => {
  const v = setup(3), doc = v.snapshot.corpus.documents[0], orphan = 'f'.repeat(64);
  v.snapshot.libraries.push({ id: 3, media_type: 'movie' });
  v.snapshot.corpus.documents.push({ ...doc, libraryIds: [3] });
  v.snapshot.corpus.texts.set(orphan, 'not a training document'); v.snapshot.vectors.set(orphan, [1, -0]);
  v.snapshot.libraries.reverse(); v.snapshot.corpus.documents.reverse();
  expect(await v.verify()).toBe(inspectUnseenMultiScaleSource(v.snapshot, v.identity).key);
  const base = await v.verify(); v.snapshot.vectors.set(orphan, [1, 0]);
  expect(await v.verify()).toBe(base);
  // Even values excluded from training must pass transport validation.
  v.snapshot.vectors.set(orphan, [0, 0]); await expect(v.verify()).rejects.toThrow();
});

test('last exact component, model identity and membership changes cannot reuse the original key', async () => {
  const v = setup(3), base = await v.verify(), hash = v.snapshot.corpus.documents[0].hash;
  v.snapshot.vectors.get(hash)[1] += Number.EPSILON;
  expect(await v.verify()).not.toBe(base);
  expect(await v.verify()).toBe(inspectUnseenMultiScaleSource(v.snapshot, v.identity).key);
  const changed = await v.verify(); v.identity.digest = 'b'.repeat(64);
  expect(await v.verify()).not.toBe(changed);
  const modelChanged = await v.verify(); v.snapshot.libraries.push({ id: 3, media_type: 'movie' });
  v.snapshot.corpus.documents[0].libraryIds = [1, 3];
  expect(await v.verify()).not.toBe(modelChanged);
});

test.each(['missing', 'duplicate', 'foreign', 'malformed', 'invalid'])('rejects %s payloads without a partial fingerprint', async kind => {
  const v = setup(3), original = v.query.getMockImplementation();
  v.query.mockImplementation(async (...args) => {
    const result = await original(...args);
    if (kind === 'missing') result.rows.pop();
    if (kind === 'duplicate') result.rows.push(result.rows[0]);
    if (kind === 'foreign') result.rows[0].description_hash = 'e'.repeat(64);
    if (kind === 'malformed') result.rows[0].embedding = 'not json';
    if (kind === 'invalid') result.rows[0].embedding = '[0,0]';
    return result;
  });
  await expect(v.verify()).rejects.toThrow();
});

test('empty input hashes without transport; invalid scope refuses transport', async () => {
  const v = setup(0);
  expect(await v.verify()).toBe(inspectUnseenMultiScaleSource(v.snapshot, v.identity).key);
  expect(v.query).not.toHaveBeenCalled();
  const invalid = setup(3); invalid.snapshot.corpus.documents[0].libraryIds = [99];
  await expect(invalid.verify()).rejects.toThrow('multi_scale_unscoped_source');
  expect(invalid.query).not.toHaveBeenCalled();
});

test('cancellation before and between batches never returns a digest or reads another batch', async () => {
  const v = setup(), controller = new AbortController(), query = v.query.getMockImplementation();
  await expect(v.verify(AbortSignal.abort(new Error('stopped')))).rejects.toThrow('stopped');
  expect(v.query).not.toHaveBeenCalled();
  v.query.mockImplementation(async (...args) => { const rows = await query(...args); controller.abort(new Error('stopped')); return rows; });
  await expect(v.verify(controller.signal)).rejects.toThrow('stopped');
  expect(v.query).toHaveBeenCalledTimes(1);
});
