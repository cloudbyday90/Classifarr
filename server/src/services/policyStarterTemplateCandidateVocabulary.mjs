/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  POLICY_AUTHORING_COMPONENT_IDS,
} from './policyAuthoringComponentSystem.mjs';
import {
  POLICY_AUTHORING_CONSTRAINT_COMMAND_IDS,
  POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS,
} from './policyAuthoringConstraints.mjs';
import {
  POLICY_AUTHORING_DESTINATION_QUESTION_IDS,
} from './policyAuthoringDestinationFlow.mjs';

const POLICY_STARTER_TEMPLATE_CANDIDATE_BUCKET_IDS = Object.freeze({
  PURPOSE: 'purpose',
  HELPFUL_HINT: 'helpful_hint',
  HARD_LIMIT: 'hard_limit',
  AVOID: 'avoid',
});

const POLICY_STARTER_TEMPLATE_CANDIDATE_PROJECTION_ACTION_IDS = Object.freeze({
  PROJECT_TO_EXISTING_TYPED_CONTROL: 'project_to_existing_typed_control',
  DO_NOT_PROJECT: 'do_not_project',
});

const POLICY_STARTER_TEMPLATE_CANDIDATE_DECISION_REASON_IDS = Object.freeze({
  EXISTING_TYPED_PURPOSE_COMMAND: 'existing_typed_purpose_command',
  HELPFUL_CONTROL_NOT_IMPLEMENTED: 'helpful_control_not_implemented',
  HARD_LIMIT_SEMANTICS_DO_NOT_MATCH: 'hard_limit_semantics_do_not_match',
  HARD_LIMIT_CONTROL_NOT_IMPLEMENTED: 'hard_limit_control_not_implemented',
  AVOID_CANDIDATE_INPUT_NOT_IMPLEMENTED: 'avoid_candidate_input_not_implemented',
  AVOID_CONTROL_NOT_IMPLEMENTED: 'avoid_control_not_implemented',
  UNSUPPORTED_TEMPLATE_VOCABULARY: 'unsupported_template_vocabulary',
});

const PURPOSE_TEMPLATE_SIGNAL_TYPES = Object.freeze([
  'genres',
  'keywords',
  'studios',
]);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);
  Object.values(value).forEach(item => deepFreeze(item));
  return value;
}

function normalizeIdentifier(value) {
  if (typeof value !== 'string') return '';

  return value
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .slice(0, 80);
}

