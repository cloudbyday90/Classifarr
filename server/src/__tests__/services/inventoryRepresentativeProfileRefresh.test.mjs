/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createInventoryRepresentativeProfileRefresh } from '../../services/inventoryRepresentativeProfileRefresh.mjs';
import { buildInventoryRepresentativeProfile, inventoryRepresentativeSourceKey } from '../../services/inventoryRepresentativeProfile.mjs';
import { resolveLocalStudyEmbeddingConfig } from '../../services/localStudyEmbeddingClient.mjs';
import { representativeProfileFixture } from '../helpers/inventoryRepresentativeProfileFixture.mjs';
import { representativeShadowFixture } from '../helpers/inventoryRepresentativeShadowFixture.mjs';
import { createInventoryRepresentativeShadow } from '../../services/inventoryRepresentativeShadow.mjs';
import { createRepresentativeValidationDiagnostics } from '../../services/representativeValidationDiagnostics.mjs';

function setup(observer = null, diagnostics = undefined, options = {}) {
  const fixture = representativeProfileFixture(options);
  let time = 0, revision = 0;
  const { state, identity, snapshot } = fixture;
  const embedder = { model: identity.model, provider: identity.provider, inspect: jest.fn(async () => ({ ...identity })), embedBatch: jest.fn() };
  const dependencies = { observer, diagnostics, repository: { read: jest.fn(async () => ({ ...structuredClone(snapshot), observedKeys: new Set(snapshot.observedKeys) })) },
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

test('recovery reference commits only after source validation and clears on disable/stop', async () => {
  const fixture = setup(), commit = jest.fn();
  const neighborhoodRecovery = { prepare: jest.fn(async () => ({ commit })), clear: jest.fn() };
  const worker = createInventoryRepresentativeProfileRefresh({ ...fixture.dependencies, neighborhoodRecovery });
  const read = fixture.dependencies.repository.read.getMockImplementation();
  fixture.dependencies.repository.read.mockImplementationOnce(async () => {
    const before = await read(); fixture.snapshot.vectors.values().next().value[0] += 0.1; return before;
  });
  expect((await worker.run()).status).toBe('invalidated');
  expect(neighborhoodRecovery.prepare).toHaveBeenCalledTimes(1);
  expect(commit).not.toHaveBeenCalled();
  expect((await worker.run()).status).toBe('published');
  expect(commit).toHaveBeenCalledTimes(1);
  fixture.state.rag_enabled = false;
  expect((await worker.run()).status).toBe('disabled');
  expect(neighborhoodRecovery.clear).toHaveBeenCalledTimes(2);
  worker.stop(); expect(neighborhoodRecovery.clear).toHaveBeenCalledTimes(3);
});

test.each(['prepare', 'commit'])('optional recovery %s failure cannot discard a valid profile', async phase => {
  const fixture = setup();
  const fail = () => { throw new Error('PRIVATE'); };
  const neighborhoodRecovery = { clear() {}, prepare: phase === 'prepare' ? fail : async () => ({ commit: fail }) };
  const worker = createInventoryRepresentativeProfileRefresh({ ...fixture.dependencies, neighborhoodRecovery });
  expect((await worker.run()).status).toBe('published');
  expect(JSON.stringify(worker.getStatus())).not.toContain('PRIVATE');
});

test('pending comparisons bypass the quiet interval, reuse the fit and commit only after fresh validation', async () => {
  const observer = createInventoryRepresentativeShadow(), fixture = setup(observer);
  const { worker, dependencies, state, snapshot } = fixture;
  await worker.run();
  const queryFixture = await representativeShadowFixture();
  observer.remember(queryFixture.metadata, { ...queryFixture.query, configKey: JSON.stringify(resolveLocalStudyEmbeddingConfig(state)) });
  observer.observe(queryFixture.decision);
  state.busy = true;
  expect((await worker.run()).status).toBe('yielded');
  expect(observer.read().pending).toBe(1);
  state.busy = false;
  const read = dependencies.repository.read.getMockImplementation();
  dependencies.repository.read.mockImplementationOnce(async () => {
    const before = await read(); snapshot.observedKeys.add(queryFixture.query.request.key); return before;
  });
  expect((await worker.run()).status).toBe('up_to_date');
  expect(observer.read()).toMatchObject({ pending: 1, counts: { agrees: 0, invalidated_batches: 1 } });
  expect((await worker.run()).status).toBe('up_to_date');
  expect(observer.read()).toMatchObject({ pending: 0, counts: { known_item: 1, agrees: 0 } });
  expect(dependencies.fit).toHaveBeenCalledTimes(1);
  expect(fixture.embedder.embedBatch).not.toHaveBeenCalled();
  worker.stop(); expect(observer.read().status).toBe('unavailable');
});

test('profile invalidation never commits a staged comparison and disabled RAG clears pending work', async () => {
  const commit = jest.fn(), observer = { prepare: jest.fn(() => ({ commit })), hasPending: () => true, clear: jest.fn() };
  const { worker, snapshot, dependencies, state } = setup(observer);
  const read = dependencies.repository.read.getMockImplementation();
  dependencies.repository.read.mockImplementationOnce(async () => {
    const before = await read(); snapshot.vectors.values().next().value[0] += 0.1; return before;
  });
  expect((await worker.run()).status).toBe('invalidated');
  expect(observer.prepare).toHaveBeenCalledTimes(1);
  expect(commit).not.toHaveBeenCalled();
  state.rag_enabled = false;
  expect((await worker.run()).status).toBe('disabled');
  expect(observer.clear).toHaveBeenCalledTimes(1);
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

test('partial publication survives missing descriptions and automatically reconciles their backfill', async () => {
  const { worker, snapshot, dependencies, key, advance, embedder } = setup(null, undefined, { perLibrary: 10 });
  const hash = snapshot.corpus.documents[0].hash, vector = snapshot.vectors.get(hash);
  snapshot.vectors.delete(hash);
  expect(await worker.run()).toMatchObject({ status: 'published', missingDescriptions: 1, partialLibraries: 1, readyLibraries: 2 });
  const partialKey = key();
  expect(worker.read(partialKey).libraries.get(1).coverage.status).toBe('partial');
  snapshot.vectors.set(hash, vector); advance();
  expect(await worker.run()).toMatchObject({ status: 'published', missingDescriptions: 0, partialLibraries: 0, trainingDescriptions: 20 });
  expect(worker.read(partialKey)).toBeUndefined();
  expect(dependencies.fit).toHaveBeenCalledTimes(2);
  expect(embedder.embedBatch).not.toHaveBeenCalled();
});

test('one waiting library does not stop a complete library from publishing', async () => {
  const { worker, snapshot, key } = setup();
  snapshot.corpus.documents.filter(doc => doc.type === 'tv').forEach(doc => snapshot.vectors.delete(doc.hash));
  expect(await worker.run()).toMatchObject({ status: 'published', readyLibraries: 1, waitingLibraries: 1, missingDescriptions: 6 });
  expect(worker.read(key()).libraries.get(1).coverage.status).toBe('complete');
  expect(worker.read(key()).libraries.get(2).coverage.status).toBe('waiting');
});

test('a recovered vector during a partial fit invalidates that publication and staged observations', async () => {
  const commit = jest.fn(), observer = { prepare: () => ({ commit }), hasPending: () => true };
  const { worker, snapshot, dependencies } = setup(observer, undefined, { perLibrary: 10 });
  const hash = snapshot.corpus.documents[0].hash, vector = snapshot.vectors.get(hash);
  snapshot.vectors.delete(hash);
  const fit = dependencies.fit.getMockImplementation();
  dependencies.fit.mockImplementationOnce(async (...args) => { snapshot.vectors.set(hash, vector); return fit(...args); });
  expect(await worker.run()).toMatchObject({ status: 'invalidated' });
  expect(commit).not.toHaveBeenCalled();
  expect(await worker.run()).toMatchObject({ status: 'published', missingDescriptions: 0 });
  expect(commit).toHaveBeenCalledTimes(1);
});

test('publication projects only fixed summary fields from the private fit result', async () => {
  const { worker, dependencies } = setup();
  const fit = dependencies.fit.getMockImplementation();
  dependencies.fit.mockImplementationOnce(async (...args) => {
    const model = await fit(...args); model.summary.privateText = 'PRIVATE'; return model;
  });
  expect(await worker.run()).toMatchObject({ status: 'published' });
  expect(JSON.stringify(worker.getStatus())).not.toContain('PRIVATE');
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

test('withdraws malformed cached geometry, rebuilds with backoff, and backfills pending comparisons', async () => {
  const log = { warn: jest.fn(), info: jest.fn() }, diagnostics = createRepresentativeValidationDiagnostics({ log });
  const observer = createInventoryRepresentativeShadow({ diagnostics }), fixture = setup(observer, diagnostics);
  const { worker, dependencies, key, advance, state, embedder } = fixture;
  // Both destinations must be compatible with this movie query, as in the shadow fixture.
  fixture.snapshot.libraries.forEach(library => { library.media_type = 'movie'; });
  fixture.snapshot.corpus.documents.forEach(document => { document.type = 'movie'; document.key = `movie:${document.id}`; });
  fixture.snapshot.observedKeys = new Set(fixture.snapshot.corpus.documents.map(document => document.key));
  await worker.run();
  worker.read(key()).libraries.get(1).starts[0].groups[0].centroid = [NaN, 1];
  const queryFixture = await representativeShadowFixture();
  observer.remember(queryFixture.metadata, { ...queryFixture.query, configKey: JSON.stringify(resolveLocalStudyEmbeddingConfig(state)) });
  observer.observe(queryFixture.decision);
  expect((await worker.run()).status).toBe('failed');
  expect(worker.getStatus().cacheStored).toBe(false);
  expect(worker.read(key())).toBeUndefined();
  expect(observer.read()).toMatchObject({ pending: 1, counts: { agrees: 0 } });
  expect(log.warn.mock.calls[0][1]).toMatchObject({ code: 'profile_nonfinite', routingAffected: false });
  expect((await worker.run()).status).toBe('cooldown');
  expect(dependencies.fit).toHaveBeenCalledTimes(1);
  expect(log.info).not.toHaveBeenCalled();
  advance(60_000);
  expect((await worker.run()).status).toBe('published');
  expect(observer.read()).toMatchObject({ pending: 0, counts: { agrees: 1 } });
  expect(dependencies.fit).toHaveBeenCalledTimes(2);
  expect(embedder.embedBatch).not.toHaveBeenCalled();
  expect(log.info.mock.calls[0][1]).toMatchObject({ code: 'profile_nonfinite', routingAffected: false });
  expect(JSON.stringify(log.warn.mock.calls)).not.toMatch(/PRIVATE|90000|localhost/);
});

test('never reports recovery for a rejected fresh snapshot', async () => {
  const log = { warn: jest.fn(), info: jest.fn() }, diagnostics = createRepresentativeValidationDiagnostics({ log });
  const { worker, dependencies, snapshot } = setup(null, diagnostics);
  diagnostics.report('profile_structure');
  const fit = dependencies.fit.getMockImplementation();
  dependencies.fit.mockImplementationOnce(async (...args) => { const model = await fit(...args); snapshot.corpus.documents.pop(); return model; });
  expect((await worker.run()).status).toBe('invalidated');
  expect(log.info).not.toHaveBeenCalled();
  expect((await worker.run()).status).toBe('published');
  expect(log.info).toHaveBeenCalledTimes(1);
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
