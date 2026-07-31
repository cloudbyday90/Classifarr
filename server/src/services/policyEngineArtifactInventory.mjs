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

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const POLICY_ENGINE_ARTIFACT_INVENTORY_VERSION =
  'policy.engine_artifact_inventory.v1';

const POLICY_ENGINE_ARTIFACT_DECISION_IDS = Object.freeze({
  KEEP_ENGINE_PRIMITIVE: 'keep_engine_primitive',
  REWRITE_FOR_ENGINE: 'rewrite_for_engine',
  REPLACE_WITH_ENGINE: 'replace_with_engine',
  DELETE_AFTER_CUTOVER: 'delete_after_cutover',
});

const POLICY_ENGINE_ARTIFACT_CATEGORY_IDS = Object.freeze({
  IMPACT_PREVIEW: 'impact_preview',
  REPRESENTATIVE_REPLAY: 'representative_replay',
  TMDB_LIVE_PREVIEW: 'tmdb_live_preview',
  PROVIDER_READINESS: 'provider_readiness',
  PARITY_DELTA: 'parity_delta',
  INTERNAL_SUMMARY: 'internal_summary',
  STARTER_TEMPLATE_COMPATIBILITY: 'starter_template_compatibility',
});

const POLICY_ENGINE_LEGACY_SURFACE_STATUS_IDS = Object.freeze({
  ACTIVE: 'active',
  RETIRED: 'retired',
});

const POLICY_ENGINE_ARTIFACT_TYPE_IDS = Object.freeze({
  CLIENT_COMPONENT: 'client_component',
  CLIENT_COMPOSABLE: 'client_composable',
  CLIENT_UTILITY: 'client_utility',
  CLIENT_API: 'client_api',
  SERVER_ROUTE: 'server_route',
  SERVER_SERVICE: 'server_service',
  TEST: 'test',
  DOCUMENTATION: 'documentation',
  UNKNOWN: 'unknown',
});

const POLICY_ENGINE_TEST_DISPOSITION_IDS = Object.freeze({
  KEEP_ENGINE_CONTRACT: 'keep_engine_contract',
  REWRITE_ENGINE_CONTRACT: 'rewrite_engine_contract',
  REPLACE_WITH_ENGINE_CONTRACT: 'replace_with_engine_contract',
  DELETE_WITH_SURFACE: 'delete_with_surface',
});

const POLICY_ENGINE_ARTIFACT_INVENTORY_RISK_IDS = Object.freeze({
  MISSING_GROUP_ID: 'missing_group_id',
  MISSING_CATEGORY: 'missing_category',
  UNKNOWN_CATEGORY: 'unknown_category',
  MISSING_OWNER: 'missing_owner',
  MISSING_DECISION: 'missing_decision',
  UNKNOWN_DECISION: 'unknown_decision',
  MISSING_REPLACEMENT: 'missing_replacement',
  MISSING_TEST_DISPOSITION: 'missing_test_disposition',
  UNKNOWN_TEST_DISPOSITION: 'unknown_test_disposition',
  MISSING_ARTIFACT_PATH: 'missing_artifact_path',
  UNKNOWN_ARTIFACT_TYPE: 'unknown_artifact_type',
  ARTIFACT_PATH_NOT_FOUND: 'artifact_path_not_found',
  DUPLICATE_ARTIFACT_PATH: 'duplicate_artifact_path',
  LEGACY_SURFACE_IN_NORMAL_WORKFLOW: 'legacy_surface_in_normal_workflow',
  MISSING_REQUIRED_CATEGORY: 'missing_required_category',
  MISSING_REQUIRED_ARTIFACT_TYPE: 'missing_required_artifact_type',
  MISSING_SURFACE_COVERAGE: 'missing_surface_coverage',
  UNKNOWN_SURFACE_STATUS: 'unknown_surface_status',
  RETIRED_SURFACE_WITH_ACTIVE_ARTIFACTS: 'retired_surface_with_active_artifacts',
  ACTIVE_SURFACE_WITHOUT_ARTIFACTS: 'active_surface_without_artifacts',
  MISSING_RETIREMENT_LEDGER: 'missing_retirement_ledger',
});

