/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { createMockModule, createNamedMockModule, createPassThroughAuthMock} from './helpers/mockFactory.mjs';
import { createSettingsTestApp } from './helpers/setupRouteTest.mjs';

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

jest.unstable_mockModule('../middleware/auth.mjs', () => createPassThroughAuthMock());

jest.unstable_mockModule('../utils/logger.mjs', () => createMockModule(mockLogger));

mockRagLoopConfig.RAG_LOOP_V1_KEYS = [];
jest.unstable_mockModule('../utils/ragLoopConfig.mjs', () => createNamedMockModule('DEFAULT_IDENTIFIER_CAPS', mockRagLoopConfig));

const { createSettingsTestRouter } = await import('./setup/createSettingsTestRouter.mjs');

const providerLock = mockProviderLock;
const settingsRouter = createSettingsTestRouter(express);

describe('Settings provider lock route helpers', () => {
  let app;

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

    app = createSettingsTestApp(settingsRouter);
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
