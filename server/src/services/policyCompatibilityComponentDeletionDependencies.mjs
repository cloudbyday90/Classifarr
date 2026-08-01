/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  listPolicyAuthoringCompatibilityTestRecords,
} from './policyAuthoringCompatibilityRegressionInventory.mjs';
import {
  listPolicyCompatibilityMaintenanceTestRecords,
} from './policyCompatibilityMaintenanceTestOwnership.mjs';
import {
  listPolicyNativeStorageCutoverTestHandoffs,
} from './policyNativeStorageCutoverTestHandoff.mjs';
import {
  listPolicyStarterTemplateCompatibilityBridgeArtifacts,
} from './policyStarterTemplateCompatibilityBridgeInventory.mjs';
import {
  POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCIES,
  POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_CLASSIFICATION_IDS,
  POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_RISK_IDS,
  POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_STATUS_IDS,
  POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_VERSION,
  POLICY_COMPATIBILITY_COMPONENT_DELETION_ROUTE_SOURCE_PATHS,
  RETIRING_COMPONENT_PATHS,
  asArray,
  cleanString,
  getSourceText,
  listPolicyCompatibilityComponentDeletionDependencies,
  listPolicyCompatibilityComponentDeletionRouteSourcePaths,
  uniqueStrings,
} from './policyCompatibilityComponentDeletionDependencyInventory.mjs';
import {
  buildSideEffects,
  componentNameFromPath,
  hasSideEffects,
  validateDependencyRecord,
} from './policyCompatibilityComponentDeletionDependencyValidation.mjs';

function buildPolicyCompatibilityComponentDeletionDependencySourceAudit(
  sourceTextByPath = {},
  dependencies = POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCIES,
) {
  const issues = [];
  const candidates = asArray(dependencies);

  candidates.forEach(dependency => {
    const sourceText = getSourceText(sourceTextByPath, dependency.sourcePath);

    if (typeof sourceText !== 'string') {
      issues.push({
        riskId: POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_RISK_IDS.DEPENDENCY_SOURCE_MISSING,
        dependencyId: dependency.id || null,
        sourcePath: dependency.sourcePath || null,
        message: 'Dependency auditing requires the executable source text for every recorded import or test scope.',
      });
      return;
    }

    uniqueStrings(dependency.sourceTextFragments).forEach(fragment => {
      if (!sourceText.includes(fragment)) {
        issues.push({
          riskId: POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_RISK_IDS
            .DEPENDENCY_SOURCE_FRAGMENT_MISSING,
          dependencyId: dependency.id || null,
          sourcePath: dependency.sourcePath || null,
          fragment,
          message: 'The dependency source no longer contains its recorded compatibility reference.',
        });
      }
    });

    uniqueStrings(dependency.testNameFragments).forEach(testNameFragment => {
      if (!sourceText.includes(testNameFragment)) {
        issues.push({
          riskId: POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_RISK_IDS
            .DEPENDENCY_TEST_ASSERTION_MISSING,
          dependencyId: dependency.id || null,
          sourcePath: dependency.sourcePath || null,
          testNameFragment,
          message: 'The dependency source no longer contains its recorded executable test scope.',
        });
      }
    });

    asArray(dependency.nativeRehomeTargets).forEach(target => {
      const targetPath = cleanString(target?.path);
      const targetText = getSourceText(sourceTextByPath, targetPath);

      if (typeof targetText !== 'string') {
        issues.push({
          riskId: POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_RISK_IDS.NATIVE_REHOME_TARGET_MISSING,
          dependencyId: dependency.id || null,
          sourcePath: targetPath || null,
          message: 'A planned native rehome target must exist as executable test source.',
        });
      } else if (!targetText.includes(target.testNameFragment)) {
        issues.push({
          riskId: POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_RISK_IDS
            .NATIVE_REHOME_TARGET_ASSERTION_MISSING,
          dependencyId: dependency.id || null,
          sourcePath: targetPath,
          testNameFragment: target.testNameFragment || null,
          message: 'A planned native rehome target must retain its named native behavior anchor.',
        });
      }
    });
  });

  return {
    ok: issues.length === 0,
    checkedDependencyCount: candidates.length,
    issues,
  };
}

function buildPolicyCompatibilityComponentDeletionRouteAudit(routeSourceTextByPath = {}) {
  const issues = [];

  POLICY_COMPATIBILITY_COMPONENT_DELETION_ROUTE_SOURCE_PATHS.forEach(sourcePath => {
    const sourceText = getSourceText(routeSourceTextByPath, sourcePath);

    if (typeof sourceText !== 'string') {
      issues.push({
        riskId: POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_RISK_IDS.ROUTE_SOURCE_MISSING,
        sourcePath,
        message: 'Route-entry auditing requires the router source text.',
      });
      return;
    }

    RETIRING_COMPONENT_PATHS.forEach(componentPath => {
      const componentName = componentNameFromPath(componentPath);

      if (sourceText.includes(componentName)) {
        issues.push({
          riskId: POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_RISK_IDS.ROUTE_REFERENCE_RETAINED,
          sourcePath,
          componentPath,
          message: 'Retiring compatibility components cannot remain direct route-entry dependencies.',
        });
      }
    });
  });

  return {
    ok: issues.length === 0,
    checkedRouteSourceCount: POLICY_COMPATIBILITY_COMPONENT_DELETION_ROUTE_SOURCE_PATHS.length,
    routeReferenceCount: issues.filter(issue =>
      issue.riskId === POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_RISK_IDS
        .ROUTE_REFERENCE_RETAINED).length,
    issues,
  };
}

