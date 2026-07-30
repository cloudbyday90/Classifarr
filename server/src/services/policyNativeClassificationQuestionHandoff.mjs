/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  buildPolicyAutomationDecisionFromEvidenceProjection,
  validatePolicyAutomationDecision,
} from './policyAutomationDecisionContract.mjs';
import {
  loadPolicyLibraryProfileEvidence,
} from './policyLibraryProfileEvidenceLoader.mjs';
import {
  POLICY_NATIVE_INTENT_RUNTIME_STATUS_IDS,
} from './policyNativeIntentRuntimeEvaluator.mjs';
import {
  buildPolicyRuntimeEvidenceProjection,
} from './policyRuntimeEvidenceProjection.mjs';
import {
  buildPolicyRuntimeQuestionReductionFromAutomationDecision,
  validatePolicyRuntimeQuestionReduction,
} from './policyRuntimeQuestionReduction.mjs';
import {
  buildPolicyRuntimeQueueQuestionReductionProducer,
} from './policyRuntimeQueueQuestionReductionProducer.mjs';
import {
  buildPolicyRuntimeQueueQuestionReductionAudit,
} from './policyRuntimeQueueQuestionReduction.mjs';
import {
  resolveRoutingConfig,
} from './classificationRoutingService.mjs';

const POLICY_NATIVE_CLASSIFICATION_QUESTION_HANDOFF_VERSION =
  'policy.native_classification_question_handoff.v1';

const POLICY_NATIVE_CLASSIFICATION_QUESTION_HANDOFF_STATUS_IDS = Object.freeze({
  READY: 'ready',
  NO_SELECTED_LIBRARY: 'no_selected_library',
  NATIVE_INTENT_UNAVAILABLE: 'native_intent_unavailable',
  PROFILE_UNAVAILABLE: 'profile_unavailable',
  INVALID_RUNTIME_CONTRACT: 'invalid_runtime_contract',
});

const POLICY_NATIVE_CLASSIFICATION_QUESTION_HANDOFF_RISK_IDS = Object.freeze({
  READY_WITHOUT_VALID_PLAN: 'ready_without_valid_plan',
  BLOCKED_WITH_PLAN: 'blocked_with_plan',
  UNSAFE_SIDE_EFFECT: 'unsafe_side_effect',
  RAW_CLASSIFICATION_DATA_EXPOSED: 'raw_classification_data_exposed',
  INVALID_DECISION_CONTRACT: 'invalid_decision_contract',
  INVALID_QUEUE_QUESTION_REDUCTION: 'invalid_queue_question_reduction',
});

const MAX_DECLARED_RULES_PER_ROLE = 24;
const VALID_NATIVE_RUNTIME_STATUSES = new Set([
  POLICY_NATIVE_INTENT_RUNTIME_STATUS_IDS.ACTIVE,
  POLICY_NATIVE_INTENT_RUNTIME_STATUS_IDS.PURPOSE_NOT_MATCHED,
  POLICY_NATIVE_INTENT_RUNTIME_STATUS_IDS.HARD_LIMIT_FAILED,
  POLICY_NATIVE_INTENT_RUNTIME_STATUS_IDS.HARD_LIMIT_UNKNOWN,
  POLICY_NATIVE_INTENT_RUNTIME_STATUS_IDS.NO_PURPOSE,
]);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
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

function normalizeSignalType(value) {
  const signalType = normalizeString(value, 80).toLowerCase();
  return /^[a-z][a-z0-9_]*$/u.test(signalType) ? signalType : null;
}

function findSelectedCandidate(policyResult, libraryId) {
  const selectedId = normalizePositiveInteger(libraryId);
  if (!selectedId) return null;

  return asArray(policyResult?.ranked).find(candidate =>
    normalizePositiveInteger(candidate?.library_id) === selectedId
  ) || null;
}

