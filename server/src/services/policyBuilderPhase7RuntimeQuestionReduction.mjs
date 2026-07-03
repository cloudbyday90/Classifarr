import {
  ANSWER_OUTCOME_IDS,
  QUESTION_FRAME_IDS,
  REJECTED_QUESTION_FRAME_IDS,
  getAcceptableQuestionFrame,
  normalizeQuestionFrame,
} from './policyQuestionLearningVocabulary.mjs';
import {
  PHASE7R_AUTOMATION_DECISION_ACTION_IDS,
  PHASE7R_AUTOMATION_DECISION_REASON_IDS,
  PHASE7R_AUTOMATION_DECISION_STATE_IDS,
  buildPolicyBuilderPhase7AutomationDecision,
  validatePolicyBuilderPhase7AutomationDecision,
} from './policyBuilderPhase7AutomationDecisionContract.mjs';

const PHASE7R_RUNTIME_QUESTION_DISPOSITION_IDS = Object.freeze({
  SUPPRESS_QUESTION: 'suppress_question',
  CREATE_OPERATOR_QUESTION: 'create_operator_question',
  CONFIGURE_ROUTING: 'configure_routing',
  REFRESH_PROFILE: 'refresh_profile',
  BLOCK_AUTOMATION: 'block_automation',
  GATHER_EVIDENCE: 'gather_evidence',
  STALE_QUESTION_CLEANUP: 'stale_question_cleanup',
});

