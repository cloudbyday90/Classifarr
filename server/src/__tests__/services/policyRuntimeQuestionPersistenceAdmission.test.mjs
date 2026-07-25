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

import { jest } from '@jest/globals';
import {
  POLICY_NATIVE_INTENT_RUNTIME_STATUS_IDS,
} from '../../services/policyNativeIntentRuntimeEvaluator.mjs';
import {
  buildPolicyNativeClassificationQuestionHandoff,
} from '../../services/policyNativeClassificationQuestionHandoff.mjs';
import {
  POLICY_RUNTIME_QUESTION_PERSISTENCE_ADMISSION_STATUS_IDS,
  POLICY_RUNTIME_QUESTION_PERSISTENCE_REASON_IDS,
  buildPolicyRuntimeQuestionPersistenceAdmission,
  buildPolicyRuntimeQuestionPersistenceAdmissionAudit,
  isPolicyRuntimeQuestionPersistenceEnvelope,
} from '../../services/policyRuntimeQuestionPersistenceAdmission.mjs';

function currentProfileHandoff(overrides = {}) {
  return {
    ok: true,
    profileEvidence: {
      libraryProfile: {
        identityCandidates: [],
        compatibilityCandidates: [{
          key: 'genre:animation',
          label: 'Animation',
          count: 12,
          confidence: 0.9,
        }],
        outliers: [],
      },
    },
    profileFreshness: {
      key: 'library_profile',
      label: 'Library profile',
      value: 'current',
      stale: false,
      updatedAt: '2026-07-25T12:00:00.000Z',
    },
    ...overrides,
  };
}

function nativeRuntime(overrides = {}) {
  const { contract: contractOverrides = {}, ...runtimeOverrides } = overrides;

  return {
    statusId: POLICY_NATIVE_INTENT_RUNTIME_STATUS_IDS.HARD_LIMIT_FAILED,
    avoidPenalty: 0,
    contract: {
      source: 'native_intent',
      validation: { valid: true },
      purpose: [{ signal_type: 'genres', values: { require_any: ['Animation'] } }],
      helpful_hints: [],
      hard_limits: [{ signal_type: 'certifications', values: { max: 'PG-13' } }],
      avoid: [],
      ...contractOverrides,
    },
    ...runtimeOverrides,
  };
}

function classificationResult(overrides = {}) {
  const runtime = overrides.runtime || nativeRuntime();

  return {
    library: {
      id: 6,
      name: 'Animated Movies',
    },
    confidence: 96,
    method: 'policy_auto',
    policyResult: {
      ranked: [{
        library_id: 6,
        library_name: 'Animated Movies',
        native_intent_runtime: runtime,
      }],
    },
    ...overrides,
  };
}

async function buildReviewHandoff(overrides = {}) {
  return buildPolicyNativeClassificationQuestionHandoff({
    classificationResult: classificationResult(overrides),
    loadProfileEvidence: jest.fn().mockResolvedValue(currentProfileHandoff()),
    resolveStoredRoutingConfig: jest.fn().mockResolvedValue({
      id: 6,
      arr_type: 'radarr',
      arr_id: 3,
      root_folder: '/media/animated',
    }),
  });
}

