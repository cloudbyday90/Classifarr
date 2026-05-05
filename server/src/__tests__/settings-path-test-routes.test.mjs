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
jest.unstable_mockModule('../config/database.mjs', () => ({ ...mockDb, default: mockDb }));

const mockRadarr = {};
jest.unstable_mockModule('../services/radarr.mjs', () => ({ ...mockRadarr, default: mockRadarr }));

const mockSonarr = {};
jest.unstable_mockModule('../services/sonarr.mjs', () => ({ ...mockSonarr, default: mockSonarr }));

const mockOllama = {
  resetConfig: jest.fn(),
};
jest.unstable_mockModule('../services/ollama.mjs', () => ({ ...mockOllama, default: mockOllama }));

const mockTmdb = {
  testConnection: jest.fn(),
  checkHealth: jest.fn(),
};
jest.unstable_mockModule('../services/tmdb.mjs', () => ({ ...mockTmdb, default: mockTmdb }));

const mockTavily = {
  search: jest.fn(),
  testConnection: jest.fn(),
  checkHealth: jest.fn(),
};
jest.unstable_mockModule('../services/tavily.mjs', () => ({ ...mockTavily, default: mockTavily }));

const mockOmdb = {
  testConnection: jest.fn(),
  checkHealth: jest.fn(),
  getByTitle: jest.fn(),
};
jest.unstable_mockModule('../services/omdb.mjs', () => ({ ...mockOmdb, default: mockOmdb }));

const mockDiscordBot = {};
jest.unstable_mockModule('../services/discordBot.mjs', () => ({ ...mockDiscordBot, default: mockDiscordBot }));

const mockStartupService = {
  getSetupStatus: jest.fn(),
  setMediaPath: jest.fn(),
  checkMediaPathStatus: jest.fn(),
};
jest.unstable_mockModule('../services/startupService.mjs', () => ({ ...mockStartupService, default: mockStartupService }));

const mockPathTestService = {
  testPathAccessibility: jest.fn(),
  testPathTranslation: jest.fn(),
  testAllMappings: jest.fn(),
  healthCheck: jest.fn(),
  getMediaPathConfig: jest.fn(),
};
jest.unstable_mockModule('../services/pathTestService.mjs', () => ({ ...mockPathTestService, default: mockPathTestService }));

const mockEmbeddingProvider = {
  resetConfig: jest.fn(),
};
jest.unstable_mockModule('../services/embeddingProvider.mjs', () => ({ ...mockEmbeddingProvider, default: mockEmbeddingProvider }));

const mockEmbeddingRouter = {
  resetConfig: jest.fn(),
  clearCache: jest.fn(),
};
jest.unstable_mockModule('../services/embeddingRouter.mjs', () => ({ ...mockEmbeddingRouter, default: mockEmbeddingRouter }));

const mockAiRouter = {
  clearCache: jest.fn(),
  getStatus: jest.fn(),
};
jest.unstable_mockModule('../services/aiRouter.mjs', () => ({ ...mockAiRouter, default: mockAiRouter }));

const mockCloudLLM = {
  testConnection: jest.fn(),
  getModels: jest.fn(),
  resetMonthlyUsage: jest.fn(),
};
jest.unstable_mockModule('../services/cloudLLM.mjs', () => ({ ...mockCloudLLM, default: mockCloudLLM }));

const mockWebhook = {};
jest.unstable_mockModule('../services/webhook.mjs', () => ({ ...mockWebhook, default: mockWebhook }));

const mockScheduler = {
  runGapAnalysis: jest.fn().mockResolvedValue(undefined),
};
jest.unstable_mockModule('../services/scheduler.mjs', () => ({ ...mockScheduler, default: mockScheduler }));

const mockAuth = {
  authenticateToken: (req, res, next) => next(),
  requireAdmin: (req, res, next) => next(),
};
jest.unstable_mockModule('../middleware/auth.mjs', () => ({ ...mockAuth, default: mockAuth }));

const mockLogger = {
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })
};
jest.unstable_mockModule('../utils/logger.mjs', () => ({ ...mockLogger, default: mockLogger }));

const mockRagLoopConfig = {
  getRagLoopDefaultConfig: jest.fn(() => ({})),
  validateAndNormalizeRagLoopConfig: jest.fn(config => ({ normalizedConfig: config, warnings: [] })),
};
mockRagLoopConfig.RAG_LOOP_V1_KEYS = [];
jest.unstable_mockModule('../utils/ragLoopConfig.mjs', () => ({ ...mockRagLoopConfig, default: mockRagLoopConfig }));

const pathTestService = mockPathTestService;
const { createSettingsTestRouter } = await import('./setup/createSettingsTestRouter.mjs');

describe('Settings path test route helpers', () => {
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

  it('rejects empty POST /settings/path-test requests', async () => {
    const res = await request(app)
      .post('/settings/path-test')
      .send({})
      .expect(400);

    expect(res.body).toEqual({ error: 'Path is required' });
    expect(pathTestService.testPathAccessibility).not.toHaveBeenCalled();
  });

  it('passes the translation payload through /settings/path-test/translation', async () => {
    pathTestService.testPathTranslation.mockResolvedValueOnce({ success: true });

    const payload = {
      plexPath: '/plex',
      arrPath: '/arr',
      classiflarrPath: '/classifarr',
      sampleFile: 'Movie/file.mkv'
    };

    const res = await request(app)
      .post('/settings/path-test/translation')
      .send(payload)
      .expect(200);

    expect(pathTestService.testPathTranslation).toHaveBeenCalledWith(payload);
    expect(res.body).toEqual({ success: true });
  });

  it('rejects invalid media server ids for /settings/path-test/mappings/:mediaServerId', async () => {
    const res = await request(app)
      .get('/settings/path-test/mappings/not-a-number')
      .expect(400);

    expect(res.body).toEqual({ error: 'mediaServerId must be a positive integer' });
    expect(pathTestService.testAllMappings).not.toHaveBeenCalled();
  });

  it('passes parsed media server ids through /settings/path-test/mappings/:mediaServerId', async () => {
    pathTestService.testAllMappings.mockResolvedValueOnce({ mappings: [] });

    const res = await request(app)
      .get('/settings/path-test/mappings/42')
      .expect(200);

    expect(pathTestService.testAllMappings).toHaveBeenCalledWith(42);
    expect(res.body).toEqual({ mappings: [] });
  });

  it('delegates /settings/path-test/health and /settings/media-path-config', async () => {
    pathTestService.healthCheck.mockResolvedValueOnce({ status: 'ok' });
    pathTestService.getMediaPathConfig.mockResolvedValueOnce({ configured: true });

    const healthRes = await request(app).get('/settings/path-test/health').expect(200);
    const configRes = await request(app).get('/settings/media-path-config').expect(200);

    expect(healthRes.body).toEqual({ status: 'ok' });
    expect(configRes.body).toEqual({ configured: true });
  });
});
