import {
  ANSWER_OUTCOME_IDS,
  QUESTION_FRAME_IDS,
  REJECTED_QUESTION_FRAME_IDS,
  getAcceptableQuestionFrame,
  normalizeQuestionFrame,
} from './policyQuestionLearningVocabulary.mjs';
import {
  POLICY_AUTOMATION_DECISION_ACTION_IDS,
  POLICY_AUTOMATION_DECISION_REASON_IDS,
  POLICY_AUTOMATION_DECISION_STATE_IDS,
  buildPolicyAutomationDecisionFromRuntimeInput,
  validatePolicyAutomationDecision,
} from './policyAutomationDecisionContract.mjs';

const POLICY_RUNTIME_QUESTION_DISPOSITION_IDS = Object.freeze({
  SUPPRESS_QUESTION: 'suppress_question',
  CREATE_OPERATOR_QUESTION: 'create_operator_question',
  CONFIGURE_ROUTING: 'configure_routing',
  REFRESH_PROFILE: 'refresh_profile',
  BLOCK_AUTOMATION: 'block_automation',
  GATHER_EVIDENCE: 'gather_evidence',
  STALE_QUESTION_CLEANUP: 'stale_question_cleanup',
});

const POLICY_RUNTIME_QUESTION_REASON_IDS = Object.freeze({
  AUTO_ROUTE_DOES_NOT_NEED_QUESTION: 'auto_route_does_not_need_question',
  CLASSIFIED_NOT_ROUTED_NEEDS_ROUTING: 'classified_not_routed_needs_routing',
  HARD_LIMIT_REVIEW_REQUIRED: 'hard_limit_review_required',
  OPERATOR_REVIEW_REQUIRED: 'operator_review_required',
  ROUTING_MAPPING_REQUIRED: 'routing_mapping_required',
  PROFILE_REFRESH_REQUIRED: 'profile_refresh_required',
  MISSING_EVIDENCE_REVIEW_REQUIRED: 'missing_evidence_review_required',
  STALE_OR_LEGACY_QUESTION_REQUIRES_CLEANUP: 'stale_or_legacy_question_requires_cleanup',
  REJECTED_LEGACY_FRAME_REWRITTEN: 'rejected_legacy_frame_rewritten',
  UNSUPPORTED_FRAME_REWRITTEN: 'unsupported_frame_rewritten',
});

const POLICY_RUNTIME_QUESTION_AUDIT_RISK_IDS = Object.freeze({
  UNKNOWN_DISPOSITION: 'unknown_disposition',
  QUESTION_WITHOUT_FRAME: 'question_without_frame',
  QUESTION_WITH_REJECTED_FRAME: 'question_with_rejected_frame',
  QUESTION_WITHOUT_LEARNING_METADATA: 'question_without_learning_metadata',
  QUESTION_WITH_LEARNING_ENABLED: 'question_with_learning_enabled',
  QUESTION_WITH_SIDE_EFFECT: 'question_with_side_effect',
  QUESTION_FOR_AUTO_ROUTE: 'question_for_auto_route',
  ROUTING_GAP_AS_OPERATOR_QUESTION: 'routing_gap_as_operator_question',
  STALE_QUESTION_NOT_CLEANED: 'stale_question_not_cleaned',
  MISSING_TRACE_REASON: 'missing_trace_reason',
  AUTOMATION_DECISION_INVALID: 'automation_decision_invalid',
  MISSING_AUTOMATION_DECISION_VALIDATION: 'missing_automation_decision_validation',
  AUTOMATION_DECISION_VALIDATION_MISMATCH: 'automation_decision_validation_mismatch',
  TRACE_DECISION_VALID_MISMATCH: 'trace_decision_valid_mismatch',
  MISSING_DECISION_EVIDENCE_FINGERPRINT: 'missing_decision_evidence_fingerprint',
  MISSING_QUESTION_EVIDENCE_FINGERPRINT: 'missing_question_evidence_fingerprint',
  MISSING_TRACE_EVIDENCE_FINGERPRINT: 'missing_trace_evidence_fingerprint',
  QUESTION_FINGERPRINT_MISMATCH: 'question_fingerprint_mismatch',
  TRACE_FINGERPRINT_MISMATCH: 'trace_fingerprint_mismatch',
});

