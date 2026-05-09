/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { createMockModule, createNamedMockModule } from './helpers/mockFactory.mjs';
import { createSettingsTestApp } from './helpers/setupRouteTest.mjs';

const mockDb = {
  query: jest.fn(),
  withTransaction: jest.fn(),
  pool: {
    connect: jest.fn(),
  },
};

const mockRadarr = {};

const mockSonarr = {};

const mockOllama = {
  resetConfig: jest.fn(),
};

const mockTmdb = {
  testConnection: jest.fn(),
  checkHealth: jest.fn(),
};

const mockTavily = {
  search: jest.fn(),
  testConnection: jest.fn(),
  checkHealth: jest.fn(),
};

const mockOmdb = {
  testConnection: jest.fn(),
  checkHealth: jest.fn(),
  getByTitle: jest.fn(),
};

const mockDiscordBot = {};

const mockStartupService = {
  getSetupStatus: jest.fn(),
  setMediaPath: jest.fn(),
  checkMediaPathStatus: jest.fn(),
};

const mockPathTestService = {
  testPathAccessibility: jest.fn(),
  testPathTranslation: jest.fn(),
  testAllMappings: jest.fn(),
  healthCheck: jest.fn(),
  getMediaPathConfig: jest.fn(),
};

const mockRuntimeSettings = {
  refreshFromDatabase: jest.fn(),
};

const mockEmbeddingProvider = {
  resetConfig: jest.fn(),
};

const mockEmbeddingRouter = {
  resetConfig: jest.fn(),
  clearCache: jest.fn(),
};

const mockAiRouter = {
  clearCache: jest.fn(),
  getStatus: jest.fn(),
};

const mockCloudLLM = {
  testConnection: jest.fn(),
  getModels: jest.fn(),
  resetMonthlyUsage: jest.fn(),
};

const mockWebhook = {};

const mockScheduler = {
  runGapAnalysis: jest.fn().mockResolvedValue(undefined),
};

const mockProviderLock = {
  config: {
    heartbeatTimeout: 30000,
    heartbeatInterval: 5000,
    maxWaitTime: 120000
  },
  updateConfig: jest.fn().mockResolvedValue(undefined),
  getLockStatus: jest.fn().mockReturnValue({
    isLocked: false,
    lockedBy: null,
    config: {
      heartbeatTimeout: 30000,
      heartbeatInterval: 5000,
      maxWaitTime: 120000
    }
  })
};

const mockAuth = {
  authenticateToken: (req, res, next) => next(),
  requireAdmin: (req, res, next) => next(),
};

const mockLogger = {
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })
};

const mockRagLoopConfig = {
  getRagLoopDefaultConfig: jest.fn(() => ({})),
  validateAndNormalizeRagLoopConfig: jest.fn(config => ({ normalizedConfig: config, warnings: [] })),
};

jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));

jest.unstable_mockModule('../services/radarr.mjs', () => createNamedMockModule('radarrService', mockRadarr));

jest.unstable_mockModule('../services/sonarr.mjs', () => createNamedMockModule('sonarrService', mockSonarr));

jest.unstable_mockModule('../services/ollama.mjs', () => createNamedMockModule('ollamaService', mockOllama));

jest.unstable_mockModule('../services/tmdb.mjs', () => createNamedMockModule('tmdbService', mockTmdb));

jest.unstable_mockModule('../services/tavily.mjs', () => createNamedMockModule('tavilyService', mockTavily));

jest.unstable_mockModule('../services/omdb.mjs', () => createNamedMockModule('omdbService', mockOmdb));

jest.unstable_mockModule('../services/discordBot.mjs', () => createNamedMockModule('discordBotService', mockDiscordBot));

jest.unstable_mockModule('../services/startupService.mjs', () => createNamedMockModule('startupService', mockStartupService));

jest.unstable_mockModule('../services/pathTestService.mjs', () => createNamedMockModule('pathTestService', mockPathTestService));

jest.unstable_mockModule('../config/runtimeSettings.mjs', () => createMockModule(mockRuntimeSettings));

jest.unstable_mockModule('../services/embeddingProvider.mjs', () => createNamedMockModule('embeddingProvider', mockEmbeddingProvider));

jest.unstable_mockModule('../services/embeddingRouter.mjs', () => createNamedMockModule('embeddingRouter', mockEmbeddingRouter));

jest.unstable_mockModule('../services/aiRouter.mjs', () => createNamedMockModule('aiRouterService', mockAiRouter));

jest.unstable_mockModule('../services/cloudLLM.mjs', () => createNamedMockModule('cloudLLMService', mockCloudLLM));

