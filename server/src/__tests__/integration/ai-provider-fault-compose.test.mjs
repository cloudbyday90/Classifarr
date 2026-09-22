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
const { ClassificationProviderAdmissionService } = await import('../../services/classificationProviderAdmissionService.mjs');
const { ClassificationProviderCircuitRepository } = await import('../../services/classificationProviderCircuitRepository.mjs');
const { AutomaticClassificationRecoveryRepository } = await import('../../services/automaticClassificationRecoveryRepository.mjs');
const { AutomaticClassificationRecoveryService } = await import('../../services/automaticClassificationRecoveryService.mjs');
const { ClassificationRecoveryReadiness } = await import('../../services/classificationRecoveryReadiness.mjs');
const { ClassificationRetryService } = await import('../../services/classificationRetryService.mjs');

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

function createPolicyPath({ aiRouterService, admission, configuration, logger }) {
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
      aiClassify: async () => {
        const snapshot = await configuration.loadConfiguration();
        const provider = await aiRouterService.getProvider('classification', { configuration: snapshot.config });
        const ticket = await admission.admit(snapshot.config, provider);
        try {
          const response = await aiRouterService.classify('controlled provider-fault probe');
          if (response !== 'OK') throw new Error('Synthetic provider returned incomplete recovery output');
          await admission.succeeded(ticket);
          // The fixture tests transport recovery, not model destination quality.
          return { library: null, confidence: 0 };
        } catch (error) {
          await admission.failed(ticket, error);
          throw error;
        }
      },
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

async function seedDueDecision(mediaType, tmdbId) {
  const result = await db.query(
    `INSERT INTO classification_history
       (tmdb_id, media_type, title, method, status, retry_count, max_retries,
        retry_failure_code, retry_after, metadata, pending_identity_key)
     VALUES ($1::integer, $2::text, 'Synthetic provider recovery item', 'queued_for_retry',
       'pending_retry', 1, 3, 'ai_unavailable', NOW() - interval '1 minute',
       $3::jsonb, 'tmdb:' || $2::text || ':' || $1::integer::text)
     RETURNING id`,
    [tmdbId, mediaType, JSON.stringify({ tmdb_id: tmdbId, media_type: mediaType })],
  );
  return result.rows[0].id;
}

function createQueue({ aiRouterService, classificationService, logger }) {
  return new QueueService({
    aiRouterService,
    classificationService,
    db,
    logger,
    ollamaService,
    omdbService: {},
    syncStatus: { getStatus: () => ({}) },
    tmdbService: {},
  });
}

suite('Docker Compose provider fault integration', () => {
  beforeEach(() => {
    ollamaService.resetConfig();
  });

  afterEach(() => {
    ollamaService.resetConfig();
  });

  test('persists a 503 then resumes movie and TV jobs after provider recovery and worker restart', async () => {
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
    const configuration = new AutomaticClassificationRecoveryRepository({ database: db });
    const admission = new ClassificationProviderAdmissionService({
      configuration,
      logger,
      repository: new ClassificationProviderCircuitRepository({ database: db }),
      router: aiRouterService,
    });
    const policyPath = createPolicyPath({ aiRouterService, admission, configuration, logger });
    const routingService = new ClassificationService({
      createLogger: () => logger,
      db,
      normalizePolicyDecisionThresholds: () => ({ autoClassifyThreshold: 85 }),
    });
    const routeToArr = jest.fn();
    routingService.routeToArr = routeToArr;

    const classificationService = {
      classifyQueueTask: async (task) => {
        const payload = task.payload;
        const outcome = await policyPath.execute({
          libraries,
          metadata: {
            media_type: payload.media_type || 'movie',
            title: 'Compose Provider Fault Fixture',
            tmdb_id: payload.tmdb_id || 999001,
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
    const queueService = createQueue({ aiRouterService, classificationService, logger });

    const taskId = await queueService.enqueue('classification', {
      title: 'Compose Provider Fault Fixture',
      media_type: 'movie',
      tmdb_id: 999001,
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
      recovered: false,
      tagRequests: expect.any(Number),
    });
    expect(metrics.tagRequests).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(persistedResult)).not.toContain('synthetic_provider_unavailable');

    const circuit = await db.query('SELECT state FROM classification_provider_circuits');
    expect(circuit.rows).toEqual([{ state: 'open' }]);
    const movieId = await seedDueDecision('movie', 999002);
    const tvId = await seedDueDecision('tv', 999003);
    const recovery = new AutomaticClassificationRecoveryService({
      logger,
      readiness: new ClassificationRecoveryReadiness({ ollama: ollamaService, router: aiRouterService }),
      repository: configuration,
      retryService: new ClassificationRetryService({ db, logger }),
    });
    expect(await recovery.run()).toEqual({ state: 'cooldown', queued: 0 });
    await db.query("UPDATE classification_recovery_probe_state SET next_probe_at = NOW() - interval '1 second'");
    expect(await recovery.run()).toEqual({ state: 'unavailable', queued: 0 });
    expect((await db.query('SELECT id FROM task_queue')).rows).toHaveLength(1);

    const recoverResponse = await fetch(`${baseUrl}/_test/recover`, { method: 'POST' });
    expect(recoverResponse.ok).toBe(true);
    await db.query("UPDATE classification_recovery_probe_state SET next_probe_at = NOW() - interval '1 second'");
    expect(await recovery.run()).toEqual({ state: 'ready', queued: 2 });
    expect(await recovery.run()).toEqual({ state: 'idle', queued: 0 });
    const resumed = (await db.query(
      "SELECT id, payload, source, status FROM task_queue WHERE source = 'retry_queue' ORDER BY id",
    )).rows;
    expect(resumed).toHaveLength(2);
    expect(resumed.map(({ payload }) => payload.media_type)).toEqual(['movie', 'tv']);
    expect(resumed.map(({ payload }) => payload.retry_count)).toEqual([1, 1]);

    // A fresh service instance retains only database state, like a worker restart.
    const restartedWorker = createQueue({ aiRouterService, classificationService, logger });
    for (const task of resumed) {
      expect(await restartedWorker.queueWorkerLoopService.maybeDispatchTask()).toBe(true);
      const completed = await waitForCompletedTask(task.id);
      expect(completed.payload.result).toEqual(expect.objectContaining({
        method: 'ai_analysis',
        routingOutcome: expect.objectContaining({ shouldRoute: false }),
      }));
    }
    expect(routeToArr).not.toHaveBeenCalled();
    expect((await db.query('SELECT id FROM task_queue')).rows).toHaveLength(3);
    expect((await db.query(
      'SELECT id, retry_count, status FROM classification_history WHERE id = ANY($1::integer[]) ORDER BY id',
      [[movieId, tvId]],
    )).rows).toEqual([
      { id: movieId, retry_count: 1, status: 'reclassified' },
      { id: tvId, retry_count: 1, status: 'reclassified' },
    ]);
    expect((await db.query('SELECT state FROM classification_provider_circuits')).rows)
      .toEqual([{ state: 'closed' }]);
    expect(await (await fetch(`${baseUrl}/_test/metrics`)).json()).toEqual({
      generationRequests: 5,
      recovered: true,
      tagRequests: expect.any(Number),
    });
  }, 45_000);
});
