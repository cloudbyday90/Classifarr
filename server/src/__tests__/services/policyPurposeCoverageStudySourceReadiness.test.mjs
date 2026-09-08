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
  POLICY_PURPOSE_COVERAGE_STUDY_SOURCE_READINESS_STATUS_IDS,
  buildPolicyPurposeCoverageStudySourceReadiness,
} from '../../services/policyPurposeCoverageStudySourceReadiness.mjs';

describe('policyPurposeCoverageStudySourceReadiness', () => {
  test('fails closed when no active validated native policy exists', () => {
    expect(buildPolicyPurposeCoverageStudySourceReadiness()).toEqual({
      statusId: POLICY_PURPOSE_COVERAGE_STUDY_SOURCE_READINESS_STATUS_IDS
        .NO_ACTIVE_VALIDATED_NATIVE_POLICY,
      activePolicyCount: 0,
      profileOnlyPurposePolicyCount: 0,
      retainedPurposePolicyCount: 0,
      heldOutAuditCandidateSourceAvailable: false,
      semanticCohortReady: false,
      semanticSelectionAffected: false,
      routingAffected: false,
    });
  });

  test('keeps profile-only purpose out of held-out policy source availability', () => {
    expect(buildPolicyPurposeCoverageStudySourceReadiness({
      active_policy_count: 10,
      profile_only_purpose_policy_count: 10,
      retained_purpose_policy_count: 0,
    })).toEqual(expect.objectContaining({
      statusId: POLICY_PURPOSE_COVERAGE_STUDY_SOURCE_READINESS_STATUS_IDS
        .NO_RETAINED_DECLARED_PURPOSE_SOURCE,
      activePolicyCount: 10,
      profileOnlyPurposePolicyCount: 10,
      retainedPurposePolicyCount: 0,
      heldOutAuditCandidateSourceAvailable: false,
      semanticCohortReady: false,
      semanticSelectionAffected: false,
      routingAffected: false,
    }));
  });

  test('allows a private eligibility-audit source without declaring cohort readiness', () => {
    expect(buildPolicyPurposeCoverageStudySourceReadiness({
      active_policy_count: 10,
      profile_only_purpose_policy_count: 8,
      retained_purpose_policy_count: 2,
    })).toEqual(expect.objectContaining({
      statusId: POLICY_PURPOSE_COVERAGE_STUDY_SOURCE_READINESS_STATUS_IDS
        .RETAINED_DECLARED_PURPOSE_SOURCE_AVAILABLE,
      heldOutAuditCandidateSourceAvailable: true,
      semanticCohortReady: false,
      semanticSelectionAffected: false,
      routingAffected: false,
    }));
  });

  test('bounds malformed or overlapping count inputs before returning them', () => {
    expect(buildPolicyPurposeCoverageStudySourceReadiness({
      active_policy_count: 2,
      profile_only_purpose_policy_count: 9,
      retained_purpose_policy_count: 9,
    })).toEqual(expect.objectContaining({
      activePolicyCount: 2,
      profileOnlyPurposePolicyCount: 2,
      retainedPurposePolicyCount: 0,
      heldOutAuditCandidateSourceAvailable: false,
    }));
  });
});
