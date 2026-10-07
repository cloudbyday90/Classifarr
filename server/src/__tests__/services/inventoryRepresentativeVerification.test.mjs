/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createHash } from 'node:crypto';
import { fingerprintRepresentativeVerification } from '../../services/inventoryRepresentativeVerification.mjs';
import { inventoryRepresentativeSourceKey } from '../../services/inventoryRepresentativeProfile.mjs';
import { INVENTORY_DESCRIPTION_PROJECTION_VERSION } from '../../services/inventoryDescriptionProjection.mjs';
import { representativeProfileFixture } from '../helpers/inventoryRepresentativeProfileFixture.mjs';

// Independent v4 byte oracle: deliberately does not use the shared fingerprint helper.
function legacyKey(snapshot, identity, configKey) {
  const hash = createHash('sha256'), add = value => hash.update(JSON.stringify(value)).update('\n');
  add(['inventory_representative_profile_v4', [INVENTORY_DESCRIPTION_PROJECTION_VERSION,
    identity.model, identity.digest, identity.dimensions], configKey]);
  add(snapshot.libraries.map(row => [row.id, row.media_type]).sort((a, b) => a[0] - b[0]));
  add(snapshot.corpus.documents.map(row => [row.key, row.type, row.hash, [...row.libraryIds].sort((a, b) => a - b)])
    .sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  for (const key of [...snapshot.corpus.texts.keys()].sort()) {
    add([key, snapshot.vectors.has(key)]);
    if (!snapshot.vectors.has(key)) continue;
    const values = snapshot.vectors.get(key), bytes = Buffer.alloc(values.length * 4);
    values.forEach((value, index) => bytes.writeFloatLE(value, index * 4)); hash.update(bytes);
  }
  return hash.digest('hex');
}

function setup(perLibrary = 150, dimensions = 2) {
  const fixture = representativeProfileFixture({ perLibrary });
  fixture.identity.dimensions = dimensions;
  if (dimensions !== 2) for (const hash of fixture.snapshot.vectors.keys()) {
    fixture.snapshot.vectors.set(hash, Array(dimensions).fill(0.25));
  }
  const query = jest.fn(async (_sql, params) => ({ rows: [...params[4]].reverse().flatMap(hash =>
    fixture.snapshot.vectors.has(hash) ? [{ description_hash: hash, embedding: JSON.stringify(fixture.snapshot.vectors.get(hash)) }] : []) }));
  const run = (signal, config = 'private-config') => fingerprintRepresentativeVerification(query, fixture.identity, fixture.snapshot, config, signal);
  return { ...fixture, query, run };
}

test.each(['complete', 'partial', 'absent', 'empty', 'unused'])('stream/full v4 bytes match independent oracle with %s evidence', async mode => {
  const v = setup();
  if (mode === 'partial') [...v.snapshot.vectors.keys()].filter((_, i) => i % 10 === 0).forEach(hash => v.snapshot.vectors.delete(hash));
  if (mode === 'absent') v.snapshot.vectors.clear();
  if (mode === 'empty') { v.snapshot.vectors.clear(); v.snapshot.corpus.texts.clear(); v.snapshot.corpus.documents = []; }
  if (mode === 'unused') v.snapshot.corpus.documents = [];
  v.snapshot.libraries.reverse(); v.snapshot.corpus.documents.reverse();
  const expected = legacyKey(v.snapshot, v.identity, 'private-config');
  expect(await v.run()).toBe(expected);
  expect(inventoryRepresentativeSourceKey(v.snapshot, v.identity, 'private-config')).toBe(expected);
  expect(v.query.mock.calls.every(([, params]) => params[4].length <= 256)).toBe(true);
  expect(v.query).toHaveBeenCalledTimes(mode === 'empty' ? 0 : 2);
  expect(await v.run(undefined, 'changed-config')).not.toBe(expected);
});

test('dimensions bound each batch by components as well as vector count', async () => {
  const v = setup(20, 16000);
  expect(await v.run()).toBe(legacyKey(v.snapshot, v.identity, 'private-config'));
  expect(v.query.mock.calls.map(([, params]) => params[4].length)).toEqual([16, 16, 8]);
});

test.each(['malformed', 'zero', 'dimensions', 'duplicate', 'unrequested'])('rejects %s present rows, including vectors unused by any profile', async mode => {
  const v = setup(10); v.snapshot.corpus.documents = [];
  const query = v.query.getMockImplementation();
  v.query.mockImplementation(async (...args) => {
    const { rows } = await query(...args);
    if (mode === 'malformed') rows[0].embedding = '[null,1]';
    if (mode === 'zero') rows[0].embedding = '[0,0]';
    if (mode === 'dimensions') rows[0].embedding = '[1]';
    if (mode === 'duplicate') rows.push(rows[0]);
    if (mode === 'unrequested') rows[0].description_hash = 'f'.repeat(64);
    return { rows };
  });
  await expect(v.run()).rejects.toThrow();
});

test('aborts before SQL and between batches; never returns a partial digest', async () => {
  const v = setup(), before = new AbortController(); before.abort(new Error('stopped'));
  await expect(v.run(before.signal)).rejects.toThrow('stopped'); expect(v.query).not.toHaveBeenCalled();
  const during = new AbortController(), query = v.query.getMockImplementation();
  v.query.mockImplementation(async (...args) => { const rows = await query(...args); during.abort(new Error('stopped')); return rows; });
  await expect(v.run(during.signal)).rejects.toThrow('stopped'); expect(v.query).toHaveBeenCalledTimes(1);
});
