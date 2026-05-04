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

const mockAxios = {
  post: jest.fn()
};

const mockDb = {
  query: jest.fn()
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

const mockDiscordBot = {};
jest.mock('../services/discordBot', () => mockDiscordBot);
jest.unstable_mockModule('../services/discordBot', () => ({ ...mockDiscordBot, default: mockDiscordBot }));
jest.unstable_mockModule('../services/discordBot.mjs', () => ({ ...mockDiscordBot, default: mockDiscordBot }));

const mockTavily = {};
jest.mock('../services/tavily', () => mockTavily);
jest.unstable_mockModule('../services/tavily', () => ({ ...mockTavily, default: mockTavily }));
jest.unstable_mockModule('../services/tavily.mjs', () => ({ ...mockTavily, default: mockTavily }));

const mockEmbeddingProvider = {};
jest.mock('../services/embeddingProvider', () => mockEmbeddingProvider);
jest.unstable_mockModule('../services/embeddingProvider', () => ({ ...mockEmbeddingProvider, default: mockEmbeddingProvider }));
jest.unstable_mockModule('../services/embeddingProvider.mjs', () => ({ ...mockEmbeddingProvider, default: mockEmbeddingProvider }));

const mockEmbeddingRouter = {};
jest.mock('../services/embeddingRouter', () => mockEmbeddingRouter);
jest.unstable_mockModule('../services/embeddingRouter', () => ({ ...mockEmbeddingRouter, default: mockEmbeddingRouter }));
jest.unstable_mockModule('../services/embeddingRouter.mjs', () => ({ ...mockEmbeddingRouter, default: mockEmbeddingRouter }));

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
  validateAndNormalizeRagLoopConfig: jest.fn(config => config)
};
jest.mock('../utils/ragLoopConfig', () => mockRagLoopConfig);
jest.unstable_mockModule('../utils/ragLoopConfig', () => ({ ...mockRagLoopConfig, default: mockRagLoopConfig }));
jest.unstable_mockModule('../utils/ragLoopConfig.mjs', () => ({ ...mockRagLoopConfig, default: mockRagLoopConfig }));

jest.mock('axios', () => ({
  ...mockAxios,
  default: mockAxios
}));
jest.unstable_mockModule('axios', () => ({ ...mockAxios, default: mockAxios }));

const axios = mockAxios;
const webhookService = mockWebhook;
const { createSettingsTestRouter } = await import('./setup/createSettingsTestRouter.js');

describe('Settings Webhook Routes', () => {
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
});
