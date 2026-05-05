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

jest.unstable_mockModule('../config/database.mjs', () => ({ ...mockDb, default: mockDb }));

jest.unstable_mockModule('../services/radarr.mjs', () => ({ ...mockRadarr, default: mockRadarr }));

jest.unstable_mockModule('../services/sonarr.mjs', () => ({ ...mockSonarr, default: mockSonarr }));

jest.unstable_mockModule('../services/ollama.mjs', () => ({ ...mockOllama, default: mockOllama }));

jest.unstable_mockModule('../services/tmdb.mjs', () => ({ ...mockTmdb, default: mockTmdb }));

jest.unstable_mockModule('../services/tavily.mjs', () => ({ ...mockTavily, default: mockTavily }));

jest.unstable_mockModule('../services/omdb.mjs', () => ({ ...mockOmdb, default: mockOmdb }));

jest.unstable_mockModule('../services/discordBot.mjs', () => ({ ...mockDiscordBot, default: mockDiscordBot }));

jest.unstable_mockModule('../services/startupService.mjs', () => ({ ...mockStartupService, default: mockStartupService }));

jest.unstable_mockModule('../services/pathTestService.mjs', () => ({ ...mockPathTestService, default: mockPathTestService }));

jest.unstable_mockModule('../config/runtimeSettings.mjs', () => ({ ...mockRuntimeSettings, default: mockRuntimeSettings }));

jest.unstable_mockModule('../services/embeddingProvider.mjs', () => ({ ...mockEmbeddingProvider, default: mockEmbeddingProvider }));

jest.unstable_mockModule('../services/embeddingRouter.mjs', () => ({ ...mockEmbeddingRouter, default: mockEmbeddingRouter }));

jest.unstable_mockModule('../services/aiRouter.mjs', () => ({ ...mockAiRouter, default: mockAiRouter }));

jest.unstable_mockModule('../services/cloudLLM.mjs', () => ({ ...mockCloudLLM, default: mockCloudLLM }));

jest.unstable_mockModule('../services/webhook.mjs', () => ({ ...mockWebhook, default: mockWebhook }));

jest.unstable_mockModule('../services/scheduler.mjs', () => ({ ...mockScheduler, default: mockScheduler }));

jest.unstable_mockModule('../services/providerLock.mjs', () => ({ ...mockProviderLock, default: mockProviderLock }));

jest.unstable_mockModule('../middleware/auth.mjs', () => ({ ...mockAuth, default: mockAuth }));

jest.unstable_mockModule('../utils/logger.mjs', () => ({ ...mockLogger, default: mockLogger }));

mockRagLoopConfig.RAG_LOOP_V1_KEYS = [];
jest.unstable_mockModule('../utils/ragLoopConfig.mjs', () => ({ ...mockRagLoopConfig, default: mockRagLoopConfig }));

const { createSettingsTestRouter } = await import('./setup/createSettingsTestRouter.mjs');

const providerLock = mockProviderLock;

describe('Settings provider lock route helpers', () => {
  let app;
  let settingsRouter;

  beforeAll(async () => {
    settingsRouter = await createSettingsTestRouter(express);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    providerLock.config = {
      heartbeatTimeout: 30000,
      heartbeatInterval: 5000,
      maxWaitTime: 120000
    };
    providerLock.getLockStatus.mockReturnValue({
      isLocked: false,
      lockedBy: null,
      config: { ...providerLock.config }
    });

    app = express();
    app.use(express.json());
    app.use('/settings', settingsRouter);
  });

  it('returns the in-memory heartbeat config from GET /settings/heartbeat', async () => {
    const res = await request(app).get('/settings/heartbeat').expect(200);

    expect(res.body).toEqual({
      heartbeat_timeout: 30000,
      heartbeat_interval: 5000,
      max_wait_time: 120000
    });
  });

  it('normalizes numeric strings for PUT /settings/heartbeat', async () => {
    const res = await request(app)
      .put('/settings/heartbeat')
      .send({
        heartbeat_timeout: '45000',
        heartbeat_interval: '8000',
        max_wait_time: '180000'
      })
      .expect(200);

    expect(providerLock.updateConfig).toHaveBeenCalledWith({
      heartbeatTimeout: 45000,
      heartbeatInterval: 8000,
      maxWaitTime: 180000
    });
    expect(res.body).toEqual({ success: true });
  });

  it('rejects non-numeric heartbeat values before they reach providerLock.updateConfig', async () => {
    const res = await request(app)
      .put('/settings/heartbeat')
      .send({
        heartbeat_timeout: 'abc'
      })
      .expect(400);

    expect(res.body).toEqual({ error: 'heartbeat_timeout must be an integer' });
    expect(providerLock.updateConfig).not.toHaveBeenCalled();
  });

  it('rejects heartbeat intervals that are not less than the final timeout', async () => {
    const res = await request(app)
      .put('/settings/heartbeat')
      .send({
        heartbeat_interval: 30000
      })
      .expect(400);

    expect(res.body).toEqual({ error: 'heartbeat_interval must be less than heartbeat_timeout' });
    expect(providerLock.updateConfig).not.toHaveBeenCalled();
  });

  it('returns the provider lock status from GET /settings/provider-lock/status', async () => {
    providerLock.getLockStatus.mockReturnValueOnce({
      isLocked: true,
      lockedBy: 'classification',
      config: { ...providerLock.config }
    });

    const res = await request(app).get('/settings/provider-lock/status').expect(200);

    expect(res.body).toMatchObject({
      isLocked: true,
      lockedBy: 'classification'
    });
  });
});
