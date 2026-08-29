/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export const POLICY_DESTINATION_COMPETITION_SHARED_ELIGIBILITY_EXPLANATION_VERSION = 1;

export const POLICY_DESTINATION_COMPETITION_SHARED_ELIGIBILITY_EXPLANATION_STATUS_IDS = Object.freeze({
  AVAILABLE: 'destination_competition_shared_eligibility_explanation_available',
  NO_SHARED_ELIGIBILITY: 'destination_competition_shared_eligibility_explanation_not_needed',
  NO_SHARED_PURPOSE_CATEGORY: 'destination_competition_shared_eligibility_explanation_no_common_category',
});

const PURPOSE_CATEGORY_BY_SIGNAL_TYPE = Object.freeze({
  genres: Object.freeze({
    id: 'genre_purpose',
    label: 'Genre-based declared purpose',
  }),
  keywords: Object.freeze({
    id: 'keyword_purpose',
    label: 'Keyword-based declared purpose',
  }),
  studios: Object.freeze({
    id: 'studio_purpose',
    label: 'Studio-based declared purpose',
  }),
  media_type: Object.freeze({
    id: 'media_type_purpose',
    label: 'Media-type declared purpose',
  }),
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asNonNegativeInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue >= 0 ? numericValue : 0;
}

function purposeCategoryIds(contract = {}) {
  return new Set(asArray(contract.purpose)
    .map(rule => PURPOSE_CATEGORY_BY_SIGNAL_TYPE[rule?.signal_type]?.id)
    .filter(Boolean));
}

function buildGuidance({ sharedEligibleItemCount, categoryCount }) {
  if (sharedEligibleItemCount === 0) {
    return {
      title: 'No shared-eligibility explanation is needed',
      description: 'The bounded cohort did not show any item eligible for both the proposed draft and an active competitor.',
    };
  }

  if (categoryCount === 0) {
    return {
      title: 'No common declared-purpose category was found',
      description: 'Shared eligibility was observed, but no allow-listed purpose category appears in both the draft and an evaluated active competitor. This does not reveal or compare rule values.',
    };
  }

  return {
    title: 'Configured purpose categories may contribute to shared eligibility',
    description: 'These categories appear in the proposed draft and at least one anonymous active competitor. They are possible contributors only: this preview does not compare values, identify a competitor, rank policies, or decide routing.',
  };
}

/**
 * Returns a display-safe explanation for a shared eligibility aggregate. Rule
 * values, policy identities, and individual evaluator outcomes stay inside the
 * service boundary; only allow-listed category labels and policy counts leave.
 */
export function buildPolicyDestinationCompetitionSharedEligibilityExplanation({
  sharedEligibleItemCount = 0,
  proposedContract = {},
  competitorContracts = [],
} = {}) {
  const sharedCount = asNonNegativeInteger(sharedEligibleItemCount);
  const proposedCategoryIds = purposeCategoryIds(proposedContract);
  const configuredCompetitorCountByCategory = new Map();

  for (const competitorContract of asArray(competitorContracts)) {
    for (const categoryId of purposeCategoryIds(competitorContract)) {
      if (!proposedCategoryIds.has(categoryId)) continue;
      configuredCompetitorCountByCategory.set(
        categoryId,
        (configuredCompetitorCountByCategory.get(categoryId) || 0) + 1,
      );
    }
  }

  const configuredCategories = Object.values(PURPOSE_CATEGORY_BY_SIGNAL_TYPE)
    .filter(category => configuredCompetitorCountByCategory.has(category.id))
    .map(category => ({
      categoryId: category.id,
      label: category.label,
      configuredCompetitorPolicyCount: configuredCompetitorCountByCategory.get(category.id),
    }));
  const categories = sharedCount > 0 ? configuredCategories : [];
  const statusId = sharedCount === 0
    ? POLICY_DESTINATION_COMPETITION_SHARED_ELIGIBILITY_EXPLANATION_STATUS_IDS.NO_SHARED_ELIGIBILITY
    : categories.length === 0
      ? POLICY_DESTINATION_COMPETITION_SHARED_ELIGIBILITY_EXPLANATION_STATUS_IDS.NO_SHARED_PURPOSE_CATEGORY
      : POLICY_DESTINATION_COMPETITION_SHARED_ELIGIBILITY_EXPLANATION_STATUS_IDS.AVAILABLE;

  return {
    version: `policy_destination_competition_shared_eligibility_explanation.v${POLICY_DESTINATION_COMPETITION_SHARED_ELIGIBILITY_EXPLANATION_VERSION}`,
    statusId,
    categories,
    guidance: buildGuidance({
      sharedEligibleItemCount: sharedCount,
      categoryCount: categories.length,
    }),
    advisory: true,
    proposedTermsExposed: false,
    competitorTermsExposed: false,
    competitorIdentitiesExposed: false,
    rawRulesExposed: false,
    itemOutcomesExposed: false,
    routingAffected: false,
    providerAccessed: false,
    databaseWritten: false,
  };
}
