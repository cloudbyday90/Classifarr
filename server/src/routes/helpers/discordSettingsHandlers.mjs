/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { buildSettingsErrorResponse } from './settingsErrorSupport.mjs';
import { persistDiscordConfig } from './discordSettingsPersistence.mjs';
import { createDiscordSettingsActionService } from '../../services/discordSettingsActionService.mjs';
import {
  buildDiscordChannelDetailsFallback,
  fetchDiscordConfig,
  maskDiscordConfig,
  resolveDiscordBotToken,
} from './discordSettingsSupport.mjs';

export function createDiscordSettingsHandlers({ db, discordBotService, logger }) {
  const actionService = createDiscordSettingsActionService({
    discordBotService,
    resolveDiscordBotToken,
  });

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
        const result = await actionService.testConnection({
          dbOrClient: db,
          body: req.body,
        });
        res.json(result);
      } catch (error) {
        const response = buildSettingsErrorResponse(error);
        res.status(response.status).json(response.body);
      }
    },

    async getServers(req, res) {
      try {
        const servers = await actionService.getServers({
          dbOrClient: db,
          query: req.query,
        });
        res.json(servers);
      } catch (error) {
        const response = buildSettingsErrorResponse(error);
        res.status(response.status).json(response.body);
      }
    },

    async getChannels(req, res) {
      try {
        const channels = await actionService.getChannels({
          dbOrClient: db,
          query: req.query,
          serverId: req.params.serverId,
        });
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

