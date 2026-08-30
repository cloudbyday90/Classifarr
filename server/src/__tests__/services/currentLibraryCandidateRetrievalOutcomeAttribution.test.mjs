/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  buildCurrentLibraryCandidateRetrievalOutcomeAttribution,
  buildCurrentLibraryCandidateRetrievalOutcomeAttributionProjection,
} from '../../services/currentLibraryCandidateRetrievalOutcomeAttribution.mjs';

const classificationDetails = {
  current_library_candidate_retrieval_telemetry: {
    version: 'current_library.candidate_retrieval_telemetry.v1',
    status_id: 'available',
    latency_band: '25_to_99ms',
    candidate_count: 2,
    matched_candidate_count: 1,
    direct_match_candidate_count: 1,
  },
};
const candidateDestinations = [
  { library_id: 4, library_name: 'Private Movies' },
  { library_id: 8, library_name: 'Private Television' },
];

function buildAttribution(actionId, selectedDestinationLibraryId) {
  return buildCurrentLibraryCandidateRetrievalOutcomeAttribution({
    classificationDetails,
    answer: { actionId },
    candidateDestinations,
    selectedDestinationLibraryId,
  });
}

describe('currentLibraryCandidateRetrievalOutcomeAttribution', () => {
  test.each([
    ['confirm_destination', 4, 'confirmed_candidate'],
    ['change_destination', 8, 'changed_to_candidate'],
    ['change_destination', 12, 'changed_outside_candidates'],
    ['route_not_applicable', 12, 'routed_not_applicable'],
  ])('reduces %s without retaining candidate identity', (actionId, libraryId, statusId) => {
    const attribution = buildAttribution(actionId, libraryId);

    expect(attribution).toEqual({
      version: 'current_library.candidate_retrieval_outcome_attribution.v1',
      statusId,
    });
    expect(JSON.stringify(attribution)).not.toContain(String(libraryId));
    expect(JSON.stringify(attribution)).not.toContain('Private Movies');
  });

  test('fails closed without valid retrieval telemetry, a bounded candidate set, or a validated action', () => {
    expect(buildCurrentLibraryCandidateRetrievalOutcomeAttribution({
      classificationDetails: {},
      answer: { actionId: 'change_destination' },
      candidateDestinations,
      selectedDestinationLibraryId: 12,
    })).toBeNull();
    expect(buildCurrentLibraryCandidateRetrievalOutcomeAttribution({
      classificationDetails,
      answer: { actionId: 'confirm_destination' },
      candidateDestinations: [{ library_id: 4 }],
      selectedDestinationLibraryId: 4,
    })).toBeNull();
    expect(buildAttribution('untrusted_browser_action', 12)).toBeNull();
  });

  test('allow-lists only version and status at persistence', () => {
    expect(buildCurrentLibraryCandidateRetrievalOutcomeAttributionProjection({
      ...buildAttribution('change_destination', 12),
      libraryId: 12,
      libraryName: 'Private Movies',
      providerReason: 'Do not persist',
    })).toEqual({
      version: 'current_library.candidate_retrieval_outcome_attribution.v1',
      status_id: 'changed_outside_candidates',
    });
    expect(buildCurrentLibraryCandidateRetrievalOutcomeAttributionProjection({
      version: 'current_library.candidate_retrieval_outcome_attribution.v1',
      statusId: 'freeform_value',
    })).toBeNull();
  });
});
