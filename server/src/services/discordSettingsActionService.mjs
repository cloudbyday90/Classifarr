/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { resolveDiscordBotToken as defaultResolveDiscordBotToken } from './shared/discordSettingsModel.mjs';
import { createSettingsServiceError } from './shared/settingsServiceErrors.mjs';

/**
 * @typedef {{
 *   bot_token?: string,
 *   channel_id?: string,
 * }} DiscordSettingsRequestPayload
 */

function buildMissingDiscordTokenError() {
  return createSettingsServiceError('No Discord token found', 400);
}

export function createDiscordSettingsActionService({
  discordBotService,
  resolveDiscordBotToken = defaultResolveDiscordBotToken,
}) {
  return {
    /** @param {{ dbOrClient: unknown, body?: DiscordSettingsRequestPayload }} options */
    async testConnection({ dbOrClient, body = {} }) {
      const token = await resolveDiscordBotToken(dbOrClient, body.bot_token, { allowMissingFallback: true });

      if (!token) {
        throw buildMissingDiscordTokenError();
      }

      return discordBotService.testConnection(token, body.channel_id);
    },

    /** @param {{ dbOrClient: unknown, query?: DiscordSettingsRequestPayload }} options */
    async getServers({ dbOrClient, query = {} }) {
      const token = await resolveDiscordBotToken(dbOrClient, query.bot_token, { allowMissingFallback: true });

      if (!token) {
        throw buildMissingDiscordTokenError();
      }

      return discordBotService.getServers(token);
    },

    /** @param {{ dbOrClient: unknown, query?: DiscordSettingsRequestPayload, serverId: string }} options */
    async getChannels({ dbOrClient, query = {}, serverId }) {
      const token = await resolveDiscordBotToken(dbOrClient, query.bot_token, { allowMissingFallback: true });

      if (!token) {
        throw buildMissingDiscordTokenError();
      }

      return discordBotService.getChannels(serverId, token);
    },
  };
}
