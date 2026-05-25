/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import {
  Client,
  GatewayIntentBits,
} from 'discord.js';
import * as db from '../config/database.mjs';

import { discordConfigIntegrityService } from './discordConfigIntegrityService.mjs';
import * as systemAlertService from './systemAlertService.mjs';
import * as interactionHandler from './discordInteractionHandler.mjs';
import * as connectionManager from './discordConnectionManager.mjs';
import { sendConfidenceBasedNotification as sendConfidenceNotification } from './discordConfidenceNotification.mjs';
import { sendClassificationNotification as sendClassificationNotificationFn } from './discordClassificationNotification.mjs';

function warnDiscordRuntimeFailure({ category, message, metadata = {}, dedupeSignature }) {
  discordConfigIntegrityService.warnRuntimeFailure({
    category,
    message,
    metadata,
    dedupeSignature,
  });
}

class DiscordBotService {
  constructor() {
    this.client = null;
    this.channelId = null;
    this.isInitialized = false;
    this.config = null;
  }

  async loadConfig(ignoreEnabledStatus = false) {
    const enabledFilter = ignoreEnabledStatus ? "" : "AND enabled = true";
    const result = await db.query(
      `SELECT * FROM notification_config WHERE type = $1 ${enabledFilter} LIMIT 1`,
      ["discord"],
    );
    if (result.rows.length > 0) {
      this.config = result.rows[0];
      return this.config;
    }

    this.config = {
      bot_token: process.env.DISCORD_BOT_TOKEN,
      channel_id: process.env.DISCORD_CHANNEL_ID,
      enabled: false,
    };
    return this.config;
  }

  async testConnection(botToken = null, channelId = null) {
    const config = botToken ? { bot_token: botToken } : await this.loadConfig(true);
    return connectionManager.testConnection(botToken, channelId, config, connectionManager.checkChannelPermissions);
  }

  checkChannelPermissions(channel, botUserId) {
    return connectionManager.checkChannelPermissions(channel, botUserId);
  }

  async getServers(botToken = null) {
    const config = await this.loadConfig(true);
    return connectionManager.getServers(botToken, config);
  }

  async getChannels(serverId, botToken = null) {
    const config = await this.loadConfig(true);
    return connectionManager.getChannels(serverId, botToken, config);
  }

  async getChannelDetails(channelId, botToken = null) {
    const config = await this.loadConfig(true);
    return connectionManager.getChannelDetails(channelId, botToken, config);
  }

  async reinitialize() {
    if (this.client) {
      await this.client.destroy();
      this.client = null;
      this.isInitialized = false;
    }
    await this.initialize();
  }

  async initialize() {
    const config = await this.loadConfig();
    const token = config.bot_token;
    this.channelId = config.channel_id;

    if (!token || !this.channelId || !config.enabled) {
      throw new Error("Discord bot not configured or not enabled");
    }

    this.client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
    });

    this.client.on("interactionCreate", async (interaction) => {
      await interactionHandler.handleInteraction(interaction);
    });

    await this.client.login(token);
    this.isInitialized = true;
  }

  async sendClassificationNotification(metadata, result) {
    if (!this.isInitialized || !this.client) {
      warnDiscordRuntimeFailure({
        category: 'notification_skipped_not_initialized',
        message: 'Discord classification notification skipped because the bot is not initialized',
        metadata: {
          isInitialized: this.isInitialized,
          hasClient: !!this.client,
        },
        dedupeSignature: `${this.isInitialized}:${!!this.client}:classification`,
      });
      return;
    }

    const config = await this.loadConfig();
    return sendClassificationNotificationFn(metadata, result, {
      client: this.client,
      channelId: this.channelId,
      config,
      warnFn: warnDiscordRuntimeFailure,
    });
  }

  async sendConfidenceBasedNotification(metadata, result) {
    if (!this.isInitialized || !this.client) {
      warnDiscordRuntimeFailure({
        category: 'notification_skipped_not_initialized',
        message: 'Discord confidence-based notification skipped because the bot is not initialized',
        metadata: {
          isInitialized: this.isInitialized,
          hasClient: !!this.client,
        },
        dedupeSignature: `${this.isInitialized}:${!!this.client}:confidence`,
      });
      return;
    }

    const config = await this.loadConfig();
    return sendConfidenceNotification(metadata, result, {
      client: this.client,
      channelId: this.channelId,
      config,
      sendClassificationNotification: this.sendClassificationNotification.bind(this),
      warnFn: warnDiscordRuntimeFailure,
    });
  }

  async sendSystemAlert(serviceKey, newStatus, previousStatus) {
    try {
      if (!this.isInitialized || !this.client) {
        return;
      }

      const config = await this.loadConfig();
      if (!config || config.notify_on_system_errors === false) {
        return;
      }

      const isRecovery = newStatus === 'connected';
      if (systemAlertService.shouldThrottleAlert(serviceKey, isRecovery)) {
        return;
      }

      const channel = await this.client.channels.fetch(this.channelId);
      if (!channel) {
        return;
      }

      const embed = systemAlertService.buildSystemAlertEmbed(serviceKey, newStatus, previousStatus);
      await channel.send({ embeds: [embed] });

      systemAlertService.recordAlertSent(serviceKey);
    } catch (err) {
      warnDiscordRuntimeFailure({
        category: 'system_alert_send_failed',
        message: 'Discord system alert failed to send',
        metadata: {
          error: err.message,
          serviceKey,
          newStatus,
          previousStatus: previousStatus || null,
        },
        dedupeSignature: `${serviceKey}:${newStatus}:${err.code || err.name || err.message}`,
      });
    }
  }
}

export const discordBotService = new DiscordBotService();
