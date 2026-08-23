/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This integration suite runs only through
 * scripts/run-ai-provider-fault-compose-integration.mjs. It uses an isolated
 * Testcontainers database and a fixed Docker Compose provider stub. No normal
 * Classifarr Compose project, media server, credential, or production provider
 * is reachable from this test.
 */

import { jest } from '@jest/globals';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const { AIRouterService } = await import('../../services/aiRouter.mjs');
const { ClassificationPolicyPathService } = await import('../../services/classificationPolicyPathService.mjs');
const { ClassificationService } = await import('../../services/classificationServiceCore.mjs');
const {
  buildPendingRetryResult,
  isAiTransientAvailabilityError,
} = await import('../../services/classificationAiFailureUtils.mjs');
const { ollamaService } = await import('../../services/ollama.mjs');
const { QueueService } = await import('../../services/queueService.mjs');

const runComposeFaultSuite = process.env.CLASSIFARR_AI_PROVIDER_FAULT_COMPOSE === '1';
const suite = runComposeFaultSuite ? describe : describe.skip;

const libraries = [
  { id: 101, media_type: 'movie', name: 'Disposable Movies' },
  { id: 102, media_type: 'tv', name: 'Disposable Series' },
];

function createLogger() {
  return {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  };
}

function parseStubEndpoint() {
  const endpoint = new URL(process.env.CLASSIFARR_AI_PROVIDER_FAULT_STUB_BASE_URL || '');
  if (endpoint.protocol !== 'http:' || endpoint.hostname !== '127.0.0.1' || !endpoint.port) {
    throw new Error('The provider fault integration requires a loopback stub endpoint');
  }
  return {
    baseUrl: endpoint.origin,
    host: endpoint.hostname,
    port: Number.parseInt(endpoint.port, 10),
  };
}

function createPolicyPath({ aiRouterService, logger }) {
  return new ClassificationPolicyPathService({
    policyEngine: {
      evaluateItem: jest.fn().mockResolvedValue({
        action: 'prompt_confirm',
        confidence: 92,
        ranked: [{
          auto_classify_threshold: 85,
          library_id: 101,
          prompt_threshold: 65,
          score: 92,
        }],
      }),
    },
    policyScoringContextBuilder: {
      buildSignalContext: jest.fn().mockReturnValue({
        confidence: 92,
        suggestedLibrary: libraries[0],
      }),
    },
    classificationAiService: {
      aiClassify: async () => aiRouterService.classify('controlled provider-fault probe'),
    },
    classificationProgressStageService: { updateStage: jest.fn() },
    classificationRagLoopService: {
      evaluateRagLoopSecondPass: jest.fn().mockImplementation(async ({ baselineResult }) => baselineResult),
    },
    classificationUtilsService: {
      buildPendingRetryResult,
      isAiTransientAvailabilityError,
    },
    classificationRoutingService: {
      ensureDecisionQuestion: jest.fn(async ({ result }) => result),
    },
    ragRetriever: { getSuggestedLibrary: jest.fn() },
    logger,
  });
}

async function waitForCompletedTask(taskId) {
  const deadline = Date.now() + 10_000;
  let lastTask = null;
  while (Date.now() < deadline) {
    const result = await db.query(
      'SELECT status, payload, error_message FROM task_queue WHERE id = $1',
      [taskId],
    );
    const task = result.rows[0];
    lastTask = task || lastTask;
    if (task?.status === 'completed') {
      return task;
    }
    await new Promise((resolveDelay) => {
      setTimeout(resolveDelay, 50);
    });
  }
  throw new Error(
    `Queue task ${taskId} did not complete within the bounded provider-fault test window `
    + `(status=${lastTask?.status || 'missing'}, reason=${lastTask?.error_message || 'none'})`,
  );
}

suite('Docker Compose provider fault integration', () => {
  beforeEach(() => {
    ollamaService.resetConfig();
  });

  afterEach(() => {
    ollamaService.resetConfig();
  });

  test('persists a real 503 provider result as queued_for_retry and never routes it', async () => {
    const { baseUrl, host, port } = parseStubEndpoint();
    const stubPreflightResponse = await fetch(`${baseUrl}/api/tags`);
    expect(stubPreflightResponse.ok).toBe(true);
    await db.query('DELETE FROM ollama_config');
    await db.query(
      `UPDATE ai_provider_config
       SET primary_provider = 'ollama',
           ollama_host = $1,
           ollama_port = $2,
           ollama_model = 'classifarr-fault-model'
       WHERE id = 1`,
      [host, port],
    );

    const logger = createLogger();
    const aiRouterService = new AIRouterService({ ollamaClient: ollamaService });
    const policyPath = createPolicyPath({ aiRouterService, logger });
    const routingService = new ClassificationService({
      createLogger: () => logger,
      db,
      normalizePolicyDecisionThresholds: () => ({ autoClassifyThreshold: 85 }),
    });
    const routeToArr = jest.fn();
    routingService.routeToArr = routeToArr;

    const classificationService = {
      classifyQueueTask: async () => {
        const outcome = await policyPath.execute({
          libraries,
          metadata: {
            media_type: 'movie',
            title: 'Compose Provider Fault Fixture',
            tmdb_id: 999001,
          },
          relatedEvidence: [],
        });
        const routingOutcome = await routingService.routeClassificationResult(
          null,
          { classification_details: {} },
          outcome.result,
          false,
        );
        return {
          ...outcome.result,
          routingOutcome,
        };
      },
    };
    const queueService = new QueueService({
      aiRouterService,
      classificationService,
      db,
      logger,
      ollamaService,
      omdbService: {},
      syncStatus: { getStatus: () => ({}) },
      tmdbService: {},
    });

    const taskId = await queueService.enqueue('classification', {
      title: 'Compose Provider Fault Fixture',
    }, {
      source: 'ai_provider_fault_compose_integration',
    });
    const dispatched = await queueService.queueWorkerLoopService.maybeDispatchTask();
    const completedTask = await waitForCompletedTask(taskId);
    const persistedResult = completedTask.payload.result;
    const metricsResponse = await fetch(`${baseUrl}/_test/metrics`);
    const metrics = await metricsResponse.json();

    expect(dispatched).toBe(true);
    expect(persistedResult).toEqual(expect.objectContaining({
      library: null,
      method: 'queued_for_retry',
      needs_retry: true,
      provider_recovery: {
        mode: 'retry_queued',
        version: 'provider_recovery.v1',
      },
      retry_reason_code: 'ai_unavailable',
      routingOutcome: expect.objectContaining({
        reason: 'no_library',
        shouldRoute: false,
      }),
    }));
    expect(routeToArr).not.toHaveBeenCalled();
    expect(metricsResponse.ok).toBe(true);
    expect(metrics).toEqual({
      generationRequests: 1,
      tagRequests: expect.any(Number),
    });
    expect(metrics.tagRequests).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(persistedResult)).not.toContain('synthetic_provider_unavailable');
  }, 45_000);
});
