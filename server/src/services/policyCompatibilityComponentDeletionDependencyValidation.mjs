/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  POLICY_AUTHORING_COMPATIBILITY_ACTION_IDS,
} from './policyAuthoringCompatibilityRegressionInventory.mjs';
import {
  POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_DISPOSITION_IDS,
} from './policyStarterTemplateCompatibilityBridgeInventory.mjs';
import {
  POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_CLASSIFICATION_IDS,
  POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_KIND_IDS,
  POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_RISK_IDS,
  asArray,
  cleanString,
} from './policyCompatibilityComponentDeletionDependencyInventory.mjs';

function findRegressionRecord(records, sourcePath) {
  return asArray(records).find(record => record.path === sourcePath) || null;
}

function findHandoff(handoffs, compatibilityScopeId) {
  return asArray(handoffs)
    .find(handoff => handoff.compatibilityScopeId === compatibilityScopeId) || null;
}

function componentNameFromPath(componentPath) {
  return cleanString(componentPath).split('/').pop()?.replace(/\.vue$/, '') || '';
}

function buildSideEffects(sideEffects = {}) {
  return {
    componentsDeleted: sideEffects.componentsDeleted === true,
    componentsMoved: sideEffects.componentsMoved === true,
    testsDeleted: sideEffects.testsDeleted === true,
    testsMoved: sideEffects.testsMoved === true,
    sourceFilesRewritten: sideEffects.sourceFilesRewritten === true,
    storageChanged: sideEffects.storageChanged === true,
  };
}

function hasSideEffects(sideEffects) {
  return Object.values(sideEffects).some(Boolean);
}

function validateRetiringComponentArtifact(componentPath, artifacts) {
  const artifact = asArray(artifacts).find(record => record.sourcePath === componentPath);
  const issues = [];

  if (!artifact) {
    issues.push({
      riskId: POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_RISK_IDS
        .RETIRING_COMPONENT_ARTIFACT_MISSING,
      componentPath,
      message: 'Every dependency must point to a declared retiring compatibility component.',
    });
    return issues;
  }

  if (artifact.dispositionId !==
      POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_DISPOSITION_IDS.DELETE_AFTER_NATIVE_STORAGE) {
    issues.push({
      riskId: POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_RISK_IDS
        .RETIRING_COMPONENT_ARTIFACT_INVALID,
      componentPath,
      dispositionId: artifact.dispositionId || null,
      message: 'This audit only inventories components approved to retire after native storage.',
    });
  }

  if (artifact.normalAuthoringAllowed === true) {
    issues.push({
      riskId: POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_RISK_IDS
        .RETIRING_COMPONENT_IN_NORMAL_AUTHORING,
      componentPath,
      message: 'A retiring component cannot be reintroduced into normal authoring.',
    });
  }

  if (artifact.rawPayloadMutationAllowed === true) {
    issues.push({
      riskId: POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_RISK_IDS
        .RETIRING_COMPONENT_MUTATES_RAW_PAYLOAD,
      componentPath,
      message: 'A retiring component cannot gain raw legacy-payload mutation authority.',
    });
  }

  return issues;
}

