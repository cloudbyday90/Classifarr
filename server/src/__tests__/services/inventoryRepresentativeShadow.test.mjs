/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { createInventoryRepresentativeShadow } from '../../services/inventoryRepresentativeShadow.mjs';
import { representativeShadowFixture } from '../helpers/inventoryRepresentativeShadowFixture.mjs';

async function setup() {
  const fixture = await representativeShadowFixture(); let time = 0, tick = 0;
  const shadow = createInventoryRepresentativeShadow({ now: () => time, monotonic: () => tick++ });
  const enqueue = (id = 90000) => {
    const metadata = { ...fixture.metadata, tmdb_id: id };
    shadow.remember(metadata, { ...fixture.query, request: { ...fixture.query.request, key: `movie:${id}` } });
    shadow.observe({ ...fixture.decision, metadata });
  };
  return { ...fixture, shadow, enqueue, advance: ms => { time += ms; } };
}

test('commits one bounded aggregate only after explicit fresh-snapshot approval', async () => {
  const fixture = await setup(), { shadow, enqueue, snapshot } = fixture;
  expect(shadow.prepare(fixture)).toBeNull(); enqueue();
  expect(shadow.hasPending()).toBe(true);
  const stage = shadow.prepare(fixture);
  expect(shadow.read().counts.agrees).toBe(0);
  stage.commit(snapshot); stage.commit(snapshot);
  expect(shadow.read()).toMatchObject({ pending: 0, counts: { agrees: 1 }, latency: { under_10ms: 1 }, routingAffected: false });
  expect(JSON.stringify(shadow.read())).not.toMatch(/PRIVATE|90000|hash|vector|configKey|destinationId/);
  enqueue(); expect(shadow.read().counts.duplicate).toBe(1);
});

test.each([
  ['unconverged_profiles', model => { model.libraries.get(2).starts[2].converged = false; }],
  ['sparse_profiles', model => { model.libraries.get(2).starts[2].groups[0].support = 2; }],
  ['initialization_sensitive', model => {
    model.libraries.get(1).starts[1].groups[0].centroid = [0, 1];
    model.libraries.get(2).starts[1].groups[0].centroid = [1, 0];
  }],
  ['no_positive_match', model => {
    for (const profile of model.libraries.values()) for (const start of profile.starts)
      for (const group of start.groups) group.centroid = [-1, 0];
  }],
  ['tied_destinations', model => { model.libraries.get(2).starts = structuredClone(model.libraries.get(1).starts); }],
])('commits only one %s diagnosis after fresh validation, without changing the decision', async (reason, mutate) => {
  const fixture = await setup(), original = structuredClone(fixture.decision);
  mutate(fixture.model); fixture.enqueue();
  const stage = fixture.shadow.prepare(fixture);
  expect(Object.values(fixture.shadow.read().counts).every(count => count === 0)).toBe(true);
  stage.commit(fixture.snapshot); stage.commit(fixture.snapshot);
  expect(Object.entries(fixture.shadow.read().counts).filter(([, count]) => count > 0)).toEqual([[reason, 1]]);
  expect(fixture.shadow.read().version).toBe('inventory_representative_shadow_v2');
  expect(fixture.decision).toEqual(original);
});

test('known evidence wins over diagnostic causes and never counts as unseen comparison', async () => {
  const fixture = await setup(); fixture.enqueue();
  fixture.snapshot.observedKeys.add('movie:90000');
  fixture.model.libraries.get(2).starts[2].converged = false;
  fixture.shadow.prepare(fixture).commit(fixture.snapshot);
  expect(Object.entries(fixture.shadow.read().counts).filter(([, count]) => count > 0)).toEqual([['known_item', 1]]);
});

