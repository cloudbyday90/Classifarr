/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

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

jest.mock('../config/database', () => mockDb);
jest.unstable_mockModule('../config/database', () => ({ ...mockDb, default: mockDb }));
jest.unstable_mockModule('../config/database.mjs', () => ({ ...mockDb, default: mockDb }));

jest.mock('../services/radarr', () => mockRadarr);
jest.unstable_mockModule('../services/radarr', () => ({ ...mockRadarr, default: mockRadarr }));
jest.unstable_mockModule('../services/radarr.mjs', () => ({ ...mockRadarr, default: mockRadarr }));

jest.mock('../services/sonarr', () => mockSonarr);
jest.unstable_mockModule('../services/sonarr', () => ({ ...mockSonarr, default: mockSonarr }));
jest.unstable_mockModule('../services/sonarr.mjs', () => ({ ...mockSonarr, default: mockSonarr }));

jest.mock('../services/ollama', () => mockOllama);
jest.unstable_mockModule('../services/ollama', () => ({ ...mockOllama, default: mockOllama }));
jest.unstable_mockModule('../services/ollama.mjs', () => ({ ...mockOllama, default: mockOllama }));

jest.mock('../services/tmdb', () => mockTmdb);
jest.unstable_mockModule('../services/tmdb', () => ({ ...mockTmdb, default: mockTmdb }));
jest.unstable_mockModule('../services/tmdb.mjs', () => ({ ...mockTmdb, default: mockTmdb }));

jest.mock('../services/tavily', () => mockTavily);
jest.unstable_mockModule('../services/tavily', () => ({ ...mockTavily, default: mockTavily }));
jest.unstable_mockModule('../services/tavily.mjs', () => ({ ...mockTavily, default: mockTavily }));

jest.mock('../services/omdb', () => mockOmdb);
jest.unstable_mockModule('../services/omdb', () => ({ ...mockOmdb, default: mockOmdb }));
jest.unstable_mockModule('../services/omdb.mjs', () => ({ ...mockOmdb, default: mockOmdb }));

jest.mock('../services/discordBot', () => mockDiscordBot);
jest.unstable_mockModule('../services/discordBot', () => ({ ...mockDiscordBot, default: mockDiscordBot }));
jest.unstable_mockModule('../services/discordBot.mjs', () => ({ ...mockDiscordBot, default: mockDiscordBot }));

jest.mock('../services/startupService', () => mockStartupService);
jest.unstable_mockModule('../services/startupService', () => ({ ...mockStartupService, default: mockStartupService }));
jest.unstable_mockModule('../services/startupService.mjs', () => ({ ...mockStartupService, default: mockStartupService }));

jest.mock('../services/pathTestService', () => mockPathTestService);
jest.unstable_mockModule('../services/pathTestService', () => ({ ...mockPathTestService, default: mockPathTestService }));
jest.unstable_mockModule('../services/pathTestService.mjs', () => ({ ...mockPathTestService, default: mockPathTestService }));

jest.mock('../config/runtimeSettings', () => mockRuntimeSettings);
jest.unstable_mockModule('../config/runtimeSettings', () => ({ ...mockRuntimeSettings, default: mockRuntimeSettings }));
jest.unstable_mockModule('../config/runtimeSettings.mjs', () => ({ ...mockRuntimeSettings, default: mockRuntimeSettings }));

jest.mock('../services/embeddingProvider', () => mockEmbeddingProvider);
jest.unstable_mockModule('../services/embeddingProvider', () => ({ ...mockEmbeddingProvider, default: mockEmbeddingProvider }));
jest.unstable_mockModule('../services/embeddingProvider.mjs', () => ({ ...mockEmbeddingProvider, default: mockEmbeddingProvider }));

jest.mock('../services/embeddingRouter', () => mockEmbeddingRouter);
jest.unstable_mockModule('../services/embeddingRouter', () => ({ ...mockEmbeddingRouter, default: mockEmbeddingRouter }));
jest.unstable_mockModule('../services/embeddingRouter.mjs', () => ({ ...mockEmbeddingRouter, default: mockEmbeddingRouter }));

jest.mock('../services/aiRouter', () => mockAiRouter);
jest.unstable_mockModule('../services/aiRouter', () => ({ ...mockAiRouter, default: mockAiRouter }));
jest.unstable_mockModule('../services/aiRouter.mjs', () => ({ ...mockAiRouter, default: mockAiRouter }));

jest.mock('../services/cloudLLM', () => mockCloudLLM);
jest.unstable_mockModule('../services/cloudLLM', () => ({ ...mockCloudLLM, default: mockCloudLLM }));
jest.unstable_mockModule('../services/cloudLLM.mjs', () => ({ ...mockCloudLLM, default: mockCloudLLM }));

jest.mock('../services/webhook', () => mockWebhook);
jest.unstable_mockModule('../services/webhook', () => ({ ...mockWebhook, default: mockWebhook }));
jest.unstable_mockModule('../services/webhook.mjs', () => ({ ...mockWebhook, default: mockWebhook }));

jest.mock('../services/scheduler', () => mockScheduler);
jest.unstable_mockModule('../services/scheduler', () => ({ ...mockScheduler, default: mockScheduler }));
jest.unstable_mockModule('../services/scheduler.mjs', () => ({ ...mockScheduler, default: mockScheduler }));

jest.mock('../services/providerLock', () => mockProviderLock);
jest.unstable_mockModule('../services/providerLock', () => ({ ...mockProviderLock, default: mockProviderLock }));
jest.unstable_mockModule('../services/providerLock.mjs', () => ({ ...mockProviderLock, default: mockProviderLock }));

jest.mock('../middleware/auth', () => mockAuth);
jest.unstable_mockModule('../middleware/auth', () => ({ ...mockAuth, default: mockAuth }));
jest.unstable_mockModule('../middleware/auth.mjs', () => ({ ...mockAuth, default: mockAuth }));

jest.mock('../utils/logger', () => mockLogger);
jest.unstable_mockModule('../utils/logger', () => ({ ...mockLogger, default: mockLogger }));
jest.unstable_mockModule('../utils/logger.mjs', () => ({ ...mockLogger, default: mockLogger }));

jest.mock('../utils/ragLoopConfig', () => mockRagLoopConfig);
jest.unstable_mockModule('../utils/ragLoopConfig', () => ({ ...mockRagLoopConfig, default: mockRagLoopConfig }));
jest.unstable_mockModule('../utils/ragLoopConfig.mjs', () => ({ ...mockRagLoopConfig, default: mockRagLoopConfig }));

const { createSettingsTestRouter } = await import('./setup/createSettingsTestRouter.js');

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
    app = express();
    app.use(express.json());
    app.use('/settings', settingsRouter);
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
