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
  POLICY_AUTHORING_OPTION_SOURCE_IDS,
} from './policyAuthoringComponentSystem.mjs';
import {
  POLICY_AUTHORING_DESTINATION_QUESTION_IDS,
} from './policyAuthoringDestinationFlow.mjs';
import {
  POLICY_AUTHORING_OPTION_SELECTION_RISK_IDS,
  getPolicyAuthoringOptionSelectionSourceBehavior,
  validatePolicyAuthoringOptionCandidate,
} from './policyAuthoringOptionSelection.mjs';
import {
  getPolicyIntentSignalCustomEntryInputContract,
  isPolicyIntentSignalCustomEntryInputContract,
  isPolicyIntentSignalCustomEntrySignalType,
} from './policyIntentSignalCustomEntry.mjs';

const POLICY_INTENT_SIGNAL_OPTION_PROJECTION_VERSION = 'policy.intent_signal_option_projection.v1';
const MAX_PROJECTED_OPTIONS = 32;
const MAX_PROJECTED_OBSERVED_EVIDENCE = 20;
const MAX_VALUE_LENGTH = 160;
const POLICY_INTENT_SIGNAL_OPTION_PROJECTION_AUDIT_RISK_IDS = Object.freeze({
  INVALID_VERSION: 'invalid_version',
  UNSAFE_AUTHORITY: 'unsafe_authority',
  INVALID_OBSERVED_EVIDENCE: 'invalid_observed_evidence',
  INVALID_OPTION: 'invalid_option',
  TEMPLATE_PAYLOAD_EXPOSED: 'template_payload_exposed',
  INVALID_SOURCE_SUMMARIES: 'invalid_source_summaries',
  INVALID_CUSTOM_ENTRY_INPUT: 'invalid_custom_entry_input',
});
const STARTER_TEMPLATE_PROVENANCE_FIELD_NAMES = Object.freeze([
  'id',
  'key',
  'name',
  'templateId',
  'templateName',
  'template_id',
  'template_name',
  'presetId',
  'preset_id',
  'template',
  'preset',
  'templateAttachment',
  'presetAttachment',
  'attachment',
  'signals',
  'description',
  'category',
  'suggestion_score',
  'suggestion_reasons',
  'suggestion_warnings',
  'match_score',
  'match_reasons',
]);
const OPTION_SOURCE_ORDER = Object.freeze([
  POLICY_AUTHORING_OPTION_SOURCE_IDS.OBSERVED_IN_LIBRARY,
  POLICY_AUTHORING_OPTION_SOURCE_IDS.SUGGESTED_FROM_OBSERVED_PROFILE,
  POLICY_AUTHORING_OPTION_SOURCE_IDS.SUGGESTED_FROM_STARTER_TEMPLATE,
  POLICY_AUTHORING_OPTION_SOURCE_IDS.COMMON_STATIC_OPTION,
  POLICY_AUTHORING_OPTION_SOURCE_IDS.OPERATOR_ADDED_CUSTOM,
  POLICY_AUTHORING_OPTION_SOURCE_IDS.ALREADY_DECLARED,
  POLICY_AUTHORING_OPTION_SOURCE_IDS.UNAVAILABLE_CONFLICTING_INTENT,
]);

const SOURCE_PRIORITY = Object.freeze({
  [POLICY_AUTHORING_OPTION_SOURCE_IDS.SUGGESTED_FROM_OBSERVED_PROFILE]: 400,
  [POLICY_AUTHORING_OPTION_SOURCE_IDS.OPERATOR_ADDED_CUSTOM]: 350,
  [POLICY_AUTHORING_OPTION_SOURCE_IDS.SUGGESTED_FROM_STARTER_TEMPLATE]: 300,
  [POLICY_AUTHORING_OPTION_SOURCE_IDS.COMMON_STATIC_OPTION]: 100,
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function normalizeString(value, maximumLength = MAX_VALUE_LENGTH) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';

  return String(value)
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximumLength);
}

function normalizeSignalType(value) {
  const signalType = normalizeString(value, 40).toLowerCase();
  return isPolicyIntentSignalCustomEntrySignalType(signalType) ? signalType : '';
}

