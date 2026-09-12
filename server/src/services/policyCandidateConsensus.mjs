/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { buildPolicyCandidateAdjudicationPool } from './policyCandidateAdjudicationContract.mjs';
import { projectLiveInventoryLearnedProfile } from './liveInventoryLearnedProfileEvidence.mjs';
import { isProviderRecoveryRoutingBlocked } from './classificationProviderRecovery.mjs';
import { validatePolicyDecisionThresholds } from '../utils/policyThresholds.mjs';

export function consensusPolicyFingerprint(policyResult) {
  return createHash('sha256').update(JSON.stringify({ action: policyResult?.action,
    ranked: policyResult?.ranked, decisionDiagnostics: policyResult?.decisionDiagnostics,
    constraintConflicts: policyResult?.constraintConflicts, languageConflicts: policyResult?.languageConflicts })).digest('hex');
}

function thresholdQualified(candidate) {
  return typeof candidate?.score === 'number' && Number.isFinite(candidate.score) && candidate.score <= 100 &&
    validatePolicyDecisionThresholds(candidate).isValid &&
    candidate.score >= Math.max(70, candidate.auto_classify_threshold);
}

/** A selective tie-breaker, not a probability estimator or a policy override. */
export function assessPolicyCandidateConsensus({ contract, policyResult, evidence, aiMatch, metadata, libraries } = {}) {
  const reject = reason => ({ eligible: false, reason });
  if (policyResult?.action !== 'prompt_select' || policyResult?.decisionDiagnostics?.requires_manual_review === true ||
      !contract?.valid || contract.version !== 'policy.candidate_adjudication.v1' ||
      !Number.isInteger(metadata?.tmdb_id) || metadata.tmdb_id < 1 || metadata.tmdb_id > 2147483647 ||
      !['movie', 'tv'].includes(metadata.media_type)) return reject('policy_review_required');
  const pool = buildPolicyCandidateAdjudicationPool({ policyResult, libraries, mediaType: metadata.media_type });
  const ids = Array.isArray(contract.candidates) ? contract.candidates.map(candidate => candidate?.libraryId) : [];
  if (ids.length < 2 || ids.length > 3 || new Set(ids).size !== ids.length ||
      ids.some(id => !pool.some(candidate => candidate.libraryId === id && candidate.library.is_active === true))) {
    return reject('candidate_scope_invalid');
  }
  const selected = contract.candidates.find(candidate => candidate.libraryId === aiMatch?.library?.id);
  const policyCandidate = policyResult.ranked.find(candidate => candidate.library_id === selected?.libraryId);
  if (!selected || !thresholdQualified(policyCandidate) ||
      policyResult.ranked.some(candidate => thresholdQualified(candidate) && !ids.includes(candidate.library_id))) {
    return reject('policy_threshold_not_met');
  }
  const authority = aiMatch?.ai_authority;
  if (aiMatch.format !== 'confident' || aiMatch.needs_clarification || aiMatch.needs_retry ||
      isProviderRecoveryRoutingBlocked(aiMatch) || authority?.version !== 'ai.provider_authority.v1' ||
      authority.providerId !== 'ollama' || authority.effectiveMode !== 'proposal' || authority.isFallback !== false ||
      authority.downgraded !== false || authority.sideEffects?.canRoute !== false ||
      typeof authority.model !== 'string' || !authority.model.trim() || authority.model === 'unknown') {
    return reject('provider_proposal_unavailable');
  }
  if (evidence?.version !== contract.version || !Array.isArray(evidence.candidates) || evidence.candidates.length !== ids.length ||
      new Set(evidence.candidates.map(candidate => candidate?.libraryId)).size !== ids.length) return reject('evidence_unavailable');
  const compared = [];
  for (const id of ids) {
    const candidate = evidence.candidates.find(value => value?.libraryId === id);
    const description = candidate?.descriptionEvidence, items = description?.items;
    const profile = projectLiveInventoryLearnedProfile(description?.learnedProfile);
    if (candidate?.mediaType !== metadata.media_type || description?.statusId !== 'available' ||
        !Number.isInteger(description.eligible) || description.eligible < 3 || description.eligible > 10000 ||
        description.indexed !== description.eligible || !Array.isArray(items) || items.length !== 3 ||
        !profile || profile.trainingDescriptions < 20 ||
        items.some(item => typeof item?.description !== 'string' || !item.description.trim() ||
          !Number.isFinite(item.similarity) || item.similarity < -1 || item.similarity > 1) ||
        new Set(items.map(item => item.description)).size !== 3) return reject('evidence_incomplete');
    compared.push({ id, candidate, profile, items, mean: items.reduce((sum, item) => sum + item.similarity, 0) / 3 });
  }
  const winner = compared.find(candidate => candidate.id === selected.libraryId);
  const others = compared.filter(candidate => candidate !== winner);
  if (winner.profile.statusId !== 'available' || winner.profile.relativeFit <= 0 ||
      winner.items.some(item => item.sharedAcrossCandidates !== false || item.similarity < .75) || winner.mean < .80 ||
      others.some(candidate => winner.mean - candidate.mean < .05 || candidate.profile.relativeFit >= winner.profile.relativeFit ||
        candidate.candidate.currentLibrary?.directMatch === true)) return reject('evidence_ambiguous');
  return { eligible: true, reason: 'threshold_qualified_consensus', libraryId: selected.libraryId, score: policyCandidate.score };
}
