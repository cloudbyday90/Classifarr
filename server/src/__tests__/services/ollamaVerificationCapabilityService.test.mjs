/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { jest } from '@jest/globals';
import {
  createOllamaVerificationCapabilityService,
} from '../../services/ollamaVerificationCapabilityService.mjs';

describe('ollama verification capability service', () => {
  test('runs the remote probe before opening the short persistence transaction', async () => {
    const events = [];
    const configuration = {
      primary_provider: 'ollama',
      ollama_host: 'ollama',
      ollama_port: 11434,
      ollama_model: 'gemma4:e4b',
      configuration_revision: 4,
    };
    const database = {
      withTransaction: async (callback) => {
        events.push('transaction');
        return callback({});
      },
    };
    const runProbe = jest.fn().mockImplementation(async ({ identity }) => {
      events.push('probe');
      return {
        statusId: 'verification_ready',
        configurationFingerprint: identity.fingerprint,
        configurationRevision: identity.configurationRevision,
        modelDigest: 'a'.repeat(64),
        checkedAt: '2026-08-28T12:00:00.000Z',
        errorCode: null,
        latencyMs: 12,
      };
    });
    const persistProbe = jest.fn().mockResolvedValue({});
    const recordOutcomeHistory = jest.fn().mockResolvedValue();
    const service = createOllamaVerificationCapabilityService({
      database,
      loadConfiguration: jest.fn().mockResolvedValue(configuration),
      runProbe,
      persistProbe,
      recordOutcomeHistory,
      ollamaClient: {},
    });

    const outcome = await service.testSavedConfiguration();

    expect(events).toEqual(['probe', 'transaction']);
    expect(persistProbe).toHaveBeenCalledWith(expect.objectContaining({
      identity: expect.objectContaining({ configurationRevision: 4 }),
      outcome,
    }));
    expect(recordOutcomeHistory).toHaveBeenCalledWith(database, 'verification_ready');
  });

  test('keeps a successful saved test authoritative when aggregate history persistence fails', async () => {
    const outcome = {
      statusId: 'classification_only',
      configurationFingerprint: 'a'.repeat(64),
      configurationRevision: 9,
    };
    const logger = { warn: jest.fn() };
    const recordOutcomeHistory = jest.fn().mockRejectedValue(new Error('database unavailable'));
    const service = createOllamaVerificationCapabilityService({
      database: {
        withTransaction: async (callback) => callback({}),
      },
      loadConfiguration: jest.fn().mockResolvedValue({
        primary_provider: 'ollama',
        ollama_host: 'ollama',
        ollama_port: 11434,
        ollama_model: 'gemma4:e4b',
        configuration_revision: 9,
      }),
      runProbe: jest.fn().mockResolvedValue(outcome),
      persistProbe: jest.fn().mockResolvedValue({}),
      recordOutcomeHistory,
      logger,
      ollamaClient: {},
    });

    await expect(service.testSavedConfiguration()).resolves.toBe(outcome);
    expect(logger.warn).toHaveBeenCalledWith(
      'Ollama verification outcome history recording failed',
      { failureCode: 'persistence_unavailable' },
    );
  });

  test('does not persist a no-op result when Ollama is not the saved primary provider', async () => {
    const outcome = { statusId: 'not_applicable' };
    const database = {
      withTransaction: jest.fn(),
    };
    const persistProbe = jest.fn();
    const service = createOllamaVerificationCapabilityService({
      database,
      loadConfiguration: jest.fn().mockResolvedValue({ primary_provider: 'openai' }),
      runProbe: jest.fn().mockResolvedValue(outcome),
      persistProbe,
      ollamaClient: {},
    });

    await expect(service.testSavedConfiguration()).resolves.toBe(outcome);
    expect(database.withTransaction).not.toHaveBeenCalled();
    expect(persistProbe).not.toHaveBeenCalled();
  });
});