describe('policyRuntimeQuestionPersistenceAdmission', () => {
  test('admits a canonical native review plan into the existing pending-question shape', async () => {
    const sourceResult = classificationResult({
      title: 'Untrusted request title',
      providerPayload: { raw: 'must not persist' },
    });
    const handoff = await buildReviewHandoff({
      title: 'Untrusted request title',
      providerPayload: { raw: 'must not persist' },
    });

    const result = buildPolicyRuntimeQuestionPersistenceAdmission({
      classificationResult: sourceResult,
      handoff,
    });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      statusId: POLICY_RUNTIME_QUESTION_PERSISTENCE_ADMISSION_STATUS_IDS.ADMITTED,
      classificationPatch: expect.objectContaining({
        needs_clarification: true,
        pending_reason: expect.any(String),
      }),
      sideEffects: expect.objectContaining({
        classificationPersisted: false,
        questionPersisted: false,
        routingExecuted: false,
        learningWritten: false,
      }),
      audit: { ok: true, issueCount: 0, issues: [] },
    }));
    expect(isPolicyRuntimeQuestionPersistenceEnvelope(result.persistedQuestion)).toBe(true);
    expect(result.classificationPatch.policy_question).toBe(result.persistedQuestion);
    expect(result.persistedQuestion.options).toEqual([
      expect.objectContaining({
        outcomeId: 'resolve_current_item',
        library_id: 6,
        library_name: 'Animated Movies',
        learningEligible: false,
      }),
      expect.objectContaining({
        outcomeId: 'do_not_learn',
        learningEligible: false,
      }),
    ]);
    expect(result.persistedQuestion.options[1]).not.toHaveProperty('library_id');
    expect(result.persistedQuestion.meta.runtime_question_persistence).toEqual(
      expect.objectContaining({
        destinationLibraryId: 6,
        destinationLibraryName: 'Animated Movies',
        evidenceFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    expect(JSON.stringify(result)).not.toContain('Untrusted request title');
    expect(JSON.stringify(result)).not.toContain('must not persist');
    expect(JSON.stringify(result)).not.toContain('/media/animated');
  });

  test('preserves a pre-existing legacy question rather than replacing it', async () => {
    const result = buildPolicyRuntimeQuestionPersistenceAdmission({
      classificationResult: classificationResult({
        policy_question: {
          question: 'Legacy question',
          options: [{ label: 'Existing destination', library_id: 6 }],
        },
      }),
      handoff: await buildReviewHandoff(),
    });

    expect(result).toMatchObject({
      ok: false,
      statusId: POLICY_RUNTIME_QUESTION_PERSISTENCE_ADMISSION_STATUS_IDS
        .PRESERVED_EXISTING_QUESTION,
      reasonId: POLICY_RUNTIME_QUESTION_PERSISTENCE_REASON_IDS.EXISTING_QUESTION_PRESERVED,
      classificationPatch: null,
      audit: { ok: true },
    });
  });

  test('rejects a handoff that reports a prohibited side effect', async () => {
    const handoff = await buildReviewHandoff();
    const result = buildPolicyRuntimeQuestionPersistenceAdmission({
      classificationResult: classificationResult(),
      handoff: {
        ...handoff,
        sideEffects: {
          ...handoff.sideEffects,
          questionCreated: true,
        },
      },
    });

    expect(result).toMatchObject({
      ok: false,
      statusId: POLICY_RUNTIME_QUESTION_PERSISTENCE_ADMISSION_STATUS_IDS.REJECTED,
      reasonId: POLICY_RUNTIME_QUESTION_PERSISTENCE_REASON_IDS
        .HANDOFF_SIDE_EFFECT_REPORTED,
      classificationPatch: null,
      audit: { ok: true },
    });
  });

  test('re-audits a handoff instead of trusting a stale audit result', async () => {
    const handoff = await buildReviewHandoff();
    const result = buildPolicyRuntimeQuestionPersistenceAdmission({
      classificationResult: classificationResult(),
      handoff: {
        ...handoff,
        summary: {
          ...handoff.summary,
          title: 'Untrusted substituted title',
        },
      },
    });

    expect(handoff.audit.ok).toBe(true);
    expect(result).toMatchObject({
      ok: false,
      statusId: POLICY_RUNTIME_QUESTION_PERSISTENCE_ADMISSION_STATUS_IDS.REJECTED,
      reasonId: POLICY_RUNTIME_QUESTION_PERSISTENCE_REASON_IDS.HANDOFF_AUDIT_FAILED,
      classificationPatch: null,
      audit: { ok: true },
    });
  });

  test('does not materialize a question when native automation is already safe to route', async () => {
    const handoff = await buildPolicyNativeClassificationQuestionHandoff({
      classificationResult: classificationResult({
        runtime: nativeRuntime({
          statusId: POLICY_NATIVE_INTENT_RUNTIME_STATUS_IDS.ACTIVE,
        }),
      }),
      loadProfileEvidence: jest.fn().mockResolvedValue(currentProfileHandoff()),
      resolveStoredRoutingConfig: jest.fn().mockResolvedValue({
        id: 6,
        arr_type: 'radarr',
        arr_id: 3,
        root_folder: '/media/animated',
      }),
    });
    const result = buildPolicyRuntimeQuestionPersistenceAdmission({
      classificationResult: classificationResult({
        runtime: nativeRuntime({
          statusId: POLICY_NATIVE_INTENT_RUNTIME_STATUS_IDS.ACTIVE,
        }),
      }),
      handoff,
    });

    expect(result).toMatchObject({
      ok: false,
      statusId: POLICY_RUNTIME_QUESTION_PERSISTENCE_ADMISSION_STATUS_IDS.NOT_APPLICABLE,
      reasonId: POLICY_RUNTIME_QUESTION_PERSISTENCE_REASON_IDS.NO_QUESTION_REQUESTED,
      audit: { ok: true },
    });
  });

  test('audit rejects an admitted result that reports a persistence side effect', async () => {
    const admission = buildPolicyRuntimeQuestionPersistenceAdmission({
      classificationResult: classificationResult(),
      handoff: await buildReviewHandoff(),
    });
    const audit = buildPolicyRuntimeQuestionPersistenceAdmissionAudit({
      ...admission,
      sideEffects: {
        ...admission.sideEffects,
        questionPersisted: true,
      },
    });

    expect(audit).toEqual(expect.objectContaining({
      ok: false,
      issues: expect.arrayContaining(['side_effect_reported']),
    }));
  });
});
