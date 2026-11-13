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
import { buildPolicyRuntimeQuestionAnswerContract, validatePolicyRuntimeQuestionAnswer } from '../services/policyRuntimeQuestionAnswerContract.mjs';
import { purposeMatchFixture } from './fixtures/purposeMatchEvidenceFixture.mjs';
import { currentPolicyReviewFixture } from './fixtures/currentPolicyReviewFixture.mjs';
import { rememberSavedCurrentPolicyReview } from '../services/currentPolicyReviewFrameLive.mjs';

const mockDb = {
  query: jest.fn(),
};

jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));
const deliver = jest.fn(async ({ channel, payload }) => {
  const message = await channel.send(payload);
  return { sent: true, messageId: message.id };
});
jest.unstable_mockModule('../services/discordDelivery.mjs', () => ({ discordDelivery: { send: deliver } }));

const { sendPendingDecisionNotification } = await import('../services/discordPendingNotification.mjs');
const { sendConfidenceBasedNotification } = await import('../services/discordConfidenceNotification.mjs');
const { AIResponseParser } = await import('../services/aiResponseParser.mjs');
const { buildAiUnavailableResult } = await import('../services/classificationPathServiceShared.mjs');

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
  test.each(['pending', 'confidence', 'gap'])('current %s notification uses the saved shared contract and numeric score', async kind => {
    const value = await currentPolicyReviewFixture();
    const question = normalizePolicyRuntimeQuestion({ metadata: value.item, libraries: value.libraries, policyResult: value.result });
    const frame = kind === 'gap' ? { ...value.frame, status: 'evidence_gap', policy: null } : value.frame;
    const metadata = rememberSavedCurrentPolicyReview(value.published, { ...value.item, title: 'Owned current review',
      policyResult: value.ctx.policyResult, classification_details: { current_policy_review: frame } }, 77);
    const result = { ...value.published, classification_id: 77, clarification: question, policy_question: question };
    const contract = buildPolicyRuntimeQuestionAnswerContract({ classification: { ...value.item, id: 77,
      method: result.method, metadata, confidence: 75 }, question });
    const send = jest.fn(async () => ({ id: 'owned-current-message' })), fallback = jest.fn();
    const context = { client: { channels: { fetch: async () => ({ send }) } }, channelId: 'owned-channel',
      config: { enabled: true, notify_on_classification: true, notify_on_pending_items: true },
      sendClassificationNotification: fallback, warnFn: jest.fn() };
    await (kind === 'confidence' ? sendConfidenceBasedNotification : sendPendingDecisionNotification)(metadata, result, context);
    expect(send).toHaveBeenCalledTimes(1); expect(fallback).not.toHaveBeenCalled();
    const payload = send.mock.calls[0][0], buttons = payload.components[0].components.map(button => button.data);
    for (const button of buttons) expect(button.custom_id).toContain(`_${contract.fingerprint}`);
    if (kind === 'gap') expect(contract.recommendation.leading_destination).toBeNull();
    else expect(payload.embeds[0].data.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Policy score: Owned destination 0', value: '70%' }),
    ]));
    expect(JSON.stringify(payload)).not.toContain('80%');
  });
  test.each(['classify', 'recovery'])('fresh %s unresolved advice produces explicit destination buttons without a primary recommendation', async kind => {
    const libraries = [{ id: 15, name: 'Movies', media_type: 'movie', is_active: true },
      { id: 14, name: 'Arbitrary label', media_type: 'movie', is_active: true }];
    const metadata = { title: 'Owned unresolved notification', media_type: 'movie' };
    const result = kind === 'recovery' ? buildAiUnavailableResult({ libraries, confidence: 65,
      isTransientAiAvailability: false, suggestedLibrary: null })
      : new AIResponseParser().parse('Invalid narrative', { libraries, metadata,
        signalContext: { confidence: 99, suggestedLibrary: libraries[0] } }, { mode: 'classify' });
    result.classification_id = 78;
    result.policy_question = normalizePolicyRuntimeQuestion({ question: result.policy_question, result, metadata, libraries });
    const send = jest.fn().mockResolvedValue({ id: 'owned-message' });
    expect(await sendPendingDecisionNotification(metadata, result, {
      client: { channels: { fetch: async () => ({ send }) } }, channelId: 'owned-channel',
      config: { enabled: true, notify_on_pending_items: true }, warnFn: jest.fn(),
    })).toMatchObject({ sent: true });
    const payload = send.mock.calls[0][0];
    const buttons = payload.components[0].components.map(button => button.data);
    expect(buttons.map(button => button.label)).toEqual(['Resolve in Movies', 'Resolve in Arbitrary label']);
    expect(JSON.stringify(payload)).not.toContain('Classifarr recommends');
    const contract = buildPolicyRuntimeQuestionAnswerContract({ classification: { ...metadata,
      id: 78, status: 'awaiting_decision', library_id: null }, question: result.policy_question });
    expect(contract.recommendation.leading_destination).toBeNull();
  });
  test('preserves typed identity for a bound purpose card in the emitted fingerprint', async () => {
    const fixture = purposeMatchFixture({ origin: 'mixed' });
    const libraries = [{ id: 4, name: 'Animation', media_type: 'movie', is_active: true },
      { id: 5, name: 'Movies', media_type: 'movie', is_active: true }];
    const policyResult = { ranked: [fixture.candidate, { library_id: 5, score: 60 }] };
    const question = normalizePolicyRuntimeQuestion({ metadata: fixture.item, libraries, policyResult });
    const metadata = { ...fixture.sourceMetadata, ...fixture.item, title: 'Synthetic typed review', policyResult };
    const result = { classification_id: 77, method: fixture.classification.method, confidence: 70, policy_question: question };
    const contract = buildPolicyRuntimeQuestionAnswerContract({ classification: { ...fixture.classification, id: 77, metadata, confidence: 70 }, question });
    expect(contract.decision_summary.deterministic.candidate_evidence_card.purpose_evidence.origin).toBe('mixed');
    const send = jest.fn().mockResolvedValue({ id: 'synthetic-message' });
    await sendPendingDecisionNotification(metadata, result, { client: { channels: { fetch: jest.fn().mockResolvedValue({ send }) } },
      channelId: 'synthetic-channel', config: { enabled: true }, warnFn: jest.fn() });
    const buttons = send.mock.calls[0][0].components[0].components.map(button => button.data);
    expect(buttons[0]).toMatchObject({ custom_id: `ai_answer_77_c_4_${contract.fingerprint}`, style: 3 });
    expect(buttons[1]).toMatchObject({ custom_id: `ai_answer_77_c_5_${contract.fingerprint}`, style: 2 });
  });
  test('emits the same fingerprint as persisted-row validation and offers no positional default during disagreement', async () => {
    const question = normalizedPolicyQuestion();
    const metadata = { title: 'Synthetic review', year: 2026, media_type: 'movie', classification_details: {
      candidate_adjudication: { version: 'policy.candidate_adjudication.v1', status_id: 'proposed', candidate_count: 2,
        proposed_destination: { library_id: 14, library_name: 'Untrusted alternate name' } } } };
    const result = { classification_id: 77, method: 'ai_verified', confidence: 99, reason: 'Review required', policy_question: question };
    const classification = { id: 77, title: metadata.title, year: metadata.year, media_type: metadata.media_type,
      metadata: JSON.stringify(metadata), method: result.method, confidence: '99.00', reason: result.reason };
    const contract = buildPolicyRuntimeQuestionAnswerContract({ classification, question });
    const send = jest.fn().mockResolvedValue({ id: 'synthetic-message' });
    await sendPendingDecisionNotification(metadata, result, { client: { channels: { fetch: jest.fn().mockResolvedValue({ send }) } },
      channelId: 'synthetic-channel', config: { enabled: true }, warnFn: jest.fn() });
    const payload = send.mock.calls[0][0];
    const buttons = payload.components[0].components.map(button => button.data);
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      const [, , , action, destination, fingerprint] = button.custom_id.split('_');
      // Fingerprints use URL-safe characters including underscores; read the fixed prefix instead.
      expect(button.custom_id).toBe(`ai_answer_77_c_${destination}_${contract.fingerprint}`);
      expect(action).toBe('c');
      expect(fingerprint).toBeDefined();
      expect(button.style).toBe(2);
      expect(validatePolicyRuntimeQuestionAnswer({ classification, question, answer: {
        contract_version: contract.version, contract_fingerprint: contract.fingerprint,
        action_id: 'confirm_destination', destination_library_id: Number(destination) } }).ok).toBe(true);
    }
    expect(payload.embeds[0].data.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'AI comparison (advisory)', value: 'Family' }),
      expect.objectContaining({ name: 'Policy score: Movies', value: '80%' }),
      expect.objectContaining({ name: 'Question', value: 'Choose a destination for this item.' }),
    ]));
    expect(JSON.stringify(payload)).not.toContain('Untrusted alternate name');
    expect(JSON.stringify(payload)).not.toContain('99%');
  });
  beforeEach(() => {
    mockDb.query.mockReset();
    mockDb.query.mockResolvedValue({ rows: [] });
    deliver.mockClear();
  });

  test('delegates a pending item embed to durable delivery', async () => {
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
    expect(deliver).toHaveBeenCalledWith(expect.objectContaining({
      classificationId: 77, kind: 'pending', client, channelId: 'channel-1',
    }));
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