function normalizeEvidence(value = {}) {
  const source = asObject(value);
  const count = Number(source.count ?? source.evidenceCount);
  const confidence = Number(source.confidence);

  return {
    count: Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0,
    confidence: Number.isFinite(confidence)
      ? Math.max(0, Math.min(confidence, 1))
      : null,
  };
}

function buildCandidateId({ sourceId, signalType, value }) {
  const key = `${sourceId}:${signalType}:${value}`
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-');

  return `intent-signal:${key.slice(0, 180)}`;
}

function getCandidateKey(candidate = {}) {
  const signalType = normalizeSignalType(candidate.signalType);
  const value = normalizeString(candidate.value ?? candidate.label).toLocaleLowerCase();
  return signalType && value ? `${signalType}:${value}` : '';
}

function buildSelectableExplanation(sourceId, value, explanation) {
  const normalizedExplanation = normalizeString(explanation);
  if (normalizedExplanation) return normalizedExplanation;

  if (sourceId === POLICY_AUTHORING_OPTION_SOURCE_IDS.COMMON_STATIC_OPTION) {
    return `${value} is a common option. Confirm it reflects this destination before adding it.`;
  }

  return '';
}

function buildSourceSummary(sourceId, options = [], observedEvidence = []) {
  const behavior = getPolicyAuthoringOptionSelectionSourceBehavior(sourceId);
  const sourceOptions = options.filter(option => option.sourceId === sourceId);
  const evidenceCount = observedEvidence.filter(option => option.sourceId === sourceId).length;

  return {
    sourceId,
    sourceLabel: behavior?.visibleGroupLabel || 'Unavailable',
    selectableCount: sourceOptions.filter(option => option.selectable).length,
    disabledCount: sourceOptions.filter(option => !option.selectable).length,
    evidenceCount,
    emitted: sourceOptions.length > 0 || evidenceCount > 0,
  };
}

function exposesStarterTemplateProvenance(option = {}) {
  const source = asObject(option);
  if (source.sourceId !== POLICY_AUTHORING_OPTION_SOURCE_IDS.SUGGESTED_FROM_STARTER_TEMPLATE) {
    return false;
  }

  return STARTER_TEMPLATE_PROVENANCE_FIELD_NAMES.some(fieldName => hasOwn(source, fieldName));
}

function toObservedEvidence(observation = {}) {
  const source = asObject(observation);
  const value = normalizeString(source.value ?? source.label);
  const key = normalizeString(source.key, 180);
  if (!value || !key) return null;

  const validation = validatePolicyAuthoringOptionCandidate({
    ...source,
    sourceId: POLICY_AUTHORING_OPTION_SOURCE_IDS.OBSERVED_IN_LIBRARY,
    value,
    label: normalizeString(source.label) || value,
    questionId: POLICY_AUTHORING_DESTINATION_QUESTION_IDS.WHAT_BELONGS_HERE,
    evidenceCount: source.evidence?.count ?? source.evidenceCount ?? source.count,
    confidence: source.evidence?.confidence ?? source.confidence,
    explanation: normalizeString(source.explanation) || `${value} is observed in this library.`,
    requiresExplicitAcceptance: true,
    canAutoDeclare: false,
  });

  if (!validation.valid || !validation.normalizedCandidate.readOnlyEvidence) return null;

  return {
    ...validation.normalizedCandidate,
    candidateId: `observed:${key}`,
    key,
    kind: normalizeString(source.kind, 80),
  };
}

function toSelectableOption(candidate = {}, sourceId) {
  const source = asObject(candidate);
  const signalType = normalizeSignalType(source.signalType);
  const value = normalizeString(source.value ?? source.label);
  if (!signalType || !value) return null;
  const explanation = buildSelectableExplanation(sourceId, value, source.explanation);

  const validation = validatePolicyAuthoringOptionCandidate({
    ...source,
    sourceId,
    value,
    label: normalizeString(source.label) || value,
    questionId: POLICY_AUTHORING_DESTINATION_QUESTION_IDS.WHAT_BELONGS_HERE,
    explanation,
    evidenceCount: source.evidence?.count ?? source.evidenceCount,
    confidence: source.evidence?.confidence ?? source.confidence,
    requiresExplicitAcceptance: true,
    canAutoDeclare: false,
  });

  if (!validation.valid || !validation.normalizedCandidate.selectable) return null;

  return {
    ...validation.normalizedCandidate,
    candidateId: normalizeString(source.candidateId, 220) || buildCandidateId({ sourceId, signalType, value }),
    signalType,
    operator: 'require_any',
  };
}