const QUESTION_CONTRACT_VERSION = 'policy.runtime_question_reduction.v1';
const MAX_TRACE_REASONS = 10;
const DECISION_EVIDENCE_FINGERPRINT_TRACE_ATTRIBUTE =
  'classifarr.runtime.question.decision_evidence_projection_fingerprint';
const DECISION_VALID_TRACE_ATTRIBUTE =
  'classifarr.runtime.question.decision_valid';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeFrameOverride(input = {}) {
  const requestedFrameId = input.requestedQuestionFrameId ||
    input.legacyQuestionFrameId ||
    input.question?.frameId ||
    input.existingQuestion?.frameId ||
    null;

  if (!requestedFrameId) {
    return {
      requestedFrameId: null,
      accepted: true,
      replacementFrameId: null,
      rejectionReason: null,
      reasonId: null,
    };
  }

  const normalized = normalizeQuestionFrame(requestedFrameId);

  if (normalized.accepted) {
    return {
      requestedFrameId,
      accepted: true,
      replacementFrameId: null,
      rejectionReason: null,
      reasonId: null,
    };
  }

  return {
    requestedFrameId,
    accepted: false,
    replacementFrameId: normalized.replacementFrameId || QUESTION_FRAME_IDS.MISSING_EVIDENCE,
    rejectionReason: normalized.rejectionReason,
    reasonId: normalized.frameId
      ? POLICY_RUNTIME_QUESTION_REASON_IDS.REJECTED_LEGACY_FRAME_REWRITTEN
      : POLICY_RUNTIME_QUESTION_REASON_IDS.UNSUPPORTED_FRAME_REWRITTEN,
  };
}

function hasStaleOrLegacyQuestion(input = {}) {
  const existingQuestion = asObject(input.existingQuestion);
  const contractVersion = normalizeString(existingQuestion.contractVersion || existingQuestion.version);

  if (!Object.keys(existingQuestion).length) return false;

  return existingQuestion.stale === true ||
    existingQuestion.cleanupRequired === true ||
    (contractVersion && contractVersion !== QUESTION_CONTRACT_VERSION);
}

function getDecisionReasonIds(decision = {}) {
  return asArray(decision.trace?.reasons).map(reason => reason?.reasonId).filter(Boolean);
}

function chooseFrameForDecision(decision = {}, frameOverride = {}) {
  if (frameOverride.accepted === false && frameOverride.replacementFrameId) {
    return frameOverride.replacementFrameId;
  }

  const reasonIds = new Set(getDecisionReasonIds(decision));

  switch (decision.stateId) {
    case POLICY_AUTOMATION_DECISION_STATE_IDS.BLOCKED_BY_HARD_LIMIT:
      return QUESTION_FRAME_IDS.HARD_LIMIT_CONFLICT;
    case POLICY_AUTOMATION_DECISION_STATE_IDS.CLASSIFIED_NOT_ROUTED:
    case POLICY_AUTOMATION_DECISION_STATE_IDS.NEEDS_ROUTING_MAPPING:
      return QUESTION_FRAME_IDS.ROUTING_GAP;
    case POLICY_AUTOMATION_DECISION_STATE_IDS.STALE_PROFILE_RETRY:
      return QUESTION_FRAME_IDS.STALE_PROFILE;
    case POLICY_AUTOMATION_DECISION_STATE_IDS.INSUFFICIENT_EVIDENCE:
      return QUESTION_FRAME_IDS.MISSING_EVIDENCE;
    case POLICY_AUTOMATION_DECISION_STATE_IDS.NEEDS_OPERATOR_REVIEW:
      if (reasonIds.has(POLICY_AUTOMATION_DECISION_REASON_IDS.RUNTIME_EVIDENCE_INVALID)) {
        return QUESTION_FRAME_IDS.MISSING_EVIDENCE;
      }
      if (
        reasonIds.has(POLICY_AUTOMATION_DECISION_REASON_IDS.AVOID_RULE_CONFLICT) ||
        reasonIds.has(POLICY_AUTOMATION_DECISION_REASON_IDS.HIGH_RISK_EVIDENCE_CONFLICT)
      ) {
        return QUESTION_FRAME_IDS.OUTLIER_REVIEW;
      }
      return QUESTION_FRAME_IDS.DESTINATION_FIT;
    default:
      return QUESTION_FRAME_IDS.DESTINATION_FIT;
  }
}