const REQUIRED_CATEGORY_IDS = Object.freeze(Object.values(
  POLICY_ENGINE_ARTIFACT_CATEGORY_IDS
));
const REQUIRED_ARTIFACT_TYPE_IDS = Object.freeze([
  POLICY_ENGINE_ARTIFACT_TYPE_IDS.CLIENT_COMPONENT,
  POLICY_ENGINE_ARTIFACT_TYPE_IDS.CLIENT_COMPOSABLE,
  POLICY_ENGINE_ARTIFACT_TYPE_IDS.CLIENT_UTILITY,
  POLICY_ENGINE_ARTIFACT_TYPE_IDS.SERVER_ROUTE,
  POLICY_ENGINE_ARTIFACT_TYPE_IDS.SERVER_SERVICE,
  POLICY_ENGINE_ARTIFACT_TYPE_IDS.TEST,
  POLICY_ENGINE_ARTIFACT_TYPE_IDS.DOCUMENTATION,
]);
const DECISION_IDS = Object.freeze(Object.values(
  POLICY_ENGINE_ARTIFACT_DECISION_IDS
));
const TEST_DISPOSITION_IDS = Object.freeze(Object.values(
  POLICY_ENGINE_TEST_DISPOSITION_IDS
));

const DEFAULT_LEGACY_SURFACE_COVERAGE = Object.freeze([
  {
    categoryId: POLICY_ENGINE_ARTIFACT_CATEGORY_IDS.IMPACT_PREVIEW,
    statusId: POLICY_ENGINE_LEGACY_SURFACE_STATUS_IDS.RETIRED,
    retirementLedgerPath: 'server/src/services/policyMigrationDeletionPath.mjs',
    artifactTypeIds: [
      POLICY_ENGINE_ARTIFACT_TYPE_IDS.CLIENT_COMPONENT,
      POLICY_ENGINE_ARTIFACT_TYPE_IDS.CLIENT_COMPOSABLE,
      POLICY_ENGINE_ARTIFACT_TYPE_IDS.CLIENT_UTILITY,
      POLICY_ENGINE_ARTIFACT_TYPE_IDS.SERVER_ROUTE,
      POLICY_ENGINE_ARTIFACT_TYPE_IDS.SERVER_SERVICE,
      POLICY_ENGINE_ARTIFACT_TYPE_IDS.TEST,
      POLICY_ENGINE_ARTIFACT_TYPE_IDS.DOCUMENTATION,
    ],
  },
  {
    categoryId: POLICY_ENGINE_ARTIFACT_CATEGORY_IDS.REPRESENTATIVE_REPLAY,
    statusId: POLICY_ENGINE_LEGACY_SURFACE_STATUS_IDS.RETIRED,
    retirementLedgerPath: 'server/src/services/policyMigrationDeletionPath.mjs',
    artifactTypeIds: [
      POLICY_ENGINE_ARTIFACT_TYPE_IDS.CLIENT_COMPONENT,
      POLICY_ENGINE_ARTIFACT_TYPE_IDS.CLIENT_COMPOSABLE,
      POLICY_ENGINE_ARTIFACT_TYPE_IDS.CLIENT_UTILITY,
      POLICY_ENGINE_ARTIFACT_TYPE_IDS.SERVER_SERVICE,
      POLICY_ENGINE_ARTIFACT_TYPE_IDS.TEST,
      POLICY_ENGINE_ARTIFACT_TYPE_IDS.DOCUMENTATION,
    ],
  },
  {
    categoryId: POLICY_ENGINE_ARTIFACT_CATEGORY_IDS.TMDB_LIVE_PREVIEW,
    statusId: POLICY_ENGINE_LEGACY_SURFACE_STATUS_IDS.RETIRED,
    retirementLedgerPath: 'server/src/services/policyMigrationDeletionPath.mjs',
    artifactTypeIds: [
      POLICY_ENGINE_ARTIFACT_TYPE_IDS.SERVER_SERVICE,
      POLICY_ENGINE_ARTIFACT_TYPE_IDS.TEST,
      POLICY_ENGINE_ARTIFACT_TYPE_IDS.DOCUMENTATION,
    ],
  },
  {
    categoryId: POLICY_ENGINE_ARTIFACT_CATEGORY_IDS.PROVIDER_READINESS,
    statusId: POLICY_ENGINE_LEGACY_SURFACE_STATUS_IDS.RETIRED,
    retirementLedgerPath: 'server/src/services/policyMigrationDeletionPath.mjs',
    artifactTypeIds: [
      POLICY_ENGINE_ARTIFACT_TYPE_IDS.SERVER_SERVICE,
      POLICY_ENGINE_ARTIFACT_TYPE_IDS.TEST,
      POLICY_ENGINE_ARTIFACT_TYPE_IDS.DOCUMENTATION,
    ],
  },
  {
    categoryId: POLICY_ENGINE_ARTIFACT_CATEGORY_IDS.PARITY_DELTA,
    statusId: POLICY_ENGINE_LEGACY_SURFACE_STATUS_IDS.ACTIVE,
    retirementLedgerPath: null,
    artifactTypeIds: [],
  },
  {
    categoryId: POLICY_ENGINE_ARTIFACT_CATEGORY_IDS.INTERNAL_SUMMARY,
    statusId: POLICY_ENGINE_LEGACY_SURFACE_STATUS_IDS.ACTIVE,
    retirementLedgerPath: null,
    artifactTypeIds: [],
  },
  {
    categoryId: POLICY_ENGINE_ARTIFACT_CATEGORY_IDS.STARTER_TEMPLATE_COMPATIBILITY,
    statusId: POLICY_ENGINE_LEGACY_SURFACE_STATUS_IDS.ACTIVE,
    retirementLedgerPath: null,
    artifactTypeIds: [],
  },
]);