function toDisabledOption(candidate = {}, sourceId, fallbackReason) {
  const source = asObject(candidate);
  const signalType = normalizeSignalType(source.signalType);
  const value = normalizeString(source.value ?? source.label);
  if (!signalType || !value) return null;

  const validation = validatePolicyAuthoringOptionCandidate({
    ...source,
    sourceId,
    value,
    label: normalizeString(source.label) || value,
    questionId: POLICY_AUTHORING_DESTINATION_QUESTION_IDS.WHAT_BELONGS_HERE,
    explanation: normalizeString(source.explanation) || fallbackReason,
    disabledReason: normalizeString(source.disabledReason) || fallbackReason,
    requiresExplicitAcceptance: false,
    canAutoDeclare: false,
  });

  if (!validation.valid || validation.normalizedCandidate.selectable) return null;

  return {
    ...validation.normalizedCandidate,
    candidateId: normalizeString(source.candidateId, 220) || buildCandidateId({ sourceId, signalType, value }),
    signalType,
    operator: 'require_any',
  };
}

function toGuardedSelectableOption(candidate = {}, sourceId) {
  const source = asObject(candidate);
  const option = toSelectableOption(source, sourceId);
  if (option) return { option, disabledOption: null };

  const validation = validatePolicyAuthoringOptionCandidate({
    ...source,
    sourceId,
    value: normalizeString(source.value ?? source.label),
    label: normalizeString(source.label ?? source.value),
    questionId: POLICY_AUTHORING_DESTINATION_QUESTION_IDS.WHAT_BELONGS_HERE,
    explanation: buildSelectableExplanation(
      sourceId,
      normalizeString(source.value ?? source.label),
      source.explanation,
    ),
    evidenceCount: source.evidence?.count ?? source.evidenceCount,
    confidence: source.evidence?.confidence ?? source.confidence,
    requiresExplicitAcceptance: true,
    canAutoDeclare: false,
  });

  if (validation.riskId !== POLICY_AUTHORING_OPTION_SELECTION_RISK_IDS.BROAD_GENRE_WITHOUT_SUPPORTING_EVIDENCE) {
    return { option: null, disabledOption: null };
  }

  const disabledOption = toDisabledOption({
    ...source,
    explanation: validation.reason,
    disabledReason: validation.reason,
  }, POLICY_AUTHORING_OPTION_SOURCE_IDS.UNAVAILABLE_CONFLICTING_INTENT, validation.reason);

  return { option: null, disabledOption };
}

function buildObservedEvidenceByCandidateKey(candidates = []) {
  const evidenceByCandidateKey = new Map();

  candidates.forEach((candidate) => {
    const key = getCandidateKey(candidate);
    const evidence = normalizeEvidence(candidate.evidence ?? candidate);

    if (!key || evidence.count <= 0 || evidenceByCandidateKey.has(key)) return;
    evidenceByCandidateKey.set(key, evidence);
  });

  return evidenceByCandidateKey;
}

function addObservedSupportingEvidence(candidate = {}, evidenceByCandidateKey = new Map()) {
  const source = asObject(candidate);
  const evidence = normalizeEvidence(source.evidence ?? source);
  const observedEvidence = evidenceByCandidateKey.get(getCandidateKey(source));

  if (evidence.count > 0 || !observedEvidence) return source;

  return {
    ...source,
    evidence: observedEvidence,
    evidenceCount: observedEvidence.count,
    confidence: observedEvidence.confidence,
  };
}

