/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  policyDecisionAction,
  policyDecisionLibraryIdentifier,
} from '../utils/policyDecisionAuthority.mjs';

export const CLASSIFICATION_DETERMINISTIC_AI_MODE_VERSION = 'classification.deterministic_ai_mode.v1';

export const CLASSIFICATION_DETERMINISTIC_AI_MODE_IDS = Object.freeze({
  CLASSIFY: 'classify',
  VERIFY: 'verify',
  ADJUDICATE: 'adjudicate',
  ABSTAIN: 'abstain',
  SKIP: 'skip',
});

export const CLASSIFICATION_DETERMINISTIC_AI_MODE_REASON_IDS = Object.freeze({
  NO_POLICY_CANDIDATE: 'no_policy_candidate',
  POLICY_EVALUATION_FAILED: 'policy_evaluation_failed',
  POLICY_AUTO: 'policy_auto',
  UNIQUE_REVIEW_CANDIDATE: 'unique_review_candidate',
  CANDIDATE_ADJUDICATION_READY: 'candidate_adjudication_ready',
  AMBIGUOUS_POLICY_CANDIDATES: 'ambiguous_policy_candidates',
  INSUFFICIENT_POLICY_EVIDENCE: 'insufficient_policy_evidence',
  MANUAL_REVIEW_REQUIRED: 'manual_review_required',
  INVALID_POLICY_DESTINATION: 'invalid_policy_destination',
  UNSUPPORTED_POLICY_OUTCOME: 'unsupported_policy_outcome',
});

const VALID_MODE_IDS = new Set(Object.values(CLASSIFICATION_DETERMINISTIC_AI_MODE_IDS));
const VALID_REASON_IDS = new Set(Object.values(CLASSIFICATION_DETERMINISTIC_AI_MODE_REASON_IDS));
const VALID_POLICY_ACTIONS = new Set([
  'auto_classify',
  'prompt_confirm',
  'prompt_select',
  'manual',
]);

function getRankedCandidates(policyResult = null) {
  return Array.isArray(policyResult?.ranked)
    ? policyResult.ranked.filter((candidate) => candidate && typeof candidate === 'object')
    : [];
}

function findLibrary(libraries = [], candidate = null) {
  const candidateId = policyDecisionLibraryIdentifier(candidate);
  if (!candidateId || !Array.isArray(libraries)) {
    return null;
  }

  return libraries.find((library) => policyDecisionLibraryIdentifier(library) === candidateId) || null;
}

function buildDecision({ mode, shouldInvoke, reasonCode, policyAction, candidateCount }) {
  return Object.freeze({
    version: CLASSIFICATION_DETERMINISTIC_AI_MODE_VERSION,
    mode,
    shouldInvoke,
    reasonCode,
    policyAction,
    candidateCount,
  });
}

/**
 * Resolves the only AI mode allowed for a server-owned policy outcome. The
 * policy engine remains the authority for every destination and route.
 */
