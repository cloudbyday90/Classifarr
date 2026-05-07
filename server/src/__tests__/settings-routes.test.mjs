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
import request from 'supertest';
import express from 'express';
import { createMockModule } from './helpers/mockFactory.mjs';

const mockDb = {
  query: jest.fn(),
  pool: {
    connect: jest.fn()
  }
};
jest.unstable_mockModule('../config/database.mjs', () => createMockModule(mockDb));

const mockRadarr = {};
jest.unstable_mockModule('../services/radarr.mjs', () => createMockModule(mockRadarr));

const mockSonarr = {};
jest.unstable_mockModule('../services/sonarr.mjs', () => createMockModule(mockSonarr));

const mockOllama = {};
jest.unstable_mockModule('../services/ollama.mjs', () => createMockModule(mockOllama));

const mockTmdb = {};
jest.unstable_mockModule('../services/tmdb.mjs', () => createMockModule(mockTmdb));

const mockDiscordBot = {};
jest.unstable_mockModule('../services/discordBot.mjs', () => createMockModule(mockDiscordBot));

const mockEmbeddingProvider = {};
jest.unstable_mockModule('../services/embeddingProvider.mjs', () => createMockModule(mockEmbeddingProvider));

const mockEmbeddingRouter = {};
jest.unstable_mockModule('../services/embeddingRouter.mjs', () => createMockModule(mockEmbeddingRouter));

const mockPathTestService = {};
jest.unstable_mockModule('../services/pathTestService.mjs', () => createMockModule(mockPathTestService));

const mockCloudLLM = {};
jest.unstable_mockModule('../services/cloudLLM.mjs', () => createMockModule(mockCloudLLM));

const mockAiRouter = {};
jest.unstable_mockModule('../services/aiRouter.mjs', () => createMockModule(mockAiRouter));

const mockTavily = {
  search: jest.fn(),
  testConnection: jest.fn(),
  checkHealth: jest.fn()
};
jest.unstable_mockModule('../services/tavily.mjs', () => createMockModule(mockTavily));

const mockStartupService = {
  getSetupStatus: jest.fn(),
  setMediaPath: jest.fn(),
  checkMediaPathStatus: jest.fn()
};
jest.unstable_mockModule('../services/startupService.mjs', () => createMockModule(mockStartupService));

const mockRuntimeSettings = {
  refreshFromDatabase: jest.fn()
};
jest.unstable_mockModule('../config/runtimeSettings.mjs', () => createMockModule(mockRuntimeSettings));

const mockAuth = {
  authenticateToken: (req, res, next) => next(),
  requireAdmin: (req, res, next) => next()
};
jest.unstable_mockModule('../middleware/auth.mjs', () => createMockModule(mockAuth));

const mockLogger = {
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })
};
jest.unstable_mockModule('../utils/logger.mjs', () => createMockModule(mockLogger));

const mockRagLoopConfig = {
  getRagLoopDefaultConfig: jest.fn(() => ({})),
  validateAndNormalizeRagLoopConfig: jest.fn(config => config)
};
mockRagLoopConfig.RAG_LOOP_V1_KEYS = [];
jest.unstable_mockModule('../utils/ragLoopConfig.mjs', () => createMockModule(mockRagLoopConfig));

const db = mockDb;
const tavilyService = mockTavily;
const startupService = mockStartupService;
const { createSettingsTestRouter } = await import('./setup/createSettingsTestRouter.mjs');

function countRouteHandlers(router, path, method) {
  return router.stack.filter(layer =>
    layer.route &&
    layer.route.path === path &&
    layer.route.methods &&
    layer.route.methods[method]
  ).length;
}

describe('Settings Routes', () => {
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

  it('registers only one handler for the deduplicated settings routes', () => {
    expect(countRouteHandlers(settingsRouter, '/setup-status', 'get')).toBe(1);
    expect(countRouteHandlers(settingsRouter, '/tavily', 'get')).toBe(1);
    expect(countRouteHandlers(settingsRouter, '/tavily', 'put')).toBe(1);
    expect(countRouteHandlers(settingsRouter, '/tavily/test', 'post')).toBe(1);
    expect(countRouteHandlers(settingsRouter, '/tavily/search', 'post')).toBe(1);
  });

  it('uses startupService for GET /settings/setup-status', async () => {
    const payload = {
      status: 'incomplete',
      reclassificationEnabled: false,
      mapping: { status: 'incomplete' },
      mediaPath: { status: 'not_configured' },
      issues: [{ type: 'media_path', message: 'Missing media path' }]
    };
    startupService.getSetupStatus.mockResolvedValue(payload);

    const res = await request(app).get('/settings/setup-status');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(payload);
    expect(startupService.getSetupStatus).toHaveBeenCalledTimes(1);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('uses the stored Tavily API key for /settings/tavily/search when the request sends a masked value', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ api_key: 'live-tavily-key' }] })
      .mockResolvedValueOnce({
        rows: [{
          search_depth: 'advanced',
          max_results: 7,
          include_domains: ['imdb.com', 'rottentomatoes.com'],
          exclude_domains: ['example.com']
        }]
      });
    tavilyService.search.mockResolvedValue({ results: [] });

    const res = await request(app)
      .post('/settings/tavily/search')
      .send({
        query: 'blade runner parental guide',
        api_key: '••••••••-masked'
      });

    expect(res.status).toBe(200);
    expect(tavilyService.search).toHaveBeenCalledWith('blade runner parental guide', {
      apiKey: 'live-tavily-key',
      searchDepth: 'advanced',
      maxResults: 7,
      includeDomains: ['imdb.com', 'rottentomatoes.com'],
      excludeDomains: ['example.com']
    });
  });
});
