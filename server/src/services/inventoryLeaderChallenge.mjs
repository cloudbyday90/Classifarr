/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { buildPolicyCandidateAdjudicationPool } from './policyCandidateAdjudicationContract.mjs';
import { projectLiveInventoryLearnedProfile } from './liveInventoryLearnedProfileEvidence.mjs';
import { findInventoryDescriptionAnchor } from './inventoryDescriptionCandidateAnchor.mjs';

/** Evaluation-only nomination. Never changes policy, confidence, eligibility or routing authority. */
export function assessInventoryLeaderChallenge({ policyResult, libraries, mediaType, evidence } = {}) {
  const pool = buildPolicyCandidateAdjudicationPool({ policyResult, libraries, mediaType });
  const baseline = pool.map(candidate => candidate.libraryId);
  const vetoed = policyResult?.decisionDiagnostics?.requires_manual_review === true;
  const result = (statusId, challengerId = null) => ({ statusId: vetoed ? 'review_veto' : statusId,
    policyLeaderId: baseline[0] ?? null, challengerId: vetoed ? null : challengerId,
    poolSize: pool.length, candidateOrder: vetoed || challengerId === null ? baseline
      : [challengerId, ...baseline.filter(id => id !== challengerId)],
    ...(vetoed ? { blockedContent: { statusId, challengerId }, reviewReason:
      ['weak_evidence_primary', 'weak_evidence_overlap'].includes(policyResult.decisionDiagnostics.reason_code)
        ? policyResult.decisionDiagnostics.reason_code : 'other_review_veto' } : {}) });
  if (!['manual', 'prompt_select', 'prompt_confirm'].includes(policyResult?.action)) return result('not_reviewable');
  if (pool.length < 2 || pool.length > 64 || !['movie', 'tv'].includes(mediaType) ||
      pool.some(candidate => candidate.mediaType !== mediaType)) return result('scope_unavailable');
  const candidates = evidence?.candidates;
  if (evidence?.statusId !== 'available' || !Array.isArray(candidates) || candidates.length !== pool.length ||
      new Set(candidates.map(candidate => candidate?.libraryId)).size !== pool.length ||
      candidates.some(candidate => !baseline.includes(candidate?.libraryId))) return result('evidence_unavailable');
  const first = candidates[0]?.learnedProfile;
  if (!/^[a-f0-9]{64}$/.test(first?.snapshotId ?? '') || candidates.some(candidate => {
    const value = candidate.learnedProfile, profile = projectLiveInventoryLearnedProfile(value);
    return !profile || value.snapshotId !== first.snapshotId || profile.trainingDescriptions < 1 ||
      profile.trainingDescriptions !== first.trainingDescriptions ||
      profile.statusId !== (profile.relativeFit === 0 ? 'neutral' : 'available');
  })) return result('profile_unavailable');
  const ranked = [...candidates].sort((a, b) => b.learnedProfile.relativeFit - a.learnedProfile.relativeFit);
  const score = ranked[0].learnedProfile.relativeFit;
  if (score <= 0 || score === ranked[1].learnedProfile.relativeFit) return result('profile_inconclusive');
  const descriptionLeader = findInventoryDescriptionAnchor(baseline, candidates);
  if (descriptionLeader === null) return result('description_inconclusive');
  if (descriptionLeader !== ranked[0].libraryId) return result('content_disagrees');
  return descriptionLeader === baseline[0] ? result('supports_policy') : result('challenger', descriptionLeader);
}