function buildLearningMetadata({
  frameId,
  staleQuestionCleanupRequired = false,
}) {
  const frame = getAcceptableQuestionFrame(frameId);

  return {
    eligible: false,
    requiresLearningGuard: false,
    allowedOutcomeIds: [
      ANSWER_OUTCOME_IDS.RESOLVE_CURRENT_ITEM,
      ANSWER_OUTCOME_IDS.DO_NOT_LEARN,
    ],
    defaultOutcomeId: ANSWER_OUTCOME_IDS.RESOLVE_CURRENT_ITEM,
    reason: staleQuestionCleanupRequired
      ? POLICY_RUNTIME_QUESTION_REASON_IDS.STALE_OR_LEGACY_QUESTION_REQUIRES_CLEANUP
      : 'phase7r_questions_resolve_current_item_only',
    frameLearningEligibleByDefault: frame?.learningEligibleByDefault === true,
  };
}

function buildQuestion({
  frameId,
  decision,
  reasonId,
  decisionEvidenceFingerprint,
  stale = false,
}) {
  const frame = getAcceptableQuestionFrame(frameId);

  if (!frame) return null;

  return {
    contractVersion: QUESTION_CONTRACT_VERSION,
    frameId,
    operatorQuestion: frame.operatorQuestion,
    reasonId,
    decisionStateId: decision.stateId,
    decisionEvidenceFingerprint,
    stale,
    learning: buildLearningMetadata({ frameId }),
    options: [
      {
        outcomeId: ANSWER_OUTCOME_IDS.RESOLVE_CURRENT_ITEM,
        label: 'Resolve current item',
        learningEligible: false,
      },
      {
        outcomeId: ANSWER_OUTCOME_IDS.DO_NOT_LEARN,
        label: 'Do not learn',
        learningEligible: false,
      },
    ],
  };
}

function sanitizeDecisionEvidenceFingerprint(decision = {}) {
  const projectionFingerprint = decision.evidence?.projectionFingerprint;
  const provenance = asObject(projectionFingerprint?.provenance);

  if (!normalizeString(projectionFingerprint?.fingerprint)) return null;

  return {
    algorithm: normalizeString(projectionFingerprint.algorithm) || null,
    fingerprint: normalizeString(projectionFingerprint.fingerprint),
    provenance: {
      projectionVersion: normalizeString(provenance.projectionVersion) || null,
      evidenceVersion: normalizeString(provenance.evidenceVersion) || null,
      totalEntryCount: Number.isFinite(Number(provenance.totalEntryCount))
        ? Number(provenance.totalEntryCount)
        : 0,
      sourceIds: asArray(provenance.sourceIds).map(String).sort(),
      runtimeSourceIds: asArray(provenance.runtimeSourceIds).map(String).sort(),
      authoritySourceIds: asArray(provenance.authoritySourceIds).map(String).sort(),
      demotionReasonIds: asArray(provenance.demotionReasonIds).map(String).sort(),
      warningReasonIds: asArray(provenance.warningReasonIds).map(String).sort(),
      bucketCounts: asArray(provenance.bucketCounts)
        .map(bucket => ({
          bucketId: normalizeString(bucket?.bucketId) || null,
          entryCount: Number.isFinite(Number(bucket?.entryCount))
            ? Number(bucket.entryCount)
            : 0,
        }))
        .sort((left, right) => String(left.bucketId).localeCompare(String(right.bucketId))),
    },
  };
}

