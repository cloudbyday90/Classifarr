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
import {
  buildPolicyRuntimeQueueQuestionReductionProducer,
} from '../services/policyRuntimeQueueQuestionReductionProducer.mjs';

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

function buildValidQueueQuestionReduction() {
  const result = buildPolicyRuntimeQueueQuestionReductionProducer({
    task: {
      id: 'queue-task-42',
      task_type: 'classification',
      attempts: 1,
    },
    runtimeEvidenceInput: {
      libraryProfile: {
        identityCandidates: [{ label: 'Animated Movies', count: 12, trusted: true }],
      },
      operatorIntent: {
        belongsHere: [{ key: 'purpose:genres:1', label: 'genres declared purpose' }],
      },
      profileFreshness: {
        key: 'library_profile',
        label: 'Library profile',
        stale: false,
        updatedAt: '2026-07-25T12:00:00.000Z',
      },
    },
    routing: {
      mapped: true,
      configured: true,
      targetId: 'radarr:4',
      arrConfigId: '4',
    },
    classification: { completed: true, status: 'completed' },
    policyEvaluation: {
      hardLimitsSatisfied: true,
      avoidRulesSatisfied: true,
      highRiskConflicts: [],
    },
  });

  expect(result.audit.ok).toBe(true);
  return result.queueQuestionReduction;
}

function createService({ handoff, admission } = {}) {
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
    policyRuntimeQuestionPersistenceAdmissionService: admission,
  });

  service.runDecisionTree = jest.fn().mockResolvedValue({
    library: { id: 6, name: 'Animated Movies' },
    confidence: 95,
    method: 'policy_auto',
    reason: 'Server-owned policy result',
    policyResult: {
      action: 'auto_classify',
      library: { library_id: 6, library_name: 'Animated Movies' },
    },
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

  test('emits queue-bound proof and suppresses the direct terminal proof for queue classification', async () => {
    const runtimeQuestionReductionPlan = buildValidRuntimeQuestionReductionPlan();
    const runtimeQueueQuestionReduction = buildValidQueueQuestionReduction();
    const handoff = {
      build: jest.fn().mockResolvedValue({
        plan: runtimeQuestionReductionPlan,
        queueQuestionReduction: runtimeQueueQuestionReduction,
      }),
    };
    const service = createService({ handoff });
    const task = { id: 'queue-task-42', task_type: 'classification', attempts: 1 };

    const result = await service.classifyQueueTask(task, { media: { tmdbId: 10674 } });

    expect(handoff.build).toHaveBeenCalledWith({
      classificationResult: expect.objectContaining({
        library: { id: 6, name: 'Animated Movies' },
      }),
      queueTask: task,
    });
    expect(result.runtimeQuestionReductionPlan).toBeNull();
    expect(result.runtimeQueueQuestionReduction).toEqual(runtimeQueueQuestionReduction);
    expect(JSON.stringify(result)).not.toContain('queue-task-42');
  });

  test('persists an admitted native question through the existing pending path and skips routing', async () => {
    const runtimeQuestionReductionPlan = buildValidRuntimeQuestionReductionPlan();
    const persistedQuestion = {
      version: 'policy.runtime_question_persistence.v1',
      question: 'Should this item be resolved here?',
      options: [{ label: 'Resolve current item', library_id: 6 }],
      runtimeQuestion: runtimeQuestionReductionPlan.question,
      runtimeQuestionReductionPlan,
    };
    const admission = {
      admit: jest.fn().mockReturnValue({
        ok: true,
        statusId: 'admitted',
        reasonId: 'hard_limit_review_required',
        classificationPatch: {
          needs_clarification: true,
          clarification: persistedQuestion,
          policy_question: persistedQuestion,
          pending_reason: 'Classifarr needs an operator decision.',
        },
        audit: { ok: true },
      }),
    };
    const handoff = {
      build: jest.fn().mockResolvedValue({ plan: runtimeQuestionReductionPlan }),
    };
    const service = createService({ handoff, admission });

    const result = await service.classify({ media: { tmdbId: 10674 } });

    expect(admission.admit).toHaveBeenCalledWith({
      classificationResult: expect.objectContaining({
        library: { id: 6, name: 'Animated Movies' },
      }),
      handoff: expect.objectContaining({ plan: runtimeQuestionReductionPlan }),
    });
    expect(service.classificationPersistenceService.logClassification).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        needs_clarification: true,
        policy_question: persistedQuestion,
      }),
      expect.any(Number),
    );
    expect(service.classificationRoutingService.routeToArr).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({
      runtimeQuestionPersistence: {
        statusId: 'admitted',
        reasonId: 'hard_limit_review_required',
      },
      routingOutcome: expect.objectContaining({
        reason: 'not_final',
      }),
    }));
  });
});
