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
  AI_CLASSIFICATION_EVALUATION_RISK_IDS,
  validateAiClassificationEvaluationFixture,
} from '../../services/aiClassificationEvaluationFixtureContract.mjs';
import {
  validateAiClassificationEvaluationObservation,
} from '../../services/aiClassificationEvaluationObservationContract.mjs';

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

describe('aiClassificationEvaluationFixtureContract', () => {
  test('accepts a bounded, versioned fixture with explicit scoring alternatives', () => {
    expect(validateAiClassificationEvaluationFixture(buildFixture())).toEqual({
      ok: true,
      issues: [],
    });
  });

  test('fails closed on injected fields and invalid classified constraints', () => {
    const fixture = buildFixture();
    fixture.operatorNote = '<script>untrusted</script>';
    fixture.expected.outcomes[0].confidence.minimum = 101;
    fixture.expected.outcomes[1].library = { name: 'Movies' };

    const validation = validateAiClassificationEvaluationFixture(fixture);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: AI_CLASSIFICATION_EVALUATION_RISK_IDS.UNKNOWN_FIELD,
        path: 'fixture.operatorNote',
      }),
      expect.objectContaining({
        riskId: AI_CLASSIFICATION_EVALUATION_RISK_IDS.INVALID_CONFIDENCE_RANGE,
        path: 'expected.outcomes[0].confidence',
      }),
      expect.objectContaining({
        riskId: AI_CLASSIFICATION_EVALUATION_RISK_IDS.OUTCOME_CONSTRAINT_MISMATCH,
        path: 'expected.outcomes[1].library',
      }),
    ]));
  });

  test('requires a bounded observation with no raw provider-response fields', () => {
    const observation = {
      classification: {
        method: 'ai',
        confidence: 91,
        library: { id: 7, name: 'Movies' },
        needsClarification: false,
        needsRetry: false,
        rawProviderResponse: '{"secret":"do not retain"}',
      },
      history: {
        method: 'ai',
        status: 'completed',
        confidence: 91,
        library: { id: 7, name: 'Movies' },
      },
    };

    const validation = validateAiClassificationEvaluationObservation(observation);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: AI_CLASSIFICATION_EVALUATION_RISK_IDS.UNKNOWN_FIELD,
        path: 'observation.classification.rawProviderResponse',
      }),
    ]));
  });

  test('permits an intentionally unobserved confidence for a non-final queued decision', () => {
    const observation = {
      classification: {
        method: 'ai_analysis',
        confidence: null,
        library: null,
        needsClarification: true,
        needsRetry: false,
      },
      history: {
        method: 'ai_analysis',
        status: 'awaiting_decision',
        confidence: 62.13,
        library: null,
      },
    };

    expect(validateAiClassificationEvaluationObservation(observation)).toEqual({
      ok: true,
      issues: [],
    });
  });
});
