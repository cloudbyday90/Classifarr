/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createDiscordSettingsActionService } from '../../services/discordSettingsActionService.mjs';
import { persistDiscordConfig } from '../../services/discordSettingsPersistenceService.mjs';
import { createDiscordSettingsReadService } from '../../services/discordSettingsReadService.mjs';
import {
  buildDiscordConfigUpdateResponse,
  reinitializeDiscordBotIfNeeded,
  sendDiscordErrorResponse,
} from './discordSettingsResponseSupport.mjs';

export function createDiscordSettingsHandlers({ db, discordBotService, logger }) {
  const actionService = createDiscordSettingsActionService({
    discordBotService,
  });
  const readService = createDiscordSettingsReadService({
    discordBotService,
    logger,
  });

  return {
    async getConfig(_req, res) {
      try {
        const config = await readService.getConfig({ dbOrClient: db });
        res.json(config);
      } catch (error) {
        sendDiscordErrorResponse(res, error);
      }
    },

    async updateConfig(req, res) {
      try {
        const result = await persistDiscordConfig({
          db,
          body: req.body,
        });

        await reinitializeDiscordBotIfNeeded({
          shouldReinitialize: result.shouldReinitialize,
          discordBotService,
          logger,
        });

        res.json(buildDiscordConfigUpdateResponse(result.config));
      } catch (error) {
        sendDiscordErrorResponse(res, error, {
          logger,
          logMessage: 'Failed to save Discord notification config:',
        });
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
        sendDiscordErrorResponse(res, error);
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
        sendDiscordErrorResponse(res, error);
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
        sendDiscordErrorResponse(res, error);
      }
    },

    async getChannelDetails(req, res) {
      try {
        const details = await readService.getChannelDetails({
          channelId: req.params.channelId,
        });
        res.json(details);
      } catch (error) {
        sendDiscordErrorResponse(res, error);
      }
    },
  };
}

