/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test, beforeEach } from '@jest/globals';
import { createNamedMockModule } from './helpers/mockFactory.mjs';

const mockDb = {
  query: jest.fn(),
};

jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));

const { sendPendingDecisionNotification } = await import('../services/discordPendingNotification.mjs');

describe('discordPendingNotification', () => {
  beforeEach(() => {
    mockDb.query.mockReset();
    mockDb.query.mockResolvedValue({ rows: [] });
  });

  test('sends a pending item embed and stores the Discord message id', async () => {
    const send = jest.fn().mockResolvedValue({ id: 'discord-message-1' });
    const client = {
      channels: {
        fetch: jest.fn().mockResolvedValue({ send }),
      },
    };
    const warnFn = jest.fn();

    const result = await sendPendingDecisionNotification(
      {
        title: 'Office Romance',
        year: 2026,
        media_type: 'movie',
      },
      {
        classification_id: 77,
        confidence: 72,
        pending_reason: 'Needs clarification',
        policy_question: {
          question: 'Which library should receive this?',
          options: [
            { label: 'Movies', library_id: 15 },
            { label: 'Family', library_id: 14 },
          ],
        },
      },
      {
        client,
        channelId: 'channel-1',
        config: { enabled: true, notify_on_pending_items: true },
        warnFn,
      },
    );

    expect(result).toEqual({ sent: true, messageId: 'discord-message-1' });
    expect(client.channels.fetch).toHaveBeenCalledWith('channel-1');
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([expect.any(Object)]),
      components: expect.arrayContaining([expect.any(Object)]),
    }));
    expect(mockDb.query).toHaveBeenLastCalledWith(
      'UPDATE classification_history SET discord_message_id = $1 WHERE id = $2',
      ['discord-message-1', 77],
    );
    expect(warnFn).not.toHaveBeenCalled();
  });

  test('sends only explicitly configured pending mentions', async () => {
    const send = jest.fn().mockResolvedValue({ id: 'discord-message-2' });
    const client = {
      channels: {
        fetch: jest.fn().mockResolvedValue({ send }),
      },
    };

    await sendPendingDecisionNotification(
      { title: 'Example', media_type: 'movie' },
      { classification_id: 88, confidence: 60 },
      {
        client,
        channelId: 'channel-1',
        config: {
          enabled: true,
          notify_on_pending_items: true,
          pending_mention_here: true,
          pending_mention_type: 'role',
          pending_mention_target_id: '123456789012345678',
        },
        warnFn: jest.fn(),
      },
    );

    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      content: '@here <@&123456789012345678>',
      allowedMentions: {
        parse: ['everyone'],
        users: [],
        roles: ['123456789012345678'],
      },
    }));
  });

  test('skips when pending notifications are disabled', async () => {
    const result = await sendPendingDecisionNotification(
      { title: 'Example', media_type: 'movie' },
      { classification_id: 7 },
      {
        client: { channels: { fetch: jest.fn() } },
        channelId: 'channel-1',
        config: { enabled: true, notify_on_pending_items: false },
        warnFn: jest.fn(),
      },
    );

    expect(result).toEqual({ sent: false, reason: 'disabled' });
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  test('skips duplicate sends when classification already has a Discord message', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [{ discord_message_id: 'existing-message' }] });
    const fetch = jest.fn();

    const result = await sendPendingDecisionNotification(
      { title: 'Example', media_type: 'movie' },
      { classification_id: 7 },
      {
        client: { channels: { fetch } },
        channelId: 'channel-1',
        config: { enabled: true, notify_on_pending_items: true },
        warnFn: jest.fn(),
      },
    );

    expect(result).toEqual({ sent: false, reason: 'already_notified' });
    expect(fetch).not.toHaveBeenCalled();
  });
});