test('novelty changes and discarded batches never count; the unchanged observation can retry', async () => {
  const fixture = await setup(); fixture.enqueue();
  const stage = fixture.shadow.prepare(fixture), fresh = { ...fixture.snapshot, observedKeys: new Set(fixture.snapshot.observedKeys) };
  fresh.observedKeys.add('movie:123'); stage.commit(fresh);
  expect(fixture.shadow.read()).toMatchObject({ pending: 1, counts: { agrees: 0, invalidated_batches: 1 } });
  fixture.shadow.prepare(fixture).commit(fixture.snapshot);
  expect(fixture.shadow.read().counts.agrees).toBe(1);
});

test('malformed fresh snapshots discard the batch and invalid clocks cannot retain capsules', async () => {
  const fixture = await setup(); fixture.enqueue();
  fixture.shadow.prepare(fixture).commit({ observedKeys: null });
  expect(fixture.shadow.read()).toMatchObject({ pending: 1, counts: { invalidated_batches: 1, agrees: 0 } });
  fixture.advance(NaN); fixture.enqueue(90001);
  expect(fixture.shadow.read()).toMatchObject({ pending: 0, counts: { expired: 1, invalid_input: 1 } });
});

test('caps pending work at 32 and consumes only eight entries per batch', async () => {
  const fixture = await setup(); for (let i = 0; i < 35; i++) fixture.enqueue(90000 + i);
  expect(fixture.shadow.read()).toMatchObject({ pending: 32, counts: { capacity: 3 } });
  fixture.shadow.prepare(fixture).commit(fixture.snapshot);
  expect(fixture.shadow.read()).toMatchObject({ pending: 24, counts: { agrees: 8 } });
});

test('expiry, clock rollback and shutdown release private data and prevent stale commits', async () => {
  const fixture = await setup(); fixture.enqueue(); const stage = fixture.shadow.prepare(fixture);
  fixture.advance(300000); stage.commit(fixture.snapshot);
  expect(fixture.shadow.read()).toMatchObject({ pending: 0, counts: { expired: 1, agrees: 0 } });
  fixture.enqueue(90001); fixture.advance(-1);
  expect(fixture.shadow.hasPending()).toBe(false);
  fixture.enqueue(90002); const stopped = fixture.shadow.prepare(fixture); fixture.shadow.stop();
  stopped.commit(fixture.snapshot); fixture.enqueue(90003);
  expect(fixture.shadow.read()).toMatchObject({ status: 'unavailable', pending: 0, counts: { agrees: 0 } });
  expect(fixture.shadow.prepare(fixture)).toBeNull();
});

test('capture is single-use, object-bound, replaceable and bounded independently of queued work', async () => {
  const fixture = await setup(), { shadow, metadata, query, decision } = fixture;
  shadow.remember(metadata, query); shadow.remember(metadata, query);
  shadow.observe({ ...decision, metadata: { ...metadata } });
  expect(shadow.read().counts.missing_query).toBe(1);
  shadow.observe(decision); shadow.observe(decision);
  expect(shadow.read()).toMatchObject({ pending: 1, counts: { missing_query: 2 } });
  for (let i = 0; i < 33; i++) shadow.remember({ ...metadata }, query);
  expect(shadow.read().counts.capacity).toBe(1);
  shadow.clear(); expect(shadow.read().pending).toBe(0);
  shadow.remember(metadata, { ...query, vector: [NaN, 0] });
  expect(shadow.read().counts.invalid_input).toBe(1);
  shadow.remember(metadata, query); decision.result.needs_retry = true; shadow.observe(decision);
  expect(shadow.read().counts.invalid_input).toBe(2);
});

test('deduplication expires independently and captured vectors have a component budget', async () => {
  const fixture = await setup(); fixture.enqueue(); fixture.shadow.prepare(fixture).commit(fixture.snapshot);
  fixture.advance(1800000); fixture.enqueue(); expect(fixture.shadow.read().pending).toBe(1);
  fixture.shadow.clear();
  const identity = { ...fixture.identity, dimensions: 16000 }, vector = Array(16000).fill(1);
  for (let i = 0; i < 17; i++) fixture.shadow.remember({ ...fixture.metadata }, { ...fixture.query, identity, vector });
  expect(fixture.shadow.read().counts.capacity).toBe(1);
});
