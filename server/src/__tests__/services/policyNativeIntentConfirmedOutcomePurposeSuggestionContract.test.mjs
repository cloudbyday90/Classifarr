/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_NATIVE_INTENT_CONFIRMED_OUTCOME_PURPOSE_SUGGESTION_STATUS_IDS,
  POLICY_NATIVE_INTENT_CONFIRMED_OUTCOME_PURPOSE_SUGGESTION_VERSION,
  buildPolicyNativeIntentConfirmedOutcomePurposeSuggestion,
} from '../../services/policyNativeIntentConfirmedOutcomePurposeSuggestionContract.mjs';

function activeContext(overrides = {}) {
  return {
    policy_id: 17,
    authority: { authoritative: true },
    activeIntent: { id: 51, intent_version: 3 },
    purposeRules: [{
      signal_type: 'genres',
      operator: 'require_any',
      values: { require_any: ['Animation'] },
    }],
    confirmedOutcomeGenres: [
      { evidence_key: 'genre:animation', confirmation_count: 7 },
      { evidence_key: 'genre:documentary', confirmation_count: 4 },
      { evidence_key: 'genre:drama', confirmation_count: 3 },
    ],
    ...overrides,
  };
}

describe('policyNativeIntentConfirmedOutcomePurposeSuggestionContract', () => {
  test('creates a compact draft from repeated manual outcomes while excluding already declared terms', () => {
    const result = buildPolicyNativeIntentConfirmedOutcomePurposeSuggestion({
      context: activeContext(),
    });

    expect(result).toEqual(expect.objectContaining({
      version: POLICY_NATIVE_INTENT_CONFIRMED_OUTCOME_PURPOSE_SUGGESTION_VERSION,
      statusId: POLICY_NATIVE_INTENT_CONFIRMED_OUTCOME_PURPOSE_SUGGESTION_STATUS_IDS.AVAILABLE,
      available: true,
      policyId: 17,
      revision: 3,
      suggestion: {
        sourceId: 'repeated_confirmed_outcomes',
        confirmationCount: 7,
        changeCommand: {
          command_id: 'update_purpose',
          values: [{
            signal_type: 'genres',
            operator: 'require_any',
            values: { require_any: ['documentary', 'drama'] },
            constraint_mode: 'advisory',
            semantics: 'identity',
          }],
        },
      },
      authority: {
        source: 'server_owned_native_intent',
        purposeChangeAllowed: false,
        browserAuthorityAccepted: false,
      },
      rawOutcomeEvidenceExposed: false,
      rawLibraryContentExposed: false,
      aiDataExposed: false,
      retrievalDataExposed: false,
      routingDataExposed: false,
      learningDataExposed: false,
    }));
    expect(JSON.stringify(result)).not.toContain('evidence_key');
  });

  test.each([
    ['no repeated manual-outcome genre', { confirmedOutcomeGenres: [] }],
    ['only a term already declared', {
      confirmedOutcomeGenres: [{ evidence_key: 'genre:animation', confirmation_count: 3 }],
    }],
    ['a below-threshold row', {
      confirmedOutcomeGenres: [{ evidence_key: 'genre:documentary', confirmation_count: 2 }],
    }],
  ])('withholds a suggestion for %s', (_name, overrides) => {
    const result = buildPolicyNativeIntentConfirmedOutcomePurposeSuggestion({
      context: activeContext(overrides),
    });

    expect(result).toEqual(expect.objectContaining({
      statusId: POLICY_NATIVE_INTENT_CONFIRMED_OUTCOME_PURPOSE_SUGGESTION_STATUS_IDS.NO_CONFIRMED_OUTCOMES,
      available: false,
      suggestion: null,
      rawOutcomeEvidenceExposed: false,
      rawLibraryContentExposed: false,
    }));
  });

  test('fails closed when current native authority is not available', () => {
    const result = buildPolicyNativeIntentConfirmedOutcomePurposeSuggestion({
      context: activeContext({ authority: { authoritative: false } }),
    });

    expect(result).toEqual(expect.objectContaining({
      statusId: POLICY_NATIVE_INTENT_CONFIRMED_OUTCOME_PURPOSE_SUGGESTION_STATUS_IDS.AUTHORITY_UNAVAILABLE,
      available: false,
      suggestion: null,
    }));
  });
});
