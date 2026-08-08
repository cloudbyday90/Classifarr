/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

 

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const POLICY_AUTHORING_E2E_WORKFLOW_TESTS_VERSION =
  'policy.authoring_e2e_workflow_tests.v1';

const POLICY_AUTHORING_E2E_WORKFLOW_STATE_IDS = Object.freeze({
  ELIGIBLE_CREATE: 'eligible_create',
  EXISTING_POLICY: 'existing_policy',
  SPARSE_EVIDENCE: 'sparse_evidence',
  STALE_PROPOSAL: 'stale_proposal',
  CONCURRENT_CREATE: 'concurrent_create',
  LOST_RESPONSE_RECOVERY: 'lost_response_recovery',
  ADMISSION_REJECTION: 'admission_rejection',
  AUTOMATIC_RECOVERY: 'automatic_recovery',
  NO_ACTION_GUIDANCE: 'no_action_guidance',
});

const POLICY_AUTHORING_E2E_ACCESSIBILITY_RULE_IDS = Object.freeze({
  KEYBOARD_OPERABLE: 'keyboard_operable',
  VISIBLE_FOCUS: 'visible_focus',
  SINGLE_PRIMARY_ACTION: 'single_primary_action',
  NO_DUPLICATE_WARNING_CONCEPT: 'no_duplicate_warning_concept',
  NO_INTERNAL_DIAGNOSTICS: 'no_internal_diagnostics_in_normal_path',
});

const POLICY_AUTHORING_E2E_WORKFLOW_TESTS_RISK_IDS = Object.freeze({
  MISSING_WORKFLOW_STATE: 'missing_workflow_state',
  MISSING_SPEC_FILE: 'missing_spec_file',
  SPEC_PATH_OUTSIDE_REPO: 'spec_path_outside_repo',
  MISSING_KEYBOARD_OPERABILITY: 'missing_keyboard_operability',
  MISSING_SINGLE_PRIMARY_ACTION: 'missing_single_primary_action',
  UNKNOWN_ACCESSIBILITY_RULE: 'unknown_accessibility_rule',
  UNKNOWN_WORKFLOW_STATE: 'unknown_workflow_state',
  BROWSER_TEST_REPLACES_SERVER_CONTRACT: 'browser_test_replaces_server_contract',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
  VERSION_MISMATCH: 'version_mismatch',
});

const REQUIRED_WORKFLOW_STATE_IDS = Object.freeze([
  POLICY_AUTHORING_E2E_WORKFLOW_STATE_IDS.ELIGIBLE_CREATE,
  POLICY_AUTHORING_E2E_WORKFLOW_STATE_IDS.EXISTING_POLICY,
  POLICY_AUTHORING_E2E_WORKFLOW_STATE_IDS.SPARSE_EVIDENCE,
  POLICY_AUTHORING_E2E_WORKFLOW_STATE_IDS.STALE_PROPOSAL,
  POLICY_AUTHORING_E2E_WORKFLOW_STATE_IDS.CONCURRENT_CREATE,
  POLICY_AUTHORING_E2E_WORKFLOW_STATE_IDS.LOST_RESPONSE_RECOVERY,
  POLICY_AUTHORING_E2E_WORKFLOW_STATE_IDS.ADMISSION_REJECTION,
  POLICY_AUTHORING_E2E_WORKFLOW_STATE_IDS.AUTOMATIC_RECOVERY,
  POLICY_AUTHORING_E2E_WORKFLOW_STATE_IDS.NO_ACTION_GUIDANCE,
]);

const REQUIRED_ACCESSIBILITY_RULE_IDS = Object.freeze([
  POLICY_AUTHORING_E2E_ACCESSIBILITY_RULE_IDS.KEYBOARD_OPERABLE,
  POLICY_AUTHORING_E2E_ACCESSIBILITY_RULE_IDS.SINGLE_PRIMARY_ACTION,
]);

const VALID_WORKFLOW_STATE_IDS = Object.freeze(
  Object.values(POLICY_AUTHORING_E2E_WORKFLOW_STATE_IDS),
);
const VALID_ACCESSIBILITY_RULE_IDS = Object.freeze(
  Object.values(POLICY_AUTHORING_E2E_ACCESSIBILITY_RULE_IDS),
);

function spec(path, workflowStateIds, accessibilityRuleIds, owner) {
  return Object.freeze({
    path,
    owner,
    workflowStateIds: Object.freeze(workflowStateIds),
    accessibilityRuleIds: Object.freeze(accessibilityRuleIds),
    replacesServerContract: false,
  });
}

