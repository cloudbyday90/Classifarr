import {
  POLICY_LEARNING_DECISION_IDS,
} from './policyLearningGuard.mjs';
import {
  validatePolicyRequestTimeLearningDecision,
} from './policyRequestTimeLearning.mjs';

const POLICY_GUARDED_OUTCOME_PROJECTION_VERSION = 'policy.guarded_outcome_projection.v1';

const POLICY_GUARDED_OUTCOME_PROJECTION_STATUS_IDS = Object.freeze({
  READY: 'ready',
  READY_WITH_REJECTIONS: 'ready_with_rejections',
});

const POLICY_GUARDED_OUTCOME_REJECTION_IDS = Object.freeze({
  MISSING_FINGERPRINT: 'missing_fingerprint',
  MISSING_REQUEST_PROOF: 'missing_request_proof',
  INVALID_REQUEST_DECISION: 'invalid_request_time_decision',
});

const PROJECTION_FIELDS = new Set([
  'version',
  'statusId',
  'outcomes',
  'rejections',
  'summary',
]);
const REQUEST_TIME_DECISION_INPUT_KEYS = new Set([
  'requestTimeDecisions',
]);

const SHA256_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/u;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asCount(value) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeCandidate(value = {}) {
  const candidate = asObject(value);

  return {
    key: normalizeString(candidate.key),
    label: normalizeString(candidate.label),
    signalType: normalizeString(candidate.signalType),
    evidenceCount: asCount(candidate.evidenceCount),
  };
}

function normalizeFinalOutcome(value = {}) {
  const outcome = asObject(value);

  return {
    recorded: outcome.recorded === true,
    status: normalizeString(outcome.status),
    destinationLibraryId: outcome.destinationLibraryId ?? null,
    destinationLibraryName: normalizeString(outcome.destinationLibraryName),
  };
}

function getRejectionReason(decision = {}) {
  const requestDecision = asObject(decision);
  const fingerprint = normalizeString(requestDecision.upstreamEvidenceFingerprint?.fingerprint).toLowerCase();

  if (!SHA256_FINGERPRINT_PATTERN.test(fingerprint)) {
    return POLICY_GUARDED_OUTCOME_REJECTION_IDS.MISSING_FINGERPRINT;
  }

  if (!requestDecision.questionReductionProof?.validation) {
    return POLICY_GUARDED_OUTCOME_REJECTION_IDS.MISSING_REQUEST_PROOF;
  }

  return POLICY_GUARDED_OUTCOME_REJECTION_IDS.INVALID_REQUEST_DECISION;
}

function buildProjectedOutcome(decision = {}) {
  const requestDecision = asObject(decision);
  const learningDecision = asObject(requestDecision.learningDecision);
  const learning = asObject(learningDecision.learning);
  const upstreamEvidenceFingerprint = asObject(requestDecision.upstreamEvidenceFingerprint);
  const questionReductionProof = asObject(requestDecision.questionReductionProof);

  return {
    evidenceFingerprint: {
      algorithm: normalizeString(upstreamEvidenceFingerprint.algorithm).toLowerCase(),
      fingerprint: normalizeString(upstreamEvidenceFingerprint.fingerprint).toLowerCase(),
    },
    requestProofFingerprint: normalizeString(
      questionReductionProof.evidenceFingerprint?.fingerprint
    ).toLowerCase(),
    learning: {
      decisionId: normalizeString(learning.decisionId),
      tierId: normalizeString(learning.tierId),
      canWriteLearning: learning.canWriteLearning === true,
      requiresExplicitPolicyEdit: learning.requiresExplicitPolicyEdit === true,
      candidate: normalizeCandidate(learning.candidate),
    },
    finalOutcome: normalizeFinalOutcome(requestDecision.finalOutcome),
    profileRefreshQueued: requestDecision.profileRefresh?.queue === true,
  };
}

function buildProjectionSummary({ outcomes = [], rejections = [] } = {}) {
  const acceptedOutcomes = asArray(outcomes);
  const rejectedOutcomes = asArray(rejections);

  return {
    decisionCount: acceptedOutcomes.length + rejectedOutcomes.length,
    acceptedCount: acceptedOutcomes.length,
    rejectedCount: rejectedOutcomes.length,
    missingFingerprintCount: rejectedOutcomes.filter(rejection =>
      rejection.reasonId === POLICY_GUARDED_OUTCOME_REJECTION_IDS.MISSING_FINGERPRINT
    ).length,
    missingRequestProofCount: rejectedOutcomes.filter(rejection =>
      rejection.reasonId === POLICY_GUARDED_OUTCOME_REJECTION_IDS.MISSING_REQUEST_PROOF
    ).length,
    invalidRequestProofCount: rejectedOutcomes.filter(rejection =>
      rejection.reasonId === POLICY_GUARDED_OUTCOME_REJECTION_IDS.INVALID_REQUEST_DECISION
    ).length,
    requestProofCount: acceptedOutcomes.length,
    fingerprintCount: new Set(acceptedOutcomes.map(outcome => outcome.evidenceFingerprint.fingerprint)).size,
    profileRefreshQueued: acceptedOutcomes.some(outcome => outcome.profileRefreshQueued === true),
    hasBlockedLearning: acceptedOutcomes.some(outcome =>
      outcome.learning.decisionId === POLICY_LEARNING_DECISION_IDS.BLOCKED
    ),
    hasPolicyEditRequirement: acceptedOutcomes.some(outcome =>
      outcome.learning.requiresExplicitPolicyEdit === true
    ),
  };
}

