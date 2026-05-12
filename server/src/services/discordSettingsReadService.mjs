/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  buildDiscordChannelDetailsFallback as defaultBuildDiscordChannelDetailsFallback,
  fetchDiscordConfig as defaultFetchDiscordConfig,
  maskDiscordConfig as defaultMaskDiscordConfig,
} from '../routes/helpers/discordSettingsSupport.mjs';

export function createDiscordSettingsReadService({
  discordBotService,
  logger,
  fetchDiscordConfig = defaultFetchDiscordConfig,
  maskDiscordConfig = defaultMaskDiscordConfig,
  buildDiscordChannelDetailsFallback = defaultBuildDiscordChannelDetailsFallback,
}) {
  return {
    async getConfig({ dbOrClient }) {
      const config = await fetchDiscordConfig(dbOrClient);
      return maskDiscordConfig(config);
    },

    async getChannelDetails({ channelId }) {
      try {
        return await discordBotService.getChannelDetails(channelId);
      } catch (error) {
        logger.error('Error fetching Discord channel details:', { error: error.message });
        return buildDiscordChannelDetailsFallback(channelId, error);
      }
    },
  };
}
