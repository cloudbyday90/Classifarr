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
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from 'discord.js';
import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { clarificationService } from './clarificationService.mjs';
import { discordConfigIntegrityService } from './discordConfigIntegrityService.mjs';
import * as notificationBuilder from './discordNotificationBuilder.mjs';
import * as systemAlertService from './systemAlertService.mjs';
import * as interactionHandler from './discordInteractionHandler.mjs';

const logger = createLogger("discordBot");

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
    let testClient = null;
    try {
      const token = botToken || (await this.loadConfig(true)).bot_token;
      if (!token) {
        return { success: false, error: "No bot token provided" };
      }

      testClient = new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
      });

      await testClient.login(token);

      const user = testClient.user;
      const guilds = testClient.guilds.cache.size;

      const response = {
        success: true,
        message: "Bot connected successfully",
        botUser: {
          id: user.id,
          username: user.username,
          discriminator: user.discriminator,
        },
        guildsCount: guilds,
      };

      if (channelId) {
        try {
          const channel = await testClient.channels.fetch(channelId);
          if (!channel) {
            return { success: false, error: "Channel not found" };
          }

          const guild = channel.guild;
          if (guild) {
            try {
              await guild.members.fetch(testClient.user.id);
            } catch (fetchError) {
              logger.warn(
                "Could not fetch bot member for permission check:",
                fetchError.message,
              );
            }
          }

          const permissions = this.checkChannelPermissions(
            channel,
            testClient.user.id,
          );
          response.permissions = permissions;

          const missingCritical = permissions.missing.filter((p) =>
            ["SendMessages", "EmbedLinks"].includes(p),
          );

          if (missingCritical.length > 0) {
            return {
              success: false,
              error: `Missing critical permissions: ${missingCritical.join(", ")}`,
              permissions,
              botUser: response.botUser,
              guildsCount: response.guildsCount,
            };
          }

          const testEmbed = new EmbedBuilder()
            .setTitle("✅ Classifarr Test Notification")
            .setDescription(
              "Your Discord bot is configured correctly and can send notifications!",
            )
            .setColor(0x00ff00)
            .addFields(
              { name: "Bot", value: user.username, inline: true },
              { name: "Channel", value: `#${channel.name}`, inline: true },
              {
                name: "Server",
                value: channel.guild?.name || "Unknown",
                inline: true,
              },
            )
            .setTimestamp()
            .setFooter({ text: "This is a test message from Classifarr" });

          const sentMessage = await channel.send({ embeds: [testEmbed] });

          response.notification = {
            sent: true,
            messageId: sentMessage.id,
            channelName: channel.name,
            serverName: channel.guild?.name || "Unknown",
          };
          response.message =
            "Test notification sent successfully! Check your Discord channel.";

          if (permissions.missing.length > 0) {
            response.warning = `Some optional permissions are missing: ${permissions.missing.join(", ")}. This may limit functionality.`;
          }
        } catch (channelError) {
          return {
            success: false,
            error: `Failed to send test notification: ${channelError.message}`,
            botUser: response.botUser,
            permissions: response.permissions,
          };
        }
      }

      return response;
    } catch (error) {
      return {
        success: false,
        error: error.message.includes("token")
          ? "Invalid bot token"
          : error.message,
      };
    } finally {
      if (testClient) {
        await testClient.destroy();
      }
    }
  }

  checkChannelPermissions(channel, botUserId) {
    const requiredPermissions = [
      "SendMessages",
      "EmbedLinks",
      "AttachFiles",
      "ReadMessageHistory",
      "UseExternalEmojis",
      "AddReactions",
    ];

    const permissionMap = {
      SendMessages: PermissionFlagsBits.SendMessages,
      EmbedLinks: PermissionFlagsBits.EmbedLinks,
      AttachFiles: PermissionFlagsBits.AttachFiles,
      ReadMessageHistory: PermissionFlagsBits.ReadMessageHistory,
      UseExternalEmojis: PermissionFlagsBits.UseExternalEmojis,
      AddReactions: PermissionFlagsBits.AddReactions,
    };

    const botMember = channel.guild.members.cache.get(botUserId);
    if (!botMember) {
      return {
        granted: [],
        missing: requiredPermissions,
        all: false,
      };
    }

    const channelPermissions = channel.permissionsFor(botMember);
    if (!channelPermissions) {
      return {
        granted: [],
        missing: requiredPermissions,
        all: false,
      };
    }

    const granted = [];
    const missing = [];

    requiredPermissions.forEach((perm) => {
      const permBit = permissionMap[perm];
      if (permBit && channelPermissions.has(permBit)) {
        granted.push(perm);
      } else {
        missing.push(perm);
      }
    });

    return {
      granted,
      missing,
      all: missing.length === 0,
    };
  }

  async getServers(botToken = null) {
    let testClient = null;
    try {
      const storedConfig = await this.loadConfig(true);
      const token = storedConfig?.bot_token || botToken;
      if (!token) {
        throw new Error("No bot token configured");
      }

      testClient = new Client({
        intents: [GatewayIntentBits.Guilds],
      });

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Discord client login timeout"));
        }, 10000);

        testClient.once("ready", () => {
          clearTimeout(timeout);
          resolve();
        });
        testClient.once("error", (err) => {
          clearTimeout(timeout);
          reject(err);
        });
        testClient.login(token).catch((err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      const guilds = testClient.guilds.cache.map((guild) => ({
        id: guild.id,
        name: guild.name,
        icon: guild.iconURL(),
        memberCount: guild.memberCount,
      }));

      return guilds;
    } catch (error) {
      throw new Error(`Failed to fetch servers: ${error.message}`);
    } finally {
      if (testClient) {
        await testClient.destroy().catch(() => {}); // swallow-error: best-effort cleanup of test client in finally block
      }
    }
  }

  async getChannels(serverId, botToken = null) {
    let testClient = null;
    try {
      const storedConfig = await this.loadConfig(true);
      const token = storedConfig?.bot_token || botToken;
      if (!token) {
        throw new Error("No bot token configured");
      }

      testClient = new Client({
        intents: [GatewayIntentBits.Guilds],
      });

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Discord client login timeout"));
        }, 10000);

        testClient.once("ready", () => {
          clearTimeout(timeout);
          resolve();
        });
        testClient.once("error", (err) => {
          clearTimeout(timeout);
          reject(err);
        });
        testClient.login(token).catch((err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      const guild = testClient.guilds.cache.get(serverId);
      if (!guild) {
        throw new Error("Server not found or bot not added to this server");
      }

      await guild.channels.fetch();

      const channels = guild.channels.cache
        .filter((channel) => channel.isTextBased() && !channel.isThread())
        .map((channel) => ({
          id: channel.id,
          name: channel.name,
          type: channel.type,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      return channels;
    } catch (error) {
      throw new Error(`Failed to fetch channels: ${error.message}`);
    } finally {
      if (testClient) {
        await testClient.destroy().catch(() => {}); // swallow-error: best-effort cleanup of test client in finally block
      }
    }
  }

  async getChannelDetails(channelId, botToken = null) {
    try {
      logger.info(
        `[Discord] Fetching channel details for channel ID: ${channelId}`,
      );

      const storedConfig = await this.loadConfig(true);
      const token = storedConfig?.bot_token || botToken;

      if (!token) {
        throw new Error("No bot token configured");
      }

      logger.info(
        `[Discord] Using ${storedConfig?.bot_token ? "stored" : "provided"} bot token`,
      );

      const testClient = new Client({
        intents: [GatewayIntentBits.Guilds],
      });

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Discord client login timeout"));
        }, 10000);

        testClient.once("ready", () => {
          clearTimeout(timeout);
          resolve();
        });
        testClient.once("error", (err) => {
          clearTimeout(timeout);
          reject(err);
        });
        testClient.login(token).catch((err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      try {
        const channel = await testClient.channels.fetch(channelId);
        if (!channel) {
          throw new Error("Channel not found");
        }

        let guildName = "Unknown Server";
        if (channel.guild) {
          if (!channel.guild.name) {
            await channel.guild.fetch();
          }
          guildName = channel.guild.name || "Unknown Server";
        }

        const result = {
          id: channel.id,
          name: channel.name,
          guildId: channel.guildId,
          guildName: guildName,
        };

        logger.info(
          `[Discord] Successfully fetched channel: ${channel.name} in guild: ${channel.guild?.name || "Unknown"}`,
        );

        return result;
      } finally {
        await testClient.destroy();
      }
    } catch (error) {
      logger.error(
        `Failed to fetch channel details for ${channelId}:`,
        error.message,
      );
      throw error;
    }
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

    try {
      const config = await this.loadConfig();

      if (!config.notify_on_classification) {
        return;
      }

      const channel = await this.client.channels.fetch(this.channelId);
      if (!channel) {
        warnDiscordRuntimeFailure({
          category: 'channel_not_found',
          message: 'Discord classification notification skipped because the configured channel was not found',
          metadata: {
            channelId: this.channelId,
          },
          dedupeSignature: `classification:${this.channelId || 'missing'}`,
        });
        return;
      }

      const embed = notificationBuilder.buildSimpleNotificationEmbed(metadata, result, config);

      let components = [];
      if (config.enable_corrections) {
        components = await notificationBuilder.createCorrectionComponents(
          result.classification_id,
          result.libraries,
          config.correction_buttons_count || 3,
          config.include_library_dropdown !== false,
        );
      }

      const message = await channel.send({
        embeds: [embed],
        components: components,
      });

      await db.query(
        "UPDATE classification_history SET metadata = metadata || $1 WHERE id = $2",
        [
          JSON.stringify({ discord_message_id: message.id }),
          result.classification_id,
        ],
      );
    } catch (error) {
      warnDiscordRuntimeFailure({
        category: 'notification_send_failed',
        message: 'Discord classification notification failed to send',
        metadata: {
          error: error.message,
          title: metadata?.title || null,
          classificationId: result?.classification_id || null,
        },
        dedupeSignature: `${error.code || error.name || error.message}:classification`,
      });
    }
  }

  async sendConfidenceBasedNotification(metadata, result) {
    logger.info("[Discord] Notification attempt", {
      title: metadata.title,
      confidence: result.confidence,
      initialized: this.isInitialized,
      hasClient: !!this.client,
      classificationId: result.classification_id,
    });

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

    try {
      const config = await this.loadConfig();

      logger.info("[Discord] Config check", {
        enabled: config.enabled,
        notify_on_classification: config.notify_on_classification,
        bot_token_present: !!config.bot_token,
        channel_id_present: !!config.channel_id,
      });

      if (!config.enabled) {
        logger.info(
          "[Discord] Notifications disabled via enabled flag - skipping",
          {
            enabled: config.enabled,
          },
        );
        return;
      }

      if (!config.notify_on_classification) {
        logger.info("[Discord] Notifications disabled in config - skipping");
        return;
      }

      const requireAllConfirmations =
        await clarificationService.isRequireAllConfirmationsEnabled();

      let policyThresholds = null;
      const ranked = result?.policyResult?.ranked || [];
      const libraryId = result?.library?.id;
      if (Array.isArray(ranked) && ranked.length > 0 && libraryId) {
        const row = ranked.find((r) => r && r.library_id === libraryId);
        if (
          row &&
          typeof row.auto_classify_threshold === 'number' &&
          typeof row.prompt_threshold === 'number'
        ) {
          policyThresholds = {
            auto_classify_threshold: row.auto_classify_threshold,
            prompt_threshold: row.prompt_threshold,
          };
        }
      }

      const tier =
        clarificationService.getTierFromPolicyThresholds(
          result.confidence,
          policyThresholds,
          requireAllConfirmations,
        ) || (await clarificationService.getTierForConfidence(result.confidence));

      logger.info("[Discord] Tier lookup result", {
        confidence: result.confidence,
        tier: tier ? tier.tier : "null",
        action: tier ? tier.action : "null",
        policyThresholds: policyThresholds || "none",
      });

      if (!tier) {
        logger.warn(
          "[Discord] No tier found, falling back to standard notification",
          {
            confidence: result.confidence,
          },
        );
        return this.sendClassificationNotification(metadata, result);
      }

      const channel = await this.client.channels.fetch(this.channelId);
      if (!channel) {
        warnDiscordRuntimeFailure({
          category: 'channel_not_found',
          message: 'Discord confidence-based notification skipped because the configured channel was not found',
          metadata: {
            channelId: this.channelId,
          },
          dedupeSignature: `confidence:${this.channelId || 'missing'}`,
        });
        return;
      }

      const hasClarification =
        result.needs_clarification && result.clarification;

      logger.info("[Discord] Creating notification", {
        tier: tier.tier,
        hasClarification,
        requireAllConfirmations,
      });

      const embed = await notificationBuilder.createTieredEmbed(
        metadata,
        result,
        tier,
        requireAllConfirmations,
        hasClarification,
      );

      const components = await notificationBuilder.createTieredComponents(
        result.classification_id,
        result.libraries,
        tier,
        metadata,
        result.confidence,
        requireAllConfirmations,
        hasClarification ? result.clarification : null,
      );

      const message = await channel.send({
        embeds: [embed],
        components: components,
      });

      logger.info("[Discord] Notification sent successfully", {
        messageId: message.id,
        tier: tier.tier,
        confidence: result.confidence,
      });

      const status = hasClarification ? "awaiting_clarification" : tier.action;
      await db.query(
        "UPDATE classification_history SET discord_message_id = $1, clarification_status = $2 WHERE id = $3",
        [message.id, status, result.classification_id],
      );
    } catch (error) {
      warnDiscordRuntimeFailure({
        category: 'notification_send_failed',
        message: 'Discord confidence-based notification failed to send',
        metadata: {
          error: error.message,
          title: metadata.title,
          confidence: result.confidence,
          classificationId: result?.classification_id || null,
        },
        dedupeSignature: `${error.code || error.name || error.message}:confidence`,
      });
    }
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