const POLICY_STARTER_TEMPLATE_CANDIDATE_VOCABULARY = deepFreeze([
  ...PURPOSE_TEMPLATE_SIGNAL_TYPES.map(signalTypeId => ({
    id: `purpose-${signalTypeId}-require-any`,
    signalTypeId,
    operatorId: 'require_any',
    candidateBucketId: POLICY_STARTER_TEMPLATE_CANDIDATE_BUCKET_IDS.PURPOSE,
    projectionActionId: POLICY_STARTER_TEMPLATE_CANDIDATE_PROJECTION_ACTION_IDS
      .PROJECT_TO_EXISTING_TYPED_CONTROL,
    questionId: POLICY_AUTHORING_DESTINATION_QUESTION_IDS.WHAT_BELONGS_HERE,
    componentId: POLICY_AUTHORING_COMPONENT_IDS.INTENT_SIGNAL_PICKER,
    constraintControlId: null,
    commandId: 'add_signal_value',
    candidateInputContractAvailable: true,
    explicitOperatorConfirmationRequired: false,
    decisionReasonId: POLICY_STARTER_TEMPLATE_CANDIDATE_DECISION_REASON_IDS
      .EXISTING_TYPED_PURPOSE_COMMAND,
  })),
  {
    id: 'helpful-prefer',
    signalTypeId: null,
    operatorId: 'prefer',
    candidateBucketId: POLICY_STARTER_TEMPLATE_CANDIDATE_BUCKET_IDS.HELPFUL_HINT,
    projectionActionId: POLICY_STARTER_TEMPLATE_CANDIDATE_PROJECTION_ACTION_IDS.DO_NOT_PROJECT,
    questionId: POLICY_AUTHORING_DESTINATION_QUESTION_IDS.WHAT_HELPS_BUT_DOES_NOT_DECIDE,
    componentId: null,
    constraintControlId: null,
    commandId: null,
    candidateInputContractAvailable: false,
    explicitOperatorConfirmationRequired: false,
    decisionReasonId: POLICY_STARTER_TEMPLATE_CANDIDATE_DECISION_REASON_IDS
      .HELPFUL_CONTROL_NOT_IMPLEMENTED,
  },
  {
    id: 'hard-limit-certifications-include',
    signalTypeId: 'certifications',
    operatorId: 'include',
    candidateBucketId: POLICY_STARTER_TEMPLATE_CANDIDATE_BUCKET_IDS.HARD_LIMIT,
    projectionActionId: POLICY_STARTER_TEMPLATE_CANDIDATE_PROJECTION_ACTION_IDS.DO_NOT_PROJECT,
    questionId: POLICY_AUTHORING_DESTINATION_QUESTION_IDS.WHAT_SHOULD_NOT_GO_HERE,
    componentId: POLICY_AUTHORING_COMPONENT_IDS.HARD_LIMIT_CONTROL,
    constraintControlId: POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS.HARD_LIMIT,
    commandId: POLICY_AUTHORING_CONSTRAINT_COMMAND_IDS.SET_HARD_LIMIT,
    candidateInputContractAvailable: false,
    explicitOperatorConfirmationRequired: true,
    decisionReasonId: POLICY_STARTER_TEMPLATE_CANDIDATE_DECISION_REASON_IDS
      .HARD_LIMIT_SEMANTICS_DO_NOT_MATCH,
  },
  {
    id: 'hard-limit-range',
    signalTypeId: null,
    operatorId: 'range_bound',
    candidateBucketId: POLICY_STARTER_TEMPLATE_CANDIDATE_BUCKET_IDS.HARD_LIMIT,
    projectionActionId: POLICY_STARTER_TEMPLATE_CANDIDATE_PROJECTION_ACTION_IDS.DO_NOT_PROJECT,
    questionId: POLICY_AUTHORING_DESTINATION_QUESTION_IDS.WHAT_SHOULD_NOT_GO_HERE,
    componentId: null,
    constraintControlId: null,
    commandId: null,
    candidateInputContractAvailable: false,
    explicitOperatorConfirmationRequired: true,
    decisionReasonId: POLICY_STARTER_TEMPLATE_CANDIDATE_DECISION_REASON_IDS
      .HARD_LIMIT_CONTROL_NOT_IMPLEMENTED,
  },
  {
    id: 'avoid-certifications-exclude',
    signalTypeId: 'certifications',
    operatorId: 'exclude',
    candidateBucketId: POLICY_STARTER_TEMPLATE_CANDIDATE_BUCKET_IDS.AVOID,
    projectionActionId: POLICY_STARTER_TEMPLATE_CANDIDATE_PROJECTION_ACTION_IDS.DO_NOT_PROJECT,
    questionId: POLICY_AUTHORING_DESTINATION_QUESTION_IDS.WHAT_SHOULD_NOT_GO_HERE,
    componentId: POLICY_AUTHORING_COMPONENT_IDS.AVOID_CONTROL,
    constraintControlId: POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS.AVOID,
    commandId: POLICY_AUTHORING_CONSTRAINT_COMMAND_IDS.ADD_AVOID_VALUE,
    candidateInputContractAvailable: false,
    explicitOperatorConfirmationRequired: true,
    decisionReasonId: POLICY_STARTER_TEMPLATE_CANDIDATE_DECISION_REASON_IDS
      .AVOID_CANDIDATE_INPUT_NOT_IMPLEMENTED,
  },
  {
    id: 'avoid-exclude',
    signalTypeId: null,
    operatorId: 'exclude',
    candidateBucketId: POLICY_STARTER_TEMPLATE_CANDIDATE_BUCKET_IDS.AVOID,
    projectionActionId: POLICY_STARTER_TEMPLATE_CANDIDATE_PROJECTION_ACTION_IDS.DO_NOT_PROJECT,
    questionId: POLICY_AUTHORING_DESTINATION_QUESTION_IDS.WHAT_SHOULD_NOT_GO_HERE,
    componentId: null,
    constraintControlId: null,
    commandId: null,
    candidateInputContractAvailable: false,
    explicitOperatorConfirmationRequired: true,
    decisionReasonId: POLICY_STARTER_TEMPLATE_CANDIDATE_DECISION_REASON_IDS
      .AVOID_CONTROL_NOT_IMPLEMENTED,
  },
  {
    id: 'unsupported-template-vocabulary',
    signalTypeId: null,
    operatorId: null,
    candidateBucketId: null,
    projectionActionId: POLICY_STARTER_TEMPLATE_CANDIDATE_PROJECTION_ACTION_IDS.DO_NOT_PROJECT,
    questionId: null,
    componentId: null,
    constraintControlId: null,
    commandId: null,
    candidateInputContractAvailable: false,
    explicitOperatorConfirmationRequired: false,
    decisionReasonId: POLICY_STARTER_TEMPLATE_CANDIDATE_DECISION_REASON_IDS
      .UNSUPPORTED_TEMPLATE_VOCABULARY,
  },
]);

