/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';

const mockDb = { query: jest.fn() };

jest.mock('../config/database', () => mockDb);
jest.unstable_mockModule('../config/database', () => ({ ...mockDb, default: mockDb }));
jest.unstable_mockModule('../config/database.mjs', () => ({ ...mockDb, default: mockDb }));

const mockClients = [];
let mockNextClientSetup = null;

jest.mock('discord.js', () => {
  class MockClient {
    constructor() {
      this.handlers = {};
      this._guilds = [];
      this.guilds = {
        cache: {
          map: (mapper) => this._guilds.map(mapper),
          get: (id) => this._guilds.find((guild) => guild.id === id) || null,
        },
      };
      this.channels = { fetch: jest.fn() };
      this.destroy = jest.fn().mockResolvedValue(undefined);
      this.login = jest.fn(() => new Promise((resolve) => {
        setImmediate(() => {
          if (this.handlers.ready) {
            this.handlers.ready();
          }
          resolve();
        });
      }));
      if (mockNextClientSetup) {
        mockNextClientSetup(this);
        mockNextClientSetup = null;
      }
      mockClients.push(this);
    }

    once(event, handler) {
      this.handlers[event] = handler;
    }
  }

  return {
    Client: MockClient,
    GatewayIntentBits: { Guilds: 1, GuildMessages: 2 },
    PermissionFlagsBits: {},
    EmbedBuilder: class {},
    ActionRowBuilder: class {},
    ButtonBuilder: class {},
    ButtonStyle: {},
    StringSelectMenuBuilder: class {},
  };
});
jest.unstable_mockModule('discord.js', () => {
  class MockClient {
    constructor() {
      this.handlers = {};
      this._guilds = [];
      this.guilds = {
        cache: {
          map: (mapper) => this._guilds.map(mapper),
          get: (id) => this._guilds.find((guild) => guild.id === id) || null,
        },
      };
      this.channels = { fetch: jest.fn() };
      this.destroy = jest.fn().mockResolvedValue(undefined);
      this.login = jest.fn(() => new Promise((resolve) => {
        setImmediate(() => {
          if (this.handlers.ready) {
            this.handlers.ready();
          }
          resolve();
        });
      }));
      if (mockNextClientSetup) {
        mockNextClientSetup(this);
        mockNextClientSetup = null;
      }
      mockClients.push(this);
    }

    once(event, handler) {
      this.handlers[event] = handler;
    }
  }

  return {
    Client: MockClient,
    GatewayIntentBits: { Guilds: 1, GuildMessages: 2 },
    PermissionFlagsBits: {},
    EmbedBuilder: class {},
    ActionRowBuilder: class {},
    ButtonBuilder: class {},
    ButtonStyle: {},
    StringSelectMenuBuilder: class {},
  };
});

const db = mockDb;
const { default: discordBot } = await import('../services/discordBot.mjs');

describe('discordBot temporary client cleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockReset();
    mockClients.length = 0;
    mockNextClientSetup = null;
    db.query.mockResolvedValue({
      rows: [{ type: 'discord', bot_token: 'stored-token', enabled: true }],
    });
  });

  test('getServers destroys the temporary client after a successful fetch', async () => {
    const guild = {
      id: 'guild-1',
      name: 'Guild One',
      iconURL: jest.fn(() => 'https://cdn.example/icon.png'),
      memberCount: 42,
    };

    mockNextClientSetup = (client) => {
      client._guilds = [guild];
    };

    await expect(discordBot.getServers()).resolves.toEqual([
      {
        id: 'guild-1',
        name: 'Guild One',
        icon: 'https://cdn.example/icon.png',
        memberCount: 42,
      },
    ]);
    expect(mockClients[0].destroy).toHaveBeenCalledTimes(1);
  });

  test('getServers destroys the temporary client when login fails', async () => {
    mockNextClientSetup = (client) => {
      client.login.mockRejectedValueOnce(new Error('bad token'));
    };

    await expect(discordBot.getServers()).rejects.toThrow('Failed to fetch servers: bad token');
    expect(mockClients[0].destroy).toHaveBeenCalledTimes(1);
  });

  test('getChannels destroys the temporary client when the guild lookup fails', async () => {
    mockNextClientSetup = (client) => {
      client._guilds = [];
    };

    await expect(discordBot.getChannels('missing-guild')).rejects.toThrow('Failed to fetch channels: Server not found or bot not added to this server');
    expect(mockClients[0].destroy).toHaveBeenCalledTimes(1);
  });
});
