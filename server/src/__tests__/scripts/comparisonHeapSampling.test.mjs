/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { summarizeComparisonHeapProfile, sampleColdBuild } from '../../scripts/comparisonMemoryStudy/heapSampling.mjs';

const node = (url = '', functionName = '', selfSize = 10, children = []) =>
  ({ callFrame: { url, functionName }, selfSize, children });
const profile = head => ({ head, samples: [] });
const source = name => `file:///private/location/services/${name}.mjs`;

test('attributes self bytes once, inherits anonymous frames and emits no source data', () => {
  const result = summarizeComparisonHeapProfile(profile(node('', 'private function', 1, [
    node(source('localCommunityGraph'), 'buildLocalCommunityGraph', 2, [
      node('', '', 3), node(source('localCommunityGraph'), 'insertNeighbor', 4)]),
    node(source('inventoryLocalCommunities'), 'summarizeCommunity', 5),
    node(source('adaptiveGroupSplit'), 'groupDirection', 6),
    node('https://secret.example/token', 'password', 7),
  ])));
  expect(result).toEqual({ sampledEstimatedBytes: 28, nodes: 7, samples: 0,
    components: { other: 8, community_graph: 5, community_neighbors: 4, community_summary: 5, community_centroid: 6 } });
  expect(JSON.stringify(result)).not.toMatch(/private|secret|password|file:|https:/);
});

test('rejects malformed, deep, cyclic and oversized profiles with fixed errors', () => {
  const cyclic = node(); cyclic.children.push(cyclic);
  let deep = node(); for (let i = 0; i < 66; i++) deep = node('', '', 1, [deep]);
  for (const candidate of [null, {}, profile(null), profile(node('', '', -1)), profile(node('', '', NaN)),
    profile(node('', '', Number.MAX_SAFE_INTEGER, [node()])), profile({ ...node(), children: null }),
    profile(deep), profile(cyclic), profile(node('', '', 0, Array.from({ length: 50_001 }, () => node()))),
    { ...profile(node()), samples: Array(200_001) }]) {
    expect(() => summarizeComparisonHeapProfile(candidate)).toThrow('comparison_heap_profile_invalid');
  }
});

test('keeps extracted normalization arithmetic visible in allocation totals', () => {
  const result = summarizeComparisonHeapProfile(profile(node(source('descriptionVectorNormalizer'), '', 2, [
    node(source('descriptionVectorArithmetic'), 'divideDescriptionVector', 3, [node('', '', 5)]),
    node(source('inventoryDescriptionSimilarity'), 'normalizeDescriptionVector', 7),
  ])));
  expect(result.sampledEstimatedBytes).toBe(17);
  expect(result.components).toEqual({ shared_normalization: 2, normalization_arithmetic: 8, vector_normalization: 7 });
});

test('keeps both validator boundaries and their shared error helper visible', () => {
  const result = summarizeComparisonHeapProfile(profile(node('', '', 0, [
    node('file:///private/utils/embeddingValidation.mjs', '', 2),
    node(source('inventoryVectorValidation'), '', 3, [
      node('file:///private/utils/embeddingValidationContract.mjs', '', 5, [node('', '', 7)]),
    ]),
  ])));
  expect(result.sampledEstimatedBytes).toBe(17);
  expect(result.components).toEqual({ vector_validation: 17 });
});

function fixture(failMethod) {
  return { connect: jest.fn(), disconnect: jest.fn(), post: jest.fn(async method => {
    if (method === failMethod) throw new Error('private protocol failure');
    return method === 'HeapProfiler.stopSampling' ? { profile: profile(node()) } : {};
  }) };
}

test('separates cache assembly, parsing, validation, transport and observer frames', () => {
  const result = summarizeComparisonHeapProfile(profile(node(source('inventoryDescriptionVectorCache'), '', 1, [
    node(source('inventoryDescriptionVectorDecoding'), '', 2, [
      node(source('inventoryDescriptionVectorParsing'), '', 3, [node('', 'JSON.parse', 4)]),
      node('file:///private/utils/embeddingValidation.mjs', '', 5),
    ]),
    node('/app/node_modules/pg-protocol/dist/parser.js', '', 6),
    node('/app/node_modules/pg/lib/client.js', '', 7),
    node(source('inventoryVectorReadDiagnostics'), '', 8),
    node('file:///private/comparisonMemoryStudy/vectorReadObservation.mjs', '', 9),
  ])));
  expect(result.sampledEstimatedBytes).toBe(45);
  expect(result.components).toEqual({ vector_cache: 1, vector_assembly: 2, vector_parsing: 7,
    vector_validation: 5, database_transport: 6, database_client: 7, diagnostic_overhead: 17 });
  expect(JSON.stringify(result)).not.toMatch(/private|JSON\.parse|node_modules/);
});

test.each(['allocations', 'survivors'])('samples %s without forced GC or a remote port', async mode => {
  const session = fixture(), work = jest.fn(async () => 42);
  const result = await sampleColdBuild(mode, work, { session });
  expect(result.value).toBe(42); expect(result.profile.sampledEstimatedBytes).toBe(10);
  expect(session.post.mock.calls).toEqual([
    ['HeapProfiler.startSampling', { samplingInterval: 524288,
      includeObjectsCollectedByMajorGC: mode === 'allocations', includeObjectsCollectedByMinorGC: mode === 'allocations' }],
    ['HeapProfiler.stopSampling'],
  ]);
  expect(session.disconnect).toHaveBeenCalledTimes(1);
});

test('natural control never connects a sampler; unknown mode does no work', async () => {
  const session = fixture(), work = jest.fn(async () => 42);
  expect(await sampleColdBuild('natural', work, { session })).toEqual({ value: 42, profile: null });
  await expect(sampleColdBuild('unknown', work, { session })).rejects.toThrow('comparison_heap_mode_invalid');
  expect(work).toHaveBeenCalledTimes(1); expect(session.connect).not.toHaveBeenCalled();
});

test.each(['connect', 'HeapProfiler.startSampling', 'work', 'HeapProfiler.stopSampling', 'reduce'])
('disconnects and fails closed on %s failure', async failure => {
  const session = fixture(failure), work = async () => {
    if (failure === 'work') throw new Error('private work failure');
    return 42;
  };
  if (failure === 'connect') session.connect.mockImplementation(() => { throw new Error('private connect'); });
  if (failure === 'reduce') session.post.mockResolvedValue({ profile: null });
  await expect(sampleColdBuild('allocations', work, { session })).rejects.toThrow();
  expect(session.disconnect).toHaveBeenCalledTimes(1);
});
