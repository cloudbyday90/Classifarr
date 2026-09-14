/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { validateDescriptionRepresentation } from './inventoryDescriptionVectorCache.mjs';
import { compareRepresentativeCandidates } from './representativeCandidateComparison.mjs';
import { INVENTORY_REPRESENTATIVE_PROFILE_VERSION } from './inventoryRepresentativeProfile.mjs';
import { representativeValidationError } from './representativeValidation.mjs';
import { representativeValidationIssue } from './representativeValidationDiagnostics.mjs';

export const REPRESENTATIVE_SHADOW_REASONS = Object.freeze(['agrees', 'disagrees', 'known_item', 'known_description',
  'scope_changed', 'representation_changed', 'sparse_profiles', 'unconverged_profiles', 'initialization_sensitive',
  'no_positive_match', 'tied_destinations', 'invalid_input']);

/** Includes identities excluded from training; this digest never enters a model or public report. */
export function representativeNoveltyKey(snapshot) {
  if (!(snapshot.observedKeys instanceof Set) || snapshot.observedKeys.size > 50000 ||
      [...snapshot.observedKeys].some(key => !/^(movie|tv):[1-9]\d{0,9}$/.test(key))) {
    throw new Error('representative_novelty_snapshot_invalid');
  }
  return createHash('sha256').update(JSON.stringify([...snapshot.observedKeys].sort())).digest('hex');
}

/** Description-only diagnostic: no routes, labels, inference, learning or persistence. */
export function compareInventoryRepresentativeShadow({ observation, snapshot, model, identity, configKey, onInvalid = null }) {
  try {
    representativeNoveltyKey(snapshot);
    if (model?.kind !== 'full_inventory_shadow' || model.version !== INVENTORY_REPRESENTATIVE_PROFILE_VERSION)
      throw representativeValidationError('profile_header');
    if (JSON.stringify(validateDescriptionRepresentation(observation.identity)) !== JSON.stringify(validateDescriptionRepresentation(identity)) ||
        observation.configKey !== configKey) return 'representation_changed';
    if (snapshot.observedKeys.has(observation.key)) return 'known_item';
    if (snapshot.corpus.texts.has(observation.hash)) return 'known_description';
    const ids = observation.libraryIds;
    if (!Array.isArray(ids) || ids.length < 2 || ids.length > 64 || new Set(ids).size !== ids.length ||
        !ids.includes(observation.destinationId) || ids.some(id => !Number.isSafeInteger(id) || id < 1 ||
          model.libraries.get(id)?.mediaType !== observation.mediaType)) return 'scope_changed';
    const profiles = ids.map(id => model.libraries.get(id));
    return compareRepresentativeCandidates(profiles, observation.vector, identity.dimensions, ids.indexOf(observation.destinationId), onInvalid);
  } catch (error) {
    try { onInvalid?.(representativeValidationIssue(error)); } catch { /* No observer authority. */ }
    return 'invalid_input';
  }
}
