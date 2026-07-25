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
  POLICY_NATIVE_CLASSIFICATION_QUESTION_HANDOFF_STATUS_IDS,
  POLICY_NATIVE_CLASSIFICATION_QUESTION_HANDOFF_VERSION,
  buildPolicyNativeClassificationQuestionHandoffAudit,
} from './policyNativeClassificationQuestionHandoff.mjs';
import {
  buildPolicyRuntimeQuestionReductionFromAutomationDecision,
  validatePolicyRuntimeQuestionReduction,
} from './policyRuntimeQuestionReduction.mjs';
import {
  POLICY_RUNTIME_QUESTION_PERSISTENCE_VERSION,
  isPolicyRuntimeQuestionPersistenceEnvelope,
} from './policyRuntimeQuestionPersistenceContract.mjs';

const POLICY_RUNTIME_QUESTION_PERSISTENCE_ADMISSION_STATUS_IDS = Object.freeze({
  ADMITTED: 'admitted',
  NOT_APPLICABLE: 'not_applicable',
  PRESERVED_EXISTING_QUESTION: 'preserved_existing_question',
  REJECTED: 'rejected',
});

const POLICY_RUNTIME_QUESTION_PERSISTENCE_REASON_IDS = Object.freeze({
  NO_HANDOFF: 'runtime_question_persistence_no_handoff',
  HANDOFF_NOT_READY: 'runtime_question_persistence_handoff_not_ready',
  HANDOFF_AUDIT_FAILED: 'runtime_question_persistence_handoff_audit_failed',
  HANDOFF_SIDE_EFFECT_REPORTED: 'runtime_question_persistence_handoff_side_effect_reported',
  NO_QUESTION_REQUESTED: 'runtime_question_persistence_no_question_requested',
  INVALID_QUESTION_PLAN: 'runtime_question_persistence_invalid_question_plan',
  NO_SELECTED_LIBRARY: 'runtime_question_persistence_no_selected_library',
  EXISTING_QUESTION_PRESERVED: 'runtime_question_persistence_existing_question_preserved',
});

const PROHIBITED_HANDOFF_SIDE_EFFECTS = Object.freeze([
  'liveMediaServerLookupPerformed',
  'liveProviderLookupPerformed',
  'providerQuotaRead',
  'classificationWritten',
  'routingExecuted',
  'questionCreated',
  'learningWritten',
  'policyStorageMutated',
]);

const OPERATOR_REVIEW_REASON =
  'Classifarr needs an operator decision before it can apply this destination.';

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizePositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function normalizeString(value, maximumLength = 160) {
  if (typeof value !== 'string') return '';

  return value
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximumLength);
}

