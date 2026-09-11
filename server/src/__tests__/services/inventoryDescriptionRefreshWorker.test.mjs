/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createInventoryDescriptionRefreshWorker } from '../../services/inventoryDescriptionRefreshWorker.mjs';
import { prepareInventoryDescriptionCorpus } from '../../services/inventoryDescriptionCorpus.mjs';
import { INVENTORY_DESCRIPTION_CACHE_LOCK } from '../../services/inventoryDescriptionBatchWriter.mjs';

function setup(count = 10) {
  let time = 0;
  let revision = 0;
  const state = { rag_enabled: true, embedding_provider_mode: 'same', primary_provider: 'ollama',
    embedding_model: 'test', ollama_host: 'localhost', ollama_port: 11434, busy: false };
  const rows = Array.from({ length: count }, (_, index) => ({ media_type: 'movie', tmdb_id: index + 1,
    library_id: 1, overview: `PRIVATE synopsis ${index}` }));
  const saved = new Set();
  const identity = { provider: 'ollama', model: 'test:latest', digest: 'a'.repeat(64), dimensions: 2 };
  const embedder = { provider: identity.provider, model: identity.model,
    inspect: jest.fn(async () => ({ ...identity })), embedBatch: jest.fn(async texts => texts.map(() => [1, 0])) };
  const repository = { readState: jest.fn(async () => ({ ...state })),
    readCorpus: jest.fn(async () => prepareInventoryDescriptionCorpus(rows)) };
  const cache = { pruneExpired: jest.fn(async () => 2),
    findPresent: jest.fn(async (representation, hashes) => new Set(hashes.filter(hash => saved.has(`${representation.digest}:${hash}`)))),
    write: jest.fn(async (representation, entries) => { entries.forEach(({ hash }) => saved.add(`${representation.digest}:${hash}`)); }) };
  const dependencies = { repository, cache, createEmbedder: jest.fn(() => embedder),
    withSessionAdvisoryLock: jest.fn(async (key, callback) => { await callback(); return true; }),
    now: () => time, getRevision: () => revision };
  return { state, rows, saved, identity, embedder, repository, cache, dependencies,
    worker: createInventoryDescriptionRefreshWorker(dependencies),
    advance: (ms = 300_000) => { time += ms; }, sync: () => { revision++; } };
}

test('bounded passes resume; unchanged descriptions only need hash lookups', async () => {
  const { worker, embedder, dependencies, advance } = setup(70);
  expect(await worker.run()).toMatchObject({ status: 'warming_cache', embeddedDescriptions: 64, remainingDescriptions: 6 });
  expect(embedder.embedBatch.mock.calls.map(([texts]) => texts.length)).toEqual(Array(8).fill(8));
  expect(await worker.run()).toMatchObject({ status: 'up_to_date', cacheHits: 64, embeddedDescriptions: 6 });
  expect(await worker.run()).toMatchObject({ status: 'not_due' });
  advance();
  expect(await worker.run()).toMatchObject({ status: 'up_to_date', cacheHits: 70, embeddedDescriptions: 0 });
  expect(embedder.embedBatch).toHaveBeenCalledTimes(9);
  expect(dependencies.withSessionAdvisoryLock).toHaveBeenCalledWith(INVENTORY_DESCRIPTION_CACHE_LOCK, expect.any(Function));
});

test('sync hints refresh changed text; periodic catch-up observes other writers and deletion', async () => {
  const { worker, rows, sync, advance } = setup(2);
  await worker.run();
  rows[0].overview = 'Changed PRIVATE text';
  sync();
  expect(await worker.run()).toMatchObject({ status: 'up_to_date', cacheHits: 1, embeddedDescriptions: 1 });
  rows.pop();
  advance();
  expect(await worker.run()).toMatchObject({ status: 'up_to_date', eligibleDescriptions: 1, cacheHits: 1, embeddedDescriptions: 0 });
});

test('restart discovers existing checkpoints without an in-memory sync hint', async () => {
  const { worker, dependencies } = setup();
  await worker.run();
  const restarted = createInventoryDescriptionRefreshWorker(dependencies);
  expect(await restarted.run()).toMatchObject({ status: 'up_to_date', cacheHits: 10, embeddedDescriptions: 0 });
});

test.each([
  [{ rag_enabled: false }, 'disabled'],
  [{ primary_provider: 'openai' }, 'unsupported_provider'],
  [{ ollama_host: 'https://example.com' }, 'unsupported_provider'],
  [{ embedding_model: 'test-cloud' }, 'unsupported_provider'],
  [{ busy: true }, 'yielded'],
  [{ busy: undefined }, 'yielded'],
])('ineligible or busy configuration skips corpus and provider work: %j', async (changes, status) => {
  const { worker, state, cache, repository, dependencies } = setup();
  Object.assign(state, changes);
  expect(await worker.run()).toMatchObject({ status });
  expect(cache.pruneExpired).toHaveBeenCalledTimes(1);
  expect(repository.readCorpus).not.toHaveBeenCalled();
  expect(dependencies.createEmbedder).not.toHaveBeenCalled();
});

