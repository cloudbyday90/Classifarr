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

import { createHash } from 'node:crypto';

import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_MANIFEST_ENTRY_KIND_IDS,
  normalizePolicyCompatibilityDeletionExecutionManifestEntry,
} from './policyCompatibilityDeletionExecutionManifestEntry.mjs';

const POLICY_COMPATIBILITY_DELETION_PREFLIGHT_MANIFEST_OBSERVATION_IDENTITY_VERSION =
  'policy.compatibility_deletion_preflight_manifest_observation_identity.v1';

const POLICY_COMPATIBILITY_DELETION_PREFLIGHT_MANIFEST_OBSERVATION_IDENTITY_PREFIXES =
  Object.freeze({
    FILE_PATH: 'file_path:',
    NAMED_TEST_SCOPE: 'named_test_scope:',
  });
const NAMED_TEST_SCOPE_OBSERVATION_IDENTITY_PATTERN = /^named_test_scope:[a-f0-9]{64}$/u;

function buildNamedScopeIdentityProjection(entry = {}) {
  const value = normalizePolicyCompatibilityDeletionExecutionManifestEntry(entry);

  if (!value.path) return null;

  return {
    version: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_MANIFEST_OBSERVATION_IDENTITY_VERSION,
    actionId: value.actionId || null,
    categoryId: value.categoryId || null,
    componentPath: value.componentPath || null,
    deletionIntent: value.deletionIntent || null,
    dependencyIds: value.dependencyIds,
    kindId: value.kindId,
    path: value.path,
    sourceTextFragments: value.sourceTextFragments,
    targetKindId: value.targetKindId || null,
    testNameFragments: value.testNameFragments,
    wholeFileDeletion: value.wholeFileDeletion,
  };
}

function isPolicyCompatibilityDeletionPreflightNamedScopeEntry(entry = {}) {
  return normalizePolicyCompatibilityDeletionExecutionManifestEntry(entry).kindId ===
    POLICY_COMPATIBILITY_DELETION_EXECUTION_MANIFEST_ENTRY_KIND_IDS.NAMED_TEST_SCOPE;
}

function buildPolicyCompatibilityDeletionPreflightManifestObservationIdentity(entry = {}) {
  const value = normalizePolicyCompatibilityDeletionExecutionManifestEntry(entry);

  if (!value.path) return null;

  if (!isPolicyCompatibilityDeletionPreflightNamedScopeEntry(value)) {
    return `${POLICY_COMPATIBILITY_DELETION_PREFLIGHT_MANIFEST_OBSERVATION_IDENTITY_PREFIXES.FILE_PATH}${
      value.path
    }`;
  }

  const projection = buildNamedScopeIdentityProjection(value);
  if (!projection) return null;

  const digest = createHash('sha256')
    .update(JSON.stringify(projection))
    .digest('hex');

  return `${POLICY_COMPATIBILITY_DELETION_PREFLIGHT_MANIFEST_OBSERVATION_IDENTITY_PREFIXES
    .NAMED_TEST_SCOPE}${digest}`;
}

function isPolicyCompatibilityDeletionPreflightManifestObservationIdentity(value = '') {
  return typeof value === 'string' && (
    value.startsWith(POLICY_COMPATIBILITY_DELETION_PREFLIGHT_MANIFEST_OBSERVATION_IDENTITY_PREFIXES
      .FILE_PATH) ||
    NAMED_TEST_SCOPE_OBSERVATION_IDENTITY_PATTERN.test(value)
  );
}

export {
  POLICY_COMPATIBILITY_DELETION_PREFLIGHT_MANIFEST_OBSERVATION_IDENTITY_PREFIXES,
  POLICY_COMPATIBILITY_DELETION_PREFLIGHT_MANIFEST_OBSERVATION_IDENTITY_VERSION,
  buildPolicyCompatibilityDeletionPreflightManifestObservationIdentity,
  isPolicyCompatibilityDeletionPreflightManifestObservationIdentity,
  isPolicyCompatibilityDeletionPreflightNamedScopeEntry,
};
