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
  POLICY_LIBRARY_PROFILE_INITIAL_INTENT_STATUS_IDS,
  buildPolicyLibraryProfileInitialIntentContract,
} from '../../services/policyLibraryProfileInitialIntent.mjs';
import {
  buildPolicyNativeIntentConversionContract,
  POLICY_NATIVE_INTENT_CONVERSION_MODES,
} from '../../services/policyNativeIntentConversionContract.mjs';

const NOW = '2026-07-18T12:00:00.000Z';

function emptyLegacyPolicy(overrides = {}) {
  return {
    id: 4,
    library_id: 8,
    library_name: 'Operator-specific library name',
    library_media_type: 'movie',
    presets: [],
    auto_classify_threshold: 85,
    prompt_threshold: 60,
    libraryProfile: {
      item_count: 48,
      last_generated_at: NOW,
      genre_distribution: {
        Animation: 75,
        Family: 44,
        Adventure: 30,
      },
      studio_distribution: {
        'Studio Example': 33,
      },
    },
    ...overrides,
  };
}

describe('policyLibraryProfileInitialIntent', () => {
  test('builds a bounded native baseline from current connected-library evidence', () => {
    const result = buildPolicyLibraryProfileInitialIntentContract({
      policy: emptyLegacyPolicy(),
      now: NOW,
    });

    expect(result).toEqual(expect.objectContaining({
      statusId: POLICY_LIBRARY_PROFILE_INITIAL_INTENT_STATUS_IDS.READY,
      ready: true,
      sourceId: 'media_server_library_profile',
      contract: expect.objectContaining({
        source: 'native_intent',
        inference_state: 'inferred',
        hard_limits: [],
        avoid: [],
        validation: expect.objectContaining({ valid: true }),
      }),
    }));
    expect(result.contract.purpose).toEqual(expect.arrayContaining([
      expect.objectContaining({
        signal_type: 'genres',
        operator: 'require_any',
        constraint_mode: 'advisory',
        semantics: 'identity',
        source: 'media_server_library_profile',
      }),
      expect.objectContaining({
        signal_type: 'media_type',
        operator: 'require_any',
      }),
    ]));
    expect(JSON.stringify(result.profile)).not.toContain('Animation');
    expect(JSON.stringify(result.profile)).not.toContain('Studio Example');
  });

  test('defers safely when a profile is missing, stale, or lacks identity evidence', () => {
    const missing = buildPolicyLibraryProfileInitialIntentContract({
      policy: emptyLegacyPolicy({ libraryProfile: {} }),
      now: NOW,
    });
    const stale = buildPolicyLibraryProfileInitialIntentContract({
      policy: emptyLegacyPolicy({
        libraryProfile: {
          ...emptyLegacyPolicy().libraryProfile,
          last_generated_at: '2026-07-01T12:00:00.000Z',
        },
      }),
      now: NOW,
    });
    const insufficient = buildPolicyLibraryProfileInitialIntentContract({
      policy: emptyLegacyPolicy({
        libraryProfile: {
          item_count: 4,
          last_generated_at: NOW,
          genre_distribution: {},
        },
      }),
      now: NOW,
    });

    expect(missing.statusId).toBe(POLICY_LIBRARY_PROFILE_INITIAL_INTENT_STATUS_IDS.PROFILE_MISSING);
    expect(stale.statusId).toBe(POLICY_LIBRARY_PROFILE_INITIAL_INTENT_STATUS_IDS.PROFILE_STALE);
    expect(insufficient.statusId).toBe(POLICY_LIBRARY_PROFILE_INITIAL_INTENT_STATUS_IDS.PROFILE_INSUFFICIENT);
    [missing, stale, insufficient].forEach(result => {
      expect(result.ready).toBe(false);
      expect(result.contract.source).toBe('empty');
      expect(result.contract.purpose).toEqual([]);
      expect(result.contract.hard_limits).toEqual([]);
      expect(result.contract.avoid).toEqual([]);
    });
  });

  test('keeps legacy preset conversion separate from profile initialization', () => {
    const result = buildPolicyNativeIntentConversionContract({
      policy: emptyLegacyPolicy({
        presets: [{
          id: 7,
          key: 'family',
          signals: { genres: { require_any: ['Family'] } },
        }],
      }),
      now: NOW,
    });

    expect(result.mode).toBe(POLICY_NATIVE_INTENT_CONVERSION_MODES.LEGACY_PRESET_CONVERSION);
    expect(result.initialization).toBeNull();
    expect(result.contract.source).toBe('legacy_presets');
  });
});
