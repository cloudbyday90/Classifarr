/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export const POLICY_DESTINATION_COMPETITION_PREVIEW_VERSION = 1;

export const POLICY_DESTINATION_COMPETITION_PREVIEW_STATUS_IDS = Object.freeze({
  READY: 'destination_competition_preview_ready',
  NO_ELIGIBLE_HISTORIC_ITEMS: 'destination_competition_preview_no_eligible_historic_items',
  NO_ACTIVE_COMPETITORS: 'destination_competition_preview_no_active_competitors',
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asNonNegativeInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue >= 0 ? numericValue : 0;
}

function asBoolean(value) {
  return value === true;
}

function toIsoTimestamp(value) {
  const timestamp = value instanceof Date ? value : new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

function buildGuidance({
  evaluatedItemCount,
  activeCompetitorPolicyCount,
  proposedSharedEligibleItemCount,
  competitorPolicyLimitReached,
}) {
  const limitNotice = competitorPolicyLimitReached
    ? ' The configured comparison cap was reached, so additional active destinations may not be represented.'
    : '';

  if (evaluatedItemCount === 0) {
    return {
      title: 'No recent deterministic cohort is available',
      description: `No bounded historic deterministic classification records matched this policy media type and lookback window. This does not establish that the draft has no destination overlap.${limitNotice}`,
    };
  }

  if (activeCompetitorPolicyCount === 0) {
    return {
      title: 'No active competing destinations were considered',
      description: `No enabled policy in an active same-media-type library was available for this bounded comparison. This is not a routing recommendation.${limitNotice}`,
    };
  }

  if (proposedSharedEligibleItemCount > 0) {
    return {
      title: 'The proposed policy shares deterministic eligibility',
      description: `At least one active destination was also eligible for part of this bounded cohort. Review the declared purpose and constraints before saving; this preview does not choose a destination or route media.${limitNotice}`,
    };
  }

  return {
    title: 'No shared deterministic eligibility was observed',
    description: `The proposed policy was not eligible alongside an evaluated active competitor in this bounded cohort. It does not certify future policy selection, AI verification, or routing.${limitNotice}`,
  };
}

function buildCompetitionCounts({ proposedEligibility = [], competitorEligibility = [] } = {}) {
  const pairedEligibility = asArray(proposedEligibility).map((proposedEligible, index) => ({
    proposedEligible: asBoolean(proposedEligible),
    competitorEligible: asBoolean(competitorEligibility[index]),
  }));

  return pairedEligibility.reduce((counts, eligibility) => {
    if (eligibility.proposedEligible && eligibility.competitorEligible) {
      counts.proposedSharedEligibleItemCount += 1;
    } else if (eligibility.proposedEligible) {
      counts.proposedUncontestedEligibleItemCount += 1;
    } else if (eligibility.competitorEligible) {
      counts.competitorOnlyEligibleItemCount += 1;
    } else {
      counts.noEligibleCandidateItemCount += 1;
    }
    return counts;
  }, {
    proposedSharedEligibleItemCount: 0,
    proposedUncontestedEligibleItemCount: 0,
    competitorOnlyEligibleItemCount: 0,
    noEligibleCandidateItemCount: 0,
  });
}

/**
 * Builds a display-safe aggregate. This function intentionally accepts only
 * boolean eligibility vectors and anonymous counts, never policies or items.
 */
export function buildPolicyDestinationCompetitionPreview({
  sample = {},
  proposedEligibility = [],
  competitorEligibility = [],
  activeCompetitorPolicyCount = 0,
  maximumCompetitorPolicies = 0,
  sharedEligibilityExplanation = null,
  evaluatedAt = new Date(),
} = {}) {
  const evaluatedItemCount = asNonNegativeInteger(
    sample.evaluatedItemCount ?? asArray(proposedEligibility).length,
  );
  const competitorCount = asNonNegativeInteger(activeCompetitorPolicyCount);
  const maximumCompetitors = asNonNegativeInteger(maximumCompetitorPolicies);
  const competition = buildCompetitionCounts({ proposedEligibility, competitorEligibility });
  const proposedEligibleItemCount = competition.proposedSharedEligibleItemCount +
    competition.proposedUncontestedEligibleItemCount;
  const competitorPolicyLimitReached = maximumCompetitors > 0 &&
    competitorCount >= maximumCompetitors;
  const statusId = evaluatedItemCount === 0
    ? POLICY_DESTINATION_COMPETITION_PREVIEW_STATUS_IDS.NO_ELIGIBLE_HISTORIC_ITEMS
    : competitorCount === 0
      ? POLICY_DESTINATION_COMPETITION_PREVIEW_STATUS_IDS.NO_ACTIVE_COMPETITORS
      : POLICY_DESTINATION_COMPETITION_PREVIEW_STATUS_IDS.READY;

  return {
    version: `policy_destination_competition_preview.v${POLICY_DESTINATION_COMPETITION_PREVIEW_VERSION}`,
    evaluatedAt: toIsoTimestamp(evaluatedAt) || new Date().toISOString(),
    sample: {
      windowDays: asNonNegativeInteger(sample.windowDays),
      maximumItems: asNonNegativeInteger(sample.maximumItems),
      evaluatedItemCount,
      source: 'recent_deterministic_classification_history',
      rawItemsExposed: false,
    },
    competitors: {
      activePolicyCount: competitorCount,
      maximumPolicyCount: maximumCompetitors,
      policyLimitReached: competitorPolicyLimitReached,
      identitiesExposed: false,
      configurationExposed: false,
    },
    proposed: {
      eligibleItemCount: proposedEligibleItemCount,
    },
    competition,
    sharedEligibilityExplanation,
    statusId,
    guidance: buildGuidance({
      evaluatedItemCount,
      activeCompetitorPolicyCount: competitorCount,
      proposedSharedEligibleItemCount: competition.proposedSharedEligibleItemCount,
      competitorPolicyLimitReached,
    }),
    advisory: true,
    draftRetained: false,
    rawConfigurationExposed: false,
    rawHistoricItemsExposed: false,
    routingAffected: false,
    providerAccessed: false,
    databaseWritten: false,
  };
}
