/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';
import { createDiscordSettingsReadService } from '../services/discordSettingsReadService.mjs';

describe('discordSettingsReadService', () => {
  test('loads the Discord config through the fetch and mask collaborators', async () => {
    const fetchDiscordConfig = jest.fn().mockResolvedValue({
      bot_token: 'discord_live_token_1234',
      enabled: true,
    });
    const maskDiscordConfig = jest.fn().mockReturnValue({
      bot_token: '••••••••1234',
      enabled: true,
    });
    const readService = createDiscordSettingsReadService({
      discordBotService: { getChannelDetails: jest.fn() },
      logger: { error: jest.fn() },
      fetchDiscordConfig,
      maskDiscordConfig,
    });

    await expect(readService.getConfig({ dbOrClient: { query: jest.fn() } })).resolves.toEqual({
      bot_token: '••••••••1234',
      enabled: true,
    });
    expect(fetchDiscordConfig).toHaveBeenCalledWith(expect.any(Object));
    expect(maskDiscordConfig).toHaveBeenCalledWith({
      bot_token: 'discord_live_token_1234',
      enabled: true,
    });
  });

  test('returns a degraded fallback when channel details lookup fails', async () => {
    const logger = { error: jest.fn() };
    const readService = createDiscordSettingsReadService({
      discordBotService: {
        getChannelDetails: jest.fn().mockRejectedValue(new Error('lookup failed')),
      },
      logger,
      buildDiscordChannelDetailsFallback: jest.fn().mockReturnValue({
        id: 'channel-1',
        partial: true,
      }),
    });

    await expect(readService.getChannelDetails({ channelId: 'channel-1' })).resolves.toEqual({
      id: 'channel-1',
      partial: true,
    });
    expect(logger.error).toHaveBeenCalledWith('Error fetching Discord channel details:', { error: 'lookup failed' });
  });
});
