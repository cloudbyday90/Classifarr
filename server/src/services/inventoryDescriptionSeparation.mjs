/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { projectLiveInventoryLearnedProfile } from './liveInventoryLearnedProfileEvidence.mjs';

/** One correlated inventory comparison, never a probability or routing grant. */
export function assessInventoryDescriptionSeparation(candidates) {
  const reject = reason => ({ eligible: false, reason });
  if (!Array.isArray(candidates) || candidates.length < 2 || candidates.length > 64 ||
      new Set(candidates.map(candidate => candidate?.libraryId)).size !== candidates.length) {
    return reject('evidence_incomplete');
  }
  const compared = [];
  for (const candidate of candidates) {
    const profile = projectLiveInventoryLearnedProfile(candidate?.learnedProfile);
    const items = candidate?.items;
    if (!Number.isInteger(candidate?.libraryId) || candidate.libraryId < 1 || candidate.libraryId > 2147483647 ||
        !Number.isInteger(candidate.eligible) || candidate.eligible < 3 || candidate.eligible > 10000 ||
        candidate.indexed !== candidate.eligible || !profile || profile.trainingDescriptions < 20 ||
        !Array.isArray(items) || items.length !== 3 ||
        items.some(item => typeof item?.description !== 'string' || !item.description.trim() ||
          item.description.length > 2000 || !Number.isFinite(item.similarity) || item.similarity < -1 || item.similarity > 1) ||
        new Set(items.map(item => item.description.trim().toLowerCase())).size !== 3) return reject('evidence_incomplete');
    compared.push({ candidate, profile, mean: items.reduce((sum, item) => sum + item.similarity, 0) / 3 });
  }
  compared.sort((a, b) => b.mean - a.mean);
  const [winner, ...others] = compared;
  if (winner.profile.statusId !== 'available' || winner.profile.relativeFit <= 0 ||
      winner.candidate.items.some(item => item.sharedAcrossCandidates !== false || item.similarity < .75) ||
      winner.mean < .80 || others.some(other => winner.mean - other.mean < .05 ||
        other.profile.relativeFit >= winner.profile.relativeFit)) return reject('evidence_ambiguous');
  return { eligible: true, reason: 'distinct_inventory_support', libraryId: winner.candidate.libraryId,
    comparison: { schema_version: 1, status_id: 'distinct_support', compared_libraries: compared.length,
      neighbors: 3, mean_similarity: Number(winner.mean.toFixed(6)),
      similarity_margin: Number((winner.mean - others[0].mean).toFixed(6)),
      relative_fit: winner.profile.relativeFit, training_descriptions: winner.profile.trainingDescriptions } };
}
