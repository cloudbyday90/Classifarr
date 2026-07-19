/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  POLICY_AUTHORING_OPTION_SOURCE_IDS,
} from './policyAuthoringComponentSystem.mjs';
import {
  POLICY_AUTHORING_DESTINATION_QUESTION_IDS,
} from './policyAuthoringDestinationFlow.mjs';
import {
  validatePolicyAuthoringOptionCandidate,
} from './policyAuthoringOptionSelection.mjs';

const MAX_OBSERVED_SUGGESTIONS = 20;

const OBSERVED_SIGNAL_TYPE_BY_KIND = Object.freeze({
  genre: 'genres',
  studio: 'studios',
  keyword: 'keywords',
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeString(value, maximumLength = 160) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';

  return String(value)
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximumLength);
}

function normalizeCount(value) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : null;
}

function normalizeConfidence(value) {
  const confidence = Number(value);
  return Number.isFinite(confidence)
    ? Math.max(0, Math.min(confidence, 1))
    : null;
}

function getSuggestionKind(key = '') {
  const [kind] = normalizeString(key).split(':', 1);
  return kind || 'observed_signal';
}

function toObservedSuggestion(candidate = {}) {
  const source = asObject(candidate);
  const key = normalizeString(source.key);
  const label = normalizeString(source.label);
  if (!key || !label) return null;

  return {
    key,
    label,
    kind: getSuggestionKind(key),
    count: normalizeCount(source.count),
    confidence: normalizeConfidence(source.confidence),
    sourceId: POLICY_AUTHORING_OPTION_SOURCE_IDS.OBSERVED_IN_LIBRARY,
    requiresExplicitAcceptance: true,
  };
}

function buildObservedSuggestionExplanation({ label, count }) {
  if (count === null) {
    return `${label} appears in the current library profile.`;
  }

  return `${label} appears in ${count} ${count === 1 ? 'item' : 'items'} in the current library.`;
}

/**
 * Produces a separate selectable candidate. The original observation stays
 * evidence-only; this candidate can become intent only after explicit action.
 */
function toSelectableObservedSuggestion(suggestion = {}) {
  const signalType = OBSERVED_SIGNAL_TYPE_BY_KIND[suggestion.kind];
  if (!signalType) return null;

  const candidate = {
    candidateId: `${suggestion.key}:purpose`,
    value: suggestion.label,
    label: suggestion.label,
    sourceId: POLICY_AUTHORING_OPTION_SOURCE_IDS.SUGGESTED_FROM_OBSERVED_PROFILE,
    questionId: POLICY_AUTHORING_DESTINATION_QUESTION_IDS.WHAT_BELONGS_HERE,
    signalType,
    operator: 'require_any',
    explanation: buildObservedSuggestionExplanation(suggestion),
    evidenceCount: suggestion.count ?? 0,
    confidence: suggestion.confidence,
    requiresExplicitAcceptance: true,
    canAutoDeclare: false,
  };

  const validation = validatePolicyAuthoringOptionCandidate(candidate);
  return validation.valid && validation.normalizedCandidate.selectable
    ? {
        ...candidate,
        evidence: validation.normalizedCandidate.evidence,
      }
    : null;
}

function buildPolicyObservedSuggestionProjection(profileHandoff = {}) {
  const observations = asArray(
    profileHandoff?.profileEvidence?.libraryProfile?.compatibilityCandidates
  )
    .map(toObservedSuggestion)
    .filter(Boolean)
    .slice(0, MAX_OBSERVED_SUGGESTIONS);

  return {
    observations,
    selectableSuggestions: observations
      .map(toSelectableObservedSuggestion)
      .filter(Boolean),
  };
}

export {
  MAX_OBSERVED_SUGGESTIONS,
  buildPolicyObservedSuggestionProjection,
  toObservedSuggestion,
  toSelectableObservedSuggestion,
};
