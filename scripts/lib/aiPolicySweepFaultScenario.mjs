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
  validateAiClassificationEvaluationFixture,
} from '../../server/src/services/aiClassificationEvaluationFixtureContract.mjs';
import {
  evaluateAiClassificationEvaluation,
} from '../../server/src/services/aiClassificationEvaluationGrader.mjs';
import {
  validateAiClassificationEvaluationObservation,
} from '../../server/src/services/aiClassificationEvaluationObservationContract.mjs';

const AI_POLICY_SWEEP_FAULT_SCENARIO_VERSION =
  'classifarr.ai_policy_sweep_fault_scenario.v1';
const MAX_FAULT_SCENARIOS = 8;
const SCENARIO_ID_PATTERN = /^[a-z][a-z0-9_-]{0,79}$/u;

const AI_POLICY_SWEEP_FAULT_SIGNAL_IDS = Object.freeze([
  'fallback_method',
  'existing_media_method',
  'source_library_method',
]);

const AI_POLICY_SWEEP_EVALUATION_CHECK_IDS = Object.freeze([
  'classification_confidence',
  'classification_library',
  'classification_method',
  'confidence_consistency',
  'decision_kind',
  'fallback_not_allowed',
  'fixture_contract',
  'history_confidence',
  'history_library',
  'history_status',
  'library_consistency',
  'method_consistency',
  'observation_contract',
]);
const MAX_EXPECTED_CHECK_IDS = AI_POLICY_SWEEP_EVALUATION_CHECK_IDS.length;

function isPlainRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function buildIssue(id, path, message) {
  return { id, path, message };
}

function validateOnlyKeys(value, allowedKeys, path, issues) {
  if (!isPlainRecord(value)) {
    issues.push(buildIssue('invalid_fault_scenario_object', path, 'Value must be a JSON object.'));
    return false;
  }

  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      issues.push(buildIssue('unknown_fault_scenario_field', `${path}.${key}`, 'Field is not supported by the fault-scenario contract.'));
    }
  }

  return true;
}

function validateIdentifierList({
  value,
  path,
  allowedValues,
  maximumLength,
  issueId,
  issues,
  allowEmpty = false,
}) {
  if (!Array.isArray(value) || value.length > maximumLength || (!allowEmpty && value.length === 0)) {
    issues.push(buildIssue(issueId, path, `Value must be an array with ${allowEmpty ? 'zero to' : 'one to'} ${maximumLength} entries.`));
    return;
  }

  const seen = new Set();
  value.forEach((entry, index) => {
    if (typeof entry !== 'string' || !allowedValues.has(entry) || seen.has(entry)) {
      issues.push(buildIssue(issueId, `${path}[${index}]`, 'Value must be a unique supported identifier.'));
    }
    seen.add(entry);
  });
}

function validateExpectedFaultOutcome(value, path, issues) {
  if (!validateOnlyKeys(value, ['evaluationPassed', 'failureCheckIds', 'signalIds'], path, issues)) {
    return;
  }

  if (typeof value.evaluationPassed !== 'boolean') {
    issues.push(buildIssue('invalid_fault_scenario_expected_evaluation', `${path}.evaluationPassed`, 'evaluationPassed must be boolean.'));
  }
  validateIdentifierList({
    value: value.signalIds,
    path: `${path}.signalIds`,
    allowedValues: new Set(AI_POLICY_SWEEP_FAULT_SIGNAL_IDS),
    maximumLength: AI_POLICY_SWEEP_FAULT_SIGNAL_IDS.length,
    issueId: 'invalid_fault_scenario_signal_id',
    issues,
    allowEmpty: true,
  });
  validateIdentifierList({
    value: value.failureCheckIds,
    path: `${path}.failureCheckIds`,
    allowedValues: new Set(AI_POLICY_SWEEP_EVALUATION_CHECK_IDS),
    maximumLength: MAX_EXPECTED_CHECK_IDS,
    issueId: 'invalid_fault_scenario_check_id',
    issues,
    allowEmpty: true,
  });
  if (value.evaluationPassed === false && Array.isArray(value.failureCheckIds) && value.failureCheckIds.length === 0) {
    issues.push(buildIssue('missing_fault_scenario_failure_check_id', `${path}.failureCheckIds`, 'A failed evaluation expectation must name at least one failed grader check.'));
  }
  if (value.evaluationPassed === true && Array.isArray(value.failureCheckIds) && value.failureCheckIds.length > 0) {
    issues.push(buildIssue('unexpected_fault_scenario_failure_check_id', `${path}.failureCheckIds`, 'A passing evaluation expectation cannot name failed grader checks.'));
  }
}

function appendValidationIssues(validation, path, issueId, issues) {
  if (validation.ok) return;
  for (const issue of validation.issues) {
    issues.push(buildIssue(issueId, `${path}.${issue.path}`, issue.message));
  }
}

