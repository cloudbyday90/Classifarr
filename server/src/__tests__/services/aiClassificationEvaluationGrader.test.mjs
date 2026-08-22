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
  AI_CLASSIFICATION_EVALUATION_FIXTURE_VERSION,
} from '../../services/aiClassificationEvaluationFixtureContract.mjs';
import {
  AI_CLASSIFICATION_EVALUATION_RESULT_VERSION,
  evaluateAiClassificationEvaluation,
} from '../../services/aiClassificationEvaluationGrader.mjs';

function buildFixture() {
  return {
    version: AI_CLASSIFICATION_EVALUATION_FIXTURE_VERSION,
    id: 'clear-mainstream-movie',
    name: 'Clear mainstream movie',
    tags: ['happy-path', 'movie'],
    request: {
      tmdbId: 550,
      mediaType: 'movie',
      title: 'Fight Club',
    },
    expected: {
      fallbackAllowed: false,
      outcomes: [
        {
          decisionKind: 'classified',
          methods: ['ai'],
          historyStatuses: ['completed'],
          library: { id: 7, name: 'Movies' },
          confidence: { minimum: 80, maximum: 100 },
        },
        {
          decisionKind: 'clarification',
          methods: ['policy_engine'],
          historyStatuses: ['awaiting_decision'],
        },
      ],
    },
  };
}

function buildClassifiedObservation(overrides = {}) {
  return {
    classification: {
      method: 'ai',
      confidence: 91,
      library: { id: 7, name: 'Movies' },
      needsClarification: false,
      needsRetry: false,
      ...(overrides.classification || {}),
    },
    history: {
      method: 'ai',
      status: 'completed',
      confidence: 91,
      library: { id: 7, name: 'Movies' },
      ...(overrides.history || {}),
    },
  };
}

describe('aiClassificationEvaluationGrader', () => {
  test('gives a complete score only to the matching explicit classification outcome', () => {
    const result = evaluateAiClassificationEvaluation({
      fixture: buildFixture(),
      observation: buildClassifiedObservation(),
    });

    expect(result).toEqual(expect.objectContaining({
      version: AI_CLASSIFICATION_EVALUATION_RESULT_VERSION,
      fixtureId: 'clear-mainstream-movie',
      passed: true,
      matchedOutcomeIndex: 0,
      observedDecisionKind: 'classified',
      score: expect.objectContaining({ percentage: 100 }),
    }));
    expect(result.checks.every(check => check.passed)).toBe(true);
  });

  test('reports the exact bounded checks that fail for a wrong library and persisted mismatch', () => {
    const result = evaluateAiClassificationEvaluation({
      fixture: buildFixture(),
      observation: buildClassifiedObservation({
        classification: { library: { id: 8, name: 'Television' } },
      }),
    });

    expect(result.passed).toBe(false);
    expect(result.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'classification_library', passed: false }),
      expect.objectContaining({ id: 'library_consistency', passed: false }),
    ]));
    expect(JSON.stringify(result)).not.toContain('Fight Club');
  });

  test('accepts an explicitly declared clarification alternative but refuses an unapproved fallback', () => {
    const clarificationResult = evaluateAiClassificationEvaluation({
      fixture: buildFixture(),
      observation: buildClassifiedObservation({
        classification: {
          method: 'policy_engine',
          confidence: 0,
          library: null,
          needsClarification: true,
        },
        history: {
          method: 'policy_engine',
          status: 'awaiting_decision',
          confidence: 0,
          library: null,
        },
      }),
    });
    const fallbackResult = evaluateAiClassificationEvaluation({
      fixture: buildFixture(),
      observation: buildClassifiedObservation({
        classification: { method: 'fallback' },
        history: { method: 'fallback' },
      }),
    });

    expect(clarificationResult.passed).toBe(true);
    expect(clarificationResult.matchedOutcomeIndex).toBe(1);
    expect(fallbackResult.passed).toBe(false);
    expect(fallbackResult.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'fallback_not_allowed', passed: false }),
    ]));
  });

  test('does not grade malformed fixture or observation input as an executable result', () => {
    const result = evaluateAiClassificationEvaluation({
      fixture: { id: 'missing-contract' },
      observation: { classification: {} },
    });

    expect(result.passed).toBe(false);
    expect(result.score).toEqual({
      passedCheckCount: 0,
      totalCheckCount: 2,
      percentage: 0,
    });
    expect(result.checks.map(check => check.id)).toEqual([
      'fixture_contract',
      'observation_contract',
    ]);
  });
});
