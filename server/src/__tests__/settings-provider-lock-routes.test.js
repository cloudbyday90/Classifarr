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
  validateIssue275PayloadKeys: jest.fn(() => ({ valid: true, unknownKeys: [], disallowedKeys: [] })),
}));

const providerLock = require('../services/providerLock');
const settingsRouter = require('../routes/settings');

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
