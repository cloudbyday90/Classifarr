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

import fs from 'node:fs';
import path from 'node:path';

import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS,
} from '../../../services/policyCompatibilityDeletionExecutionActions.mjs';
import {
  buildPolicyCompatibilityDeletionExecutionGate,
} from '../../../services/policyCompatibilityDeletionExecutionGate.mjs';
import {
  buildPolicyCompatibilityDeletionPreflightManifestObservationIdentity,
} from '../../../services/policyCompatibilityDeletionPreflightManifestObservationIdentity.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_STATUS_IDS,
} from '../../../services/policyCompatibilityDeletionPreApplyChangeDetector.mjs';
import {
  buildPolicyControlledCompatibilityNamedScopeRemovalDryRun,
} from '../../../services/policyControlledCompatibilityNamedScopeRemovalAdapter.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
  buildReadyExecutionGateOperatorEvidence,
  buildReadyExecutionGatePreflightEvidenceArtifact,
  buildReadyExecutionGateRecoveryEvidence,
  buildReadyExecutionPlanArtifact,
} from './policyCompatibilityDeletionExecutionGateFixtures.mjs';

const REVIEW_TIME = '2026-07-14T20:01:00.000Z';

function namedScopeEntry(overrides = {}) {
  return {
    actionId: POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS.REMOVE_NAMED_TEST_SCOPE,
    categoryId: 'compatibility_named_test_scopes',
    componentPath: 'client/src/components/policies/PolicyIntentEditor.vue',
    deletionIntent: 'Remove explicitly retired compatibility assertions from a retained test file.',
    dependencyIds: ['compatibility_named_scope_review_artifact_fixture'],
    path: 'client/src/__tests__/retained-policy.test.js',
    ready: true,
    replacementEvidence: { replacement: 'Native destination test coverage is retained.' },
    sourceTextFragments: ['legacy alpha marker', 'legacy beta marker'],
    targetKindId: 'named_test_scope',
    testNameFragments: ['removes legacy alpha', 'removes legacy beta'],
    wholeFileDeletion: false,
    ...overrides,
  };
}

function namedScopeExecutionPlan(entries) {
  return {
    statusId: 'ready_for_execution_gate',
    readyForExecutionGate: true,
    validation: { ok: true, issueCount: 0, issues: [] },
    manifest: {
      approved: true,
      approvedBy: 'policy-maintainer',
      entries,
    },
  };
}

function buildReadyGate(entry, { manifestEntries = [entry] } = {}) {
  const executionPlanArtifact = buildReadyExecutionPlanArtifact({
    executionPlan: namedScopeExecutionPlan(manifestEntries),
  });

  return buildPolicyCompatibilityDeletionExecutionGate({
    executionPlanArtifact,
    recoveryEvidence: buildReadyExecutionGateRecoveryEvidence({ executionPlanArtifact }),
    operatorEvidence: buildReadyExecutionGateOperatorEvidence({ executionPlanArtifact }),
    preflightEvidenceArtifact: buildReadyExecutionGatePreflightEvidenceArtifact({
      executionPlanArtifact,
    }),
    generatedAt: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
    now: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
  });
}

function readyPreApplyVerification() {
  return {
    statusId: POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_STATUS_IDS.VERIFIED,
    verified: true,
    validation: { ok: true, issueCount: 0, issues: [] },
    risks: [],
  };
}

function reviewMetadata(overrides = {}) {
  return {
    reviewReason: 'Reviewed the fresh, bounded named-test-scope dry run.',
    reviewedAt: REVIEW_TIME,
    reviewedBy: 'policy-maintainer',
    ...overrides,
  };
}

function sourceText(suffix = '') {
  return [
    "import { describe, expect, it } from 'vitest';",
    '',
    "describe('retained policy behavior', () => {",
    "  it('removes legacy alpha', () => {",
    "    expect('legacy alpha marker').toBe('legacy alpha marker');",
    '  });',
    '',
    "  it('keeps native behavior', () => {",
    "    expect('native').toBe('native');",
    '  });',
    '',
    "  it('removes legacy beta', () => {",
    "    expect('legacy beta marker').toBe('legacy beta marker');",
    '  });',
    '});',
    suffix,
  ].join('\n');
}

function buildScopeRemovalReviewFixture({
  entry = namedScopeEntry(),
  executionGate = null,
  fixtureRoot,
  manifestEntries = [entry],
  now = POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
  preApplyChangeDetector = readyPreApplyVerification,
  suffix = '',
  source = sourceText(suffix),
} = {}) {
  const sourcePath = path.join(fixtureRoot, entry.path);
  const selectedEntryIdentity =
    buildPolicyCompatibilityDeletionPreflightManifestObservationIdentity(entry);
  const resolvedExecutionGate = executionGate || buildReadyGate(entry, { manifestEntries });

  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(sourcePath, source);

  return {
    entry,
    executionGate: resolvedExecutionGate,
    repoRoot: fixtureRoot,
    selectedEntryIdentity,
    source,
    sourcePath,
    scopeRemovalDryRun: buildPolicyControlledCompatibilityNamedScopeRemovalDryRun({
      executionGate: resolvedExecutionGate,
      now,
      preApplyChangeDetector,
      repoRoot: fixtureRoot,
      selectedEntryIdentity,
    }),
  };
}

function buildReadyScopeRemovalDryRun(options = {}) {
  return buildScopeRemovalReviewFixture(options).scopeRemovalDryRun;
}

export {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
  REVIEW_TIME,
  buildReadyGate,
  buildReadyScopeRemovalDryRun,
  buildScopeRemovalReviewFixture,
  namedScopeEntry,
  readyPreApplyVerification,
  reviewMetadata,
  sourceText,
};
