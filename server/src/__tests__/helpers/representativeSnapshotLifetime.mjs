/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { setImmediate as yieldTurn } from 'node:timers/promises';
import { createInventoryRepresentativeProfileRefresh } from '../../services/inventoryRepresentativeProfileRefresh.mjs';
import { createInventoryNeighborhoodRecovery } from '../../services/inventoryNeighborhoodRecovery.mjs';
import { createInventoryRepresentativeShadow } from '../../services/inventoryRepresentativeShadow.mjs';
import { buildInventoryRepresentativeProfile, inventoryRepresentativeSourceKey } from '../../services/inventoryRepresentativeProfile.mjs';
import { resolveLocalStudyEmbeddingConfig } from '../../services/localStudyEmbeddingClient.mjs';
import { representativeProfileFixture } from './inventoryRepresentativeProfileFixture.mjs';
import { representativeShadowFixture } from './inventoryRepresentativeShadowFixture.mjs';
import { createComparisonStudyConsumers } from '../../scripts/comparisonMemoryStudy/consumers.mjs';
import { resourceStudyEnvironment } from './resourceStudyEnvironment.mjs';
import { withRepresentativePreparationReader } from '../../services/inventoryRepresentativePreparationReader.mjs';

// Deliberate GC is confined to a synthetic test subprocess, never a runtime/study switch.
assert.equal(typeof globalThis.gc, 'function', 'lifetime_test_requires_explicit_gc');
const mode = process.argv[2];
assert.ok(['plain', 'callbacks', 'retained-control', 'study-consumers', 'warm-consumers'].includes(mode));
const { state } = representativeProfileFixture();
const fixture = await representativeShadowFixture();
fixture.snapshot.state = state;
Object.assign(process.env, resourceStudyEnvironment);
const consumers = ['study-consumers', 'warm-consumers'].includes(mode) ? createComparisonStudyConsumers({ metrics: { markSync() {}, track() {} } }) : null;
const observer = consumers?.observer ?? (mode === 'plain' ? null : createInventoryRepresentativeShadow());
const neighborhoodRecovery = consumers?.neighborhoodRecovery ?? (mode === 'plain' ? null : createInventoryNeighborhoodRecovery());
const retained = [], references = [], checks = [];
let reads = 0, verifications = 0, time = 0;
const repository = { async read() {
  reads++;
  const snapshot = structuredClone(fixture.snapshot);
  references.push(new WeakRef(snapshot), new WeakRef(snapshot.vectors), new WeakRef(snapshot.vectors.values().next().value));
  if (mode === 'retained-control') retained.push(snapshot);
  return snapshot;
}, async readRepresentativeVerification(identity, { configKey }) {
  verifications++;
  // Avoid dereferencing before collection: WeakRef keeps its target for that job.
  for (let attempt = 0; attempt < 4; attempt++) { await yieldTurn(); globalThis.gc(); }
  await yieldTurn();
  checks.push(references.map(reference => reference.deref() !== undefined));
  if (observer) assert.equal(observer.read().pending, 1, 'must_not_commit_before_verification');
  const { vectors: _vectors, ...metadata } = fixture.snapshot;
  return { ...structuredClone(metadata), key: inventoryRepresentativeSourceKey(fixture.snapshot, identity, configKey) };
} };
if (mode === 'warm-consumers') repository.prepareRepresentative = async (identity, { configKey, signal }, prepare) => {
  const { vectors: _vectors, ...metadata } = fixture.snapshot;
  const snapshot = { ...structuredClone(metadata), presentHashes: new Set(fixture.snapshot.vectors.keys()),
    key: inventoryRepresentativeSourceKey(fixture.snapshot, identity, configKey) };
  references.push(new WeakRef(snapshot), new WeakRef(snapshot.presentHashes));
  return withRepresentativePreparationReader(async (_sql, params) => ({ rows: params[4].map(hash => ({
    description_hash: hash, embedding: JSON.stringify(fixture.snapshot.vectors.get(hash)),
  })) }), identity, snapshot, signal, (source, readVectors) => {
    references.push(new WeakRef(readVectors));
    return prepare(source, async hashes => {
      const vectors = await readVectors(hashes);
      references.push(new WeakRef(vectors), new WeakRef(vectors.values().next().value));
      return vectors;
    });
  });
};
const worker = createInventoryRepresentativeProfileRefresh({ repository, observer, neighborhoodRecovery,
  readState: async () => state, now: () => time,
  createEmbedder: () => ({ ...fixture.identity, inspect: async () => fixture.identity }),
  fit: (snapshot, dimensions, options) => buildInventoryRepresentativeProfile({ snapshot, dimensions }, options) });
try {
  for (let cycle = 0; cycle < 2; cycle++) {
    if (observer && !consumers) {
      const metadata = { ...fixture.metadata, tmdb_id: 90000 + cycle };
      observer.remember(metadata, { ...fixture.query, request: { ...fixture.query.request, key: `movie:${metadata.tmdb_id}` },
        configKey: JSON.stringify(resolveLocalStudyEmbeddingConfig(state)) });
      observer.observe({ ...fixture.decision, metadata });
    }
    const report = await worker.run();
    assert.deepEqual(checks.at(-1), Array(references.length).fill(mode === 'retained-control'), 'snapshot_reachability');
    assert.equal(report.status, cycle ? 'up_to_date' : 'published');
    if (observer) assert.equal(observer.read().pending, 0);
    time += 300_000;
  }
  assert.equal(reads, mode === 'warm-consumers' ? 1 : 2);
  assert.equal(references.length, mode === 'warm-consumers' ? 10 : 6);
  assert.equal(verifications, 2);
  assert.equal(retained.length, mode === 'retained-control' ? 2 : 0);
  process.stdout.write('representative_snapshot_lifetime_passed\n');
} finally { worker.stop(); consumers?.stop(); }
