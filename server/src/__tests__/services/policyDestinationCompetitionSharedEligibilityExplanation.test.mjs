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
  POLICY_DESTINATION_COMPETITION_SHARED_ELIGIBILITY_EXPLANATION_STATUS_IDS,
  buildPolicyDestinationCompetitionSharedEligibilityExplanation,
} from '../../services/policyDestinationCompetitionSharedEligibilityExplanation.mjs';

function contract(signalTypes = []) {
  return {
    purpose: signalTypes.map(signal_type => ({ signal_type })),
  };
}

describe('policyDestinationCompetitionSharedEligibilityExplanation', () => {
  test('returns only allow-listed purpose categories and anonymous competitor counts', () => {
    const explanation = buildPolicyDestinationCompetitionSharedEligibilityExplanation({
      sharedEligibleItemCount: 3,
      proposedContract: contract(['genres', 'studios']),
      competitorContracts: [
        contract(['genres']),
        contract(['genres', 'media_type']),
        contract(['keywords']),
      ],
    });

    expect(explanation).toMatchObject({
      statusId: POLICY_DESTINATION_COMPETITION_SHARED_ELIGIBILITY_EXPLANATION_STATUS_IDS.AVAILABLE,
      categories: [{
        categoryId: 'genre_purpose',
        label: 'Genre-based declared purpose',
        configuredCompetitorPolicyCount: 2,
      }],
      proposedTermsExposed: false,
      competitorTermsExposed: false,
      competitorIdentitiesExposed: false,
      rawRulesExposed: false,
      itemOutcomesExposed: false,
      routingAffected: false,
      providerAccessed: false,
      databaseWritten: false,
    });
    expect(JSON.stringify(explanation)).not.toContain('Comedy');
    expect(JSON.stringify(explanation)).not.toContain('Range of Stars');
  });

  test('does not disclose configured categories when the cohort has no shared eligibility', () => {
    const explanation = buildPolicyDestinationCompetitionSharedEligibilityExplanation({
      sharedEligibleItemCount: 0,
      proposedContract: contract(['genres']),
      competitorContracts: [contract(['genres'])],
    });

    expect(explanation.statusId).toBe(
      POLICY_DESTINATION_COMPETITION_SHARED_ELIGIBILITY_EXPLANATION_STATUS_IDS.NO_SHARED_ELIGIBILITY,
    );
    expect(explanation.categories).toEqual([]);
  });

  test('does not claim a common category when shared eligibility uses different purpose categories', () => {
    const explanation = buildPolicyDestinationCompetitionSharedEligibilityExplanation({
      sharedEligibleItemCount: 1,
      proposedContract: contract(['genres']),
      competitorContracts: [contract(['keywords'])],
    });

    expect(explanation.statusId).toBe(
      POLICY_DESTINATION_COMPETITION_SHARED_ELIGIBILITY_EXPLANATION_STATUS_IDS.NO_SHARED_PURPOSE_CATEGORY,
    );
    expect(explanation.categories).toEqual([]);
  });
});
