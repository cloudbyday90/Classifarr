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
jest.mock('../config/runtimeSettings', () => ({
  refreshFromDatabase: jest.fn(),
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
jest.mock('../services/providerLock', () => ({
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

const startupService = require('../services/startupService');
const { createSettingsTestRouter } = require('./setup/createSettingsTestRouter');

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
