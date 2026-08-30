/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_SEMANTIC_SIGNAL_IDS,
} from './policyCandidateEvidenceOfflineEvaluationContract.mjs';
import {
  POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_CANDIDATE_ROLE_IDS,
} from './policyCandidateSemanticSnapshotContract.mjs';

const MINIMUM_SIMILARITY = 0.82;
const MINIMUM_MARGIN = 0.08;

function cosineSimilarity(left, right) {
  let dotProduct = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    dotProduct += left[index] * right[index];
    leftMagnitude += left[index] ** 2;
    rightMagnitude += right[index] ** 2;
  }

  return dotProduct / Math.sqrt(leftMagnitude * rightMagnitude);
}

/**
 * The input is already contract-validated by the adapter. The scorer exposes
 * only an allow-listed semantic status: numeric vector values never leave it.
 */
export function scorePolicyCandidateSemanticSnapshot(snapshot) {
  const embeddingsByRole = new Map(snapshot.candidateEmbeddings.map((candidate) => [
    candidate.roleId,
    candidate.embedding,
  ]));
  const leadingSimilarity = cosineSimilarity(
    snapshot.queryEmbedding,
    embeddingsByRole.get(POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_CANDIDATE_ROLE_IDS.LEADING),
  );
  const alternativeSimilarity = cosineSimilarity(
    snapshot.queryEmbedding,
    embeddingsByRole.get(POLICY_CANDIDATE_SEMANTIC_SNAPSHOT_CANDIDATE_ROLE_IDS.ALTERNATIVE),
  );

  if (leadingSimilarity >= MINIMUM_SIMILARITY &&
      leadingSimilarity - alternativeSimilarity >= MINIMUM_MARGIN) {
    return POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_SEMANTIC_SIGNAL_IDS
      .SUPPORTS_LEADING_CANDIDATE;
  }
  if (alternativeSimilarity >= MINIMUM_SIMILARITY &&
      alternativeSimilarity - leadingSimilarity >= MINIMUM_MARGIN) {
    return POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_SEMANTIC_SIGNAL_IDS
      .SUPPORTS_ALTERNATIVE_CANDIDATE;
  }
  return POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_SEMANTIC_SIGNAL_IDS.ABSTAIN;
}
