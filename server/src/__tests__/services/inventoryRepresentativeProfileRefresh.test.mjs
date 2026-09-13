/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createInventoryRepresentativeProfileRefresh } from '../../services/inventoryRepresentativeProfileRefresh.mjs';
import { buildInventoryRepresentativeProfile, inventoryRepresentativeSourceKey } from '../../services/inventoryRepresentativeProfile.mjs';
import { resolveLocalStudyEmbeddingConfig } from '../../services/localStudyEmbeddingClient.mjs';
import { representativeProfileFixture } from '../helpers/inventoryRepresentativeProfileFixture.mjs';

function setup() {
  const fixture = representativeProfileFixture();
  let time = 0, revision = 0;
  const { state, identity, snapshot } = fixture;
  const embedder = { model: identity.model, provider: identity.provider, inspect: jest.fn(async () => ({ ...identity })), embedBatch: jest.fn() };
  const dependencies = { repository: { read: jest.fn(async () => structuredClone(snapshot)) },
    readState: jest.fn(async () => ({ ...state })), createEmbedder: jest.fn(() => embedder),
    fit: jest.fn(async (input, dimensions, options) => buildInventoryRepresentativeProfile({ snapshot: input, dimensions }, options)),
    now: () => time, getRevision: () => revision };
  return { ...fixture, dependencies, embedder, worker: createInventoryRepresentativeProfileRefresh(dependencies),
    key: () => inventoryRepresentativeSourceKey(snapshot, identity, JSON.stringify(resolveLocalStudyEmbeddingConfig(state))),
    advance: (ms = 300_000) => { time += ms; }, sync: () => { revision++; } };
}

test('publishes atomically; quiet/periodic reconciliation reuses cached fits without embedding', async () => {
  const { worker, dependencies, advance, key, embedder } = setup();
  expect(worker.getStatus()).toMatchObject({ status: 'pending', cacheStored: false });
  expect(await worker.run()).toMatchObject({ status: 'published', groups: 2, libraries: 2 });
  expect(worker.read(key())).toMatchObject({ kind: 'full_inventory_shadow' });
  expect(worker.read('wrong')).toBeUndefined();
  expect(worker.getStatus()).toMatchObject({ cacheStored: true, verifiedAgeMs: 0 });
  expect(await worker.run()).toMatchObject({ status: 'not_due' });
  advance();
  expect(await worker.run()).toMatchObject({ status: 'up_to_date' });
  expect(dependencies.fit).toHaveBeenCalledTimes(1);
  expect(dependencies.repository.read).toHaveBeenCalledTimes(4);
  expect(embedder.embedBatch).not.toHaveBeenCalled();
  expect(JSON.stringify(worker.getStatus())).not.toMatch(/PRIVATE|hash|digest|localhost|libraryId|vector/i);
});

test('sync hints invalidate availability immediately and do not lose changes during fitting', async () => {
  const { worker, dependencies, key, sync, snapshot } = setup();
  await worker.run(); const oldKey = key();
  snapshot.corpus.documents.pop(); sync();
  expect(worker.read(oldKey)).toBeUndefined();
  const fit = dependencies.fit.getMockImplementation();
  dependencies.fit.mockImplementationOnce(async (...args) => { sync(); return fit(...args); });
  expect(await worker.run()).toMatchObject({ status: 'invalidated' });
  expect(worker.getStatus().cacheStored).toBe(false);
  expect(await worker.run()).toMatchObject({ status: 'published' });
});

test('unchanged sync hints and foreground work withdraw availability without unnecessary refits', async () => {
  const { worker, state, sync, key, dependencies } = setup();
  await worker.run(); sync();
  expect(worker.read(key())).toBeUndefined();
  expect(await worker.run()).toMatchObject({ status: 'up_to_date' });
  state.busy = true; expect(await worker.run()).toMatchObject({ status: 'yielded' });
  expect(worker.read(key())).toBeUndefined();
  state.busy = false; expect(await worker.run()).toMatchObject({ status: 'up_to_date' });
  expect(dependencies.fit).toHaveBeenCalledTimes(1);
});

test('periodic reconciliation observes changes without local hints and TTL forces rebuilding', async () => {
  const { worker, snapshot, advance, dependencies } = setup();
  await worker.run();
  snapshot.corpus.documents.pop(); advance();
  expect(await worker.run()).toMatchObject({ status: 'published', trainingDescriptions: 11 });
  advance(1_800_000);
  expect(worker.getStatus().cacheStored).toBe(false);
  expect(await worker.run()).toMatchObject({ status: 'published' });
  expect(dependencies.fit).toHaveBeenCalledTimes(3);
});

