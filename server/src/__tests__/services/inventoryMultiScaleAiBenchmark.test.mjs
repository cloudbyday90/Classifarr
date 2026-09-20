/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createHash } from 'node:crypto';
import { runInventoryMultiScaleAiBenchmark } from '../../services/inventoryMultiScaleAiBenchmark.mjs';
import { createMultiScaleProfileLoader } from '../../services/inventoryMultiScaleCache.mjs';
import { buildMultiScaleProfile } from '../../services/inventoryMultiScaleProfile.mjs';
import { fixture, representation, localFit } from '../fixtures/inventoryMultiScaleFixture.mjs';
import { identity, generationResult, resultFor } from '../fixtures/inventoryMultiScaleAiFixture.mjs';

const options = { seed: 'multi-scale-test-seed-2026', size: 8, folds: 2 };
const createLoader = () => createMultiScaleProfileLoader({ build: (source, dependencies) => buildMultiScaleProfile(source, { ...dependencies, fit: localFit }) });
const run = (snapshot = fixture(), extra = {}, dependencies = {}) => runInventoryMultiScaleAiBenchmark(snapshot, representation,
  { ...options, ...extra }, { createLoader, ...dependencies });

test('independent arm preserves the frozen sample/control but uses separate raw-example assessments', async () => {
  const client = { generate: jest.fn(async ({ onGenerationCall, responseContract }) => {
    onGenerationCall(); return { ...generationResult, response: responseContract === 'independent_fit' ? '{"fit":1}' : '{"candidate":0}' };
  }) };
  const report = await run(fixture(), { generateCases: 4 }, { client, identity, independentFit: true });
  const control = await run();
  expect(report).toMatchObject({ protocol: 'inventory_independent_fit_v1', status: 'complete', calls: 24,
    generationShortfall: 0, sampleFingerprint: control.sampleFingerprint, snapshotComponents: control.snapshotComponents,
    evaluation: { compactEvidenceConsumed: false, independentArmSensitivity: 'repeat_and_example_order' },
    comparison: { generatedPairs: 4, arms: [{ name: 'raw', abstained: 4 }, { name: 'independent', abstained: 4 }] },
    inference: { maximumCalls: 32, assessments: { compared: 8, changed: 0, grades: [0, 16, 0, 0] } } });
  const packets = client.generate.mock.calls.map(([row]) => row);
  expect(packets.filter(row => row.responseContract === 'independent_fit')).toHaveLength(16);
  expect(packets.filter(row => row.responseContract === 'independent_fit').every(row => row.count === 1)).toBe(true);
  expect(JSON.stringify(report)).not.toMatch(/PRIVATE|overview|libraryIds/);
});

test('real fitting preflights both media types; generation is opt-in and all results are private-safe', async () => {
  const snapshot = fixture(), before = structuredClone(snapshot), onProgress = jest.fn();
  const report = await run(snapshot, {}, { onProgress });
  expect(report).toMatchObject({ protocol: 'inventory_multi_scale_ai_v2', evidenceSelection: { version: 'query_mmr_v1' }, status: 'preflight', calls: 0,
    independentLabels: 0, accuracy: null, livePromotionAllowed: false, sampledDescriptions: 8, generationShortfall: 0,
    comparison: { sampled: 8, ready: 8, rawExamples: 48, generatedPairs: 0 } });
  expect(report.comparison.mediaTypes.map(row => row.sampled)).toEqual([4, 4]);
  expect(report.profiles[0].memory).toEqual({ rss: expect.any(Number), heapUsed: expect.any(Number),
    heapTotal: expect.any(Number), external: expect.any(Number), arrayBuffers: expect.any(Number), maxRSSKiB: expect.any(Number) });
  expect(JSON.stringify([report, onProgress.mock.calls])).not.toMatch(/PRIVATE|overview|libraryIds|tmdb_id/);
  for (const doc of snapshot.corpus.documents) expect(JSON.stringify(report)).not.toContain(doc.hash);
  expect(snapshot).toEqual(before);
});

