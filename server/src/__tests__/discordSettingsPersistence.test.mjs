/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';
import {
  persistDiscordConfig,
  shouldReinitializeDiscordBot,
} from '../routes/helpers/discordSettingsPersistence.mjs';

describe('discordSettingsPersistence', () => {
  test('persists the merged Discord payload inside a transaction and returns the saved row', async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({
          rows: [{
            type: 'discord',
            bot_token: 'stored-token',
            channel_id: 'channel-1',
            enabled: false,
            show_metadata: false,
          }],
        })
        .mockResolvedValueOnce({
          rows: [{
            type: 'discord',
            bot_token: 'stored-token',
            channel_id: 'channel-1',
            enabled: true,
            show_metadata: true,
          }],
        }),
    };
    const db = {
      withTransaction: jest.fn(async (callback) => callback(client)),
    };

    const result = await persistDiscordConfig({
      db,
      body: {
        bot_token: '••••••••1234',
        enabled: true,
        show_metadata: true,
      },
    });

    expect(db.withTransaction).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenNthCalledWith(
      1,
      'SELECT * FROM notification_config WHERE type = $1 LIMIT 1',
      ['discord'],
    );
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO notification_config'),
      [
        'stored-token',
        'channel-1',
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        3,
        true,
        true,
      ],
    );
    expect(result).toEqual({
      config: {
        type: 'discord',
        bot_token: 'stored-token',
        channel_id: 'channel-1',
        enabled: true,
        show_metadata: true,
      },
      savedPayload: expect.objectContaining({
        bot_token: 'stored-token',
        channel_id: 'channel-1',
        enabled: true,
        show_metadata: true,
      }),
      shouldReinitialize: true,
    });
  });

  test('reports when a saved Discord payload should not trigger bot reinitialization', () => {
    expect(shouldReinitializeDiscordBot({
      enabled: true,
      bot_token: '',
      channel_id: 'channel-1',
    })).toBe(false);
  });
});