function selectDisabledOptions(candidates = []) {
  const selected = new Map();

  candidates.forEach((candidate) => {
    const key = getCandidateKey(candidate);
    if (!key || selected.has(key)) return;
    selected.set(key, candidate);
  });

  return Array.from(selected.values());
}

function selectPreferredOptions(candidates = []) {
  const preferred = new Map();

  candidates.forEach((candidate) => {
    const key = getCandidateKey(candidate);
    if (!key) return;

    const existing = preferred.get(key);
    if (!existing || (SOURCE_PRIORITY[candidate.sourceId] || 0) > (SOURCE_PRIORITY[existing.sourceId] || 0)) {
      preferred.set(key, candidate);
    }
  });

  return Array.from(preferred.values());
}

function prioritizeOptionsByCandidateKeys(options = [], candidateKeys = new Set()) {
  if (candidateKeys.size === 0) return options;

  const prioritized = [];
  const remaining = [];
  const addedKeys = new Set();

  options.forEach((option) => {
    const key = getCandidateKey(option);
    if (key && candidateKeys.has(key) && !addedKeys.has(key)) {
      prioritized.push(option);
      addedKeys.add(key);
      return;
    }

    remaining.push(option);
  });

  return [...prioritized, ...remaining];
}

function buildPolicyIntentSignalOptionProjection({
  observedProjection = {},
  starterTemplateSuggestions = [],
  commonOptions = [],
  customValueCandidates = [],
  declaredSignals = [],
  conflictingSignals = [],
} = {}) {
  const observedSuggestionCandidates = asArray(observedProjection.selectableSuggestions);
  const customCandidateKeys = new Set(
    asArray(customValueCandidates).map(getCandidateKey).filter(Boolean),
  );
  const observedEvidenceByCandidateKey = buildObservedEvidenceByCandidateKey(observedSuggestionCandidates);
  const observedEvidence = asArray(observedProjection.observations)
    .map(toObservedEvidence)
    .filter(Boolean)
    .slice(0, MAX_PROJECTED_OBSERVED_EVIDENCE);
  const disabledOptions = selectDisabledOptions([
    ...asArray(declaredSignals).map(candidate => toDisabledOption(
      candidate,
      POLICY_AUTHORING_OPTION_SOURCE_IDS.ALREADY_DECLARED,
      'This value is already declared for this destination.',
    )),
    ...asArray(conflictingSignals).map(candidate => toDisabledOption(
      candidate,
      POLICY_AUTHORING_OPTION_SOURCE_IDS.UNAVAILABLE_CONFLICTING_INTENT,
      'This value conflicts with the current destination intent.',
    )),
  ].filter(Boolean));
  const guardedCandidates = [
    ...observedSuggestionCandidates.map(candidate => toGuardedSelectableOption(
      candidate,
      POLICY_AUTHORING_OPTION_SOURCE_IDS.SUGGESTED_FROM_OBSERVED_PROFILE,
    )),
    ...asArray(customValueCandidates).map(candidate => toGuardedSelectableOption(
      addObservedSupportingEvidence(candidate, observedEvidenceByCandidateKey),
      POLICY_AUTHORING_OPTION_SOURCE_IDS.OPERATOR_ADDED_CUSTOM,
    )),
    ...asArray(starterTemplateSuggestions).map(candidate => toGuardedSelectableOption(
      addObservedSupportingEvidence(candidate, observedEvidenceByCandidateKey),
      POLICY_AUTHORING_OPTION_SOURCE_IDS.SUGGESTED_FROM_STARTER_TEMPLATE,
    )),
    ...asArray(commonOptions).map(candidate => toGuardedSelectableOption(
      addObservedSupportingEvidence(candidate, observedEvidenceByCandidateKey),
      POLICY_AUTHORING_OPTION_SOURCE_IDS.COMMON_STATIC_OPTION,
    )),
  ];
  const guardedDisabledOptions = selectDisabledOptions(guardedCandidates
    .map(result => result.disabledOption)
    .filter(Boolean));
  const blockedKeys = new Set([...disabledOptions, ...guardedDisabledOptions].map(getCandidateKey).filter(Boolean));
  const selectableOptions = selectPreferredOptions(guardedCandidates
    .map(result => result.option)
    .filter(Boolean)
    .filter(option => !blockedKeys.has(getCandidateKey(option))));
  const options = prioritizeOptionsByCandidateKeys([
    ...selectableOptions,
    ...guardedDisabledOptions,
    ...disabledOptions,
  ], customCandidateKeys)
    .slice(0, MAX_PROJECTED_OPTIONS);

  return {
    version: POLICY_INTENT_SIGNAL_OPTION_PROJECTION_VERSION,
    observedEvidence,
    options,
    sourceSummaries: OPTION_SOURCE_ORDER.map(sourceId => buildSourceSummary(sourceId, options, observedEvidence)),
    customEntryInput: getPolicyIntentSignalCustomEntryInputContract(),
    authority: {
      displayProjection: true,
      policyPersistence: false,
      routingExecution: false,
      canAutoDeclareIntent: false,
    },
    rawPayloadExposed: false,
  };
}

