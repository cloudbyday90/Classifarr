/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it, jest } from '@jest/globals';

import {
  buildClassificationQueueAdmissionDiagnostics,
  CLASSIFICATION_QUEUE_STRICT_VERIFICATION_STATUS_IDS,
  CLASSIFICATION_QUEUE_WORKER_STATUS_IDS,
} from '../services/classificationQueueAdmissionDiagnostics.mjs';
import {
  createClassificationQueueAdmissionDiagnosticsService,
} from '../services/classificationQueueAdmissionDiagnosticsService.mjs';
import {
  resolveOllamaVerificationCapabilityIdentity,
} from '../services/ollamaVerificationCapabilityIdentity.mjs';

function buildModelChangedConfiguration() {
  const baseConfiguration = {
    primary_provider: 'ollama',
    ollama_host: 'private-ollama-host',
    ollama_port: 11434,
    ollama_model: 'private-model-name',
    configuration_revision: 4,
  };
  const identity = resolveOllamaVerificationCapabilityIdentity(baseConfiguration);

  return {
    ...baseConfiguration,
    ollama_verification_capability_status: 'model_changed',
    ollama_verification_capability_fingerprint: identity.fingerprint,
    ollama_verification_capability_configuration_revision: identity.configurationRevision,
    ollama_verification_capability_checked_at: new Date().toISOString(),
    ollama_verification_capability_model_digest: 'f'.repeat(64),
    ollama_verification_capability_error_code: 'private-runtime-error',
  };
}

describe('classificationQueueAdmissionDiagnostics', () => {
  it('separates unavailable worker capacity from a changed strict-verification model', () => {
    const diagnostics = buildClassificationQueueAdmissionDiagnostics({
      queueStats: { pending: 2 },
      dispatchBlockers: { hasProcessingClassification: true, lookupFailed: false },
      runtimeState: {
        workerRunning: true,
        aiAvailable: true,
        processing: 1,
        processingByType: { metadata_enrichment: 0 },
        queueConcurrency: { generalWorkers: 1 },
      },
      providerConfiguration: buildModelChangedConfiguration(),
    });

    expect(diagnostics).toEqual({
      version: 'classification.queue_admission_diagnostics.v1',
      queue: { statusId: CLASSIFICATION_QUEUE_WORKER_STATUS_IDS.NO_ELIGIBLE_WORKER },
      strictVerification: { statusId: CLASSIFICATION_QUEUE_STRICT_VERIFICATION_STATUS_IDS.MODEL_CHANGED },
      sideEffects: {
        providerCalled: false,
        providerAvailabilityChecked: false,
        configurationPersisted: false,
        routingChanged: false,
        retryQueued: false,
      },
    });
    expect(JSON.stringify(diagnostics)).not.toContain('private-ollama-host');
    expect(JSON.stringify(diagnostics)).not.toContain('private-model-name');
    expect(JSON.stringify(diagnostics)).not.toContain('private-runtime-error');
  });

  it('reports no worker when the worker is stopped without treating the model state as a queue blocker', () => {
    const diagnostics = buildClassificationQueueAdmissionDiagnostics({
      queueStats: { pending: 1 },
      runtimeState: { workerRunning: false, aiAvailable: true },
      providerConfiguration: buildModelChangedConfiguration(),
    });

    expect(diagnostics.queue.statusId).toBe(CLASSIFICATION_QUEUE_WORKER_STATUS_IDS.WORKER_NOT_RUNNING);
    expect(diagnostics.strictVerification.statusId).toBe(
      CLASSIFICATION_QUEUE_STRICT_VERIFICATION_STATUS_IDS.MODEL_CHANGED,
    );
  });

  it('does not inspect saved provider configuration when no classification is waiting', async () => {
    const loadProviderConfiguration = jest.fn();
    const service = createClassificationQueueAdmissionDiagnosticsService({
      database: {},
      loadProviderConfiguration,
    });

    const diagnostics = await service.getDiagnostics({
      queueStats: { pending: 0 },
      runtimeState: { workerRunning: true, aiAvailable: true },
    });

    expect(loadProviderConfiguration).not.toHaveBeenCalled();
    expect(diagnostics.queue.statusId).toBe(CLASSIFICATION_QUEUE_WORKER_STATUS_IDS.NOT_WAITING);
    expect(diagnostics.strictVerification.statusId).toBe(
      CLASSIFICATION_QUEUE_STRICT_VERIFICATION_STATUS_IDS.NOT_BLOCKED,
    );
  });

  it('bounds repeated configuration reads with a short cache and recovers safely from a read failure', async () => {
    const configuration = buildModelChangedConfiguration();
    const loadProviderConfiguration = jest.fn()
      .mockResolvedValueOnce(configuration)
      .mockRejectedValueOnce(new Error('database unavailable'));
    const logger = { warn: jest.fn() };
    let currentTime = 1000;
    const service = createClassificationQueueAdmissionDiagnosticsService({
      database: {},
      loadProviderConfiguration,
      logger,
      now: () => currentTime,
      cacheTtlMs: 100,
    });
    const request = {
      queueStats: { pending: 1 },
      runtimeState: { workerRunning: true, aiAvailable: true },
    };

    await expect(service.getDiagnostics(request)).resolves.toMatchObject({
      strictVerification: { statusId: 'model_changed' },
    });
    await expect(service.getDiagnostics(request)).resolves.toMatchObject({
      strictVerification: { statusId: 'model_changed' },
    });
    expect(loadProviderConfiguration).toHaveBeenCalledTimes(1);

    currentTime += 100;
    await expect(service.getDiagnostics(request)).resolves.toMatchObject({
      strictVerification: { statusId: 'not_blocked' },
    });
    expect(loadProviderConfiguration).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledWith(
      'Queue admission diagnostics could not read saved verification state',
      expect.objectContaining({ error: 'database unavailable' }),
    );
  });
});
