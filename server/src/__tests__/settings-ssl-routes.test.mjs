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
import { createMockModule, createNamedMockModule } from './helpers/mockFactory.mjs';

const mockDb = {
  query: jest.fn(),
  pool: {
    connect: jest.fn()
  }
};
jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));

const mockRadarr = {};
jest.unstable_mockModule('../services/radarr.mjs', () => createNamedMockModule('radarrService', mockRadarr));

const mockSonarr = {};
jest.unstable_mockModule('../services/sonarr.mjs', () => createNamedMockModule('sonarrService', mockSonarr));

const mockOllama = {};
jest.unstable_mockModule('../services/ollama.mjs', () => createNamedMockModule('ollamaService', mockOllama));

const mockTmdb = {};
jest.unstable_mockModule('../services/tmdb.mjs', () => createNamedMockModule('tmdbService', mockTmdb));

const mockTavily = {};
jest.unstable_mockModule('../services/tavily.mjs', () => createNamedMockModule('tavilyService', mockTavily));

const mockOmdb = {};
jest.unstable_mockModule('../services/omdb.mjs', () => createNamedMockModule('omdbService', mockOmdb));

const mockDiscordBot = {};
jest.unstable_mockModule('../services/discordBot.mjs', () => createNamedMockModule('discordBotService', mockDiscordBot));

const mockStartupService = {};
jest.unstable_mockModule('../services/startupService.mjs', () => createNamedMockModule('startupService', mockStartupService));

const mockPathTestService = {};
jest.unstable_mockModule('../services/pathTestService.mjs', () => createNamedMockModule('pathTestService', mockPathTestService));

const mockCloudLLM = {};
jest.unstable_mockModule('../services/cloudLLM.mjs', () => createNamedMockModule('cloudLLMService', mockCloudLLM));

const mockAiRouter = {};
jest.unstable_mockModule('../services/aiRouter.mjs', () => createNamedMockModule('aiRouterService', mockAiRouter));

const mockEmbeddingProvider = {};
jest.unstable_mockModule('../services/embeddingProvider.mjs', () => createNamedMockModule('embeddingProvider', mockEmbeddingProvider));

const mockEmbeddingRouter = {};
jest.unstable_mockModule('../services/embeddingRouter.mjs', () => createNamedMockModule('embeddingRouter', mockEmbeddingRouter));

const mockWebhook = {};
jest.unstable_mockModule('../services/webhook.mjs', () => createNamedMockModule('webhookService', mockWebhook));

const mockAuth = {
  authenticateToken: (req, res, next) => next(),
  requireAdmin: (req, res, next) => next()
};
jest.unstable_mockModule('../middleware/auth.mjs', () => createNamedMockModule('router', mockAuth));

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
  validateAndNormalizeRagLoopConfig: jest.fn(config => ({ normalizedConfig: config, warnings: [] }))
};
mockRagLoopConfig.RAG_LOOP_V1_KEYS = [];
jest.unstable_mockModule('../utils/ragLoopConfig.mjs', () => createNamedMockModule('DEFAULT_IDENTIFIER_CAPS', mockRagLoopConfig));

const db = mockDb;
const { createSettingsTestRouter } = await import('./setup/createSettingsTestRouter.mjs');

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