const DEFAULT_BROWSER_SPECS = Object.freeze([
  spec(
    'client/browser-tests/policy-authoring-live-entry-path.spec.js',
    [POLICY_AUTHORING_E2E_WORKFLOW_STATE_IDS.ELIGIBLE_CREATE],
    [
      POLICY_AUTHORING_E2E_ACCESSIBILITY_RULE_IDS.KEYBOARD_OPERABLE,
      POLICY_AUTHORING_E2E_ACCESSIBILITY_RULE_IDS.VISIBLE_FOCUS,
      POLICY_AUTHORING_E2E_ACCESSIBILITY_RULE_IDS.SINGLE_PRIMARY_ACTION,
      POLICY_AUTHORING_E2E_ACCESSIBILITY_RULE_IDS.NO_INTERNAL_DIAGNOSTICS,
    ],
    'Live lifecycle entry path and admitted create action',
  ),
  spec(
    'client/browser-tests/policy-authoring-adjustment.spec.js',
    [
      POLICY_AUTHORING_E2E_WORKFLOW_STATE_IDS.ELIGIBLE_CREATE,
      POLICY_AUTHORING_E2E_WORKFLOW_STATE_IDS.ADMISSION_REJECTION,
    ],
    [
      POLICY_AUTHORING_E2E_ACCESSIBILITY_RULE_IDS.KEYBOARD_OPERABLE,
      POLICY_AUTHORING_E2E_ACCESSIBILITY_RULE_IDS.VISIBLE_FOCUS,
      POLICY_AUTHORING_E2E_ACCESSIBILITY_RULE_IDS.SINGLE_PRIMARY_ACTION,
      POLICY_AUTHORING_E2E_ACCESSIBILITY_RULE_IDS.NO_DUPLICATE_WARNING_CONCEPT,
      POLICY_AUTHORING_E2E_ACCESSIBILITY_RULE_IDS.NO_INTERNAL_DIAGNOSTICS,
    ],
    'Policy authoring adjustment E2E (eligible create, admission rejection)',
  ),
  spec(
    'client/browser-tests/policy-authoring-existing-policy.spec.js',
    [POLICY_AUTHORING_E2E_WORKFLOW_STATE_IDS.EXISTING_POLICY],
    [
      POLICY_AUTHORING_E2E_ACCESSIBILITY_RULE_IDS.SINGLE_PRIMARY_ACTION,
      POLICY_AUTHORING_E2E_ACCESSIBILITY_RULE_IDS.NO_INTERNAL_DIAGNOSTICS,
    ],
    'Existing native policy shows summary, not create flow',
  ),
  spec(
    'client/browser-tests/policy-authoring-sparse-evidence.spec.js',
    [POLICY_AUTHORING_E2E_WORKFLOW_STATE_IDS.SPARSE_EVIDENCE],
    [
      POLICY_AUTHORING_E2E_ACCESSIBILITY_RULE_IDS.SINGLE_PRIMARY_ACTION,
      POLICY_AUTHORING_E2E_ACCESSIBILITY_RULE_IDS.NO_INTERNAL_DIAGNOSTICS,
    ],
    'Sparse library shows declared-intent guidance',
  ),
  spec(
    'client/browser-tests/policy-authoring-stale-proposal.spec.js',
    [POLICY_AUTHORING_E2E_WORKFLOW_STATE_IDS.STALE_PROPOSAL],
    [
      POLICY_AUTHORING_E2E_ACCESSIBILITY_RULE_IDS.SINGLE_PRIMARY_ACTION,
      POLICY_AUTHORING_E2E_ACCESSIBILITY_RULE_IDS.NO_INTERNAL_DIAGNOSTICS,
    ],
    'Stale proposal shows recovery guidance',
  ),
  spec(
    'client/browser-tests/policy-authoring-concurrent-create.spec.js',
    [POLICY_AUTHORING_E2E_WORKFLOW_STATE_IDS.CONCURRENT_CREATE],
    [
      POLICY_AUTHORING_E2E_ACCESSIBILITY_RULE_IDS.SINGLE_PRIMARY_ACTION,
      POLICY_AUTHORING_E2E_ACCESSIBILITY_RULE_IDS.NO_INTERNAL_DIAGNOSTICS,
    ],
    'Concurrent create does not produce a second policy',
  ),
  spec(
    'client/browser-tests/policy-authoring-lost-response-recovery.spec.js',
    [POLICY_AUTHORING_E2E_WORKFLOW_STATE_IDS.LOST_RESPONSE_RECOVERY],
    [
      POLICY_AUTHORING_E2E_ACCESSIBILITY_RULE_IDS.SINGLE_PRIMARY_ACTION,
      POLICY_AUTHORING_E2E_ACCESSIBILITY_RULE_IDS.NO_INTERNAL_DIAGNOSTICS,
    ],
    'Lost response reloads lifecycle rather than resubmitting',
  ),
  spec(
    'client/browser-tests/policy-authoring-automatic-recovery.spec.js',
    [POLICY_AUTHORING_E2E_WORKFLOW_STATE_IDS.AUTOMATIC_RECOVERY],
    [
      POLICY_AUTHORING_E2E_ACCESSIBILITY_RULE_IDS.SINGLE_PRIMARY_ACTION,
      POLICY_AUTHORING_E2E_ACCESSIBILITY_RULE_IDS.NO_DUPLICATE_WARNING_CONCEPT,
      POLICY_AUTHORING_E2E_ACCESSIBILITY_RULE_IDS.NO_INTERNAL_DIAGNOSTICS,
    ],
    'Automatic profile recovery is informational',
  ),
  spec(
    'client/browser-tests/policy-authoring-no-action-guidance.spec.js',
    [POLICY_AUTHORING_E2E_WORKFLOW_STATE_IDS.NO_ACTION_GUIDANCE],
    [
      POLICY_AUTHORING_E2E_ACCESSIBILITY_RULE_IDS.SINGLE_PRIMARY_ACTION,
      POLICY_AUTHORING_E2E_ACCESSIBILITY_RULE_IDS.NO_INTERNAL_DIAGNOSTICS,
    ],
    'Blocked library shows bounded guidance',
  ),
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildIssue(riskId, message, detail = null) {
  return {
    riskId,
    message,
    ...(detail ? { detail } : {}),
  };
}

function resolveWithinRepo(path) {
  const normalized = normalizeString(path);
  if (!normalized) return false;
  const resolved = resolve(REPO_ROOT, normalized);
  return resolved.startsWith(REPO_ROOT);
}

function buildPolicyAuthoringE2eWorkflowTests({
  specs = DEFAULT_BROWSER_SPECS,
  exists = existsSync,
} = {}) {
  const normalizedSpecs = asArray(specs);
  const issues = [];
  const coveredWorkflowStates = new Set();
  const coveredAccessibilityRules = new Set();

  normalizedSpecs.forEach(specRecord => {
    const path = normalizeString(specRecord.path);

    if (!path) {
      issues.push(buildIssue(
        POLICY_AUTHORING_E2E_WORKFLOW_TESTS_RISK_IDS.MISSING_SPEC_FILE,
        'Every browser spec must declare a repository-relative path.',
      ));
      return;
    }

    if (!resolveWithinRepo(path)) {
      issues.push(buildIssue(
        POLICY_AUTHORING_E2E_WORKFLOW_TESTS_RISK_IDS.SPEC_PATH_OUTSIDE_REPO,
        'Browser spec path must resolve inside the repository.',
        path,
      ));
      return;
    }

    const specExists = exists(resolve(REPO_ROOT, path));
    if (!specExists) {
      issues.push(buildIssue(
        POLICY_AUTHORING_E2E_WORKFLOW_TESTS_RISK_IDS.MISSING_SPEC_FILE,
        'Browser spec file must exist on disk.',
        path,
      ));
    }

    asArray(specRecord.workflowStateIds).forEach(stateId => {
      const normalized = normalizeString(stateId);
      if (!VALID_WORKFLOW_STATE_IDS.includes(normalized)) {
        issues.push(buildIssue(
          POLICY_AUTHORING_E2E_WORKFLOW_TESTS_RISK_IDS.UNKNOWN_WORKFLOW_STATE,
          `Unknown workflow state "${normalized}".`,
          path,
        ));
      } else {
        coveredWorkflowStates.add(normalized);
      }
    });

    asArray(specRecord.accessibilityRuleIds).forEach(ruleId => {
      const normalized = normalizeString(ruleId);
      if (!VALID_ACCESSIBILITY_RULE_IDS.includes(normalized)) {
        issues.push(buildIssue(
          POLICY_AUTHORING_E2E_WORKFLOW_TESTS_RISK_IDS.UNKNOWN_ACCESSIBILITY_RULE,
          `Unknown accessibility rule "${normalized}".`,
          path,
        ));
      } else {
        coveredAccessibilityRules.add(normalized);
      }
    });

    if (specRecord.replacesServerContract === true) {
      issues.push(buildIssue(
        POLICY_AUTHORING_E2E_WORKFLOW_TESTS_RISK_IDS.BROWSER_TEST_REPLACES_SERVER_CONTRACT,
        'Browser tests must not replace server-contract, client-unit, or integration tests.',
        path,
      ));
    }
  });

  REQUIRED_WORKFLOW_STATE_IDS.forEach(stateId => {
    if (!coveredWorkflowStates.has(stateId)) {
      issues.push(buildIssue(
        POLICY_AUTHORING_E2E_WORKFLOW_TESTS_RISK_IDS.MISSING_WORKFLOW_STATE,
        `Required workflow state "${stateId}" must be covered by at least one browser spec.`,
      ));
    }
  });

  REQUIRED_ACCESSIBILITY_RULE_IDS.forEach(ruleId => {
    if (!coveredAccessibilityRules.has(ruleId)) {
      issues.push(buildIssue(
        ruleId === POLICY_AUTHORING_E2E_ACCESSIBILITY_RULE_IDS.KEYBOARD_OPERABLE
          ? POLICY_AUTHORING_E2E_WORKFLOW_TESTS_RISK_IDS.MISSING_KEYBOARD_OPERABILITY
          : POLICY_AUTHORING_E2E_WORKFLOW_TESTS_RISK_IDS.MISSING_SINGLE_PRIMARY_ACTION,
        `Required accessibility rule "${ruleId}" must be bound to at least one browser spec.`,
      ));
    }
  });

  const contract = {
    version: POLICY_AUTHORING_E2E_WORKFLOW_TESTS_VERSION,
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
    specCount: normalizedSpecs.length,
    requiredWorkflowStates: REQUIRED_WORKFLOW_STATE_IDS,
    coveredWorkflowStates: [...coveredWorkflowStates].sort(),
    missingWorkflowStates: REQUIRED_WORKFLOW_STATE_IDS.filter(
      id => !coveredWorkflowStates.has(id),
    ),
    requiredAccessibilityRules: REQUIRED_ACCESSIBILITY_RULE_IDS,
    coveredAccessibilityRules: [...coveredAccessibilityRules].sort(),
    sideEffects: {
      browserTestsExecuted: false,
      specsWritten: false,
      serverContractsMutated: false,
    },
    nextStep: issues.length === 0
      ? {
        stepId: 'release_readiness',
        label: 'Release readiness',
      }
      : {
        stepId: 'resolve_e2e_coverage_gaps',
        label: 'Resolve E2E coverage gaps',
      },
  };

  contract.validation = validatePolicyAuthoringE2eWorkflowTests(contract);
  issues.forEach(issue => {
    if (!contract.validation.issues.some(existing =>
      existing.riskId === issue.riskId)) {
      contract.validation.issues.push(issue);
    }
  });
  contract.validation.issueCount = contract.validation.issues.length;
  contract.validation.ok = contract.validation.issues.length === 0;
  contract.ok = contract.validation.ok;

  return contract;
}

function validatePolicyAuthoringE2eWorkflowTests(contract) {
  const normalized = contract && typeof contract === 'object' ? contract : {};
  const issues = [];

  if (normalizeString(normalized.version) !==
      POLICY_AUTHORING_E2E_WORKFLOW_TESTS_VERSION) {
    issues.push(buildIssue(
      POLICY_AUTHORING_E2E_WORKFLOW_TESTS_RISK_IDS.VERSION_MISMATCH,
      'E2E workflow tests contract must use the supported version.',
    ));
  }

  const sideEffects = normalized.sideEffects && typeof normalized.sideEffects === 'object'
    ? normalized.sideEffects : {};
  Object.entries(sideEffects).forEach(([key, value]) => {
    if (value === true) {
      issues.push(buildIssue(
        POLICY_AUTHORING_E2E_WORKFLOW_TESTS_RISK_IDS.SIDE_EFFECT_PERFORMED,
        `E2E workflow tests contract cannot perform side effect "${key}".`,
      ));
    }
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  POLICY_AUTHORING_E2E_ACCESSIBILITY_RULE_IDS,
  POLICY_AUTHORING_E2E_WORKFLOW_STATE_IDS,
  POLICY_AUTHORING_E2E_WORKFLOW_TESTS_RISK_IDS,
  POLICY_AUTHORING_E2E_WORKFLOW_TESTS_VERSION,
  buildPolicyAuthoringE2eWorkflowTests,
  validatePolicyAuthoringE2eWorkflowTests,
};
