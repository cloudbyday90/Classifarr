/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  listPolicyAuthoringClientWorkflowComponents,
} from './policyAuthoringWorkflowCompletionAudit.mjs';
import {
  listPolicyCompatibilityMaintenanceTestRecords,
} from './policyCompatibilityMaintenanceTestOwnership.mjs';
import {
  POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_DISPOSITION_IDS,
  listPolicyStarterTemplateCompatibilityBridgeArtifacts,
} from './policyStarterTemplateCompatibilityBridgeInventory.mjs';

const POLICY_NATIVE_WORKFLOW_TEST_REHOMING_VERSION =
  'policy.native_workflow_test_rehoming.v1';

const POLICY_NATIVE_WORKFLOW_TEST_REHOMING_STATUS_IDS = Object.freeze({
  READY_FOR_DEPENDENCY_AUDIT: 'ready_for_dependency_audit',
  BLOCKED_BY_ACTIVE_OWNERSHIP: 'blocked_by_active_ownership',
  BLOCKED_BY_COMPONENT_BOUNDARY: 'blocked_by_component_boundary',
  BLOCKED_BY_TEST_CONTRACT: 'blocked_by_test_contract',
  BLOCKED_BY_SIDE_EFFECT: 'blocked_by_side_effect',
});

const POLICY_NATIVE_WORKFLOW_TEST_REHOMING_RISK_IDS = Object.freeze({
  MISSING_WORKFLOW_RECORD: 'missing_workflow_record',
  LEGACY_TEST_OWNERSHIP_RETAINED: 'legacy_test_ownership_retained',
  LEGACY_TEST_BOUNDARY_INVALID: 'legacy_test_boundary_invalid',
  NATIVE_TEST_OWNERSHIP_DRIFT: 'native_test_ownership_drift',
  RETIRING_COMPONENT_ARTIFACT_INVALID: 'retiring_component_artifact_invalid',
  RETIRING_COMPONENT_IN_NORMAL_AUTHORING: 'retiring_component_in_normal_authoring',
  RETIRING_COMPONENT_MUTATES_RAW_PAYLOAD: 'retiring_component_mutates_raw_payload',
  NATIVE_TEST_SOURCE_MISSING: 'native_test_source_missing',
  NATIVE_TEST_ASSERTION_MISSING: 'native_test_assertion_missing',
  UNKNOWN_STATUS: 'unknown_status',
  ISSUE_COUNT_MISMATCH: 'issue_count_mismatch',
  DELETION_AUTHORIZED: 'deletion_authorized',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePath(value) {
  return cleanString(value).replace(/\\/g, '/');
}

function uniqueStrings(values) {
  return [...new Set(asArray(values).map(cleanString).filter(Boolean))];
}

function getSourceText(sourceTextByPath, sourcePath) {
  if (sourceTextByPath instanceof Map) {
    return sourceTextByPath.get(sourcePath);
  }

  return sourceTextByPath?.[sourcePath];
}

function buildSideEffects(sideEffects = {}) {
  return {
    testFilesMoved: sideEffects.testFilesMoved === true,
    sourceFilesRewritten: sideEffects.sourceFilesRewritten === true,
    componentsDeleted: sideEffects.componentsDeleted === true,
    storageChanged: sideEffects.storageChanged === true,
  };
}

function hasSideEffects(sideEffects = {}) {
  return Object.values(sideEffects).some(Boolean);
}

function createWorkflowTestRehome({
  workflowRecordId,
  retiringComponentPath,
  legacyTestPath,
  nativeTestPath,
  nativeTestNameFragments,
}) {
  return {
    workflowRecordId,
    retiringComponentPath,
    legacyTestPath,
    nativeTestPath,
    nativeTestNameFragments,
  };
}

const POLICY_NATIVE_WORKFLOW_TEST_REHOMES = deepFreeze([
  createWorkflowTestRehome({
    workflowRecordId: 'policy_authoring_destination_sections',
    retiringComponentPath: 'client/src/components/policies/PolicyIntentEditor.vue',
    legacyTestPath: 'client/src/__tests__/PolicyIntentEditor.test.js',
    nativeTestPath: 'client/src/__tests__/PolicyBuilderDestinationQuestions.test.js',
    nativeTestNameFragments: [
      'renders observed signal selection only for selectable server projection',
      'withholds selection while the observed profile is stale',
    ],
  }),
  createWorkflowTestRehome({
    workflowRecordId: 'policy_authoring_review_triggers',
    retiringComponentPath: 'client/src/components/policies/PolicyIntentEditor.vue',
    legacyTestPath: 'client/src/__tests__/PolicyIntentEditor.test.js',
    nativeTestPath: 'client/src/__tests__/PolicyIntentReviewTriggerControl.test.js',
    nativeTestNameFragments: [
      'emits one typed add-value event for each selected trigger',
      'disables duplicate trigger choices with a reason',
    ],
  }),
]);

function listPolicyNativeWorkflowTestRehomes() {
  return POLICY_NATIVE_WORKFLOW_TEST_REHOMES;
}

function buildPolicyNativeWorkflowTestRehomingSourceAudit(
  sourceTextByPath = {},
  rehomes = POLICY_NATIVE_WORKFLOW_TEST_REHOMES,
) {
  const issues = [];

  asArray(rehomes).forEach(rehome => {
    const nativeTestPath = normalizePath(rehome?.nativeTestPath);
    const sourceText = getSourceText(sourceTextByPath, nativeTestPath);

    if (typeof sourceText !== 'string') {
      issues.push({
        riskId: POLICY_NATIVE_WORKFLOW_TEST_REHOMING_RISK_IDS.NATIVE_TEST_SOURCE_MISSING,
        workflowRecordId: cleanString(rehome?.workflowRecordId) || null,
        nativeTestPath: nativeTestPath || null,
        message: 'Native workflow test rehoming requires the successor test source text.',
      });
      return;
    }

    uniqueStrings(rehome?.nativeTestNameFragments).forEach(testNameFragment => {
      if (!sourceText.includes(testNameFragment)) {
        issues.push({
          riskId: POLICY_NATIVE_WORKFLOW_TEST_REHOMING_RISK_IDS.NATIVE_TEST_ASSERTION_MISSING,
          workflowRecordId: cleanString(rehome?.workflowRecordId) || null,
          nativeTestPath,
          testNameFragment,
          message: 'Native workflow test rehoming requires each named successor assertion.',
        });
      }
    });
  });

  return {
    ok: issues.length === 0,
    checkedRehomeCount: asArray(rehomes).length,
    issues,
  };
}

function getRetiringComponentIssues(rehomes, artifacts) {
  return uniqueStrings(asArray(rehomes).map(rehome => rehome?.retiringComponentPath))
    .flatMap(componentPath => {
      const artifact = asArray(artifacts)
        .find(candidate => candidate.sourcePath === componentPath);
      const issues = [];

      if (artifact?.dispositionId !==
        POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_DISPOSITION_IDS
          .DELETE_AFTER_NATIVE_STORAGE) {
        issues.push({
          riskId: POLICY_NATIVE_WORKFLOW_TEST_REHOMING_RISK_IDS
            .RETIRING_COMPONENT_ARTIFACT_INVALID,
          componentPath,
          dispositionId: artifact?.dispositionId || null,
          message: 'Rehomed workflow ownership must reference a component scheduled for deletion after native storage.',
        });
      }

      if (artifact?.normalAuthoringAllowed === true) {
        issues.push({
          riskId: POLICY_NATIVE_WORKFLOW_TEST_REHOMING_RISK_IDS
            .RETIRING_COMPONENT_IN_NORMAL_AUTHORING,
          componentPath,
          message: 'A retiring compatibility component cannot be admitted to normal authoring.',
        });
      }

      if (artifact?.rawPayloadMutationAllowed === true) {
        issues.push({
          riskId: POLICY_NATIVE_WORKFLOW_TEST_REHOMING_RISK_IDS
            .RETIRING_COMPONENT_MUTATES_RAW_PAYLOAD,
          componentPath,
          message: 'A retiring compatibility component cannot gain raw legacy-payload mutation authority.',
        });
      }

      return issues;
    });
}

function getOwnershipIssues(rehomes, workflowComponents) {
  const issues = [];
  const legacyTestPaths = new Set(asArray(rehomes)
    .map(rehome => normalizePath(rehome?.legacyTestPath))
    .filter(Boolean));

  asArray(rehomes).forEach(rehome => {
    const workflowRecordId = cleanString(rehome?.workflowRecordId);
    const record = asArray(workflowComponents)
      .find(candidate => candidate.id === workflowRecordId);
    const expectedTestPath = normalizePath(rehome?.nativeTestPath);

    if (!record) {
      issues.push({
        riskId: POLICY_NATIVE_WORKFLOW_TEST_REHOMING_RISK_IDS.MISSING_WORKFLOW_RECORD,
        workflowRecordId: workflowRecordId || null,
        message: 'Each native test rehome must map to an active authoring completion record.',
      });
      return;
    }

    if (normalizePath(record.testPath) !== expectedTestPath) {
      issues.push({
        riskId: POLICY_NATIVE_WORKFLOW_TEST_REHOMING_RISK_IDS.NATIVE_TEST_OWNERSHIP_DRIFT,
        workflowRecordId,
        expectedTestPath,
        actualTestPath: normalizePath(record.testPath) || null,
        message: 'Active authoring completion records must point to their declared native component test.',
      });
    }
  });

  asArray(workflowComponents)
    .filter(record => legacyTestPaths.has(normalizePath(record.testPath)))
    .forEach(record => {
      issues.push({
        riskId: POLICY_NATIVE_WORKFLOW_TEST_REHOMING_RISK_IDS.LEGACY_TEST_OWNERSHIP_RETAINED,
        workflowRecordId: cleanString(record.id) || null,
        legacyTestPath: normalizePath(record.testPath),
        message: 'No active authoring completion record may retain ownership in a test that imports a retiring compatibility component.',
      });
    });

  return issues;
}

function getLegacyTestBoundaryIssues(rehomes, compatibilityTestRecords) {
  return asArray(rehomes).flatMap(rehome => {
    const legacyTestPath = normalizePath(rehome?.legacyTestPath);
    const retiringComponentPath = normalizePath(rehome?.retiringComponentPath);
    const compatibilityRecord = asArray(compatibilityTestRecords).find(record => (
      normalizePath(record.sourceTestPath) === legacyTestPath &&
      asArray(record.componentPaths).map(normalizePath).includes(retiringComponentPath)
    ));

    if (compatibilityRecord) {
      return [];
    }

    return [{
      riskId: POLICY_NATIVE_WORKFLOW_TEST_REHOMING_RISK_IDS.LEGACY_TEST_BOUNDARY_INVALID,
      workflowRecordId: cleanString(rehome?.workflowRecordId) || null,
      legacyTestPath: legacyTestPath || null,
      retiringComponentPath: retiringComponentPath || null,
      message: 'Each rehome must retain an explicit compatibility-test boundary for its retiring component.',
    }];
  });
}

function determineStatusId({ ownershipIssues, componentIssues, sourceIssues, sideEffects }) {
  if (hasSideEffects(sideEffects)) {
    return POLICY_NATIVE_WORKFLOW_TEST_REHOMING_STATUS_IDS.BLOCKED_BY_SIDE_EFFECT;
  }

  if (ownershipIssues.length > 0) {
    return POLICY_NATIVE_WORKFLOW_TEST_REHOMING_STATUS_IDS.BLOCKED_BY_ACTIVE_OWNERSHIP;
  }

  if (componentIssues.length > 0) {
    return POLICY_NATIVE_WORKFLOW_TEST_REHOMING_STATUS_IDS.BLOCKED_BY_COMPONENT_BOUNDARY;
  }

  if (sourceIssues.length > 0) {
    return POLICY_NATIVE_WORKFLOW_TEST_REHOMING_STATUS_IDS.BLOCKED_BY_TEST_CONTRACT;
  }

  return POLICY_NATIVE_WORKFLOW_TEST_REHOMING_STATUS_IDS.READY_FOR_DEPENDENCY_AUDIT;
}

function buildPolicyNativeWorkflowTestRehomingAudit({
  rehomes = POLICY_NATIVE_WORKFLOW_TEST_REHOMES,
  workflowComponents = listPolicyAuthoringClientWorkflowComponents(),
  compatibilityTestRecords = listPolicyCompatibilityMaintenanceTestRecords(),
  artifacts = listPolicyStarterTemplateCompatibilityBridgeArtifacts(),
  sourceTextByPath = {},
  sideEffects = {},
} = {}) {
  const normalizedSideEffects = buildSideEffects(sideEffects);
  const ownershipIssues = getOwnershipIssues(rehomes, workflowComponents);
  const componentIssues = [
    ...getLegacyTestBoundaryIssues(rehomes, compatibilityTestRecords),
    ...getRetiringComponentIssues(rehomes, artifacts),
  ];
  const sourceAudit = buildPolicyNativeWorkflowTestRehomingSourceAudit(
    sourceTextByPath,
    rehomes,
  );
  const issues = [
    ...ownershipIssues,
    ...componentIssues,
    ...sourceAudit.issues,
  ];

  if (hasSideEffects(normalizedSideEffects)) {
    issues.push({
      riskId: POLICY_NATIVE_WORKFLOW_TEST_REHOMING_RISK_IDS.SIDE_EFFECT_PERFORMED,
      message: 'Native workflow test rehoming audit cannot move tests, rewrite source, delete components, or mutate storage.',
    });
  }

  const audit = {
    version: POLICY_NATIVE_WORKFLOW_TEST_REHOMING_VERSION,
    statusId: determineStatusId({
      ownershipIssues,
      componentIssues,
      sourceIssues: sourceAudit.issues,
      sideEffects: normalizedSideEffects,
    }),
    rehomeReady: issues.length === 0,
    deletionAuthorized: false,
    checkedRehomeCount: asArray(rehomes).length,
    sourceAudit,
    sideEffects: normalizedSideEffects,
    issueCount: issues.length,
    issues,
    nextStep: {
      stepId: 'compatibility_component_deletion_dependency_audit',
      label: 'Compatibility Component Deletion Dependency Audit',
      reason: 'Inventory every remaining import and test dependency for retiring compatibility components before creating a removal manifest.',
    },
  };

  return {
    ...audit,
    validation: validatePolicyNativeWorkflowTestRehomingAudit(audit),
  };
}

function validatePolicyNativeWorkflowTestRehomingAudit(audit = {}) {
  const issues = [];

  if (!Object.values(POLICY_NATIVE_WORKFLOW_TEST_REHOMING_STATUS_IDS)
    .includes(audit.statusId)) {
    issues.push({
      riskId: POLICY_NATIVE_WORKFLOW_TEST_REHOMING_RISK_IDS.UNKNOWN_STATUS,
      message: 'Native workflow test rehoming audit status must be known.',
    });
  }

  if (audit.issueCount !== asArray(audit.issues).length) {
    issues.push({
      riskId: POLICY_NATIVE_WORKFLOW_TEST_REHOMING_RISK_IDS.ISSUE_COUNT_MISMATCH,
      message: 'Native workflow test rehoming issue count must match its issue list.',
    });
  }

  if (audit.deletionAuthorized !== false) {
    issues.push({
      riskId: POLICY_NATIVE_WORKFLOW_TEST_REHOMING_RISK_IDS.DELETION_AUTHORIZED,
      message: 'Native workflow test rehoming is evidence only and cannot authorize deletion.',
    });
  }

  Object.entries(audit.sideEffects || {}).forEach(([sideEffectId, value]) => {
    if (value === true) {
      issues.push({
        riskId: POLICY_NATIVE_WORKFLOW_TEST_REHOMING_RISK_IDS.SIDE_EFFECT_PERFORMED,
        sideEffectId,
        message: 'Native workflow test rehoming audit cannot perform side effects.',
      });
    }
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  POLICY_NATIVE_WORKFLOW_TEST_REHOMING_RISK_IDS,
  POLICY_NATIVE_WORKFLOW_TEST_REHOMING_STATUS_IDS,
  POLICY_NATIVE_WORKFLOW_TEST_REHOMING_VERSION,
  buildPolicyNativeWorkflowTestRehomingAudit,
  buildPolicyNativeWorkflowTestRehomingSourceAudit,
  listPolicyNativeWorkflowTestRehomes,
  validatePolicyNativeWorkflowTestRehomingAudit,
};
