/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { resolveDiscordBotToken as defaultResolveDiscordBotToken } from './shared/discordSettingsModel.mjs';

function buildMissingDiscordTokenError() {
  const error = new Error('No Discord token found');
  error.httpStatus = 400;
  return error;
}

export function createDiscordSettingsActionService({
  discordBotService,
  resolveDiscordBotToken = defaultResolveDiscordBotToken,
}) {
  return {
    async testConnection({ dbOrClient, body = {} }) {
      const token = await resolveDiscordBotToken(dbOrClient, body.bot_token, { allowMissingFallback: true });

      if (!token) {
        throw buildMissingDiscordTokenError();
      }

      return discordBotService.testConnection(token, body.channel_id);
    },

    async getServers({ dbOrClient, query = {} }) {
      const token = await resolveDiscordBotToken(dbOrClient, query.bot_token, { allowMissingFallback: true });

      if (!token) {
        throw buildMissingDiscordTokenError();
      }

      return discordBotService.getServers(token);
    },

    async getChannels({ dbOrClient, query = {}, serverId }) {
      const token = await resolveDiscordBotToken(dbOrClient, query.bot_token, { allowMissingFallback: true });

      if (!token) {
        throw buildMissingDiscordTokenError();
      }

      return discordBotService.getChannels(serverId, token);
    },
  };
}
