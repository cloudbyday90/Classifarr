/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { INVENTORY_LEARNED_PROFILE_VERSION } from './inventoryLearnedProfiles.mjs';

/** Numeric aggregates only, even for local providers; never expose learned terms or fingerprints. */
export function projectLiveInventoryLearnedProfile(evidence) {
  if (evidence?.version !== INVENTORY_LEARNED_PROFILE_VERSION ||
      !['available', 'neutral'].includes(evidence.statusId) ||
      !Number.isFinite(evidence.relativeFit) || Math.abs(evidence.relativeFit) > 20 ||
      !Number.isInteger(evidence.trainingDescriptions) || evidence.trainingDescriptions < 0 ||
      evidence.trainingDescriptions > 10000) return null;
  return { version: INVENTORY_LEARNED_PROFILE_VERSION, statusId: evidence.statusId,
    relativeFit: evidence.relativeFit, trainingDescriptions: evidence.trainingDescriptions };
}

export function formatLiveInventoryLearnedProfile(evidence) {
  const profile = projectLiveInventoryLearnedProfile(evidence);
  if (!profile) return [];
  return [
    `   Learned inventory fit: ${profile.relativeFit} (${profile.statusId}; ${profile.trainingDescriptions} distinct same-media training descriptions; ${profile.version}).`,
    '   This compares genre, studio and audience patterns inside this library versus other libraries, excluding this item and synopsis copies. Positive favors fit, negative disfavors fit, zero is neutral; it is NOT confidence or routing permission. Existing placements may be wrong; do not count this and inventory examples as independent votes.',
  ];
}
