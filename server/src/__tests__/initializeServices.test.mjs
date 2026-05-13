/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { jest } from '@jest/globals';

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

jest.unstable_mockModule('../utils/logger.mjs', () => ({
  createLogger: jest.fn(() => mockLogger),
}));

const { initializeServices } = await import('../bootstrap/initializeServices.mjs');

describe('initializeServices', () => {
  let database;
  let startupService;
  let authService;
  let schedulerService;
  let healthCheckService;
  let ollamaService;
  let embeddingMigrationService;
  let graphRelationshipBackfillService;
  let libraryProfileService;
  let ratingNormalizer;
  let ratingNormalizationQueueService;
  let apiKeyService;
  let webhookService;
  let discordBot;
  let queueService;
  let providerLock;
  let backfillOrchestrator;
  beforeEach(() => {
    jest.resetAllMocks();
    startupService = {
      validateRuntimeWiring: jest.fn().mockReturnValue({ ok: true, checked: 3, issues: [] }),
    };

    authService = {
      revokeAllRefreshTokensOnStartup: jest.fn().mockResolvedValue(2),
    };

    schedulerService = {
      init: jest.fn(),
    };

    healthCheckService = {
      startHeartbeat: jest.fn(),
    };

    ollamaService = {
      startScheduledPreflight: jest.fn(),
    };

    embeddingMigrationService = {
      checkAndStartMigration: jest.fn().mockResolvedValue(),
    };

    graphRelationshipBackfillService = {
      checkAndBackfill: jest.fn().mockResolvedValue(),
    };

    libraryProfileService = {
      generateAllProfiles: jest.fn().mockResolvedValue([{ success: true }, { success: false }]),
    };

    ratingNormalizer = {
      getNeedsNormalizationSQL: jest.fn().mockReturnValue('rating <> original_rating'),
    };

    ratingNormalizationQueueService = {
      queueStartupBackfill: jest.fn().mockResolvedValue({ queued: 0, totalNeedingNormalization: 0 }),
    };

    apiKeyService = {
      ensureDefaultApiKey: jest.fn().mockResolvedValue(),
    };

    webhookService = {
      ensureSecretKey: jest.fn().mockResolvedValue(),
    };

    database = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }),
    };

    discordBot = {
      initialize: jest.fn().mockResolvedValue(),
    };

    queueService = {
      startWorker: jest.fn(),
    };

    providerLock = {
      init: jest.fn().mockResolvedValue(),
    };

    backfillOrchestrator = {
      init: jest.fn().mockResolvedValue(),
    };

  });


  it('starts queue and scheduler when runtime wiring is valid', async () => {
    await initializeServices({
      discordBot,
      queueService,
      providerLock,
      authService,
      apiKeyService,
      embeddingMigrationService,
      healthCheckService,
      libraryProfileService,
      ollamaService,
      schedulerService,
      startupService,
      webhookService,
      backfillOrchestratorService: backfillOrchestrator,
      graphRelationshipBackfillService,
      ratingNormalizerService: ratingNormalizer,
      ratingNormalizationQueueService,
      database,
    });

    expect(queueService.startWorker).toHaveBeenCalled();
    expect(schedulerService.init).toHaveBeenCalled();
    expect(providerLock.init).toHaveBeenCalled();
    expect(backfillOrchestrator.init).toHaveBeenCalled();
    expect(graphRelationshipBackfillService.checkAndBackfill).toHaveBeenCalled();
    expect(webhookService.ensureSecretKey).toHaveBeenCalled();
    expect(ratingNormalizationQueueService.queueStartupBackfill).toHaveBeenCalledTimes(1);
    expect(healthCheckService.startHeartbeat).toHaveBeenCalledWith(15 * 60 * 1000);
    expect(ollamaService.startScheduledPreflight).toHaveBeenCalledWith(24 * 60 * 60 * 1000);
  });

  it('skips queue and scheduler when runtime wiring validation fails', async () => {
    startupService.validateRuntimeWiring.mockReturnValue({
      ok: false,
      checked: 3,
      issues: [{ module: './services/startupService', actual: 'broken' }],
    });

    await initializeServices({
      discordBot,
      queueService,
      providerLock,
      authService,
      apiKeyService,
      embeddingMigrationService,
      healthCheckService,
      libraryProfileService,
      ollamaService,
      schedulerService,
      startupService,
      webhookService,
      backfillOrchestratorService: backfillOrchestrator,
      graphRelationshipBackfillService,
      ratingNormalizerService: ratingNormalizer,
      ratingNormalizationQueueService,
      database,
    });

    expect(queueService.startWorker).not.toHaveBeenCalled();
    expect(schedulerService.init).not.toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Runtime wiring validation failed; queue and scheduler startup skipped',
      expect.objectContaining({ runtimeWiringStatus: expect.objectContaining({ ok: false }) })
    );
    expect(providerLock.init).toHaveBeenCalled();
    expect(backfillOrchestrator.init).toHaveBeenCalled();
    expect(webhookService.ensureSecretKey).toHaveBeenCalled();
    expect(ratingNormalizationQueueService.queueStartupBackfill).toHaveBeenCalledTimes(1);
  });

  it('does not warn when Discord notifications are not configured', async () => {
    discordBot.initialize.mockRejectedValueOnce(new Error('Discord bot not configured or not enabled'));

    await initializeServices({
      discordBot,
      queueService,
      providerLock,
      authService,
      apiKeyService,
      embeddingMigrationService,
      healthCheckService,
      libraryProfileService,
      ollamaService,
      schedulerService,
      startupService,
      webhookService,
      backfillOrchestratorService: backfillOrchestrator,
      graphRelationshipBackfillService,
      ratingNormalizerService: ratingNormalizer,
      ratingNormalizationQueueService,
      database,
    });

    expect(mockLogger.warn).not.toHaveBeenCalledWith(
      'Discord bot initialization failed:',
      expect.any(Object)
    );
    expect(mockLogger.warn).not.toHaveBeenCalledWith('Continuing without Discord notifications...');
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Discord bot not configured; startup will continue without Discord notifications'
    );
    expect(queueService.startWorker).toHaveBeenCalled();
    expect(schedulerService.init).toHaveBeenCalled();
  });

  it('warns when Discord bot initialization fails for a real error', async () => {
    discordBot.initialize.mockRejectedValueOnce(new Error('Discord API unavailable'));

    await initializeServices({
      discordBot,
      queueService,
      providerLock,
      authService,
      apiKeyService,
      embeddingMigrationService,
      healthCheckService,
      libraryProfileService,
      ollamaService,
      schedulerService,
      startupService,
      webhookService,
      backfillOrchestratorService: backfillOrchestrator,
      graphRelationshipBackfillService,
      ratingNormalizerService: ratingNormalizer,
      ratingNormalizationQueueService,
      database,
    });

    expect(mockLogger.warn).toHaveBeenCalledWith('Discord bot initialization failed:', {
      error: 'Discord API unavailable',
    });
    expect(mockLogger.warn).toHaveBeenCalledWith('Continuing without Discord notifications...');
  });
});
