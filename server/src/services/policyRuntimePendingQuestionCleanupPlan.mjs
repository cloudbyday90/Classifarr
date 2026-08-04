/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  getRuntimeQuestionNormalizationStatus,
} from './policyRuntimeQuestionNormalizer.mjs';
import {
  isPolicyRuntimeQuestionPersistenceEnvelope,
} from './policyRuntimeQuestionPersistenceContract.mjs';
import {
  extractQuestionContext,
  isPolicyQuestionStale,
} from '../utils/policyQuestionContext.mjs';

const POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_VERSION =
  'policy.runtime_pending_question_cleanup.v1';

const POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_STATUS_IDS = Object.freeze({
  NOT_APPLICABLE: 'not_applicable',
  CURRENT: 'current',
  CLEANUP_REQUIRED: 'cleanup_required',
});

const POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_ACTION_IDS = Object.freeze({
  NONE: 'none',
  REGENERATE_UNDER_CURRENT_CONTRACT: 'regenerate_under_current_contract',
  MARK_STALE_REQUIRE_RETRY: 'mark_stale_require_retry',
  RESOLVE_OUTCOME_ONLY: 'resolve_outcome_only',
  BLOCK_LEARNING_PERMANENTLY: 'block_learning_permanently',
});

const POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS = Object.freeze({
  NOT_PENDING: 'pending_question_cleanup_not_pending',
  MISSING_CLASSIFICATION_ID: 'pending_question_cleanup_missing_classification_id',
  MISSING_POLICY_QUESTION: 'pending_question_cleanup_missing_policy_question',
  MISSING_CONTRACT_VERSION: 'pending_question_cleanup_missing_contract_version',
  VAGUE_GENRE_PRIORITY: 'pending_question_cleanup_vague_genre_priority',
  MISSING_LEARNING_METADATA: 'pending_question_cleanup_missing_learning_metadata',
  INVALID_QUESTION_CONTRACT: 'pending_question_cleanup_invalid_question_contract',
  RAW_AI_CONTEXT: 'pending_question_cleanup_raw_ai_context',
  CURRENT_STATE_UNAVAILABLE: 'pending_question_cleanup_current_state_unavailable',
  STALE_CANDIDATE_LIBRARY: 'pending_question_cleanup_stale_candidate_library',
  POLICY_CONTEXT_CHANGED: 'pending_question_cleanup_policy_context_changed',
  RUNTIME_ANSWER_RECORDED: 'pending_question_cleanup_runtime_answer_recorded',
  LEGACY_RESPONSE_UNTRUSTED: 'pending_question_cleanup_legacy_response_untrusted',
});

const PENDING_STATUS_IDS = new Set([
  'awaiting_decision',
  'pending_retry',
]);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeString(value, maximumLength = 120) {
  if (typeof value !== 'string') return '';

  return value
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximumLength);
}

function normalizePositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function normalizePositiveIntegerSet(value) {
  if (!Array.isArray(value)) return null;

  return new Set(value
    .map(normalizePositiveInteger)
    .filter(Boolean));
}

function getQuestionContractId(question = {}) {
  if (isPolicyRuntimeQuestionPersistenceEnvelope(question)) {
    return 'native_persistence';
  }

  const status = getRuntimeQuestionNormalizationStatus(question);
  return status.contract === 'normalization' ? 'normalization' : 'legacy_or_unknown';
}

function hasSafeNativeLearningMetadata(question = {}) {
  const learning = asObject(asObject(question).runtimeQuestion?.learning);
  return learning.eligible === false &&
    learning.requiresLearningGuard === false &&
    Array.isArray(learning.allowedOutcomeIds) &&
    learning.allowedOutcomeIds.length > 0;
}

function hasSafeNormalizedLearningMetadata(question = {}) {
  const learning = asObject(asObject(question).meta?.runtime_question_normalization?.learning);
  return learning.eligible === false && learning.tier === 'blocked';
}

