/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { fingerprintMultiScaleVerification } from '../../services/inventoryMultiScaleVerification.mjs';
import { representativeProfileFixture } from './inventoryRepresentativeProfileFixture.mjs';
import { readInventoryDescriptionVectors } from '../../services/inventoryDescriptionVectorReader.mjs';
import { inspectUnseenMultiScaleSource } from '../../services/inventoryMultiScaleSource.mjs';

assert.equal(typeof globalThis.gc, 'function', 'diagnostic_gc_required');
const { snapshot, identity } = representativeProfileFixture({ perLibrary: 150 });
const parse = JSON.parse;
let refs = [], batches = 0;
// This standalone diagnostic observes parsed arrays without retaining them.
JSON.parse = (...args) => {
  const value = parse(...args);
  if (Array.isArray(value)) refs.push(new WeakRef(value));
  return value;
};
try {
  const query = async (_sql, params) => {
    if (batches++) {
      for (let pass = 0; pass < 3; pass++) { await setImmediate(); globalThis.gc(); }
      assert.equal(refs.filter(ref => ref.deref()).length, 0, 'completed_batch_vectors_retained');
      refs = [];
    }
    return { rows: params[4].map(hash => ({ description_hash: hash, embedding: JSON.stringify(snapshot.vectors.get(hash)) })) };
  };
  const key = process.argv.includes('--full-map-control')
    ? inspectUnseenMultiScaleSource({ ...snapshot, vectors: await readInventoryDescriptionVectors(query, identity,
      [...snapshot.corpus.texts.keys()]) }, identity).key
    : await fingerprintMultiScaleVerification(query, identity, snapshot);
  assert.match(key, /^[a-f0-9]{64}$/); assert.equal(batches, 2);
  process.stdout.write('comparison_verification_batches_released\n');
} finally { JSON.parse = parse; }
