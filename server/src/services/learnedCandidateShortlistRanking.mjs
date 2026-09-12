/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { fuseInventoryCandidateRanks } from './inventoryCandidateRankFusion.mjs';
import { projectLiveInventoryLearnedProfile } from './liveInventoryLearnedProfileEvidence.mjs';
import { preserveInventoryDescriptionCandidate } from './inventoryDescriptionCandidateAnchor.mjs';

/** Only rerank alternatives; never drop the policy leader or expand eligibility. */
export function rankLearnedCandidateShortlist(pool, profiles, descriptionEvidence = null) {
  const baseline = pool.map(candidate => candidate.libraryId);
  const preserve = order => preserveInventoryDescriptionCandidate(order, descriptionEvidence);
  if (pool.length <= 3 || pool.length > 64) return baseline;
  if (!(profiles instanceof Map) || profiles.size !== pool.length) return preserve(baseline);
  const first = profiles.get(baseline[0]);
  if (!/^[a-f0-9]{64}$/.test(first?.snapshotId ?? '')) return preserve(baseline);
  const valid = pool.every(candidate => {
    const value = profiles.get(candidate.libraryId), projected = projectLiveInventoryLearnedProfile(value);
    return projected && value.snapshotId === first.snapshotId && projected.trainingDescriptions > 0 &&
      projected.statusId === (projected.relativeFit === 0 ? 'neutral' : 'available') &&
      projected.trainingDescriptions === first.trainingDescriptions;
  });
  if (!valid) return preserve(baseline);
  const alternatives = baseline.slice(1).map(id => ({ id }));
  const scores = alternatives.map(({ id }) => ({ id, score: profiles.get(id).relativeFit }));
  return preserve([baseline[0], ...fuseInventoryCandidateRanks(alternatives, scores).map(candidate => candidate.id)]);
}
