import {
  AUTHORITY_SOURCE_IDS,
  getPolicyAuthoritySource,
} from './policyAuthorityVocabulary.mjs';
import {
  ANSWER_OUTCOME_IDS,
  QUESTION_FRAME_IDS,
  getAnswerOutcome,
  normalizeQuestionFrame,
} from './policyQuestionLearningVocabulary.mjs';

const PHASE6R_LEARNING_TIER_IDS = Object.freeze({
  NONE: 'none',
  EXACT_ITEM_MEMORY: 'exact_item_memory',
  COMPATIBILITY_EVIDENCE: 'compatibility_evidence',
  IDENTITY_EVIDENCE: 'identity_evidence',
  HARD_LIMIT_EVIDENCE: 'hard_limit_evidence',
});

const PHASE6R_LEARNING_DECISION_IDS = Object.freeze({
  OUTCOME_ONLY: 'outcome_only',
  CANDIDATE: 'candidate',
  POLICY_EDIT_REQUIRED: 'policy_edit_required',
  BLOCKED: 'blocked',
});

const PHASE6R_LEARNING_EVENT_SOURCE_IDS = Object.freeze({
  MANUAL_CLASSIFICATION_CHANGE: 'manual_classification_change',
  OPERATOR_CONFIRMATION: 'operator_confirmation',
  DISCORD_PENDING_ANSWER: 'discord_pending_answer',
  REQUEST_DESTINATION_CHOICE: 'request_destination_choice',
  ARR_ROUTING_OUTCOME: 'arr_routing_outcome',
});

const PHASE6R_LEARNING_REASON_IDS = Object.freeze({
  FINAL_OUTCOME_RECORDED: 'final_outcome_recorded',
  NO_LEARNING_REQUESTED: 'no_learning_requested',
  LEARNING_CANDIDATE_APPROVED: 'learning_candidate_approved',
  EXACT_ITEM_MEMORY_CANDIDATE: 'exact_item_memory_candidate',
  COMPATIBILITY_EVIDENCE_CANDIDATE: 'compatibility_evidence_candidate',
  IDENTITY_EVIDENCE_CANDIDATE: 'identity_evidence_candidate',
  HARD_LIMIT_POLICY_EDIT_REQUIRED: 'hard_limit_policy_edit_required',
  PROFILE_REFRESH_REQUIRED: 'profile_refresh_required',
  STALE_QUESTION_BLOCKED: 'stale_question_blocked',
  AMBIGUOUS_ANSWER_BLOCKED: 'ambiguous_answer_blocked',
  REJECTED_QUESTION_FRAME_BLOCKED: 'rejected_question_frame_blocked',
  AI_EXPLANATION_BLOCKED: 'ai_explanation_blocked',
  BROAD_ONE_OFF_GENRE_BLOCKED: 'broad_one_off_genre_blocked',
  PROVIDER_STATE_BLOCKED: 'provider_state_blocked',
  REPLAY_DIAGNOSTIC_BLOCKED: 'replay_diagnostic_blocked',
  TMDB_DIAGNOSTIC_BLOCKED: 'tmdb_diagnostic_blocked',
  UNKNOWN_ANSWER_OUTCOME_BLOCKED: 'unknown_answer_outcome_blocked',
});

const PHASE6R_LEARNING_GUARD_AUDIT_RISK_IDS = Object.freeze({
  MISSING_FINAL_OUTCOME: 'missing_final_outcome',
  MISSING_LEARNING_DECISION: 'missing_learning_decision',
  UNKNOWN_DECISION: 'unknown_decision',
  UNKNOWN_TIER: 'unknown_tier',
  UNKNOWN_AUTHORITY_SOURCE: 'unknown_authority_source',
  BLOCKED_DECISION_CAN_WRITE: 'blocked_decision_can_write',
  OUTCOME_ONLY_HAS_LEARNING_TIER: 'outcome_only_has_learning_tier',
  HARD_LIMIT_WITHOUT_POLICY_EDIT: 'hard_limit_without_policy_edit',
  DIRECT_WRITE_PERFORMED: 'direct_write_performed',
  PROFILE_REFRESH_WITHOUT_DESTINATION_LEARNING: 'profile_refresh_without_destination_learning',
  MISSING_REASON_CODE: 'missing_reason_code',
});