function getNativeRuntimeEvaluation(classificationResult = {}, libraryId) {
  const policyResult = asObject(classificationResult.policyResult);
  const selectedCandidate = findSelectedCandidate(policyResult, libraryId);
  const candidateRuntime = asObject(selectedCandidate?.native_intent_runtime);

  if (Object.keys(candidateRuntime).length > 0) {
    return candidateRuntime;
  }

  const selectedPolicyLibraryId = normalizePositiveInteger(policyResult?.library?.library_id);
  if (selectedPolicyLibraryId !== normalizePositiveInteger(libraryId)) {
    return {};
  }

  return asObject(policyResult.nativeIntentRuntime);
}

function isAuthoritativeNativeRuntime(runtimeEvaluation = {}) {
  const runtime = asObject(runtimeEvaluation);
  const contract = asObject(runtime.contract);

  return VALID_NATIVE_RUNTIME_STATUSES.has(runtime.statusId) &&
    contract.source === 'native_intent' &&
    contract.validation?.valid === true;
}

function buildDeclaredRuleSignal(rule, role, index) {
  const signalType = normalizeSignalType(rule?.signal_type);
  if (!signalType) return null;

  return {
    key: `${role}:${signalType}:${index + 1}`,
    label: `${signalType} declared ${role.replace(/_/g, ' ')}`,
  };
}

function buildDeclaredRuleSignals(rules, role) {
  return asArray(rules)
    .slice(0, MAX_DECLARED_RULES_PER_ROLE)
    .map((rule, index) => buildDeclaredRuleSignal(rule, role, index))
    .filter(Boolean);
}

function buildOperatorIntent(contract = {}) {
  const nativeContract = asObject(contract);

  return {
    belongsHere: buildDeclaredRuleSignals(nativeContract.purpose, 'purpose'),
    helpfulMatches: buildDeclaredRuleSignals(nativeContract.helpful_hints, 'helpful_hint'),
    hardLimits: buildDeclaredRuleSignals(nativeContract.hard_limits, 'hard_limit'),
    avoid: buildDeclaredRuleSignals(nativeContract.avoid, 'avoid'),
    routingTargets: [],
  };
}

function buildClassificationState(result = {}) {
  const classification = asObject(result);
  const complete = classification.needs_retry !== true &&
    classification.needs_clarification !== true;

  return {
    completed: complete,
    status: complete ? 'completed' : 'pending',
  };
}

function buildPolicyEvaluation(runtimeEvaluation = {}, classificationResult = {}) {
  const runtime = asObject(runtimeEvaluation);
  const classification = asObject(classificationResult);
  const highRiskConflicts = [];

  if (classification.needs_retry === true || classification.needs_clarification === true) {
    highRiskConflicts.push('classification_not_final');
  }

  if (runtime.statusId === POLICY_NATIVE_INTENT_RUNTIME_STATUS_IDS.HARD_LIMIT_UNKNOWN) {
    highRiskConflicts.push('native_intent_hard_limit_unknown');
  }

  if (runtime.statusId === POLICY_NATIVE_INTENT_RUNTIME_STATUS_IDS.PURPOSE_NOT_MATCHED) {
    highRiskConflicts.push('native_intent_purpose_not_matched');
  }

  if (runtime.statusId === POLICY_NATIVE_INTENT_RUNTIME_STATUS_IDS.NO_PURPOSE) {
    highRiskConflicts.push('native_intent_missing_purpose');
  }

  return {
    hardLimitsSatisfied: runtime.statusId === POLICY_NATIVE_INTENT_RUNTIME_STATUS_IDS.HARD_LIMIT_FAILED
      ? false
      : true,
    avoidRulesSatisfied: Number(runtime.avoidPenalty) > 0 ? false : true,
    highRiskConflicts,
  };
}

function buildUnavailableProfileFreshness() {
  return {
    key: 'library_profile',
    label: 'Library profile',
    value: 'review_required',
    stale: true,
    updatedAt: null,
  };
}

function buildProfileEvidenceInput(profileHandoff = {}) {
  const handoff = asObject(profileHandoff);

  if (handoff.ok === true && handoff.profileEvidence?.libraryProfile) {
    return {
      libraryProfile: handoff.profileEvidence.libraryProfile,
      profileFreshness: handoff.profileFreshness || buildUnavailableProfileFreshness(),
      profileAvailable: true,
    };
  }

  return {
    libraryProfile: {},
    profileFreshness: buildUnavailableProfileFreshness(),
    profileAvailable: false,
  };
}

