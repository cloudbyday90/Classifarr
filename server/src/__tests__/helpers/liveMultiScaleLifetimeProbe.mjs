/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { createLiveMultiScaleRefresh } from '../../services/liveMultiScaleRefresh.mjs';
import { liveFixture } from '../fixtures/liveMultiScaleFixture.mjs';
import { inspectUnseenMultiScaleSource } from '../../services/inventoryMultiScaleSource.mjs';

// Run only in a separate test process; neither Jest call histories nor production
// code should retain the observed objects or request garbage collection.
assert.equal(typeof globalThis.gc, 'function', 'diagnostic_gc_required');
const { state, identity } = liveFixture();
let time = 1_000_000, reads = 0, builds = 0, snapshotRef, inputRef;
const collect = async () => {
  for (let pass = 0; pass < 3; pass++) { await setImmediate(); globalThis.gc(); }
  await setImmediate();
};
const worker = createLiveMultiScaleRefresh({
  readState: async () => state, createEmbedder: () => ({ ...identity, inspect: async () => identity }),
  now: () => time, random: () => 0,
  repository: { async read() {
    reads++;
    if (reads % 2 === 0) {
      await collect();
      assert.equal(snapshotRef.deref(), undefined, 'first_snapshot_retained_during_verification');
      assert.equal(inputRef.deref(), undefined, 'owned_input_retained_during_verification');
    }
    const snapshot = liveFixture().snapshot;
    if (reads % 2 === 1) snapshotRef = new WeakRef(snapshot);
    return snapshot;
  }, async readVerification() {
    const snapshot = await this.read();
    const key = inspectUnseenMultiScaleSource(snapshot, identity).key;
    return { ...snapshot, vectors: undefined, key };
  } },
  async build(input) {
    builds++; inputRef = new WeakRef(input);
    await collect();
    assert.equal(snapshotRef.deref(), undefined, 'first_snapshot_retained_during_fit');
    assert.ok(input.training.vectors.size > 0, 'owned_input_must_remain_usable');
    return { cacheable: true, weight: 1000, handle: { retrieve: async () => null } };
  },
});
try {
  assert.deepEqual(await worker.run(), { status: 'ready' });
  time += 300_000;
  assert.deepEqual(await worker.run(), { status: 'revalidated' });
  assert.equal(reads, 4); assert.equal(builds, 1);
  process.stdout.write('comparison_phase_lifetimes_passed\n');
} finally { worker.stop(); }
