/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  buildPolicyScopedEvidenceDigest,
} from '../../services/policyScopedEvidenceDigestContract.mjs';

describe('policyScopedEvidenceDigestContract', () => {
  test('builds a selected-policy-only digest without raw media, rules, profile payloads, or model output', () => {
    const result = buildPolicyScopedEvidenceDigest({
      policy: {
        id: 17,
        name: 'Documentaries',
        library_id: 8,
        library_name: 'Documentaries',
        library_media_type: 'movie',
      },
      activeIntents: [{
        id: 33,
        source: 'native_intent',
        inference_state: 'inferred',
        validation_status: 'valid',
        purpose_rule_count: 2,
        purpose_signal_types: ['genres', 'keywords'],
        hidden_rule_value: 'never-returned',
      }],
      observedProfile: {
        source_id: 'stored_library_profile',
        capture_state: 'captured',
        capture_reason_id: 'stored_profile_captured',
        profile_freshness_state: 'current',
        created_at: '2026-08-01T12:00:00.000Z',
        expires_at: '2026-09-01T12:00:00.000Z',
        payload_redacted: true,
        snapshot_payload: { media_titles: ['never-returned'] },
        evidence_fingerprint: 'a'.repeat(64),
      },
      admittedHistory: [{
        signal_type: 'genres',
        admission_count: 4,
        latest_admission_at: '2026-08-15T12:00:00.000Z',
        source_event_id: 'never-returned',
      }],
      evaluatedAt: '2026-08-16T12:00:00.000Z',
    });

    expect(result).toEqual(expect.objectContaining({
      statusId: 'available',
      policy: {
        id: 17,
        name: 'Documentaries',
        library: { id: 8, name: 'Documentaries', mediaType: 'movie' },
      },
      declaredIntent: expect.objectContaining({
        purposeRuleCount: 2,
        purposeSignalTypes: ['genres', 'keywords'],
        authority: expect.objectContaining({ authoritative: true }),
      }),
      observedLibraryProfile: expect.objectContaining({
        statusId: 'captured',
        freshnessState: 'current',
        payloadRedacted: true,
      }),
      admittedHistory: {
        statusId: 'available',
        windowDays: 90,
        admissionCount: 4,
        signalTypes: [{
          signalType: 'genres',
          admissionCount: 4,
          latestAdmissionAt: '2026-08-15T12:00:00.000Z',
        }],
      },
      uncertaintyReasonIds: [],
      scope: expect.objectContaining({
        policyScoped: true,
        rawMediaExposed: false,
        rawRuleValuesExposed: false,
        rawProfilePayloadExposed: false,
        aiInvoked: false,
        routingAffected: false,
        learningAffected: false,
      }),
    }));
    expect(JSON.stringify(result)).not.toContain('never-returned');
    expect(JSON.stringify(result)).not.toContain('snapshot_payload');
    expect(JSON.stringify(result)).not.toContain('evidence_fingerprint');
  });

  test('retains uncertainty when authority, a current profile, or bounded history is unavailable', () => {
    const result = buildPolicyScopedEvidenceDigest({
      policy: { id: 17, library_id: 8 },
      activeIntents: [],
    });

    expect(result.uncertaintyReasonIds).toEqual([
      'declared_intent_not_authoritative',
      'observed_profile_not_captured',
      'no_policy_authorized_history_in_window',
    ]);
    expect(result.observedLibraryProfile.statusId).toBe('not_observed');
    expect(result.admittedHistory.statusId).toBe('no_policy_authorized_history');
  });
});