async function readStoredProfileEvidence(loadProfileEvidence, libraryId) {
  try {
    return await loadProfileEvidence({ libraryId });
  } catch {
    return null;
  }
}

async function readStoredRoutingConfig(resolveStoredRoutingConfig, library) {
  if (typeof resolveStoredRoutingConfig !== 'function') return null;

  try {
    return await resolveStoredRoutingConfig(library);
  } catch {
    return null;
  }
}

function buildRoutingInput(resolvedLibrary = {}) {
  const library = asObject(resolvedLibrary);
  const arrType = normalizeString(library.arr_type, 24).toLowerCase();
  const arrConfigId = normalizePositiveInteger(library.arr_id ?? library.arr_config_id);
  const mapped = Boolean(arrType && arrConfigId);

  return {
    mapped,
    configured: mapped,
    targetId: mapped ? `${arrType}:${arrConfigId}` : null,
    arrConfigId: arrConfigId ? String(arrConfigId) : null,
  };
}

function buildSideEffects({ profileRead = false, routingConfigRead = false } = {}) {
  return {
    storedProfileRead: profileRead,
    storedRoutingConfigRead: routingConfigRead,
    liveMediaServerLookupPerformed: false,
    liveProviderLookupPerformed: false,
    providerQuotaRead: false,
    classificationWritten: false,
    routingExecuted: false,
    questionCreated: false,
    learningWritten: false,
    policyStorageMutated: false,
  };
}

function buildResult({
  statusId,
  plan = null,
  queueQuestionReduction = null,
  profileRead = false,
  routingConfigRead = false,
  profileAvailable = false,
  nativeRuntimeStatusId = null,
  reasonCode = null,
} = {}) {
  const questionReductionValidation = plan
    ? validatePolicyRuntimeQuestionReduction(plan)
    : null;
  const decisionValidation = plan
    ? validatePolicyAutomationDecision(plan.decision)
    : null;
  const evidenceValidation = asObject(plan?.decision?.evidence?.validation);
  const result = {
    version: POLICY_NATIVE_CLASSIFICATION_QUESTION_HANDOFF_VERSION,
    ok: questionReductionValidation?.ok === true,
    statusId,
    reasonCode,
    plan: questionReductionValidation?.ok === true ? plan : null,
    queueQuestionReduction,
    summary: {
      nativeRuntimeStatusId,
      profileAvailable,
      decisionStateId: plan?.decision?.stateId || null,
      dispositionId: plan?.dispositionId || null,
      actionId: plan?.nextAction?.actionId || null,
      questionCreated: plan?.createQuestion === true,
      evidenceFingerprint: plan?.decisionEvidenceFingerprint?.fingerprint || null,
      decisionValidationOk: decisionValidation?.ok === true,
      questionReductionValidationOk: questionReductionValidation?.ok === true,
      evidenceValidationOk: evidenceValidation.ok === true,
    },
    sideEffects: buildSideEffects({ profileRead, routingConfigRead }),
  };

  return {
    ...result,
    audit: buildPolicyNativeClassificationQuestionHandoffAudit(result),
  };
}

