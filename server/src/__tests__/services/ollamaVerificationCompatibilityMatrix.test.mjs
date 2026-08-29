/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { jest } from '@jest/globals';
import {
  buildOllamaVerificationCompatibilityMatrixReport,
  OLLAMA_VERIFICATION_COMPATIBILITY_MATRIX_MAX_MODELS,
  selectOllamaVerificationCompatibilityMatrixModels,
} from '../../services/ollamaVerificationCompatibilityMatrix.mjs';
import {
  OLLAMA_VERIFICATION_COMPATIBILITY_MATRIX_MAX_ALTERNATIVE_SIZE_BYTES,
} from '../../services/ollamaVerificationCompatibilityMatrixEligibility.mjs';
import {
  probeOllamaVerificationCompatibilityMatrixModel,
} from '../../services/ollamaVerificationCompatibilityMatrixProbe.mjs';
import {
  createOllamaVerificationCompatibilityMatrixService,
  OllamaVerificationCompatibilityMatrixInProgressError,
} from '../../services/ollamaVerificationCompatibilityMatrixService.mjs';

const DIGEST_A = 'a'.repeat(64);
const DIGEST_B = 'b'.repeat(64);

describe('Ollama verification compatibility matrix', () => {
  test('selects a deterministic local-only subset with the saved model first', () => {
    const selection = selectOllamaVerificationCompatibilityMatrixModels([
      { name: 'zeta:latest', digest: DIGEST_B, size: 2 * 1024 ** 3 },
      { name: 'gemma4:e4b:cloud', digest: 'c'.repeat(64), size: 2 * 1024 ** 3 },
      { name: 'Alpha:latest', digest: DIGEST_A, size: 2 * 1024 ** 3 },
      { name: 'alpha:latest', digest: DIGEST_B, size: 2 * 1024 ** 3 },
      { name: 'invalid model name', digest: DIGEST_B, size: 2 * 1024 ** 3 },
      { name: 'beta:latest', digest: DIGEST_B, size: 2 * 1024 ** 3 },
      { name: 'delta:latest', digest: DIGEST_B, size: 2 * 1024 ** 3 },
      { name: 'epsilon:latest', digest: DIGEST_B, size: 2 * 1024 ** 3 },
      { name: 'gamma:latest', digest: DIGEST_B, size: 2 * 1024 ** 3 },
      { name: 'theta:latest', digest: DIGEST_B, size: 2 * 1024 ** 3 },
    ], 'zeta:latest');

    expect(selection.models).toHaveLength(OLLAMA_VERIFICATION_COMPATIBILITY_MATRIX_MAX_MODELS);
    expect(selection.models.map((model) => model.name)).toEqual([
      'zeta:latest',
      'Alpha:latest',
      'beta:latest',
      'delta:latest',
      'epsilon:latest',
      'gamma:latest',
    ]);
    expect(selection.configuredModelIncluded).toBe(true);
    expect(selection.omittedModelCount).toBe(1);
    expect(selection.skippedAlternativeModelCount).toBe(0);
    expect(JSON.stringify(selection)).not.toContain(':cloud');
    expect(selection.models[0].buildId).toBe('b'.repeat(12));
  });

  test('keeps the configured model but excludes oversized, unknown-size, and clearly embedding-only alternatives', () => {
    const selection = selectOllamaVerificationCompatibilityMatrixModels([
      { name: 'saved:large', digest: DIGEST_A, size: 80 * 1024 ** 3 },
      { name: 'oversized:latest', digest: DIGEST_B, size: OLLAMA_VERIFICATION_COMPATIBILITY_MATRIX_MAX_ALTERNATIVE_SIZE_BYTES + 1 },
      { name: 'unknown-size:latest', digest: DIGEST_B },
      { name: 'embedding:latest', digest: DIGEST_B, size: 1024 ** 3, details: { family: 'llama' } },
      { name: 'family-only:latest', digest: DIGEST_B, size: 1024 ** 3, details: { family: 'bert' } },
      { name: 'eligible:latest', digest: DIGEST_B, size: 2 * 1024 ** 3 },
    ], 'saved:large');

    expect(selection.models.map((model) => model.name)).toEqual([
      'saved:large',
      'eligible:latest',
    ]);
    expect(selection.configuredModelIncluded).toBe(true);
    expect(selection.skippedAlternativeModelCount).toBe(4);
    expect(selection.omittedModelCount).toBe(4);
  });

  test('projects only the fixed, transient response fields', () => {
    const report = buildOllamaVerificationCompatibilityMatrixReport({
      stateId: 'completed',
      ollamaVersion: '0.12.4',
      selection: {
        configuredModelIncluded: true,
        omittedModelCount: 2,
        skippedAlternativeModelCount: 1,
        models: [{ name: 'gemma4:e4b', buildId: DIGEST_A }],
      },
      outcomes: [{
        modelName: 'gemma4:e4b',
        statusId: 'verification_ready',
        checkedAt: '2026-08-29T12:34:56.000Z',
        latencyMs: 42,
        host: 'private-ollama.internal',
        output: 'provider response',
        error: 'private provider error',
      }],
    });

    expect(report).toEqual({
      version: 'ollama.verification_compatibility_matrix.v1',
      stateId: 'completed',
      ollamaVersion: '0.12.4',
      configuredModelIncluded: true,
      omittedModelCount: 2,
      skippedAlternativeModelCount: 1,
      outcomes: [{
        modelName: 'gemma4:e4b',
        modelBuildId: 'a'.repeat(12),
        statusId: 'verification_ready',
        checkedAt: '2026-08-29T12:34:56.000Z',
        latencyMs: 42,
      }],
    });
    expect(JSON.stringify(report)).not.toContain('private-');
    expect(JSON.stringify(report)).not.toContain('provider response');
  });

  test('uses the shared schema probe with a timeout and unload request, discarding provider text', async () => {
    const ollamaClient = {
      generate: jest.fn().mockResolvedValue(JSON.stringify({
        status: 'ready',
        contract: 'candidate-bound-verification',
      })),
    };

    const outcome = await probeOllamaVerificationCompatibilityMatrixModel({
      modelName: 'gemma4:e4b',
      ollamaClient,
      now: () => '2026-08-29T12:34:56.000Z',
      clock: jest.fn()
        .mockReturnValueOnce(100)
        .mockReturnValueOnce(148),
    });

    expect(outcome).toEqual({
      modelName: 'gemma4:e4b',
      statusId: 'verification_ready',
      checkedAt: '2026-08-29T12:34:56.000Z',
      latencyMs: 48,
    });
    expect(ollamaClient.generate).toHaveBeenCalledWith(
      expect.stringContaining('candidate-bound-verification'),
      'gemma4:e4b',
      0,
      expect.objectContaining({
        format: expect.any(Object),
        think: false,
        keepAlive: 0,
        timeoutMs: 60_000,
      }),
    );
  });

  test('uses a connection-only preflight then probes eligible local models serially', async () => {
    const loadConfiguration = jest.fn().mockResolvedValue({
      primary_provider: 'ollama',
      ollama_host: 'private-ollama.internal',
      ollama_port: 11434,
      ollama_model: 'saved:latest',
    });
    const ollamaClient = {
      preflightConnection: jest.fn().mockResolvedValue({
        success: true,
        models: [
          { name: 'saved:latest', digest: DIGEST_A },
          { name: 'other:latest', digest: DIGEST_B, size: 2 * 1024 ** 3 },
          { name: 'cloud:latest:cloud', digest: 'c'.repeat(64), size: 2 * 1024 ** 3 },
        ],
      }),
      getVersion: jest.fn().mockResolvedValue('0.12.4'),
    };
    const probeModel = jest.fn(async ({ modelName }) => ({
      modelName,
      statusId: 'verification_ready',
      checkedAt: '2026-08-29T12:34:56.000Z',
      latencyMs: 12,
      response: 'never returned',
    }));
    const service = createOllamaVerificationCompatibilityMatrixService({
      database: { query: jest.fn() },
      ollamaClient,
      loadConfiguration,
      probeModel,
    });

    const report = await service.run();

    expect(ollamaClient.preflightConnection).toHaveBeenCalledWith({
      force: true,
      includeModels: true,
      probeGeneration: false,
      cacheMs: 0,
    });
    expect(ollamaClient.getVersion).toHaveBeenCalledWith({ timeoutMs: 5000 });
    expect(probeModel.mock.calls.map(([request]) => request.modelName)).toEqual([
      'saved:latest',
      'other:latest',
    ]);
    expect(report).toMatchObject({
      stateId: 'completed',
      ollamaVersion: '0.12.4',
      configuredModelIncluded: true,
    });
    expect(JSON.stringify(report)).not.toContain('private-ollama.internal');
    expect(JSON.stringify(report)).not.toContain('never returned');
  });

  test('binds the default matrix client to saved AI Settings configuration', async () => {
    const savedOllamaClient = {
      preflightConnection: jest.fn().mockResolvedValue({
        success: true,
        models: [{ name: 'saved:latest', digest: DIGEST_A }],
      }),
      getVersion: jest.fn().mockResolvedValue('0.12.4'),
    };
    const createSavedOllamaClient = jest.fn(() => savedOllamaClient);
    const configuration = {
      primary_provider: 'ollama',
      ollama_host: 'saved-ollama.internal',
      ollama_port: 11434,
      ollama_model: 'saved:latest',
    };
    const service = createOllamaVerificationCompatibilityMatrixService({
      database: {},
      loadConfiguration: jest.fn().mockResolvedValue(configuration),
      createSavedOllamaClient,
      probeModel: jest.fn().mockResolvedValue({
        modelName: 'saved:latest',
        statusId: 'verification_ready',
        checkedAt: '2026-08-29T12:34:56.000Z',
        latencyMs: 12,
      }),
    });

    await expect(service.run()).resolves.toMatchObject({ stateId: 'completed' });

    expect(createSavedOllamaClient).toHaveBeenCalledWith({ configuration });
  });

  test('does not start overlapping matrix work', async () => {
    let resolveProbe;
    const probeResult = new Promise((resolve) => {
      resolveProbe = resolve;
    });
    const service = createOllamaVerificationCompatibilityMatrixService({
      database: {},
      loadConfiguration: jest.fn().mockResolvedValue({
        primary_provider: 'ollama',
        ollama_model: 'saved:latest',
      }),
      ollamaClient: {
        preflightConnection: jest.fn().mockResolvedValue({
          success: true,
          models: [{ name: 'saved:latest', digest: DIGEST_A }],
        }),
        getVersion: jest.fn().mockResolvedValue('0.12.4'),
      },
      probeModel: jest.fn(() => probeResult),
    });

    const firstRun = service.run();
    await expect(service.run()).rejects.toBeInstanceOf(OllamaVerificationCompatibilityMatrixInProgressError);
    resolveProbe({
      modelName: 'saved:latest',
      statusId: 'verification_ready',
      checkedAt: '2026-08-29T12:34:56.000Z',
      latencyMs: 1,
    });
    await expect(firstRun).resolves.toMatchObject({ stateId: 'completed' });
  });
});