const PHASE7R_RUNTIME_QUESTION_REASON_IDS = Object.freeze({
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

const PHASE7R_RUNTIME_QUESTION_AUDIT_RISK_IDS = Object.freeze({
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
  MISSING_DECISION_EVIDENCE_FINGERPRINT: 'missing_decision_evidence_fingerprint',
  QUESTION_FINGERPRINT_MISMATCH: 'question_fingerprint_mismatch',
  TRACE_FINGERPRINT_MISMATCH: 'trace_fingerprint_mismatch',
});

const QUESTION_CONTRACT_VERSION = 'phase7r.runtime_question_reduction.v1';
const MAX_TRACE_REASONS = 10;
const DECISION_EVIDENCE_FINGERPRINT_TRACE_ATTRIBUTE =
  'classifarr.runtime.question.decision_evidence_projection_fingerprint';

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
      ? PHASE7R_RUNTIME_QUESTION_REASON_IDS.REJECTED_LEGACY_FRAME_REWRITTEN
      : PHASE7R_RUNTIME_QUESTION_REASON_IDS.UNSUPPORTED_FRAME_REWRITTEN,
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
    case PHASE7R_AUTOMATION_DECISION_STATE_IDS.BLOCKED_BY_HARD_LIMIT:
      return QUESTION_FRAME_IDS.HARD_LIMIT_CONFLICT;
    case PHASE7R_AUTOMATION_DECISION_STATE_IDS.CLASSIFIED_NOT_ROUTED:
    case PHASE7R_AUTOMATION_DECISION_STATE_IDS.NEEDS_ROUTING_MAPPING:
      return QUESTION_FRAME_IDS.ROUTING_GAP;
    case PHASE7R_AUTOMATION_DECISION_STATE_IDS.STALE_PROFILE_RETRY:
      return QUESTION_FRAME_IDS.STALE_PROFILE;
    case PHASE7R_AUTOMATION_DECISION_STATE_IDS.INSUFFICIENT_EVIDENCE:
      return QUESTION_FRAME_IDS.MISSING_EVIDENCE;
    case PHASE7R_AUTOMATION_DECISION_STATE_IDS.NEEDS_OPERATOR_REVIEW:
      if (reasonIds.has(PHASE7R_AUTOMATION_DECISION_REASON_IDS.RUNTIME_EVIDENCE_INVALID)) {
        return QUESTION_FRAME_IDS.MISSING_EVIDENCE;
      }
      if (
        reasonIds.has(PHASE7R_AUTOMATION_DECISION_REASON_IDS.AVOID_RULE_CONFLICT) ||
        reasonIds.has(PHASE7R_AUTOMATION_DECISION_REASON_IDS.HIGH_RISK_EVIDENCE_CONFLICT)
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
      ? PHASE7R_RUNTIME_QUESTION_REASON_IDS.STALE_OR_LEGACY_QUESTION_REQUIRES_CLEANUP
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
      phase6EvidenceVersion: normalizeString(provenance.phase6EvidenceVersion) || null,
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

function buildTrace(dispositionId, reasons, decision, decisionEvidenceFingerprint) {
  const boundedReasons = reasons.slice(0, MAX_TRACE_REASONS);
  const attributes = {
    'classifarr.runtime.question.version': QUESTION_CONTRACT_VERSION,
    'classifarr.runtime.question.disposition': dispositionId,
    'classifarr.runtime.question.reason_count': boundedReasons.length,
    'classifarr.runtime.question.decision_state': decision.stateId,
    'classifarr.runtime.question.created': dispositionId === PHASE7R_RUNTIME_QUESTION_DISPOSITION_IDS.CREATE_OPERATOR_QUESTION,
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
    case PHASE7R_AUTOMATION_DECISION_STATE_IDS.AUTO_ROUTE_READY:
      return {
        dispositionId: PHASE7R_RUNTIME_QUESTION_DISPOSITION_IDS.SUPPRESS_QUESTION,
        createQuestion: false,
        reasonId: PHASE7R_RUNTIME_QUESTION_REASON_IDS.AUTO_ROUTE_DOES_NOT_NEED_QUESTION,
        nextActionId: PHASE7R_AUTOMATION_DECISION_ACTION_IDS.ROUTE_TO_ARR,
        frameId: null,
      };
    case PHASE7R_AUTOMATION_DECISION_STATE_IDS.CLASSIFIED_NOT_ROUTED:
      return {
        dispositionId: PHASE7R_RUNTIME_QUESTION_DISPOSITION_IDS.CONFIGURE_ROUTING,
        createQuestion: false,
        reasonId: PHASE7R_RUNTIME_QUESTION_REASON_IDS.CLASSIFIED_NOT_ROUTED_NEEDS_ROUTING,
        nextActionId: PHASE7R_AUTOMATION_DECISION_ACTION_IDS.CONFIGURE_ROUTING,
        frameId: QUESTION_FRAME_IDS.ROUTING_GAP,
      };
    case PHASE7R_AUTOMATION_DECISION_STATE_IDS.NEEDS_ROUTING_MAPPING:
      return {
        dispositionId: PHASE7R_RUNTIME_QUESTION_DISPOSITION_IDS.CONFIGURE_ROUTING,
        createQuestion: false,
        reasonId: PHASE7R_RUNTIME_QUESTION_REASON_IDS.ROUTING_MAPPING_REQUIRED,
        nextActionId: PHASE7R_AUTOMATION_DECISION_ACTION_IDS.CONFIGURE_ROUTING,
        frameId: QUESTION_FRAME_IDS.ROUTING_GAP,
      };
    case PHASE7R_AUTOMATION_DECISION_STATE_IDS.STALE_PROFILE_RETRY:
      return {
        dispositionId: PHASE7R_RUNTIME_QUESTION_DISPOSITION_IDS.REFRESH_PROFILE,
        createQuestion: false,
        reasonId: PHASE7R_RUNTIME_QUESTION_REASON_IDS.PROFILE_REFRESH_REQUIRED,
        nextActionId: PHASE7R_AUTOMATION_DECISION_ACTION_IDS.REFRESH_PROFILE,
        frameId: QUESTION_FRAME_IDS.STALE_PROFILE,
      };
    case PHASE7R_AUTOMATION_DECISION_STATE_IDS.BLOCKED_BY_HARD_LIMIT:
      return {
        dispositionId: PHASE7R_RUNTIME_QUESTION_DISPOSITION_IDS.CREATE_OPERATOR_QUESTION,
        createQuestion: true,
        reasonId: PHASE7R_RUNTIME_QUESTION_REASON_IDS.HARD_LIMIT_REVIEW_REQUIRED,
        nextActionId: PHASE7R_AUTOMATION_DECISION_ACTION_IDS.ASK_OPERATOR,
        frameId: QUESTION_FRAME_IDS.HARD_LIMIT_CONFLICT,
      };
    case PHASE7R_AUTOMATION_DECISION_STATE_IDS.NEEDS_OPERATOR_REVIEW:
      return {
        dispositionId: PHASE7R_RUNTIME_QUESTION_DISPOSITION_IDS.CREATE_OPERATOR_QUESTION,
        createQuestion: true,
        reasonId: PHASE7R_RUNTIME_QUESTION_REASON_IDS.OPERATOR_REVIEW_REQUIRED,
        nextActionId: PHASE7R_AUTOMATION_DECISION_ACTION_IDS.ASK_OPERATOR,
        frameId: chooseFrameForDecision(decision),
      };
    case PHASE7R_AUTOMATION_DECISION_STATE_IDS.INSUFFICIENT_EVIDENCE:
      return {
        dispositionId: PHASE7R_RUNTIME_QUESTION_DISPOSITION_IDS.CREATE_OPERATOR_QUESTION,
        createQuestion: true,
        reasonId: PHASE7R_RUNTIME_QUESTION_REASON_IDS.MISSING_EVIDENCE_REVIEW_REQUIRED,
        nextActionId: PHASE7R_AUTOMATION_DECISION_ACTION_IDS.ASK_OPERATOR,
        frameId: QUESTION_FRAME_IDS.MISSING_EVIDENCE,
      };
    default:
      return {
        dispositionId: PHASE7R_RUNTIME_QUESTION_DISPOSITION_IDS.GATHER_EVIDENCE,
        createQuestion: false,
        reasonId: PHASE7R_RUNTIME_QUESTION_REASON_IDS.MISSING_EVIDENCE_REVIEW_REQUIRED,
        nextActionId: PHASE7R_AUTOMATION_DECISION_ACTION_IDS.GATHER_EVIDENCE,
        frameId: QUESTION_FRAME_IDS.MISSING_EVIDENCE,
      };
  }
}

function buildPolicyBuilderPhase7RuntimeQuestionReduction(input = {}) {
  const decision = input.automationDecision?.version === 'phase7r.automation_decision.v1'
    ? input.automationDecision
    : buildPolicyBuilderPhase7AutomationDecision(input);
  const decisionValidation = validatePolicyBuilderPhase7AutomationDecision(decision);
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
    const dispositionId = PHASE7R_RUNTIME_QUESTION_DISPOSITION_IDS.STALE_QUESTION_CLEANUP;
    reasons.push(buildReason(PHASE7R_RUNTIME_QUESTION_REASON_IDS.STALE_OR_LEGACY_QUESTION_REQUIRES_CLEANUP, {
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
      trace: buildTrace(dispositionId, reasons, decision, decisionEvidenceFingerprint),
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
      decisionEvidenceFingerprint
    ),
  };
}

function getNextActionLabel(actionId) {
  switch (actionId) {
    case PHASE7R_AUTOMATION_DECISION_ACTION_IDS.ROUTE_TO_ARR:
      return 'Route automatically';
    case PHASE7R_AUTOMATION_DECISION_ACTION_IDS.CONFIGURE_ROUTING:
      return 'Configure routing';
    case PHASE7R_AUTOMATION_DECISION_ACTION_IDS.REFRESH_PROFILE:
      return 'Refresh profile';
    case PHASE7R_AUTOMATION_DECISION_ACTION_IDS.ASK_OPERATOR:
      return 'Ask operator';
    case PHASE7R_AUTOMATION_DECISION_ACTION_IDS.BLOCK_AUTOMATION:
      return 'Block automation';
    default:
      return 'Gather evidence';
  }
}

function validatePolicyBuilderPhase7RuntimeQuestionReduction(plan = {}) {
  const issues = [];
  const dispositionIds = Object.values(PHASE7R_RUNTIME_QUESTION_DISPOSITION_IDS);
  const questionFrame = plan.question?.frameId;
  const normalizedQuestionFrame = questionFrame ? normalizeQuestionFrame(questionFrame) : null;
  const decisionValidation = validatePolicyBuilderPhase7AutomationDecision(asObject(plan.decision));
  const planFingerprint = normalizeString(plan.decisionEvidenceFingerprint?.fingerprint);
  const questionFingerprint = normalizeString(plan.question?.decisionEvidenceFingerprint?.fingerprint);
  const traceFingerprint = normalizeString(
    plan.trace?.attributes?.[DECISION_EVIDENCE_FINGERPRINT_TRACE_ATTRIBUTE]
  );

  if (!dispositionIds.includes(plan.dispositionId)) {
    issues.push({
      riskId: PHASE7R_RUNTIME_QUESTION_AUDIT_RISK_IDS.UNKNOWN_DISPOSITION,
      message: 'Runtime question reduction must use a supported disposition.',
    });
  }

  if (plan.decisionValidation?.ok === false || !decisionValidation.ok) {
    issues.push({
      riskId: PHASE7R_RUNTIME_QUESTION_AUDIT_RISK_IDS.AUTOMATION_DECISION_INVALID,
      message: 'Runtime question reduction cannot rely on an invalid automation decision.',
    });
  }

  if (!planFingerprint) {
    issues.push({
      riskId: PHASE7R_RUNTIME_QUESTION_AUDIT_RISK_IDS.MISSING_DECISION_EVIDENCE_FINGERPRINT,
      message: 'Runtime question reduction must carry the automation decision evidence fingerprint.',
    });
  }

  if (questionFingerprint && questionFingerprint !== planFingerprint) {
    issues.push({
      riskId: PHASE7R_RUNTIME_QUESTION_AUDIT_RISK_IDS.QUESTION_FINGERPRINT_MISMATCH,
      message: 'Planned question fingerprint must match the question-reduction plan.',
    });
  }

  if (traceFingerprint && traceFingerprint !== planFingerprint) {
    issues.push({
      riskId: PHASE7R_RUNTIME_QUESTION_AUDIT_RISK_IDS.TRACE_FINGERPRINT_MISMATCH,
      message: 'Question trace fingerprint must match the question-reduction plan.',
    });
  }

  if (plan.createQuestion === true && !questionFrame) {
    issues.push({
      riskId: PHASE7R_RUNTIME_QUESTION_AUDIT_RISK_IDS.QUESTION_WITHOUT_FRAME,
      message: 'Created questions must include a Phase 5R question frame.',
    });
  }

  if (questionFrame && normalizedQuestionFrame?.accepted !== true) {
    issues.push({
      riskId: PHASE7R_RUNTIME_QUESTION_AUDIT_RISK_IDS.QUESTION_WITH_REJECTED_FRAME,
      message: 'Created questions cannot persist rejected or unknown frames.',
    });
  }

  if (plan.createQuestion === true && !plan.question?.learning) {
    issues.push({
      riskId: PHASE7R_RUNTIME_QUESTION_AUDIT_RISK_IDS.QUESTION_WITHOUT_LEARNING_METADATA,
      message: 'Created questions must include learning eligibility metadata.',
    });
  }

  if (plan.question?.learning?.eligible === true || plan.learning?.eligible === true) {
    issues.push({
      riskId: PHASE7R_RUNTIME_QUESTION_AUDIT_RISK_IDS.QUESTION_WITH_LEARNING_ENABLED,
      message: 'Phase 7R.4 questions cannot authorize durable learning directly.',
    });
  }

  asArray(plan.question?.options).forEach(option => {
    if (option.learningEligible === true) {
      issues.push({
        riskId: PHASE7R_RUNTIME_QUESTION_AUDIT_RISK_IDS.QUESTION_WITH_LEARNING_ENABLED,
        message: 'Question answer options cannot authorize durable learning directly.',
      });
    }
  });

  if (
    plan.decision?.stateId === PHASE7R_AUTOMATION_DECISION_STATE_IDS.AUTO_ROUTE_READY &&
    plan.createQuestion === true
  ) {
    issues.push({
      riskId: PHASE7R_RUNTIME_QUESTION_AUDIT_RISK_IDS.QUESTION_FOR_AUTO_ROUTE,
      message: 'Auto-route-ready decisions must not create operator questions.',
    });
  }

  if (
    [
      PHASE7R_AUTOMATION_DECISION_STATE_IDS.CLASSIFIED_NOT_ROUTED,
      PHASE7R_AUTOMATION_DECISION_STATE_IDS.NEEDS_ROUTING_MAPPING,
    ].includes(plan.decision?.stateId) &&
    plan.createQuestion === true
  ) {
    issues.push({
      riskId: PHASE7R_RUNTIME_QUESTION_AUDIT_RISK_IDS.ROUTING_GAP_AS_OPERATOR_QUESTION,
      message: 'Routing gaps should create routing actions, not persisted classification questions.',
    });
  }

  if (
    plan.staleQuestionCleanup?.required === true &&
    plan.dispositionId !== PHASE7R_RUNTIME_QUESTION_DISPOSITION_IDS.STALE_QUESTION_CLEANUP
  ) {
    issues.push({
      riskId: PHASE7R_RUNTIME_QUESTION_AUDIT_RISK_IDS.STALE_QUESTION_NOT_CLEANED,
      message: 'Stale or legacy pending questions must be routed through cleanup.',
    });
  }

  if (asArray(plan.trace?.reasons).length === 0) {
    issues.push({
      riskId: PHASE7R_RUNTIME_QUESTION_AUDIT_RISK_IDS.MISSING_TRACE_REASON,
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
      riskId: PHASE7R_RUNTIME_QUESTION_AUDIT_RISK_IDS.QUESTION_WITH_SIDE_EFFECT,
      message: 'Runtime question reduction can plan questions but cannot persist them.',
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function buildPolicyBuilderPhase7RuntimeQuestionReductionAudit(
  plan = buildPolicyBuilderPhase7RuntimeQuestionReduction()
) {
  const validation = validatePolicyBuilderPhase7RuntimeQuestionReduction(plan);

  return {
    ok: validation.ok,
    issueCount: validation.issueCount,
    checkedDispositionCount: Object.values(PHASE7R_RUNTIME_QUESTION_DISPOSITION_IDS).length,
    checkedRejectedFrameCount: Object.values(REJECTED_QUESTION_FRAME_IDS).length,
    validation,
    nextPhase: {
      phaseId: '7r_5',
      label: 'Request-Time Learning And Destination Selection',
      reason: 'Runtime questions are now bounded and rare enough for request/manual destination choices to pass through the learning guard instead of mutating policy directly.',
    },
  };
}

export {
  PHASE7R_RUNTIME_QUESTION_AUDIT_RISK_IDS,
  PHASE7R_RUNTIME_QUESTION_DISPOSITION_IDS,
  PHASE7R_RUNTIME_QUESTION_REASON_IDS,
  buildPolicyBuilderPhase7RuntimeQuestionReduction,
  buildPolicyBuilderPhase7RuntimeQuestionReductionAudit,
  validatePolicyBuilderPhase7RuntimeQuestionReduction,
};
