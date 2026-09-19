/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { setImmediate } from 'node:timers/promises';
import { fitInventoryRepresentativeProfile } from './inventoryRepresentativeProfileFit.mjs';
import { readGroupBenchmarkControl } from './inventoryGroupBenchmarkControl.mjs';
import { discoverCommunityParticipation } from './inventoryCommunityParticipation.mjs';
import { summarizeGroupValues } from './inventoryGroupQuality.mjs';
import { representativeSimilarity as similarity } from './representativeFitSession.mjs';
import { retrieveMultiScaleContext } from './inventoryMultiScaleRetrieval.mjs';
import { normalizeDescriptionVector } from './inventoryDescriptionSimilarity.mjs';

function validateLocalGroups(communities, control, dimensions) {
  if (!Array.isArray(communities?.libraries) || communities.libraries.length !== control.libraries.length ||
      new Set(communities.libraries.map(row => row.id)).size !== control.libraries.length) throw new Error('multi_scale_local_scope');
  for (const library of communities.libraries) {
    if (control.index.scope.get(library.id) !== library.mediaType || !Array.isArray(library.groups)) throw new Error('multi_scale_local_scope');
    const allowed = new Set(control.buckets.get(library.id).map(row => row.hash)), seen = new Set();
    for (const group of library.groups) {
      normalizeDescriptionVector(group.centroid, dimensions);
      if (!Array.isArray(group.hashes) || group.hashes.length < 3 || group.hashes.length > 17 || group.support !== group.hashes.length ||
          !Array.isArray(group.representatives) || new Set(group.representatives).size !== 3 || group.representatives.length !== 3 ||
          group.representatives.some(hash => !group.hashes.includes(hash))) throw new Error('multi_scale_local_membership');
      for (const hash of group.hashes) {
        if (!allowed.has(hash) || seen.has(hash)) throw new Error('multi_scale_local_membership');
        seen.add(hash);
      }
    }
  }
}

/** Excludes self matches, not a leave-one-out refit or semantic correctness measure. */
export async function measureNonSelfRepresentatives(groups, vectors, signal) {
  const values = [];
  let processed = 0;
  for (const group of groups) for (const hash of group.hashes) {
    if (processed++ % 128 === 0) { await setImmediate(); signal?.throwIfAborted(); }
    values.push(Math.max(...group.representatives.filter(other => other !== hash)
      .map(other => similarity(vectors.get(hash), vectors.get(other)))));
  }
  return summarizeGroupValues(values);
}

/** Mandatory raw/broad evidence survives optional community discovery failure. */
export async function buildMultiScaleProfile(source, { signal, fit = fitInventoryRepresentativeProfile,
  discover = discoverCommunityParticipation } = {}) {
  const { training, dimensions, held } = source;
  const model = await fit(training, dimensions, { signal });
  const control = await readGroupBenchmarkControl(training, model, dimensions, signal);
  const vectors = new Map([...training.vectors].map(([hash, vector]) => [hash, normalizeDescriptionVector(vector, dimensions)]));
  let communities, localStatus = 'available';
  try {
    communities = await discover(control.index, training.vectors, dimensions, signal);
    validateLocalGroups(communities, control, dimensions);
  } catch { signal?.throwIfAborted(); communities = undefined; localStatus = 'unavailable'; }
  const localMembership = new Set();
  const libraries = control.libraries.map(library => {
    const localGroups = communities?.libraries.find(row => row.id === library.id)?.groups ?? [];
    for (const group of localGroups) for (const hash of group.hashes) localMembership.add(`${library.mediaType}:${hash}`);
    return { ...library, localGroups };
  });
  const items = [...control.index.groups.values()].map(row => ({ hash: row.hash, type: row.type,
    id: row.libraries.size === 1 ? [...row.libraries][0] : null, vector: vectors.get(row.hash) }));
  const quality = [];
  for (const [stratum, library] of libraries.entries()) quality.push({ stratum: stratum + 1, mediaType: library.mediaType,
    rawDescriptions: control.buckets.get(library.id).length, broadGroups: library.groups.length, localGroups: library.localGroups.length,
    broadNonSelf: await measureNonSelfRepresentatives(library.groups, vectors, signal),
    localNonSelf: await measureNonSelfRepresentatives(library.localGroups, vectors, signal) });
  const state = { items, libraries, localMembership, localStatus, dimensions, held,
    knownHashes: new Set(training.corpus.texts.keys()) };
  const summary = { localStatus, rawDescriptions: items.length, sharedDescriptions: items.filter(row => row.id === null).length, quality };
  // Conservative accounting includes owned vectors, means, hashes, membership and object overhead.
  const groups = libraries.flatMap(row => [...row.groups, ...row.localGroups]);
  const weight = (training.vectors.size + groups.length) * dimensions * 16 + items.length * 2048 + groups.length * 2048;
  signal?.throwIfAborted();
  return { cacheable: localStatus === 'available', weight, handle: Object.freeze({
    summary: () => structuredClone(summary), retrieve: (query, signal) => retrieveMultiScaleContext(state, query, signal),
  }) };
}
