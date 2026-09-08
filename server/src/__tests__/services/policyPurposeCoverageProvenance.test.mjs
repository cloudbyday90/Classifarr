/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { expect, test } from '@jest/globals';
import {
  buildPolicyPurposeCoverageProvenance,
  POLICY_PURPOSE_COVERAGE_PROVENANCE_STATUS_IDS,
} from '../../services/policyPurposeCoverageProvenance.mjs';

test('projects bounded provenance counts without retaining supplied rule data', () => {
  const provenance = buildPolicyPurposeCoverageProvenance({
    specialized_purpose_rule_count: 2,
    inferred_profile_purpose_rule_count: 7,
    values: { require_any: ['private-profile-term'] },
  });

  expect(provenance).toEqual({
    declaredNativePurposeRuleCount: 0,
    statusId: POLICY_PURPOSE_COVERAGE_PROVENANCE_STATUS_IDS.PROFILE_ONLY_SPECIALIZED_PURPOSE,
    specializedPurposeRuleCount: 2,
    inferredProfilePurposeRuleCount: 2,
    retainedPurposeRuleCount: 0,
    unverifiedPurposeRuleCount: 0,
  });
  expect(JSON.stringify(provenance)).not.toContain('private-profile-term');
});

test.each([
  [0, 0, 0, POLICY_PURPOSE_COVERAGE_PROVENANCE_STATUS_IDS.NO_SPECIALIZED_PURPOSE],
  [3, 3, 0, POLICY_PURPOSE_COVERAGE_PROVENANCE_STATUS_IDS.PROFILE_ONLY_SPECIALIZED_PURPOSE],
  [3, 1, 2, POLICY_PURPOSE_COVERAGE_PROVENANCE_STATUS_IDS.DECLARED_SPECIALIZED_PURPOSE_AVAILABLE],
  [3, 1, 0, POLICY_PURPOSE_COVERAGE_PROVENANCE_STATUS_IDS.UNVERIFIED_PURPOSE_SOURCE],
])('classifies specialized-purpose provenance from aggregate counts', (
  purposeRules,
  profileRules,
  declaredRules,
  statusId,
) => {
  expect(buildPolicyPurposeCoverageProvenance({
    specialized_purpose_rule_count: purposeRules,
    inferred_profile_purpose_rule_count: profileRules,
    declared_native_purpose_rule_count: declaredRules,
  }).statusId).toBe(statusId);
});
