/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { buildSettingsErrorResponse } from './settingsErrorSupport.mjs';
import { persistDiscordConfig } from './discordSettingsPersistence.mjs';
import {
  buildDiscordChannelDetailsFallback,
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
        const result = await persistDiscordConfig({
          db,
          body: req.body,
        });

        if (result.shouldReinitialize) {
          try {
            await discordBotService.reinitialize();
          } catch (error) {
            logger.warn('Failed to reinitialize Discord bot:', { error: error.message });
          }
        }

        res.json(maskDiscordConfig(result.config));
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
        res.json(buildDiscordChannelDetailsFallback(req.params.channelId, error));
      }
    },
  };
}

