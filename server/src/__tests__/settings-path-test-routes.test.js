/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

const request = require('supertest');
const express = require('express');

jest.mock('../config/database', () => ({
  query: jest.fn(),
  pool: {
    connect: jest.fn(),
  },
}));

jest.mock('../services/radarr', () => ({}));
jest.mock('../services/sonarr', () => ({}));
jest.mock('../services/ollama', () => ({
  resetConfig: jest.fn(),
}));
jest.mock('../services/tmdb', () => ({
  testConnection: jest.fn(),
  checkHealth: jest.fn(),
}));
jest.mock('../services/tavily', () => ({
  search: jest.fn(),
  testConnection: jest.fn(),
  checkHealth: jest.fn(),
}));
jest.mock('../services/omdb', () => ({
  testConnection: jest.fn(),
  checkHealth: jest.fn(),
  getByTitle: jest.fn(),
}));
jest.mock('../services/discordBot', () => ({}));
jest.mock('../services/startupService', () => ({
  getSetupStatus: jest.fn(),
  setMediaPath: jest.fn(),
  checkMediaPathStatus: jest.fn(),
}));
jest.mock('../services/pathTestService', () => ({
  testPathAccessibility: jest.fn(),
  testPathTranslation: jest.fn(),
  testAllMappings: jest.fn(),
  healthCheck: jest.fn(),
  getMediaPathConfig: jest.fn(),
}));
jest.mock('../services/embeddingProvider', () => ({
  resetConfig: jest.fn(),
}));
jest.mock('../services/embeddingRouter', () => ({
  resetConfig: jest.fn(),
  clearCache: jest.fn(),
}));
jest.mock('../services/aiRouter', () => ({
  clearCache: jest.fn(),
  getStatus: jest.fn(),
}));
jest.mock('../services/cloudLLM', () => ({
  testConnection: jest.fn(),
  getModels: jest.fn(),
  resetMonthlyUsage: jest.fn(),
}));
jest.mock('../services/webhook', () => ({}));
jest.mock('../services/scheduler', () => ({
  runGapAnalysis: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../middleware/auth', () => ({
  authenticateToken: (req, res, next) => next(),
  requireAdmin: (req, res, next) => next(),
}));

jest.mock('../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })
}));

jest.mock('../utils/ragLoopConfig', () => ({
  getRagLoopDefaultConfig: jest.fn(() => ({})),
  validateAndNormalizeRagLoopConfig: jest.fn(config => ({ normalizedConfig: config, warnings: [] })),
}));

const pathTestService = require('../services/pathTestService');
const { createSettingsTestRouter } = require('./setup/createSettingsTestRouter');

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
