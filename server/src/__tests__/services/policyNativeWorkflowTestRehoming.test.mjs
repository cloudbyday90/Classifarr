/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  POLICY_NATIVE_WORKFLOW_TEST_REHOMING_RISK_IDS,
  POLICY_NATIVE_WORKFLOW_TEST_REHOMING_STATUS_IDS,
  buildPolicyNativeWorkflowTestRehomingAudit,
  buildPolicyNativeWorkflowTestRehomingSourceAudit,
  listPolicyNativeWorkflowTestRehomes,
} from '../../services/policyNativeWorkflowTestRehoming.mjs';
import {
  listPolicyAuthoringClientWorkflowComponents,
} from '../../services/policyAuthoringWorkflowCompletionAudit.mjs';
import {
  listPolicyStarterTemplateCompatibilityBridgeArtifacts,
} from '../../services/policyStarterTemplateCompatibilityBridgeInventory.mjs';

const repoRoot = resolve(import.meta.dirname, '../../../..');

async function readNativeWorkflowTestSources() {
  const sourcePaths = [...new Set(listPolicyNativeWorkflowTestRehomes()
    .map(rehome => rehome.nativeTestPath))];
  const entries = await Promise.all(sourcePaths.map(async sourcePath => [
    sourcePath,
    await readFile(resolve(repoRoot, sourcePath), 'utf8'),
  ]));

  return Object.fromEntries(entries);
}

describe('policyNativeWorkflowTestRehoming', () => {
  test('moves active normal-authoring ownership to native component contracts without authorizing deletion', async () => {
    const audit = buildPolicyNativeWorkflowTestRehomingAudit({
      sourceTextByPath: await readNativeWorkflowTestSources(),
    });

    expect(audit).toEqual(expect.objectContaining({
      statusId: POLICY_NATIVE_WORKFLOW_TEST_REHOMING_STATUS_IDS.READY_FOR_DEPENDENCY_AUDIT,
      rehomeReady: true,
      deletionAuthorized: false,
      checkedRehomeCount: 2,
      issueCount: 0,
      issues: [],
    }));
    expect(audit.sourceAudit).toEqual({
      ok: true,
      checkedRehomeCount: 2,
      issues: [],
    });
    expect(audit.validation).toEqual({ ok: true, issueCount: 0, issues: [] });
  });

  test('declares the native destination and review-trigger test owners', () => {
    expect(listPolicyNativeWorkflowTestRehomes()).toEqual([
      expect.objectContaining({
        workflowRecordId: 'policy_authoring_destination_sections',
        nativeTestPath: 'client/src/__tests__/PolicyBuilderDestinationQuestions.test.js',
      }),
      expect.objectContaining({
        workflowRecordId: 'policy_authoring_review_triggers',
        nativeTestPath: 'client/src/__tests__/PolicyIntentReviewTriggerControl.test.js',
      }),
    ]);
  });

  test('fails closed when active completion records retain retiring-editor test ownership', async () => {
    const workflowComponents = listPolicyAuthoringClientWorkflowComponents().map(record => (
      record.id === 'policy_authoring_review_triggers'
        ? { ...record, testPath: 'client/src/__tests__/PolicyIntentEditor.test.js' }
        : record
    ));
    const audit = buildPolicyNativeWorkflowTestRehomingAudit({
      workflowComponents,
      sourceTextByPath: await readNativeWorkflowTestSources(),
    });

    expect(audit.statusId)
      .toBe(POLICY_NATIVE_WORKFLOW_TEST_REHOMING_STATUS_IDS.BLOCKED_BY_ACTIVE_OWNERSHIP);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_NATIVE_WORKFLOW_TEST_REHOMING_RISK_IDS.NATIVE_TEST_OWNERSHIP_DRIFT,
        workflowRecordId: 'policy_authoring_review_triggers',
      }),
      expect.objectContaining({
        riskId: POLICY_NATIVE_WORKFLOW_TEST_REHOMING_RISK_IDS.LEGACY_TEST_OWNERSHIP_RETAINED,
        workflowRecordId: 'policy_authoring_review_triggers',
      }),
    ]));
  });

  test('fails closed when a native successor assertion or retiring component boundary drifts', async () => {
    const artifacts = listPolicyStarterTemplateCompatibilityBridgeArtifacts().map(artifact => (
      artifact.sourcePath === 'client/src/components/policies/PolicyIntentEditor.vue'
        ? {
          ...artifact,
          dispositionId: 'replace_after_native_storage',
          normalAuthoringAllowed: true,
          rawPayloadMutationAllowed: true,
        }
        : artifact
    ));
    const sourceTextByPath = await readNativeWorkflowTestSources();
    sourceTextByPath['client/src/__tests__/PolicyIntentReviewTriggerControl.test.js'] =
      'unrelated native test';
    const audit = buildPolicyNativeWorkflowTestRehomingAudit({
      artifacts,
      compatibilityTestRecords: [],
      sourceTextByPath,
    });

    expect(audit.statusId)
      .toBe(POLICY_NATIVE_WORKFLOW_TEST_REHOMING_STATUS_IDS.BLOCKED_BY_COMPONENT_BOUNDARY);
    expect(audit.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_NATIVE_WORKFLOW_TEST_REHOMING_RISK_IDS.RETIRING_COMPONENT_ARTIFACT_INVALID,
      POLICY_NATIVE_WORKFLOW_TEST_REHOMING_RISK_IDS.RETIRING_COMPONENT_IN_NORMAL_AUTHORING,
      POLICY_NATIVE_WORKFLOW_TEST_REHOMING_RISK_IDS.RETIRING_COMPONENT_MUTATES_RAW_PAYLOAD,
      POLICY_NATIVE_WORKFLOW_TEST_REHOMING_RISK_IDS.LEGACY_TEST_BOUNDARY_INVALID,
      POLICY_NATIVE_WORKFLOW_TEST_REHOMING_RISK_IDS.NATIVE_TEST_ASSERTION_MISSING,
    ]));
  });

  test('reports missing native source text and rejects attempted audit side effects', () => {
    const sourceAudit = buildPolicyNativeWorkflowTestRehomingSourceAudit();
    const audit = buildPolicyNativeWorkflowTestRehomingAudit({
      sideEffects: {
        testFilesMoved: true,
        componentsDeleted: true,
      },
    });

    expect(sourceAudit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_NATIVE_WORKFLOW_TEST_REHOMING_RISK_IDS.NATIVE_TEST_SOURCE_MISSING,
      }),
    ]));
    expect(audit.statusId)
      .toBe(POLICY_NATIVE_WORKFLOW_TEST_REHOMING_STATUS_IDS.BLOCKED_BY_SIDE_EFFECT);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_NATIVE_WORKFLOW_TEST_REHOMING_RISK_IDS.SIDE_EFFECT_PERFORMED,
      }),
    ]));
  });
});
