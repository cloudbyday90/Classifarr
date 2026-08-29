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
  POLICY_DESTINATION_COMPETITION_PREVIEW_STATUS_IDS,
  buildPolicyDestinationCompetitionPreview,
} from '../../services/policyDestinationCompetitionPreviewContract.mjs';

describe('policyDestinationCompetitionPreviewContract', () => {
  test('reduces anonymous eligibility booleans to aggregate competition counts', () => {
    const preview = buildPolicyDestinationCompetitionPreview({
      sample: { windowDays: 90, maximumItems: 100, evaluatedItemCount: 4 },
      proposedEligibility: [true, true, false, false],
      competitorEligibility: [false, true, true, false],
      sharedEligibilityExplanation: {
        statusId: 'destination_competition_shared_eligibility_explanation_available',
        categories: [{ categoryId: 'genre_purpose' }],
      },
      activeCompetitorPolicyCount: 3,
      maximumCompetitorPolicies: 25,
      evaluatedAt: '2026-08-29T12:00:00.000Z',
    });

    expect(preview).toMatchObject({
      statusId: POLICY_DESTINATION_COMPETITION_PREVIEW_STATUS_IDS.READY,
      sample: { evaluatedItemCount: 4, rawItemsExposed: false },
      competitors: {
        activePolicyCount: 3,
        maximumPolicyCount: 25,
        identitiesExposed: false,
        configurationExposed: false,
      },
      proposed: { eligibleItemCount: 2 },
      competition: {
        proposedUncontestedEligibleItemCount: 1,
        proposedSharedEligibleItemCount: 1,
        competitorOnlyEligibleItemCount: 1,
        noEligibleCandidateItemCount: 1,
      },
      sharedEligibilityExplanation: {
        statusId: 'destination_competition_shared_eligibility_explanation_available',
      },
      draftRetained: false,
      rawConfigurationExposed: false,
      rawHistoricItemsExposed: false,
      routingAffected: false,
      providerAccessed: false,
      databaseWritten: false,
    });
    expect(JSON.stringify(preview)).not.toContain('Range of Stars');
  });

  test('reports a bounded no-competitor result without claiming routing safety', () => {
    const preview = buildPolicyDestinationCompetitionPreview({
      sample: { evaluatedItemCount: 1 },
      proposedEligibility: [true],
      competitorEligibility: [false],
      activeCompetitorPolicyCount: 0,
      maximumCompetitorPolicies: 25,
    });

    expect(preview.statusId).toBe(
      POLICY_DESTINATION_COMPETITION_PREVIEW_STATUS_IDS.NO_ACTIVE_COMPETITORS,
    );
    expect(preview.guidance.description).toContain('not a routing recommendation');
  });
});