function buildTrace(
  dispositionId,
  reasons,
  decision,
  decisionValidation,
  decisionEvidenceFingerprint
) {
  const boundedReasons = reasons.slice(0, MAX_TRACE_REASONS);
  const attributes = {
    'classifarr.runtime.question.version': QUESTION_CONTRACT_VERSION,
    'classifarr.runtime.question.disposition': dispositionId,
    'classifarr.runtime.question.reason_count': boundedReasons.length,
    'classifarr.runtime.question.decision_state': decision.stateId,
    'classifarr.runtime.question.created': dispositionId === POLICY_RUNTIME_QUESTION_DISPOSITION_IDS.CREATE_OPERATOR_QUESTION,
    [DECISION_VALID_TRACE_ATTRIBUTE]: decisionValidation.ok,
  };

  if (decisionEvidenceFingerprint?.fingerprint) {
    attributes[DECISION_EVIDENCE_FINGERPRINT_TRACE_ATTRIBUTE] =
      decisionEvidenceFingerprint.fingerprint;
  }

  return {
    attributes,
    reasons: boundedReasons,
    truncated: reasons.length > boundedReasons.length,
  };
}

function buildReason(reasonId, {
  frameId = null,
  summary,
  severity = 'info',
} = {}) {
  return {
    reasonId,
    frameId,
    summary,
    severity,
  };
}

function getBaseDisposition(decision = {}) {
  switch (decision.stateId) {
    case POLICY_AUTOMATION_DECISION_STATE_IDS.AUTO_ROUTE_READY:
      return {
        dispositionId: POLICY_RUNTIME_QUESTION_DISPOSITION_IDS.SUPPRESS_QUESTION,
        createQuestion: false,
        reasonId: POLICY_RUNTIME_QUESTION_REASON_IDS.AUTO_ROUTE_DOES_NOT_NEED_QUESTION,
        nextActionId: POLICY_AUTOMATION_DECISION_ACTION_IDS.ROUTE_TO_ARR,
        frameId: null,
      };
    case POLICY_AUTOMATION_DECISION_STATE_IDS.CLASSIFIED_NOT_ROUTED:
      return {
        dispositionId: POLICY_RUNTIME_QUESTION_DISPOSITION_IDS.CONFIGURE_ROUTING,
        createQuestion: false,
        reasonId: POLICY_RUNTIME_QUESTION_REASON_IDS.CLASSIFIED_NOT_ROUTED_NEEDS_ROUTING,
        nextActionId: POLICY_AUTOMATION_DECISION_ACTION_IDS.CONFIGURE_ROUTING,
        frameId: QUESTION_FRAME_IDS.ROUTING_GAP,
      };
    case POLICY_AUTOMATION_DECISION_STATE_IDS.NEEDS_ROUTING_MAPPING:
      return {
        dispositionId: POLICY_RUNTIME_QUESTION_DISPOSITION_IDS.CONFIGURE_ROUTING,
        createQuestion: false,
        reasonId: POLICY_RUNTIME_QUESTION_REASON_IDS.ROUTING_MAPPING_REQUIRED,
        nextActionId: POLICY_AUTOMATION_DECISION_ACTION_IDS.CONFIGURE_ROUTING,
        frameId: QUESTION_FRAME_IDS.ROUTING_GAP,
      };
    case POLICY_AUTOMATION_DECISION_STATE_IDS.STALE_PROFILE_RETRY:
      return {
        dispositionId: POLICY_RUNTIME_QUESTION_DISPOSITION_IDS.REFRESH_PROFILE,
        createQuestion: false,
        reasonId: POLICY_RUNTIME_QUESTION_REASON_IDS.PROFILE_REFRESH_REQUIRED,
        nextActionId: POLICY_AUTOMATION_DECISION_ACTION_IDS.REFRESH_PROFILE,
        frameId: QUESTION_FRAME_IDS.STALE_PROFILE,
      };
    case POLICY_AUTOMATION_DECISION_STATE_IDS.BLOCKED_BY_HARD_LIMIT:
      return {
        dispositionId: POLICY_RUNTIME_QUESTION_DISPOSITION_IDS.CREATE_OPERATOR_QUESTION,
        createQuestion: true,
        reasonId: POLICY_RUNTIME_QUESTION_REASON_IDS.HARD_LIMIT_REVIEW_REQUIRED,
        nextActionId: POLICY_AUTOMATION_DECISION_ACTION_IDS.ASK_OPERATOR,
        frameId: QUESTION_FRAME_IDS.HARD_LIMIT_CONFLICT,
      };
    case POLICY_AUTOMATION_DECISION_STATE_IDS.NEEDS_OPERATOR_REVIEW:
      return {
        dispositionId: POLICY_RUNTIME_QUESTION_DISPOSITION_IDS.CREATE_OPERATOR_QUESTION,
        createQuestion: true,
        reasonId: POLICY_RUNTIME_QUESTION_REASON_IDS.OPERATOR_REVIEW_REQUIRED,
        nextActionId: POLICY_AUTOMATION_DECISION_ACTION_IDS.ASK_OPERATOR,
        frameId: chooseFrameForDecision(decision),
      };
    case POLICY_AUTOMATION_DECISION_STATE_IDS.INSUFFICIENT_EVIDENCE:
      return {
        dispositionId: POLICY_RUNTIME_QUESTION_DISPOSITION_IDS.CREATE_OPERATOR_QUESTION,
        createQuestion: true,
        reasonId: POLICY_RUNTIME_QUESTION_REASON_IDS.MISSING_EVIDENCE_REVIEW_REQUIRED,
        nextActionId: POLICY_AUTOMATION_DECISION_ACTION_IDS.ASK_OPERATOR,
        frameId: QUESTION_FRAME_IDS.MISSING_EVIDENCE,
      };
    default:
      return {
        dispositionId: POLICY_RUNTIME_QUESTION_DISPOSITION_IDS.GATHER_EVIDENCE,
        createQuestion: false,
        reasonId: POLICY_RUNTIME_QUESTION_REASON_IDS.MISSING_EVIDENCE_REVIEW_REQUIRED,
        nextActionId: POLICY_AUTOMATION_DECISION_ACTION_IDS.GATHER_EVIDENCE,
        frameId: QUESTION_FRAME_IDS.MISSING_EVIDENCE,
      };
  }
}

