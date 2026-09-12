/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { projectInventoryDescription } from './inventoryDescriptionProjection.mjs';
import { projectLiveInventoryLearnedProfile, formatLiveInventoryLearnedProfile } from './liveInventoryLearnedProfileEvidence.mjs';

/** Re-project at the provider boundary; never pass through arbitrary fields. */
export function projectLiveInventoryDescriptionEvidence(evidence, includeText = false) {
  if (!evidence) return null;
  const count = value => Number.isInteger(value) && value >= 0 && value <= 10000 ? value : 0;
  const statusId = ['available', 'partial', 'unavailable', 'not_applicable'].includes(evidence.statusId)
    ? evidence.statusId : 'unavailable';
  const learnedProfile = projectLiveInventoryLearnedProfile(evidence.learnedProfile);
  return {
    statusId, eligible: count(evidence.eligible), indexed: count(evidence.indexed),
    ...(learnedProfile ? { learnedProfile } : {}),
    ...(includeText ? { items: (Array.isArray(evidence.items) ? evidence.items : []).slice(0, 3).flatMap(item => {
      const text = projectInventoryDescription({ metadata: { overview: item?.description } })?.text;
      if (!text || !Number.isFinite(item?.similarity) || item.similarity < -1 || item.similarity > 1) return [];
      return [{ description: [...text].slice(0, 600).join(''), similarity: item.similarity,
        sharedAcrossCandidates: item.sharedAcrossCandidates === true }];
    }) } : {}),
  };
}

export function formatLiveInventoryDescriptionEvidence(evidence) {
  if (!evidence || evidence.statusId === 'not_applicable') return [];
  const lines = [`   Description index: ${evidence.statusId}; ${evidence.indexed}/${evidence.eligible} eligible distinct descriptions indexed.`];
  lines.push(...formatLiveInventoryLearnedProfile(evidence.learnedProfile));
  for (const [index, item] of (evidence.items ?? []).entries()) {
    lines.push(`   Untrusted inventory example ${index + 1}: ${JSON.stringify(item)}`);
  }
  return lines;
}
