/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createInventoryRepresentativeProfileRefresh } from '../../services/inventoryRepresentativeProfileRefresh.mjs';
import { buildInventoryRepresentativeProfile, inventoryRepresentativeSourceKey } from '../../services/inventoryRepresentativeProfile.mjs';
import { createInventoryNeighborhoodRecovery } from '../../services/inventoryNeighborhoodRecovery.mjs';
import { representativeProfileFixture } from '../helpers/inventoryRepresentativeProfileFixture.mjs';
import { resolveLocalStudyEmbeddingConfig } from '../../services/localStudyEmbeddingClient.mjs';

function setup() {
  const v = representativeProfileFixture({ perLibrary: 10 }); let time = 0, revision = 0;
  const configKey = JSON.stringify(resolveLocalStudyEmbeddingConfig(v.state));
  const key = () => inventoryRepresentativeSourceKey(v.snapshot, v.identity, configKey);
  const metadata = () => {
    const { vectors: _vectors, ...snapshot } = v.snapshot;
    return { ...structuredClone(snapshot), observedKeys: new Set(snapshot.observedKeys), key: key() };
  };
  const readVectors = jest.fn(async hashes => new Map(hashes.filter(hash => v.snapshot.vectors.has(hash))
    .map(hash => [hash, [...v.snapshot.vectors.get(hash)]])));
  const commit = jest.fn(), observer = { prepare: jest.fn(() => ({ commit })), hasPending: () => false, stop() {} };
  const repository = { read: jest.fn(async () => v.snapshot),
    prepareRepresentative: jest.fn(async (_identity, _options, prepare) => prepare({ ...metadata(), presentHashes: new Set(v.snapshot.vectors.keys()) }, readVectors)),
    readRepresentativeVerification: jest.fn(async () => metadata()) };
  const fit = jest.fn((snapshot, dimensions, options) => buildInventoryRepresentativeProfile({ snapshot, dimensions }, options));
  const recovery = createInventoryNeighborhoodRecovery({ getRevision: () => revision });
  const worker = createInventoryRepresentativeProfileRefresh({ repository, observer, neighborhoodRecovery: recovery, fit,
    readState: async () => v.state, createEmbedder: () => ({ ...v.identity, inspect: async () => v.identity }),
    now: () => time, getRevision: () => revision });
  return { ...v, worker, repository, readVectors, fit, commit, observer, recovery, key,
    advance: (ms = 300000) => { time += ms; }, invalidate: () => { revision++; } };
}

test.each(['complete', 'partial'])('warm %s preparation avoids full reads/fitting and retains fresh publication', async mode => {
  const v = setup();
  if (mode === 'partial') v.snapshot.vectors.delete(v.snapshot.corpus.documents[0].hash);
  expect((await v.worker.run()).status).toBe('published');
  const readiness = v.recovery.readReadiness(); v.advance();
  expect((await v.worker.run()).status).toBe('up_to_date');
  expect(v.repository.read).toHaveBeenCalledTimes(1); expect(v.fit).toHaveBeenCalledTimes(1);
  expect(v.repository.prepareRepresentative).toHaveBeenCalledTimes(1);
  expect(v.repository.readRepresentativeVerification).toHaveBeenCalledTimes(2);
  expect(v.observer.prepare.mock.calls[1][0].snapshot).not.toHaveProperty('vectors');
  expect(v.commit).toHaveBeenCalledTimes(2); expect(v.recovery.readReadiness()).toEqual(readiness);
  expect(v.readVectors).toHaveBeenCalledTimes(mode === 'partial' ? 1 : 2);
  v.worker.stop();
});

test.each(['changed', 'expired'])('%s source/cache uses a full fitting read after the probe closes', async mode => {
  const v = setup(); await v.worker.run();
  if (mode === 'changed') v.snapshot.vectors.values().next().value[0] += 0.25;
  v.advance(mode === 'expired' ? 1800000 : 300000);
  expect((await v.worker.run()).status).toBe('published');
  expect(v.repository.read).toHaveBeenCalledTimes(2); expect(v.fit).toHaveBeenCalledTimes(2);
  expect(v.repository.prepareRepresentative).toHaveBeenCalledTimes(mode === 'changed' ? 1 : 0);
  v.worker.stop();
});

test.each(['centroid', 'membership', 'summary', 'header'])('warm corrupted %s is withdrawn, not trusted or published', async mode => {
  const v = setup(); await v.worker.run(); const model = v.worker.read(v.key()), profile = model.libraries.get(1);
  if (mode === 'centroid') profile.starts[profile.selectedStart].groups[0].centroid = [0, 1];
  if (mode === 'membership') profile.membership.groups[0][0] = 'f'.repeat(64);
  if (mode === 'summary') model.summary.readyLibraries++;
  if (mode === 'header') model.version = 'invalid';
  v.advance(); expect((await v.worker.run()).status).toBe('failed');
  expect(v.commit).toHaveBeenCalledTimes(1); expect(v.worker.getStatus().cacheStored).toBe(false);
  expect((await v.worker.run()).status).toBe('cooldown');
  v.advance(60000); expect((await v.worker.run()).status).toBe('published'); v.worker.stop();
});

test.each(['revision', 'vector', 'config', 'busy', 'stop', 'reader_error'])('warm %s change cannot publish staged consumers', async mode => {
  const v = setup(); await v.worker.run(); v.advance();
  const read = v.readVectors.getMockImplementation();
  v.readVectors.mockImplementationOnce(async hashes => {
    const result = await read(hashes);
    if (mode === 'revision') v.invalidate();
    if (mode === 'vector') v.snapshot.vectors.values().next().value[0] += 0.25;
    if (mode === 'config') v.state.ollama_port++;
    if (mode === 'busy') v.state.busy = true;
    if (mode === 'stop') v.worker.stop();
    if (mode === 'reader_error') throw new Error('private database failure');
    return result;
  });
  expect((await v.worker.run()).status).toBe(mode === 'stop' ? 'cancelled' : mode === 'reader_error' ? 'failed' : 'invalidated');
  expect(v.commit).toHaveBeenCalledTimes(1); expect(v.worker.getStatus().cacheStored).toBe(false);
  expect(JSON.stringify(v.worker.getStatus())).not.toContain('private'); v.worker.stop();
});
