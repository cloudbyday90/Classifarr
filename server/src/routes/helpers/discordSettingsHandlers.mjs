/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { buildSettingsErrorResponse } from './settingsErrorSupport.mjs';
import {
  buildDiscordConfigPayload,
  fetchDiscordConfig,
  maskDiscordConfig,
  resolveDiscordBotToken,
} from './discordSettingsSupport.mjs';

export function createDiscordSettingsHandlers({ db, discordBotService, logger }) {
  return {
    async getConfig(_req, res) {
      try {
        const config = await fetchDiscordConfig(db);
        res.json(maskDiscordConfig(config));
      } catch (error) {
        const response = buildSettingsErrorResponse(error);
        res.status(response.status).json(response.body);
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
        const response = buildSettingsErrorResponse(error);
        res.status(response.status).json(response.body);
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
        const response = buildSettingsErrorResponse(error);
        res.status(response.status).json(response.body);
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
        const response = buildSettingsErrorResponse(error);
        res.status(response.status).json(response.body);
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
        const response = buildSettingsErrorResponse(error);
        res.status(response.status).json(response.body);
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