async function buildPolicyNativeClassificationQuestionHandoff({
  classificationResult = {},
  queueTask = null,
  loadProfileEvidence = loadPolicyLibraryProfileEvidence,
  resolveStoredRoutingConfig = resolveRoutingConfig,
} = {}) {
  const result = asObject(classificationResult);
  const selectedLibrary = asObject(result.library);
  const libraryId = normalizePositiveInteger(selectedLibrary.id ?? selectedLibrary.library_id);

  if (!libraryId) {
    return buildResult({
      statusId: POLICY_NATIVE_CLASSIFICATION_QUESTION_HANDOFF_STATUS_IDS.NO_SELECTED_LIBRARY,
      reasonCode: 'selected_library_unavailable',
    });
  }

  const nativeRuntime = getNativeRuntimeEvaluation(result, libraryId);
  if (!isAuthoritativeNativeRuntime(nativeRuntime)) {
    return buildResult({
      statusId: POLICY_NATIVE_CLASSIFICATION_QUESTION_HANDOFF_STATUS_IDS.NATIVE_INTENT_UNAVAILABLE,
      nativeRuntimeStatusId: normalizeString(nativeRuntime.statusId, 80) || null,
      reasonCode: 'authoritative_native_intent_unavailable',
    });
  }

  const [profileHandoff, resolvedLibrary] = await Promise.all([
    readStoredProfileEvidence(loadProfileEvidence, libraryId),
    readStoredRoutingConfig(resolveStoredRoutingConfig, selectedLibrary),
  ]);
  const profileInput = buildProfileEvidenceInput(profileHandoff);
  let plan;
  try {
    const evidenceProjection = buildPolicyRuntimeEvidenceProjection({
      libraryProfile: profileInput.libraryProfile,
      operatorIntent: buildOperatorIntent(nativeRuntime.contract),
      profileFreshness: profileInput.profileFreshness,
    });
    const decision = buildPolicyAutomationDecisionFromEvidenceProjection({
      evidenceProjection,
      classification: buildClassificationState(result),
      routing: buildRoutingInput(resolvedLibrary),
      policyEvaluation: buildPolicyEvaluation(nativeRuntime, result),
    });
    plan = buildPolicyRuntimeQuestionReductionFromAutomationDecision({
      automationDecision: decision,
    });
  } catch {
    return buildResult({
      statusId: POLICY_NATIVE_CLASSIFICATION_QUESTION_HANDOFF_STATUS_IDS.INVALID_RUNTIME_CONTRACT,
      profileRead: true,
      routingConfigRead: typeof resolveStoredRoutingConfig === 'function',
      profileAvailable: profileInput.profileAvailable,
      nativeRuntimeStatusId: nativeRuntime.statusId,
      reasonCode: 'native_runtime_contract_rejected',
    });
  }
  const questionReductionValidation = validatePolicyRuntimeQuestionReduction(plan);

  const runtimeEvidenceInput = {
    libraryProfile: profileInput.libraryProfile,
    operatorIntent: buildOperatorIntent(nativeRuntime.contract),
    profileFreshness: profileInput.profileFreshness,
  };
  const queueProducer = queueTask
    ? buildPolicyRuntimeQueueQuestionReductionProducer({
      task: queueTask,
      runtimeEvidenceInput,
      routing: buildRoutingInput(resolvedLibrary),
      classification: buildClassificationState(result),
      policyEvaluation: buildPolicyEvaluation(nativeRuntime, result),
    })
    : null;

  return buildResult({
    statusId: questionReductionValidation.ok
      ? profileInput.profileAvailable
        ? POLICY_NATIVE_CLASSIFICATION_QUESTION_HANDOFF_STATUS_IDS.READY
        : POLICY_NATIVE_CLASSIFICATION_QUESTION_HANDOFF_STATUS_IDS.PROFILE_UNAVAILABLE
      : POLICY_NATIVE_CLASSIFICATION_QUESTION_HANDOFF_STATUS_IDS.INVALID_RUNTIME_CONTRACT,
    plan,
    queueQuestionReduction: queueProducer?.ok === true
      ? queueProducer.queueQuestionReduction
      : null,
    profileRead: true,
    routingConfigRead: typeof resolveStoredRoutingConfig === 'function',
    profileAvailable: profileInput.profileAvailable,
    nativeRuntimeStatusId: nativeRuntime.statusId,
    reasonCode: profileInput.profileAvailable
      ? 'native_runtime_plan_built'
      : 'stored_profile_unavailable',
  });
}

