/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { setImmediate } from 'node:timers/promises';
import { inventoryNeighborhoodRecoverySource } from './inventoryNeighborhoodRecoverySource.mjs';
import { assertRepresentativeSnapshotBudget, REPRESENTATIVE_MIN_COVERAGE_PERCENT } from './inventoryRepresentativeCoverage.mjs';
import { validateInventoryRepresentativeProfileCoverage } from './inventoryRepresentativeProfileValidation.mjs';
import { normalizeDescriptionVector } from './inventoryDescriptionSimilarity.mjs';
import { representativeSimilarity } from './representativeFitSession.mjs';

const REFERENCE_TTL_MS = 1_800_000;

/** Reconstruct only fully retained, converged groups; never invent labels for discarded items. */
async function groupMemberships(profile, hashes, snapshot, dimensions, signal) {
  const start = profile.starts[profile.selectedStart];
  if (profile.coverage.status !== 'complete' || !start.converged || !start.groups.length ||
      start.groups.some(group => group.support < 3) ||
      start.groups.reduce((sum, group) => sum + group.support, 0) !== hashes.length) return null;
  const groups = start.groups.map(() => []);
  for (let index = 0; index < hashes.length; index++) {
    if (index % 128 === 0) { await setImmediate(); signal?.throwIfAborted(); }
    const hash = hashes[index], vector = normalizeDescriptionVector(snapshot.vectors.get(hash), dimensions);
    let best = 0, score = -Infinity;
    for (let group = 0; group < groups.length; group++) {
      const similarity = representativeSimilarity(vector, start.groups[group].centroid);
      if (similarity > score) { score = similarity; best = group; }
    }
    groups[best].push(hash);
  }
  return groups.every((group, index) => group.length === start.groups[index].support) ? groups : null;
}

/** Scheduler-owned, bounded sidecar. No vectors, source text, routing decisions or I/O retained. */
export function createInventoryNeighborhoodRecovery({ now = Date.now } = {}) {
  let references = new Map(), representation = null, generation = 0;
  const clear = () => { references.clear(); representation = null; generation++; };
  const prune = source => {
    for (const [id, reference] of references) if (reference.expiresAt <= now() ||
        source.libraries.get(id)?.binding !== reference.binding) references.delete(id);
  };
  return {
    clear,
    async prepare({ model, snapshot, identity, configKey, signal }) {
      const token = generation;
      assertRepresentativeSnapshotBudget(snapshot, identity.dimensions);
      validateInventoryRepresentativeProfileCoverage(model, snapshot, identity.dimensions);
      const source = inventoryNeighborhoodRecoverySource(snapshot.corpus, identity, configKey);
      const staged = new Map();
      for (const [id, library] of source.libraries) {
        signal?.throwIfAborted();
        const profile = model.libraries.get(id);
        if (!profile || profile.mediaType !== library.type) continue;
        const groups = await groupMemberships(profile, library.exclusive, snapshot, identity.dimensions, signal);
        if (groups) staged.set(id, { binding: library.binding, groups });
      }
      return { commit() {
        if (token !== generation || signal?.aborted) return;
        if (representation !== source.representation) references.clear();
        representation = source.representation;
        prune(source);
        for (const [id, reference] of staged) references.set(id, { ...reference, expiresAt: now() + REFERENCE_TTL_MS });
        generation++; // A previously staged publication cannot supersede this one.
      } };
    },
    prioritize({ corpus, identity, configKey, present }) {
      const source = inventoryNeighborhoodRecoverySource(corpus, identity, configKey);
      if (representation !== null && source.representation !== representation) clear();
      prune(source);
      const candidates = new Map();
      const summary = { referencedLibraries: references.size, unknownLibraries: source.libraries.size - references.size,
        underrepresentedGroups: 0, prioritizedDescriptions: 0 };
      for (const reference of references.values()) for (const hashes of reference.groups) {
        const available = hashes.filter(hash => present.has(hash)).length;
        if (available >= 3 && available * 100 >= hashes.length * REPRESENTATIVE_MIN_COVERAGE_PERCENT) continue;
        summary.underrepresentedGroups++;
        const fraction = available / hashes.length;
        for (const hash of hashes) if (!present.has(hash)) candidates.set(hash, Math.min(candidates.get(hash) ?? 1, fraction));
      }
      const priority = [...candidates].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).map(([hash]) => hash);
      summary.prioritizedDescriptions = priority.length;
      return { priority, summary };
    },
  };
}
