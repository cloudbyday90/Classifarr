/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

const mockDb = {
  query: jest.fn(),
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

const startupService = mockStartupService;

describe('Settings setup route helpers', () => {
  let app;
  let settingsRouter;

  beforeAll(async () => {
    settingsRouter = await createSettingsTestRouter(express);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/settings', settingsRouter);
  });

  it('delegates GET /settings/setup-status to startupService', async () => {
    startupService.getSetupStatus.mockResolvedValueOnce({
      status: 'incomplete',
      issues: []
    });

    const res = await request(app).get('/settings/setup-status').expect(200);

    expect(startupService.getSetupStatus).toHaveBeenCalledTimes(1);
    expect(res.body).toEqual({
      status: 'incomplete',
      issues: []
    });
  });

  it('rejects blank /settings/media-path values after trimming', async () => {
    const res = await request(app)
      .post('/settings/media-path')
      .send({ path: '   ' })
      .expect(400);

    expect(res.body).toEqual({ error: 'Path is required' });
    expect(startupService.setMediaPath).not.toHaveBeenCalled();
  });

  it('trims and saves /settings/media-path before checking status', async () => {
    startupService.checkMediaPathStatus.mockResolvedValueOnce({
      mediaPath: { status: 'configured', path: '/media' }
    });

    const res = await request(app)
      .post('/settings/media-path')
      .send({ path: '  /media  ' })
      .expect(200);

    expect(startupService.setMediaPath).toHaveBeenCalledWith('/media');
    expect(startupService.checkMediaPathStatus).toHaveBeenCalledTimes(1);
    expect(res.body).toEqual({
      mediaPath: { status: 'configured', path: '/media' }
    });
  });
});
