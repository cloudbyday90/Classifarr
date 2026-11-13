/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, jest, test } from '@jest/globals';
const send = jest.fn();
const embed = {};
const tier = { action: 'auto_classify' };
jest.unstable_mockModule('../config/database.mjs', () => ({ query: jest.fn().mockResolvedValue({ rows: [] }) }));
jest.unstable_mockModule('../services/discordDelivery.mjs', () => ({ discordDelivery: { send } }));
jest.unstable_mockModule('../services/discordNotificationBuilder.mjs', () => ({ buildSimpleNotificationEmbed: () => embed }));
// This suite isolates ordinary delivery wiring; scoped pending rendering has real-builder controls.
jest.unstable_mockModule('../services/discordPendingNotification.mjs', () => ({ sendPendingDecisionNotification: jest.fn() }));
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
