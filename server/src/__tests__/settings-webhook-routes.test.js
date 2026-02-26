/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const request = require('supertest');
const express = require('express');
const axios = require('axios');

jest.mock('../config/database', () => ({
  query: jest.fn()
}));

jest.mock('../services/radarr', () => ({}));
jest.mock('../services/sonarr', () => ({}));
jest.mock('../services/ollama', () => ({}));
jest.mock('../services/tmdb', () => ({}));
jest.mock('../services/discordBot', () => ({}));
jest.mock('../services/tavily', () => ({}));
jest.mock('../services/embeddingProvider', () => ({}));
jest.mock('../services/embeddingRouter', () => ({}));
jest.mock('../services/startupService', () => ({}));
jest.mock('../services/pathTestService', () => ({}));
jest.mock('../services/cloudLLM', () => ({}));
jest.mock('../services/aiRouter', () => ({}));

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

jest.mock('axios', () => ({
  post: jest.fn()
}));

const webhookService = require('../services/webhook');
const settingsRouter = require('../routes/settings');

describe('Settings Webhook Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/settings', settingsRouter);
  });

  it('preserves the full secret when a masked webhook secret is submitted', async () => {
    webhookService.getFullSecret = jest.fn()
      .mockResolvedValueOnce('whsec_liveSecret1234')
      .mockResolvedValueOnce('whsec_liveSecret1234');
    webhookService.updateConfig = jest.fn().mockResolvedValue({
      enabled: true,
      secret_key: 'ignored'
    });

    const res = await request(app)
      .put('/settings/webhook')
      .send({
        enabled: true,
        secret_key: '••••••••1234'
      });

    expect(res.status).toBe(200);
    expect(webhookService.updateConfig).toHaveBeenCalledWith({
      enabled: true,
      secret_key: 'whsec_liveSecret1234'
    });
    expect(res.body.secret_key).toBe('••••••••1234');
  });

  it('does not overwrite stored secret when masked value is submitted but no full secret is available', async () => {
    webhookService.getFullSecret = jest.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    webhookService.updateConfig = jest.fn().mockResolvedValue({
      enabled: true
    });

    const res = await request(app)
      .put('/settings/webhook')
      .send({
        enabled: true,
        secret_key: '••••••••9999'
      });

    expect(res.status).toBe(200);
    expect(webhookService.updateConfig).toHaveBeenCalledWith({
      enabled: true
    });
    expect(res.body.secret_key).toBeUndefined();
  });

  it('builds webhook URL using decrypted full secret', async () => {
    webhookService.getFullSecret = jest.fn().mockResolvedValue('whsec_urlSecret');

    const res = await request(app).get('/settings/webhook/url');

    expect(res.status).toBe(200);
    expect(res.body.url).toContain('/api/webhook/overseerr');
    expect(res.body.url).toContain('?key=whsec_urlSecret');
  });

  it('uses decrypted full secret when sending test webhook', async () => {
    webhookService.getFullSecret = jest.fn().mockResolvedValue('whsec_testSecret');
    axios.post.mockResolvedValue({ data: { ok: true } });

    const res = await request(app).post('/settings/webhook/test').send({});

    expect(res.status).toBe(200);
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post.mock.calls[0][0]).toContain('/api/webhook/overseerr?key=whsec_testSecret');
  });
});
