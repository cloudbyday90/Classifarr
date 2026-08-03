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
  QUESTION_FRAME_IDS,
  getAcceptableQuestionFrame,
} from './policyQuestionLearningVocabulary.mjs';
import { isPolicyRuntimeQuestionPersistenceEnvelope } from './policyRuntimeQuestionPersistenceContract.mjs';

const POLICY_RUNTIME_QUESTION_NORMALIZATION_VERSION =
  'policy.runtime_question_normalization.v1';
const MAX_CANDIDATE_DESTINATIONS = 4;
const MAX_LIBRARY_NAME_LENGTH = 160;

const POLICY_RUNTIME_UNCERTAINTY_TYPES = Object.freeze({
  MISSING_IDENTITY_EVIDENCE: 'missing_identity_evidence',
  HARD_CONSTRAINT_CONFLICT: 'hard_constraint_conflict',
  WEAK_OVERLAP: 'weak_overlap',
  RAG_ONLY_SUPPORT: 'rag_only_support',
  PROFILE_ONLY_SUPPORT: 'profile_only_support',
  LANGUAGE_CONFLICT: 'language_conflict',
  ROUTING_GAP: 'routing_gap',
  STALE_PROFILE: 'stale_profile',
  MANUAL_SELECTION_NEEDED: 'manual_selection_needed',
  CONTRACT_VIOLATION: 'contract_violation',
});

const UNCERTAINTY_TYPE_VALUES = new Set(Object.values(POLICY_RUNTIME_UNCERTAINTY_TYPES));

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function normalizeLibraryName(value) {
  if (typeof value !== 'string') return null;

  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized && normalized.length <= MAX_LIBRARY_NAME_LENGTH ? normalized : null;
}

function normalizeReasonCode(value) {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')
    : '';
}

function containsReasonCode(value, terms) {
  const reasonCode = normalizeReasonCode(value);
  return terms.some(term => reasonCode.includes(term));
}

function hasContractViolation(question, result) {
  const questionMeta = asObject(question?.meta);
  const resultQuestion = result?.policy_question || result?.clarification || null;
  const resultMeta = asObject(resultQuestion?.meta);

  return result?.format === 'contract_violation' ||
    result?.contract_violation === true ||
    Boolean(questionMeta.violation_reason || resultMeta.violation_reason);
}

function hasStaleProfile(policyResult, result) {
  const profileFreshness = asObject(
    policyResult?.profileFreshness || policyResult?.profile_freshness ||
    result?.profileFreshness || result?.profile_freshness,
  );
  const decisionDiagnostics = asObject(policyResult?.decisionDiagnostics);

  return profileFreshness.stale === true ||
    profileFreshness.status === 'stale' ||
    containsReasonCode(decisionDiagnostics.reason_code, ['stale_profile', 'profile_stale']);
}

function hasRoutingGap(policyResult, result) {
  const decisionDiagnostics = asObject(policyResult?.decisionDiagnostics);
  const routing = asObject(result?.routing || policyResult?.routing);

  return routing.ready === false || routing.configured === false ||
    containsReasonCode(decisionDiagnostics.reason_code, ['routing_gap', 'routing_not_ready', 'routing_mapping']);
}

function hasHardConstraintConflict(policyResult) {
  const decisionDiagnostics = asObject(policyResult?.decisionDiagnostics);

  return asArray(policyResult?.constraintConflicts).length > 0 ||
    asArray(policyResult?.hardLimitConflicts).length > 0 ||
    containsReasonCode(decisionDiagnostics.reason_code, ['hard_limit', 'hard_constraint', 'constraint_conflict']);
}

function hasLanguageConflict(policyResult) {
  return asArray(policyResult?.languageConflicts).length > 0 ||
    asArray(policyResult?.language_conflicts).length > 0;
}

function getCandidateViabilities(policyResult, question) {
  const ranked = asArray(policyResult?.ranked);
  const persistedCandidates = asArray(question?.meta?.candidates);

  return [...ranked, ...persistedCandidates]
    .map(candidate => candidate?.candidate_diagnostics?.primary_viability ||
      candidate?.candidateDiagnostics?.primary_viability)
    .filter(Boolean);
}