function hasLearningMetadata(question = {}, contractId) {
  if (contractId === 'native_persistence') {
    return hasSafeNativeLearningMetadata(question);
  }

  if (contractId === 'normalization') {
    return hasSafeNormalizedLearningMetadata(question);
  }

  return false;
}

function hasVagueGenrePriority(question = {}) {
  const source = asObject(question);
  const text = [
    source.question,
    source.operatorQuestion,
    source.why_uncertain,
    source.problem_summary,
  ]
    .map(value => normalizeString(value, 240))
    .filter(Boolean)
    .join(' ');

  return /\bgenres?\b/i.test(text) && /\bprioriti[sz]\w*\b/i.test(text);
}

function hasRawAiContext(question = {}) {
  const source = asObject(question);
  const meta = asObject(source.meta);
  return normalizeString(source.ai_rationale, 240).length > 0 ||
    normalizeString(source.aiExplanationText, 240).length > 0 ||
    normalizeString(meta.ai_rationale, 240).length > 0 ||
    normalizeString(meta.ai_explanation, 240).length > 0;
}

function hasRecordedRuntimeAnswer(metadata = {}) {
  const answer = asObject(
    asObject(asObject(metadata).classification_details).outcome_link,
  ).runtime_question_answer;
  const source = asObject(answer);

  return normalizeString(source.contract_version, 120).length > 0 &&
    normalizeString(source.contract_fingerprint, 120).length > 0 &&
    normalizeString(source.action_id, 120).length > 0;
}

function hasUntrustedLegacyResponse(classification = {}) {
  return Object.keys(asObject(asObject(classification).clarification_response)).length > 0;
}

function hasStaleCandidateLibrary(question = {}, activeLibraryIds) {
  if (!(activeLibraryIds instanceof Set)) return false;

  const candidateLibraryIds = extractQuestionContext(question).libraryIds;
  return candidateLibraryIds.some(libraryId => !activeLibraryIds.has(libraryId));
}

function getQuestionIssues(question, {
  currentContextVersion = null,
  activeLibraryIds = null,
  contextEvaluated = false,
} = {}) {
  const source = asObject(question);
  const contractId = getQuestionContractId(source);
  const normalization = getRuntimeQuestionNormalizationStatus(source);
  const questionContext = extractQuestionContext(source);
  const reasonIds = [];

  if (contractId === 'legacy_or_unknown') {
    reasonIds.push(POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS.MISSING_CONTRACT_VERSION);
  }
  if (hasVagueGenrePriority(source)) {
    reasonIds.push(POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS.VAGUE_GENRE_PRIORITY);
  }
  if (!hasLearningMetadata(source, contractId)) {
    reasonIds.push(POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS.MISSING_LEARNING_METADATA);
  }
  if (!normalization.actionable) {
    reasonIds.push(POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS.INVALID_QUESTION_CONTRACT);
  }
  if (hasRawAiContext(source)) {
    reasonIds.push(POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS.RAW_AI_CONTEXT);
  }
  if (questionContext.libraryIds.length > 0 && !(activeLibraryIds instanceof Set)) {
    reasonIds.push(POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS.CURRENT_STATE_UNAVAILABLE);
  } else if (hasStaleCandidateLibrary(source, activeLibraryIds)) {
    reasonIds.push(POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS.STALE_CANDIDATE_LIBRARY);
  }
  if ((questionContext.libraryIds.length > 0 || questionContext.policyIds.length > 0) &&
      contextEvaluated !== true) {
    reasonIds.push(POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS.CURRENT_STATE_UNAVAILABLE);
  } else if (isPolicyQuestionStale(source, currentContextVersion)) {
    reasonIds.push(POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS.POLICY_CONTEXT_CHANGED);
  }

  return {
    contractId,
    reasonIds: [...new Set(reasonIds)],
  };
}

