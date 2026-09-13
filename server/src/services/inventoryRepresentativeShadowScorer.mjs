/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { validateDescriptionRepresentation } from './inventoryDescriptionVectorCache.mjs';
import { normalizeDescriptionVector } from './inventoryDescriptionSimilarity.mjs';
import { representativeSimilarity } from './inventoryRepresentativeGeometry.mjs';
import { INVENTORY_REPRESENTATIVE_PROFILE_VERSION } from './inventoryRepresentativeProfile.mjs';

export const REPRESENTATIVE_SHADOW_REASONS = Object.freeze(['agrees', 'disagrees', 'known_item', 'known_description',
  'scope_changed', 'representation_changed', 'sparse_profiles', 'unstable_profiles', 'ambiguous_profiles', 'invalid_input']);

/** Includes identities excluded from training; this digest never enters a model or public report. */
export function representativeNoveltyKey(snapshot) {
  if (!(snapshot.observedKeys instanceof Set) || snapshot.observedKeys.size > 50000 ||
      [...snapshot.observedKeys].some(key => !/^(movie|tv):[1-9]\d{0,9}$/.test(key))) {
    throw new Error('representative_novelty_snapshot_invalid');
  }
  return createHash('sha256').update(JSON.stringify([...snapshot.observedKeys].sort())).digest('hex');
}

/** Description-only diagnostic: no routes, labels, inference, learning or persistence. */
export function compareInventoryRepresentativeShadow({ observation, snapshot, model, identity, configKey }) {
  try {
    representativeNoveltyKey(snapshot);
    if (model?.kind !== 'full_inventory_shadow' || model.version !== INVENTORY_REPRESENTATIVE_PROFILE_VERSION) return 'invalid_input';
    if (JSON.stringify(validateDescriptionRepresentation(observation.identity)) !== JSON.stringify(validateDescriptionRepresentation(identity)) ||
        observation.configKey !== configKey) return 'representation_changed';
    if (snapshot.observedKeys.has(observation.key)) return 'known_item';
    if (snapshot.corpus.texts.has(observation.hash)) return 'known_description';
    const ids = observation.libraryIds;
    if (!Array.isArray(ids) || ids.length < 2 || ids.length > 64 || new Set(ids).size !== ids.length ||
        !ids.includes(observation.destinationId) || ids.some(id => !Number.isSafeInteger(id) || id < 1 ||
          model.libraries.get(id)?.mediaType !== observation.mediaType)) return 'scope_changed';
    const query = normalizeDescriptionVector(observation.vector, identity.dimensions);
    const profiles = ids.map(id => model.libraries.get(id));
    if (profiles.some(profile => !Array.isArray(profile.starts) || profile.starts.length !== 3 ||
        !Number.isInteger(profile.selectedStart) || profile.selectedStart < 0 || profile.selectedStart > 2 ||
        profile.starts.some(start => start.converged !== true))) return 'unstable_profiles';
    if (profiles.some(profile => profile.starts.some(start => !Array.isArray(start.groups) || !start.groups.length ||
        start.groups.length > 8 || start.groups.some(group => !Number.isInteger(group.support) || group.support < 3)))) return 'sparse_profiles';
    const winners = [];
    for (let view = 0; view < 4; view++) {
      const scores = profiles.map((profile, index) => ({ id: ids[index], score: Math.max(...profile.starts[
        view === 3 ? profile.selectedStart : view].groups.map(group =>
        representativeSimilarity(query, normalizeDescriptionVector(group.centroid, identity.dimensions)))) }));
      scores.sort((a, b) => b.score - a.score);
      if (scores[0].score <= 0 || scores[0].score - scores[1].score <= 1e-12) return 'ambiguous_profiles';
      winners.push(scores[0].id);
    }
    if (new Set(winners).size !== 1) return 'unstable_profiles';
    return winners[0] === observation.destinationId ? 'agrees' : 'disagrees';
  } catch { return 'invalid_input'; }
}