test('pairs exact sample prefix across folds, generates after fitting, and accounts for shortfall', async () => {
  let builds = 0;
  const client = { generate: jest.fn(async ({ onGenerationCall }) => { expect(builds).toBe(2); onGenerationCall(); return generationResult; }) };
  const loader = { clear: jest.fn(), load: jest.fn(async (snapshot, _identity, { held }) => {
    builds++;
    return { profile: { summary: () => ({ localStatus: 'available' }), retrieve: async ({ hash }) =>
      resultFor(snapshot, snapshot.corpus.documents.find(doc => doc.hash === hash), held) } };
  }) };
  const report = await run(fixture(), { generateCases: 4 }, { client, identity, createLoader: () => loader });
  expect(report).toMatchObject({ status: 'complete', calls: 16, generationShortfall: 0, availableGenerationCases: 4,
    comparison: { generatedPairs: 4, arms: [{ abstained: 4 }, { abstained: 4 }] } });
  expect(report.comparison.mediaTypes.map(row => row.generatedPairs)).toEqual([2, 2]);
  expect(loader.clear).toHaveBeenCalledTimes(3);
  expect(loader.clear.mock.invocationCallOrder[0]).toBeLessThan(loader.load.mock.invocationCallOrder[0]);
  expect(loader.clear.mock.invocationCallOrder[1]).toBeLessThan(loader.load.mock.invocationCallOrder[1]);
  const later = await run(fixture(), { excludePriorSizes: [8] });
  expect(later.sampleFingerprint).not.toBe(report.sampleFingerprint); expect(later.excludedPriorDescriptions).toBe(8);
  const short = await run(fixture(), { size: 100 }); expect(short.sampleShortfall).toBe(52);
});

test('records partial inference as failed without scoring or retrying it', async () => {
  let count = 0;
  const client = { generate: jest.fn(async ({ onGenerationCall }) => {
    onGenerationCall(); return ++count === 3 ? { ...generationResult, response: 'PRIVATE' } : generationResult;
  }) };
  const report = await run(fixture(), { generateCases: 2 }, { client, identity });
  expect(report).toMatchObject({ status: 'completed_with_errors', calls: 3, generationShortfall: 2,
    comparison: { generatedPairs: 0 }, inference: { failures: { invalid_response: 1 } } });
  expect(JSON.stringify(report)).not.toContain('PRIVATE');
});

test.each(['time_budget', 'invalid_groups', 'discovery_failed', 'PRIVATE failure'])('refuses inference on incomplete context and allowlists diagnostics: %s', async localFailureReason => {
  const snapshot = fixture(), client = { generate: jest.fn() }, onProgress = jest.fn();
  const loader = { clear: jest.fn(), load: async (_snapshot, _identity, { held }) => ({ profile: {
    summary: () => ({ localStatus: 'unavailable', localFailureReason }), retrieve: async ({ hash }) =>
      resultFor(snapshot, snapshot.corpus.documents.find(doc => doc.hash === hash), held),
  } }) };
  const report = await run(snapshot, { generateCases: 4 }, { client, identity, onProgress, createLoader: () => loader });
  expect(report).toMatchObject({ status: 'completed_with_errors', contextComplete: false, calls: 0, generationShortfall: 4,
    inference: { status: 'not_run_incomplete_context' } });
  expect(client.generate).not.toHaveBeenCalled(); expect(loader.clear).toHaveBeenCalledTimes(3);
  expect(JSON.stringify(report)).not.toContain('PRIVATE');
  expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ stage: 'multi_scale_ai_preflight', fold: 1,
    localStatus: 'unavailable', fitMs: expect.any(Number), prepared: 4 }));
  expect(JSON.stringify(onProgress.mock.calls)).not.toContain('PRIVATE');
  if (localFailureReason !== 'PRIVATE failure') expect(report.profiles[0].localFailureReason).toBe(localFailureReason);
  expect(report.profiles[0].fitMs).toBeGreaterThanOrEqual(0);
});

