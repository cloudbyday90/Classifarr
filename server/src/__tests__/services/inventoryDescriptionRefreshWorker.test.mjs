/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createInventoryDescriptionRefreshWorker } from '../../services/inventoryDescriptionRefreshWorker.mjs';
import { prepareInventoryDescriptionCorpus } from '../../services/inventoryDescriptionCorpus.mjs';
import { INVENTORY_DESCRIPTION_CACHE_LOCK } from '../../services/inventoryDescriptionBatchWriter.mjs';
import { createInventoryDescriptionRecovery } from '../../services/inventoryDescriptionRecovery.mjs';
import { createMemoryDescriptionIsolation } from '../fixtures/descriptionIsolation.mjs';
import { providerResponseError } from '../../services/providerResponseDiagnosis.mjs';
import { createInventoryNeighborhoodRecovery } from '../../services/inventoryNeighborhoodRecovery.mjs';
import { buildInventoryRepresentativeProfile } from '../../services/inventoryRepresentativeProfile.mjs';
import { resolveLocalStudyEmbeddingConfig } from '../../services/localStudyEmbeddingClient.mjs';

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
    now: () => time, getRevision: () => revision,
    recovery: createInventoryDescriptionRecovery({ now: () => time, random: () => 0 }),
    isolation: createMemoryDescriptionIsolation(() => time), random: () => 0 };
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

test('backfill repairs a lost group first while ordinary new-library work shares the existing budget', async () => {
  const fixture = setup(70), { identity, state, repository, rows, saved, cache, dependencies } = fixture;
  const corpus = await repository.readCorpus(), hashes = [...corpus.texts.keys()];
  const snapshot = { corpus, libraries: [{ id: 1, media_type: 'movie' }],
    vectors: new Map(hashes.map((hash, i) => [hash, i < 67 ? [1, 0] : [0, 1]])) };
  const model = await buildInventoryRepresentativeProfile({ snapshot, dimensions: identity.dimensions });
  const neighborhoodRecovery = createInventoryNeighborhoodRecovery();
  (await neighborhoodRecovery.prepare({ model, snapshot, identity,
    configKey: JSON.stringify(resolveLocalStudyEmbeddingConfig(state)) })).commit();
  hashes.slice(0, 67).forEach(hash => saved.add(`${identity.digest}:${hash}`));
  rows.push(...Array.from({ length: 100 }, (_, i) => ({ media_type: 'tv', tmdb_id: i + 100,
    library_id: 2, overview: `PRIVATE newly discovered TV description ${i}` })));
  const worker = createInventoryDescriptionRefreshWorker({ ...dependencies, neighborhoodRecovery });
  expect(await worker.run()).toMatchObject({ status: 'warming_cache', embeddedDescriptions: 64, remainingDescriptions: 39,
    neighborhoodRecovery: { referencedLibraries: 1, unknownLibraries: 1, underrepresentedGroups: 1, prioritizedDescriptions: 3 } });
  expect(new Set(cache.write.mock.calls[0][1].slice(0, 3).map(row => row.hash))).toEqual(new Set(hashes.slice(-3)));
  expect(cache.write.mock.calls).toHaveLength(8);
  expect(await worker.run()).toMatchObject({ status: 'up_to_date', embeddedDescriptions: 39,
    neighborhoodRecovery: { underrepresentedGroups: 0, prioritizedDescriptions: 0 } });
});

test('unusable recovery references fall back without leaking source errors or stopping ordinary backfill', async () => {
  const { dependencies } = setup(2);
  const worker = createInventoryDescriptionRefreshWorker({ ...dependencies,
    neighborhoodRecovery: { prioritize() { throw new Error('PRIVATE malformed source'); } } });
  const report = await worker.run();
  expect(report).toMatchObject({ status: 'up_to_date', embeddedDescriptions: 2 });
  expect(JSON.stringify(report)).not.toContain('PRIVATE');
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
    expect(await worker.run()).toEqual({ version: 'inventory_description_refresh.v1', mode: 'cache_only', status: 'failed',
      failureCode: 'unknown', retryAfterSeconds: delay / 1000 });
    sync();
    advance(delay - 1);
    expect(await worker.run()).toMatchObject({ status: 'cooldown' });
    advance(1);
  }
});

test('busy passes cannot reset an unresolved failure episode or its exponential delay', async () => {
  const { worker, state, embedder, advance } = setup();
  embedder.embedBatch.mockRejectedValue(new Error('PRIVATE'));
  expect(await worker.run()).toMatchObject({ status: 'failed', retryAfterSeconds: 60 });
  advance(60_000);
  state.busy = true;
  expect(await worker.run()).toMatchObject({ status: 'yielded' });
  state.busy = false;
  expect(await worker.run()).toMatchObject({ status: 'failed', retryAfterSeconds: 120 });
});

