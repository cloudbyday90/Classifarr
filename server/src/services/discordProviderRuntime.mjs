/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { createDiscordProviderCooldown } from './discordProviderCooldown.mjs';
import { createDiscordProviderGate } from './discordProviderGate.mjs';
import { createDiscordClient } from './discordClientFactory.mjs';

const logger = createLogger('DiscordProviderGate');
export const discordProviderGate = createDiscordProviderGate({
  cooldown: createDiscordProviderCooldown(db),
  warn: () => logger.warn('Discord cooldown save failed; subsequent bot requests held', {
    code: 'discord_cooldown_persistence_unavailable',
  }),
});

/** @param {import('discord.js').ClientOptions} options */
export const createRuntimeDiscordClient = options => createDiscordClient(options, {}, discordProviderGate);
