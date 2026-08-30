/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  POLICY_CANDIDATE_CORRECTION_SIGNAL_SNAPSHOT_VERSION,
  buildPolicyCandidateCorrectionSignalSnapshot,
  buildPolicyCandidateCorrectionSignalSnapshotProjection,
} from '../../services/policyCandidateCorrectionSignalSnapshot.mjs';

const rankedCandidates = [
  {
    library_id: 10,
    library_name: 'Movies',
    score: 80,
    policy_terms: ['Private policy term'],
    candidate_diagnostics: {
      identity_evidence: { status_id: 'positive_specialized_evidence' },
      positive_sources: { profile: true, rag: true, pattern: true },
      rag_evidence_quality: { matches: [{ title: 'Private catalog title' }] },
    },
  },
  { library_id: 11, library_name: 'Documentaries', score: 68 },
];

describe('policyCandidateCorrectionSignalSnapshot', () => {
  test('retains only a leading evidence-state vector and score-margin band', () => {
    const snapshot = buildPolicyCandidateCorrectionSignalSnapshot({
      classification: {
        tmdb_id: 42,
        media_type: 'movie',
        metadata: { overview: 'Private metadata description' },
      },
      rankedCandidates,
      sourceMetadata: { api_key: 'must-not-retain' },
    });

    expect(snapshot).toEqual({
      version: POLICY_CANDIDATE_CORRECTION_SIGNAL_SNAPSHOT_VERSION,
      score_margin_band_id: '5_to_14',
      evidence_source_states: [
        { source_id: 'item_identity', state_id: 'anchored' },
        { source_id: 'declared_policy', state_id: 'supporting' },
        { source_id: 'observed_library_profile', state_id: 'contextual' },
        { source_id: 'similar_item_retrieval', state_id: 'supporting' },
        { source_id: 'confirmed_outcomes', state_id: 'supporting' },
      ],
    });

    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain('Movies');
    expect(serialized).not.toContain('Private policy term');
    expect(serialized).not.toContain('Private catalog title');
    expect(serialized).not.toContain('Private metadata description');
    expect(serialized).not.toContain('must-not-retain');
  });

  test('fails closed when the original comparison or source-state vector is incomplete', () => {
    expect(buildPolicyCandidateCorrectionSignalSnapshot({
      rankedCandidates: rankedCandidates.slice(0, 1),
    })).toBeNull();

    expect(buildPolicyCandidateCorrectionSignalSnapshotProjection({
      version: POLICY_CANDIDATE_CORRECTION_SIGNAL_SNAPSHOT_VERSION,
      score_margin_band_id: '5_to_14',
      evidence_source_states: [
        { source_id: 'item_identity', state_id: 'anchored' },
      ],
    })).toBeNull();
  });
});
