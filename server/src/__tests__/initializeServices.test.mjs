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
import consoleHelpers from './setup/consoleHelpers.mjs';
import { initializeServices } from '../bootstrap/initializeServices.mjs';

const { createConsoleSpy } = consoleHelpers;

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
  let apiKeyService;
  let webhookService;
  let discordBot;
  let queueService;
  let providerLock;
  let backfillOrchestrator;
  let consoleLogHandle;
  let consoleWarnHandle;
  let consoleErrorHandle;

  beforeEach(() => {
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

    consoleLogHandle = createConsoleSpy('log', { suppress: true });
    consoleWarnHandle = createConsoleSpy('warn', { suppress: true });
    consoleErrorHandle = createConsoleSpy('error', { suppress: true });
  });

  afterEach(() => {
    consoleLogHandle.restore();
    consoleWarnHandle.restore();
    consoleErrorHandle.restore();
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
      database,
    });

    expect(queueService.startWorker).toHaveBeenCalled();
    expect(schedulerService.init).toHaveBeenCalled();
    expect(providerLock.init).toHaveBeenCalled();
    expect(backfillOrchestrator.init).toHaveBeenCalled();
    expect(graphRelationshipBackfillService.checkAndBackfill).toHaveBeenCalled();
    expect(webhookService.ensureSecretKey).toHaveBeenCalled();
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
      database,
    });

    expect(queueService.startWorker).not.toHaveBeenCalled();
    expect(schedulerService.init).not.toHaveBeenCalled();
    expect(consoleErrorHandle.spy).toHaveBeenCalledWith(
      'Runtime wiring validation failed; queue and scheduler startup skipped',
      expect.objectContaining({ ok: false })
    );
    expect(providerLock.init).toHaveBeenCalled();
    expect(backfillOrchestrator.init).toHaveBeenCalled();
    expect(webhookService.ensureSecretKey).toHaveBeenCalled();
  });
});
