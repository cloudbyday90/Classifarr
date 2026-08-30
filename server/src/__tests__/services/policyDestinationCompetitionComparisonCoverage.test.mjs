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
  POLICY_DESTINATION_COMPETITION_COMPARISON_COVERAGE_STATUS_IDS,
  buildPolicyDestinationCompetitionComparisonCoverage,
} from '../../services/policyDestinationCompetitionComparisonCoverage.mjs';

describe('policyDestinationCompetitionComparisonCoverage', () => {
  test('reports complete coverage when exactly the comparison cap was sufficient', () => {
    const coverage = buildPolicyDestinationCompetitionComparisonCoverage({
      comparedActiveCompetitorPolicyCount: 25,
      maximumCompetitorPolicyCount: 25,
      additionalActiveCompetitorsExcluded: false,
    });

    expect(coverage).toMatchObject({
      statusId: POLICY_DESTINATION_COMPETITION_COMPARISON_COVERAGE_STATUS_IDS.COMPLETE,
      comparedActiveCompetitorPolicyCount: 25,
      maximumCompetitorPolicyCount: 25,
      additionalActiveCompetitorsExcluded: false,
      completeForActiveSameMediaTypeCompetitors: true,
      exactActiveCompetitorCountExposed: false,
      competitorIdentitiesExposed: false,
      competitorConfigurationExposed: false,
      sentinelExposed: false,
      routingAffected: false,
      providerAccessed: false,
      databaseWritten: false,
    });
    expect(coverage.guidance.description).toContain('Every active same-media-type destination fit');
  });

  test('reports capped coverage without exposing the omitted active-policy total', () => {
    const coverage = buildPolicyDestinationCompetitionComparisonCoverage({
      comparedActiveCompetitorPolicyCount: 25,
      maximumCompetitorPolicyCount: 25,
      additionalActiveCompetitorsExcluded: true,
    });

    expect(coverage).toMatchObject({
      statusId: POLICY_DESTINATION_COMPETITION_COMPARISON_COVERAGE_STATUS_IDS.CAPPED,
      additionalActiveCompetitorsExcluded: true,
      completeForActiveSameMediaTypeCompetitors: false,
      exactActiveCompetitorCountExposed: false,
      sentinelExposed: false,
    });
    expect(coverage.guidance.description).toContain('Do not treat absence of shared eligibility');
    expect(JSON.stringify(coverage)).not.toContain('Range of Stars');
  });

  test('bounds malformed counts to the configured comparison cap', () => {
    const coverage = buildPolicyDestinationCompetitionComparisonCoverage({
      comparedActiveCompetitorPolicyCount: 99,
      maximumCompetitorPolicyCount: 25,
    });

    expect(coverage.comparedActiveCompetitorPolicyCount).toBe(25);
  });
});