function buildPlan({
  classificationId,
  statusId,
  actionId,
  reasonIds,
  questionContractId = null,
  requiresFreshRuntimeEvaluation = false,
  requiresOperatorRetry = false,
  requiresHumanReview = false,
} = {}) {
  const plan = {
    version: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_VERSION,
    classificationId,
    statusId,
    actionId,
    reasonIds: [...new Set(reasonIds)].sort(),
    questionContractId,
    learning: {
      canWriteLearning: false,
      dispositionId: 'blocked',
    },
    requiresFreshRuntimeEvaluation,
    requiresOperatorRetry,
    requiresHumanReview,
  };

  return {
    ...plan,
    audit: buildPolicyRuntimePendingQuestionCleanupPlanAudit(plan),
  };
}

function buildPolicyRuntimePendingQuestionCleanupPlan({
  classification = {},
  currentContextVersion = null,
  activeLibraryIds,
  contextEvaluated = false,
} = {}) {
  const source = asObject(classification);
  const classificationId = normalizePositiveInteger(source.id);
  const status = normalizeString(source.status, 80).toLowerCase();

  if (!classificationId) {
    return buildPlan({
      classificationId: null,
      statusId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_STATUS_IDS.NOT_APPLICABLE,
      actionId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_ACTION_IDS.NONE,
      reasonIds: [POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS.MISSING_CLASSIFICATION_ID],
    });
  }

  if (!PENDING_STATUS_IDS.has(status)) {
    return buildPlan({
      classificationId,
      statusId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_STATUS_IDS.NOT_APPLICABLE,
      actionId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_ACTION_IDS.NONE,
      reasonIds: [POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS.NOT_PENDING],
    });
  }

  const metadata = asObject(source.metadata);
  if (hasRecordedRuntimeAnswer(metadata)) {
    return buildPlan({
      classificationId,
      statusId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_STATUS_IDS.CLEANUP_REQUIRED,
      actionId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_ACTION_IDS.RESOLVE_OUTCOME_ONLY,
      reasonIds: [POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS.RUNTIME_ANSWER_RECORDED],
      requiresHumanReview: true,
    });
  }

  if (hasUntrustedLegacyResponse(source)) {
    return buildPlan({
      classificationId,
      statusId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_STATUS_IDS.CLEANUP_REQUIRED,
      actionId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_ACTION_IDS.BLOCK_LEARNING_PERMANENTLY,
      reasonIds: [POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS.LEGACY_RESPONSE_UNTRUSTED],
      requiresHumanReview: true,
    });
  }

  const question = asObject(source.policy_question ?? source.policyQuestion);
  if (Object.keys(question).length === 0) {
    return buildPlan({
      classificationId,
      statusId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_STATUS_IDS.CLEANUP_REQUIRED,
      actionId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_ACTION_IDS.MARK_STALE_REQUIRE_RETRY,
      reasonIds: [POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS.MISSING_POLICY_QUESTION],
      requiresOperatorRetry: true,
    });
  }

  const issues = getQuestionIssues(question, {
    currentContextVersion,
    activeLibraryIds: normalizePositiveIntegerSet(activeLibraryIds),
    contextEvaluated,
  });
  const hasUnsafeQuestion = issues.reasonIds.includes(
    POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS.RAW_AI_CONTEXT,
  );
  const hasStaleContext = issues.reasonIds.includes(
    POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS.STALE_CANDIDATE_LIBRARY,
  ) || issues.reasonIds.includes(
    POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS.POLICY_CONTEXT_CHANGED,
  );

  if (hasUnsafeQuestion) {
    return buildPlan({
      classificationId,
      statusId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_STATUS_IDS.CLEANUP_REQUIRED,
      actionId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_ACTION_IDS.BLOCK_LEARNING_PERMANENTLY,
      reasonIds: issues.reasonIds,
      questionContractId: issues.contractId,
      requiresHumanReview: true,
    });
  }

  if (hasStaleContext && issues.reasonIds.length > 0) {
    return buildPlan({
      classificationId,
      statusId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_STATUS_IDS.CLEANUP_REQUIRED,
      actionId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_ACTION_IDS.REGENERATE_UNDER_CURRENT_CONTRACT,
      reasonIds: issues.reasonIds,
      questionContractId: issues.contractId,
      requiresFreshRuntimeEvaluation: true,
    });
  }

  if (issues.reasonIds.length > 0) {
    return buildPlan({
      classificationId,
      statusId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_STATUS_IDS.CLEANUP_REQUIRED,
      actionId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_ACTION_IDS.MARK_STALE_REQUIRE_RETRY,
      reasonIds: issues.reasonIds,
      questionContractId: issues.contractId,
      requiresOperatorRetry: true,
    });
  }

  return buildPlan({
    classificationId,
    statusId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_STATUS_IDS.CURRENT,
    actionId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_ACTION_IDS.NONE,
    reasonIds: [],
    questionContractId: issues.contractId,
  });
}