function determineUncertaintyType({ question, result, policyResult }) {
  if (hasContractViolation(question, result)) {
    return POLICY_RUNTIME_UNCERTAINTY_TYPES.CONTRACT_VIOLATION;
  }
  if (hasStaleProfile(policyResult, result)) {
    return POLICY_RUNTIME_UNCERTAINTY_TYPES.STALE_PROFILE;
  }
  if (hasRoutingGap(policyResult, result)) {
    return POLICY_RUNTIME_UNCERTAINTY_TYPES.ROUTING_GAP;
  }
  if (hasHardConstraintConflict(policyResult)) {
    return POLICY_RUNTIME_UNCERTAINTY_TYPES.HARD_CONSTRAINT_CONFLICT;
  }
  if (hasLanguageConflict(policyResult)) {
    return POLICY_RUNTIME_UNCERTAINTY_TYPES.LANGUAGE_CONFLICT;
  }

  const decisionDiagnostics = asObject(policyResult?.decisionDiagnostics);
  const viabilities = getCandidateViabilities(policyResult, question);
  if (viabilities.includes('rag_only')) {
    return POLICY_RUNTIME_UNCERTAINTY_TYPES.RAG_ONLY_SUPPORT;
  }
  if (viabilities.includes('profile_only')) {
    return POLICY_RUNTIME_UNCERTAINTY_TYPES.PROFILE_ONLY_SUPPORT;
  }
  if (viabilities.includes('compatibility_only') ||
      containsReasonCode(decisionDiagnostics.reason_code, ['weak_overlap', 'weak_evidence'])) {
    return POLICY_RUNTIME_UNCERTAINTY_TYPES.WEAK_OVERLAP;
  }

  const hasKnownCandidate = collectCandidateLibraryIds({ question, result, policyResult }).length > 0;
  return hasKnownCandidate
    ? POLICY_RUNTIME_UNCERTAINTY_TYPES.MISSING_IDENTITY_EVIDENCE
    : POLICY_RUNTIME_UNCERTAINTY_TYPES.MANUAL_SELECTION_NEEDED;
}

function collectCandidateLibraryIds({ question, result, policyResult }) {
  const ids = [
    ...asArray(policyResult?.ranked).map(candidate => candidate?.library_id ?? candidate?.id),
    ...asArray(question?.meta?.candidates).map(candidate => candidate?.library_id),
    ...asArray(question?.options).map(option => option?.library_id),
    result?.library?.id ?? result?.library?.library_id,
  ]
    .map(normalizePositiveInteger)
    .filter(Boolean);

  return Array.from(new Set(ids));
}

function buildKnownLibraries(libraries, mediaType) {
  const normalizedMediaType = typeof mediaType === 'string' ? mediaType.trim().toLowerCase() : null;

  return asArray(libraries)
    .map(library => ({
      id: normalizePositiveInteger(library?.id ?? library?.library_id),
      name: normalizeLibraryName(library?.name ?? library?.library_name),
      mediaType: typeof library?.media_type === 'string'
        ? library.media_type.trim().toLowerCase()
        : null,
      isActive: library?.is_active,
    }))
    .filter(library => library.id && library.name)
    .filter(library => library.isActive !== false)
    .filter(library => !normalizedMediaType || !library.mediaType || library.mediaType === normalizedMediaType);
}

function buildCandidateDestinations({ question, result, policyResult, libraries, metadata }) {
  const knownLibraries = buildKnownLibraries(libraries, metadata?.media_type);
  const byId = new Map(knownLibraries.map(library => [library.id, library]));
  const candidateIds = collectCandidateLibraryIds({ question, result, policyResult });
  const candidateDestinations = candidateIds
    .map(id => byId.get(id))
    .filter(Boolean);

  const ordered = candidateDestinations.length > 0 ? candidateDestinations : knownLibraries;
  return ordered.slice(0, MAX_CANDIDATE_DESTINATIONS);
}

function getQuestionFrameId(uncertaintyType) {
  switch (uncertaintyType) {
    case POLICY_RUNTIME_UNCERTAINTY_TYPES.HARD_CONSTRAINT_CONFLICT:
      return QUESTION_FRAME_IDS.HARD_LIMIT_CONFLICT;
    case POLICY_RUNTIME_UNCERTAINTY_TYPES.ROUTING_GAP:
      return QUESTION_FRAME_IDS.ROUTING_GAP;
    case POLICY_RUNTIME_UNCERTAINTY_TYPES.STALE_PROFILE:
      return QUESTION_FRAME_IDS.STALE_PROFILE;
    case POLICY_RUNTIME_UNCERTAINTY_TYPES.MISSING_IDENTITY_EVIDENCE:
      return QUESTION_FRAME_IDS.MISSING_EVIDENCE;
    default:
      return QUESTION_FRAME_IDS.DESTINATION_FIT;
  }
}

