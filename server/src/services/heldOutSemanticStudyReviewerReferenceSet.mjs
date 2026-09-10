/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  composePolicyCandidateSemanticIndependentReviewConsensus,
  POLICY_CANDIDATE_SEMANTIC_INDEPENDENT_REVIEW_CONSENSUS_STATUS_IDS,
  POLICY_CANDIDATE_SEMANTIC_INDEPENDENT_REVIEW_CONSENSUS_VERSION,
} from './policyCandidateSemanticIndependentReviewConsensus.mjs';
import {
  getHeldOutSemanticStudyReviewerPacketBinding,
} from './heldOutSemanticStudyReviewerSubmissionTemplate.mjs';

export const HELD_OUT_SEMANTIC_STUDY_REVIEWER_REFERENCE_SET_VERSION =
  'policy.held_out_semantic_study_reviewer_reference_set.v1';

function buildAuthority() {
  return Object.freeze({
    automaticActions: Object.freeze({
      aiInvocation: false,
      learning: false,
      policyChange: false,
      retry: false,
      routing: false,
    }),
    scope: 'offline_packet_bound_independent_review_consensus_only',
  });
}

function invalidResult() {
  return Object.freeze({
    authority: buildAuthority(),
    referenceSetDocument: null,
    referenceSetFingerprint: null,
    status: Object.freeze({
      id: POLICY_CANDIDATE_SEMANTIC_INDEPENDENT_REVIEW_CONSENSUS_STATUS_IDS.INVALID,
    }),
    summary: Object.freeze({
      adjudicatedFixtureCount: 0,
      disagreementFixtureCount: 0,
      fixtureCount: 0,
      unanimousFixtureCount: 0,
    }),
    version: POLICY_CANDIDATE_SEMANTIC_INDEPENDENT_REVIEW_CONSENSUS_VERSION,
  });
}

function hasExactFixtureSet(submission, fixtureIds) {
  if (!Array.isArray(submission?.labels) || submission.labels.length !== fixtureIds.length) return false;
  const remainingFixtureIds = new Set(fixtureIds);
  for (const label of submission.labels) {
    if (!remainingFixtureIds.delete(label?.fixtureId)) return false;
  }
  return remainingFixtureIds.size === 0;
}

function packetBoundReferenceSetId(fixtureDocumentFingerprint) {
  return `held_out_reference_${fixtureDocumentFingerprint.slice('sha256:'.length)}`;
}

function packetMatchesReferenceSet(referenceSetDocument, packetBinding) {
  return referenceSetDocument?.fixtureDocumentFingerprint === packetBinding.fixtureDocumentFingerprint &&
    hasExactFixtureSet(referenceSetDocument, packetBinding.fixtureIds);
}

/**
 * Composes already-finalized human submissions into a reference set only when
 * they exactly cover the original private packet's opaque fixture IDs. It is
 * deterministic and in-memory: no review context, file path, model output, or
 * authority to learn, alter policy, invoke AI/RAG, or route media is added.
 */
export function composeHeldOutSemanticStudyReviewerReferenceSet({
  adjudicationSubmission = null,
  packet,
  reviewerOneSubmission,
  reviewerTwoSubmission,
} = {}) {
  const packetBinding = getHeldOutSemanticStudyReviewerPacketBinding({ packet });
  if (!packetBinding ||
      !hasExactFixtureSet(reviewerOneSubmission, packetBinding.fixtureIds) ||
      !hasExactFixtureSet(reviewerTwoSubmission, packetBinding.fixtureIds)) {
    return invalidResult();
  }

  const result = composePolicyCandidateSemanticIndependentReviewConsensus({
    adjudicationSubmission,
    referenceSetId: packetBoundReferenceSetId(packetBinding.fixtureDocumentFingerprint),
    reviewerOneSubmission,
    reviewerTwoSubmission,
  });
  if (result.status.id !== POLICY_CANDIDATE_SEMANTIC_INDEPENDENT_REVIEW_CONSENSUS_STATUS_IDS.COMPLETE ||
      !packetMatchesReferenceSet(result.referenceSetDocument, packetBinding)) {
    return result.status.id === POLICY_CANDIDATE_SEMANTIC_INDEPENDENT_REVIEW_CONSENSUS_STATUS_IDS
      .ADJUDICATION_REQUIRED
      ? result
      : invalidResult();
  }
  return result;
}
