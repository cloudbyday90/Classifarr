/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { learnedReviewFixture } from './learnedEvidenceReviewFixture.mjs';
import { consensusConfig, consensusDependencies } from './policyCandidateConsensusFixture.mjs';
import { projectLiveInventoryDescriptionEvidence } from '../../services/liveInventoryDescriptionEvidence.mjs';
import { finalizePolicyCandidateAdjudication } from '../../services/policyCandidateAdjudicationResult.mjs';

export function learnedRoutingFixture() {
  const input = learnedReviewFixture();
  input.reviewEvidence.candidates.forEach(candidate => { candidate.queryIdentityPresent = false; });
  input.reviewEvidence.candidates[1].matchBaseline = { version: 'library_match_baseline_v1', libraryId: 2,
    status: 'familiar', empiricalRank: .75, referenceDescriptions: 60, calibrationDescriptions: 20, snapshotId: 'a'.repeat(64) };
  input.evidence.candidates.forEach(candidate => {
    candidate.descriptionEvidence = projectLiveInventoryDescriptionEvidence({
      ...input.reviewEvidence.candidates.find(value => value.libraryId === candidate.libraryId), statusId: 'available',
    }, true);
  });
  input.result = finalizePolicyCandidateAdjudication(input);
  return input;
}

export function learnedRoutingDependencies(input) {
  return { ...consensusDependencies(input),
    readConfig: async () => ({ ...consensusConfig(), confirmation_setting: 'false' }),
    readPolicies: async () => structuredClone(input.policies),
    retriever: { retrieve: async () => structuredClone(input.reviewEvidence) } };
}