function buildWhyUncertain(uncertaintyType) {
  switch (uncertaintyType) {
    case POLICY_RUNTIME_UNCERTAINTY_TYPES.CONTRACT_VIOLATION:
      return 'Automatic classification did not produce a valid decision.';
    case POLICY_RUNTIME_UNCERTAINTY_TYPES.WEAK_OVERLAP:
      return 'Current destination candidates overlap, but the evidence is not strong enough to automate.';
    case POLICY_RUNTIME_UNCERTAINTY_TYPES.RAG_ONLY_SUPPORT:
      return 'Similar-item evidence can support a match, but cannot define the destination by itself.';
    case POLICY_RUNTIME_UNCERTAINTY_TYPES.PROFILE_ONLY_SUPPORT:
      return 'Observed library contents can support a match, but cannot define the destination by themselves.';
    case POLICY_RUNTIME_UNCERTAINTY_TYPES.LANGUAGE_CONFLICT:
      return 'Language evidence conflicts with the current destination candidates.';
    case POLICY_RUNTIME_UNCERTAINTY_TYPES.ROUTING_GAP:
      return 'The destination cannot route automatically until its routing configuration is ready.';
    case POLICY_RUNTIME_UNCERTAINTY_TYPES.STALE_PROFILE:
      return 'The observed library profile is stale and should be refreshed before an automated decision.';
    case POLICY_RUNTIME_UNCERTAINTY_TYPES.MANUAL_SELECTION_NEEDED:
      return 'Classifarr does not have enough current destination evidence to select a library automatically.';
    case POLICY_RUNTIME_UNCERTAINTY_TYPES.HARD_CONSTRAINT_CONFLICT:
      return 'A declared hard limit conflicts with a possible destination.';
    default:
      return 'Current evidence is not strong enough to establish destination identity automatically.';
  }
}

function buildQuestionText(frameId, destinationCount) {
  const frame = getAcceptableQuestionFrame(frameId);
  if (!frame) {
    return 'Does this item belong in this destination?';
  }
  if (frameId === QUESTION_FRAME_IDS.DESTINATION_FIT && destinationCount > 1) {
    return 'Does this item belong in one of these destinations?';
  }
  if (frameId === QUESTION_FRAME_IDS.DESTINATION_FIT && destinationCount === 0) {
    return 'Does this item need a manual destination decision?';
  }
  return frame.operatorQuestion;
}

function buildLearningMetadata() {
  return {
    eligible: false,
    tier: 'blocked',
    requires_learning_guard: true,
    reason: 'runtime_question_normalization_requires_explicit_answer_contract',
  };
}

function buildOptions(destinations) {
  return destinations.map(destination => ({
    label: destination.name,
    value: `library:${destination.id}`,
    library_id: destination.id,
    library_name: destination.name,
  }));
}

function buildCandidateMetadata(destinations, policyResult) {
  const rankedById = new Map(asArray(policyResult?.ranked)
    .map(candidate => [normalizePositiveInteger(candidate?.library_id ?? candidate?.id), candidate])
    .filter(([id]) => id));

  return destinations.map(destination => {
    const ranked = rankedById.get(destination.id) || {};
    return {
      library_id: destination.id,
      library_name: destination.name,
      score: Number.isFinite(Number(ranked.score)) ? Number(ranked.score) : null,
      policy_id: normalizePositiveInteger(ranked.policy_id),
      policy_name: normalizeLibraryName(ranked.policy_name),
      candidate_diagnostics: asObject(ranked.candidate_diagnostics || ranked.candidateDiagnostics),
    };
  });
}

function hasAiDiagnostic(question, result) {
  return Boolean(
    result?.ai_authority ||
    question?.meta?.ai_rationale ||
    result?.format === 'clarify' ||
    result?.format === 'contract_violation',
  );
}

function buildRuntimeQuestion({ question, result, policyResult, libraries, metadata }) {
  const uncertaintyType = determineUncertaintyType({ question, result, policyResult });
  const frameId = getQuestionFrameId(uncertaintyType);
  const destinations = buildCandidateDestinations({
    question,
    result,
    policyResult,
    libraries,
    metadata,
  });
  const options = buildOptions(destinations);

  return {
    type: 'policy',
    problem_summary: getAcceptableQuestionFrame(frameId)?.label || 'Destination fit',
    why_uncertain: buildWhyUncertain(uncertaintyType),
    question: buildQuestionText(frameId, options.length),
    options,
    meta: {
      candidates: buildCandidateMetadata(destinations, policyResult),
      runtime_question_normalization: {
        version: POLICY_RUNTIME_QUESTION_NORMALIZATION_VERSION,
        uncertainty_type: uncertaintyType,
        frame_id: frameId,
        ai_diagnostic_present: hasAiDiagnostic(question, result),
        ai_explanation_retained: false,
        cleanup_required: false,
        learning: buildLearningMetadata(),
      },
    },
    generated_at: new Date().toISOString(),
  };
}