export function resolveDeterministicOutcomeAiMode({
  policyResult = null,
  libraries = [],
  policyEvaluationFailed = false,
  candidateAdjudication = null,
} = {}) {
  const ranked = getRankedCandidates(policyResult);
  const policyAction = policyDecisionAction(policyResult);

  if (policyEvaluationFailed) {
    return buildDecision({
      mode: CLASSIFICATION_DETERMINISTIC_AI_MODE_IDS.ABSTAIN,
      shouldInvoke: false,
      reasonCode: CLASSIFICATION_DETERMINISTIC_AI_MODE_REASON_IDS.POLICY_EVALUATION_FAILED,
      policyAction,
      candidateCount: 0,
    });
  }

	if (policyAction === 'auto_classify') {
		const selectedLibrary = findLibrary(libraries, policyResult?.library);
		if (!selectedLibrary) {
			return buildDecision({
				mode: CLASSIFICATION_DETERMINISTIC_AI_MODE_IDS.ABSTAIN,
				shouldInvoke: false,
				reasonCode: CLASSIFICATION_DETERMINISTIC_AI_MODE_REASON_IDS.INVALID_POLICY_DESTINATION,
				policyAction,
				candidateCount: ranked.length,
			});
		}

		return buildDecision({
      mode: CLASSIFICATION_DETERMINISTIC_AI_MODE_IDS.SKIP,
      shouldInvoke: false,
      reasonCode: CLASSIFICATION_DETERMINISTIC_AI_MODE_REASON_IDS.POLICY_AUTO,
      policyAction,
      candidateCount: ranked.length,
    });
  }

  if (ranked.length === 0 && !policyAction) {
    return buildDecision({
      mode: CLASSIFICATION_DETERMINISTIC_AI_MODE_IDS.CLASSIFY,
      shouldInvoke: true,
      reasonCode: CLASSIFICATION_DETERMINISTIC_AI_MODE_REASON_IDS.NO_POLICY_CANDIDATE,
      policyAction,
      candidateCount: 0,
    });
  }

  if (ranked.length === 0) {
    return buildDecision({
      mode: CLASSIFICATION_DETERMINISTIC_AI_MODE_IDS.ABSTAIN,
      shouldInvoke: false,
      reasonCode: CLASSIFICATION_DETERMINISTIC_AI_MODE_REASON_IDS.INVALID_POLICY_DESTINATION,
      policyAction,
      candidateCount: 0,
    });
  }

  const topCandidate = ranked[0];
  const selectedCandidate = policyResult?.library || topCandidate;
  const selectedLibrary = findLibrary(libraries, selectedCandidate);

  if (policyAction === 'prompt_select') {
    if (candidateAdjudication?.valid === true) {
      return buildDecision({
        mode: CLASSIFICATION_DETERMINISTIC_AI_MODE_IDS.ADJUDICATE,
        shouldInvoke: true,
        reasonCode: CLASSIFICATION_DETERMINISTIC_AI_MODE_REASON_IDS.CANDIDATE_ADJUDICATION_READY,
        policyAction,
        candidateCount: candidateAdjudication.candidates.length,
      });
    }

    return buildDecision({
      mode: CLASSIFICATION_DETERMINISTIC_AI_MODE_IDS.ABSTAIN,
      shouldInvoke: false,
      reasonCode: CLASSIFICATION_DETERMINISTIC_AI_MODE_REASON_IDS.AMBIGUOUS_POLICY_CANDIDATES,
      policyAction,
      candidateCount: ranked.length,
    });
  }

  if (policyAction === 'manual') {
    return buildDecision({
      mode: CLASSIFICATION_DETERMINISTIC_AI_MODE_IDS.ABSTAIN,
      shouldInvoke: false,
      reasonCode: CLASSIFICATION_DETERMINISTIC_AI_MODE_REASON_IDS.INSUFFICIENT_POLICY_EVIDENCE,
      policyAction,
      candidateCount: ranked.length,
    });
  }

  if (policyResult?.decisionDiagnostics?.requires_manual_review === true) {
    return buildDecision({
      mode: CLASSIFICATION_DETERMINISTIC_AI_MODE_IDS.ABSTAIN,
      shouldInvoke: false,
      reasonCode: CLASSIFICATION_DETERMINISTIC_AI_MODE_REASON_IDS.MANUAL_REVIEW_REQUIRED,
      policyAction,
      candidateCount: ranked.length,
    });
  }

  if (policyAction === 'prompt_confirm') {
    if (!selectedLibrary) {
      return buildDecision({
        mode: CLASSIFICATION_DETERMINISTIC_AI_MODE_IDS.ABSTAIN,
        shouldInvoke: false,
        reasonCode: CLASSIFICATION_DETERMINISTIC_AI_MODE_REASON_IDS.INVALID_POLICY_DESTINATION,
        policyAction,
        candidateCount: ranked.length,
      });
    }

    return buildDecision({
      mode: CLASSIFICATION_DETERMINISTIC_AI_MODE_IDS.VERIFY,
      shouldInvoke: true,
      reasonCode: CLASSIFICATION_DETERMINISTIC_AI_MODE_REASON_IDS.UNIQUE_REVIEW_CANDIDATE,
      policyAction,
      candidateCount: ranked.length,
    });
  }

  return buildDecision({
    mode: CLASSIFICATION_DETERMINISTIC_AI_MODE_IDS.ABSTAIN,
    shouldInvoke: false,
    reasonCode: CLASSIFICATION_DETERMINISTIC_AI_MODE_REASON_IDS.UNSUPPORTED_POLICY_OUTCOME,
    policyAction,
    candidateCount: ranked.length,
  });
}

export function buildDeterministicOutcomeAiAbstentionResult({
  policyResult = null,
  libraries = [],
  signalContext = null,
  aiModeDecision = null,
} = {}) {
  const ranked = getRankedCandidates(policyResult);
  const topCandidate = ranked[0] || null;
  const selectedCandidate = policyResult?.library || topCandidate;
  const library = findLibrary(libraries, selectedCandidate);
  const confidence = Number(policyResult?.confidence ?? topCandidate?.score ?? 0);

  return {
    library,
    confidence: Number.isFinite(confidence) ? confidence : 0,
    method: 'policy_engine',
    reason: aiModeDecision?.reasonCode === CLASSIFICATION_DETERMINISTIC_AI_MODE_REASON_IDS.POLICY_EVALUATION_FAILED
      ? 'Policy evaluation did not complete, so an operator decision is required.'
      : 'AI abstained because the deterministic policy outcome requires an operator decision.',
    needs_clarification: true,
    libraries,
    signalContext,
    policyResult,
    deterministic_ai_mode: aiModeDecision,
  };
}

/**
 * Produces a bounded runtime projection for persistence and presentation. It
 * intentionally excludes item identity, library identity, policy content, and
 * provider output.
 */
export function buildDeterministicOutcomeAiModeProjection(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      value.version !== CLASSIFICATION_DETERMINISTIC_AI_MODE_VERSION) {
    return null;
  }

  const mode = typeof value.mode === 'string' && VALID_MODE_IDS.has(value.mode)
    ? value.mode
    : null;
  const reasonCode = typeof value.reasonCode === 'string' && VALID_REASON_IDS.has(value.reasonCode)
    ? value.reasonCode
    : null;
  const policyAction = typeof value.policyAction === 'string' && VALID_POLICY_ACTIONS.has(value.policyAction)
    ? value.policyAction
    : null;
  const candidateCount = Number.isSafeInteger(value.candidateCount) && value.candidateCount >= 0 && value.candidateCount <= 1000
    ? value.candidateCount
    : null;

  if (!mode || !reasonCode || candidateCount === null) {
    return null;
  }

  return Object.freeze({
    version: CLASSIFICATION_DETERMINISTIC_AI_MODE_VERSION,
    mode,
    invoked: value.shouldInvoke === true,
    reason_code: reasonCode,
    policy_action: policyAction,
    candidate_count: candidateCount,
  });
}