test.each([
  [{ rag_enabled: false }, 'disabled'], [{ primary_provider: 'other' }, 'unsupported_provider'],
  [{ busy: true }, 'yielded'], [{ busy: undefined }, 'yielded'],
])('ineligible state clears availability without expensive reads: %j', async (changes, status) => {
  const { worker, state, dependencies } = setup(); await worker.run();
  Object.assign(state, changes); dependencies.repository.read.mockClear();
  expect(await worker.run()).toMatchObject({ status });
  expect(worker.getStatus().cacheStored).toBe(false);
  expect(dependencies.repository.read).not.toHaveBeenCalled();
});

test.each(['membership', 'vector', 'library', 'config', 'busy', 'missing'])('mid-fit %s changes never publish', async mode => {
  const { worker, dependencies, snapshot, state } = setup();
  const fit = dependencies.fit.getMockImplementation();
  dependencies.fit.mockImplementationOnce(async (...args) => {
    if (mode === 'membership') snapshot.corpus.documents.pop();
    if (mode === 'vector') snapshot.vectors.values().next().value[0] += 0.1;
    if (mode === 'library') snapshot.libraries.pop();
    if (mode === 'config') state.ollama_port = 11435;
    if (mode === 'busy') state.busy = true;
    if (mode === 'missing') snapshot.vectors.clear();
    return fit(...args);
  });
  expect(await worker.run()).toMatchObject({ status: 'invalidated' });
  expect(worker.getStatus().cacheStored).toBe(false);
});

test('incomplete vectors self-heal on the next scheduled run without generating duplicates', async () => {
  const { worker, snapshot, dependencies, embedder } = setup(); const vectors = snapshot.vectors;
  snapshot.vectors = new Map();
  expect(await worker.run()).toMatchObject({ status: 'waiting_for_vectors' });
  expect(dependencies.fit).not.toHaveBeenCalled(); snapshot.vectors = vectors;
  expect(await worker.run()).toMatchObject({ status: 'published' });
  expect(embedder.embedBatch).not.toHaveBeenCalled();
});

test('empty inventory and initial snapshot drift skip fitting', async () => {
  const { worker, snapshot, dependencies } = setup();
  snapshot.corpus.texts.clear(); snapshot.vectors.clear();
  expect(await worker.run()).toMatchObject({ status: 'empty_corpus' });
  dependencies.repository.read.mockResolvedValueOnce({ ...snapshot, state: { busy: true } });
  expect(await worker.run()).toMatchObject({ status: 'invalidated' });
  expect(dependencies.fit).not.toHaveBeenCalled();
});

test('failure redaction, bounded backoff and provider recovery require no operator action', async () => {
  const { worker, dependencies, advance, identity, embedder } = setup();
  dependencies.fit.mockRejectedValueOnce(new Error('PRIVATE endpoint/token'));
  expect(await worker.run()).toMatchObject({ status: 'failed' });
  expect(await worker.run()).toMatchObject({ status: 'cooldown' }); advance(60_000);
  embedder.inspect.mockImplementationOnce(async () => ({ ...identity, digest: 'b'.repeat(64) }));
  expect(await worker.run()).toMatchObject({ status: 'failed' }); advance(120_000);
  expect(await worker.run()).toMatchObject({ status: 'published' });
  expect(JSON.stringify(worker.getStatus())).not.toContain('PRIVATE');
});

test('concurrent refreshes coalesce and shutdown prevents publication', async () => {
  const { worker, dependencies } = setup(); let resume;
  dependencies.fit.mockImplementationOnce(() => new Promise(resolve => { resume = resolve; }));
  const pending = worker.run();
  while (!resume) await new Promise(resolve => { setImmediate(resolve); });
  expect(await worker.run()).toMatchObject({ status: 'already_running' });
  worker.stop(); resume({});
  expect(await pending).toMatchObject({ status: 'cancelled' });
  expect(await worker.run()).toMatchObject({ status: 'cancelled' });
  expect(worker.getStatus().cacheStored).toBe(false);
});

test('external cancellation and invalid or overweight completed models cannot publish', async () => {
  const { worker, dependencies } = setup();
  const controller = new AbortController(); controller.abort();
  expect(await worker.run({ signal: controller.signal })).toMatchObject({ status: 'cancelled' });
  dependencies.fit.mockResolvedValueOnce({ kind: 'benchmark' });
  expect(await worker.run()).toMatchObject({ status: 'failed' });
  const other = setup(); const fit = other.dependencies.fit.getMockImplementation();
  other.dependencies.fit.mockImplementationOnce(async (...args) => ({ ...await fit(...args), weight: 40 * 1024 * 1024 }));
  expect(await other.worker.run()).toMatchObject({ status: 'cache_budget_exceeded' });
  expect(other.worker.getStatus().cacheStored).toBe(false);
});
