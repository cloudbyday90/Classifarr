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
import { createMockModule, createNamedMockModule, createPassThroughAuthMock, createTransactionalDbMock } from './helpers/mockFactory.mjs';
import { createSettingsTestApp } from './helpers/setupRouteTest.mjs';

const mockDb = createTransactionalDbMock();
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

const mockDiscordBot = {
  reinitialize: jest.fn(),
  testConnection: jest.fn(),
  getServers: jest.fn(),
  getChannels: jest.fn(),
  getChannelDetails: jest.fn()
};
jest.unstable_mockModule('../services/discordBot.mjs', () => createNamedMockModule('discordBotService', mockDiscordBot));

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
  validateAndNormalizeRagLoopConfig: jest.fn(config => ({ normalizedConfig: config, warnings: [] }))
};
mockRagLoopConfig.RAG_LOOP_V1_KEYS = [];
jest.unstable_mockModule('../utils/ragLoopConfig.mjs', () => createNamedMockModule('DEFAULT_IDENTIFIER_CAPS', mockRagLoopConfig));

const db = mockDb;
const discordBotService = mockDiscordBot;
const { createSettingsTestRouter } = await import('./setup/createSettingsTestRouter.mjs');
const settingsRouter = createSettingsTestRouter(express);

describe('Settings Discord Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockReset();
    db.pool.connect.mockReset();
    discordBotService.reinitialize.mockReset();
    discordBotService.testConnection.mockReset();
    discordBotService.getServers.mockReset();
    discordBotService.getChannels.mockReset();
    discordBotService.getChannelDetails.mockReset();
    app = createSettingsTestApp(settingsRouter);
  });

  it('masks the stored Discord bot token on GET /settings/notifications', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{
        type: 'discord',
        bot_token: 'discord_live_token_1234',
        channel_id: 'channel-1',
        enabled: true
      }]
    });

    const res = await request(app).get('/settings/notifications');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      type: 'discord',
      channel_id: 'channel-1',
      enabled: true
    });
    expect(res.body.bot_token).not.toBe('discord_live_token_1234');
    expect(res.body.bot_token).toContain('1234');
  });

  it('preserves stored channel and flags on partial masked updates to /settings/notifications', async () => {
    const client = {
      query: jest.fn(),
      release: jest.fn()
    };
    db.pool.connect.mockResolvedValue(client);

    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rows: [{
          bot_token: 'discord_live_token_1234',
          channel_id: 'channel-1',
          enabled: false,
          notify_on_classification: true,
          notify_on_error: false,
          notify_on_correction: true,
          show_poster: false,
          show_confidence: true,
          show_method: true,
          show_reason: false,
          show_metadata: true,
          enable_corrections: false,
          correction_buttons_count: 5,
          include_library_dropdown: false
        }]
      })
      .mockResolvedValueOnce({
        rows: [{
          bot_token: 'discord_live_token_1234',
          channel_id: 'channel-1',
          enabled: true,
          notify_on_classification: true,
          notify_on_error: false,
          notify_on_correction: true,
          show_poster: false,
          show_confidence: true,
          show_method: true,
          show_reason: false,
          show_metadata: true,
          enable_corrections: false,
          correction_buttons_count: 5,
          include_library_dropdown: false
        }]
      })
      .mockResolvedValueOnce({});

    const res = await request(app)
      .put('/settings/notifications')
      .send({
        bot_token: '••••••••1234',
        enabled: true
      });

    expect(res.status).toBe(200);
    expect(client.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('INSERT INTO notification_config'),
      [
        'discord_live_token_1234',
        'channel-1',
        true,
        true,
        false,
        true,
        false,
        true,
        true,
        false,
        true,
        false,
        5,
        false,
        true   // notify_on_system_errors — defaults to true when not in existing row
      ]
    );
    expect(discordBotService.reinitialize).toHaveBeenCalledTimes(1);
    expect(res.body.bot_token).not.toBe('discord_live_token_1234');
    expect(res.body.bot_token).toContain('1234');
  });

  it('clears the stored Discord bot token when empty string is submitted', async () => {
    const client = {
      query: jest.fn(),
      release: jest.fn()
    };
    db.pool.connect.mockResolvedValue(client);

    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rows: [{
          bot_token: 'discord_live_token_1234',
          channel_id: 'channel-1',
          enabled: true
        }]
      })
      .mockResolvedValueOnce({
        rows: [{
          bot_token: '',
          channel_id: 'channel-1',
          enabled: true
        }]
      })
      .mockResolvedValueOnce({});

    const res = await request(app)
      .put('/settings/notifications')
      .send({
        bot_token: '',
        enabled: true
      });

    expect(res.status).toBe(200);
    expect(client.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('INSERT INTO notification_config'),
      expect.arrayContaining(['', 'channel-1', true])
    );
    expect(discordBotService.reinitialize).not.toHaveBeenCalled();
    expect(res.body.bot_token).toBe('');
  });

  it('uses the stored Discord token for /settings/discord/test when the request omits bot_token', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{
        type: 'discord',
        bot_token: 'discord_live_token_1234'
      }]
    });
    discordBotService.testConnection.mockResolvedValueOnce({ success: true });

    const res = await request(app)
      .post('/settings/discord/test')
      .send({ channel_id: 'channel-1' });

    expect(res.status).toBe(200);
    expect(discordBotService.testConnection).toHaveBeenCalledWith('discord_live_token_1234', 'channel-1');
  });

  it('uses the stored Discord token for /settings/discord/servers when the request sends a masked token', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{
        type: 'discord',
        bot_token: 'discord_live_token_1234'
      }]
    });
    discordBotService.getServers.mockResolvedValueOnce([{ id: 'guild-1', name: 'Guild One' }]);

    const res = await request(app)
      .get('/settings/discord/servers')
      .query({ bot_token: '••••••••1234' });

    expect(res.status).toBe(200);
    expect(discordBotService.getServers).toHaveBeenCalledWith('discord_live_token_1234');
  });

  it('uses the stored Discord token for /settings/discord/channels/:serverId when the request omits bot_token', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{
        type: 'discord',
        bot_token: 'discord_live_token_1234'
      }]
    });
    discordBotService.getChannels.mockResolvedValueOnce([{ id: 'channel-1', name: 'general' }]);

    const res = await request(app).get('/settings/discord/channels/guild-1');

    expect(res.status).toBe(200);
    expect(discordBotService.getChannels).toHaveBeenCalledWith('guild-1', 'discord_live_token_1234');
  });

  it('returns 500 from GET /settings/notifications when config lookup fails', async () => {
    db.query.mockRejectedValueOnce(new Error('discord lookup failed'));

    const res = await request(app).get('/settings/notifications');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'discord lookup failed' });
  });

  it('does not reinitialize the Discord bot when config is enabled but channel_id is missing', async () => {
    const client = {
      query: jest.fn(),
      release: jest.fn()
    };
    db.pool.connect.mockResolvedValue(client);

    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ bot_token: 'discord_live_token_1234', channel_id: null, enabled: false }] })
      .mockResolvedValueOnce({ rows: [{ bot_token: 'discord_live_token_1234', channel_id: null, enabled: true }] })
      .mockResolvedValueOnce({});

    const res = await request(app)
      .put('/settings/notifications')
      .send({
        bot_token: '••••••••1234',
        enabled: true
      });

    expect(res.status).toBe(200);
    expect(discordBotService.reinitialize).not.toHaveBeenCalled();
  });

  it('returns 500 and rolls back when Discord settings persistence fails', async () => {
    const client = {
      query: jest.fn(),
      release: jest.fn()
    };
    db.pool.connect.mockResolvedValue(client);

    client.query.mockImplementation(async (sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') {
        return { rows: [] };
      }
      if (sql === 'SELECT * FROM notification_config WHERE type = $1 LIMIT 1') {
        return { rows: [{}] };
      }
      if (typeof sql === 'string' && sql.includes('INSERT INTO notification_config')) {
        throw new Error('save failed');
      }
      return { rows: [] };
    });

    const res = await request(app)
      .put('/settings/notifications')
      .send({ enabled: true });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'save failed' });
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('still returns success when Discord bot reinitialize fails after saving config', async () => {
    const client = {
      query: jest.fn(),
      release: jest.fn()
    };
    db.pool.connect.mockResolvedValue(client);
    discordBotService.reinitialize.mockRejectedValueOnce(new Error('reinitialize failed'));

    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ bot_token: 'discord_live_token_1234', channel_id: 'channel-1', enabled: false }] })
      .mockResolvedValueOnce({ rows: [{ bot_token: 'discord_live_token_1234', channel_id: 'channel-1', enabled: true }] })
      .mockResolvedValueOnce({});

    const res = await request(app)
      .put('/settings/notifications')
      .send({
        bot_token: '••••••••1234',
        enabled: true
      });

    expect(res.status).toBe(200);
    expect(discordBotService.reinitialize).toHaveBeenCalledTimes(1);
  });

  it('returns 400 from /settings/discord/test when no request or stored token exists', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/settings/discord/test')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'No Discord token found' });
  });

  it('returns 500 from /settings/discord/test when the probe fails', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ type: 'discord', bot_token: 'discord_live_token_1234' }]
    });
    discordBotService.testConnection.mockRejectedValueOnce(new Error('discord unavailable'));

    const res = await request(app)
      .post('/settings/discord/test')
      .send({});

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'discord unavailable' });
  });

  it('returns 400 from /settings/discord/servers when no token exists', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/settings/discord/servers');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'No Discord token found' });
  });

  it('returns 500 from /settings/discord/servers when guild lookup fails', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ type: 'discord', bot_token: 'discord_live_token_1234' }]
    });
    discordBotService.getServers.mockRejectedValueOnce(new Error('guild fetch failed'));

    const res = await request(app).get('/settings/discord/servers');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'guild fetch failed' });
  });

  it('returns 400 from /settings/discord/channels/:serverId when no token exists', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/settings/discord/channels/guild-1');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'No Discord token found' });
  });

  it('returns 500 from /settings/discord/channels/:serverId when channel lookup fails', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ type: 'discord', bot_token: 'discord_live_token_1234' }]
    });
    discordBotService.getChannels.mockRejectedValueOnce(new Error('channel fetch failed'));

    const res = await request(app).get('/settings/discord/channels/guild-1');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'channel fetch failed' });
  });

  it('returns live Discord channel details when lookup succeeds', async () => {
    discordBotService.getChannelDetails.mockResolvedValueOnce({
      id: 'channel-1',
      name: 'general',
      guildId: 'guild-1',
      guildName: 'Guild One'
    });

    const res = await request(app).get('/settings/discord/channel/channel-1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: 'channel-1',
      name: 'general',
      guildId: 'guild-1',
      guildName: 'Guild One'
    });
  });

  it('returns a partial fallback payload when channel-details lookup fails', async () => {
    discordBotService.getChannelDetails.mockRejectedValueOnce(new Error('lookup failed'));

    const res = await request(app).get('/settings/discord/channel/channel-1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: 'channel-1',
      name: 'Channel details unavailable',
      guildId: null,
      guildName: 'Server details unavailable',
      partial: true,
      error: 'lookup failed'
    });
  });

  describe('notify_on_system_errors — Issue #330 Gap 5.6', () => {
    it('persists notify_on_system_errors=false when explicitly sent in PUT /settings/notifications', async () => {
      const client = { query: jest.fn(), release: jest.fn() };
      db.pool.connect.mockResolvedValue(client);

      let capturedParams;
      client.query.mockImplementation(async (sql, params) => {
        if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
        if (sql === 'SELECT * FROM notification_config WHERE type = $1 LIMIT 1') {
          return { rows: [{ bot_token: 'tok', notify_on_system_errors: true }] };
        }
        if (typeof sql === 'string' && sql.includes('INSERT INTO notification_config')) {
          capturedParams = params;
          return { rows: [{ bot_token: 'tok', notify_on_system_errors: false }] };
        }
        return { rows: [] };
      });

      const res = await request(app)
        .put('/settings/notifications')
        .send({ notify_on_system_errors: false });

      expect(res.status).toBe(200);
      // notify_on_system_errors is the 15th param ($15)
      expect(capturedParams[14]).toBe(false);
    });

    it('defaults notify_on_system_errors to true when column is absent from existing row', async () => {
      const client = { query: jest.fn(), release: jest.fn() };
      db.pool.connect.mockResolvedValue(client);

      let capturedParams;
      client.query.mockImplementation(async (sql, params) => {
        if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
        if (sql === 'SELECT * FROM notification_config WHERE type = $1 LIMIT 1') {
          // Simulate a row that pre-dates the migration (column absent)
          return { rows: [{ bot_token: 'tok' }] };
        }
        if (typeof sql === 'string' && sql.includes('INSERT INTO notification_config')) {
          capturedParams = params;
          return { rows: [{ bot_token: 'tok', notify_on_system_errors: true }] };
        }
        return { rows: [] };
      });

      await request(app).put('/settings/notifications').send({});

      expect(capturedParams[14]).toBe(true);
    });

    it('GET /settings/notifications returns notify_on_system_errors from stored config', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ type: 'discord', bot_token: 'tok', notify_on_system_errors: false }]
      });

      const res = await request(app).get('/settings/notifications');

      expect(res.status).toBe(200);
      expect(res.body.notify_on_system_errors).toBe(false);
    });
  });
});
