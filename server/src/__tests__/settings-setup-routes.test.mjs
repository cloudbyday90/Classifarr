/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { createMockModule } from './helpers/mockFactory.mjs';

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

jest.unstable_mockModule('../config/database.mjs', () => createMockModule(mockDb));

jest.unstable_mockModule('../services/radarr.mjs', () => createMockModule(mockRadarr));

jest.unstable_mockModule('../services/sonarr.mjs', () => createMockModule(mockSonarr));

jest.unstable_mockModule('../services/ollama.mjs', () => createMockModule(mockOllama));

jest.unstable_mockModule('../services/tmdb.mjs', () => createMockModule(mockTmdb));

jest.unstable_mockModule('../services/tavily.mjs', () => createMockModule(mockTavily));

jest.unstable_mockModule('../services/omdb.mjs', () => createMockModule(mockOmdb));

jest.unstable_mockModule('../services/discordBot.mjs', () => createMockModule(mockDiscordBot));

jest.unstable_mockModule('../services/startupService.mjs', () => createMockModule(mockStartupService));

jest.unstable_mockModule('../services/pathTestService.mjs', () => createMockModule(mockPathTestService));

jest.unstable_mockModule('../config/runtimeSettings.mjs', () => createMockModule(mockRuntimeSettings));

jest.unstable_mockModule('../services/embeddingProvider.mjs', () => createMockModule(mockEmbeddingProvider));

jest.unstable_mockModule('../services/embeddingRouter.mjs', () => createMockModule(mockEmbeddingRouter));

jest.unstable_mockModule('../services/aiRouter.mjs', () => createMockModule(mockAiRouter));

jest.unstable_mockModule('../services/cloudLLM.mjs', () => createMockModule(mockCloudLLM));

jest.unstable_mockModule('../services/webhook.mjs', () => createMockModule(mockWebhook));

jest.unstable_mockModule('../services/scheduler.mjs', () => createMockModule(mockScheduler));

jest.unstable_mockModule('../services/providerLock.mjs', () => createMockModule(mockProviderLock));

jest.unstable_mockModule('../middleware/auth.mjs', () => createMockModule(mockAuth));

jest.unstable_mockModule('../utils/logger.mjs', () => createMockModule(mockLogger));

mockRagLoopConfig.RAG_LOOP_V1_KEYS = [];
jest.unstable_mockModule('../utils/ragLoopConfig.mjs', () => createMockModule(mockRagLoopConfig));

const { createSettingsTestRouter } = await import('./setup/createSettingsTestRouter.mjs');

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
