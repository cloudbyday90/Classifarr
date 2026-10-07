/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { Session } from 'node:inspector/promises';

// Fixed labels only: never serialize inspector URLs, names, stacks or raw profiles.
function component({ url = '', functionName = '' } = {}) {
  if (typeof url !== 'string' || typeof functionName !== 'string') return null;
  if (url.endsWith('/utils/embeddingValidation.mjs') ||
      url.endsWith('/utils/embeddingValidationContract.mjs') ||
      url.endsWith('/services/inventoryVectorValidation.mjs')) return 'vector_validation';
  if (url.includes('/node_modules/pg-protocol/')) return 'database_transport';
  if (url.includes('/node_modules/pg/')) return 'database_client';
  if (url.endsWith('/comparisonMemoryStudy/vectorReadObservation.mjs')) return 'diagnostic_overhead';
  if (url.endsWith('/services/localCommunityGraph.mjs')) {
    return functionName === 'insertNeighbor' ? 'community_neighbors' : 'community_graph';
  }
  if (url.endsWith('/services/inventoryLocalCommunities.mjs')) {
    return functionName === 'summarizeCommunity' ? 'community_summary' : 'community_partition';
  }
  const files = {
    adaptiveGroupSplit: 'community_centroid', inventoryCommunityParticipation: 'community_participation',
    descriptionVectorNormalizer: 'shared_normalization', inventoryDescriptionSimilarity: 'vector_normalization',
    descriptionVectorArithmetic: 'normalization_arithmetic',
    inventoryGroupBenchmarkControl: 'broad_control', inventoryRepresentativeMembership: 'membership_validation',
    inventoryMultiScaleProfile: 'profile_assembly',
    inventoryDescriptionVectorReader: 'vector_read', inventoryDescriptionVectorCache: 'vector_cache',
    inventoryDescriptionVectorParsing: 'vector_parsing', inventoryDescriptionVectorDecoding: 'vector_assembly',
    inventoryVectorReadDiagnostics: 'diagnostic_overhead',
    inventoryVectorFingerprint: 'vector_fingerprint', inventoryRepresentativeFingerprint: 'vector_fingerprint',
    inventoryMultiScaleVerification: 'comparison_verification', inventoryRepresentativeVerification: 'representative_verification',
    inventoryRepresentativePreparationReader: 'representative_preparation',
    inventoryRepresentativeProfileValidation: 'representative_validation', inventoryDescriptionCorpus: 'description_corpus',
  };
  for (const [file, label] of Object.entries(files)) if (url.endsWith(`/services/${file}.mjs`)) return label;
  return null;
}

/** Statistical self-byte estimates, not exact allocations or a retained-object graph. */
export function summarizeComparisonHeapProfile(profile) {
  const invalid = () => { throw new Error('comparison_heap_profile_invalid'); };
  if (!profile?.head || !Array.isArray(profile.samples) || profile.samples.length > 200_000) invalid();
  const pending = [{ node: profile.head, label: 'other', depth: 0 }], seen = new Set(), components = {};
  let sampledEstimatedBytes = 0;
  while (pending.length) {
    const { node, label, depth } = pending.pop();
    if (!node || seen.has(node) || seen.size >= 50_000 || depth > 64 ||
        !Number.isSafeInteger(node.selfSize) || node.selfSize < 0 || !Array.isArray(node.children) ||
        node.children.length + pending.length + seen.size > 50_000) invalid();
    seen.add(node);
    const current = component(node.callFrame) ?? label;
    sampledEstimatedBytes += node.selfSize;
    if (!Number.isSafeInteger(sampledEstimatedBytes)) invalid();
    if (node.selfSize) components[current] = (components[current] ?? 0) + node.selfSize;
    for (let i = node.children.length - 1; i >= 0; i--) {
      pending.push({ node: node.children[i], label: current, depth: depth + 1 });
    }
  }
  return { sampledEstimatedBytes, nodes: seen.size, samples: profile.samples.length, components };
}

/** Synthetic runner only. Session.connect does not open a remote inspector port. */
export async function sampleColdBuild(mode, work, { session = new Session() } = {}) {
  if (mode === 'natural') return { value: await work(), profile: null };
  if (!['allocations', 'survivors'].includes(mode)) throw new Error('comparison_heap_mode_invalid');
  let sampling = false;
  try {
    session.connect();
    await session.post('HeapProfiler.startSampling', { samplingInterval: 524288,
      includeObjectsCollectedByMajorGC: mode === 'allocations', includeObjectsCollectedByMinorGC: mode === 'allocations' });
    sampling = true;
    const value = await work();
    const { profile } = await session.post('HeapProfiler.stopSampling');
    sampling = false;
    return { value, profile: summarizeComparisonHeapProfile(profile) };
  } finally {
    try { if (sampling) await session.post('HeapProfiler.stopSampling'); }
    finally { session.disconnect(); }
  }
}
