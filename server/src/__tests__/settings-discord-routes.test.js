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
jest.mock('../services/startupService', () => ({}));
jest.mock('../services/pathTestService', () => ({}));
jest.mock('../services/cloudLLM', () => ({}));
jest.mock('../services/aiRouter', () => ({}));
jest.mock('../services/embeddingProvider', () => ({}));
jest.mock('../services/embeddingRouter', () => ({}));
jest.mock('../services/webhook', () => ({}));

jest.mock('../services/discordBot', () => ({
  reinitialize: jest.fn(),
  testConnection: jest.fn(),
  getServers: jest.fn(),
  getChannels: jest.fn(),
  getChannelDetails: jest.fn()
}));

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
const discordBotService = require('../services/discordBot');
const settingsRouter = require('../routes/settings');

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
    app = express();
    app.use(express.json());
    app.use('/settings', settingsRouter);
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
        false
      ]
    );
    expect(discordBotService.reinitialize).toHaveBeenCalledTimes(1);
    expect(res.body.bot_token).not.toBe('discord_live_token_1234');
    expect(res.body.bot_token).toContain('1234');
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
});
