/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { isMaskedToken, maskToken } from '../../utils/tokenMasking.mjs';
const DISCORD_TYPE = 'discord';

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

export async function resolveDiscordBotToken(dbOrClient, submittedToken, { allowMissingFallback = false } = {}) {
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
  };
}

export function createDiscordSettingsHandlers({ db, discordBotService, logger }) {
  return {
    async getConfig(_req, res) {
      try {
        const config = await fetchDiscordConfig(db);
        res.json(maskDiscordConfig(config));
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    },

    async updateConfig(req, res) {
      try {
        let savedPayload;
        const result = await db.withTransaction(async (client) => {
          const existing = await fetchDiscordConfig(client);
          const payload = buildDiscordConfigPayload(req.body, existing || {});
          savedPayload = payload;

          return client.query(
          `INSERT INTO notification_config (
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
           RETURNING *`,
          [
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
          ]
        );
        });

        if (savedPayload && savedPayload.enabled && savedPayload.bot_token && savedPayload.channel_id) {
          try {
            await discordBotService.reinitialize();
          } catch (error) {
            logger.warn('Failed to reinitialize Discord bot:', { error: error.message });
          }
        }

        res.json(maskDiscordConfig(result.rows[0]));
      } catch (error) {
        logger.error('Failed to save Discord notification config:', { error: error.message });
        res.status(500).json({ error: error.message });
      }
    },

    async testConnection(req, res) {
      try {
        const token = await resolveDiscordBotToken(db, req.body?.bot_token, { allowMissingFallback: true });

        if (!token) {
          return res.status(400).json({ error: 'No Discord token found' });
        }

        const result = await discordBotService.testConnection(token, req.body?.channel_id);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    },

    async getServers(req, res) {
      try {
        const token = await resolveDiscordBotToken(db, req.query?.bot_token, { allowMissingFallback: true });

        if (!token) {
          return res.status(400).json({ error: 'No Discord token found' });
        }

        const servers = await discordBotService.getServers(token);
        res.json(servers);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    },

    async getChannels(req, res) {
      try {
        const token = await resolveDiscordBotToken(db, req.query?.bot_token, { allowMissingFallback: true });

        if (!token) {
          return res.status(400).json({ error: 'No Discord token found' });
        }

        const channels = await discordBotService.getChannels(req.params.serverId, token);
        res.json(channels);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    },

    async getChannelDetails(req, res) {
      try {
        const details = await discordBotService.getChannelDetails(req.params.channelId);
        res.json(details);
      } catch (error) {
        logger.error('Error fetching Discord channel details:', { error: error.message });
        res.json({
          id: req.params.channelId,
          name: 'Channel details unavailable',
          guildId: null,
          guildName: 'Server details unavailable',
          partial: true,
          error: error.message,
        });
      }
    },
  };
}

export default {
  buildDiscordConfigPayload,
  createDiscordSettingsHandlers,
  fetchDiscordConfig,
  maskDiscordConfig,
  resolveDiscordBotToken,
};
