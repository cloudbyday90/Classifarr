/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  POLICY_OBSERVED_EVIDENCE_PROVENANCE_CAPTURE_STATES,
  POLICY_OBSERVED_EVIDENCE_PROVENANCE_FRESHNESS_STATES,
  POLICY_OBSERVED_EVIDENCE_PROVENANCE_REASON_IDS,
  POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_DAYS,
  buildObservedEvidenceProvenanceSnapshot,
} from '../../services/policyObservedEvidenceProvenanceContract.mjs';

const NOW = '2026-07-22T12:00:00.000Z';

function profile(overrides = {}) {
  return {
    library_id: 6,
    item_count: 48,
    enriched_count: 48,
    genre_distribution: { Animation: 91.67, Family: 64.58 },
    rating_distribution: { PG: 45.83, G: 37.5 },
    studio_distribution: { Disney: 75 },
    keyword_distribution: { adventure: 52.08 },
    exclusion_ratings: ['R'],
    exclusion_genres: [],
    exclusion_keywords: [],
    last_generated_at: '2026-07-22T11:58:00.000Z',
    updated_at: '2026-07-22T11:59:00.000Z',
    ...overrides,
  };
}

describe('policyObservedEvidenceProvenanceContract', () => {
  test('captures one bounded observed profile projection without granting policy authority', () => {
    const result = buildObservedEvidenceProvenanceSnapshot({ profile: profile(), now: NOW });
    const serialized = JSON.stringify(result);

    expect(result).toEqual(expect.objectContaining({
      captureState: POLICY_OBSERVED_EVIDENCE_PROVENANCE_CAPTURE_STATES.CAPTURED,
      captureReasonId: POLICY_OBSERVED_EVIDENCE_PROVENANCE_REASON_IDS.STORED_PROFILE_CAPTURED,
      profileFreshnessState: POLICY_OBSERVED_EVIDENCE_PROVENANCE_FRESHNESS_STATES.CURRENT,
      evidenceFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      expiresAt: '2026-08-05T12:00:00.000Z',
    }));
    expect(result.snapshotPayload).toEqual(expect.objectContaining({
      classification: 'observed_context_not_policy_authority',
      source: expect.objectContaining({
        authority_source_id: 'media_server_contents',
        authority_level: 'observed_evidence',
        durable_policy_authority: false,
      }),
      evidence: expect.objectContaining({ available: true }),
    }));
    expect(result.snapshotPayload.evidence.projection.buckets.identity_evidence).toEqual([]);
    expect(serialized).not.toContain('operator_declared_intent');
    expect(serialized).not.toContain('raw_provider_payload');
    expect(serialized).not.toContain('live_provider_lookup');
  });

  test('records profile absence as an auditable non-authoritative state without blocking establishment', () => {
    const result = buildObservedEvidenceProvenanceSnapshot({ profile: null, now: NOW });

    expect(result).toEqual(expect.objectContaining({
      captureState: POLICY_OBSERVED_EVIDENCE_PROVENANCE_CAPTURE_STATES.PROFILE_UNAVAILABLE,
      captureReasonId: POLICY_OBSERVED_EVIDENCE_PROVENANCE_REASON_IDS.STORED_PROFILE_MISSING,
      profileFreshnessState: POLICY_OBSERVED_EVIDENCE_PROVENANCE_FRESHNESS_STATES.UNAVAILABLE,
    }));
    expect(result.snapshotPayload.evidence).toEqual({ available: false });
    expect(result.snapshotPayload.capture).toEqual({
      state: 'profile_unavailable',
      reason_id: 'stored_profile_missing',
    });
  });

  test('retains stale provenance as observed context rather than pretending it is current', () => {
    const result = buildObservedEvidenceProvenanceSnapshot({
      profile: profile({ last_generated_at: '2026-07-01T12:00:00.000Z' }),
      now: NOW,
    });

    expect(result.captureState).toBe(POLICY_OBSERVED_EVIDENCE_PROVENANCE_CAPTURE_STATES.CAPTURED);
    expect(result.profileFreshnessState).toBe(
      POLICY_OBSERVED_EVIDENCE_PROVENANCE_FRESHNESS_STATES.STALE
    );
    expect(result.snapshotPayload.source.profile_freshness.state).toBe('stale');
  });

  test('produces a deterministic digest for equivalent observed profile values', () => {
    const first = buildObservedEvidenceProvenanceSnapshot({
      profile: profile({ genre_distribution: { Family: 64.58, Animation: 91.67 } }),
      now: NOW,
    });
    const second = buildObservedEvidenceProvenanceSnapshot({
      profile: profile({ genre_distribution: { Animation: 91.67, Family: 64.58 } }),
      now: NOW,
    });

    expect(first.evidenceFingerprint).toBe(second.evidenceFingerprint);
    expect(POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_DAYS).toBe(14);
  });
});