function buildPolicyRuntimePendingQuestionCleanupPlanAudit(plan = {}) {
  const source = asObject(plan);
  const issues = [];
  const statusIds = Object.values(POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_STATUS_IDS);
  const actionIds = Object.values(POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_ACTION_IDS);
  const reasonIds = new Set(Object.values(POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS));
  const questionContractIds = new Set([
    'native_persistence',
    'normalization',
    'legacy_or_unknown',
    null,
  ]);
  const allowedPlanFields = new Set([
    'version',
    'classificationId',
    'statusId',
    'actionId',
    'reasonIds',
    'questionContractId',
    'learning',
    'requiresFreshRuntimeEvaluation',
    'requiresOperatorRetry',
    'requiresHumanReview',
    'audit',
  ]);
  const allowedLearningFields = new Set([
    'canWriteLearning',
    'dispositionId',
  ]);
  const allowedAuditFields = new Set([
    'ok',
    'issueCount',
    'issues',
  ]);
  const actionRequiresCleanup = source.statusId ===
    POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_STATUS_IDS.CLEANUP_REQUIRED;

  if (source.version !== POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_VERSION) {
    issues.push('invalid_version');
  }
  if (!statusIds.includes(source.statusId)) {
    issues.push('invalid_status');
  }
  if (source.classificationId !== null && !normalizePositiveInteger(source.classificationId)) {
    issues.push('invalid_classification_id');
  }
  if (!actionIds.includes(source.actionId)) {
    issues.push('invalid_action');
  }
  if (actionRequiresCleanup &&
      source.actionId === POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_ACTION_IDS.NONE) {
    issues.push('cleanup_without_action');
  }
  if (!actionRequiresCleanup &&
      source.actionId !== POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_ACTION_IDS.NONE) {
    issues.push('non_cleanup_with_action');
  }
  if (!Array.isArray(source.reasonIds)) {
    issues.push('invalid_reason_ids');
  } else if (source.reasonIds.some(reasonId => !reasonIds.has(reasonId))) {
    issues.push('unknown_reason_id');
  }
  if (!questionContractIds.has(source.questionContractId)) {
    issues.push('invalid_question_contract');
  }
  if (source.learning?.canWriteLearning !== false ||
      source.learning?.dispositionId !== 'blocked') {
    issues.push('learning_not_blocked');
  }
  if (Object.keys(asObject(source.learning)).some(field => !allowedLearningFields.has(field))) {
    issues.push('raw_record_retained');
  }
  if ([
    source.requiresFreshRuntimeEvaluation,
    source.requiresOperatorRetry,
    source.requiresHumanReview,
  ].some(value => typeof value !== 'boolean')) {
    issues.push('invalid_execution_flags');
  }
  if (Object.keys(source).some(field => !allowedPlanFields.has(field))) {
    issues.push('raw_record_retained');
  }
  if (Object.keys(asObject(source.audit)).some(field => !allowedAuditFields.has(field))) {
    issues.push('raw_record_retained');
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_ACTION_IDS,
  POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS,
  POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_STATUS_IDS,
  POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_VERSION,
  buildPolicyRuntimePendingQuestionCleanupPlan,
  buildPolicyRuntimePendingQuestionCleanupPlanAudit,
};