function buildPolicyRuntimeQuestionReduction(input = {}) {
  const decision = input.automationDecision?.version === 'policy.automation_decision.v1'
    ? input.automationDecision
    : buildPolicyAutomationDecisionFromRuntimeInput(input);
  const decisionValidation = validatePolicyAutomationDecision(decision);
  const decisionEvidenceFingerprint = sanitizeDecisionEvidenceFingerprint(decision);
  const frameOverride = normalizeFrameOverride(input);
  const reasons = [];

  if (frameOverride.reasonId) {
    reasons.push(buildReason(frameOverride.reasonId, {
      frameId: frameOverride.replacementFrameId,
      severity: 'warning',
      summary: frameOverride.rejectionReason || 'Question frame was rewritten before persistence.',
    }));
  }

  if (hasStaleOrLegacyQuestion(input)) {
    const frameId = QUESTION_FRAME_IDS.STALE_PROFILE;
    const dispositionId = POLICY_RUNTIME_QUESTION_DISPOSITION_IDS.STALE_QUESTION_CLEANUP;
    reasons.push(buildReason(POLICY_RUNTIME_QUESTION_REASON_IDS.STALE_OR_LEGACY_QUESTION_REQUIRES_CLEANUP, {
      frameId,
      severity: 'warning',
      summary: 'Existing stale or legacy pending question must be cleaned before answering or learning.',
    }));

    return {
      version: QUESTION_CONTRACT_VERSION,
      dispositionId,
      createQuestion: false,
      nextAction: {
        actionId: 'cleanup_stale_question',
        label: 'Clean up stale question',
        target: 'pending_question_cleanup',
      },
      decision,
      decisionValidation,
      decisionEvidenceFingerprint,
      question: null,
      proposedFrameId: frameId,
      rejectedFrame: frameOverride.accepted === false ? frameOverride : null,
      staleQuestionCleanup: {
        required: true,
        existingQuestionId: input.existingQuestion?.id ?? null,
      },
      learning: buildLearningMetadata({
        frameId,
        staleQuestionCleanupRequired: true,
      }),
      trace: buildTrace(
        dispositionId,
        reasons,
        decision,
        decisionValidation,
        decisionEvidenceFingerprint
      ),
    };
  }

  const baseDisposition = getBaseDisposition(decision);
  const frameId = baseDisposition.createQuestion
    ? chooseFrameForDecision(decision, frameOverride)
    : baseDisposition.frameId;

  reasons.push(buildReason(baseDisposition.reasonId, {
    frameId,
    summary: baseDisposition.createQuestion
      ? 'Runtime decision requires a bounded operator question.'
      : 'Runtime decision does not require a persisted operator question.',
    severity: baseDisposition.createQuestion ? 'warning' : 'info',
  }));

  const question = baseDisposition.createQuestion
    ? buildQuestion({
      frameId,
      decision,
      reasonId: baseDisposition.reasonId,
      decisionEvidenceFingerprint,
    })
    : null;

  return {
    version: QUESTION_CONTRACT_VERSION,
    dispositionId: baseDisposition.dispositionId,
    createQuestion: baseDisposition.createQuestion,
    nextAction: {
      actionId: baseDisposition.nextActionId,
      label: getNextActionLabel(baseDisposition.nextActionId),
      target: frameId,
    },
    decision,
    decisionValidation,
    decisionEvidenceFingerprint,
    question,
    proposedFrameId: frameId,
    rejectedFrame: frameOverride.accepted === false ? frameOverride : null,
    staleQuestionCleanup: {
      required: false,
      existingQuestionId: input.existingQuestion?.id ?? null,
    },
    learning: buildLearningMetadata({ frameId: frameId || QUESTION_FRAME_IDS.DESTINATION_FIT }),
    trace: buildTrace(
      baseDisposition.dispositionId,
      reasons,
      decision,
      decisionValidation,
      decisionEvidenceFingerprint
    ),
  };
}