test('rejects sparse batches without a partial cache write', async () => {
  const { worker, embedder, cache } = setup(2);
  embedder.embedBatch.mockResolvedValue(new Array(2));
  expect(await worker.run()).toMatchObject({ status: 'warming_cache', isolatedDescriptions: 2, remainingDescriptions: 2 });
  expect(cache.write).not.toHaveBeenCalled();
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

test('a bad description cannot starve healthy movie/TV work and eventually self-heals', async () => {
  const { worker, rows, embedder, advance, dependencies, saved } = setup(24);
  rows.slice(12).forEach(row => { row.media_type = 'tv'; row.library_id = 2; });
  const original = embedder.embedBatch.getMockImplementation();
  embedder.embedBatch.mockImplementation(async texts => {
    if (texts.includes('PRIVATE synopsis 0')) throw providerResponseError('http_rejected', 'embedding');
    return original(texts);
  });
  expect(await worker.run()).toMatchObject({ status: 'warming_cache', isolatedDescriptions: 8, embeddedDescriptions: 16, remainingDescriptions: 8 });
  expect(saved.size).toBe(16);
  expect([...dependencies.isolation.records.values()].every(record => record.attempts === 0)).toBe(true);
  advance(60000);
  const partial = await worker.run();
  expect(partial).toMatchObject({ status: 'warming_cache', embeddedDescriptions: 7, isolatedDescriptions: 1, remainingDescriptions: 1 });
  expect(saved.size).toBe(23);
  expect([...dependencies.isolation.records.values()]).toMatchObject([{ attempts: 1 }]);
  const calls = embedder.embedBatch.mock.calls.length;
  expect(await worker.run()).toMatchObject({ status: 'waiting_for_retry', deferredDescriptions: 1 });
  expect(embedder.embedBatch).toHaveBeenCalledTimes(calls);
  advance(60000);
  embedder.embedBatch.mockImplementation(original);
  expect(await worker.run()).toMatchObject({ status: 'up_to_date', cacheHits: 23, embeddedDescriptions: 1, deferredDescriptions: 0 });
  expect(dependencies.isolation.records.size).toBe(0);
});

test('all-bad provider responses stop after two calls, persist suspects and retain global cooldown', async () => {
  const { worker, embedder, dependencies } = setup(40);
  embedder.embedBatch.mockResolvedValue([]);
  expect(await worker.run()).toMatchObject({ status: 'failed', failureCode: 'batch', retryAfterSeconds: 60 });
  expect(embedder.embedBatch).toHaveBeenCalledTimes(2);
  expect(dependencies.isolation.records.size).toBe(16);
  expect(await worker.run()).toMatchObject({ status: 'cooldown' });
});

test.each(['transport', 'http_busy', 'http_auth', 'json', 'model'])('provider-wide %s failures do not isolate individual descriptions', async code => {
  const { worker, embedder, dependencies } = setup();
  embedder.embedBatch.mockRejectedValue(providerResponseError(code, 'embedding'));
  expect(await worker.run()).toMatchObject({ status: 'failed', failureCode: code });
  expect(embedder.embedBatch).toHaveBeenCalledTimes(1);
  expect(dependencies.isolation.records.size).toBe(0);
});

test('busy admission after rejection prevents a stale isolation write', async () => {
  const { worker, state, embedder, dependencies } = setup();
  embedder.embedBatch.mockImplementationOnce(async () => { state.busy = true; return []; });
  expect(await worker.run()).toMatchObject({ status: 'yielded' });
  expect(dependencies.isolation.records.size).toBe(0);
});

test('a cache write failure is not reclassified as an individual input error', async () => {
  const { worker, cache, dependencies } = setup();
  cache.write.mockRejectedValue(Object.assign(new Error('PRIVATE storage'), { code: 'INVALID_EMBEDDING', embeddingIssue: 'zero' }));
  expect(await worker.run()).toMatchObject({ status: 'failed' });
  expect(dependencies.isolation.records.size).toBe(0);
});

test('model drift behind a malformed response does not label descriptions as suspect', async () => {
  const { worker, embedder, identity, dependencies } = setup();
  embedder.embedBatch.mockImplementationOnce(async () => { identity.digest = 'b'.repeat(64); return []; });
  expect(await worker.run()).toMatchObject({ status: 'failed', failureCode: 'model_changed' });
  expect(dependencies.isolation.records.size).toBe(0);
});

test('journal namespace follows the installed representation and changed content', async () => {
  const { worker, embedder, identity, dependencies, advance, rows } = setup(2);
  embedder.embedBatch.mockResolvedValueOnce([]);
  await worker.run();
  expect(dependencies.isolation.records.size).toBe(2);
  identity.digest = 'b'.repeat(64);
  rows[0].overview = 'New synthetic description';
  advance(60000);
  expect(await worker.run()).toMatchObject({ status: 'up_to_date', embeddedDescriptions: 2, deferredDescriptions: 0 });
  expect(dependencies.isolation.records.size).toBe(2); // Old namespace expires independently.
});

test('journal cleanup failure after a cache commit cannot regenerate that checkpoint', async () => {
  const { worker, dependencies, saved, embedder, advance } = setup(8);
  const clear = jest.spyOn(dependencies.isolation, 'clear');
  clear.mockResolvedValueOnce().mockRejectedValueOnce(new Error('PRIVATE database'));
  expect(await worker.run()).toMatchObject({ status: 'failed' });
  expect(saved.size).toBe(8);
  advance(60000);
  expect(await worker.run()).toMatchObject({ status: 'up_to_date', cacheHits: 8, embeddedDescriptions: 0 });
  expect(embedder.embedBatch).toHaveBeenCalledTimes(1);
});
