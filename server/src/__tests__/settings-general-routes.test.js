/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

const request = require('supertest');
const express = require('express');

jest.mock('../config/database', () => ({
  query: jest.fn(),
  withTransaction: jest.fn(),
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

const db = require('../config/database');
const runtimeSettings = require('../config/runtimeSettings');
const settingsRouter = require('../routes/settings');

describe('Settings general/category route helpers', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    db.withTransaction.mockImplementation(async (fn) => fn({ query: db.query }));
    app = express();
    app.use(express.json());
    app.use('/settings', settingsRouter);
  });

  it('rejects array payloads for PUT /settings', async () => {
    const res = await request(app)
      .put('/settings')
      .send(['bad'])
      .expect(400);

    expect(res.body).toEqual({ error: 'Settings must be a valid object' });
    expect(db.query).not.toHaveBeenCalled();
    expect(runtimeSettings.refreshFromDatabase).not.toHaveBeenCalled();
  });

  it('loads queue category settings with coercion and defaults', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        { key: 'queue_worker_enabled', value: 'false' },
        { key: 'queue_concurrent_workers', value: '3' },
        { key: 'queue_retry_strategy', value: 'linear' },
        { key: 'queue_unknown_setting', value: 'ignored' }
      ]
    });

    const res = await request(app)
      .get('/settings/category/queue')
      .expect(200);

    expect(res.body).toEqual({
      workerEnabled: false,
      concurrentWorkers: 3,
      maxRetryAttempts: 5,
      retryStrategy: 'linear',
      autoDeleteCompleted: '7d',
      autoDeleteFailed: 'never'
    });
  });

  it('rejects array payloads for PUT /settings/category/:name', async () => {
    const res = await request(app)
      .put('/settings/category/queue')
      .send(['bad'])
      .expect(400);

    expect(res.body).toEqual({ error: 'Settings must be a valid object' });
    expect(db.query).not.toHaveBeenCalled();
  });

  it('returns the actual filtered update count for queue category writes', async () => {
    db.query.mockResolvedValue({ rows: [] });

    const res = await request(app)
      .put('/settings/category/queue')
      .send({
        workerEnabled: true,
        retryStrategy: 'linear',
        ignoredKey: 'skip-me'
      })
      .expect(200);

    expect(res.body).toEqual({
      success: true,
      category: 'queue',
      updated: 2
    });
    expect(db.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('INSERT INTO settings'),
      ['queue_worker_enabled', 'true']
    );
    expect(db.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO settings'),
      ['queue_retry_strategy', 'linear']
    );
    expect(runtimeSettings.refreshFromDatabase).toHaveBeenCalledTimes(1);
  });

  it('rolls back PUT /settings through db.withTransaction and skips runtime refresh on failure', async () => {
    db.withTransaction.mockImplementationOnce(async () => {
      throw new Error('settings write failed');
    });

    const res = await request(app)
      .put('/settings')
      .send({
        worker_enabled: 'true',
        max_retry_attempts: '5'
      })
      .expect(500);

    expect(res.body.error).toContain('settings write failed');
    expect(db.withTransaction).toHaveBeenCalledTimes(1);
    expect(runtimeSettings.refreshFromDatabase).not.toHaveBeenCalled();
  });

  it('rolls back PUT /settings/category/:name through db.withTransaction and skips runtime refresh on failure', async () => {
    db.withTransaction.mockImplementationOnce(async () => {
      throw new Error('category write failed');
    });

    const res = await request(app)
      .put('/settings/category/queue')
      .send({
        workerEnabled: true,
        retryStrategy: 'linear'
      })
      .expect(500);

    expect(res.body.error).toContain('category write failed');
    expect(db.withTransaction).toHaveBeenCalledTimes(1);
    expect(runtimeSettings.refreshFromDatabase).not.toHaveBeenCalled();
  });
});
