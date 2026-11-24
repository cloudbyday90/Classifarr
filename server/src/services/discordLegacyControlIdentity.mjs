/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ComponentType } from 'discord.js';
import { normalizeDatabaseBigintId, parseCanonicalDatabaseInt32Id } from './databaseIntegerValues.mjs';
import { isDiscordId } from './discordDeliveryContract.mjs';

export const DISCORD_LEGACY_MESSAGE_REQUIRED =
  'This action does not belong to the saved Discord notification. Open Classifarr to review the item.';

export function matchesDiscordLegacyMessage(classification, messageId) {
  return isDiscordId(messageId) && classification.discord_message_id === messageId;
}

export function isOfferedDiscordButton(interaction) {
  return interaction.message?.components?.some(row => row.components?.some(component =>
    component.type === ComponentType.Button && component.customId === interaction.customId && !component.disabled,
  ));
}

function completedButton(action, historyId, notificationKind) {
  const classificationId = normalizeDatabaseBigintId(historyId);
  return classificationId === null ? null : { action, classificationId, notificationKind };
}

export function parseDiscordCompletedButton(customId) {
  // reclassify_ + 19 History digits + _ + 10 library digits
  if (typeof customId !== 'string' || customId.length > 41) return null;
  const parts = customId.split('_');
  const [verb, first, second] = parts;
  if (parts.length === 2 && verb === 'correct') return completedButton(verb, first, 'classification');
  if (parts.length !== 3) return null;
  if (verb === 'verify' && (first === 'yes' || first === 'no')) {
    return completedButton(`verify_${first}`, second, 'confidence');
  }
  if (verb !== 'reclassify') return null;
  const button = completedButton(verb, first, 'classification');
  const destinationLibraryId = parseCanonicalDatabaseInt32Id(second);
  return button && destinationLibraryId !== null ? { ...button, destinationLibraryId } : null;
}

export function parseDiscordLibrarySelectValues(values) {
  if (!Array.isArray(values) || values.length !== 1 || typeof values[0] !== 'string') return null;
  const match = /^([1-9][0-9]{0,18})_([1-9][0-9]{0,9})$/.exec(values[0]);
  if (!match || match[0] !== values[0]) return null;
  const classificationId = normalizeDatabaseBigintId(match[1]);
  const newLibraryId = parseCanonicalDatabaseInt32Id(match[2]);
  return classificationId === null || newLibraryId === null ? null : { classificationId, newLibraryId };
}
