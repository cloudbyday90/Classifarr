/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { setImmediate as yieldTurn } from 'node:timers/promises';
import { createInventoryRepresentativeProfileRefresh } from '../../services/inventoryRepresentativeProfileRefresh.mjs';
import { createInventoryNeighborhoodRecovery } from '../../services/inventoryNeighborhoodRecovery.mjs';
import { createInventoryRepresentativeShadow } from '../../services/inventoryRepresentativeShadow.mjs';
import { buildInventoryRepresentativeProfile } from '../../services/inventoryRepresentativeProfile.mjs';
import { resolveLocalStudyEmbeddingConfig } from '../../services/localStudyEmbeddingClient.mjs';
import { representativeProfileFixture } from './inventoryRepresentativeProfileFixture.mjs';
import { representativeShadowFixture } from './inventoryRepresentativeShadowFixture.mjs';

// Deliberate GC is confined to a synthetic test subprocess, never a runtime/study switch.
assert.equal(typeof globalThis.gc, 'function', 'lifetime_test_requires_explicit_gc');
const mode = process.argv[2];
assert.ok(['plain', 'callbacks', 'retained-control'].includes(mode));
const { state } = representativeProfileFixture();
const fixture = await representativeShadowFixture();
fixture.snapshot.state = state;
const observer = mode === 'plain' ? null : createInventoryRepresentativeShadow();
const neighborhoodRecovery = mode === 'plain' ? null : createInventoryNeighborhoodRecovery();
const retained = [], references = [], checks = [];
let reads = 0, time = 0;
const repository = { async read() {
  reads++;
  if (reads % 2 === 0) {
    // Avoid dereferencing before collection: WeakRef keeps its target for that job.
    for (let attempt = 0; attempt < 4; attempt++) { await yieldTurn(); globalThis.gc(); }
    await yieldTurn();
    checks.push(references.map(reference => reference.deref() !== undefined));
    if (observer) assert.equal(observer.read().pending, 1, 'must_not_commit_before_verification');
  }
  const snapshot = structuredClone(fixture.snapshot);
  if (reads % 2 === 1) {
    references.push(new WeakRef(snapshot), new WeakRef(snapshot.vectors), new WeakRef(snapshot.vectors.values().next().value));
    if (mode === 'retained-control') retained.push(snapshot);
  }
  return snapshot;
} };
const worker = createInventoryRepresentativeProfileRefresh({ repository, observer, neighborhoodRecovery,
  readState: async () => state, now: () => time,
  createEmbedder: () => ({ ...fixture.identity, inspect: async () => fixture.identity }),
  fit: (snapshot, dimensions, options) => buildInventoryRepresentativeProfile({ snapshot, dimensions }, options) });
try {
  for (let cycle = 0; cycle < 2; cycle++) {
    if (observer) {
      const metadata = { ...fixture.metadata, tmdb_id: 90000 + cycle };
      observer.remember(metadata, { ...fixture.query, request: { ...fixture.query.request, key: `movie:${metadata.tmdb_id}` },
        configKey: JSON.stringify(resolveLocalStudyEmbeddingConfig(state)) });
      observer.observe({ ...fixture.decision, metadata });
    }
    const report = await worker.run();
    assert.deepEqual(checks.at(-1), Array((cycle + 1) * 3).fill(mode === 'retained-control'), 'snapshot_reachability');
    assert.equal(report.status, cycle ? 'up_to_date' : 'published');
    if (observer) assert.equal(observer.read().pending, 0);
    time += 300_000;
  }
  assert.equal(reads, 4);
  assert.equal(retained.length, mode === 'retained-control' ? 2 : 0);
  process.stdout.write('representative_snapshot_lifetime_passed\n');
} finally { worker.stop(); }