function buildPolicyGuardedOutcomeProjectionFromRequestTimeDecisions(input = {}) {
  const projectionInput = asObject(input);
  const unexpectedInputKey = Object.keys(projectionInput).find(key =>
    !REQUEST_TIME_DECISION_INPUT_KEYS.has(key)
  );

  if (unexpectedInputKey) {
    throw new TypeError(
      `Guarded outcome projection accepts only request-time decisions; unsupported input key "${unexpectedInputKey}".`
    );
  }

  const requestTimeDecisions = asArray(projectionInput.requestTimeDecisions);
  const outcomes = [];
  const rejections = [];

  requestTimeDecisions.forEach((decision, index) => {
    const validation = validatePolicyRequestTimeLearningDecision(decision);

    if (!validation.ok) {
      rejections.push({
        decisionIndex: index,
        reasonId: getRejectionReason(decision),
        issueCount: validation.issueCount,
      });
      return;
    }

    outcomes.push(buildProjectedOutcome(decision));
  });

  const summary = buildProjectionSummary({ outcomes, rejections });

  return {
    version: POLICY_GUARDED_OUTCOME_PROJECTION_VERSION,
    statusId: rejections.length > 0
      ? POLICY_GUARDED_OUTCOME_PROJECTION_STATUS_IDS.READY_WITH_REJECTIONS
      : POLICY_GUARDED_OUTCOME_PROJECTION_STATUS_IDS.READY,
    outcomes,
    rejections,
    summary,
  };
}

function validateProjectedOutcome(outcome = {}) {
  const projected = asObject(outcome);
  const evidenceFingerprint = asObject(projected.evidenceFingerprint);
  const learning = asObject(projected.learning);
  const finalOutcome = asObject(projected.finalOutcome);

  return isRecord(projected.evidenceFingerprint) &&
    isRecord(projected.learning) &&
    isRecord(learning.candidate) &&
    isRecord(projected.finalOutcome) &&
    evidenceFingerprint.algorithm === 'sha256' &&
    SHA256_FINGERPRINT_PATTERN.test(evidenceFingerprint.fingerprint) &&
    projected.requestProofFingerprint === evidenceFingerprint.fingerprint &&
    Boolean(normalizeString(learning.decisionId)) &&
    typeof learning.canWriteLearning === 'boolean' &&
    typeof learning.requiresExplicitPolicyEdit === 'boolean' &&
    typeof projected.profileRefreshQueued === 'boolean' &&
    typeof finalOutcome.recorded === 'boolean';
}

function validatePolicyGuardedOutcomeProjection(projection = {}) {
  const guardedOutcomeProjection = asObject(projection);
  const issues = [];

  for (const field of Object.keys(guardedOutcomeProjection)) {
    if (!PROJECTION_FIELDS.has(field)) {
      issues.push({ field, message: 'Guarded outcome projection contains an unsupported field.' });
    }
  }

  if (guardedOutcomeProjection.version !== POLICY_GUARDED_OUTCOME_PROJECTION_VERSION) {
    issues.push({ field: 'version', message: 'Guarded outcome projection must use the current contract version.' });
  }

  if (!Object.values(POLICY_GUARDED_OUTCOME_PROJECTION_STATUS_IDS).includes(guardedOutcomeProjection.statusId)) {
    issues.push({ field: 'statusId', message: 'Guarded outcome projection must use a supported status.' });
  }

  const outcomes = asArray(guardedOutcomeProjection.outcomes);
  const rejections = asArray(guardedOutcomeProjection.rejections);
  if (!Array.isArray(guardedOutcomeProjection.outcomes) || !Array.isArray(guardedOutcomeProjection.rejections)) {
    issues.push({ field: 'outcomes', message: 'Guarded outcome projection must contain normalized outcome arrays.' });
  }

  outcomes.forEach((outcome, index) => {
    if (!validateProjectedOutcome(outcome)) {
      issues.push({ field: `outcomes[${index}]`, message: 'Guarded outcome projection contains an invalid normalized outcome.' });
    }
  });

  rejections.forEach((rejection, index) => {
    const normalizedRejection = asObject(rejection);
    if (!Number.isInteger(normalizedRejection.decisionIndex) ||
        !Object.values(POLICY_GUARDED_OUTCOME_REJECTION_IDS).includes(normalizedRejection.reasonId) ||
        !Number.isInteger(normalizedRejection.issueCount) || normalizedRejection.issueCount < 1) {
      issues.push({ field: `rejections[${index}]`, message: 'Guarded outcome projection contains an invalid bounded rejection.' });
    }
  });

  const expectedSummary = buildProjectionSummary({ outcomes, rejections });
  const summary = asObject(guardedOutcomeProjection.summary);
  for (const [field, value] of Object.entries(expectedSummary)) {
    if (summary[field] !== value) {
      issues.push({ field: `summary.${field}`, message: 'Guarded outcome projection summary must match normalized outcomes.' });
    }
  }

  const expectedStatus = rejections.length > 0
    ? POLICY_GUARDED_OUTCOME_PROJECTION_STATUS_IDS.READY_WITH_REJECTIONS
    : POLICY_GUARDED_OUTCOME_PROJECTION_STATUS_IDS.READY;
  if (guardedOutcomeProjection.statusId !== expectedStatus) {
    issues.push({ field: 'statusId', message: 'Guarded outcome projection status must match rejection state.' });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  POLICY_GUARDED_OUTCOME_PROJECTION_STATUS_IDS,
  POLICY_GUARDED_OUTCOME_PROJECTION_VERSION,
  POLICY_GUARDED_OUTCOME_REJECTION_IDS,
  buildPolicyGuardedOutcomeProjectionFromRequestTimeDecisions,
  validatePolicyGuardedOutcomeProjection,
};
