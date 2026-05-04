/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

const mockDb = {
  query: jest.fn(),
  pool: {
    connect: jest.fn()
  }
};
jest.mock('../config/database', () => mockDb);
jest.unstable_mockModule('../config/database', () => ({ ...mockDb, default: mockDb }));
jest.unstable_mockModule('../config/database.mjs', () => ({ ...mockDb, default: mockDb }));

const mockRadarr = {};
jest.mock('../services/radarr', () => mockRadarr);
jest.unstable_mockModule('../services/radarr', () => ({ ...mockRadarr, default: mockRadarr }));
jest.unstable_mockModule('../services/radarr.mjs', () => ({ ...mockRadarr, default: mockRadarr }));

const mockSonarr = {};
jest.mock('../services/sonarr', () => mockSonarr);
jest.unstable_mockModule('../services/sonarr', () => ({ ...mockSonarr, default: mockSonarr }));
jest.unstable_mockModule('../services/sonarr.mjs', () => ({ ...mockSonarr, default: mockSonarr }));

const mockOllama = {};
jest.mock('../services/ollama', () => mockOllama);
jest.unstable_mockModule('../services/ollama', () => ({ ...mockOllama, default: mockOllama }));
jest.unstable_mockModule('../services/ollama.mjs', () => ({ ...mockOllama, default: mockOllama }));

const mockTmdb = {};
jest.mock('../services/tmdb', () => mockTmdb);
jest.unstable_mockModule('../services/tmdb', () => ({ ...mockTmdb, default: mockTmdb }));
jest.unstable_mockModule('../services/tmdb.mjs', () => ({ ...mockTmdb, default: mockTmdb }));

const mockTavily = {};
jest.mock('../services/tavily', () => mockTavily);
jest.unstable_mockModule('../services/tavily', () => ({ ...mockTavily, default: mockTavily }));
jest.unstable_mockModule('../services/tavily.mjs', () => ({ ...mockTavily, default: mockTavily }));

const mockOmdb = {};
jest.mock('../services/omdb', () => mockOmdb);
jest.unstable_mockModule('../services/omdb', () => ({ ...mockOmdb, default: mockOmdb }));
jest.unstable_mockModule('../services/omdb.mjs', () => ({ ...mockOmdb, default: mockOmdb }));

const mockDiscordBot = {};
jest.mock('../services/discordBot', () => mockDiscordBot);
jest.unstable_mockModule('../services/discordBot', () => ({ ...mockDiscordBot, default: mockDiscordBot }));
jest.unstable_mockModule('../services/discordBot.mjs', () => ({ ...mockDiscordBot, default: mockDiscordBot }));

const mockStartupService = {};
jest.mock('../services/startupService', () => mockStartupService);
jest.unstable_mockModule('../services/startupService', () => ({ ...mockStartupService, default: mockStartupService }));
jest.unstable_mockModule('../services/startupService.mjs', () => ({ ...mockStartupService, default: mockStartupService }));

const mockPathTestService = {};
jest.mock('../services/pathTestService', () => mockPathTestService);
jest.unstable_mockModule('../services/pathTestService', () => ({ ...mockPathTestService, default: mockPathTestService }));
jest.unstable_mockModule('../services/pathTestService.mjs', () => ({ ...mockPathTestService, default: mockPathTestService }));

const mockCloudLLM = {};
jest.mock('../services/cloudLLM', () => mockCloudLLM);
jest.unstable_mockModule('../services/cloudLLM', () => ({ ...mockCloudLLM, default: mockCloudLLM }));
jest.unstable_mockModule('../services/cloudLLM.mjs', () => ({ ...mockCloudLLM, default: mockCloudLLM }));

const mockAiRouter = {};
jest.mock('../services/aiRouter', () => mockAiRouter);
jest.unstable_mockModule('../services/aiRouter', () => ({ ...mockAiRouter, default: mockAiRouter }));
jest.unstable_mockModule('../services/aiRouter.mjs', () => ({ ...mockAiRouter, default: mockAiRouter }));

const mockEmbeddingProvider = {};
jest.mock('../services/embeddingProvider', () => mockEmbeddingProvider);
jest.unstable_mockModule('../services/embeddingProvider', () => ({ ...mockEmbeddingProvider, default: mockEmbeddingProvider }));
jest.unstable_mockModule('../services/embeddingProvider.mjs', () => ({ ...mockEmbeddingProvider, default: mockEmbeddingProvider }));

const mockEmbeddingRouter = {};
jest.mock('../services/embeddingRouter', () => mockEmbeddingRouter);
jest.unstable_mockModule('../services/embeddingRouter', () => ({ ...mockEmbeddingRouter, default: mockEmbeddingRouter }));
jest.unstable_mockModule('../services/embeddingRouter.mjs', () => ({ ...mockEmbeddingRouter, default: mockEmbeddingRouter }));

