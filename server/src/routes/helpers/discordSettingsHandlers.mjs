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
import { asyncHandler } from '../../utils/asyncHandler.mjs';
import { sendData } from '../../utils/responseHelpers.mjs';
import {
  buildDiscordConfigUpdateResponse,
  reinitializeDiscordBotIfNeeded,
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
    getConfig: asyncHandler(async (_req, res) => {
      const config = await readService.getConfig({ dbOrClient: db });
      return sendData(res, config);
    }),

    updateConfig: asyncHandler(async (req, res) => {
      const result = await persistDiscordConfig({
        db,
        body: req.body,
      });

      await reinitializeDiscordBotIfNeeded({
        shouldReinitialize: result.shouldReinitialize,
        discordBotService,
        logger,
      });

      return sendData(res, buildDiscordConfigUpdateResponse(result.config));
    }),

    testConnection: asyncHandler(async (req, res) => {
      const result = await actionService.testConnection({
        dbOrClient: db,
        body: req.body,
      });
      return sendData(res, result);
    }),

    getServers: asyncHandler(async (req, res) => {
      const servers = await actionService.getServers({
        dbOrClient: db,
        query: req.query,
      });
      return sendData(res, servers);
    }),

    getChannels: asyncHandler(async (req, res) => {
      const channels = await actionService.getChannels({
        dbOrClient: db,
        query: req.query,
        serverId: req.params.serverId,
      });
      return sendData(res, channels);
    }),

    getMentionTargets: asyncHandler(async (req, res) => {
      const targets = await actionService.getMentionTargets({
        dbOrClient: db,
        query: req.query,
        serverId: req.params.serverId,
      });
      return sendData(res, targets);
    }),

    getChannelDetails: asyncHandler(async (req, res) => {
      const details = await readService.getChannelDetails({
        channelId: req.params.channelId,
      });
      return sendData(res, details);
    }),
  };
}
