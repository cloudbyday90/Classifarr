/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ComponentType } from 'discord.js';
import { parseCanonicalDatabaseInt32Id } from './databaseIntegerValues.mjs';
import { isDiscordId } from './discordDeliveryContract.mjs';
import { parsePendingResolutionHistoryId } from './pendingResolutionHistoryId.mjs';

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

export function parseDiscordCompletedButton(customId) {
  if (typeof customId !== 'string') return null;
  const match = /^(correct|verify_yes|verify_no|reclassify)_([1-9][0-9]{0,15})(?:_([1-9][0-9]{0,9}))?$/.exec(customId);
  if (!match || match[0] !== customId) return null;

  const [, action, historyId, libraryId] = match;
  const classificationId = parsePendingResolutionHistoryId(historyId);
  if (classificationId === null) return null;
  if (action === 'reclassify') {
    const destinationLibraryId = parseCanonicalDatabaseInt32Id(libraryId);
    if (destinationLibraryId === null) return null;
    return { action, classificationId, destinationLibraryId, notificationKind: 'classification' };
  }
  if (libraryId !== undefined) return null;
  const notificationKind = action === 'correct' ? 'classification' : 'confidence';
  return { action, classificationId, notificationKind };
}

export function parseDiscordLegacyClarificationButton(customId) {
  if (typeof customId !== 'string') return null;
  const match = /^ai_clarify_([1-9][0-9]{0,15})_([0-4])$/.exec(customId);
  if (!match || match[0] !== customId) return null;
  const classificationId = parsePendingResolutionHistoryId(match[1]);
  return classificationId === null ? null : { classificationId, optionIndex: Number(match[2]) };
}

export function parseDiscordLibrarySelectValues(values) {
  if (!Array.isArray(values) || values.length !== 1 || typeof values[0] !== 'string') return null;
  const match = /^([1-9][0-9]{0,15})_([1-9][0-9]{0,9})$/.exec(values[0]);
  if (!match || match[0] !== values[0]) return null;
  const classificationId = parsePendingResolutionHistoryId(match[1]);
  const newLibraryId = parseCanonicalDatabaseInt32Id(match[2]);
  return classificationId === null || newLibraryId === null ? null : { classificationId, newLibraryId };
}
