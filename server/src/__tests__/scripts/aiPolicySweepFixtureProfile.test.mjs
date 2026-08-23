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
  buildAiClassificationEvaluationPolicyContext,
} from '../../services/aiClassificationEvaluationPolicyContext.mjs';
import {
  AI_POLICY_SWEEP_FIXTURE_PROFILE_VERSION,
  appendAiPolicySweepFixtureProfile,
  validateAiPolicySweepFixtureProfile,
  verifyAiPolicySweepFixtureProfileBinding,
} from '../../../../scripts/lib/aiPolicySweepFixtureProfile.mjs';
import {
  validateAiPolicySweepFixtureDocument,
} from '../../../../scripts/lib/aiPolicySweepFixtureDocument.mjs';

function createFixture({ id = 'reviewed-destination' } = {}) {
  return {
    version: 'classifarr.ai_classification_evaluation_fixture.v1',
    id,
    name: 'Reviewed destination fixture',
    tags: ['local-policy-profile', 'destination', 'movie'],
    request: { tmdbId: 550, mediaType: 'movie', title: 'Fight Club' },
    expected: {
      fallbackAllowed: false,
      outcomes: [{
        decisionKind: 'classified',
        methods: ['policy_engine'],
        historyStatuses: ['completed'],
        library: { id: 7, name: 'Movies' },
        confidence: { minimum: 80, maximum: 100 },
      }],
    },
  };
}

function createProfile(policyContext, fixture = createFixture()) {
  return {
    version: AI_POLICY_SWEEP_FIXTURE_PROFILE_VERSION,
    policyContext: {
      version: policyContext.version,
      algorithm: policyContext.algorithm,
      fingerprint: policyContext.fingerprint,
    },
    fixtures: [fixture],
  };
}

describe('AI policy sweep fixture profile', () => {
  test('accepts a reviewed local profile and exposes bounded metadata only', () => {
    const policyContext = buildAiClassificationEvaluationPolicyContext({
      policies: [{ policy: { id: 7, enabled: true } }],
    });
    const profile = createProfile(policyContext);

    expect(validateAiPolicySweepFixtureProfile(profile)).toEqual({
      fixtureCount: 1,
      issues: [],
      ok: true,
    });

    const appended = appendAiPolicySweepFixtureProfile({
      fixtureDocument: [{ name: 'Legacy', tmdb_id: 1, media_type: 'movie', title: 'Legacy' }],
      profile,
    });

    expect(appended.fixtureDocument).toHaveLength(2);
    expect(appended.profileMetadata).toEqual({
      fixtureCount: 1,
      policyContext: {
        algorithm: 'sha256',
        fingerprint: policyContext.fingerprint,
        version: policyContext.version,
      },
      version: AI_POLICY_SWEEP_FIXTURE_PROFILE_VERSION,
    });
    expect(JSON.stringify(appended.profileMetadata)).not.toContain('Fight Club');
    expect(validateAiPolicySweepFixtureDocument(appended.fixtureDocument).ok).toBe(true);
  });

  test('fails closed on unexpected profile data and malformed policy fingerprint', () => {
    const policyContext = buildAiClassificationEvaluationPolicyContext();
    const profile = createProfile(policyContext);
    profile.operatorNote = 'must not be retained';
    profile.policyContext.fingerprint = 'not-a-fingerprint';

    const validation = validateAiPolicySweepFixtureProfile(profile);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'unknown_fixture_profile_field', path: 'profile.operatorNote' }),
      expect.objectContaining({ id: 'invalid_profile_policy_context_fingerprint' }),
    ]));
  });

  test('does not allow a duplicate profile fixture ID to bypass full-document validation', () => {
    const policyContext = buildAiClassificationEvaluationPolicyContext();
    const profile = createProfile(policyContext, createFixture({ id: 'shared-fixture' }));
    const appended = appendAiPolicySweepFixtureProfile({
      fixtureDocument: [createFixture({ id: 'shared-fixture' })],
      profile,
    });

    expect(appended.validation.ok).toBe(true);
    expect(validateAiPolicySweepFixtureDocument(appended.fixtureDocument)).toEqual(
      expect.objectContaining({
        ok: false,
        issues: expect.arrayContaining([
          expect.objectContaining({ id: 'duplicate_evaluation_fixture_id' }),
        ]),
      }),
    );
  });

  test('requires an exact active policy-context fingerprint match before execution', () => {
    const expectedContext = buildAiClassificationEvaluationPolicyContext({
      policies: [{ policy: { id: 7, enabled: true } }],
    });
    const currentContext = buildAiClassificationEvaluationPolicyContext({
      policies: [{ policy: { id: 8, enabled: true } }],
    });
    const appended = appendAiPolicySweepFixtureProfile({
      fixtureDocument: [],
      profile: createProfile(expectedContext),
    });

    expect(verifyAiPolicySweepFixtureProfileBinding({
      profileMetadata: appended.profileMetadata,
      policyContext: expectedContext,
    })).toEqual({ ok: true, reasonId: 'policy_context_fingerprint_match' });
    expect(verifyAiPolicySweepFixtureProfileBinding({
      profileMetadata: appended.profileMetadata,
      policyContext: currentContext,
    })).toEqual({ ok: false, reasonId: 'policy_context_fingerprint_mismatch' });
  });
});
