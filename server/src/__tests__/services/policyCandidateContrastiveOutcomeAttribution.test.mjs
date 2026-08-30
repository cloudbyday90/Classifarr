/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  buildPolicyCandidateContrastiveOutcomeAttribution,
  buildPolicyCandidateContrastiveOutcomeAttributionProjection,
} from '../../services/policyCandidateContrastiveOutcomeAttribution.mjs';

const classificationDetails = {
  candidate_contrastive_evidence: {
    version: 'policy.candidate_contrastive_evidence.v1',
    provenance_id: 'exact_tmdb_current_library_inventory',
    status_id: 'alternative_identity_match',
  },
};
const candidateDestinations = [
  { library_id: 4, library_name: 'Private Movies' },
  { library_id: 8, library_name: 'Private Television' },
];

function buildAttribution(actionId, selectedDestinationLibraryId) {
  return buildPolicyCandidateContrastiveOutcomeAttribution({
    classificationDetails,
    answer: { actionId },
    candidateDestinations,
    selectedDestinationLibraryId,
  });
}

describe('policyCandidateContrastiveOutcomeAttribution', () => {
  test.each([
    ['confirm_destination', 4, 'confirmed_candidate'],
    ['change_destination', 8, 'changed_to_candidate'],
    ['change_destination', 12, 'changed_outside_candidates'],
    ['route_not_applicable', 12, 'routed_not_applicable'],
  ])('attributes %s with fixed contrastive and selection status only', (actionId, libraryId, selectionStatusId) => {
    const attribution = buildAttribution(actionId, libraryId);

    expect(attribution).toEqual({
      version: 'policy.candidate_contrastive_outcome_attribution.v1',
      contrastiveStatusId: 'alternative_identity_match',
      selectionStatusId,
    });
    expect(JSON.stringify(attribution)).not.toContain(String(libraryId));
    expect(JSON.stringify(attribution)).not.toContain('Private Movies');
  });

  test('fails closed without projected contrastive evidence or a bounded validated selection', () => {
    expect(buildPolicyCandidateContrastiveOutcomeAttribution({
      classificationDetails: {},
      answer: { actionId: 'change_destination' },
      candidateDestinations,
      selectedDestinationLibraryId: 12,
    })).toBeNull();
    expect(buildPolicyCandidateContrastiveOutcomeAttribution({
      classificationDetails: {
        candidate_contrastive_evidence: {
          version: 'policy.candidate_contrastive_evidence.v1',
          provenance_id: 'exact_tmdb_current_library_inventory',
          status_id: 'not_applicable',
        },
      },
      answer: { actionId: 'change_destination' },
      candidateDestinations,
      selectedDestinationLibraryId: 12,
    })).toBeNull();
    expect(buildAttribution('untrusted_browser_action', 12)).toBeNull();
  });

  test('persists only the fixed contrastive and selection status pair', () => {
    expect(buildPolicyCandidateContrastiveOutcomeAttributionProjection({
      ...buildAttribution('change_destination', 12),
      destinationLibraryId: 12,
      destinationLibraryName: 'Private Movies',
      catalogTitle: 'Do not persist',
    })).toEqual({
      version: 'policy.candidate_contrastive_outcome_attribution.v1',
      contrastive_status_id: 'alternative_identity_match',
      selection_status_id: 'changed_outside_candidates',
    });
    expect(buildPolicyCandidateContrastiveOutcomeAttributionProjection({
      version: 'policy.candidate_contrastive_outcome_attribution.v1',
      contrastiveStatusId: 'provider_supplied_value',
      selectionStatusId: 'changed_outside_candidates',
    })).toBeNull();
  });
});
