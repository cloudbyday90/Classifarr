/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { discordBotService } from './discordBot.mjs';
import { discordDelivery } from './discordDelivery.mjs';
import { createDiscordDeliveryOutbox } from './discordDeliveryOutbox.mjs';
import { createDiscordDeliveryDispatcher } from './discordDeliveryDispatcher.mjs';

const logger = createLogger('DiscordDeliveryDispatcher');
export function createRuntimeDiscordDispatcher() {
  return createDiscordDeliveryDispatcher({
    outbox: createDiscordDeliveryOutbox(db), delivery: discordDelivery,
    report: counts => logger.info('Discord deferred delivery pass completed', counts),
    async getContext() {
      const client = discordBotService.client;
      if (!discordBotService.isInitialized || !client?.isReady()) return null;
      return db.withTransaction(async connection => {
        await connection.query("SET LOCAL statement_timeout = '5s'");
        await connection.query("SET LOCAL lock_timeout = '2s'");
        const { rows: [config] } = await connection.query(
          "SELECT * FROM notification_config WHERE type = 'discord' AND enabled = true ORDER BY id LIMIT 1");
        return config ? { client, config } : null;
      });
    },
  });
}
