/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_CANDIDATE_FROZEN_SEMANTIC_STUDY_AUTHORITY,
  POLICY_CANDIDATE_FROZEN_SEMANTIC_STUDY_BLOCKER_IDS,
  POLICY_CANDIDATE_FROZEN_SEMANTIC_STUDY_PREFLIGHT_REPORT_VERSION,
  POLICY_CANDIDATE_FROZEN_SEMANTIC_STUDY_STATUS_IDS,
  validatePolicyCandidateFrozenSemanticStudyProposal,
} from './policyCandidateFrozenSemanticStudyContract.mjs';
import {
  evaluatePolicyCandidateSemanticCounterEvidenceStudy,
} from './policyCandidateSemanticCounterEvidenceStudy.mjs';
import {
  createPolicyCandidateSemanticSnapshotFingerprint,
} from './policyCandidateSemanticSnapshotFingerprint.mjs';

function cloneAuthority() {
  return Object.freeze({
    ...POLICY_CANDIDATE_FROZEN_SEMANTIC_STUDY_AUTHORITY,
    automaticActions: Object.freeze({
      ...POLICY_CANDIDATE_FROZEN_SEMANTIC_STUDY_AUTHORITY.automaticActions,
    }),
  });
}

function buildExpectedBindings({ fixtureDocument, manifest, referenceSetDocument, snapshotDocument }) {
  try {
    return Object.freeze({
      fixtureDocumentFingerprint: createPolicyCandidateSemanticSnapshotFingerprint(fixtureDocument),
      referenceSetDocumentFingerprint: createPolicyCandidateSemanticSnapshotFingerprint(referenceSetDocument),
      semanticSnapshotManifestFingerprint: createPolicyCandidateSemanticSnapshotFingerprint(manifest),
      snapshotDocumentFingerprint: createPolicyCandidateSemanticSnapshotFingerprint(snapshotDocument),
    });
  } catch {
    return null;
  }
}

function hasMatchingBindings(proposal, expectedBindings) {
  return Boolean(expectedBindings) && Object.entries(expectedBindings).every(([key, value]) => (
    proposal?.[key] === value
  ));
}

function projectProposal(proposal, proposalValidation) {
  if (!proposalValidation.ok) {
    return Object.freeze({
      issueCount: proposalValidation.issues.length,
      valid: false,
    });
  }

  return Object.freeze({
    accessScopeId: proposal.accessScopeId,
    candidateRetrievalScopeId: proposal.candidateRetrievalScopeId,
    modelOutputScopeId: proposal.modelOutputScopeId,
    proposalCohortFingerprint: proposal.proposalCohortFingerprint,
    studyWindow: Object.freeze({
      expiresAt: proposal.studyWindow.expiresAt,
      startsAt: proposal.studyWindow.startsAt,
    }),
    valid: true,
  });
}

function studyWindowState(proposal, now) {
  if (!proposal?.studyWindow?.startsAt || !proposal?.studyWindow?.expiresAt) return 'unavailable';
  const currentTime = now instanceof Date ? now.getTime() : Number.NaN;
  const startsAt = new Date(proposal.studyWindow.startsAt).getTime();
  const expiresAt = new Date(proposal.studyWindow.expiresAt).getTime();
  if (!Number.isFinite(currentTime) || !Number.isFinite(startsAt) || !Number.isFinite(expiresAt)) {
    return 'unavailable';
  }
  if (currentTime < startsAt) return 'not_active';
  if (currentTime > expiresAt) return 'expired';
  return 'active';
}

/**
 * Checks whether a complete independently reviewed bundle is fit for a
 * time-bounded, candidate-scoped human study of one frozen AI/RAG cohort.
 * This function is in-memory only; it has no I/O or runtime authority.
 */
export function preflightPolicyCandidateFrozenSemanticStudy({
  fixtureDocument,
  manifest,
  now = new Date(),
  proposal,
  referenceSetDocument,
  snapshotDocument,
} = {}) {
  const semanticReadiness = evaluatePolicyCandidateSemanticCounterEvidenceStudy({
    fixtureDocument,
    manifest,
    referenceSetDocument,
    snapshotDocument,
  });
  const proposalValidation = validatePolicyCandidateFrozenSemanticStudyProposal(proposal);
  const expectedBindings = buildExpectedBindings({
    fixtureDocument,
    manifest,
    referenceSetDocument,
    snapshotDocument,
  });
  const proposalValid = proposalValidation.ok;
  const bindingsMatch = proposalValid && hasMatchingBindings(proposal, expectedBindings);
  const windowState = proposalValid ? studyWindowState(proposal, now) : 'unavailable';
  const blockers = [];

  if (!proposalValid) {
    blockers.push(POLICY_CANDIDATE_FROZEN_SEMANTIC_STUDY_BLOCKER_IDS.PROPOSAL_INVALID);
  } else if (!bindingsMatch) {
    blockers.push(POLICY_CANDIDATE_FROZEN_SEMANTIC_STUDY_BLOCKER_IDS.PROPOSAL_BUNDLE_MISMATCH);
  }
  if (windowState === 'not_active') {
    blockers.push(POLICY_CANDIDATE_FROZEN_SEMANTIC_STUDY_BLOCKER_IDS.PROPOSAL_NOT_ACTIVE);
  }
  if (windowState === 'expired') {
    blockers.push(POLICY_CANDIDATE_FROZEN_SEMANTIC_STUDY_BLOCKER_IDS.PROPOSAL_EXPIRED);
  }
  if (semanticReadiness.status.id === 'invalid_evaluation') {
    blockers.push(POLICY_CANDIDATE_FROZEN_SEMANTIC_STUDY_BLOCKER_IDS.SEMANTIC_READINESS_INVALID);
  } else if (semanticReadiness.status.id !== 'ready_for_human_review') {
    blockers.push(POLICY_CANDIDATE_FROZEN_SEMANTIC_STUDY_BLOCKER_IDS.SEMANTIC_READINESS_NOT_READY);
  }

  const statusId = !proposalValid || semanticReadiness.status.id === 'invalid_evaluation'
    ? POLICY_CANDIDATE_FROZEN_SEMANTIC_STUDY_STATUS_IDS.INVALID_STUDY
    : blockers.length === 0
      ? POLICY_CANDIDATE_FROZEN_SEMANTIC_STUDY_STATUS_IDS.READY_FOR_HUMAN_STUDY_REVIEW
      : POLICY_CANDIDATE_FROZEN_SEMANTIC_STUDY_STATUS_IDS.NOT_READY;

  return Object.freeze({
    authority: cloneAuthority(),
    binding: Object.freeze({
      bundleMatchesProposal: bindingsMatch,
      proposal: projectProposal(proposal, proposalValidation),
      windowState,
    }),
    blockers: Object.freeze(blockers),
    semanticReadiness,
    status: Object.freeze({
      automaticRoutingEligibility: false,
      id: statusId,
      policyChangeEligibility: false,
    }),
    version: POLICY_CANDIDATE_FROZEN_SEMANTIC_STUDY_PREFLIGHT_REPORT_VERSION,
  });
}
