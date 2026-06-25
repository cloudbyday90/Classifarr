/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { isMaskedToken, maskToken } from '../../utils/tokenMasking.mjs';
import { getSettingsErrorMessage } from '../../routes/helpers/settingsErrorSupport.mjs';

const DISCORD_TYPE = 'discord';
const VALID_PENDING_MENTION_TYPES = new Set(['none', 'user', 'role']);

function normalizePendingMentionType(value) {
  const type = typeof value === 'string' ? value.trim().toLowerCase() : 'none';
  return VALID_PENDING_MENTION_TYPES.has(type) ? type : 'none';
}

function normalizeDiscordSnowflake(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const id = String(value).trim();
  return /^\d{5,32}$/.test(id) ? id : null;
}

function normalizeMentionLabel(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, 150);
}

export function maskDiscordConfig(config) {
  if (!config) {
    return null;
  }

  const masked = { ...config };
  if (masked.bot_token) {
    masked.bot_token = maskToken(masked.bot_token);
  }
  return masked;
}

export async function fetchDiscordConfig(dbOrClient) {
  const result = await dbOrClient.query(
    'SELECT * FROM notification_config WHERE type = $1 LIMIT 1',
    [DISCORD_TYPE]
  );
  return result.rows[0] || null;
}

export async function resolveDiscordBotToken(dbOrClient, submittedToken, {
  allowMissingFallback = false,
} = {}) {
  if (submittedToken && !isMaskedToken(submittedToken)) {
    return submittedToken;
  }

  if (!submittedToken && !allowMissingFallback) {
    return submittedToken || null;
  }

  const existing = await fetchDiscordConfig(dbOrClient);
  return existing?.bot_token || null;
}

export function buildDiscordConfigPayload(body = {}, existing = {}) {
  let botToken = existing.bot_token || null;
  if (body.bot_token !== undefined && body.bot_token !== null && !isMaskedToken(body.bot_token)) {
    botToken = body.bot_token;
  }

  const pendingMentionType = normalizePendingMentionType(
    body.pending_mention_type ?? existing.pending_mention_type ?? 'none',
  );
  const pendingMentionTargetId = pendingMentionType === 'none'
    ? null
    : normalizeDiscordSnowflake(
      body.pending_mention_target_id ?? existing.pending_mention_target_id,
    );

  return {
    bot_token: botToken,
    channel_id: body.channel_id ?? existing.channel_id ?? null,
    enabled: body.enabled ?? existing.enabled ?? true,
    notify_on_classification: body.notify_on_classification ?? existing.notify_on_classification ?? true,
    notify_on_error: body.notify_on_error ?? existing.notify_on_error ?? true,
    notify_on_correction: body.notify_on_correction ?? existing.notify_on_correction ?? true,
    show_poster: body.show_poster ?? existing.show_poster ?? true,
    show_confidence: body.show_confidence ?? existing.show_confidence ?? true,
    show_method: body.show_method ?? existing.show_method ?? true,
    show_reason: body.show_reason ?? existing.show_reason ?? true,
    show_metadata: body.show_metadata ?? existing.show_metadata ?? false,
    enable_corrections: body.enable_corrections ?? existing.enable_corrections ?? true,
    correction_buttons_count: body.correction_buttons_count ?? existing.correction_buttons_count ?? 3,
    include_library_dropdown: body.include_library_dropdown ?? existing.include_library_dropdown ?? true,
    notify_on_system_errors: body.notify_on_system_errors ?? existing.notify_on_system_errors ?? true,
    notify_on_pending_items: body.notify_on_pending_items ?? existing.notify_on_pending_items ?? true,
    pending_mention_here: body.pending_mention_here ?? existing.pending_mention_here ?? false,
    pending_mention_type: pendingMentionTargetId ? pendingMentionType : 'none',
    pending_mention_target_id: pendingMentionTargetId,
    pending_mention_target_label: pendingMentionTargetId
      ? normalizeMentionLabel(body.pending_mention_target_label ?? existing.pending_mention_target_label)
      : null,
  };
}

export function buildDiscordChannelDetailsFallback(channelId, error) {
  return {
    id: channelId,
    name: 'Channel details unavailable',
    guildId: null,
    guildName: 'Server details unavailable',
    partial: true,
    error: getSettingsErrorMessage(error),
  };
}
