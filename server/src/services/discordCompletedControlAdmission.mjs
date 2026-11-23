/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { DISCORD_LEGACY_MESSAGE_REQUIRED, matchesDiscordLegacyMessage } from './discordLegacyControlIdentity.mjs';

const CORRECTION_STATUSES = new Set(['completed', 'routed', 'verified', 'corrected']);

export const DISCORD_SELECTOR_CORRECTION_REQUIRED =
  'This menu can only correct an item from a completed notification. Open Classifarr to review the item.';

export const DISCORD_COMPLETED_BUTTON_REQUIRED =
  'This button requires a matching completed notification. Open Classifarr to review the item.';

/** The caller already holds the History lock. Acquire delivery evidence in the same order as delivery completion. */
export async function getDiscordCompletedControlRefusal(client, classification, {
  discordMessageId, notificationKind, unavailableMessage = DISCORD_COMPLETED_BUTTON_REQUIRED,
} = {}) {
  if (!matchesDiscordLegacyMessage(classification, discordMessageId)) return DISCORD_LEGACY_MESSAGE_REQUIRED;
  if (!await hasCompletedDiscordDelivery(client, classification, discordMessageId, notificationKind)) {
    return unavailableMessage;
  }
  return null;
}

async function hasCompletedDiscordDelivery(client, classification, messageId, notificationKind) {
  if (!CORRECTION_STATUSES.has(classification.status)) return false;

  const { rowCount } = await client.query(`SELECT 1
    FROM discord_notification_deliveries
    WHERE classification_id = $1 AND message_id = $2 AND state = 'delivered'
      AND notification_kind = $3
      AND previous_status IN ('completed', 'routed')
    FOR SHARE`, [classification.id, messageId, notificationKind]);
  return rowCount === 1;
}