test('preflights both arms against the smaller context and skips the whole pair without model calls', async () => {
  const snapshot = fixture(), client = { generate: jest.fn() };
  // Three candidates with four-byte code points exceed the smaller complete-prompt budget.
  snapshot.libraries.push({ id: 5, media_type: 'movie' }, { id: 6, media_type: 'tv' });
  for (const doc of [...snapshot.corpus.documents].filter(row => [1, 3].includes(row.libraryIds[0]))) {
    const hash = createHash('sha256').update(doc.hash).digest('hex'), id = doc.type === 'movie' ? 5 : 6;
    snapshot.corpus.documents.push({ ...doc, hash, key: `${doc.key}-copy`, libraryIds: [id] });
    snapshot.corpus.texts.set(hash, 'copy'); snapshot.vectors.set(hash, [...snapshot.vectors.get(doc.hash)]);
  }
  for (const [index, hash] of [...snapshot.corpus.texts.keys()].entries()) snapshot.corpus.texts.set(hash, index + '🦊'.repeat(1000));
  const loader = { clear: jest.fn(), load: async (_snapshot, _identity, { held }) => ({ profile: {
    summary: () => ({ localStatus: 'available' }), retrieve: async ({ hash }) =>
      resultFor(snapshot, snapshot.corpus.documents.find(doc => doc.hash === hash), held),
  } }) };
  const report = await run(snapshot, { context: 8192, generateCases: 2 }, { client, identity, createLoader: () => loader });
  expect(report).toMatchObject({ calls: 0, generationShortfall: 2, availableGenerationCases: 0,
    comparison: { contextBudgetExceeded: 8, generatedPairs: 0 } });
  expect(client.generate).not.toHaveBeenCalled(); expect(loader.clear).toHaveBeenCalledTimes(3);
});

test('empty folds and insufficient candidates stay visible without padding a pair', async () => {
  const snapshot = fixture();
  snapshot.libraries = snapshot.libraries.filter(row => row.id !== 2);
  snapshot.corpus.documents = snapshot.corpus.documents.filter(row => row.libraryIds[0] !== 2);
  const hashes = new Set(snapshot.corpus.documents.map(row => row.hash));
  snapshot.corpus.texts = new Map([...snapshot.corpus.texts].filter(([hash]) => hashes.has(hash)));
  snapshot.vectors = new Map([...snapshot.vectors].filter(([hash]) => hashes.has(hash)));
  const report = await run(snapshot, { size: 1, folds: 5 });
  expect(report.profiles).toHaveLength(1); expect(report.comparison.sampled).toBe(1);
  expect((await run(snapshot)).comparison.ready).toBeLessThan(8);
});

test('validates budgets before fitting, propagates cancellation, and always clears loader', async () => {
  for (const extra of [{ folds: 0 }, { size: 300, generateCases: 101 }]) await expect(run(fixture(), extra)).rejects.toThrow('requires');
  await expect(run(fixture(), { generateCases: 1 })).rejects.toThrow('local_model');
  await expect(run(fixture(), {}, { signal: AbortSignal.abort() })).rejects.toThrow();
  const loader = { clear: jest.fn(), load: jest.fn(async () => { throw new Error('PRIVATE fit failed'); }) };
  await expect(run(fixture(), {}, { createLoader: () => loader })).rejects.toThrow('fit failed');
  expect(loader.clear).toHaveBeenCalledTimes(2);
  const snapshot = fixture();
  snapshot.corpus.texts = new Map([...snapshot.corpus.texts, ...Array.from({ length: 7952 }, (_, i) => [i.toString(16).padStart(64, '0'), null])]);
  await expect(runInventoryMultiScaleAiBenchmark(snapshot, { ...representation, dimensions: 1000 }, { ...options, folds: 10 })).rejects.toThrow('work_budget');
});
