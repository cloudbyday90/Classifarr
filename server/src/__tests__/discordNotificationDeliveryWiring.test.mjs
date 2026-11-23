/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, jest, test } from '@jest/globals';
const send = jest.fn();
const sendPending = jest.fn();
const query = jest.fn().mockResolvedValue({ rows: [] });
const embed = {};
const tier = { action: 'auto_classify' };
jest.unstable_mockModule('../config/database.mjs', () => ({ query }));
jest.unstable_mockModule('../services/discordDelivery.mjs', () => ({ discordDelivery: { send } }));
jest.unstable_mockModule('../services/discordNotificationBuilder.mjs', () => ({ buildSimpleNotificationEmbed: () => embed }));
// This suite isolates ordinary delivery wiring; scoped pending rendering has real-builder controls.
jest.unstable_mockModule('../services/discordPendingNotification.mjs', () => ({ sendPendingDecisionNotification: sendPending }));
jest.unstable_mockModule('../services/discordTieredEmbedBuilder.mjs', () => ({ createTieredEmbed: async () => embed }));
jest.unstable_mockModule('../services/discordNotificationComponents.mjs', () => ({
  createCorrectionComponents: async () => [], createTieredComponents: async () => [],
}));
jest.unstable_mockModule('../services/clarificationService.mjs', () => ({ clarificationService: {
  isRequireAllConfirmationsEnabled: async () => false, getTierFromPolicyThresholds: () => tier,
} }));
const { sendClassificationNotification } = await import('../services/discordClassificationNotification.mjs');
const { sendConfidenceBasedNotification } = await import('../services/discordConfidenceNotification.mjs');
beforeEach(() => send.mockReset().mockResolvedValue({ sent: false, reason: 'delivery_unconfirmed' }));

test.each([
  ['classification', sendClassificationNotification], ['confidence', sendConfidenceBasedNotification],
])('%s returns the receipt outcome and never sends independently', async (kind, notify) => {
  const channel = { send: jest.fn() };
  const context = { client: { channels: { fetch: jest.fn().mockResolvedValue(channel) } },
    channelId: '222222222222222222', config: { enabled: true, notify_on_classification: true }, warnFn: jest.fn() };
  expect(await notify({ title: 'Fixture' }, { classification_id: 7, confidence: 90 }, context))
    .toEqual({ sent: false, reason: 'delivery_unconfirmed' });
  expect(send).toHaveBeenCalledWith(expect.objectContaining({
    classificationId: 7, kind, channel, client: context.client, config: context.config,
    payload: { embeds: [embed], components: [] },
    ...(kind === 'confidence' ? { clarificationStatus: tier.action } : {}),
  }));
  expect(channel.send).not.toHaveBeenCalled();
});

test('confidence notification lets the existing pending sender own an unsent pending row', async () => {
  query.mockResolvedValueOnce({ rows: [{ status: 'awaiting_decision', discord_message_id: null }] });
  const metadata = { title: 'Pending fixture' };
  const result = { classification_id: 7, confidence: 60 };
  const context = { client: { channels: { fetch: jest.fn() } },
    channelId: '222222222222222222', config: { enabled: true, notify_on_classification: true }, warnFn: jest.fn() };
  await sendConfidenceBasedNotification(metadata, result, context);
  expect(sendPending).toHaveBeenCalledWith(metadata, result, context);
  expect(send).not.toHaveBeenCalled();
  expect(context.client.channels.fetch).not.toHaveBeenCalled();
});
