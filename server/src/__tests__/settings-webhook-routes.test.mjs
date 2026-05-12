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
import { createMockModule, createNamedMockModule, createPassThroughAuthMock} from './helpers/mockFactory.mjs';
import { createSettingsTestApp } from './helpers/setupRouteTest.mjs';

const mockHttpGet = jest.fn();
const mockHttpPost = jest.fn();
const mockHttpPut = jest.fn();
jest.unstable_mockModule('../utils/httpClient.mjs', () => ({
  httpGet: mockHttpGet,
  httpPost: mockHttpPost,
  httpPut: mockHttpPut,
  httpDelete: jest.fn(),
  httpGetBinary: jest.fn(),
  httpStream: jest.fn(),
  createHttpClient: jest.fn(),
  defaultHttpClient: { get: mockHttpGet, post: mockHttpPost, put: mockHttpPut, delete: jest.fn() },
}));const mockDb = {
  query: jest.fn()
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

const mockDiscordBot = {};
jest.unstable_mockModule('../services/discordBot.mjs', () => createNamedMockModule('discordBotService', mockDiscordBot));

const mockTavily = {};
jest.unstable_mockModule('../services/tavily.mjs', () => createNamedMockModule('tavilyService', mockTavily));

const mockEmbeddingProvider = {};
jest.unstable_mockModule('../services/embeddingProvider.mjs', () => createNamedMockModule('embeddingProvider', mockEmbeddingProvider));

const mockEmbeddingRouter = {};
jest.unstable_mockModule('../services/embeddingRouter.mjs', () => createNamedMockModule('embeddingRouter', mockEmbeddingRouter));

const mockStartupService = {};
jest.unstable_mockModule('../services/startupService.mjs', () => createNamedMockModule('startupService', mockStartupService));

const mockPathTestService = {};
jest.unstable_mockModule('../services/pathTestService.mjs', () => createNamedMockModule('pathTestService', mockPathTestService));

const mockCloudLLM = {};
jest.unstable_mockModule('../services/cloudLLM.mjs', () => createNamedMockModule('cloudLLMService', mockCloudLLM));

const mockAiRouter = {};
jest.unstable_mockModule('../services/aiRouter.mjs', () => createNamedMockModule('aiRouterService', mockAiRouter));

const mockWebhook = {};
jest.unstable_mockModule('../services/webhook.mjs', () => createNamedMockModule('webhookService', mockWebhook));

const mockAuth = {
  authenticateToken: (req, res, next) => next(),
  requireAdmin: (req, res, next) => next()
};
jest.unstable_mockModule('../middleware/auth.mjs', () => createPassThroughAuthMock());

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
jest.unstable_mockModule('../utils/ragLoopConfig.mjs', () => createNamedMockModule('DEFAULT_IDENTIFIER_CAPS', mockRagLoopConfig));

const webhookService = mockWebhook;
const { createSettingsTestRouter } = await import('./setup/createSettingsTestRouter.mjs');
const settingsRouter = createSettingsTestRouter(express);

describe('Settings Webhook Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createSettingsTestApp(settingsRouter);
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
    mockHttpPost.mockResolvedValue({ data: { ok: true } });

    const res = await request(app).post('/settings/webhook/test').send({});

    expect(res.status).toBe(200);
    expect(mockHttpPost).toHaveBeenCalledTimes(1);
    expect(mockHttpPost.mock.calls[0][0]).toContain('/api/webhook/overseerr?key=whsec_testSecret');
  });

  it('returns the custom failure payload when sending test webhook fails', async () => {
    webhookService.getFullSecret = jest.fn().mockResolvedValue('whsec_testSecret');
    mockHttpPost.mockRejectedValue({
      message: 'webhook probe failed',
      response: { data: { code: 'forbidden' } },
    });

    const res = await request(app).post('/settings/webhook/test').send({});

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      success: false,
      error: 'webhook probe failed',
      details: { code: 'forbidden' },
    });
  });

  it('does not pass masked secret values through on PUT /settings/webhook/configs/:id', async () => {
    webhookService.updateConfigById = jest.fn().mockResolvedValue({
      id: 7,
      name: 'Jellyseerr',
      secret_key: '••••••••9876',
      enabled: true
    });

    const res = await request(app)
      .put('/settings/webhook/configs/7')
      .send({
        name: 'Jellyseerr',
        secret_key: '••••••••9876',
        enabled: true
      });

    expect(res.status).toBe(200);
    expect(webhookService.updateConfigById).toHaveBeenCalledWith(7, {
      name: 'Jellyseerr',
      enabled: true
    });
    expect(res.body.secret_key).toBe('••••••••9876');
  });

  it('passes empty webhook secret through so the service can clear it', async () => {
    webhookService.getFullSecret = jest.fn().mockResolvedValue(null);
    webhookService.updateConfig = jest.fn().mockResolvedValue({
      enabled: true,
      secret_key: ''
    });

    const res = await request(app)
      .put('/settings/webhook')
      .send({
        enabled: true,
        secret_key: ''
      });

    expect(res.status).toBe(200);
    expect(webhookService.updateConfig).toHaveBeenCalledWith({
      enabled: true,
      secret_key: ''
    });
    expect(res.body.secret_key).toBe('');
  });

  it('passes empty webhook config secret through by id so the service can clear it', async () => {
    webhookService.updateConfigById = jest.fn().mockResolvedValue({
      id: 7,
      name: 'Jellyseerr',
      secret_key: '',
      enabled: true
    });

    const res = await request(app)
      .put('/settings/webhook/configs/7')
      .send({
        name: 'Jellyseerr',
        secret_key: '',
        enabled: true
      });

    expect(res.status).toBe(200);
    expect(webhookService.updateConfigById).toHaveBeenCalledWith(7, {
      name: 'Jellyseerr',
      secret_key: '',
      enabled: true
    });
    expect(res.body.secret_key).toBe('');
  });

  it('rejects invalid webhook config ids before calling the service', async () => {
    webhookService.getConfigById = jest.fn();

    const res = await request(app).get('/settings/webhook/configs/not-a-number');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid configuration id' });
    expect(webhookService.getConfigById).not.toHaveBeenCalled();
  });

  it('returns 404 when a webhook config id is well-formed but missing', async () => {
    webhookService.getConfigById = jest.fn().mockResolvedValue(null);

    const res = await request(app).get('/settings/webhook/configs/99');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Configuration not found' });
    expect(webhookService.getConfigById).toHaveBeenCalledWith(99);
  });

  it('sets a webhook config as primary through /settings/webhook/configs/:id/primary', async () => {
    webhookService.setPrimaryConfig = jest.fn().mockResolvedValue({
      id: 7,
      name: 'Jellyseerr',
      secret_key: '••••••••9876',
      enabled: true,
      is_primary: true,
    });

    const res = await request(app).post('/settings/webhook/configs/7/primary');

    expect(res.status).toBe(200);
    expect(webhookService.setPrimaryConfig).toHaveBeenCalledWith(7);
    expect(res.body).toMatchObject({
      id: 7,
      is_primary: true,
    });
  });

  it('returns the custom 400 payload when webhook deletion fails', async () => {
    webhookService.deleteConfig = jest.fn().mockRejectedValue(
      new Error('Cannot delete the only webhook configuration')
    );

    const res = await request(app).delete('/settings/webhook/configs/7');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'Cannot delete the only webhook configuration',
    });
  });
});
