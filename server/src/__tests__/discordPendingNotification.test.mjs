/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { describe, expect, jest, test, beforeEach } from '@jest/globals';
import { createNamedMockModule } from './helpers/mockFactory.mjs';
import { normalizePolicyRuntimeQuestion } from '../services/policyRuntimeQuestionNormalizer.mjs';

const mockDb = {
  query: jest.fn(),
};

jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));

const { sendPendingDecisionNotification } = await import('../services/discordPendingNotification.mjs');

function normalizedPolicyQuestion() {
  return normalizePolicyRuntimeQuestion({
    metadata: { media_type: 'movie' },
    libraries: [
      { id: 15, name: 'Movies', media_type: 'movie', is_active: true },
      { id: 14, name: 'Family', media_type: 'movie', is_active: true },
    ],
    policyResult: {
      ranked: [
        { library_id: 15, score: 80 },
        { library_id: 14, score: 75 },
      ],
    },
  });
}

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
        policy_question: normalizedPolicyQuestion(),
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

  test('renders one contract-bound native destination action', async () => {
    const send = jest.fn().mockResolvedValue({ id: 'discord-message-native' });
    const client = {
      channels: {
        fetch: jest.fn().mockResolvedValue({ send }),
      },
    };

    await sendPendingDecisionNotification(
      { title: 'Animated Example', year: 2026, media_type: 'movie' },
      {
        classification_id: 90,
        confidence: 65,
        policy_question: {
          version: 'policy.runtime_question_persistence.v1',
          question: 'Is Animated Movies the right destination?',
          runtimeQuestion: {
            contractVersion: 'policy.runtime_question_reduction.v1',
          },
          runtimeQuestionReductionPlan: {
            version: 'policy.runtime_question_reduction.v1',
          },
          options: [
            {
              label: 'Resolve current item',
              outcomeId: 'resolve_current_item',
              library_id: 6,
            },
            {
              label: 'Do not learn',
              outcomeId: 'do_not_learn',
            },
          ],
          meta: {
            runtime_question_persistence: {
              destinationLibraryId: 6,
              destinationLibraryName: 'Animated Movies',
            },
          },
        },
      },
      {
        client,
        channelId: 'channel-1',
        config: { enabled: true, notify_on_pending_items: true },
        warnFn: jest.fn(),
      },
    );

    const payload = send.mock.calls[0][0];
    const buttons = payload.components[0].components.map(button => button.data);
    const fields = payload.embeds[0].data.fields;

    expect(buttons).toEqual([
      expect.objectContaining({
        custom_id: expect.stringMatching(/^ai_answer_90_c_6_[A-Za-z0-9_-]{22}$/),
        label: 'Resolve in Animated Movies',
      }),
    ]);
    expect(buttons.map(button => button.label)).not.toContain('Confirm');
    expect(fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Another destination', value: expect.stringContaining('Classifarr') }),
    ]));
  });

  test('fails closed without generic buttons when a native envelope cannot be safely presented', async () => {
    const send = jest.fn().mockResolvedValue({ id: 'discord-message-invalid-native' });
    const client = {
      channels: {
        fetch: jest.fn().mockResolvedValue({ send }),
      },
    };

    await sendPendingDecisionNotification(
      { title: 'Invalid Native', media_type: 'movie' },
      {
        classification_id: 91,
        policy_question: {
          version: 'policy.runtime_question_persistence.v1',
          runtimeQuestion: { contractVersion: 'policy.runtime_question_reduction.v1' },
          runtimeQuestionReductionPlan: { version: 'policy.runtime_question_reduction.v1' },
          options: [{ label: 'Resolve current item', outcomeId: 'resolve_current_item', library_id: 6 }],
          meta: { runtime_question_persistence: { destinationLibraryId: 6 } },
        },
      },
      {
        client,
        channelId: 'channel-1',
        config: { enabled: true, notify_on_pending_items: true },
        warnFn: jest.fn(),
      },
    );

    const payload = send.mock.calls[0][0];
    expect(payload.components).toEqual([]);
    expect(payload.embeds[0].data.description).toContain('cannot be safely displayed');
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
