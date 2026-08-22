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
  validateAiClassificationEvaluationFixture,
} from './aiClassificationEvaluationFixtureContract.mjs';
import {
  validateAiClassificationEvaluationObservation,
} from './aiClassificationEvaluationObservationContract.mjs';

const AI_CLASSIFICATION_EVALUATION_RESULT_VERSION =
  'classifarr.ai_classification_evaluation_result.v1';
const CONFIDENCE_COMPARISON_TOLERANCE = 0.001;

function buildCheck(id, passed, expected = null, actual = null) {
  return { id, passed, expected, actual };
}

function deriveDecisionKind(classification = {}) {
  if (classification.needsRetry === true && classification.needsClarification === true) {
    return 'invalid';
  }
  if (classification.needsRetry === true) return 'retry';
  if (classification.needsClarification === true) return 'clarification';
  if (classification.library !== null) return 'classified';
  return 'invalid';
}

function librariesMatch(expected = {}, actual = null) {
  if (actual === null || typeof actual !== 'object') return false;

  return (!Object.hasOwn(expected, 'id') || expected.id === actual.id) &&
    (!Object.hasOwn(expected, 'name') || expected.name === actual.name);
}

function observedLibrariesMatch(classificationLibrary, historyLibrary) {
  if (classificationLibrary === null || historyLibrary === null) {
    return classificationLibrary === historyLibrary;
  }

  const bothHaveId = Object.hasOwn(classificationLibrary, 'id') && Object.hasOwn(historyLibrary, 'id');
  const bothHaveName = Object.hasOwn(classificationLibrary, 'name') &&
    Object.hasOwn(historyLibrary, 'name');

  return (!bothHaveId || classificationLibrary.id === historyLibrary.id) &&
    (!bothHaveName || classificationLibrary.name === historyLibrary.name);
}

function confidenceMatchesRange(confidence, range) {
  return confidence >= range.minimum && confidence <= range.maximum;
}

function evaluateExpectedOutcome(expectedOutcome, observation) {
  const classification = observation.classification;
  const history = observation.history;
  const decisionKind = deriveDecisionKind(classification);
  const checks = [
    buildCheck(
      'decision_kind',
      decisionKind === expectedOutcome.decisionKind,
      expectedOutcome.decisionKind,
      decisionKind
    ),
    buildCheck(
      'classification_method',
      expectedOutcome.methods.includes(classification.method),
      expectedOutcome.methods,
      classification.method
    ),
    buildCheck(
      'history_status',
      expectedOutcome.historyStatuses.includes(history.status),
      expectedOutcome.historyStatuses,
      history.status
    ),
  ];

  if (expectedOutcome.decisionKind === 'classified') {
    checks.push(buildCheck(
      'classification_library',
      librariesMatch(expectedOutcome.library, classification.library),
      expectedOutcome.library,
      classification.library
    ));
    checks.push(buildCheck(
      'history_library',
      librariesMatch(expectedOutcome.library, history.library),
      expectedOutcome.library,
      history.library
    ));
    checks.push(buildCheck(
      'classification_confidence',
      confidenceMatchesRange(classification.confidence, expectedOutcome.confidence),
      expectedOutcome.confidence,
      classification.confidence
    ));
    checks.push(buildCheck(
      'history_confidence',
      confidenceMatchesRange(history.confidence, expectedOutcome.confidence),
      expectedOutcome.confidence,
      history.confidence
    ));
  }

  return {
    checks,
    failedCheckCount: checks.filter(check => !check.passed).length,
  };
}

function buildConsistencyChecks(observation) {
  const classification = observation.classification;
  const history = observation.history;

  return [
    buildCheck(
      'method_consistency',
      classification.method === history.method,
      classification.method,
      history.method
    ),
    buildCheck(
      'confidence_consistency',
      Math.abs(classification.confidence - history.confidence) <= CONFIDENCE_COMPARISON_TOLERANCE,
      classification.confidence,
      history.confidence
    ),
    buildCheck(
      'library_consistency',
      observedLibrariesMatch(classification.library, history.library),
      classification.library,
      history.library
    ),
  ];
}

function buildInvalidEvaluation({ fixtureValidation, observationValidation, fixtureId = null }) {
  const checks = [
    buildCheck('fixture_contract', fixtureValidation.ok, null, fixtureValidation.issues),
    buildCheck('observation_contract', observationValidation.ok, null, observationValidation.issues),
  ];

  return {
    version: AI_CLASSIFICATION_EVALUATION_RESULT_VERSION,
    fixtureId,
    passed: false,
    matchedOutcomeIndex: null,
    observedDecisionKind: null,
    score: {
      passedCheckCount: checks.filter(check => check.passed).length,
      totalCheckCount: checks.length,
      percentage: 0,
    },
    checks,
  };
}

function evaluateAiClassificationEvaluation({ fixture, observation } = {}) {
  const fixtureValidation = validateAiClassificationEvaluationFixture(fixture);
  const observationValidation = validateAiClassificationEvaluationObservation(observation);
  const fixtureId = typeof fixture?.id === 'string' ? fixture.id : null;

  if (!fixtureValidation.ok || !observationValidation.ok) {
    return buildInvalidEvaluation({ fixtureValidation, observationValidation, fixtureId });
  }

  const candidates = fixture.expected.outcomes.map((expectedOutcome, index) => ({
    index,
    ...evaluateExpectedOutcome(expectedOutcome, observation),
  }));
  const selectedCandidate = candidates.reduce((best, candidate) =>
    candidate.failedCheckCount < best.failedCheckCount ? candidate : best
  );
  const globalChecks = [
    buildCheck(
      'fallback_not_allowed',
      fixture.expected.fallbackAllowed ||
        (observation.classification.method !== 'fallback' && observation.history.method !== 'fallback'),
      fixture.expected.fallbackAllowed ? 'fallback_permitted' : 'fallback_forbidden',
      [observation.classification.method, observation.history.method]
    ),
    ...buildConsistencyChecks(observation),
  ];
  const checks = [...selectedCandidate.checks, ...globalChecks];
  const passedCheckCount = checks.filter(check => check.passed).length;
  const passed = passedCheckCount === checks.length;

  return {
    version: AI_CLASSIFICATION_EVALUATION_RESULT_VERSION,
    fixtureId,
    passed,
    matchedOutcomeIndex: passed ? selectedCandidate.index : null,
    observedDecisionKind: deriveDecisionKind(observation.classification),
    score: {
      passedCheckCount,
      totalCheckCount: checks.length,
      percentage: Number(((passedCheckCount / checks.length) * 100).toFixed(2)),
    },
    checks,
  };
}

export {
  AI_CLASSIFICATION_EVALUATION_RESULT_VERSION,
  evaluateAiClassificationEvaluation,
};