function buildPolicyIntentSignalOptionProjectionAudit(projection = {}) {
  const source = asObject(projection);
  const issues = [];
  const observedEvidence = asArray(source.observedEvidence);
  const options = asArray(source.options);

  if (source.version !== POLICY_INTENT_SIGNAL_OPTION_PROJECTION_VERSION) {
    issues.push(POLICY_INTENT_SIGNAL_OPTION_PROJECTION_AUDIT_RISK_IDS.INVALID_VERSION);
  }

  if (source.rawPayloadExposed !== false || source.authority?.canAutoDeclareIntent !== false) {
    issues.push(POLICY_INTENT_SIGNAL_OPTION_PROJECTION_AUDIT_RISK_IDS.UNSAFE_AUTHORITY);
  }

  if (observedEvidence.some(option => (
    option?.sourceId !== POLICY_AUTHORING_OPTION_SOURCE_IDS.OBSERVED_IN_LIBRARY ||
    option?.readOnlyEvidence !== true ||
    option?.requiresExplicitAcceptance !== true ||
    option?.canAutoDeclare !== false
  ))) {
    issues.push(POLICY_INTENT_SIGNAL_OPTION_PROJECTION_AUDIT_RISK_IDS.INVALID_OBSERVED_EVIDENCE);
  }

  if (options.some((option) => {
    const validation = validatePolicyAuthoringOptionCandidate(option);
    return !validation.valid ||
      !option?.candidateId ||
      !normalizeSignalType(option.signalType) ||
      option?.operator !== 'require_any' ||
      option?.questionId !== POLICY_AUTHORING_DESTINATION_QUESTION_IDS.WHAT_BELONGS_HERE ||
      option?.canAutoDeclare !== false;
  })) {
    issues.push(POLICY_INTENT_SIGNAL_OPTION_PROJECTION_AUDIT_RISK_IDS.INVALID_OPTION);
  }

  if (options.some(exposesStarterTemplateProvenance)) {
    issues.push(POLICY_INTENT_SIGNAL_OPTION_PROJECTION_AUDIT_RISK_IDS.TEMPLATE_PAYLOAD_EXPOSED);
  }

  if (asArray(source.sourceSummaries).length !== OPTION_SOURCE_ORDER.length) {
    issues.push(POLICY_INTENT_SIGNAL_OPTION_PROJECTION_AUDIT_RISK_IDS.INVALID_SOURCE_SUMMARIES);
  }

  if (!isPolicyIntentSignalCustomEntryInputContract(source.customEntryInput)) {
    issues.push(POLICY_INTENT_SIGNAL_OPTION_PROJECTION_AUDIT_RISK_IDS.INVALID_CUSTOM_ENTRY_INPUT);
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  MAX_PROJECTED_OBSERVED_EVIDENCE,
  MAX_PROJECTED_OPTIONS,
  OPTION_SOURCE_ORDER,
  POLICY_INTENT_SIGNAL_OPTION_PROJECTION_AUDIT_RISK_IDS,
  POLICY_INTENT_SIGNAL_OPTION_PROJECTION_VERSION,
  buildPolicyIntentSignalOptionProjection,
  buildPolicyIntentSignalOptionProjectionAudit,
};
