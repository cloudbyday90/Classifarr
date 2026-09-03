/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_SEMANTIC_SIGNAL_IDS,
} from './policyCandidateEvidenceOfflineEvaluationContract.mjs';
import {
  POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_SNAPSHOT_STATUS_IDS,
} from './policyCandidateCurrentInventorySemanticStudySnapshotContract.mjs';

export const POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_MINIMUM_RELEVANCE = 82;
export const POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_MINIMUM_MARGIN = 8;

/**
 * Produces a fixed offline study signal from a validated relevance snapshot.
 * This threshold is a testable study protocol, not a policy score, provider
 * instruction, candidate selector, or routing rule.
 */
export function scorePolicyCandidateCurrentInventorySemanticStudySnapshot(snapshot) {
  if (snapshot?.retrievalStatusId !==
      POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_SNAPSHOT_STATUS_IDS.AVAILABLE) {
    return POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_SEMANTIC_SIGNAL_IDS.ABSTAIN;
  }

  const leadingRelevance = snapshot.leadingRelevance;
  const alternativeRelevance = snapshot.alternativeRelevance;
  if (leadingRelevance >= POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_MINIMUM_RELEVANCE &&
      leadingRelevance - alternativeRelevance >=
        POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_MINIMUM_MARGIN) {
    return POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_SEMANTIC_SIGNAL_IDS
      .SUPPORTS_LEADING_CANDIDATE;
  }
  if (alternativeRelevance >= POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_MINIMUM_RELEVANCE &&
      alternativeRelevance - leadingRelevance >=
        POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_MINIMUM_MARGIN) {
    return POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_SEMANTIC_SIGNAL_IDS
      .SUPPORTS_ALTERNATIVE_CANDIDATE;
  }
  return POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_SEMANTIC_SIGNAL_IDS.ABSTAIN;
}
