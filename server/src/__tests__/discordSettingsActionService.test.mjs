/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';
import { createDiscordSettingsActionService } from '../services/discordSettingsActionService.mjs';

describe('discordSettingsActionService', () => {
  test('uses the resolved token for Discord probe, server, and channel actions', async () => {
    const discordBotService = {
      testConnection: jest.fn().mockResolvedValue({ success: true }),
      getServers: jest.fn().mockResolvedValue([{ id: 'guild-1' }]),
      getChannels: jest.fn().mockResolvedValue([{ id: 'channel-1' }]),
    };
    const resolveDiscordBotToken = jest.fn().mockResolvedValue('discord_live_token_1234');
    const actionService = createDiscordSettingsActionService({
      discordBotService,
      resolveDiscordBotToken,
    });

    await expect(actionService.testConnection({
      dbOrClient: { query: jest.fn() },
      body: { channel_id: 'channel-1' },
    })).resolves.toEqual({ success: true });
    await expect(actionService.getServers({
      dbOrClient: { query: jest.fn() },
      query: {},
    })).resolves.toEqual([{ id: 'guild-1' }]);
    await expect(actionService.getChannels({
      dbOrClient: { query: jest.fn() },
      query: {},
      serverId: 'guild-1',
    })).resolves.toEqual([{ id: 'channel-1' }]);

    expect(resolveDiscordBotToken).toHaveBeenNthCalledWith(
      1,
      expect.any(Object),
      undefined,
      { allowMissingFallback: true },
    );
    expect(discordBotService.testConnection).toHaveBeenCalledWith('discord_live_token_1234', 'channel-1');
    expect(discordBotService.getServers).toHaveBeenCalledWith('discord_live_token_1234');
    expect(discordBotService.getChannels).toHaveBeenCalledWith('guild-1', 'discord_live_token_1234');
  });

  test('throws a 400 error when no Discord token can be resolved', async () => {
    const actionService = createDiscordSettingsActionService({
      discordBotService: {
        testConnection: jest.fn(),
        getServers: jest.fn(),
        getChannels: jest.fn(),
      },
      resolveDiscordBotToken: jest.fn().mockResolvedValue(null),
    });

    await expect(actionService.getServers({
      dbOrClient: { query: jest.fn() },
      query: {},
    })).rejects.toMatchObject({
      httpStatus: 400,
      message: 'No Discord token found',
    });
  });
});