jest.unstable_mockModule('../services/webhook.mjs', () => createNamedMockModule('webhookService', mockWebhook));

jest.unstable_mockModule('../services/scheduler.mjs', () => createNamedMockModule('schedulerService', mockScheduler));

jest.unstable_mockModule('../services/providerLock.mjs', () => createNamedMockModule('providerLock', mockProviderLock));

jest.unstable_mockModule('../middleware/auth.mjs', () => createNamedMockModule('router', mockAuth));

jest.unstable_mockModule('../utils/logger.mjs', () => createMockModule(mockLogger));

mockRagLoopConfig.RAG_LOOP_V1_KEYS = [];
jest.unstable_mockModule('../utils/ragLoopConfig.mjs', () => createNamedMockModule('DEFAULT_IDENTIFIER_CAPS', mockRagLoopConfig));

const { createSettingsTestRouter } = await import('./setup/createSettingsTestRouter.mjs');

const db = mockDb;
const runtimeSettings = mockRuntimeSettings;

describe('Settings general/category route helpers', () => {
  let app;
  let settingsRouter;

  beforeAll(async () => {
    settingsRouter = await createSettingsTestRouter(express);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    db.withTransaction.mockImplementation(async (fn) => fn({ query: db.query }));
    app = createSettingsTestApp(settingsRouter);
  });

  it('rejects array payloads for PUT /settings', async () => {
    const res = await request(app)
      .put('/settings')
      .send(['bad'])
      .expect(400);

    expect(res.body).toEqual({ error: 'Settings must be a valid object' });
    expect(db.query).not.toHaveBeenCalled();
    expect(runtimeSettings.refreshFromDatabase).not.toHaveBeenCalled();
  });

  it('loads queue category settings with coercion and defaults', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        { key: 'queue_worker_enabled', value: 'false' },
        { key: 'queue_concurrent_workers', value: '3' },
        { key: 'queue_retry_strategy', value: 'linear' },
        { key: 'queue_unknown_setting', value: 'ignored' }
      ]
    });

    const res = await request(app)
      .get('/settings/category/queue')
      .expect(200);

    expect(res.body).toEqual({
      workerEnabled: false,
      concurrentWorkers: 3,
      maxRetryAttempts: 5,
      retryStrategy: 'linear',
      autoDeleteCompleted: '7d',
      autoDeleteFailed: 'never'
    });
  });

  it('rejects array payloads for PUT /settings/category/:name', async () => {
    const res = await request(app)
      .put('/settings/category/queue')
      .send(['bad'])
      .expect(400);

    expect(res.body).toEqual({ error: 'Settings must be a valid object' });
    expect(db.query).not.toHaveBeenCalled();
  });

  it('returns the actual filtered update count for queue category writes', async () => {
    db.query.mockResolvedValue({ rows: [] });

    const res = await request(app)
      .put('/settings/category/queue')
      .send({
        workerEnabled: true,
        retryStrategy: 'linear',
        ignoredKey: 'skip-me'
      })
      .expect(200);

    expect(res.body).toEqual({
      success: true,
      category: 'queue',
      updated: 2
    });
    expect(db.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('INSERT INTO settings'),
      ['queue_worker_enabled', 'true']
    );
    expect(db.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO settings'),
      ['queue_retry_strategy', 'linear']
    );
    expect(runtimeSettings.refreshFromDatabase).toHaveBeenCalledTimes(1);
  });

  it('rolls back PUT /settings through db.withTransaction and skips runtime refresh on failure', async () => {
    db.withTransaction.mockImplementationOnce(async () => {
      throw new Error('settings write failed');
    });

    const res = await request(app)
      .put('/settings')
      .send({
        worker_enabled: 'true',
        max_retry_attempts: '5'
      })
      .expect(500);

    expect(res.body.error).toContain('settings write failed');
    expect(db.withTransaction).toHaveBeenCalledTimes(1);
    expect(runtimeSettings.refreshFromDatabase).not.toHaveBeenCalled();
  });

  it('rolls back PUT /settings/category/:name through db.withTransaction and skips runtime refresh on failure', async () => {
    db.withTransaction.mockImplementationOnce(async () => {
      throw new Error('category write failed');
    });

    const res = await request(app)
      .put('/settings/category/queue')
      .send({
        workerEnabled: true,
        retryStrategy: 'linear'
      })
      .expect(500);

    expect(res.body.error).toContain('category write failed');
    expect(db.withTransaction).toHaveBeenCalledTimes(1);
    expect(runtimeSettings.refreshFromDatabase).not.toHaveBeenCalled();
  });
});
