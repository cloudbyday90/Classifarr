/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { fitStableRepresentativeGeometry } from './inventoryRepresentativeStability.mjs';
import { createRepresentativeFingerprint, INVENTORY_REPRESENTATIVE_PROFILE_VERSION } from './inventoryRepresentativeFingerprint.mjs';
import { normalizeDescriptionVector } from './inventoryDescriptionSimilarity.mjs';
import { assertRepresentativeSnapshotBudget, inspectRepresentativeCoverage, representativeCoverageReady } from './inventoryRepresentativeCoverage.mjs';
export { REPRESENTATIVE_PROFILE_COMPONENT_LIMIT } from './inventoryRepresentativeCoverage.mjs';

export { INVENTORY_REPRESENTATIVE_PROFILE_VERSION };

/** Private canonical source digest. Neither the key nor these inputs belong in logs. */
export function inventoryRepresentativeSourceKey(snapshot, identity, configKey) {
  assertRepresentativeSnapshotBudget(snapshot, identity.dimensions);
  const fingerprint = createRepresentativeFingerprint(snapshot, identity, configKey);
  for (const key of [...snapshot.corpus.texts.keys()].sort()) {
    fingerprint.append(key, snapshot.vectors.has(key), snapshot.vectors.get(key));
  }
  return fingerprint.finish();
}

/** Full inventory scope, possibly partial vectors; never the benchmark's held-out model contract. */
export async function buildInventoryRepresentativeProfile({ snapshot, dimensions }, { signal } = {}) {
  assertRepresentativeSnapshotBudget(snapshot, dimensions);
  const coverage = inspectRepresentativeCoverage(snapshot), index = coverage.index;
  // Validate even unused present vectors: corruption is not missing evidence.
  const vectors = new Map([...snapshot.vectors].map(([hash, vector]) => [hash, normalizeDescriptionVector(vector, dimensions)]));
  const buckets = new Map([...index.scope.keys()].sort((a, b) => a - b).map(id => [id, []]));
  const summary = { libraries: buckets.size, trainingDescriptions: 0, sharedDescriptions: 0,
    groups: 0, sparseLibraries: 0, unconvergedStarts: 0, discardedDescriptions: 0,
    recoveredStarts: 0, recoveryIterations: 0, ...coverage.summary };
  for (const group of index.groups.values()) {
    if (group.libraries.size > 1) { summary.sharedDescriptions++; continue; }
    if (group.libraries.size === 1) {
      const id = [...group.libraries][0];
      if (!vectors.has(group.hash) || !representativeCoverageReady(coverage.libraries.get(id))) continue;
      buckets.get(id).push({ hash: group.hash, vector: vectors.get(group.hash) });
      summary.trainingDescriptions++;
    }
  }
  const libraries = new Map();
  let weight = 1024;
  for (const [id, items] of buckets) {
    signal?.throwIfAborted();
    items.sort((a, b) => a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0);
    const fit = await fitStableRepresentativeGeometry(items, { signal, includeLegacy: false, recoverUnconverged: true, retainMemberships: true });
    libraries.set(id, { mediaType: index.scope.get(id), coverage: coverage.libraries.get(id), selectedStart: fit.stability.selectedStart,
      starts: fit.runs.map(run => ({ groups: run.groups, converged: run.converged })), stability: fit.stability, membership: fit.membership });
    summary.groups += fit.groups.length;
    summary.sparseLibraries += Number(!fit.groups.length);
    summary.unconvergedStarts += fit.runs.filter(run => !run.converged).length;
    summary.recoveredStarts += fit.stability.recovery.recoveredStarts;
    summary.recoveryIterations += fit.stability.recovery.additionalIterations;
    summary.discardedDescriptions += fit.discarded;
    // Conservative per-hash allowance includes the selected partition's array slots and strings.
    weight += 4096 + items.length * 192 + fit.runs.reduce((sum, run) => sum + run.groups.length * (dimensions * 8 + 2048), 0);
  }
  return { kind: 'full_inventory_shadow', version: INVENTORY_REPRESENTATIVE_PROFILE_VERSION, libraries, summary, weight };
}
