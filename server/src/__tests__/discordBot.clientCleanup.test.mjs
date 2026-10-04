/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';
import {
  createMockDb,
  createNamedMockModule,
  restoreAllAndResetMocks,
} from './helpers/mockFactory.mjs';

const mockDb = createMockDb();

jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));

const mockClients = [];
const observe = jest.fn().mockResolvedValue(false);
jest.unstable_mockModule('../services/discordDelivery.mjs', () => ({ discordDelivery: { observe } }));
let mockNextClientSetup = null;

function createDiscordJsModule() {
  class MockClient {
    constructor(options) {
      this.options = options;
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
      this.sdkDestroy = this.destroy;
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

    on(event, handler) {
      this.handlers[event] = handler;
    }
  }

  return {
    Client: MockClient,
    DefaultRestOptions: { makeRequest: jest.fn() },
    GatewayIntentBits: { Guilds: 1, GuildMessages: 2 },
    PermissionFlagsBits: {},
    EmbedBuilder: class {},
    ActionRowBuilder: class {},
    ButtonBuilder: class {},
    ButtonStyle: {},
    StringSelectMenuBuilder: class {},
  };
}

jest.unstable_mockModule('discord.js', createDiscordJsModule);

const db = mockDb;
const { discordBotService: discordBot } = await import('../services/discordBot.mjs');

describe('discordBot temporary client cleanup', () => {
  beforeEach(() => {
    restoreAllAndResetMocks(db.query);
    mockClients.length = 0;
    mockNextClientSetup = null;
    discordBot.client = null;
    discordBot.isInitialized = false;
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
    expect(mockClients[0].sdkDestroy).toHaveBeenCalledTimes(1);
    expect(mockClients[0].options.rest.makeRequest).toEqual(expect.any(Function));
  });

  test('getServers destroys the temporary client when login fails', async () => {
    mockNextClientSetup = (client) => {
      client.login.mockRejectedValueOnce(new Error('bad token'));
    };

    await expect(discordBot.getServers()).rejects.toThrow('Failed to fetch servers: bad token');
    expect(mockClients[0].sdkDestroy).toHaveBeenCalledTimes(1);
  });

  test('getChannels destroys the temporary client when the guild lookup fails', async () => {
    mockNextClientSetup = (client) => {
      client._guilds = [];
    };

    await expect(discordBot.getChannels('missing-guild')).rejects.toThrow('Failed to fetch channels: Server not found or bot not added to this server');
    expect(mockClients[0].sdkDestroy).toHaveBeenCalledTimes(1);
  });

  test('unconfigured and disabled initialization never constructs a client', async () => {
    await expect(discordBot.initialize()).rejects.toThrow('not configured');
    db.query.mockResolvedValue({ rows: [{ bot_token: 'synthetic', channel_id: '123', enabled: false }] });
    await expect(discordBot.initialize()).rejects.toThrow('not enabled');
    expect(mockClients).toHaveLength(0);
  });

  test('persistent bot uses the same bounded lifecycle on replacement', async () => {
    db.query.mockResolvedValue({ rows: [{ bot_token: 'synthetic', channel_id: '123', enabled: true }] });
    await discordBot.initialize();
    expect(discordBot.isInitialized).toBe(true);
    expect(mockClients[0].options.rest.timeout).toBe(16000);
    const originalClient = mockClients[0];
    await discordBot.reinitialize();
    const message = { nonce: 'fixture' };
    originalClient.handlers.messageCreate(message);
    expect(observe).toHaveBeenCalledWith(message, originalClient, expect.any(Function));
    originalClient.handlers.messageUpdate({ partial: true }, message);
    expect(observe).toHaveBeenLastCalledWith(message, originalClient, expect.any(Function));
    expect(originalClient.channels.fetch).not.toHaveBeenCalled();
    expect(mockClients).toHaveLength(2);
    expect(mockClients[0].sdkDestroy).toHaveBeenCalledTimes(1);
    await expect(mockClients[0].options.rest.makeRequest('unused', {})).rejects.toMatchObject({ code: 'DISCORD_TRANSPORT_CLOSED' });
    await discordBot.client.destroy();
  });

  test('connection tests use and close the bounded client', async () => {
    mockNextClientSetup = client => { client.user = { id: '123', username: 'Fixture', discriminator: '0' }; };
    await expect(discordBot.testConnection('synthetic')).resolves.toMatchObject({ success: true });
    expect(mockClients[0].options.rest.timeout).toBe(16000);
    expect(mockClients[0].sdkDestroy).toHaveBeenCalledTimes(1);
    await expect(mockClients[0].options.rest.makeRequest('unused', {})).rejects.toMatchObject({ code: 'DISCORD_TRANSPORT_CLOSED' });
  });
});
