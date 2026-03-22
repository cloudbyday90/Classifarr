/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
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
jest.mock('../services/tavily', () => ({}));
jest.mock('../services/omdb', () => ({}));
jest.mock('../services/discordBot', () => ({}));
jest.mock('../services/startupService', () => ({}));
jest.mock('../services/pathTestService', () => ({}));
jest.mock('../services/cloudLLM', () => ({}));
jest.mock('../services/aiRouter', () => ({}));
jest.mock('../services/embeddingProvider', () => ({}));
jest.mock('../services/embeddingRouter', () => ({}));
jest.mock('../services/webhook', () => ({}));

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
  validateAndNormalizeRagLoopConfig: jest.fn(config => ({ normalizedConfig: config, warnings: [] })),
  validateIssue275PayloadKeys: jest.fn(() => ({ valid: true, unknownKeys: [], disallowedKeys: [] }))
}));

const db = require('../config/database');
const settingsRouter = require('../routes/settings');

describe('Settings SSL Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/settings', settingsRouter);
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
});
