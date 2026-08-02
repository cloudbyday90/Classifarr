/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS,
} from '../../services/policyCompatibilityDeletionExecutionActions.mjs';
import {
  buildPolicyCompatibilityDeletionPreflightManifestObservationIdentity,
  isPolicyCompatibilityDeletionPreflightManifestObservationIdentity,
  isPolicyCompatibilityDeletionPreflightNamedScopeEntry,
} from '../../services/policyCompatibilityDeletionPreflightManifestObservationIdentity.mjs';

const SHARED_TEST_PATH = 'server/src/__tests__/services/policyLegacyCompatibility.test.mjs';

function namedScope(overrides = {}) {
  return {
    actionId: POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS.REMOVE_NAMED_TEST_SCOPE,
    categoryId: 'compatibility_named_test_scopes',
    componentPath: 'server/src/services/policyLegacyCompatibility.mjs',
    deletionIntent: 'Remove a legacy compatibility test without deleting its retained test file.',
    dependencyIds: ['policy_legacy_compatibility'],
    path: SHARED_TEST_PATH,
    sourceTextFragments: ["describe('legacy compatibility'", "test('uses legacy bridge'"],
    targetKindId: 'named_test_scope',
    testNameFragments: ['legacy compatibility', 'uses legacy bridge'],
    wholeFileDeletion: false,
    ...overrides,
  };
}

describe('policyCompatibilityDeletionPreflightManifestObservationIdentity', () => {
  test('preserves legacy whole-file observations as their canonical path identity', () => {
    const identity = buildPolicyCompatibilityDeletionPreflightManifestObservationIdentity({
      actionId: POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS.REPLACE_CODE_PATH,
      path: 'server/src/services/policyLegacyCompatibility.mjs',
    });

    expect(identity).toBe('file_path:server/src/services/policyLegacyCompatibility.mjs');
    expect(isPolicyCompatibilityDeletionPreflightManifestObservationIdentity(identity)).toBe(true);
  });

  test('distinguishes named scopes in one retained test file while canonicalizing field order', () => {
    const firstScope = namedScope();
    const reorderedFirstScope = namedScope({
      dependencyIds: ['policy_legacy_compatibility'],
      sourceTextFragments: ["test('uses legacy bridge'", "describe('legacy compatibility'"],
      testNameFragments: ['uses legacy bridge', 'legacy compatibility'],
    });
    const secondScope = namedScope({
      sourceTextFragments: ["test('preserves legacy fallback'"],
      testNameFragments: ['preserves legacy fallback'],
    });

    const firstIdentity = buildPolicyCompatibilityDeletionPreflightManifestObservationIdentity(
      firstScope,
    );
    const reorderedFirstIdentity =
      buildPolicyCompatibilityDeletionPreflightManifestObservationIdentity(reorderedFirstScope);
    const secondIdentity = buildPolicyCompatibilityDeletionPreflightManifestObservationIdentity(
      secondScope,
    );

    expect(isPolicyCompatibilityDeletionPreflightNamedScopeEntry(firstScope)).toBe(true);
    expect(firstIdentity).toMatch(/^named_test_scope:[a-f0-9]{64}$/u);
    expect(reorderedFirstIdentity).toBe(firstIdentity);
    expect(secondIdentity).not.toBe(firstIdentity);
  });
});
