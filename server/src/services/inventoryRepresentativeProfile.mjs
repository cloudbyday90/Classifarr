/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { fitStableRepresentativeGeometry } from './inventoryRepresentativeStability.mjs';
import { validateDescriptionRepresentation } from './inventoryDescriptionVectorCache.mjs';
import { validateEmbedding } from '../utils/embeddingValidation.mjs';
import { normalizeDescriptionVector } from './inventoryDescriptionSimilarity.mjs';
import { assertRepresentativeSnapshotBudget, inspectRepresentativeCoverage, representativeCoverageReady } from './inventoryRepresentativeCoverage.mjs';
export { REPRESENTATIVE_PROFILE_COMPONENT_LIMIT } from './inventoryRepresentativeCoverage.mjs';

export const INVENTORY_REPRESENTATIVE_PROFILE_VERSION = 'inventory_representative_profile_v4';

/** Private canonical source digest. Neither the key nor these inputs belong in logs. */
export function inventoryRepresentativeSourceKey(snapshot, identity, configKey) {
  const representation = validateDescriptionRepresentation(identity);
  assertRepresentativeSnapshotBudget(snapshot, identity.dimensions);
  const hash = createHash('sha256');
  const add = value => hash.update(JSON.stringify(value)).update('\n');
  add([INVENTORY_REPRESENTATIVE_PROFILE_VERSION, representation, configKey]);
  add(snapshot.libraries.map(row => [row.id, row.media_type]).sort((a, b) => a[0] - b[0]));
  add(snapshot.corpus.documents.map(row => [row.key, row.type, row.hash, [...row.libraryIds].sort((a, b) => a - b)])
    .sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  for (const key of [...snapshot.corpus.texts.keys()].sort()) {
    add([key, snapshot.vectors.has(key)]);
    if (!snapshot.vectors.has(key)) continue;
    const vector = validateEmbedding(snapshot.vectors.get(key), identity.dimensions);
    const bytes = Buffer.allocUnsafe(vector.length * 4);
    vector.forEach((value, index) => bytes.writeFloatLE(value, index * 4));
    hash.update(bytes);
  }
  return hash.digest('hex');
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
