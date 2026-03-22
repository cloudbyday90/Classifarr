/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const request = require('supertest');
const express = require('express');

jest.mock('../config/database', () => ({
  query: jest.fn(),
  pool: {
    connect: jest.fn()
  }
}));

jest.mock('../services/radarr', () => ({}));
jest.mock('../services/sonarr', () => ({}));
jest.mock('../services/ollama', () => ({}));
jest.mock('../services/tmdb', () => ({}));
jest.mock('../services/discordBot', () => ({}));
jest.mock('../services/embeddingProvider', () => ({}));
jest.mock('../services/embeddingRouter', () => ({}));
jest.mock('../services/pathTestService', () => ({}));
jest.mock('../services/cloudLLM', () => ({}));
jest.mock('../services/aiRouter', () => ({}));

jest.mock('../services/tavily', () => ({
  search: jest.fn(),
  testConnection: jest.fn(),
  checkHealth: jest.fn()
}));

jest.mock('../services/startupService', () => ({
  getSetupStatus: jest.fn(),
  setMediaPath: jest.fn(),
  checkMediaPathStatus: jest.fn()
}));

jest.mock('../config/runtimeSettings', () => ({
  refreshFromDatabase: jest.fn()
}));

jest.mock('../middleware/auth', () => ({
  authenticateToken: (req, res, next) => next(),
  requireAdmin: (req, res, next) => next()
}));

jest.mock('../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })
}));

jest.mock('../utils/ragLoopConfig', () => ({
  getRagLoopDefaultConfig: jest.fn(() => ({})),
  validateAndNormalizeRagLoopConfig: jest.fn(config => config),
  validateIssue275PayloadKeys: jest.fn(() => [])
}));

const db = require('../config/database');
const tavilyService = require('../services/tavily');
const startupService = require('../services/startupService');
const settingsRouter = require('../routes/settings');

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