const BROAD_GENRE_LABELS = Object.freeze([
  'action',
  'adventure',
  'animation',
  'comedy',
  'crime',
  'documentary',
  'drama',
  'family',
  'fantasy',
  'history',
  'horror',
  'music',
  'mystery',
  'reality',
  'romance',
  'science fiction',
  'sci-fi',
  'sport',
  'sports',
  'thriller',
  'war',
  'western',
]);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);

  Object.values(value).forEach(item => {
    deepFreeze(item);
  });

  return value;
}

const PHASE6R_LEARNING_TIER_CONTRACTS = deepFreeze([
  {
    id: PHASE6R_LEARNING_TIER_IDS.NONE,
    label: 'No durable learning',
    canWriteLearning: false,
    destinationEvidenceChanging: false,
    requiresExplicitPolicyEdit: false,
  },
  {
    id: PHASE6R_LEARNING_TIER_IDS.EXACT_ITEM_MEMORY,
    label: 'Exact-item memory',
    canWriteLearning: true,
    destinationEvidenceChanging: false,
    requiresExplicitPolicyEdit: false,
  },
  {
    id: PHASE6R_LEARNING_TIER_IDS.COMPATIBILITY_EVIDENCE,
    label: 'Compatibility evidence',
    canWriteLearning: true,
    destinationEvidenceChanging: true,
    requiresExplicitPolicyEdit: false,
  },
  {
    id: PHASE6R_LEARNING_TIER_IDS.IDENTITY_EVIDENCE,
    label: 'Identity evidence',
    canWriteLearning: true,
    destinationEvidenceChanging: true,
    requiresExplicitPolicyEdit: false,
  },
  {
    id: PHASE6R_LEARNING_TIER_IDS.HARD_LIMIT_EVIDENCE,
    label: 'Hard-limit evidence',
    canWriteLearning: false,
    destinationEvidenceChanging: true,
    requiresExplicitPolicyEdit: true,
  },
]);

