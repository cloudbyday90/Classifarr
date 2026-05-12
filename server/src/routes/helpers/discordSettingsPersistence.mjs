/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  buildDiscordConfigPayload,
  fetchDiscordConfig,
} from '../../services/shared/discordSettingsModel.mjs';

const UPSERT_DISCORD_NOTIFICATION_CONFIG_SQL = `INSERT INTO notification_config (
  id, type, bot_token, channel_id, enabled,
  notify_on_classification, notify_on_error, notify_on_correction,
  show_poster, show_confidence, show_method, show_reason, show_metadata,
  enable_corrections, correction_buttons_count, include_library_dropdown,
  notify_on_system_errors
)
 VALUES (1, 'discord', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
 ON CONFLICT (id) DO UPDATE
 SET bot_token = $1,
     channel_id = $2,
     enabled = $3,
     notify_on_classification = $4,
     notify_on_error = $5,
     notify_on_correction = $6,
     show_poster = $7,
     show_confidence = $8,
     show_method = $9,
     show_reason = $10,
     show_metadata = $11,
     enable_corrections = $12,
     correction_buttons_count = $13,
     include_library_dropdown = $14,
     notify_on_system_errors = $15,
     updated_at = NOW()
 RETURNING *`;

function buildDiscordNotificationConfigValues(payload) {
  return [
    payload.bot_token,
    payload.channel_id,
    payload.enabled,
    payload.notify_on_classification,
    payload.notify_on_error,
    payload.notify_on_correction,
    payload.show_poster,
    payload.show_confidence,
    payload.show_method,
    payload.show_reason,
    payload.show_metadata,
    payload.enable_corrections,
    payload.correction_buttons_count,
    payload.include_library_dropdown,
    payload.notify_on_system_errors,
  ];
}

export function shouldReinitializeDiscordBot(payload) {
  return Boolean(payload?.enabled && payload?.bot_token && payload?.channel_id);
}

export async function persistDiscordConfig({ db, body = {} }) {
  let savedPayload;

  const result = await db.withTransaction(async (client) => {
    const existing = await fetchDiscordConfig(client);
    const payload = buildDiscordConfigPayload(body, existing || {});
    savedPayload = payload;

    return client.query(
      UPSERT_DISCORD_NOTIFICATION_CONFIG_SQL,
      buildDiscordNotificationConfigValues(payload),
    );
  });

  return {
    config: result.rows[0],
    savedPayload,
    shouldReinitialize: shouldReinitializeDiscordBot(savedPayload),
  };
}

