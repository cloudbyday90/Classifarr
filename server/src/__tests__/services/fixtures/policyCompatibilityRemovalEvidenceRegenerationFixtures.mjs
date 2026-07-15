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
  POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_VERSION,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS,
} from '../../../services/policyCompatibilityDeletionExecutionPlan.mjs';
import {
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS,
} from '../../../services/policyControlledCompatibilityPathRemovalApply.mjs';
import {
  buildPolicyNextCompatibilityRemovalBatchAuthorizationArtifact,
} from '../../../services/policyNextCompatibilityRemovalBatchAuthorizationArtifact.mjs';
import {
  buildPolicyPostRemovalRuntimeEvidenceArtifact,
} from '../../../services/policyPostRemovalRuntimeEvidenceArtifact.mjs';
import {
  buildNextBatchAuthorizationPathStateSource,
} from './policyNextCompatibilityRemovalBatchAuthorizationFixtures.mjs';

const EVIDENCE_REGENERATION_MANIFEST_PATHS = Object.freeze([
  'server/src/services/retiredCompatibilityService.mjs',
  'client/src/components/RetiredCompatibilityPanel.vue',
]);
const EVIDENCE_REGENERATION_REVIEW_ARTIFACT_FINGERPRINT = 'a'.repeat(64);
const EVIDENCE_REGENERATION_GENERATED_AT = '2026-07-14T10:00:00.000Z';

function buildEvidenceRegenerationExecutionPlan(overrides = {}) {
  const paths = overrides.manifestPaths || EVIDENCE_REGENERATION_MANIFEST_PATHS;

  return {
    version: POLICY_COMPATIBILITY_DELETION_EXECUTION_PLAN_VERSION,
    statusId:
      POLICY_COMPATIBILITY_DELETION_EXECUTION_STATUS_IDS.READY_FOR_EXECUTION_GATE,
    readyForExecutionGate: true,
    validation: {
      ok: true,
      issueCount: 0,
      issues: [],
    },
    riskCount: 0,
    risks: [],
    sideEffects: {
      filesDeleted: false,
      filesArchived: false,
      storageChanged: false,
      gitCommandsRun: false,
    },
    manifest: {
      approved: true,
      approvedBy: 'policy-maintainer',
      entryCount: paths.length,
      entries: paths.map(path => ({
        categoryId: 'client_bridge_ui',
        actionId: 'delete_file',
        path,
        replacementEvidence: {
          replacementPath: 'server/src/services/policyNativeIntentProjection.mjs',
        },
        ready: true,
      })),
    },
    ...overrides,
  };
}

function buildEvidenceRegenerationValidationEvidence() {
  return {
    focused: {
      command: 'focused checks',
      passed: true,
    },
    full: {
      command: 'npm --prefix server test',
      passed: true,
    },
  };
}

function buildEvidenceRegenerationReferenceScan(overrides = {}) {
  return {
    completed: true,
    checkedPaths: EVIDENCE_REGENERATION_MANIFEST_PATHS,
    references: [],
    ...overrides,
  };
}

function buildEvidenceRegenerationRuntimeEvidenceArtifact(
  appliedPaths = EVIDENCE_REGENERATION_MANIFEST_PATHS
) {
  return buildPolicyPostRemovalRuntimeEvidenceArtifact({
    applyEvidence: {
      statusId: POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS.APPLIED,
      applied: true,
      validation: { ok: true, issueCount: 0, issues: [] },
      removalReview: {
        reviewArtifactFingerprint: EVIDENCE_REGENERATION_REVIEW_ARTIFACT_FINGERPRINT,
      },
      applyBatch: {
        requestedCount: appliedPaths.length,
        results: appliedPaths.map(path => ({
          path,
          actionId: 'delete_file',
          applied: true,
        })),
      },
    },
    importScan: {
      completed: true,
      reviewArtifactFingerprint: EVIDENCE_REGENERATION_REVIEW_ARTIFACT_FINGERPRINT,
      checkedPaths: appliedPaths,
      references: [],
    },
    runtimeChecks: [{
      checkId: 'policy-runtime-imports',
      passed: true,
      reviewArtifactFingerprint: EVIDENCE_REGENERATION_REVIEW_ARTIFACT_FINGERPRINT,
    }],
    validationEvidence: {
      focused: {
        command: 'focused validation',
        passed: true,
        reviewArtifactFingerprint: EVIDENCE_REGENERATION_REVIEW_ARTIFACT_FINGERPRINT,
      },
      full: {
        command: 'full validation',
        passed: true,
        reviewArtifactFingerprint: EVIDENCE_REGENERATION_REVIEW_ARTIFACT_FINGERPRINT,
      },
    },
  });
}

async function buildEvidenceRegenerationNextBatchAuthorizationArtifact({
  plan = buildEvidenceRegenerationExecutionPlan(),
  appliedPaths = EVIDENCE_REGENERATION_MANIFEST_PATHS,
} = {}) {
  const manifestPaths = plan.manifest?.entries?.map(entry => entry.path) || [];
  const remainingPaths = manifestPaths.filter(path => !appliedPaths.includes(path));
  const source = buildNextBatchAuthorizationPathStateSource({
    executionPlan: plan,
    existingPaths: remainingPaths,
  });

  return buildPolicyNextCompatibilityRemovalBatchAuthorizationArtifact({
    runtimeEvidenceArtifact:
      buildEvidenceRegenerationRuntimeEvidenceArtifact(appliedPaths),
    ...source,
    input: {
      requestedPaths: remainingPaths,
      maxBatchSize: manifestPaths.length,
      authorizationReason: remainingPaths.length > 0
        ? 'Continue the reviewed compatibility removal loop.'
        : '',
      authorizedBy: remainingPaths.length > 0 ? 'policy-maintainer' : '',
      reviewArtifactFingerprint: EVIDENCE_REGENERATION_REVIEW_ARTIFACT_FINGERPRINT,
    },
    generatedAt: EVIDENCE_REGENERATION_GENERATED_AT,
  });
}

export {
  EVIDENCE_REGENERATION_GENERATED_AT,
  EVIDENCE_REGENERATION_MANIFEST_PATHS,
  EVIDENCE_REGENERATION_REVIEW_ARTIFACT_FINGERPRINT,
  buildEvidenceRegenerationExecutionPlan,
  buildEvidenceRegenerationNextBatchAuthorizationArtifact,
  buildEvidenceRegenerationReferenceScan,
  buildEvidenceRegenerationRuntimeEvidenceArtifact,
  buildEvidenceRegenerationValidationEvidence,
};