test('empty corpus avoids provider inspection', async () => {
  const { worker, dependencies } = setup(0);
  expect(await worker.run()).toMatchObject({ status: 'empty_corpus', embeddedDescriptions: 0 });
  expect(dependencies.createEmbedder).not.toHaveBeenCalled();
});

test.each([{ busy: true }, { rag_enabled: false }, { embedding_model: 'other' }, { ollama_port: 12345 }])(
  'a mid-pass admission change discards the uncommitted batch: %j', async changes => {
    const { worker, state, embedder, cache } = setup();
    embedder.embedBatch.mockImplementationOnce(async texts => {
      Object.assign(state, changes);
      return texts.map(() => [1, 0]);
    });
    expect(await worker.run()).toMatchObject({ status: 'yielded', embeddedDescriptions: 0, remainingDescriptions: 10 });
    expect(embedder.embedBatch).toHaveBeenCalledTimes(1);
    expect(cache.write).not.toHaveBeenCalled();
  },
);

test('a sync during embedding is not lost behind a successful quiet interval', async () => {
  const { worker, embedder, sync } = setup(2);
  embedder.embedBatch.mockImplementationOnce(async texts => { sync(); return texts.map(() => [1, 0]); });
  expect(await worker.run()).toMatchObject({ status: 'yielded' });
  expect(await worker.run()).toMatchObject({ status: 'up_to_date', embeddedDescriptions: 2 });
});

test('foreground arrival after a committed batch yields and later resumes that checkpoint', async () => {
  const { worker, state, cache } = setup();
  const write = cache.write.getMockImplementation();
  cache.write.mockImplementationOnce(async (...args) => { await write(...args); state.busy = true; });
  expect(await worker.run()).toMatchObject({ status: 'yielded', embeddedDescriptions: 8 });
  state.busy = false;
  expect(await worker.run()).toMatchObject({ status: 'up_to_date', embeddedDescriptions: 2, cacheHits: 8 });
});

test('model digest drift discards the affected batch and later uses a new namespace', async () => {
  const { worker, identity, embedder, cache, advance } = setup();
  embedder.embedBatch.mockImplementationOnce(async texts => { identity.digest = 'b'.repeat(64); return texts.map(() => [1, 0]); });
  expect(await worker.run()).toMatchObject({ status: 'failed' });
  expect(cache.write).not.toHaveBeenCalled();
  advance();
  expect(await worker.run()).toMatchObject({ status: 'up_to_date', cacheHits: 0, embeddedDescriptions: 10 });
});

test('failure backoff is exponential and capped; new sync hints cannot bypass it', async () => {
  const { worker, repository, advance, sync } = setup();
  repository.readState.mockRejectedValue(new Error('PRIVATE database and credentials'));
  for (const delay of [60_000, 120_000, 240_000, 480_000, 960_000, 1_920_000, 3_600_000, 3_600_000]) {
    expect(await worker.run()).toEqual({ version: 'inventory_description_refresh.v1', mode: 'cache_only', status: 'failed' });
    sync();
    advance(delay - 1);
    expect(await worker.run()).toMatchObject({ status: 'cooldown' });
    advance(1);
  }
});

test('cross-process lock contention does no repository or provider work', async () => {
  const { worker, dependencies, cache } = setup();
  dependencies.withSessionAdvisoryLock.mockResolvedValue(false);
  expect(await worker.run()).toMatchObject({ status: 'already_running' });
  expect(cache.pruneExpired).not.toHaveBeenCalled();
});

test('shutdown aborts in-flight inference, releases ownership, and prevents new work', async () => {
  const { worker, embedder, cache } = setup();
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  embedder.embedBatch.mockImplementation((texts, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    started();
  }));
  const running = worker.run();
  await ready;
  expect(await worker.run()).toMatchObject({ status: 'already_running' });
  worker.stop();
  expect(await running).toMatchObject({ status: 'cancelled' });
  expect(await worker.run()).toMatchObject({ status: 'cancelled' });
  expect(cache.write).not.toHaveBeenCalled();
});

test('a pre-aborted external signal never acquires a lock', async () => {
  const { worker, dependencies } = setup();
  expect(await worker.run({ signal: AbortSignal.abort() })).toMatchObject({ status: 'cancelled' });
  expect(dependencies.withSessionAdvisoryLock).not.toHaveBeenCalled();
});

test('public refresh reports never include corpus, configuration, vectors or model identity', async () => {
  const { worker } = setup();
  const report = await worker.run();
  expect(JSON.stringify(report)).not.toMatch(/PRIVATE|localhost|11434|test:latest|digest|tmdb_id|library_id|overview|vector|hash/);
  expect(report).toMatchObject({ mode: 'cache_only', status: 'up_to_date' });
});
