/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export const POLICY_DESTINATION_COMPETITION_COMPARISON_COVERAGE_VERSION = 1;

export const POLICY_DESTINATION_COMPETITION_COMPARISON_COVERAGE_STATUS_IDS = Object.freeze({
  COMPLETE: 'destination_competition_comparison_coverage_complete',
  CAPPED: 'destination_competition_comparison_coverage_capped',
});

function asNonNegativeInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue >= 0 ? numericValue : 0;
}

function buildGuidance({ additionalActiveCompetitorsExcluded }) {
  if (additionalActiveCompetitorsExcluded) {
    return {
      title: 'Comparison coverage is capped',
      description: 'One or more additional active same-media-type destinations were excluded by the fixed comparison cap. Do not treat absence of shared eligibility as a complete destination-safety conclusion.',
    };
  }

  return {
    title: 'Comparison coverage is complete',
    description: 'Every active same-media-type destination fit within the fixed comparison cap. This remains a bounded historic preview, not a routing guarantee.',
  };
}

/**
 * Builds a display-safe coverage summary. It deliberately omits both the
 * sentinel competitor and the total number of matching active policies.
 */
export function buildPolicyDestinationCompetitionComparisonCoverage({
  comparedActiveCompetitorPolicyCount = 0,
  maximumCompetitorPolicyCount = 0,
  additionalActiveCompetitorsExcluded = false,
} = {}) {
  const maximumCount = asNonNegativeInteger(maximumCompetitorPolicyCount);
  const comparedCount = Math.min(
    asNonNegativeInteger(comparedActiveCompetitorPolicyCount),
    maximumCount,
  );
  const capped = additionalActiveCompetitorsExcluded === true;

  return {
    version: `policy_destination_competition_comparison_coverage.v${POLICY_DESTINATION_COMPETITION_COMPARISON_COVERAGE_VERSION}`,
    statusId: capped
      ? POLICY_DESTINATION_COMPETITION_COMPARISON_COVERAGE_STATUS_IDS.CAPPED
      : POLICY_DESTINATION_COMPETITION_COMPARISON_COVERAGE_STATUS_IDS.COMPLETE,
    comparedActiveCompetitorPolicyCount: comparedCount,
    maximumCompetitorPolicyCount: maximumCount,
    additionalActiveCompetitorsExcluded: capped,
    completeForActiveSameMediaTypeCompetitors: !capped,
    guidance: buildGuidance({ additionalActiveCompetitorsExcluded: capped }),
    advisory: true,
    exactActiveCompetitorCountExposed: false,
    competitorIdentitiesExposed: false,
    competitorConfigurationExposed: false,
    sentinelExposed: false,
    routingAffected: false,
    providerAccessed: false,
    databaseWritten: false,
  };
}