const PHASE6R_LEARNING_SOURCE_CONTRACTS = deepFreeze([
  {
    id: PHASE6R_LEARNING_EVENT_SOURCE_IDS.MANUAL_CLASSIFICATION_CHANGE,
    label: 'Manual classification change',
    authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
  },
  {
    id: PHASE6R_LEARNING_EVENT_SOURCE_IDS.OPERATOR_CONFIRMATION,
    label: 'Operator confirmation',
    authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
  },
  {
    id: PHASE6R_LEARNING_EVENT_SOURCE_IDS.DISCORD_PENDING_ANSWER,
    label: 'Discord pending answer',
    authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
  },
  {
    id: PHASE6R_LEARNING_EVENT_SOURCE_IDS.REQUEST_DESTINATION_CHOICE,
    label: 'Request destination choice',
    authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
  },
  {
    id: PHASE6R_LEARNING_EVENT_SOURCE_IDS.ARR_ROUTING_OUTCOME,
    label: 'Arr routing outcome',
    authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
  },
]);

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeKey(value) {
  return normalizeString(value).toLowerCase();
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasValue(value) {
  return normalizeString(value).length > 0;
}

function getPolicyBuilderPhase6LearningTier(tierId) {
  return PHASE6R_LEARNING_TIER_CONTRACTS.find(tier => tier.id === tierId) || null;
}

function listPolicyBuilderPhase6LearningTiers() {
  return PHASE6R_LEARNING_TIER_CONTRACTS;
}

function getPolicyBuilderPhase6LearningSource(sourceId) {
  return PHASE6R_LEARNING_SOURCE_CONTRACTS.find(source => source.id === sourceId) || null;
}

function listPolicyBuilderPhase6LearningSources() {
  return PHASE6R_LEARNING_SOURCE_CONTRACTS;
}

function isBroadGenreCandidate(candidate = {}) {
  const signalType = normalizeKey(candidate.signalType ?? candidate.signal_type);
  const key = normalizeKey(candidate.key);
  const label = normalizeKey(candidate.label ?? candidate.value);

  return signalType === 'genre' ||
    signalType === 'genres' ||
    key.startsWith('genre:') ||
    key.startsWith('genres:') ||
    BROAD_GENRE_LABELS.includes(label);
}

function getEvidenceCount(candidate = {}) {
  const count = Number(candidate.evidenceCount ?? candidate.count ?? candidate.supportingExampleCount);
  return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
}

function normalizeLearningCandidate(candidate = {}) {
  return {
    key: normalizeString(candidate.key),
    label: normalizeString(candidate.label ?? candidate.value),
    signalType: normalizeString(candidate.signalType ?? candidate.signal_type),
    destinationLibraryId: candidate.destinationLibraryId ?? candidate.libraryId ?? null,
    destinationLibraryName: normalizeString(candidate.destinationLibraryName ?? candidate.libraryName),
    evidenceCount: getEvidenceCount(candidate),
    evidenceSource: normalizeString(candidate.evidenceSource),
  };
}

function mapAnswerOutcomeToTier(answerOutcomeId) {
  switch (answerOutcomeId) {
    case ANSWER_OUTCOME_IDS.REMEMBER_EXACT_ITEM:
      return {
        tierId: PHASE6R_LEARNING_TIER_IDS.EXACT_ITEM_MEMORY,
        reasonCode: PHASE6R_LEARNING_REASON_IDS.EXACT_ITEM_MEMORY_CANDIDATE,
      };
    case ANSWER_OUTCOME_IDS.ADD_COMPATIBILITY_EVIDENCE:
      return {
        tierId: PHASE6R_LEARNING_TIER_IDS.COMPATIBILITY_EVIDENCE,
        reasonCode: PHASE6R_LEARNING_REASON_IDS.COMPATIBILITY_EVIDENCE_CANDIDATE,
      };
    case ANSWER_OUTCOME_IDS.ADD_IDENTITY_EVIDENCE:
      return {
        tierId: PHASE6R_LEARNING_TIER_IDS.IDENTITY_EVIDENCE,
        reasonCode: PHASE6R_LEARNING_REASON_IDS.IDENTITY_EVIDENCE_CANDIDATE,
      };
    case ANSWER_OUTCOME_IDS.ADD_HARD_LIMIT_EVIDENCE:
      return {
        tierId: PHASE6R_LEARNING_TIER_IDS.HARD_LIMIT_EVIDENCE,
        reasonCode: PHASE6R_LEARNING_REASON_IDS.HARD_LIMIT_POLICY_EDIT_REQUIRED,
      };
    default:
      return {
        tierId: PHASE6R_LEARNING_TIER_IDS.NONE,
        reasonCode: PHASE6R_LEARNING_REASON_IDS.NO_LEARNING_REQUESTED,
      };
  }
}

function collectBlockingReasonCodes({
  question = {},
  answer = {},
  candidate = {},
  context = {},
}) {
  const blockingReasonCodes = [];
  const normalizedFrame = normalizeQuestionFrame(question.frameId || QUESTION_FRAME_IDS.DESTINATION_FIT);

  if (!normalizedFrame.accepted) {
    blockingReasonCodes.push(PHASE6R_LEARNING_REASON_IDS.REJECTED_QUESTION_FRAME_BLOCKED);
  }

  if (question.stale === true) {
    blockingReasonCodes.push(PHASE6R_LEARNING_REASON_IDS.STALE_QUESTION_BLOCKED);
  }

  if (answer.ambiguous === true || !hasValue(answer.label)) {
    blockingReasonCodes.push(PHASE6R_LEARNING_REASON_IDS.AMBIGUOUS_ANSWER_BLOCKED);
  }

  if (hasValue(context.aiExplanationText) || context.aiAuthored === true) {
    blockingReasonCodes.push(PHASE6R_LEARNING_REASON_IDS.AI_EXPLANATION_BLOCKED);
  }

  if (context.providerQuotaState || context.providerCooldownState) {
    blockingReasonCodes.push(PHASE6R_LEARNING_REASON_IDS.PROVIDER_STATE_BLOCKED);
  }

  if (context.replayDiagnosticState) {
    blockingReasonCodes.push(PHASE6R_LEARNING_REASON_IDS.REPLAY_DIAGNOSTIC_BLOCKED);
  }

  if (context.tmdbDiagnosticState || context.tmdbCoverageState) {
    blockingReasonCodes.push(PHASE6R_LEARNING_REASON_IDS.TMDB_DIAGNOSTIC_BLOCKED);
  }

  if (isBroadGenreCandidate(candidate) && getEvidenceCount(candidate) <= 1) {
    blockingReasonCodes.push(PHASE6R_LEARNING_REASON_IDS.BROAD_ONE_OFF_GENRE_BLOCKED);
  }

  return [...new Set(blockingReasonCodes)];
}

function buildFinalOutcome({
  sourceId,
  answerOutcome,
  answer,
  finalOutcome = {},
}) {
  const outcome = asObject(finalOutcome);

  return {
    recorded: answerOutcome?.finalOutcome !== false || outcome.recorded === true,
    sourceId,
    answerOutcomeId: answerOutcome?.id || null,
    itemId: outcome.itemId ?? null,
    destinationLibraryId: outcome.destinationLibraryId ?? answer.destinationLibraryId ?? null,
    destinationLibraryName: normalizeString(
      outcome.destinationLibraryName ?? answer.destinationLibraryName ?? answer.label
    ),
    status: normalizeString(outcome.status) || 'resolved',
    reasonCodes: [PHASE6R_LEARNING_REASON_IDS.FINAL_OUTCOME_RECORDED],
  };
}

function buildPolicyBuilderPhase6LearningDecision(input = {}) {
  const sourceId = input.sourceId || PHASE6R_LEARNING_EVENT_SOURCE_IDS.OPERATOR_CONFIRMATION;
  const answerOutcomeId = input.answerOutcomeId || ANSWER_OUTCOME_IDS.RESOLVE_CURRENT_ITEM;
  const answerOutcome = getAnswerOutcome(answerOutcomeId);
  const answer = asObject(input.answer);
  const question = asObject(input.question);
  const candidate = normalizeLearningCandidate(input.candidate);
  const context = asObject(input.context);
  const reasonCodes = [];

  if (!answerOutcome) {
    const finalOutcome = buildFinalOutcome({
      sourceId,
      answerOutcome: null,
      answer,
      finalOutcome: input.finalOutcome,
    });

    return {
      version: 'phase6r.learning_guard.v1',
      sourceId,
      finalOutcome,
      learning: {
        decisionId: PHASE6R_LEARNING_DECISION_IDS.BLOCKED,
        tierId: PHASE6R_LEARNING_TIER_IDS.NONE,
        canWriteLearning: false,
        requiresExplicitPolicyEdit: false,
        authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
        candidate,
        reasonCodes: [PHASE6R_LEARNING_REASON_IDS.UNKNOWN_ANSWER_OUTCOME_BLOCKED],
        blockedReasonCodes: [PHASE6R_LEARNING_REASON_IDS.UNKNOWN_ANSWER_OUTCOME_BLOCKED],
        writesPerformed: false,
      },
      profileRefresh: {
        queue: false,
        reasonCodes: [],
      },
    };
  }

  const finalOutcome = buildFinalOutcome({
    sourceId,
    answerOutcome,
    answer,
    finalOutcome: input.finalOutcome,
  });
  const tierMapping = mapAnswerOutcomeToTier(answerOutcome.id);
  const tier = getPolicyBuilderPhase6LearningTier(tierMapping.tierId);
  reasonCodes.push(tierMapping.reasonCode);

  const blockingReasonCodes = tier.id === PHASE6R_LEARNING_TIER_IDS.NONE
    ? []
    : collectBlockingReasonCodes({
      question,
      answer,
      candidate,
      context,
    });

  let decisionId = PHASE6R_LEARNING_DECISION_IDS.OUTCOME_ONLY;
  if (blockingReasonCodes.length > 0) {
    decisionId = PHASE6R_LEARNING_DECISION_IDS.BLOCKED;
  } else if (tier.requiresExplicitPolicyEdit) {
    decisionId = PHASE6R_LEARNING_DECISION_IDS.POLICY_EDIT_REQUIRED;
  } else if (tier.id !== PHASE6R_LEARNING_TIER_IDS.NONE) {
    decisionId = PHASE6R_LEARNING_DECISION_IDS.CANDIDATE;
    reasonCodes.push(PHASE6R_LEARNING_REASON_IDS.LEARNING_CANDIDATE_APPROVED);
  }

  const canWriteLearning = decisionId === PHASE6R_LEARNING_DECISION_IDS.CANDIDATE &&
    tier.canWriteLearning === true;
  const queueProfileRefresh = canWriteLearning === true && tier.destinationEvidenceChanging === true;

  if (queueProfileRefresh) {
    reasonCodes.push(PHASE6R_LEARNING_REASON_IDS.PROFILE_REFRESH_REQUIRED);
  }

  return {
    version: 'phase6r.learning_guard.v1',
    sourceId,
    finalOutcome,
    learning: {
      decisionId,
      tierId: tier.id,
      canWriteLearning,
      requiresExplicitPolicyEdit: tier.requiresExplicitPolicyEdit,
      authoritySourceId: answerOutcome.authoritySourceId,
      candidate,
      reasonCodes,
      blockedReasonCodes: blockingReasonCodes,
      writesPerformed: false,
    },
    profileRefresh: {
      queue: queueProfileRefresh,
      reasonCodes: queueProfileRefresh
        ? [PHASE6R_LEARNING_REASON_IDS.PROFILE_REFRESH_REQUIRED]
        : [],
    },
  };
}

function validatePolicyBuilderPhase6LearningDecision(decision = {}) {
  const issues = [];
  const finalOutcome = asObject(decision.finalOutcome);
  const learning = asObject(decision.learning);
  const profileRefresh = asObject(decision.profileRefresh);

  if (finalOutcome.recorded !== true && finalOutcome.recorded !== false) {
    issues.push({
      riskId: PHASE6R_LEARNING_GUARD_AUDIT_RISK_IDS.MISSING_FINAL_OUTCOME,
      message: 'Learning guard decision must include a separate final outcome record.',
    });
  }

  if (!learning.decisionId) {
    issues.push({
      riskId: PHASE6R_LEARNING_GUARD_AUDIT_RISK_IDS.MISSING_LEARNING_DECISION,
      message: 'Learning guard decision must include a learning decision.',
    });
  } else if (!Object.values(PHASE6R_LEARNING_DECISION_IDS).includes(learning.decisionId)) {
    issues.push({
      riskId: PHASE6R_LEARNING_GUARD_AUDIT_RISK_IDS.UNKNOWN_DECISION,
      message: 'Learning guard decision uses an unknown decision id.',
    });
  }

  if (!getPolicyBuilderPhase6LearningTier(learning.tierId)) {
    issues.push({
      riskId: PHASE6R_LEARNING_GUARD_AUDIT_RISK_IDS.UNKNOWN_TIER,
      message: 'Learning guard decision uses an unknown learning tier.',
    });
  }

  if (!getPolicyAuthoritySource(learning.authoritySourceId)) {
    issues.push({
      riskId: PHASE6R_LEARNING_GUARD_AUDIT_RISK_IDS.UNKNOWN_AUTHORITY_SOURCE,
      message: 'Learning guard decision must reference a known authority source.',
    });
  }

  if (learning.decisionId === PHASE6R_LEARNING_DECISION_IDS.BLOCKED &&
      learning.canWriteLearning === true) {
    issues.push({
      riskId: PHASE6R_LEARNING_GUARD_AUDIT_RISK_IDS.BLOCKED_DECISION_CAN_WRITE,
      message: 'Blocked learning decisions cannot write durable learning.',
    });
  }

  if (learning.decisionId === PHASE6R_LEARNING_DECISION_IDS.OUTCOME_ONLY &&
      learning.tierId !== PHASE6R_LEARNING_TIER_IDS.NONE) {
    issues.push({
      riskId: PHASE6R_LEARNING_GUARD_AUDIT_RISK_IDS.OUTCOME_ONLY_HAS_LEARNING_TIER,
      message: 'Outcome-only decisions must not carry a learning tier.',
    });
  }

  if (learning.tierId === PHASE6R_LEARNING_TIER_IDS.HARD_LIMIT_EVIDENCE &&
      learning.requiresExplicitPolicyEdit !== true) {
    issues.push({
      riskId: PHASE6R_LEARNING_GUARD_AUDIT_RISK_IDS.HARD_LIMIT_WITHOUT_POLICY_EDIT,
      message: 'Hard-limit learning requires an explicit policy edit.',
    });
  }

  if (learning.writesPerformed === true) {
    issues.push({
      riskId: PHASE6R_LEARNING_GUARD_AUDIT_RISK_IDS.DIRECT_WRITE_PERFORMED,
      message: 'Learning guard must return decisions only and cannot perform writes.',
    });
  }

  if (profileRefresh.queue === true &&
      ![
        PHASE6R_LEARNING_TIER_IDS.COMPATIBILITY_EVIDENCE,
        PHASE6R_LEARNING_TIER_IDS.IDENTITY_EVIDENCE,
      ].includes(learning.tierId)) {
    issues.push({
      riskId: PHASE6R_LEARNING_GUARD_AUDIT_RISK_IDS.PROFILE_REFRESH_WITHOUT_DESTINATION_LEARNING,
      message: 'Profile refresh should queue only when destination evidence changes.',
    });
  }

  if (asArray(learning.reasonCodes).length === 0) {
    issues.push({
      riskId: PHASE6R_LEARNING_GUARD_AUDIT_RISK_IDS.MISSING_REASON_CODE,
      message: 'Learning decisions must include reason codes.',
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function buildPolicyBuilderPhase6LearningGuardAudit(
  decision = buildPolicyBuilderPhase6LearningDecision()
) {
  const validation = validatePolicyBuilderPhase6LearningDecision(decision);

  return {
    ok: validation.ok,
    issueCount: validation.issueCount,
    checkedTierCount: PHASE6R_LEARNING_TIER_CONTRACTS.length,
    checkedSourceCount: PHASE6R_LEARNING_SOURCE_CONTRACTS.length,
    validation,
    nextPhase: {
      phaseId: '6r_4',
      label: 'Automation Readiness Engine',
      reason: 'Learning decisions now distinguish outcome history from durable evidence, so readiness can safely combine evidence, intent, routing, freshness, and learning state.',
    },
  };
}

export {
  BROAD_GENRE_LABELS,
  PHASE6R_LEARNING_DECISION_IDS,
  PHASE6R_LEARNING_EVENT_SOURCE_IDS,
  PHASE6R_LEARNING_GUARD_AUDIT_RISK_IDS,
  PHASE6R_LEARNING_REASON_IDS,
  PHASE6R_LEARNING_TIER_IDS,
  buildPolicyBuilderPhase6LearningDecision,
  buildPolicyBuilderPhase6LearningGuardAudit,
  getPolicyBuilderPhase6LearningSource,
  getPolicyBuilderPhase6LearningTier,
  isBroadGenreCandidate,
  listPolicyBuilderPhase6LearningSources,
  listPolicyBuilderPhase6LearningTiers,
  validatePolicyBuilderPhase6LearningDecision,
};
