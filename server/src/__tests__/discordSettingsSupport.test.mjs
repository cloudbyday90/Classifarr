/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';
import {
  buildDiscordChannelDetailsFallback,
  buildDiscordConfigPayload,
  fetchDiscordConfig,
  maskDiscordConfig,
  resolveDiscordBotToken,
} from '../routes/helpers/discordSettingsSupport.mjs';

describe('discordSettingsSupport', () => {
  test('masks the outbound Discord bot token', () => {
    const masked = maskDiscordConfig({
      bot_token: 'discord_live_token_1234',
      enabled: true,
    });

    expect(masked).toMatchObject({ enabled: true });
    expect(masked.bot_token).not.toBe('discord_live_token_1234');
    expect(masked.bot_token).toContain('1234');
  });

  test('loads the stored Discord config by type', async () => {
    const db = {
      query: jest.fn().mockResolvedValue({
        rows: [{ type: 'discord', bot_token: 'stored-token' }],
      }),
    };

    await expect(fetchDiscordConfig(db)).resolves.toEqual({
      type: 'discord',
      bot_token: 'stored-token',
    });
    expect(db.query).toHaveBeenCalledWith(
      'SELECT * FROM notification_config WHERE type = $1 LIMIT 1',
      ['discord']
    );
  });

  test('returns the submitted Discord token when it is already unmasked', async () => {
    const db = { query: jest.fn() };

    await expect(resolveDiscordBotToken(db, 'live-token', { allowMissingFallback: true })).resolves.toBe('live-token');
    expect(db.query).not.toHaveBeenCalled();
  });

  test('falls back to the stored Discord token for masked or missing submissions', async () => {
    const db = {
      query: jest.fn().mockResolvedValue({
        rows: [{ type: 'discord', bot_token: 'stored-token' }],
      }),
    };

    await expect(resolveDiscordBotToken(db, '••••••••1234', { allowMissingFallback: true })).resolves.toBe('stored-token');
    await expect(resolveDiscordBotToken(db, undefined, { allowMissingFallback: true })).resolves.toBe('stored-token');
  });

  test('builds the Discord update payload from request overrides and stored defaults', () => {
    expect(buildDiscordConfigPayload(
      {
        bot_token: '••••••••1234',
        enabled: true,
        show_metadata: true,
      },
      {
        bot_token: 'stored-token',
        channel_id: 'channel-1',
        enabled: false,
        show_metadata: false,
        correction_buttons_count: 5,
      }
    )).toEqual(expect.objectContaining({
      bot_token: 'stored-token',
      channel_id: 'channel-1',
      enabled: true,
      show_metadata: true,
      correction_buttons_count: 5,
      notify_on_system_errors: true,
    }));
  });

  test('passes through an explicit empty Discord bot token so the stored value can be cleared', () => {
    expect(buildDiscordConfigPayload(
      { bot_token: '' },
      { bot_token: 'stored-token' }
    )).toMatchObject({
      bot_token: '',
    });
  });

  test('builds the degraded Discord channel-details fallback payload', () => {
    expect(buildDiscordChannelDetailsFallback('channel-1', new Error('lookup failed'))).toEqual({
      id: 'channel-1',
      name: 'Channel details unavailable',
      guildId: null,
      guildName: 'Server details unavailable',
      partial: true,
      error: 'lookup failed',
    });
  });
});