function buildPolicyNativeClassificationQuestionHandoffAudit(result = {}) {
  const handoff = asObject(result);
  const issues = [];
  const allowedStatuses = new Set(
    Object.values(POLICY_NATIVE_CLASSIFICATION_QUESTION_HANDOFF_STATUS_IDS)
  );
  const plan = handoff.plan;
  const hasPlan = plan && typeof plan === 'object';
  const planValidation = hasPlan ? validatePolicyRuntimeQuestionReduction(plan) : null;
  const sideEffects = asObject(handoff.sideEffects);

  if (!allowedStatuses.has(handoff.statusId)) {
    issues.push({
      riskId: POLICY_NATIVE_CLASSIFICATION_QUESTION_HANDOFF_RISK_IDS.INVALID_DECISION_CONTRACT,
      message: 'Native classification question handoff returned an unknown status.',
    });
  }

  if (handoff.statusId === POLICY_NATIVE_CLASSIFICATION_QUESTION_HANDOFF_STATUS_IDS.READY &&
      planValidation?.ok !== true) {
    issues.push({
      riskId: POLICY_NATIVE_CLASSIFICATION_QUESTION_HANDOFF_RISK_IDS.READY_WITHOUT_VALID_PLAN,
      message: 'A ready native classification handoff must include a valid question-reduction plan.',
    });
  }

  if (handoff.statusId === POLICY_NATIVE_CLASSIFICATION_QUESTION_HANDOFF_STATUS_IDS.NATIVE_INTENT_UNAVAILABLE &&
      hasPlan) {
    issues.push({
      riskId: POLICY_NATIVE_CLASSIFICATION_QUESTION_HANDOFF_RISK_IDS.BLOCKED_WITH_PLAN,
      message: 'A non-native classifier result cannot manufacture a question-reduction plan.',
    });
  }

  if (
    handoff.queueQuestionReduction !== null &&
    buildPolicyRuntimeQueueQuestionReductionAudit(handoff.queueQuestionReduction).ok !== true
  ) {
    issues.push({
      riskId: POLICY_NATIVE_CLASSIFICATION_QUESTION_HANDOFF_RISK_IDS.INVALID_QUEUE_QUESTION_REDUCTION,
      message: 'Native classification handoff can expose queue proof only when the queue question-reduction envelope remains valid.',
    });
  }

  [
    'liveMediaServerLookupPerformed',
    'liveProviderLookupPerformed',
    'providerQuotaRead',
    'classificationWritten',
    'routingExecuted',
    'questionCreated',
    'learningWritten',
    'policyStorageMutated',
  ].forEach(sideEffectId => {
    if (sideEffects[sideEffectId] === true) {
      issues.push({
        riskId: POLICY_NATIVE_CLASSIFICATION_QUESTION_HANDOFF_RISK_IDS.UNSAFE_SIDE_EFFECT,
        message: 'Native classification handoff must not perform workflow side effects.',
        sideEffectId,
      });
    }
  });

  if (JSON.stringify(handoff.summary || {}).match(/title|overview|provider|prompt|embedding/iu)) {
    issues.push({
      riskId: POLICY_NATIVE_CLASSIFICATION_QUESTION_HANDOFF_RISK_IDS.RAW_CLASSIFICATION_DATA_EXPOSED,
      message: 'Native classification handoff summary must not expose raw classification or provider data.',
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function createPolicyNativeClassificationQuestionHandoffService({
  loadProfileEvidence = loadPolicyLibraryProfileEvidence,
  resolveStoredRoutingConfig = resolveRoutingConfig,
} = {}) {
  return {
    build: (input = {}) => buildPolicyNativeClassificationQuestionHandoff({
      ...input,
      loadProfileEvidence,
      resolveStoredRoutingConfig,
    }),
  };
}

const policyNativeClassificationQuestionHandoffService =
  createPolicyNativeClassificationQuestionHandoffService();

export {
  POLICY_NATIVE_CLASSIFICATION_QUESTION_HANDOFF_RISK_IDS,
  POLICY_NATIVE_CLASSIFICATION_QUESTION_HANDOFF_STATUS_IDS,
  POLICY_NATIVE_CLASSIFICATION_QUESTION_HANDOFF_VERSION,
  buildPolicyNativeClassificationQuestionHandoff,
  buildPolicyNativeClassificationQuestionHandoffAudit,
  createPolicyNativeClassificationQuestionHandoffService,
  policyNativeClassificationQuestionHandoffService,
};