const DEFAULT_POLICY_ENGINE_ARTIFACT_GROUPS = Object.freeze([
  {
    id: 'legacy_scoring_runtime',
    categoryId: POLICY_ENGINE_ARTIFACT_CATEGORY_IDS.PARITY_DELTA,
    owner: 'runtime-decision-rebuild',
    decisionId: POLICY_ENGINE_ARTIFACT_DECISION_IDS.REPLACE_WITH_ENGINE,
    replacement: 'Policy evidence, intent, learning, and readiness engine contracts.',
    testDispositionId:
      POLICY_ENGINE_TEST_DISPOSITION_IDS.REPLACE_WITH_ENGINE_CONTRACT,
    normalWorkflowAllowed: false,
    artifactPaths: [
      'server/src/services/policyEngine.mjs',
      'server/src/services/policyEngineEvaluation.mjs',
      'server/src/services/policyEngineSignalScoring.mjs',
      'server/src/services/policyEngineSourceScoring.mjs',
      'server/src/services/policyScoringContextBuilder.mjs',
      'server/src/services/classificationPolicyPathService.mjs',
      'docs/architecture/policy-engine.md',
    ],
  },
  {
    id: 'legacy_scoring_tests',
    categoryId: POLICY_ENGINE_ARTIFACT_CATEGORY_IDS.PARITY_DELTA,
    owner: 'runtime-decision-rebuild',
    decisionId: POLICY_ENGINE_ARTIFACT_DECISION_IDS.REWRITE_FOR_ENGINE,
    replacement: 'Evidence, intent, learning, and runtime-decision contract tests.',
    testDispositionId:
      POLICY_ENGINE_TEST_DISPOSITION_IDS.REWRITE_ENGINE_CONTRACT,
    normalWorkflowAllowed: false,
    artifactPaths: [
      'server/src/__tests__/policyEngine.presetSemantics.test.mjs',
      'server/src/__tests__/policyEngine.scoringFunctions.test.mjs',
      'server/src/__tests__/policyScoringContextBuilder.test.mjs',
      'server/src/__tests__/classificationPolicyPathService.test.mjs',
    ],
  },
  {
    id: 'advanced_builder_controls',
    categoryId: POLICY_ENGINE_ARTIFACT_CATEGORY_IDS.INTERNAL_SUMMARY,
    owner: 'policy-operator-workflow',
    decisionId: POLICY_ENGINE_ARTIFACT_DECISION_IDS.DELETE_AFTER_CUTOVER,
    replacement: 'Server-owned automation readiness with no compatibility-side raw scoring controls.',
    testDispositionId:
      POLICY_ENGINE_TEST_DISPOSITION_IDS.DELETE_WITH_SURFACE,
    normalWorkflowAllowed: false,
    artifactPaths: [
      'client/src/components/policies/PolicyCompatibilityMaintenanceSurface.vue',
      'client/src/__tests__/PolicyCompatibilityMaintenanceSurface.test.js',
      'docs/architecture/policy-compatibility-editor-scope-audit.md',
    ],
  },
  {
    id: 'policy_builder_summary_shell',
    categoryId: POLICY_ENGINE_ARTIFACT_CATEGORY_IDS.INTERNAL_SUMMARY,
    owner: 'policy-operator-workflow',
    decisionId: POLICY_ENGINE_ARTIFACT_DECISION_IDS.REWRITE_FOR_ENGINE,
    replacement: 'Destination-first workflow shell backed by bounded readiness.',
    testDispositionId:
      POLICY_ENGINE_TEST_DISPOSITION_IDS.REWRITE_ENGINE_CONTRACT,
    normalWorkflowAllowed: false,
    artifactPaths: [
      'client/src/components/policies/PolicyBuilderModal.vue',
      'client/src/__tests__/PolicyBuilderModal.test.js',
      'client/src/components/policies/PolicyIntentSummaryCard.vue',
      'client/src/utils/policyIntentSummary.js',
      'client/src/__tests__/PolicyIntentSummaryCard.test.js',
      'client/src/__tests__/utils/policyIntentSummary.test.js',
      'docs/architecture/policy-compatibility-intent-readiness-boundary-audit.md',
      'docs/architecture/policy-compatibility-section-advisory-scope-audit.md',
      'docs/architecture/policy-compatibility-section-configuration-summary-scope-audit.md',
      'docs/architecture/policy-compatibility-group-instruction-scope-audit.md',
      'docs/architecture/policy-compatibility-editor-framing-copy-scope-audit.md',
      'docs/architecture/policy-compatibility-maintenance-surface-framing-audit.md',
    ],
  },
  {
    id: 'starter_template_intent_boundary',
    categoryId: POLICY_ENGINE_ARTIFACT_CATEGORY_IDS.STARTER_TEMPLATE_COMPATIBILITY,
    owner: 'declared-intent-draft',
    decisionId: POLICY_ENGINE_ARTIFACT_DECISION_IDS.KEEP_ENGINE_PRIMITIVE,
    replacement: 'Server-owned template-value projection followed by explicit typed intent commands; existing attachments remain bridge-only.',
    testDispositionId:
      POLICY_ENGINE_TEST_DISPOSITION_IDS.KEEP_ENGINE_CONTRACT,
    normalWorkflowAllowed: false,
    artifactPaths: [
      'server/src/services/policyStarterTemplateSuggestions.mjs',
      'server/src/services/policyIntentSignalOptionProjection.mjs',
      'server/src/routes/policyOperatorWorkflowRouteContext.mjs',
      'server/src/__tests__/services/policyStarterTemplateSuggestions.test.mjs',
      'server/src/__tests__/services/policyIntentSignalOptionProjection.test.mjs',
      'client/src/components/policies/IntentSignalPicker.vue',
      'client/src/utils/policyIntentSignalDraft.js',
      'client/src/__tests__/IntentSignalPicker.test.js',
      'client/src/__tests__/utils/policyIntentSignalDraft.test.js',
      'docs/architecture/policy-starter-template-intent-boundary.md',
    ],
  },
  {
    id: 'bounded_engine_primitives',
    categoryId: POLICY_ENGINE_ARTIFACT_CATEGORY_IDS.PARITY_DELTA,
    owner: 'policy-engine',
    decisionId: POLICY_ENGINE_ARTIFACT_DECISION_IDS.KEEP_ENGINE_PRIMITIVE,
    replacement: 'Not applicable; these are the replacement engine primitives.',
    testDispositionId:
      POLICY_ENGINE_TEST_DISPOSITION_IDS.KEEP_ENGINE_CONTRACT,
    normalWorkflowAllowed: false,
    artifactPaths: [
      'server/src/services/policyEvidenceEngine.mjs',
      'server/src/__tests__/services/policyEvidenceEngine.test.mjs',
      'docs/architecture/policy-evidence-engine.md',
      'server/src/services/policyIntentEngine.mjs',
      'server/src/__tests__/services/policyIntentEngine.test.mjs',
      'docs/architecture/policy-intent-engine.md',
    ],
  },
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function classifyPolicyEngineArtifactPath(path = '') {
  const normalizedPath = normalizeString(path).replaceAll('\\', '/');

  if (normalizedPath.startsWith('docs/')) {
    return POLICY_ENGINE_ARTIFACT_TYPE_IDS.DOCUMENTATION;
  }

  if (normalizedPath.includes('/__tests__/') || normalizedPath.includes('.test.')) {
    return POLICY_ENGINE_ARTIFACT_TYPE_IDS.TEST;
  }

  if (normalizedPath.startsWith('client/src/components/')) {
    return POLICY_ENGINE_ARTIFACT_TYPE_IDS.CLIENT_COMPONENT;
  }

  if (normalizedPath.startsWith('client/src/composables/')) {
    return POLICY_ENGINE_ARTIFACT_TYPE_IDS.CLIENT_COMPOSABLE;
  }

  if (normalizedPath.startsWith('client/src/utils/')) {
    return POLICY_ENGINE_ARTIFACT_TYPE_IDS.CLIENT_UTILITY;
  }

  if (normalizedPath.startsWith('client/src/api/')) {
    return POLICY_ENGINE_ARTIFACT_TYPE_IDS.CLIENT_API;
  }

  if (normalizedPath.startsWith('server/src/routes/')) {
    return POLICY_ENGINE_ARTIFACT_TYPE_IDS.SERVER_ROUTE;
  }

  if (normalizedPath.startsWith('server/src/services/')) {
    return POLICY_ENGINE_ARTIFACT_TYPE_IDS.SERVER_SERVICE;
  }

  return POLICY_ENGINE_ARTIFACT_TYPE_IDS.UNKNOWN;
}

function listPolicyEngineArtifactInventoryGroups() {
  return DEFAULT_POLICY_ENGINE_ARTIFACT_GROUPS;
}

function listPolicyEngineLegacySurfaceCoverage() {
  return DEFAULT_LEGACY_SURFACE_COVERAGE;
}

function listPolicyEngineArtifactInventoryArtifacts({
  groups = listPolicyEngineArtifactInventoryGroups(),
} = {}) {
  return asArray(groups).flatMap(group =>
    asArray(group?.artifactPaths).map(path => ({
      groupId: normalizeString(group?.id),
      categoryId: normalizeString(group?.categoryId),
      owner: normalizeString(group?.owner),
      decisionId: normalizeString(group?.decisionId),
      replacement: normalizeString(group?.replacement),
      testDispositionId: normalizeString(group?.testDispositionId),
      normalWorkflowAllowed: group?.normalWorkflowAllowed === true,
      path: normalizeString(path),
      artifactTypeId: classifyPolicyEngineArtifactPath(path),
    }))
  );
}

function defaultPathExists(relativePath) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- inventory uses checked-in repository paths only.
  return existsSync(resolve(REPO_ROOT, relativePath));
}

function buildIssue(riskId, message, details = {}) {
  return {
    riskId,
    message,
    ...details,
  };
}

function validateInventoryGroup(group = {}, { pathExists = defaultPathExists } = {}) {
  const source = asObject(group);
  const issues = [];
  const groupId = normalizeString(source.id);
  const categoryId = normalizeString(source.categoryId);
  const owner = normalizeString(source.owner);
  const decisionId = normalizeString(source.decisionId);
  const replacement = normalizeString(source.replacement);
  const testDispositionId = normalizeString(source.testDispositionId);
  const artifactPaths = asArray(source.artifactPaths);

  if (!groupId) {
    issues.push(buildIssue(
      POLICY_ENGINE_ARTIFACT_INVENTORY_RISK_IDS.MISSING_GROUP_ID,
      'Policy engine artifact inventory groups require a stable id.'
    ));
  }

  if (!categoryId) {
    issues.push(buildIssue(
      POLICY_ENGINE_ARTIFACT_INVENTORY_RISK_IDS.MISSING_CATEGORY,
      'Policy engine artifact inventory groups require a category.',
      { groupId: groupId || null }
    ));
  } else if (!REQUIRED_CATEGORY_IDS.includes(categoryId)) {
    issues.push(buildIssue(
      POLICY_ENGINE_ARTIFACT_INVENTORY_RISK_IDS.UNKNOWN_CATEGORY,
      'Policy engine artifact inventory groups must use a known category.',
      { groupId, categoryId }
    ));
  }

  if (!owner) {
    issues.push(buildIssue(
      POLICY_ENGINE_ARTIFACT_INVENTORY_RISK_IDS.MISSING_OWNER,
      'Policy engine artifact inventory groups require an owning domain.',
      { groupId: groupId || null }
    ));
  }

  if (!decisionId) {
    issues.push(buildIssue(
      POLICY_ENGINE_ARTIFACT_INVENTORY_RISK_IDS.MISSING_DECISION,
      'Policy engine artifact inventory groups require a cutline decision.',
      { groupId: groupId || null }
    ));
  } else if (!DECISION_IDS.includes(decisionId)) {
    issues.push(buildIssue(
      POLICY_ENGINE_ARTIFACT_INVENTORY_RISK_IDS.UNKNOWN_DECISION,
      'Policy engine artifact inventory groups must use a known cutline decision.',
      { groupId, decisionId }
    ));
  }

  if (!replacement) {
    issues.push(buildIssue(
      POLICY_ENGINE_ARTIFACT_INVENTORY_RISK_IDS.MISSING_REPLACEMENT,
      'Policy engine artifact inventory groups require a replacement or retained purpose.',
      { groupId: groupId || null }
    ));
  }

  if (!testDispositionId) {
    issues.push(buildIssue(
      POLICY_ENGINE_ARTIFACT_INVENTORY_RISK_IDS.MISSING_TEST_DISPOSITION,
      'Policy engine artifact inventory groups require a test disposition.',
      { groupId: groupId || null }
    ));
  } else if (!TEST_DISPOSITION_IDS.includes(testDispositionId)) {
    issues.push(buildIssue(
      POLICY_ENGINE_ARTIFACT_INVENTORY_RISK_IDS.UNKNOWN_TEST_DISPOSITION,
      'Policy engine artifact inventory groups must use a known test disposition.',
      { groupId, testDispositionId }
    ));
  }

  if (source.normalWorkflowAllowed === true) {
    issues.push(buildIssue(
      POLICY_ENGINE_ARTIFACT_INVENTORY_RISK_IDS.LEGACY_SURFACE_IN_NORMAL_WORKFLOW,
      'Legacy policy-engine artifacts cannot remain direct normal-workflow controls.',
      { groupId: groupId || null }
    ));
  }

  if (artifactPaths.length === 0) {
    issues.push(buildIssue(
      POLICY_ENGINE_ARTIFACT_INVENTORY_RISK_IDS.MISSING_ARTIFACT_PATH,
      'Policy engine artifact inventory groups require at least one current artifact path.',
      { groupId: groupId || null }
    ));
  }

  artifactPaths.forEach(path => {
    const normalizedPath = normalizeString(path);
    const artifactTypeId = classifyPolicyEngineArtifactPath(normalizedPath);

    if (!normalizedPath) {
      issues.push(buildIssue(
        POLICY_ENGINE_ARTIFACT_INVENTORY_RISK_IDS.MISSING_ARTIFACT_PATH,
        'Policy engine artifact inventory paths must be non-empty.',
        { groupId: groupId || null }
      ));
      return;
    }

    if (artifactTypeId === POLICY_ENGINE_ARTIFACT_TYPE_IDS.UNKNOWN) {
      issues.push(buildIssue(
        POLICY_ENGINE_ARTIFACT_INVENTORY_RISK_IDS.UNKNOWN_ARTIFACT_TYPE,
        'Policy engine artifact inventory paths must belong to a known source layer.',
        { groupId: groupId || null, path: normalizedPath }
      ));
    }

    if (!pathExists(normalizedPath)) {
      issues.push(buildIssue(
        POLICY_ENGINE_ARTIFACT_INVENTORY_RISK_IDS.ARTIFACT_PATH_NOT_FOUND,
        'Policy engine artifact inventory paths must resolve in the current checkout.',
        { groupId: groupId || null, path: normalizedPath }
      ));
    }
  });

  return {
    ok: issues.length === 0,
    groupId: groupId || null,
    issues,
  };
}

function buildPolicyEngineArtifactInventoryAudit({
  groups = listPolicyEngineArtifactInventoryGroups(),
  surfaceCoverage = listPolicyEngineLegacySurfaceCoverage(),
  pathExists = defaultPathExists,
} = {}) {
  const normalizedGroups = asArray(groups);
  const normalizedCoverage = asArray(surfaceCoverage);
  const groupResults = normalizedGroups.map(group =>
    validateInventoryGroup(group, { pathExists })
  );
  const artifacts = listPolicyEngineArtifactInventoryArtifacts({
    groups: normalizedGroups,
  });
  const issues = groupResults.flatMap(result => result.issues);
  const pathOwners = new Map();

  artifacts.forEach(artifact => {
    if (!artifact.path) return;

    if (pathOwners.has(artifact.path)) {
      issues.push(buildIssue(
        POLICY_ENGINE_ARTIFACT_INVENTORY_RISK_IDS.DUPLICATE_ARTIFACT_PATH,
        'Policy engine artifact inventory paths must have one cutline decision.',
        {
          path: artifact.path,
          groupId: artifact.groupId || null,
          existingGroupId: pathOwners.get(artifact.path),
        }
      ));
      return;
    }

    pathOwners.set(artifact.path, artifact.groupId || null);
  });

  const activeCategories = new Set(
    normalizedGroups.map(group => normalizeString(group?.categoryId)).filter(Boolean)
  );
  const activeArtifactTypes = new Set(
    artifacts.map(artifact => artifact.artifactTypeId).filter(Boolean)
  );
  const coveredArtifactTypes = new Set(activeArtifactTypes);
  const coverageByCategory = new Map();

  normalizedCoverage.forEach(coverage => {
    const categoryId = normalizeString(coverage?.categoryId);
    const statusId = normalizeString(coverage?.statusId);
    const retirementLedgerPath = normalizeString(coverage?.retirementLedgerPath);
    const retiredArtifactTypeIds = asArray(coverage?.artifactTypeIds)
      .map(artifactTypeId => normalizeString(artifactTypeId))
      .filter(Boolean);

    if (!categoryId || !REQUIRED_CATEGORY_IDS.includes(categoryId)) {
      issues.push(buildIssue(
        POLICY_ENGINE_ARTIFACT_INVENTORY_RISK_IDS.MISSING_SURFACE_COVERAGE,
        'Legacy surface coverage must identify a required policy-engine category.',
        { categoryId: categoryId || null }
      ));
      return;
    }

    coverageByCategory.set(categoryId, coverage);

    if (!Object.values(POLICY_ENGINE_LEGACY_SURFACE_STATUS_IDS).includes(statusId)) {
      issues.push(buildIssue(
        POLICY_ENGINE_ARTIFACT_INVENTORY_RISK_IDS.UNKNOWN_SURFACE_STATUS,
        'Legacy surface coverage must use an active or retired status.',
        { categoryId, statusId: statusId || null }
      ));
      return;
    }

    if (
      statusId === POLICY_ENGINE_LEGACY_SURFACE_STATUS_IDS.RETIRED &&
      !retirementLedgerPath
    ) {
      issues.push(buildIssue(
        POLICY_ENGINE_ARTIFACT_INVENTORY_RISK_IDS.MISSING_RETIREMENT_LEDGER,
        'Retired legacy surfaces must identify their migration/deletion ledger.',
        { categoryId }
      ));
    } else if (retirementLedgerPath && !pathExists(retirementLedgerPath)) {
      issues.push(buildIssue(
        POLICY_ENGINE_ARTIFACT_INVENTORY_RISK_IDS.ARTIFACT_PATH_NOT_FOUND,
        'Legacy surface retirement ledgers must resolve in the current checkout.',
        { categoryId, path: retirementLedgerPath }
      ));
    }

    retiredArtifactTypeIds.forEach(artifactTypeId => {
      if (!Object.values(POLICY_ENGINE_ARTIFACT_TYPE_IDS).includes(artifactTypeId)) {
        issues.push(buildIssue(
          POLICY_ENGINE_ARTIFACT_INVENTORY_RISK_IDS.UNKNOWN_ARTIFACT_TYPE,
          'Retired legacy surface coverage must use a known source layer.',
          { categoryId, artifactTypeId }
        ));
        return;
      }

      coveredArtifactTypes.add(artifactTypeId);
    });
  });

  REQUIRED_CATEGORY_IDS.forEach(categoryId => {
    const coverage = coverageByCategory.get(categoryId);

    if (!coverage) {
      issues.push(buildIssue(
        POLICY_ENGINE_ARTIFACT_INVENTORY_RISK_IDS.MISSING_SURFACE_COVERAGE,
        'Every required legacy policy-engine surface must have explicit coverage.',
        { categoryId }
      ));
      return;
    }

    if (
      coverage.statusId === POLICY_ENGINE_LEGACY_SURFACE_STATUS_IDS.RETIRED &&
      activeCategories.has(categoryId)
    ) {
      issues.push(buildIssue(
        POLICY_ENGINE_ARTIFACT_INVENTORY_RISK_IDS.RETIRED_SURFACE_WITH_ACTIVE_ARTIFACTS,
        'Retired legacy surfaces cannot retain current checkout artifacts.',
        { categoryId }
      ));
    }

    if (
      coverage.statusId === POLICY_ENGINE_LEGACY_SURFACE_STATUS_IDS.ACTIVE &&
      !activeCategories.has(categoryId)
    ) {
      issues.push(buildIssue(
        POLICY_ENGINE_ARTIFACT_INVENTORY_RISK_IDS.ACTIVE_SURFACE_WITHOUT_ARTIFACTS,
        'Active legacy surfaces must have a current artifact inventory decision.',
        { categoryId }
      ));
    }
  });

  REQUIRED_ARTIFACT_TYPE_IDS.forEach(artifactTypeId => {
    if (!coveredArtifactTypes.has(artifactTypeId)) {
      issues.push(buildIssue(
        POLICY_ENGINE_ARTIFACT_INVENTORY_RISK_IDS.MISSING_REQUIRED_ARTIFACT_TYPE,
        'The inventory must cover each required policy-engine source layer.',
        { artifactTypeId }
      ));
    }
  });

  const decisionCounts = Object.fromEntries(DECISION_IDS.map(decisionId => [
    decisionId,
    artifacts.filter(artifact => artifact.decisionId === decisionId).length,
  ]));

  return {
    version: POLICY_ENGINE_ARTIFACT_INVENTORY_VERSION,
    ok: issues.length === 0,
    issueCount: issues.length,
    groupCount: normalizedGroups.length,
    artifactCount: artifacts.length,
    coveredCategoryIds: REQUIRED_CATEGORY_IDS.filter(categoryId =>
      coverageByCategory.has(categoryId)
    ),
    activeArtifactTypeIds: [...activeArtifactTypes].sort(),
    artifactTypeIds: [...coveredArtifactTypes].sort(),
    decisionCounts,
    issues,
    nextStep: {
      stepId: 'evidence_engine',
      label: 'Evidence Engine',
      reason: 'Current artifacts have a cutline decision, so destination evidence can be built without extending legacy diagnostics.',
    },
  };
}

export {
  POLICY_ENGINE_ARTIFACT_CATEGORY_IDS,
  POLICY_ENGINE_ARTIFACT_DECISION_IDS,
  POLICY_ENGINE_ARTIFACT_INVENTORY_RISK_IDS,
  POLICY_ENGINE_ARTIFACT_INVENTORY_VERSION,
  POLICY_ENGINE_ARTIFACT_TYPE_IDS,
  POLICY_ENGINE_LEGACY_SURFACE_STATUS_IDS,
  POLICY_ENGINE_TEST_DISPOSITION_IDS,
  buildPolicyEngineArtifactInventoryAudit,
  classifyPolicyEngineArtifactPath,
  listPolicyEngineArtifactInventoryArtifacts,
  listPolicyEngineArtifactInventoryGroups,
  listPolicyEngineLegacySurfaceCoverage,
  validateInventoryGroup,
};