function getNextActionLabel(actionId) {
  switch (actionId) {
    case POLICY_AUTOMATION_DECISION_ACTION_IDS.ROUTE_TO_ARR:
      return 'Route automatically';
    case POLICY_AUTOMATION_DECISION_ACTION_IDS.CONFIGURE_ROUTING:
      return 'Configure routing';
    case POLICY_AUTOMATION_DECISION_ACTION_IDS.REFRESH_PROFILE:
      return 'Refresh profile';
    case POLICY_AUTOMATION_DECISION_ACTION_IDS.ASK_OPERATOR:
      return 'Ask operator';
    case POLICY_AUTOMATION_DECISION_ACTION_IDS.BLOCK_AUTOMATION:
      return 'Block automation';
    default:
      return 'Gather evidence';
  }
}

function validatePolicyRuntimeQuestionReduction(plan = {}) {
  const issues = [];
  const dispositionIds = Object.values(POLICY_RUNTIME_QUESTION_DISPOSITION_IDS);
  const questionFrame = plan.question?.frameId;
  const normalizedQuestionFrame = questionFrame ? normalizeQuestionFrame(questionFrame) : null;
  const decisionValidation = validatePolicyAutomationDecision(asObject(plan.decision));
  const carriedDecisionValidation = plan.decisionValidation;
  const hasCarriedDecisionValidation = carriedDecisionValidation &&
    typeof carriedDecisionValidation === 'object' &&
    typeof carriedDecisionValidation.ok === 'boolean';
  const planFingerprint = normalizeString(plan.decisionEvidenceFingerprint?.fingerprint);
  const questionFingerprint = normalizeString(plan.question?.decisionEvidenceFingerprint?.fingerprint);
  const traceFingerprint = normalizeString(
    plan.trace?.attributes?.[DECISION_EVIDENCE_FINGERPRINT_TRACE_ATTRIBUTE]
  );
  const traceDecisionValid =
    plan.trace?.attributes?.[DECISION_VALID_TRACE_ATTRIBUTE];

  if (!dispositionIds.includes(plan.dispositionId)) {
    issues.push({
      riskId: POLICY_RUNTIME_QUESTION_AUDIT_RISK_IDS.UNKNOWN_DISPOSITION,
      message: 'Runtime question reduction must use a supported disposition.',
    });
  }

  if (!hasCarriedDecisionValidation) {
    issues.push({
      riskId: POLICY_RUNTIME_QUESTION_AUDIT_RISK_IDS
        .MISSING_AUTOMATION_DECISION_VALIDATION,
      message: 'Runtime question reduction must carry the automation decision validation result.',
    });
  } else if (carriedDecisionValidation.ok !== decisionValidation.ok) {
    issues.push({
      riskId: POLICY_RUNTIME_QUESTION_AUDIT_RISK_IDS
        .AUTOMATION_DECISION_VALIDATION_MISMATCH,
      message: 'Runtime question reduction validation must match the embedded automation decision.',
    });
  }

  if (hasCarriedDecisionValidation && traceDecisionValid !== carriedDecisionValidation.ok) {
    issues.push({
      riskId: POLICY_RUNTIME_QUESTION_AUDIT_RISK_IDS.TRACE_DECISION_VALID_MISMATCH,
      message: 'Runtime question trace decision-valid attribute must match the decision validation result.',
    });
  }

  if (carriedDecisionValidation?.ok === false || !decisionValidation.ok) {
    issues.push({
      riskId: POLICY_RUNTIME_QUESTION_AUDIT_RISK_IDS.AUTOMATION_DECISION_INVALID,
      message: 'Runtime question reduction cannot rely on an invalid automation decision.',
    });
  }

  if (!planFingerprint) {
    issues.push({
      riskId: POLICY_RUNTIME_QUESTION_AUDIT_RISK_IDS.MISSING_DECISION_EVIDENCE_FINGERPRINT,
      message: 'Runtime question reduction must carry the automation decision evidence fingerprint.',
    });
  }

  if (plan.createQuestion === true && !questionFingerprint) {
    issues.push({
      riskId: POLICY_RUNTIME_QUESTION_AUDIT_RISK_IDS.MISSING_QUESTION_EVIDENCE_FINGERPRINT,
      message: 'Created runtime questions must carry the decision evidence fingerprint.',
    });
  }

  if (!traceFingerprint) {
    issues.push({
      riskId: POLICY_RUNTIME_QUESTION_AUDIT_RISK_IDS.MISSING_TRACE_EVIDENCE_FINGERPRINT,
      message: 'Runtime question traces must carry the decision evidence fingerprint.',
    });
  }

  if (questionFingerprint && questionFingerprint !== planFingerprint) {
    issues.push({
      riskId: POLICY_RUNTIME_QUESTION_AUDIT_RISK_IDS.QUESTION_FINGERPRINT_MISMATCH,
      message: 'Planned question fingerprint must match the question-reduction plan.',
    });
  }

  if (traceFingerprint && traceFingerprint !== planFingerprint) {
    issues.push({
      riskId: POLICY_RUNTIME_QUESTION_AUDIT_RISK_IDS.TRACE_FINGERPRINT_MISMATCH,
      message: 'Question trace fingerprint must match the question-reduction plan.',
    });
  }

  if (plan.createQuestion === true && !questionFrame) {
    issues.push({
      riskId: POLICY_RUNTIME_QUESTION_AUDIT_RISK_IDS.QUESTION_WITHOUT_FRAME,
      message: 'Created questions must include an approved question frame.',
    });
  }

  if (questionFrame && normalizedQuestionFrame?.accepted !== true) {
    issues.push({
      riskId: POLICY_RUNTIME_QUESTION_AUDIT_RISK_IDS.QUESTION_WITH_REJECTED_FRAME,
      message: 'Created questions cannot persist rejected or unknown frames.',
    });
  }

  if (plan.createQuestion === true && !plan.question?.learning) {
    issues.push({
      riskId: POLICY_RUNTIME_QUESTION_AUDIT_RISK_IDS.QUESTION_WITHOUT_LEARNING_METADATA,
      message: 'Created questions must include learning eligibility metadata.',
    });
  }

  if (plan.question?.learning?.eligible === true || plan.learning?.eligible === true) {
    issues.push({
      riskId: POLICY_RUNTIME_QUESTION_AUDIT_RISK_IDS.QUESTION_WITH_LEARNING_ENABLED,
      message: 'Runtime questions cannot authorize durable learning directly.',
    });
  }

  asArray(plan.question?.options).forEach(option => {
    if (option.learningEligible === true) {
      issues.push({
        riskId: POLICY_RUNTIME_QUESTION_AUDIT_RISK_IDS.QUESTION_WITH_LEARNING_ENABLED,
        message: 'Question answer options cannot authorize durable learning directly.',
      });
    }
  });

  if (
    plan.decision?.stateId === POLICY_AUTOMATION_DECISION_STATE_IDS.AUTO_ROUTE_READY &&
    plan.createQuestion === true
  ) {
    issues.push({
      riskId: POLICY_RUNTIME_QUESTION_AUDIT_RISK_IDS.QUESTION_FOR_AUTO_ROUTE,
      message: 'Auto-route-ready decisions must not create operator questions.',
    });
  }

  if (
    [
      POLICY_AUTOMATION_DECISION_STATE_IDS.CLASSIFIED_NOT_ROUTED,
      POLICY_AUTOMATION_DECISION_STATE_IDS.NEEDS_ROUTING_MAPPING,
    ].includes(plan.decision?.stateId) &&
    plan.createQuestion === true
  ) {
    issues.push({
      riskId: POLICY_RUNTIME_QUESTION_AUDIT_RISK_IDS.ROUTING_GAP_AS_OPERATOR_QUESTION,
      message: 'Routing gaps should create routing actions, not persisted classification questions.',
    });
  }

  if (
    plan.staleQuestionCleanup?.required === true &&
    plan.dispositionId !== POLICY_RUNTIME_QUESTION_DISPOSITION_IDS.STALE_QUESTION_CLEANUP
  ) {
    issues.push({
      riskId: POLICY_RUNTIME_QUESTION_AUDIT_RISK_IDS.STALE_QUESTION_NOT_CLEANED,
      message: 'Stale or legacy pending questions must be routed through cleanup.',
    });
  }

  if (asArray(plan.trace?.reasons).length === 0) {
    issues.push({
      riskId: POLICY_RUNTIME_QUESTION_AUDIT_RISK_IDS.MISSING_TRACE_REASON,
      message: 'Runtime question reduction must include bounded trace reasons.',
    });
  }

  if (
    plan.sideEffects?.questionCreated === true ||
    plan.sideEffects?.learningWritten === true ||
    plan.questionCreated === true ||
    plan.learningWritten === true
  ) {
    issues.push({
      riskId: POLICY_RUNTIME_QUESTION_AUDIT_RISK_IDS.QUESTION_WITH_SIDE_EFFECT,
      message: 'Runtime question reduction can plan questions but cannot persist them.',
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function buildPolicyRuntimeQuestionReductionAudit(
  plan = buildPolicyRuntimeQuestionReduction()
) {
  const validation = validatePolicyRuntimeQuestionReduction(plan);

  return {
    ok: validation.ok,
    issueCount: validation.issueCount,
    checkedDispositionCount: Object.values(POLICY_RUNTIME_QUESTION_DISPOSITION_IDS).length,
    checkedRejectedFrameCount: Object.values(REJECTED_QUESTION_FRAME_IDS).length,
    validation,
    nextStep: {
      stepId: 'request_time_learning',
      label: 'Request-Time Learning And Destination Selection',
      reason: 'Runtime questions are now bounded and rare enough for request/manual destination choices to pass through the learning guard instead of mutating policy directly.',
    },
  };
}

export {
  POLICY_RUNTIME_QUESTION_AUDIT_RISK_IDS,
  POLICY_RUNTIME_QUESTION_DISPOSITION_IDS,
  POLICY_RUNTIME_QUESTION_REASON_IDS,
  buildPolicyRuntimeQuestionReduction,
  buildPolicyRuntimeQuestionReductionAudit,
  validatePolicyRuntimeQuestionReduction,
};
