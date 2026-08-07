/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  POLICY_AUTHORING_E2E_ACCESSIBILITY_RULE_IDS,
  POLICY_AUTHORING_E2E_WORKFLOW_STATE_IDS,
  POLICY_AUTHORING_E2E_WORKFLOW_TESTS_RISK_IDS,
  POLICY_AUTHORING_E2E_WORKFLOW_TESTS_VERSION,
  buildPolicyAuthoringE2eWorkflowTests,
  validatePolicyAuthoringE2eWorkflowTests,
} from '../../services/policyAuthoringE2eWorkflowTests.mjs';

const ALL_STATES = Object.values(POLICY_AUTHORING_E2E_WORKFLOW_STATE_IDS);
const ALL_RULES = Object.values(POLICY_AUTHORING_E2E_ACCESSIBILITY_RULE_IDS);

function buildFullCoverageSpecs() {
  return [{
    path: 'client/browser-tests/policy-authoring-full.spec.js',
    owner: 'Full coverage spec',
    workflowStateIds: ALL_STATES,
    accessibilityRuleIds: ALL_RULES,
    replacesServerContract: false,
  }];
}

describe('policyAuthoringE2eWorkflowTests', () => {
  test('the current-state contract version and structure are correct', () => {
    expect(POLICY_AUTHORING_E2E_WORKFLOW_TESTS_VERSION).toBe(
      'policy.authoring_e2e_workflow_tests.v1');
    expect(ALL_STATES).toHaveLength(9);
    expect(Object.values(POLICY_AUTHORING_E2E_ACCESSIBILITY_RULE_IDS)).toHaveLength(5);
  });

  test('passes when all nine workflow states and required accessibility rules are covered', () => {
    const contract = buildPolicyAuthoringE2eWorkflowTests({
      specs: buildFullCoverageSpecs(),
      exists: () => true,
    });

    expect(contract.ok).toBe(true);
    expect(contract.issueCount).toBe(0);
    expect(contract.missingWorkflowStates).toEqual([]);
    expect(contract.coveredWorkflowStates).toHaveLength(9);
    expect(contract.nextStep.stepId).toBe('release_readiness');
  });

  test('fails closed when a required workflow state is missing', () => {
    const specs = [{
      path: 'client/browser-tests/partial.spec.js',
      owner: 'Partial spec',
      workflowStateIds: ALL_STATES.filter(
        s => s !== POLICY_AUTHORING_E2E_WORKFLOW_STATE_IDS.CONCURRENT_CREATE),
      accessibilityRuleIds: ALL_RULES,
      replacesServerContract: false,
    }];

    const contract = buildPolicyAuthoringE2eWorkflowTests({
      specs,
      exists: () => true,
    });

    expect(contract.ok).toBe(false);
    expect(contract.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_AUTHORING_E2E_WORKFLOW_TESTS_RISK_IDS.MISSING_WORKFLOW_STATE,
      }),
    ]));
    expect(contract.missingWorkflowStates).toContain('concurrent_create');
  });

  test('fails closed when a spec file does not exist on disk', () => {
    const contract = buildPolicyAuthoringE2eWorkflowTests({
      specs: [{
        path: 'client/browser-tests/nonexistent.spec.js',
        owner: 'Missing spec',
        workflowStateIds: ALL_STATES,
        accessibilityRuleIds: ALL_RULES,
        replacesServerContract: false,
      }],
      exists: () => false,
    });

    expect(contract.ok).toBe(false);
    expect(contract.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_AUTHORING_E2E_WORKFLOW_TESTS_RISK_IDS.MISSING_SPEC_FILE,
      }),
    ]));
  });

  test('fails closed when keyboard operability is not bound', () => {
    const specs = [{
      path: 'client/browser-tests/no-keyboard.spec.js',
      owner: 'No keyboard spec',
      workflowStateIds: ALL_STATES,
      accessibilityRuleIds: ALL_RULES.filter(
        r => r !== POLICY_AUTHORING_E2E_ACCESSIBILITY_RULE_IDS.KEYBOARD_OPERABLE),
      replacesServerContract: false,
    }];

    const contract = buildPolicyAuthoringE2eWorkflowTests({
      specs,
      exists: () => true,
    });

    expect(contract.ok).toBe(false);
    expect(contract.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_AUTHORING_E2E_WORKFLOW_TESTS_RISK_IDS.MISSING_KEYBOARD_OPERABILITY,
      }),
    ]));
  });

  test('fails closed when single primary action rule is not bound', () => {
    const specs = [{
      path: 'client/browser-tests/no-decision-load.spec.js',
      owner: 'No decision-load spec',
      workflowStateIds: ALL_STATES,
      accessibilityRuleIds: ALL_RULES.filter(
        r => r !== POLICY_AUTHORING_E2E_ACCESSIBILITY_RULE_IDS.SINGLE_PRIMARY_ACTION),
      replacesServerContract: false,
    }];

    const contract = buildPolicyAuthoringE2eWorkflowTests({
      specs,
      exists: () => true,
    });

    expect(contract.ok).toBe(false);
    expect(contract.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_AUTHORING_E2E_WORKFLOW_TESTS_RISK_IDS.MISSING_SINGLE_PRIMARY_ACTION,
      }),
    ]));
  });

  test('rejects a spec that claims to replace server-contract tests', () => {
    const contract = buildPolicyAuthoringE2eWorkflowTests({
      specs: [{
        ...buildFullCoverageSpecs()[0],
        replacesServerContract: true,
      }],
      exists: () => true,
    });

    expect(contract.ok).toBe(false);
    expect(contract.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_AUTHORING_E2E_WORKFLOW_TESTS_RISK_IDS.BROWSER_TEST_REPLACES_SERVER_CONTRACT,
      }),
    ]));
  });

  test('rejects a contract with an unsupported version', () => {
    const contract = buildPolicyAuthoringE2eWorkflowTests({
      specs: buildFullCoverageSpecs(),
      exists: () => true,
    });
    const validation = validatePolicyAuthoringE2eWorkflowTests({
      ...contract,
      version: 'policy.authoring_e2e_workflow_tests.v0',
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_AUTHORING_E2E_WORKFLOW_TESTS_RISK_IDS.VERSION_MISMATCH,
      }),
    ]));
  });

  test('rejects a contract that reports a performed side effect', () => {
    const contract = buildPolicyAuthoringE2eWorkflowTests({
      specs: buildFullCoverageSpecs(),
      exists: () => true,
    });
    const tampered = {
      ...contract,
      sideEffects: { ...contract.sideEffects, browserTestsExecuted: true },
    };

    const validation = validatePolicyAuthoringE2eWorkflowTests(tampered);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_AUTHORING_E2E_WORKFLOW_TESTS_RISK_IDS.SIDE_EFFECT_PERFORMED,
      }),
    ]));
  });

  test('the existing adjustment spec covers eligible create and admission rejection', () => {
    const contract = buildPolicyAuthoringE2eWorkflowTests({
      exists: () => true,
    });

    expect(contract.coveredWorkflowStates).toEqual(expect.arrayContaining([
      POLICY_AUTHORING_E2E_WORKFLOW_STATE_IDS.ELIGIBLE_CREATE,
      POLICY_AUTHORING_E2E_WORKFLOW_STATE_IDS.ADMISSION_REJECTION,
    ]));
  });
});