const mockWebhook = {};
jest.mock('../services/webhook', () => mockWebhook);
jest.unstable_mockModule('../services/webhook', () => ({ ...mockWebhook, default: mockWebhook }));
jest.unstable_mockModule('../services/webhook.mjs', () => ({ ...mockWebhook, default: mockWebhook }));

const mockAuth = {
  authenticateToken: (req, res, next) => next(),
  requireAdmin: (req, res, next) => next()
};
jest.mock('../middleware/auth', () => mockAuth);
jest.unstable_mockModule('../middleware/auth', () => ({ ...mockAuth, default: mockAuth }));
jest.unstable_mockModule('../middleware/auth.mjs', () => ({ ...mockAuth, default: mockAuth }));

const mockLogger = {
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })
};
jest.mock('../utils/logger', () => mockLogger);
jest.unstable_mockModule('../utils/logger', () => ({ ...mockLogger, default: mockLogger }));
jest.unstable_mockModule('../utils/logger.mjs', () => ({ ...mockLogger, default: mockLogger }));

const mockRagLoopConfig = {
  getRagLoopDefaultConfig: jest.fn(() => ({})),
  validateAndNormalizeRagLoopConfig: jest.fn(config => ({ normalizedConfig: config, warnings: [] }))
};
jest.mock('../utils/ragLoopConfig', () => mockRagLoopConfig);
jest.unstable_mockModule('../utils/ragLoopConfig', () => ({ ...mockRagLoopConfig, default: mockRagLoopConfig }));
jest.unstable_mockModule('../utils/ragLoopConfig.mjs', () => ({ ...mockRagLoopConfig, default: mockRagLoopConfig }));

const db = mockDb;
const { createSettingsTestRouter } = await import('./setup/createSettingsTestRouter.js');

describe('Settings SSL Routes', () => {
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

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns default SSL settings when no row exists', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/settings/ssl');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      enabled: false,
      cert_path: '',
      key_path: '',
      ca_path: '',
      force_https: false,
      hsts_enabled: false,
      hsts_max_age: 31536000,
      client_cert_required: false
    });
  });

  it('preserves stored SSL fields on partial updates and normalizes invalid hsts_max_age', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{
          enabled: true,
          cert_path: '/certs/live.crt',
          key_path: '/certs/live.key',
          ca_path: '/certs/ca.pem',
          force_https: false,
          hsts_enabled: true,
          hsts_max_age: 86400,
          client_cert_required: true
        }]
      })
      .mockResolvedValueOnce({
        rows: [{
          enabled: true,
          cert_path: '/certs/live.crt',
          key_path: '/certs/live.key',
          ca_path: '/certs/ca.pem',
          force_https: true,
          hsts_enabled: true,
          hsts_max_age: 86400,
          client_cert_required: true
        }]
      });

    const res = await request(app)
      .put('/settings/ssl')
      .send({
        force_https: true,
        hsts_max_age: 'not-a-number'
      });

    expect(res.status).toBe(200);
    expect(db.query).toHaveBeenNthCalledWith(2,
      expect.stringContaining('INSERT INTO ssl_config'),
      [
        true,
        '/certs/live.crt',
        '/certs/live.key',
        '/certs/ca.pem',
        true,
        true,
        86400,
        true
      ]
    );
    expect(res.body).toMatchObject({
      force_https: true,
      cert_path: '/certs/live.crt',
      key_path: '/certs/live.key',
      ca_path: '/certs/ca.pem',
      hsts_max_age: 86400,
      requiresRestart: true
    });
  });

  it('returns the existing SSL test error shape when cert_path is missing', async () => {
    const res = await request(app)
      .post('/settings/ssl/test')
      .send({ key_path: '/certs/live.key' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      cert_exists: false,
      key_exists: false,
      ca_exists: true,
      valid: false,
      error: 'Certificate path is required'
    });
  });

  it('returns a 500 when fetching SSL config fails', async () => {
    db.query.mockRejectedValueOnce(new Error('db offline'));

    const res = await request(app).get('/settings/ssl');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'db offline' });
  });

  it('normalizes explicit empty paths to null on update', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          enabled: false,
          cert_path: null,
          key_path: null,
          ca_path: null,
          force_https: false,
          hsts_enabled: false,
          hsts_max_age: 31536000,
          client_cert_required: false
        }]
      });

    const res = await request(app)
      .put('/settings/ssl')
      .send({
        cert_path: '',
        key_path: '',
        ca_path: '',
        hsts_max_age: -1
      });

    expect(res.status).toBe(200);
    expect(db.query).toHaveBeenNthCalledWith(2,
      expect.stringContaining('INSERT INTO ssl_config'),
      [
        false,
        null,
        null,
        null,
        false,
        false,
        31536000,
        false
      ]
    );
  });

});