function matchesVocabularyEntry(entry, { signalTypeId, operatorId }) {
  return (
    (entry.signalTypeId === null || entry.signalTypeId === signalTypeId) &&
    (entry.operatorId === null || entry.operatorId === operatorId)
  );
}

function getPolicyStarterTemplateCandidateVocabularyDecision({ signalType, operator } = {}) {
  const signalTypeId = normalizeIdentifier(signalType);
  let operatorId = normalizeIdentifier(operator);

  if (
    ['max', 'min', 'max_minutes', 'min_minutes'].includes(operatorId) ||
    ['release_year', 'runtime', 'vote_average'].includes(signalTypeId)
  ) {
    operatorId = 'range_bound';
  }

  return POLICY_STARTER_TEMPLATE_CANDIDATE_VOCABULARY.find(entry =>
    matchesVocabularyEntry(entry, { signalTypeId, operatorId })
  );
}

function listPolicyStarterTemplateCandidateVocabulary() {
  return POLICY_STARTER_TEMPLATE_CANDIDATE_VOCABULARY;
}

function listPolicyStarterTemplatePurposeCandidateSignalEntries() {
  return POLICY_STARTER_TEMPLATE_CANDIDATE_VOCABULARY.filter(entry =>
    entry.projectionActionId ===
      POLICY_STARTER_TEMPLATE_CANDIDATE_PROJECTION_ACTION_IDS.PROJECT_TO_EXISTING_TYPED_CONTROL
  );
}

function canProjectPolicyStarterTemplateCandidate({ signalType, operator } = {}) {
  return getPolicyStarterTemplateCandidateVocabularyDecision({ signalType, operator })
    ?.projectionActionId ===
      POLICY_STARTER_TEMPLATE_CANDIDATE_PROJECTION_ACTION_IDS.PROJECT_TO_EXISTING_TYPED_CONTROL;
}

export {
  POLICY_STARTER_TEMPLATE_CANDIDATE_BUCKET_IDS,
  POLICY_STARTER_TEMPLATE_CANDIDATE_DECISION_REASON_IDS,
  POLICY_STARTER_TEMPLATE_CANDIDATE_PROJECTION_ACTION_IDS,
  canProjectPolicyStarterTemplateCandidate,
  getPolicyStarterTemplateCandidateVocabularyDecision,
  listPolicyStarterTemplateCandidateVocabulary,
  listPolicyStarterTemplatePurposeCandidateSignalEntries,
};
