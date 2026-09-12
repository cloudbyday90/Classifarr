/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { projectLiveInventoryLearnedProfile } from './liveInventoryLearnedProfileEvidence.mjs';

/** Validate a complete comparison before any consumer interprets relative support. */
export function compareInventoryDescriptionEvidence(candidates) {
  if (!Array.isArray(candidates) || candidates.length < 2 || candidates.length > 64 ||
      new Set(candidates.map(candidate => candidate?.libraryId)).size !== candidates.length) return null;
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
        new Set(items.map(item => item.description.trim().toLowerCase())).size !== 3) return null;
    compared.push({ candidate, profile, mean: items.reduce((sum, item) => sum + item.similarity, 0) / 3 });
  }
  return compared.sort((a, b) => b.mean - a.mean);
}