function validateFaultScenario(scenario, index, ids, issues) {
  const path = `scenarios[${index}]`;
  if (!validateOnlyKeys(scenario, ['expected', 'fixture', 'id', 'observation'], path, issues)) {
    return;
  }

  if (typeof scenario.id !== 'string' || !SCENARIO_ID_PATTERN.test(scenario.id)) {
    issues.push(buildIssue('invalid_fault_scenario_id', `${path}.id`, 'Scenario ID must be a lower-case bounded identifier.'));
  } else if (ids.has(scenario.id)) {
    issues.push(buildIssue('duplicate_fault_scenario_id', `${path}.id`, 'Scenario IDs must be unique.'));
  } else {
    ids.add(scenario.id);
  }

  if (!isPlainRecord(scenario.fixture)) {
    issues.push(buildIssue('invalid_fault_scenario_fixture', `${path}.fixture`, 'Fixture must be a versioned evaluation fixture object.'));
  } else {
    appendValidationIssues(
      validateAiClassificationEvaluationFixture(scenario.fixture),
      `${path}.fixture`,
      'invalid_fault_scenario_fixture',
      issues,
    );
    if (typeof scenario.id === 'string' && scenario.fixture.id !== scenario.id) {
      issues.push(buildIssue('fault_scenario_fixture_id_mismatch', `${path}.fixture.id`, 'Fixture ID must match its enclosing scenario ID.'));
    }
  }

  if (!isPlainRecord(scenario.observation)) {
    issues.push(buildIssue('invalid_fault_scenario_observation', `${path}.observation`, 'Observation must be a bounded evaluation observation object.'));
  } else {
    appendValidationIssues(
      validateAiClassificationEvaluationObservation(scenario.observation),
      `${path}.observation`,
      'invalid_fault_scenario_observation',
      issues,
    );
  }

  if (!isPlainRecord(scenario.expected)) {
    issues.push(buildIssue('invalid_fault_scenario_expected', `${path}.expected`, 'Expected outcome must be an object.'));
  } else {
    validateExpectedFaultOutcome(scenario.expected, `${path}.expected`, issues);
  }
}

function validateAiPolicySweepFaultScenarioDocument(document) {
  const issues = [];
  if (!validateOnlyKeys(document, ['scenarios', 'version'], 'document', issues)) {
    return { ok: false, scenarioCount: 0, issues };
  }

  if (document.version !== AI_POLICY_SWEEP_FAULT_SCENARIO_VERSION) {
    issues.push(buildIssue('invalid_fault_scenario_document_version', 'document.version', 'Document must declare the current fault-scenario contract version.'));
  }
  if (!Array.isArray(document.scenarios) || document.scenarios.length === 0 || document.scenarios.length > MAX_FAULT_SCENARIOS) {
    issues.push(buildIssue('invalid_fault_scenario_list', 'document.scenarios', `Scenarios must contain one to ${MAX_FAULT_SCENARIOS} entries.`));
  } else {
    const ids = new Set();
    document.scenarios.forEach((scenario, index) => validateFaultScenario(scenario, index, ids, issues));
  }

  return {
    ok: issues.length === 0,
    scenarioCount: Array.isArray(document.scenarios) ? document.scenarios.length : 0,
    issues,
  };
}

function buildFaultSignalIds(observation) {
  const methods = [observation?.classification?.method, observation?.history?.method];
  return AI_POLICY_SWEEP_FAULT_SIGNAL_IDS.filter((signalId) => {
    const method = signalId.replace(/_method$/u, '');
    return methods.includes(method);
  });
}

function buildFailedCheckIds(evaluation) {
  return evaluation.checks
    .filter(check => check.passed === false)
    .map(check => check.id)
    .sort();
}

function sameIdentifierSet(left, right) {
  if (left.length !== right.length) return false;
  const leftSet = new Set(left);
  return right.every(value => leftSet.has(value));
}

function evaluateAiPolicySweepFaultScenario(scenario) {
  const evaluation = evaluateAiClassificationEvaluation({
    fixture: scenario.fixture,
    observation: scenario.observation,
  });
  const actual = {
    evaluationPassed: evaluation.passed,
    failureCheckIds: buildFailedCheckIds(evaluation),
    signalIds: buildFaultSignalIds(scenario.observation),
  };
  const expected = {
    evaluationPassed: scenario.expected.evaluationPassed,
    failureCheckIds: [...scenario.expected.failureCheckIds].sort(),
    signalIds: [...scenario.expected.signalIds].sort(),
  };
  const checks = [
    {
      id: 'evaluation_passed',
      passed: actual.evaluationPassed === expected.evaluationPassed,
    },
    {
      id: 'failure_check_ids',
      passed: sameIdentifierSet(actual.failureCheckIds, expected.failureCheckIds),
    },
    {
      id: 'fault_signal_ids',
      passed: sameIdentifierSet(actual.signalIds, expected.signalIds),
    },
  ];

  return {
    id: scenario.id,
    passed: checks.every(check => check.passed),
    expected,
    actual,
    checks,
  };
}

function runAiPolicySweepFaultScenarioDocument(document) {
  const validation = validateAiPolicySweepFaultScenarioDocument(document);
  if (!validation.ok) {
    return {
      validation,
      results: [],
      summary: {
        passedScenarioCount: 0,
        failedScenarioCount: 0,
        detectedFaultSignalCount: 0,
      },
    };
  }

  const results = document.scenarios.map(evaluateAiPolicySweepFaultScenario);
  return {
    validation,
    results,
    summary: {
      passedScenarioCount: results.filter(result => result.passed).length,
      failedScenarioCount: results.filter(result => !result.passed).length,
      detectedFaultSignalCount: results.reduce(
        (total, result) => total + result.actual.signalIds.length,
        0,
      ),
    },
  };
}

export {
  AI_POLICY_SWEEP_EVALUATION_CHECK_IDS,
  AI_POLICY_SWEEP_FAULT_SCENARIO_VERSION,
  AI_POLICY_SWEEP_FAULT_SIGNAL_IDS,
  evaluateAiPolicySweepFaultScenario,
  runAiPolicySweepFaultScenarioDocument,
  validateAiPolicySweepFaultScenarioDocument,
};