function validateDependencyRecord(
  dependency,
  {
    artifacts,
    compatibilityTestRecords,
    maintenanceTestRecords,
    handoffs,
  },
) {
  const issues = [];
  const kindId = cleanString(dependency?.kindId);
  const classificationId = cleanString(dependency?.classificationId);

  if (!Object.values(POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_KIND_IDS).includes(kindId)) {
    issues.push({
      riskId: POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_RISK_IDS.UNKNOWN_DEPENDENCY_KIND,
      dependencyId: cleanString(dependency?.id) || null,
      kindId: kindId || null,
      message: 'Deletion dependencies must be runtime imports or executable test dependencies.',
    });
  }

  if (!Object.values(POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_CLASSIFICATION_IDS)
    .includes(classificationId)) {
    issues.push({
      riskId: POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_RISK_IDS.UNKNOWN_CLASSIFICATION,
      dependencyId: cleanString(dependency?.id) || null,
      classificationId: classificationId || null,
      message: 'Each dependency must have one explicit cutover classification.',
    });
  }

  issues.push(...validateRetiringComponentArtifact(dependency?.componentPath, artifacts));

  if (classificationId ===
      POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_CLASSIFICATION_IDS.NATIVE_REHOME) {
    const regressionRecord = findRegressionRecord(
      compatibilityTestRecords,
      dependency?.sourcePath,
    );

    if (!regressionRecord) {
      issues.push({
        riskId: POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_RISK_IDS
          .ACTIVE_REGRESSION_RECORD_MISSING,
        dependencyId: dependency.id || null,
        sourcePath: dependency.sourcePath || null,
        message: 'A native rehome must preserve a declared active regression contract.',
      });
    } else if (regressionRecord.actionId !== POLICY_AUTHORING_COMPATIBILITY_ACTION_IDS.KEEP) {
      issues.push({
        riskId: POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_RISK_IDS
          .ACTIVE_REGRESSION_NOT_REHOMED,
        dependencyId: dependency.id || null,
        sourcePath: dependency.sourcePath || null,
        actionId: regressionRecord.actionId || null,
        message: 'Only active retained regression contracts can be classified for native rehome.',
      });
    }

    if (asArray(dependency?.nativeRehomeTargets).length === 0) {
      issues.push({
        riskId: POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_RISK_IDS.NATIVE_REHOME_TARGET_MISSING,
        dependencyId: dependency.id || null,
        message: 'A native rehome must name its planned native regression target.',
      });
    }
  }

  if (classificationId ===
      POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_CLASSIFICATION_IDS
        .NAMED_COMPATIBILITY_RETIREMENT) {
    const scope = asArray(maintenanceTestRecords)
      .find(record => record.id === dependency.compatibilityScopeId) || null;
    const handoff = findHandoff(handoffs, dependency.compatibilityScopeId);

    if (!scope) {
      issues.push({
        riskId: POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_RISK_IDS.COMPATIBILITY_SCOPE_MISSING,
        dependencyId: dependency.id || null,
        compatibilityScopeId: dependency.compatibilityScopeId || null,
        message: 'Named compatibility retirement must reference a declared maintenance test scope.',
      });
    } else if (scope.sourceTestPath !== dependency.sourcePath ||
      !asArray(scope.componentPaths).includes(dependency.componentPath) ||
      !asArray(dependency.testNameFragments).every(fragment =>
        asArray(scope.testNameFragments).includes(fragment))) {
      issues.push({
        riskId: POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_RISK_IDS.COMPATIBILITY_SCOPE_DRIFT,
        dependencyId: dependency.id || null,
        compatibilityScopeId: dependency.compatibilityScopeId || null,
        message: 'Named compatibility retirement must match its declared source, component, and test assertions.',
      });
    }

    if (!handoff) {
      issues.push({
        riskId: POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_RISK_IDS.CUTOVER_HANDOFF_MISSING,
        dependencyId: dependency.id || null,
        compatibilityScopeId: dependency.compatibilityScopeId || null,
        message: 'Named compatibility retirement must remain covered by a native-storage cutover handoff.',
      });
    }
  }

  if (classificationId ===
      POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_CLASSIFICATION_IDS
        .REMOVAL_MANIFEST_CANDIDATE) {
    const regressionRecord = findRegressionRecord(
      compatibilityTestRecords,
      dependency?.sourcePath,
    );

    if (regressionRecord?.actionId === POLICY_AUTHORING_COMPATIBILITY_ACTION_IDS.KEEP) {
      issues.push({
        riskId: POLICY_COMPATIBILITY_COMPONENT_DELETION_DEPENDENCY_RISK_IDS
          .MANIFEST_CANDIDATE_RETAINS_ACTIVE_REGRESSION,
        dependencyId: dependency.id || null,
        sourcePath: dependency.sourcePath || null,
        message: 'An active retained regression must be rehomed, not placed in the removal manifest.',
      });
    }
  }

  return {
    ok: issues.length === 0,
    dependencyId: cleanString(dependency?.id) || null,
    issues,
  };
}

export {
  buildSideEffects,
  componentNameFromPath,
  hasSideEffects,
  validateDependencyRecord,
};
