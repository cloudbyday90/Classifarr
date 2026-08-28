/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  NATIVE_INTENT_RECONCILIATION_PURPOSE_SUGGESTION_STATUS_IDS,
  NATIVE_INTENT_RECONCILIATION_PURPOSE_SUGGESTION_VERSION,
  buildNativeIntentReconciliationPurposeSuggestion,
} from '../../services/nativeIntentReconciliationPurposeSuggestionContract.mjs';

const NOW = new Date('2026-08-28T16:00:00.000Z');

function buildRecord(overrides = {}) {
  return {
    policy_id: 17,
    policy_name: 'Kids TV Policy',
    library_id: 18,
    library_name: 'Kids TV',
    library_media_type: 'show',
    candidate_status_id: 'no_convertible_intent',
    outcome_state: 'requires_maintenance',
    reason_id: 'no_convertible_intent',
    native_authority_active: false,
    item_count: 44,
    last_generated_at: '2026-08-28T15:00:00.000Z',
    genre_distribution: {
      Animation: 85,
      Family: 72,
      Comedy: 33,
    },
    studio_distribution: {
      'Studio Not Exposed': 40,
    },
    ...overrides,
  };
}

describe('nativeIntentReconciliationPurposeSuggestionContract', () => {
  test('builds a bounded, non-persistent profile purpose suggestion for exactly the actionable maintenance state', () => {
    const suggestion = buildNativeIntentReconciliationPurposeSuggestion({
      record: buildRecord(),
      now: NOW,
    });

    expect(suggestion).toEqual({
      version: NATIVE_INTENT_RECONCILIATION_PURPOSE_SUGGESTION_VERSION,
      statusId: NATIVE_INTENT_RECONCILIATION_PURPOSE_SUGGESTION_STATUS_IDS.AVAILABLE,
      available: true,
      policy: { id: 17, name: 'Kids TV Policy' },
      library: { id: 18, name: 'Kids TV', mediaType: 'show' },
      profile: {
        itemCount: 44,
        generatedAt: '2026-08-28T15:00:00.000Z',
        genreSignalCount: 3,
      },
      suggestion: {
        sourceId: 'current_library_profile',
        rules: [{
          signalType: 'genres',
          operator: 'require_any',
          values: ['Animation', 'Family', 'Comedy'],
          semantics: 'identity',
          constraintMode: 'advisory',
        }],
      },
      rawProfileExposed: false,
      persisted: false,
      routingAffected: false,
      learningAffected: false,
      aiInvoked: false,
    });
    expect(JSON.stringify(suggestion)).not.toContain('Studio Not Exposed');
  });

  test.each([
    ['missing profile', { item_count: null }, NATIVE_INTENT_RECONCILIATION_PURPOSE_SUGGESTION_STATUS_IDS.PROFILE_MISSING],
    ['stale profile', { last_generated_at: '2026-08-20T15:00:00.000Z' }, NATIVE_INTENT_RECONCILIATION_PURPOSE_SUGGESTION_STATUS_IDS.PROFILE_STALE],
    ['insufficient profile', { genre_distribution: {} }, NATIVE_INTENT_RECONCILIATION_PURPOSE_SUGGESTION_STATUS_IDS.PROFILE_INSUFFICIENT],
    ['non-actionable reconciliation state', { reason_id: 'rollback_hold_active' }, NATIVE_INTENT_RECONCILIATION_PURPOSE_SUGGESTION_STATUS_IDS.POLICY_NOT_ACTIONABLE],
    ['active native authority', { native_authority_active: true }, NATIVE_INTENT_RECONCILIATION_PURPOSE_SUGGESTION_STATUS_IDS.NATIVE_AUTHORITY_ACTIVE],
  ])('withholds the suggestion for %s', (_name, overrides, expectedStatusId) => {
    const suggestion = buildNativeIntentReconciliationPurposeSuggestion({
      record: buildRecord(overrides),
      now: NOW,
    });

    expect(suggestion).toEqual(expect.objectContaining({
      statusId: expectedStatusId,
      available: false,
      suggestion: null,
      rawProfileExposed: false,
      persisted: false,
      routingAffected: false,
      learningAffected: false,
      aiInvoked: false,
    }));
  });

  test('does not treat a missing record as a suggestion target', () => {
    expect(buildNativeIntentReconciliationPurposeSuggestion({ record: null, now: NOW }))
      .toEqual(expect.objectContaining({
        statusId: NATIVE_INTENT_RECONCILIATION_PURPOSE_SUGGESTION_STATUS_IDS.POLICY_NOT_FOUND,
        available: false,
        policy: null,
        library: null,
        suggestion: null,
      }));
  });
});
