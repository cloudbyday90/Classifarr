/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This acceptance suite uses the isolated integration database and in-process
 * provider doubles. It does not read provider credentials or make outbound
 * provider or media-server requests.
 */

import { jest } from '@jest/globals';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { ClassificationPolicyPathService } = await import('../../services/classificationPolicyPathService.mjs');
const { ensureDecisionQuestion } = await import('../../services/classificationRoutingService.mjs');
const { ClassificationService } = await import('../../services/classificationServiceCore.mjs');
const {
  buildPendingRetryResult,
  isAiTransientAvailabilityError,
} = await import('../../services/classificationAiFailureUtils.mjs');
const { buildAiProviderAuthorityProfile } = await import('../../services/aiProviderAuthority.mjs');
const { buildAiProviderCapabilityMetricDelta } = await import('../../services/aiProviderCapabilityMetrics.mjs');

const libraries = [
  { id: 1, name: 'Movies', media_type: 'movie' },
  { id: 2, name: 'Series', media_type: 'tv' },
];

const metadata = {
  title: 'Provider Recovery Acceptance Fixture',
  tmdb_id: 101,
  media_type: 'movie',
};

function createRoutingService() {
  return new ClassificationService({
    createLogger: () => ({ debug: jest.fn() }),
    normalizePolicyDecisionThresholds: () => ({ autoClassifyThreshold: 85 }),
  });
}

function createPromptPolicyResult() {
  return {
    action: 'prompt',
    confidence: 92,
    ranked: [{
      library_id: 1,
      score: 92,
      auto_classify_threshold: 85,
      prompt_threshold: 65,
    }],
  };
}

function createPolicyPath({ aiClassify, policyResult = createPromptPolicyResult() }) {
  return new ClassificationPolicyPathService({
    policyEngine: {
      evaluateItem: jest.fn().mockResolvedValue(policyResult),
    },
    policyScoringContextBuilder: {
      buildSignalContext: jest.fn().mockReturnValue({
        confidence: 92,
        suggestedLibrary: libraries[0],
      }),
    },
    classificationAiService: { aiClassify },
    classificationProgressStageService: { updateStage: jest.fn() },
    classificationRagLoopService: {
      evaluateRagLoopSecondPass: jest.fn().mockImplementation(async ({ baselineResult }) => baselineResult),
    },
    classificationUtilsService: {
      buildPendingRetryResult,
      isAiTransientAvailabilityError,
    },
    classificationRoutingService: { ensureDecisionQuestion },
    ragRetriever: { getSuggestedLibrary: jest.fn() },
    logger: {
      debug: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
    },
  });
}

function routeDecision(result) {
  return createRoutingService().buildAutoRouteDecision({
    result,
    policyAutoThreshold: 85,
  });
}

describe('provider failure and recovery acceptance', () => {
  test('a deterministic policy-auto decision bypasses a disabled provider and remains routable', async () => {
    const aiClassify = jest.fn().mockRejectedValue(new Error('AI is not available - fixture provider disabled'));
    const policyPath = createPolicyPath({
      aiClassify,
      policyResult: {
        action: 'auto_classify',
        confidence: 99,
        library: { library_id: 1, library_name: 'Movies', policy_name: 'Movies Policy' },
      },
    });

    const outcome = await policyPath.execute({ metadata, libraries, relatedEvidence: [] });

    expect(aiClassify).not.toHaveBeenCalled();
    expect(outcome.result).toEqual(expect.objectContaining({
      method: 'policy_auto',
      policyResult: expect.objectContaining({ action: 'auto_classify' }),
    }));
    expect(routeDecision(outcome.result)).toEqual({ shouldRoute: true, reason: 'policy_auto' });
  });

  test.each([
    ['disabled', new Error('AI is not available - no provider configured')],
    ['transient', Object.assign(new Error('upstream unavailable'), { response: { status: 503 } })],
  ])('a %s provider failure produces a bounded retry without a candidate route', async (_label, error) => {
    const policyPath = createPolicyPath({
      aiClassify: jest.fn().mockRejectedValue(error),
    });

    const outcome = await policyPath.execute({ metadata, libraries, relatedEvidence: [] });

    expect(outcome.result).toEqual(expect.objectContaining({
      library: null,
      method: 'queued_for_retry',
      needs_retry: true,
      provider_recovery: {
        version: 'provider_recovery.v1',
        mode: 'retry_queued',
      },
    }));
    expect(routeDecision(outcome.result)).toEqual({ shouldRoute: false, reason: 'no_library' });
    expect(JSON.stringify(outcome.result)).not.toContain(error.message);
  });

  test('a permanent provider failure preserves policy evidence but requires review before routing', async () => {
    const providerFailure = new Error('provider authorization rejected key=fixture-secret');
    const policyPath = createPolicyPath({
      aiClassify: jest.fn().mockRejectedValue(providerFailure),
    });

    const outcome = await policyPath.execute({ metadata, libraries, relatedEvidence: [] });

    expect(outcome.result).toEqual(expect.objectContaining({
      library: libraries[0],
      confidence: 92,
      method: 'signal_calculation',
      needs_clarification: true,
      policyResult: expect.objectContaining({ ranked: expect.any(Array) }),
      provider_recovery: {
        version: 'provider_recovery.v1',
        mode: 'review_required',
      },
    }));
    expect(routeDecision(outcome.result)).toEqual({
      shouldRoute: false,
      reason: 'not_final',
    });
    expect(JSON.stringify(outcome.result)).not.toContain('fixture-secret');
  });

  test('a malformed provider response remains an advisory question and cannot route', async () => {
    const policyPath = createPolicyPath({
      aiClassify: jest.fn().mockResolvedValue({
        library: libraries[0],
        confidence: 92,
        format: 'contract_violation',
        needs_clarification: true,
        policy_question: {
          problem_summary: 'Provider response needs review',
          question: 'Does this item need a manual destination decision?',
          options: [],
        },
        ai_authority: {
          sideEffects: { canRoute: false },
        },
      }),
    });

    const outcome = await policyPath.execute({ metadata, libraries, relatedEvidence: [] });

    expect(outcome.result).toEqual(expect.objectContaining({
      method: 'ai_analysis',
      needs_clarification: true,
      policyResult: expect.objectContaining({ ranked: expect.any(Array) }),
    }));
    expect(routeDecision(outcome.result)).toEqual({ shouldRoute: false, reason: 'not_final' });
  });

  test('aggregate capability telemetry contains fixed counters, not a provider exception', () => {
    const delta = buildAiProviderCapabilityMetricDelta({
      authority: buildAiProviderAuthorityProfile({ providerId: 'openai', model: 'gpt-4.1' }),
      generationError: new Error('provider authorization rejected key=fixture-secret'),
    });

    expect(delta).toEqual(expect.objectContaining({
      requestCount: 1,
      providerId: 'openai',
    }));
    expect(JSON.stringify(delta)).not.toContain('fixture-secret');
  });
});