function areEquivalentJsonValues(left, right) {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

function getSelectedLibrary(classificationResult = {}) {
  const library = asObject(classificationResult.library);
  const id = normalizePositiveInteger(library.id ?? library.library_id);

  if (!id) return null;

  return {
    id,
    name: normalizeString(library.name ?? library.library_name) || null,
  };
}

function hasExistingQuestion(classificationResult = {}) {
  const result = asObject(classificationResult);
  return Boolean(result.policy_question || result.clarification);
}

function hasProhibitedSideEffect(handoff = {}) {
  const sideEffects = asObject(handoff.sideEffects);
  return PROHIBITED_HANDOFF_SIDE_EFFECTS.some(sideEffectId => sideEffects[sideEffectId] === true);
}

function rebuildCanonicalPlan(plan = {}) {
  const sourcePlan = asObject(plan);
  const requestedQuestionFrameId = sourcePlan.rejectedFrame?.requestedFrameId;

  return buildPolicyRuntimeQuestionReductionFromAutomationDecision({
    automationDecision: sourcePlan.decision,
    ...(requestedQuestionFrameId ? { requestedQuestionFrameId } : {}),
  });
}

function buildPersistedOptions(question = {}, selectedLibrary = {}) {
  return (Array.isArray(question.options) ? question.options : [])
    .map(option => {
      const outcomeId = normalizeString(option?.outcomeId, 80);
      const label = normalizeString(option?.label, 80);
      if (!outcomeId || !label) return null;

      return {
        label,
        value: outcomeId,
        outcomeId,
        ...(outcomeId === 'resolve_current_item'
          ? {
            library_id: selectedLibrary.id,
            library_name: selectedLibrary.name,
          }
          : {}),
        learningEligible: false,
      };
    })
    .filter(Boolean);
}

function buildPersistedQuestionEnvelope({ plan, selectedLibrary }) {
  const question = asObject(plan.question);
  const operatorQuestion = normalizeString(question.operatorQuestion, 240);
  const reasonId = normalizeString(question.reasonId, 120);
  const decisionStateId = normalizeString(question.decisionStateId, 120);
  const evidenceFingerprint = normalizeString(
    question.decisionEvidenceFingerprint?.fingerprint,
    80,
  );
  const options = buildPersistedOptions(question, selectedLibrary);

  if (!operatorQuestion || !reasonId || !decisionStateId || !evidenceFingerprint || !options.length) {
    return null;
  }

  return {
    version: POLICY_RUNTIME_QUESTION_PERSISTENCE_VERSION,
    question: operatorQuestion,
    why_uncertain: OPERATOR_REVIEW_REASON,
    problem_summary: OPERATOR_REVIEW_REASON,
    options,
    runtimeQuestion: question,
    runtimeQuestionReductionPlan: plan,
    meta: {
      runtime_question_persistence: {
        version: POLICY_RUNTIME_QUESTION_PERSISTENCE_VERSION,
        reasonId,
        decisionStateId,
        evidenceFingerprint,
        destinationLibraryId: selectedLibrary.id,
        destinationLibraryName: selectedLibrary.name,
      },
    },
  };
}

function buildResult({
  statusId,
  reasonId,
  plan = null,
  persistedQuestion = null,
} = {}) {
  const admitted = statusId === POLICY_RUNTIME_QUESTION_PERSISTENCE_ADMISSION_STATUS_IDS.ADMITTED;
  const result = {
    version: POLICY_RUNTIME_QUESTION_PERSISTENCE_VERSION,
    ok: admitted,
    statusId,
    reasonId,
    plan: admitted ? plan : null,
    persistedQuestion: admitted ? persistedQuestion : null,
    classificationPatch: admitted
      ? {
        needs_clarification: true,
        clarification: persistedQuestion,
        policy_question: persistedQuestion,
        pending_reason: OPERATOR_REVIEW_REASON,
      }
      : null,
    sideEffects: {
      classificationPersisted: false,
      questionPersisted: false,
      routingExecuted: false,
      learningWritten: false,
      policyStorageMutated: false,
      providerLookupPerformed: false,
      providerQuotaRead: false,
    },
  };

  return {
    ...result,
    audit: buildPolicyRuntimeQuestionPersistenceAdmissionAudit(result),
  };
}

function buildPolicyRuntimeQuestionPersistenceAdmission({
  classificationResult = {},
  handoff = null,
} = {}) {
  const sourceHandoff = asObject(handoff);

  if (!Object.keys(sourceHandoff).length) {
    return buildResult({
      statusId: POLICY_RUNTIME_QUESTION_PERSISTENCE_ADMISSION_STATUS_IDS.NOT_APPLICABLE,
      reasonId: POLICY_RUNTIME_QUESTION_PERSISTENCE_REASON_IDS.NO_HANDOFF,
    });
  }

  if (
    sourceHandoff.version !== POLICY_NATIVE_CLASSIFICATION_QUESTION_HANDOFF_VERSION ||
    sourceHandoff.statusId !== POLICY_NATIVE_CLASSIFICATION_QUESTION_HANDOFF_STATUS_IDS.READY ||
    sourceHandoff.ok !== true
  ) {
    return buildResult({
      statusId: POLICY_RUNTIME_QUESTION_PERSISTENCE_ADMISSION_STATUS_IDS.NOT_APPLICABLE,
      reasonId: POLICY_RUNTIME_QUESTION_PERSISTENCE_REASON_IDS.HANDOFF_NOT_READY,
    });
  }

  if (sourceHandoff.audit?.ok !== true) {
    return buildResult({
      statusId: POLICY_RUNTIME_QUESTION_PERSISTENCE_ADMISSION_STATUS_IDS.REJECTED,
      reasonId: POLICY_RUNTIME_QUESTION_PERSISTENCE_REASON_IDS.HANDOFF_AUDIT_FAILED,
    });
  }

  if (hasProhibitedSideEffect(sourceHandoff)) {
    return buildResult({
      statusId: POLICY_RUNTIME_QUESTION_PERSISTENCE_ADMISSION_STATUS_IDS.REJECTED,
      reasonId: POLICY_RUNTIME_QUESTION_PERSISTENCE_REASON_IDS.HANDOFF_SIDE_EFFECT_REPORTED,
    });
  }

  if (buildPolicyNativeClassificationQuestionHandoffAudit(sourceHandoff).ok !== true) {
    return buildResult({
      statusId: POLICY_RUNTIME_QUESTION_PERSISTENCE_ADMISSION_STATUS_IDS.REJECTED,
      reasonId: POLICY_RUNTIME_QUESTION_PERSISTENCE_REASON_IDS.HANDOFF_AUDIT_FAILED,
    });
  }

  const planValidation = validatePolicyRuntimeQuestionReduction(sourceHandoff.plan);
  if (planValidation.ok !== true) {
    return buildResult({
      statusId: POLICY_RUNTIME_QUESTION_PERSISTENCE_ADMISSION_STATUS_IDS.REJECTED,
      reasonId: POLICY_RUNTIME_QUESTION_PERSISTENCE_REASON_IDS.INVALID_QUESTION_PLAN,
    });
  }

  if (sourceHandoff.plan?.createQuestion !== true) {
    return buildResult({
      statusId: POLICY_RUNTIME_QUESTION_PERSISTENCE_ADMISSION_STATUS_IDS.NOT_APPLICABLE,
      reasonId: POLICY_RUNTIME_QUESTION_PERSISTENCE_REASON_IDS.NO_QUESTION_REQUESTED,
    });
  }

  if (hasExistingQuestion(classificationResult)) {
    return buildResult({
      statusId: POLICY_RUNTIME_QUESTION_PERSISTENCE_ADMISSION_STATUS_IDS.PRESERVED_EXISTING_QUESTION,
      reasonId: POLICY_RUNTIME_QUESTION_PERSISTENCE_REASON_IDS.EXISTING_QUESTION_PRESERVED,
    });
  }

  const selectedLibrary = getSelectedLibrary(classificationResult);
  if (!selectedLibrary) {
    return buildResult({
      statusId: POLICY_RUNTIME_QUESTION_PERSISTENCE_ADMISSION_STATUS_IDS.REJECTED,
      reasonId: POLICY_RUNTIME_QUESTION_PERSISTENCE_REASON_IDS.NO_SELECTED_LIBRARY,
    });
  }

  let canonicalPlan;
  try {
    canonicalPlan = rebuildCanonicalPlan(sourceHandoff.plan);
  } catch {
    return buildResult({
      statusId: POLICY_RUNTIME_QUESTION_PERSISTENCE_ADMISSION_STATUS_IDS.REJECTED,
      reasonId: POLICY_RUNTIME_QUESTION_PERSISTENCE_REASON_IDS.INVALID_QUESTION_PLAN,
    });
  }

  const canonicalValidation = validatePolicyRuntimeQuestionReduction(canonicalPlan);
  if (canonicalValidation.ok !== true || canonicalPlan.createQuestion !== true) {
    return buildResult({
      statusId: POLICY_RUNTIME_QUESTION_PERSISTENCE_ADMISSION_STATUS_IDS.REJECTED,
      reasonId: POLICY_RUNTIME_QUESTION_PERSISTENCE_REASON_IDS.INVALID_QUESTION_PLAN,
    });
  }

  const persistedQuestion = buildPersistedQuestionEnvelope({
    plan: canonicalPlan,
    selectedLibrary,
  });
  if (!persistedQuestion) {
    return buildResult({
      statusId: POLICY_RUNTIME_QUESTION_PERSISTENCE_ADMISSION_STATUS_IDS.REJECTED,
      reasonId: POLICY_RUNTIME_QUESTION_PERSISTENCE_REASON_IDS.INVALID_QUESTION_PLAN,
    });
  }

  return buildResult({
    statusId: POLICY_RUNTIME_QUESTION_PERSISTENCE_ADMISSION_STATUS_IDS.ADMITTED,
    reasonId: canonicalPlan.question.reasonId,
    plan: canonicalPlan,
    persistedQuestion,
  });
}

function buildPolicyRuntimeQuestionPersistenceAdmissionAudit(result = {}) {
  const admission = asObject(result);
  const issues = [];
  const admitted = admission.statusId ===
    POLICY_RUNTIME_QUESTION_PERSISTENCE_ADMISSION_STATUS_IDS.ADMITTED;
  const patch = asObject(admission.classificationPatch);
  const persistedQuestion = asObject(admission.persistedQuestion);

  if (admission.version !== POLICY_RUNTIME_QUESTION_PERSISTENCE_VERSION) {
    issues.push('invalid_version');
  }

  if (!Object.values(POLICY_RUNTIME_QUESTION_PERSISTENCE_ADMISSION_STATUS_IDS)
    .includes(admission.statusId)) {
    issues.push('invalid_status');
  }

  if (admitted) {
    if (validatePolicyRuntimeQuestionReduction(admission.plan).ok !== true) {
      issues.push('invalid_admitted_plan');
    }
    if (!isPolicyRuntimeQuestionPersistenceEnvelope(persistedQuestion)) {
      issues.push('invalid_persisted_question');
    }
    if (
      !areEquivalentJsonValues(persistedQuestion.runtimeQuestionReductionPlan, admission.plan) ||
      !areEquivalentJsonValues(persistedQuestion.runtimeQuestion, admission.plan?.question)
    ) {
      issues.push('persisted_question_not_canonical');
    }
    if (
      persistedQuestion.meta?.runtime_question_persistence?.evidenceFingerprint !==
      admission.plan?.question?.decisionEvidenceFingerprint?.fingerprint
    ) {
      issues.push('persisted_question_fingerprint_mismatch');
    }
    if (
      patch.needs_clarification !== true ||
      patch.policy_question !== admission.persistedQuestion ||
      patch.clarification !== admission.persistedQuestion
    ) {
      issues.push('invalid_classification_patch');
    }
  } else if (admission.plan || admission.persistedQuestion || admission.classificationPatch) {
    issues.push('non_admitted_payload');
  }

  if (Object.values(asObject(admission.sideEffects)).some(value => value === true)) {
    issues.push('side_effect_reported');
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function createPolicyRuntimeQuestionPersistenceAdmissionService() {
  return {
    admit: (input = {}) => buildPolicyRuntimeQuestionPersistenceAdmission(input),
  };
}

const policyRuntimeQuestionPersistenceAdmissionService =
  createPolicyRuntimeQuestionPersistenceAdmissionService();

export {
  POLICY_RUNTIME_QUESTION_PERSISTENCE_ADMISSION_STATUS_IDS,
  POLICY_RUNTIME_QUESTION_PERSISTENCE_REASON_IDS,
  POLICY_RUNTIME_QUESTION_PERSISTENCE_VERSION,
  buildPolicyRuntimeQuestionPersistenceAdmission,
  buildPolicyRuntimeQuestionPersistenceAdmissionAudit,
  createPolicyRuntimeQuestionPersistenceAdmissionService,
  isPolicyRuntimeQuestionPersistenceEnvelope,
  policyRuntimeQuestionPersistenceAdmissionService,
};
