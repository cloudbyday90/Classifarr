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
  MIN_CONFIRMATION_COUNT,
} from './policyNativeIntentConfirmedOutcomePurposeSuggestionPersistence.mjs';

const POLICY_NATIVE_INTENT_CONFIRMED_OUTCOME_PURPOSE_SUGGESTION_VERSION =
  'policy.native_intent_confirmed_outcome_purpose_suggestion.v1';

const POLICY_NATIVE_INTENT_CONFIRMED_OUTCOME_PURPOSE_SUGGESTION_STATUS_IDS = Object.freeze({
  AVAILABLE: 'native_intent_confirmed_outcome_purpose_suggestion_available',
  POLICY_NOT_FOUND: 'native_intent_confirmed_outcome_purpose_suggestion_policy_not_found',
  AUTHORITY_UNAVAILABLE: 'native_intent_confirmed_outcome_purpose_suggestion_authority_unavailable',
  NO_CONFIRMED_OUTCOMES: 'native_intent_confirmed_outcome_purpose_suggestion_not_available',
  READ_UNAVAILABLE: 'native_intent_confirmed_outcome_purpose_suggestion_unavailable',
});

const MAX_TERM_LENGTH = 120;
const MAX_SUGGESTED_GENRES = 5;

function asPositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function normalizeGenreTerm(value) {
  if (typeof value !== 'string') return null;
  const normalized = [...value.normalize('NFKC')]
    .map(character => {
      const codePoint = character.codePointAt(0);
      return codePoint <= 0x1F || codePoint === 0x7F ? ' ' : character;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized && normalized.length <= MAX_TERM_LENGTH ? normalized : null;
}

function normalizeEvidenceGenre(row = {}) {
  const key = typeof row?.evidence_key === 'string' ? row.evidence_key : '';
  if (!key.startsWith('genre:')) return null;

  const term = normalizeGenreTerm(key.slice('genre:'.length));
  const confirmationCount = asPositiveInteger(row?.confirmation_count);
  return term && confirmationCount && confirmationCount >= MIN_CONFIRMATION_COUNT
    ? { term, confirmationCount }
    : null;
}

function getCurrentGenreTerms(purposeRules = []) {
  const terms = new Set();
  for (const rule of Array.isArray(purposeRules) ? purposeRules : []) {
    if (rule?.signal_type !== 'genres') continue;
    const values = rule?.values && typeof rule.values === 'object' ? rule.values : {};
    for (const valueKey of ['require_any', 'require_all', 'prefer', 'include', 'exclude']) {
      for (const term of Array.isArray(values[valueKey]) ? values[valueKey] : []) {
        const normalized = normalizeGenreTerm(term);
        if (normalized) terms.add(normalized.toLocaleLowerCase('en-US'));
      }
    }
  }
  return terms;
}

function buildSideEffects({ storedPolicyRead = false, storedNativeIntentRead = false, storedOutcomeEvidenceRead = false } = {}) {
  return {
    storedPolicyRead,
    storedNativeIntentRead,
    storedOutcomeEvidenceRead,
    providerAccessed: false,
    policyStorageMutated: false,
    routingAffected: false,
    learningAffected: false,
    databaseWritten: false,
  };
}

function buildResult({
  statusId,
  policyId = null,
  revision = null,
  suggestion = null,
  sideEffects = {},
} = {}) {
  return {
    version: POLICY_NATIVE_INTENT_CONFIRMED_OUTCOME_PURPOSE_SUGGESTION_VERSION,
    statusId,
    available: statusId === POLICY_NATIVE_INTENT_CONFIRMED_OUTCOME_PURPOSE_SUGGESTION_STATUS_IDS.AVAILABLE,
    policyId: asPositiveInteger(policyId),
    revision: asPositiveInteger(revision),
    suggestion,
    authority: {
      source: 'server_owned_native_intent',
      purposeChangeAllowed: false,
      browserAuthorityAccepted: false,
    },
    sideEffects: buildSideEffects(sideEffects),
    rawOutcomeEvidenceExposed: false,
    rawLibraryContentExposed: false,
    compatibilityDataExposed: false,
    aiDataExposed: false,
    retrievalDataExposed: false,
    routingDataExposed: false,
    learningDataExposed: false,
  };
}

function buildSuggestion({ purposeRules, confirmedOutcomeGenres }) {
  const currentTerms = getCurrentGenreTerms(purposeRules);
  const termsByKey = new Map();

  for (const rawEvidence of Array.isArray(confirmedOutcomeGenres) ? confirmedOutcomeGenres : []) {
    const evidence = normalizeEvidenceGenre(rawEvidence);
    if (!evidence) continue;

    const key = evidence.term.toLocaleLowerCase('en-US');
    if (!currentTerms.has(key) && !termsByKey.has(key)) {
      termsByKey.set(key, evidence);
    }
  }

  const terms = [...termsByKey.values()].slice(0, MAX_SUGGESTED_GENRES);
  if (terms.length === 0) return null;

  return {
    sourceId: 'repeated_confirmed_outcomes',
    confirmationCount: terms.reduce((total, evidence) => total + evidence.confirmationCount, 0),
    changeCommand: {
      command_id: 'update_purpose',
      values: [{
        signal_type: 'genres',
        operator: 'require_any',
        values: { require_any: terms.map(evidence => evidence.term) },
        constraint_mode: 'advisory',
        semantics: 'identity',
      }],
    },
  };
}

function buildPolicyNativeIntentConfirmedOutcomePurposeSuggestion({ context = null } = {}) {
  const policyId = asPositiveInteger(context?.policy_id);
  if (!context || !policyId) {
    return buildResult({
      statusId: POLICY_NATIVE_INTENT_CONFIRMED_OUTCOME_PURPOSE_SUGGESTION_STATUS_IDS.POLICY_NOT_FOUND,
      policyId,
      sideEffects: { storedPolicyRead: true },
    });
  }

  const revision = asPositiveInteger(context.activeIntent?.intent_version);
  if (context.authority?.authoritative !== true || !revision) {
    return buildResult({
      statusId: POLICY_NATIVE_INTENT_CONFIRMED_OUTCOME_PURPOSE_SUGGESTION_STATUS_IDS.AUTHORITY_UNAVAILABLE,
      policyId,
      revision,
      sideEffects: { storedPolicyRead: true, storedNativeIntentRead: true },
    });
  }

  const suggestion = buildSuggestion({
    purposeRules: context.purposeRules,
    confirmedOutcomeGenres: context.confirmedOutcomeGenres,
  });
  if (!suggestion) {
    return buildResult({
      statusId: POLICY_NATIVE_INTENT_CONFIRMED_OUTCOME_PURPOSE_SUGGESTION_STATUS_IDS.NO_CONFIRMED_OUTCOMES,
      policyId,
      revision,
      sideEffects: {
        storedPolicyRead: true,
        storedNativeIntentRead: true,
        storedOutcomeEvidenceRead: true,
      },
    });
  }

  return buildResult({
    statusId: POLICY_NATIVE_INTENT_CONFIRMED_OUTCOME_PURPOSE_SUGGESTION_STATUS_IDS.AVAILABLE,
    policyId,
    revision,
    suggestion,
    sideEffects: {
      storedPolicyRead: true,
      storedNativeIntentRead: true,
      storedOutcomeEvidenceRead: true,
    },
  });
}

function buildConfirmedOutcomePurposeSuggestionReadUnavailableResult(policyId = null) {
  return buildResult({
    statusId: POLICY_NATIVE_INTENT_CONFIRMED_OUTCOME_PURPOSE_SUGGESTION_STATUS_IDS.READ_UNAVAILABLE,
    policyId,
    sideEffects: { storedPolicyRead: true },
  });
}

export {
  POLICY_NATIVE_INTENT_CONFIRMED_OUTCOME_PURPOSE_SUGGESTION_STATUS_IDS,
  POLICY_NATIVE_INTENT_CONFIRMED_OUTCOME_PURPOSE_SUGGESTION_VERSION,
  buildConfirmedOutcomePurposeSuggestionReadUnavailableResult,
  buildPolicyNativeIntentConfirmedOutcomePurposeSuggestion,
};