function getRuntimeQuestionNormalizationStatus(question) {
  if (isPolicyRuntimeQuestionPersistenceEnvelope(question)) {
    return {
      actionable: true,
      reason: null,
      contract: 'native_persistence',
    };
  }

  const normalizedQuestion = asObject(question);
  const normalization = asObject(normalizedQuestion.meta?.runtime_question_normalization);
  const meta = asObject(normalizedQuestion.meta);
  const options = asArray(normalizedQuestion.options);
  const optionIds = options.map(option => normalizePositiveInteger(option?.library_id));
  const optionsUseServerIds = options.every((option, index) => {
    const libraryId = optionIds[index];
    const label = normalizeLibraryName(option?.label);
    const libraryName = normalizeLibraryName(option?.library_name);
    return libraryId && option?.value === `library:${libraryId}` &&
      label && libraryName && label === libraryName;
  });
  const allowedMetaKeys = new Set([
    'candidates',
    'question_context',
    'runtime_question_normalization',
  ]);

  if (!Object.keys(normalizedQuestion).length) {
    return { actionable: false, reason: 'missing_question', contract: null };
  }
  if (normalization.version !== POLICY_RUNTIME_QUESTION_NORMALIZATION_VERSION) {
    return { actionable: false, reason: 'normalization_required', contract: null };
  }
  if (normalization.cleanup_required === true) {
    return { actionable: false, reason: 'cleanup_required', contract: 'normalization' };
  }
  if (!UNCERTAINTY_TYPE_VALUES.has(normalization.uncertainty_type)) {
    return { actionable: false, reason: 'invalid_uncertainty_type', contract: 'normalization' };
  }
  if (!getAcceptableQuestionFrame(normalization.frame_id)) {
    return { actionable: false, reason: 'invalid_question_frame', contract: 'normalization' };
  }
  if (normalization.learning?.eligible !== false || normalization.learning?.tier !== 'blocked') {
    return { actionable: false, reason: 'invalid_learning_metadata', contract: 'normalization' };
  }
  if (options.length > MAX_CANDIDATE_DESTINATIONS ||
      new Set(optionIds).size !== optionIds.length ||
      !optionsUseServerIds) {
    return { actionable: false, reason: 'invalid_destination_options', contract: 'normalization' };
  }
  if (Object.keys(meta).some(key => !allowedMetaKeys.has(key))) {
    return { actionable: false, reason: 'invalid_question_metadata', contract: 'normalization' };
  }
  if (normalizedQuestion.question !== buildQuestionText(normalization.frame_id, options.length) ||
      normalizedQuestion.problem_summary !== getAcceptableQuestionFrame(normalization.frame_id)?.label ||
      normalizedQuestion.why_uncertain !== buildWhyUncertain(normalization.uncertainty_type)) {
    return { actionable: false, reason: 'invalid_question_presentation', contract: 'normalization' };
  }

  return { actionable: true, reason: null, contract: 'normalization' };
}

function buildStaleRuntimeQuestionCleanup(question = null) {
  const existingStatus = getRuntimeQuestionNormalizationStatus(question);

  return {
    type: 'policy',
    problem_summary: 'Question refresh required',
    why_uncertain: 'This earlier question does not meet the current runtime-question contract.',
    question: 'Retry classification before making a destination decision.',
    options: [],
    meta: {
      runtime_question_normalization: {
        version: POLICY_RUNTIME_QUESTION_NORMALIZATION_VERSION,
        uncertainty_type: POLICY_RUNTIME_UNCERTAINTY_TYPES.STALE_PROFILE,
        frame_id: QUESTION_FRAME_IDS.STALE_PROFILE,
        ai_diagnostic_present: false,
        ai_explanation_retained: false,
        cleanup_required: true,
        cleanup_reason: existingStatus.reason || 'normalization_required',
        learning: buildLearningMetadata(),
      },
    },
    generated_at: new Date().toISOString(),
  };
}

function normalizePolicyRuntimeQuestion({
  question = null,
  result = {},
  policyResult = null,
  libraries = [],
  metadata = {},
} = {}) {
  if (isPolicyRuntimeQuestionPersistenceEnvelope(question)) {
    return question;
  }

  return buildRuntimeQuestion({
    question: asObject(question),
    result: asObject(result),
    policyResult: asObject(policyResult),
    libraries,
    metadata: asObject(metadata),
  });
}

function requiresRuntimeQuestionCleanup(question) {
  return !getRuntimeQuestionNormalizationStatus(question).actionable;
}

export {
  MAX_CANDIDATE_DESTINATIONS,
  POLICY_RUNTIME_QUESTION_NORMALIZATION_VERSION,
  POLICY_RUNTIME_UNCERTAINTY_TYPES,
  buildStaleRuntimeQuestionCleanup,
  getRuntimeQuestionNormalizationStatus,
  normalizePolicyRuntimeQuestion,
  requiresRuntimeQuestionCleanup,
};
