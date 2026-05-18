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
import { runStartupPreflight } from '../bootstrap/startupPreflight.mjs';

const { createConsoleSpy } = consoleHelpers;

describe('runStartupPreflight', () => {
  let database;
  let setLoggerDb;
  let runtimeSettings;
  let avxGuard;
  let clarificationService;
  let aiEmbeddingProviderIntegrityService;
  let discordConfigIntegrityService;
  let metadataProviderIntegrityService;
  let policyThresholdIntegrityService;
  let routingConfigIntegrityService;
  let migrationRunner;
  let postUpgradeService;
  let consoleLogHandle;
  let consoleWarnHandle;
  let consoleErrorHandle;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = originalNodeEnv;

    database = {
      query: jest.fn().mockResolvedValue(),
      prewarmHnswIndexes: jest.fn().mockResolvedValue({
        loaded: true,
        blocks: { text: 10, image: 20 },
      }),
      checkPgStatStatements: jest.fn().mockResolvedValue({
        active: true,
        reason: 'n/a',
      }),
      ensurePgStatStatements: jest.fn().mockResolvedValue({
        ensured: false,
        reason: 'already active',
      }),
    };

    setLoggerDb = jest.fn();

    runtimeSettings = {
      ensureRuntimeSettingsFile: jest.fn(),
      refreshFromDatabase: jest.fn().mockResolvedValue(),
      getOmdbRuntimeConfig: jest.fn().mockReturnValue({ apiKeyConfigured: false }),
      getCorsOriginsList: jest.fn().mockReturnValue(['http://localhost:3000']),
      getRuntimeSettingsFilePath: jest.fn().mockReturnValue('runtime.json'),
    };

    avxGuard = {
      run: jest.fn().mockResolvedValue({ selected: 'avx2' }),
    };

    clarificationService = {
      auditSeedIntegrity: jest.fn().mockResolvedValue(null),
    };

    aiEmbeddingProviderIntegrityService = {
      auditPersistedConfigs: jest.fn().mockResolvedValue({ invalidIssueCount: 0, issues: [] }),
    };

    discordConfigIntegrityService = {
      auditPersistedConfigs: jest.fn().mockResolvedValue({ invalidIssueCount: 0, issues: [] }),
    };

    metadataProviderIntegrityService = {
      auditPersistedConfigs: jest.fn().mockResolvedValue({ invalidProviderCount: 0, providers: [] }),
    };

    policyThresholdIntegrityService = {
      auditPersistedThresholds: jest.fn().mockResolvedValue({ invalidCount: 0, sample: [] }),
    };

    routingConfigIntegrityService = {
      auditPersistedMappings: jest.fn().mockResolvedValue({ invalidCount: 0, sample: [] }),
    };

    migrationRunner = {
      run: jest.fn().mockResolvedValue({ total: 5, applied: 1 }),
    };

    postUpgradeService = {
      runPendingTasks: jest.fn().mockResolvedValue({ executed: 2, skipped: 1 }),
    };

    consoleLogHandle = createConsoleSpy('log', { suppress: true });
    consoleWarnHandle = createConsoleSpy('warn', { suppress: true });
    consoleErrorHandle = createConsoleSpy('error', { suppress: true });
  });

  afterEach(() => {
    consoleLogHandle.restore();
    consoleWarnHandle.restore();
    consoleErrorHandle.restore();

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('runs the startup preflight sequence and registers the logger database', async () => {
    await runStartupPreflight({
      database,
      setLoggerDb,
      runtimeSettings,
      avxGuard,
      clarificationService,
      aiEmbeddingProviderIntegrityService,
      discordConfigIntegrityService,
      metadataProviderIntegrityService,
      policyThresholdIntegrityService,
      routingConfigIntegrityService,
      migrationRunnerService: migrationRunner,
      postUpgradeTaskService: postUpgradeService,
    });

    expect(database.query).toHaveBeenCalledWith('SELECT 1');
    expect(setLoggerDb).toHaveBeenCalledWith(database);
    expect(migrationRunner.run).toHaveBeenCalled();
    expect(clarificationService.auditSeedIntegrity).toHaveBeenCalledWith({ source: 'startup_preflight' });
    expect(aiEmbeddingProviderIntegrityService.auditPersistedConfigs).toHaveBeenCalledWith({ source: 'startup_preflight' });
    expect(discordConfigIntegrityService.auditPersistedConfigs).toHaveBeenCalledWith({ source: 'startup_preflight' });
    expect(metadataProviderIntegrityService.auditPersistedConfigs).toHaveBeenCalledWith({ source: 'startup_preflight' });
    expect(policyThresholdIntegrityService.auditPersistedThresholds).toHaveBeenCalledWith({ source: 'startup_preflight' });
    expect(routingConfigIntegrityService.auditPersistedMappings).toHaveBeenCalledWith({ source: 'startup_preflight' });
    expect(database.prewarmHnswIndexes).toHaveBeenCalled();
    expect(database.ensurePgStatStatements).toHaveBeenCalled();
    expect(database.checkPgStatStatements).toHaveBeenCalled();
    expect(postUpgradeService.runPendingTasks).toHaveBeenCalled();
    expect(runtimeSettings.ensureRuntimeSettingsFile).toHaveBeenCalled();
    expect(runtimeSettings.refreshFromDatabase).toHaveBeenCalled();
    expect(avxGuard.run).toHaveBeenCalled();
  });

  it('continues through runtime settings and AVX guard when migrations fail', async () => {
    migrationRunner.run.mockRejectedValueOnce(new Error('migration broke'));

    await runStartupPreflight({
      database,
      setLoggerDb,
      runtimeSettings,
      avxGuard,
      clarificationService,
      aiEmbeddingProviderIntegrityService,
      discordConfigIntegrityService,
      metadataProviderIntegrityService,
      policyThresholdIntegrityService,
      routingConfigIntegrityService,
      migrationRunnerService: migrationRunner,
      postUpgradeTaskService: postUpgradeService,
    });

    expect(postUpgradeService.runPendingTasks).toHaveBeenCalled();
    expect(runtimeSettings.refreshFromDatabase).toHaveBeenCalled();
    expect(avxGuard.run).toHaveBeenCalled();
  });

  it('continues when pg_stat_statements auto-install is unavailable', async () => {
    database.ensurePgStatStatements.mockResolvedValueOnce({
      ensured: false,
      reason: 'extension runtime files are not available in this image',
    });
    database.checkPgStatStatements.mockResolvedValueOnce({
      active: false,
      reason: 'extension runtime files are not available in this image',
    });

    await runStartupPreflight({
      database,
      setLoggerDb,
      runtimeSettings,
      avxGuard,
      clarificationService,
      aiEmbeddingProviderIntegrityService,
      discordConfigIntegrityService,
      metadataProviderIntegrityService,
      policyThresholdIntegrityService,
      routingConfigIntegrityService,
      migrationRunnerService: migrationRunner,
      postUpgradeTaskService: postUpgradeService,
    });

    expect(database.ensurePgStatStatements).toHaveBeenCalled();
    expect(database.checkPgStatStatements).toHaveBeenCalled();
    expect(postUpgradeService.runPendingTasks).toHaveBeenCalled();
  });

  it('does not warn when CORS origin restriction is left unset in production', async () => {
    process.env.NODE_ENV = 'production';
    runtimeSettings.getCorsOriginsList.mockReturnValue([]);

    await runStartupPreflight({
      database,
      setLoggerDb,
      runtimeSettings,
      avxGuard,
      clarificationService,
      aiEmbeddingProviderIntegrityService,
      discordConfigIntegrityService,
      metadataProviderIntegrityService,
      policyThresholdIntegrityService,
      routingConfigIntegrityService,
      migrationRunnerService: migrationRunner,
      postUpgradeTaskService: postUpgradeService,
    });

    expect(consoleWarnHandle.spy).not.toHaveBeenCalled();
  });

  it('continues when clarification seed integrity audit fails', async () => {
    clarificationService.auditSeedIntegrity.mockRejectedValueOnce(new Error('clarification audit failed'));

    await runStartupPreflight({
      database,
      setLoggerDb,
      runtimeSettings,
      avxGuard,
      clarificationService,
      aiEmbeddingProviderIntegrityService,
      discordConfigIntegrityService,
      metadataProviderIntegrityService,
      policyThresholdIntegrityService,
      routingConfigIntegrityService,
      migrationRunnerService: migrationRunner,
      postUpgradeTaskService: postUpgradeService,
    });

    expect(database.prewarmHnswIndexes).toHaveBeenCalled();
    expect(runtimeSettings.refreshFromDatabase).toHaveBeenCalled();
  });

  it('continues when metadata provider integrity audit fails', async () => {
    metadataProviderIntegrityService.auditPersistedConfigs.mockRejectedValueOnce(new Error('metadata provider audit failed'));

    await runStartupPreflight({
      database,
      setLoggerDb,
      runtimeSettings,
      avxGuard,
      clarificationService,
      aiEmbeddingProviderIntegrityService,
      discordConfigIntegrityService,
      metadataProviderIntegrityService,
      policyThresholdIntegrityService,
      routingConfigIntegrityService,
      migrationRunnerService: migrationRunner,
      postUpgradeTaskService: postUpgradeService,
    });

    expect(database.prewarmHnswIndexes).toHaveBeenCalled();
    expect(runtimeSettings.refreshFromDatabase).toHaveBeenCalled();
  });

  it('continues when AI/embedding provider integrity audit fails', async () => {
    aiEmbeddingProviderIntegrityService.auditPersistedConfigs.mockRejectedValueOnce(new Error('ai/embedding audit failed'));

    await runStartupPreflight({
      database,
      setLoggerDb,
      runtimeSettings,
      avxGuard,
      clarificationService,
      aiEmbeddingProviderIntegrityService,
      discordConfigIntegrityService,
      metadataProviderIntegrityService,
      policyThresholdIntegrityService,
      routingConfigIntegrityService,
      migrationRunnerService: migrationRunner,
      postUpgradeTaskService: postUpgradeService,
    });

    expect(database.prewarmHnswIndexes).toHaveBeenCalled();
    expect(runtimeSettings.refreshFromDatabase).toHaveBeenCalled();
  });

  it('continues when Discord config integrity audit fails', async () => {
    discordConfigIntegrityService.auditPersistedConfigs.mockRejectedValueOnce(new Error('discord audit failed'));

    await runStartupPreflight({
      database,
      setLoggerDb,
      runtimeSettings,
      avxGuard,
      clarificationService,
      aiEmbeddingProviderIntegrityService,
      discordConfigIntegrityService,
      metadataProviderIntegrityService,
      policyThresholdIntegrityService,
      routingConfigIntegrityService,
      migrationRunnerService: migrationRunner,
      postUpgradeTaskService: postUpgradeService,
    });

    expect(database.prewarmHnswIndexes).toHaveBeenCalled();
    expect(runtimeSettings.refreshFromDatabase).toHaveBeenCalled();
  });

  it('continues when persisted policy threshold integrity audit fails', async () => {
    policyThresholdIntegrityService.auditPersistedThresholds.mockRejectedValueOnce(new Error('threshold audit failed'));

    await runStartupPreflight({
      database,
      setLoggerDb,
      runtimeSettings,
      avxGuard,
      clarificationService,
      aiEmbeddingProviderIntegrityService,
      discordConfigIntegrityService,
      metadataProviderIntegrityService,
      policyThresholdIntegrityService,
      routingConfigIntegrityService,
      migrationRunnerService: migrationRunner,
      postUpgradeTaskService: postUpgradeService,
    });

    expect(database.prewarmHnswIndexes).toHaveBeenCalled();
    expect(runtimeSettings.refreshFromDatabase).toHaveBeenCalled();
  });

  it('continues when routing config integrity audit fails', async () => {
    routingConfigIntegrityService.auditPersistedMappings.mockRejectedValueOnce(new Error('routing audit failed'));

    await runStartupPreflight({
      database,
      setLoggerDb,
      runtimeSettings,
      avxGuard,
      clarificationService,
      aiEmbeddingProviderIntegrityService,
      discordConfigIntegrityService,
      metadataProviderIntegrityService,
      policyThresholdIntegrityService,
      routingConfigIntegrityService,
      migrationRunnerService: migrationRunner,
      postUpgradeTaskService: postUpgradeService,
    });

    expect(database.prewarmHnswIndexes).toHaveBeenCalled();
    expect(runtimeSettings.refreshFromDatabase).toHaveBeenCalled();
  });
});
