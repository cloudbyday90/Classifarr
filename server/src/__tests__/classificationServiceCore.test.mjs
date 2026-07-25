/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';
import {
  createClassificationService,
} from '../services/classificationServiceCore.mjs';
import {
  buildPolicyAutomationDecisionFromEvidenceProjection,
} from '../services/policyAutomationDecisionContract.mjs';
import {
  buildPolicyRuntimeQuestionReductionFromAutomationDecision,
  validatePolicyRuntimeQuestionReduction,
} from '../services/policyRuntimeQuestionReduction.mjs';
import {
  buildPolicyRuntimeEvidenceProjection,
} from '../services/policyRuntimeEvidenceProjection.mjs';

function buildValidRuntimeQuestionReductionPlan() {
  const automationDecision = buildPolicyAutomationDecisionFromEvidenceProjection({
    evidenceProjection: buildPolicyRuntimeEvidenceProjection({
      libraryProfile: {
        identityCandidates: [{
          label: 'Animated Movies',
          count: 12,
          confidence: 0.92,
          trusted: true,
        }],
      },
      operatorIntent: {
        routingTargets: ['Radarr Animated Movies'],
      },
      routingOutcomes: [{ label: 'Radarr route mapped', routed: true }],
      profileFreshness: {
        stale: false,
        updatedAt: '2026-07-25T12:00:00.000Z',
      },
    }),
    routing: {
      mapped: true,
      targetName: 'Radarr Animated Movies',
    },
  });
  const plan = buildPolicyRuntimeQuestionReductionFromAutomationDecision({
    automationDecision,
  });

  expect(validatePolicyRuntimeQuestionReduction(plan).ok).toBe(true);
  return plan;
}

function createService({ handoff } = {}) {
  const logger = {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  };
  const service = createClassificationService({
    db: { query: jest.fn().mockResolvedValue({ rows: [] }) },
    tmdbService: {},
    discordBot: { isInitialized: false },
    contentTypeAnalyzer: {},
    clarificationService: {
      isRequireAllConfirmationsEnabled: jest.fn().mockResolvedValue(false),
    },
    classificationProgressStageService: {},
    classificationRetryService: {},
    classificationEvidenceReinforcementService: {},
    classificationEvidenceService: {},
    classificationMetadataService: {
      parseOverseerrPayload: jest.fn().mockReturnValue({
        media_type: 'movie',
        tmdbId: 10674,
        title: 'Mulan',
        year: 1998,
        existingMetadata: {
          overview: 'A guarded test fixture.',
          genres: ['Animation'],
        },
        taskId: null,
      }),
    },
    classificationUtilsService: {},
    classificationRoutingService: {
      routeToArr: jest.fn().mockResolvedValue({
        attempted: true,
        routed: true,
        reason: 'routed',
      }),
    },
    libraryRulesService: {},
    libraryLabelsService: {},
    classificationLearnedCorrectionsService: {},
    classificationAiService: {},
    classificationPersistenceService: {
      logClassification: jest.fn().mockResolvedValue(94),
      persistRagLoopStageEvents: jest.fn().mockResolvedValue(),
      rebindRetryLineage: jest.fn().mockResolvedValue(),
    },
    classificationRagLoopService: {},
    classificationAuthoritativeSignalService: {},
    createLogger: jest.fn().mockReturnValue(logger),
    normalizePolicyDecisionThresholds: jest.fn().mockReturnValue({ autoClassifyThreshold: 85 }),
    idleDetector: { recordActivity: jest.fn() },
    classificationPolicyPathService: {},
    classificationLegacySignalPathService: {},
    policyNativeClassificationQuestionHandoffService: handoff || {
      build: jest.fn().mockResolvedValue({ plan: null }),
    },
  });

  service.runDecisionTree = jest.fn().mockResolvedValue({
    library: { id: 6, name: 'Animated Movies' },
    confidence: 95,
    method: 'policy_auto',
    reason: 'Server-owned policy result',
  });

  return service;
}

describe('classificationServiceCore native question-reduction handoff', () => {
  test('returns a validated runtime plan without changing the routing decision path', async () => {
    const runtimeQuestionReductionPlan = buildValidRuntimeQuestionReductionPlan();
    const handoff = {
      build: jest.fn().mockResolvedValue({ plan: runtimeQuestionReductionPlan }),
    };
    const service = createService({ handoff });

    const result = await service.classify({ media: { tmdbId: 10674 } });

    expect(handoff.build).toHaveBeenCalledWith({
      classificationResult: expect.objectContaining({
        library: { id: 6, name: 'Animated Movies' },
        method: 'policy_auto',
      }),
    });
    expect(service.classificationRoutingService.routeToArr).toHaveBeenCalledTimes(1);
    expect(result).toEqual(expect.objectContaining({
      classification_id: 94,
      destination: {
        libraryId: 6,
        libraryName: 'Animated Movies',
      },
      runtimeQuestionReductionPlan,
      routingOutcome: expect.objectContaining({
        routeResult: expect.objectContaining({
          routed: true,
        }),
      }),
    }));
  });

  test('keeps a successful classification operational when the supplemental handoff fails', async () => {
    const handoff = {
      build: jest.fn().mockRejectedValue(new Error('handoff unavailable')),
    };
    const service = createService({ handoff });

    const result = await service.classify({ media: { tmdbId: 10674 } });

    expect(result.success).toBe(true);
    expect(result.runtimeQuestionReductionPlan).toBeNull();
    expect(service.classificationRoutingService.routeToArr).toHaveBeenCalledTimes(1);
  });

  test('suppresses an invalid supplemental plan without changing classification or routing', async () => {
    const handoff = {
      build: jest.fn().mockResolvedValue({
        plan: { version: 'policy.runtime_question_reduction.v1' },
      }),
    };
    const service = createService({ handoff });

    const result = await service.classify({ media: { tmdbId: 10674 } });

    expect(result.success).toBe(true);
    expect(result.runtimeQuestionReductionPlan).toBeNull();
    expect(service.classificationRoutingService.routeToArr).toHaveBeenCalledTimes(1);
  });
});
