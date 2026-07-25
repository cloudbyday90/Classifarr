/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';
import {
  POLICY_NATIVE_INTENT_RUNTIME_STATUS_IDS,
} from '../../services/policyNativeIntentRuntimeEvaluator.mjs';
import {
  POLICY_NATIVE_CLASSIFICATION_QUESTION_HANDOFF_STATUS_IDS,
  buildPolicyNativeClassificationQuestionHandoff,
  buildPolicyNativeClassificationQuestionHandoffAudit,
} from '../../services/policyNativeClassificationQuestionHandoff.mjs';
import {
  POLICY_AUTOMATION_DECISION_STATE_IDS,
} from '../../services/policyAutomationDecisionContract.mjs';
import {
  POLICY_RUNTIME_QUESTION_DISPOSITION_IDS,
} from '../../services/policyRuntimeQuestionReduction.mjs';

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

function nativeRuntime(statusId = POLICY_NATIVE_INTENT_RUNTIME_STATUS_IDS.ACTIVE, overrides = {}) {
  const { contract: contractOverrides = {}, ...runtimeOverrides } = overrides;

  return {
    statusId,
    avoidPenalty: 0,
    contract: {
      source: 'native_intent',
      validation: { valid: true },
      purpose: [{ signal_type: 'genres', values: { require_any: ['Animation'] } }],
      helpful_hints: [{ signal_type: 'studios', values: { prefer: ['Studio Ghibli'] } }],
      hard_limits: [{ signal_type: 'certifications', values: { max: 'PG-13' } }],
      avoid: [{ signal_type: 'genres', values: { exclude: ['Horror'] } }],
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

function mappedLibrary(overrides = {}) {
  return {
    id: 6,
    arr_type: 'radarr',
    arr_id: 3,
    root_folder: '/media/animated',
    ...overrides,
  };
}

describe('policyNativeClassificationQuestionHandoff', () => {
  test('builds a valid native decision-to-question plan from stored authority only', async () => {
    const loadProfileEvidence = jest.fn().mockResolvedValue(currentProfileHandoff());
    const resolveStoredRoutingConfig = jest.fn().mockResolvedValue(mappedLibrary());
    const result = await buildPolicyNativeClassificationQuestionHandoff({
      classificationResult: classificationResult({
        title: 'Untrusted request title',
        providerPayload: { raw: 'must not be used' },
      }),
      loadProfileEvidence,
      resolveStoredRoutingConfig,
    });

    expect(loadProfileEvidence).toHaveBeenCalledWith({ libraryId: 6 });
    expect(resolveStoredRoutingConfig).toHaveBeenCalledWith({
      id: 6,
      name: 'Animated Movies',
    });
    expect(result).toEqual(expect.objectContaining({
      ok: true,
      statusId: POLICY_NATIVE_CLASSIFICATION_QUESTION_HANDOFF_STATUS_IDS.READY,
      plan: expect.objectContaining({
        version: 'policy.runtime_question_reduction.v1',
        dispositionId: POLICY_RUNTIME_QUESTION_DISPOSITION_IDS.SUPPRESS_QUESTION,
        createQuestion: false,
        decision: expect.objectContaining({
          stateId: POLICY_AUTOMATION_DECISION_STATE_IDS.AUTO_ROUTE_READY,
          routeMapped: true,
          strongIdentity: true,
        }),
      }),
      sideEffects: expect.objectContaining({
        storedProfileRead: true,
        storedRoutingConfigRead: true,
        liveMediaServerLookupPerformed: false,
        liveProviderLookupPerformed: false,
        routingExecuted: false,
        learningWritten: false,
      }),
    }));
    expect(result.summary.evidenceFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(result.audit.ok).toBe(true);
    expect(buildPolicyNativeClassificationQuestionHandoffAudit(result).ok).toBe(true);
    expect(JSON.stringify(result)).not.toContain('Untrusted request title');
    expect(JSON.stringify(result)).not.toContain('Studio Ghibli');
    expect(JSON.stringify(result)).not.toContain('/media/animated');
  });

  test('fails closed to a profile-refresh plan when stored profile evidence is unavailable', async () => {
    const result = await buildPolicyNativeClassificationQuestionHandoff({
      classificationResult: classificationResult(),
      loadProfileEvidence: jest.fn().mockResolvedValue({ ok: false, statusId: 'profile_not_found' }),
      resolveStoredRoutingConfig: jest.fn().mockResolvedValue(mappedLibrary()),
    });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      statusId: POLICY_NATIVE_CLASSIFICATION_QUESTION_HANDOFF_STATUS_IDS.PROFILE_UNAVAILABLE,
      plan: expect.objectContaining({
        dispositionId: POLICY_RUNTIME_QUESTION_DISPOSITION_IDS.REFRESH_PROFILE,
        createQuestion: false,
        decision: expect.objectContaining({
          stateId: POLICY_AUTOMATION_DECISION_STATE_IDS.STALE_PROFILE_RETRY,
        }),
      }),
    }));
    expect(result.audit.ok).toBe(true);
  });

  test('creates a bounded hard-limit review plan without changing classification or routing', async () => {
    const result = await buildPolicyNativeClassificationQuestionHandoff({
      classificationResult: classificationResult({
        runtime: nativeRuntime(POLICY_NATIVE_INTENT_RUNTIME_STATUS_IDS.HARD_LIMIT_FAILED),
      }),
      loadProfileEvidence: jest.fn().mockResolvedValue(currentProfileHandoff()),
      resolveStoredRoutingConfig: jest.fn().mockResolvedValue(mappedLibrary()),
    });

    expect(result.plan).toEqual(expect.objectContaining({
      dispositionId: POLICY_RUNTIME_QUESTION_DISPOSITION_IDS.CREATE_OPERATOR_QUESTION,
      createQuestion: true,
      decision: expect.objectContaining({
        stateId: POLICY_AUTOMATION_DECISION_STATE_IDS.BLOCKED_BY_HARD_LIMIT,
        routeAllowed: false,
      }),
      learning: expect.objectContaining({
        eligible: false,
      }),
    }));
    expect(result.sideEffects).toEqual(expect.objectContaining({
      classificationWritten: false,
      routingExecuted: false,
      questionCreated: false,
      learningWritten: false,
    }));
    expect(result.audit.ok).toBe(true);
  });

  test('turns an authoritative native policy missing purpose into a review plan', async () => {
    const result = await buildPolicyNativeClassificationQuestionHandoff({
      classificationResult: classificationResult({
        runtime: nativeRuntime(POLICY_NATIVE_INTENT_RUNTIME_STATUS_IDS.NO_PURPOSE, {
          contract: { purpose: [] },
        }),
      }),
      loadProfileEvidence: jest.fn().mockResolvedValue(currentProfileHandoff()),
      resolveStoredRoutingConfig: jest.fn().mockResolvedValue(mappedLibrary()),
    });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      statusId: POLICY_NATIVE_CLASSIFICATION_QUESTION_HANDOFF_STATUS_IDS.READY,
      plan: expect.objectContaining({
        dispositionId: POLICY_RUNTIME_QUESTION_DISPOSITION_IDS.CREATE_OPERATOR_QUESTION,
        createQuestion: true,
        decision: expect.objectContaining({
          stateId: POLICY_AUTOMATION_DECISION_STATE_IDS.NEEDS_OPERATOR_REVIEW,
          routeAllowed: false,
        }),
      }),
    }));
    expect(result.audit.ok).toBe(true);
  });

  test('does not suppress review while the selected classification is still pending', async () => {
    const result = await buildPolicyNativeClassificationQuestionHandoff({
      classificationResult: classificationResult({ needs_clarification: true }),
      loadProfileEvidence: jest.fn().mockResolvedValue(currentProfileHandoff()),
      resolveStoredRoutingConfig: jest.fn().mockResolvedValue(mappedLibrary()),
    });

    expect(result.plan).toEqual(expect.objectContaining({
      dispositionId: POLICY_RUNTIME_QUESTION_DISPOSITION_IDS.CREATE_OPERATOR_QUESTION,
      createQuestion: true,
      decision: expect.objectContaining({
        stateId: POLICY_AUTOMATION_DECISION_STATE_IDS.NEEDS_OPERATOR_REVIEW,
        routeAllowed: false,
        classificationComplete: false,
      }),
    }));
    expect(result.audit.ok).toBe(true);
  });

  test('does not manufacture a plan for a legacy or untrusted classifier result', async () => {
    const loadProfileEvidence = jest.fn();
    const resolveStoredRoutingConfig = jest.fn();
    const result = await buildPolicyNativeClassificationQuestionHandoff({
      classificationResult: classificationResult({
        method: 'ai_analysis',
        policyResult: { ranked: [] },
      }),
      loadProfileEvidence,
      resolveStoredRoutingConfig,
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_NATIVE_CLASSIFICATION_QUESTION_HANDOFF_STATUS_IDS.NATIVE_INTENT_UNAVAILABLE,
      plan: null,
    }));
    expect(loadProfileEvidence).not.toHaveBeenCalled();
    expect(resolveStoredRoutingConfig).not.toHaveBeenCalled();
    expect(result.audit.ok).toBe(true);
  });

  test('does not reuse a native runtime candidate from a different selected destination', async () => {
    const result = await buildPolicyNativeClassificationQuestionHandoff({
      classificationResult: classificationResult({
        library: { id: 7, name: 'Movies' },
      }),
      loadProfileEvidence: jest.fn(),
      resolveStoredRoutingConfig: jest.fn(),
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_NATIVE_CLASSIFICATION_QUESTION_HANDOFF_STATUS_IDS.NATIVE_INTENT_UNAVAILABLE,
      plan: null,
    }));
  });

  test('does not manufacture a plan when no selected library exists', async () => {
    const result = await buildPolicyNativeClassificationQuestionHandoff({
      classificationResult: { method: 'manual' },
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_NATIVE_CLASSIFICATION_QUESTION_HANDOFF_STATUS_IDS.NO_SELECTED_LIBRARY,
      plan: null,
    }));
    expect(result.audit.ok).toBe(true);
  });
});
