/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect, jest, afterEach } from '@jest/globals';
import { createComparisonStudyConsumers } from '../../scripts/comparisonMemoryStudy/consumers.mjs';
import { representativeShadowFixture } from '../helpers/inventoryRepresentativeShadowFixture.mjs';
import { resourceStudyEnvironment } from '../helpers/resourceStudyEnvironment.mjs';

const original = { ...process.env };
afterEach(() => { process.env = { ...original }; });
function setup() {
  Object.assign(process.env, resourceStudyEnvironment);
  const metrics = { markSync: jest.fn(), track: jest.fn() };
  return { metrics, consumers: createComparisonStudyConsumers({ metrics }) };
}

test('requires isolated synthetic environment before creating consumers', () => {
  delete process.env.CLASSIFARR_RESOURCE_STUDY;
  expect(() => createComparisonStudyConsumers({ metrics: {} })).toThrow();
});

test.each(['movie', 'tv'])('real %s consumers stage, verify metadata-only, and clear without changing sync contracts', async type => {
  const { consumers, metrics } = setup(), context = await representativeShadowFixture(type);
  const shadow = consumers.observer.prepare(context);
  expect(shadow?.then).toBeUndefined();
  const recovery = await consumers.neighborhoodRecovery.prepare(context);
  expect(consumers.read()).toMatchObject({ shadowPrepared: 1, neighborhoodPrepared: 1,
    shadowCommitted: 0, neighborhoodCommitted: 0, processed: 0, pending: 1, groups: 0, errors: 0 });
  const { vectors: _vectors, ...fresh } = context.snapshot;
  expect(shadow.commit(fresh)).toBeUndefined(); expect(recovery.commit(fresh)).toBeUndefined();
  shadow.commit(fresh); recovery.commit(fresh);
  expect(consumers.read()).toMatchObject({ shadowCommitted: 1, neighborhoodCommitted: 1,
    processed: 1, pending: 0, errors: 0, routingAffected: false });
  expect(consumers.read().groups).toBeGreaterThan(0);
  expect(metrics.markSync.mock.calls.map(([name]) => name)).toEqual([
    'recovery_shadow_prepare_start', 'recovery_shadow_prepare_end',
    'recovery_neighborhood_prepare_start', 'recovery_neighborhood_prepare_end',
    'recovery_shadow_commit_start', 'recovery_shadow_commit_end',
    'recovery_neighborhood_commit_start', 'recovery_neighborhood_commit_end',
  ]);
  consumers.stop();
  expect(consumers.read()).toMatchObject({ pending: 0, groups: 0, stopped: true });
  expect(JSON.stringify(consumers.read())).not.toMatch(/PRIVATE|hash|vector|configKey|90000/);
});

test('invalid fresh novelty and cancelled recovery cannot masquerade as processed evidence', async () => {
  const { consumers } = setup(), context = await representativeShadowFixture();
  const controller = new AbortController();
  const shadow = consumers.observer.prepare(context);
  const recovery = await consumers.neighborhoodRecovery.prepare({ ...context, signal: controller.signal });
  controller.abort(); shadow.commit({ ...context.snapshot, observedKeys: new Set() }); recovery.commit(context.snapshot);
  expect(consumers.read()).toMatchObject({ processed: 0, pending: 1, groups: 0 });
  consumers.stop();
});

test('failure is observable even when optional production callers swallow it', async () => {
  const { consumers, metrics } = setup(), context = await representativeShadowFixture();
  metrics.markSync.mockImplementation(() => { throw new Error('synthetic_failure'); });
  expect(() => consumers.observer.prepare(context)).toThrow();
  expect(consumers.read().errors).toBe(1);
  consumers.stop();
});

test('bounded query generation stops after 60 preparations, and stopped consumers reject more input', async () => {
  const { consumers } = setup(), context = await representativeShadowFixture();
  for (let i = 0; i < 60; i++) consumers.observer.prepare(context).commit(context.snapshot);
  expect(consumers.read()).toMatchObject({ processed: 60, pending: 0, invalidInputs: 0 });
  expect(() => consumers.observer.prepare(context)).toThrow('comparison_consumer_batch_budget');
  consumers.stop(); expect(() => consumers.observer.prepare(context)).toThrow();
});

test('empty candidate scope and aborted preparation retain failure/no-op evidence', async () => {
  const { consumers } = setup(), context = await representativeShadowFixture();
  const empty = { ...context, snapshot: { ...context.snapshot, libraries: [] } };
  expect(consumers.observer.prepare(empty)).toBeNull();
  expect(consumers.read()).toMatchObject({ processed: 0, shadowCommitted: 0 });
  const controller = new AbortController(); controller.abort();
  await expect(consumers.neighborhoodRecovery.prepare({ ...context, signal: controller.signal })).rejects.toThrow();
  expect(consumers.read().errors).toBe(1); consumers.stop();
});
