/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  POLICY_CANDIDATE_CORRECTION_OUTCOME_ATTRIBUTION_VERSION,
  buildPolicyCandidateCorrectionOutcomeAttribution,
  buildPolicyCandidateCorrectionOutcomeAttributionProjection,
} from '../../services/policyCandidateCorrectionOutcomeAttribution.mjs';

const signalSnapshot = {
  version: 'policy.candidate_correction_signal_snapshot.v1',
  score_margin_band_id: '5_to_14',
  evidence_source_states: [
    { source_id: 'item_identity', state_id: 'anchored' },
    { source_id: 'declared_policy', state_id: 'supporting' },
    { source_id: 'observed_library_profile', state_id: 'contextual' },
    { source_id: 'similar_item_retrieval', state_id: 'supporting' },
    { source_id: 'confirmed_outcomes', state_id: 'supporting' },
  ],
};

describe('policyCandidateCorrectionOutcomeAttribution', () => {
  test('consumes destination identity in memory and retains only fixed analytics dimensions', () => {
    const attribution = buildPolicyCandidateCorrectionOutcomeAttribution({
      classificationDetails: {
        policy_candidate_correction_signal_snapshot: signalSnapshot,
      },
      answer: { actionId: 'change_destination' },
      candidateDestinations: [{ library_id: 1 }, { library_id: 2 }],
      selectedDestinationLibraryId: 3,
    });

    expect(attribution).toEqual({
      version: POLICY_CANDIDATE_CORRECTION_OUTCOME_ATTRIBUTION_VERSION,
      scoreMarginBandId: '5_to_14',
      selectionStatusId: 'changed_outside_candidates',
      evidenceSourceStates: signalSnapshot.evidence_source_states,
    });
    expect(JSON.stringify(attribution)).not.toContain('"library_id"');
  });

  test('drops malformed snapshots and unknown fields at the write boundary', () => {
    expect(buildPolicyCandidateCorrectionOutcomeAttribution({
      classificationDetails: {
        policy_candidate_correction_signal_snapshot: {
          ...signalSnapshot,
          evidence_source_states: signalSnapshot.evidence_source_states.slice(0, 4),
        },
      },
      answer: { actionId: 'confirm_destination' },
      candidateDestinations: [{ library_id: 1 }, { library_id: 2 }],
      selectedDestinationLibraryId: 1,
    })).toBeNull();

    expect(buildPolicyCandidateCorrectionOutcomeAttributionProjection({
      version: POLICY_CANDIDATE_CORRECTION_OUTCOME_ATTRIBUTION_VERSION,
      scoreMarginBandId: '5_to_14',
      selectionStatusId: 'confirmed_candidate',
      evidenceSourceStates: signalSnapshot.evidence_source_states,
      providerResponse: 'Do not retain',
      destinationLibraryId: 1,
    })).toEqual({
      version: POLICY_CANDIDATE_CORRECTION_OUTCOME_ATTRIBUTION_VERSION,
      score_margin_band_id: '5_to_14',
      selection_status_id: 'confirmed_candidate',
      evidence_source_states: signalSnapshot.evidence_source_states,
    });
  });
});
