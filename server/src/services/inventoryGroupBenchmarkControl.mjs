/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { inspectRepresentativeCoverage, validateRepresentativeCoverage } from './inventoryRepresentativeCoverage.mjs';
import { validateRepresentativeMembership, validatedRecoveryGroups } from './inventoryRepresentativeMembership.mjs';
import { normalizeDescriptionVector } from './inventoryDescriptionSimilarity.mjs';

/** Shared fail-closed control reader for discovery experiments. */
export async function readGroupBenchmarkControl(training, model, dimensions, signal) {
  const coverage = inspectRepresentativeCoverage(training), { index } = coverage;
  if (model.libraries.size !== index.scope.size || [...index.scope].some(([id, type]) => model.libraries.get(id)?.mediaType !== type)) {
    throw new Error('group_benchmark_scope_changed');
  }
  const buckets = new Map([...index.scope.keys()].map(id => [id, []]));
  for (const group of index.groups.values()) if (group.libraries.size === 1) {
    buckets.get([...group.libraries][0]).push({ hash: group.hash,
      vector: normalizeDescriptionVector(training.vectors.get(group.hash), dimensions) });
  }
  const libraries = [];
  for (const [id, mediaType] of index.scope) {
    const profile = model.libraries.get(id), items = buckets.get(id);
    validateRepresentativeCoverage(profile.coverage);
    if (Object.entries(coverage.libraries.get(id)).some(([key, value]) => profile.coverage[key] !== value)) {
      throw new Error('group_benchmark_coverage_changed');
    }
    // The existing fitter omits membership below three available descriptions.
    validateRepresentativeMembership(profile, new Set((profile.coverage.status === 'complete' ? items : []).map(row => row.hash)));
    const hashes = await validatedRecoveryGroups(profile, training.vectors, dimensions, signal);
    libraries.push({ id, mediaType, available: Boolean(hashes),
      groups: hashes ? profile.starts[profile.selectedStart].groups.map((group, i) => ({ ...group, hashes: hashes[i] })) : [] });
  }
  return { index, buckets, libraries };
}