function buildPolicyCompatibilityComponentDeletionDependencyAudit(
  {
    dependencies = POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCIES,
    artifacts = listPolicyStarterTemplateCompatibilityBridgeArtifacts(),
    compatibilityTestRecords = listPolicyAuthoringCompatibilityTestRecords(),
    maintenanceTestRecords = listPolicyCompatibilityMaintenanceTestRecords(),
    handoffs = listPolicyNativeStorageCutoverTestHandoffs(),
    sourceTextByPath = {},
    routeSourceTextByPath = {},
    sideEffects = {},
  } = {},
) {
  const candidates = asArray(dependencies);
  const normalizedSideEffects = buildSideEffects(sideEffects);
  const validationResults = candidates.map(dependency => validateDependencyRecord(dependency, {
    artifacts,
    compatibilityTestRecords,
    maintenanceTestRecords,
    handoffs,
  }));
  const sourceAudit = buildPolicyCompatibilityComponentDeletionDependencySourceAudit(
    sourceTextByPath,
    candidates,
  );
  const routeAudit = buildPolicyCompatibilityComponentDeletionRouteAudit(routeSourceTextByPath);
  const dependencyIds = candidates.map(dependency => cleanString(dependency.id)).filter(Boolean);
  const duplicateDependencyIds = dependencyIds.filter((id, index) => dependencyIds.indexOf(id) !== index);
  const coveredComponentPaths = new Set(candidates.map(dependency => dependency.componentPath));
  const nativeRehomeDependencyCount = candidates.filter(dependency =>
    dependency.classificationId ===
      POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_CLASSIFICATION_IDS.NATIVE_REHOME
  ).length;
  const issues = [
    ...validationResults.flatMap(result => result.issues),
    ...sourceAudit.issues,
    ...routeAudit.issues,
    ...[...new Set(duplicateDependencyIds)].map(dependencyId => ({
      riskId: POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_RISK_IDS.DUPLICATE_DEPENDENCY_ID,
      dependencyId,
      message: 'Compatibility component deletion dependency IDs must be unique.',
    })),
    ...RETIRING_COMPONENT_PATHS.filter(componentPath => !coveredComponentPaths.has(componentPath))
      .map(componentPath => ({
        riskId: POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_RISK_IDS
          .RETIRING_COMPONENT_DEPENDENCY_MISSING,
        componentPath,
        message: 'Every retiring compatibility component must have an explicit dependency inventory entry.',
      })),
  ];

  if (hasSideEffects(normalizedSideEffects)) {
    issues.push({
      riskId: POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_RISK_IDS.SIDE_EFFECT_PERFORMED,
      message: 'Dependency audit cannot delete or move components or tests, rewrite source, or change storage.',
    });
  }

  const statusId = hasSideEffects(normalizedSideEffects)
    ? POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_STATUS_IDS.BLOCKED_BY_SIDE_EFFECT
    : routeAudit.routeReferenceCount > 0
      ? POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_STATUS_IDS.BLOCKED_BY_ROUTE_REFERENCE
      : sourceAudit.ok !== true
        ? POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_STATUS_IDS.BLOCKED_BY_SOURCE_EVIDENCE
        : issues.length > 0
          ? POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_STATUS_IDS.BLOCKED_BY_DEPENDENCY_EVIDENCE
          : nativeRehomeDependencyCount > 0
            ? POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_STATUS_IDS
              .READY_FOR_REHOME_AND_MANIFEST_RECONCILIATION
            : POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_STATUS_IDS
              .READY_FOR_RETIREMENT_AND_MANIFEST_RECONCILIATION;

  return {
    version: POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_VERSION,
    statusId,
    ok: issues.length === 0,
    deletionAuthorized: false,
    checkedDependencyCount: candidates.length,
    retiringComponentCount: RETIRING_COMPONENT_PATHS.length,
    classificationCounts: Object.fromEntries(
      Object.values(POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_CLASSIFICATION_IDS)
        .map(classificationId => [
          classificationId,
          candidates.filter(dependency => dependency.classificationId === classificationId).length,
        ]),
    ),
    sourceAudit,
    routeAudit,
    sideEffects: normalizedSideEffects,
    issueCount: issues.length,
    issues,
    nextStep: {
      stepId: nativeRehomeDependencyCount > 0
        ? 'compatibility_native_contract_rehoming'
        : 'compatibility_retirement_manifest_reconciliation',
      label: nativeRehomeDependencyCount > 0
        ? 'Compatibility Native Contract Rehoming'
        : 'Compatibility Retirement Manifest Reconciliation',
      reason: nativeRehomeDependencyCount > 0
        ? 'Rehome the active editor command and provenance regression scopes to native controls before reconciling named retirements and removal-manifest candidates. No component deletion is authorized.'
        : 'Native contracts are rehomed. Reconcile the remaining named compatibility retirements and removal-manifest candidates against the native-storage cutover gate. No component deletion is authorized.',
    },
  };
}

export {
  POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_CLASSIFICATION_IDS,
  POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_RISK_IDS,
  POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_STATUS_IDS,
  POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_VERSION,
  buildPolicyCompatibilityComponentDeletionDependencyAudit,
  buildPolicyCompatibilityComponentDeletionDependencySourceAudit,
  buildPolicyCompatibilityComponentDeletionRouteAudit,
  listPolicyCompatibilityComponentDeletionDependencies,
  listPolicyCompatibilityComponentDeletionRouteSourcePaths,
};
