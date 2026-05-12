/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';
import {
  buildDiscordConfigUpdateResponse,
  reinitializeDiscordBotIfNeeded,
  sendDiscordErrorResponse,
} from '../routes/helpers/discordSettingsResponseSupport.mjs';

describe('discordSettingsResponseSupport', () => {
  test('masks the saved Discord config for the update response', () => {
    const response = buildDiscordConfigUpdateResponse({
      bot_token: 'discord_live_token_1234',
      enabled: true,
    });

    expect(response).toMatchObject({ enabled: true });
    expect(response.bot_token).not.toBe('discord_live_token_1234');
    expect(response.bot_token).toContain('1234');
  });

  test('reinitializes the Discord bot only when requested and logs non-fatal failures', async () => {
    const discordBotService = {
      reinitialize: jest.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('reinitialize failed')),
    };
    const logger = { warn: jest.fn() };

    await reinitializeDiscordBotIfNeeded({
      shouldReinitialize: false,
      discordBotService,
      logger,
    });
    await reinitializeDiscordBotIfNeeded({
      shouldReinitialize: true,
      discordBotService,
      logger,
    });
    await reinitializeDiscordBotIfNeeded({
      shouldReinitialize: true,
      discordBotService,
      logger,
    });

    expect(discordBotService.reinitialize).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledWith('Failed to reinitialize Discord bot:', {
      error: 'reinitialize failed',
    });
  });

  test('applies the shared Discord error response and optional route-specific logging', () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const logger = { error: jest.fn() };

    sendDiscordErrorResponse(res, new Error('save failed'), {
      logger,
      logMessage: 'Failed to save Discord notification config:',
    });

    expect(logger.error).toHaveBeenCalledWith('Failed to save Discord notification config:', {
      error: 'save failed',
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'save failed' });
  });
});
