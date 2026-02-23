/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require("discord.js");
const db = require("../config/database");
const clarificationService = require("./clarificationService");
const autoLearningService = require("./autoLearningService");

class DiscordBotService {
  constructor() {
    this.client = null;
    this.channelId = null;
    this.isInitialized = false;
    this.config = null;
  }

  async loadConfig(ignoreEnabledStatus = false) {
    // For API calls (getServers, getChannels, getChannelDetails), we need the token
    // regardless of enabled status. Only for initialization should we check enabled.
    // v0.37.8b-alpha: Added ignoreEnabledStatus parameter to fix config persistence
    const enabledFilter = ignoreEnabledStatus ? "" : "AND enabled = true";
    const result = await db.query(
      `SELECT * FROM notification_config WHERE type = $1 ${enabledFilter} LIMIT 1`,
      ["discord"],
    );
    if (result.rows.length > 0) {
      this.config = result.rows[0];
      return this.config;
    }

    // Fall back to environment variables
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
      // Use ignoreEnabledStatus=true to allow testing even when bot is disabled
      const token = botToken || (await this.loadConfig(true)).bot_token;
      if (!token) {
        return { success: false, error: "No bot token provided" };
      }

      // Create temporary client to test
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

      // If channel_id is provided, test sending notification and check permissions
      if (channelId) {
        try {
          const channel = await testClient.channels.fetch(channelId);
          if (!channel) {
            return { success: false, error: "Channel not found" };
          }

          // Ensure bot member is in cache for permission checking
          const guild = channel.guild;
          if (guild) {
            try {
              await guild.members.fetch(testClient.user.id);
            } catch (fetchError) {
              console.warn(
                "Could not fetch bot member for permission check:",
                fetchError.message,
              );
            }
          }

          // Check permissions
          const permissions = this.checkChannelPermissions(
            channel,
            testClient.user.id,
          );
          response.permissions = permissions;

          // Check for critical missing permissions
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

          // Send test notification
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

          // Warn about non-critical missing permissions
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

  /**
   * Check if the bot has all required permissions in a channel
   * @param {Channel} channel - Discord channel object
   * @param {string} botUserId - Bot user ID
   * @returns {Object} Permissions status
   */
  checkChannelPermissions(channel, botUserId) {
    const requiredPermissions = [
      "SendMessages",
      "EmbedLinks",
      "AttachFiles",
      "ReadMessageHistory",
      "UseExternalEmojis",
      "AddReactions",
    ];

    // Mapping for permission names to PermissionFlagsBits
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
      // Edge case: permissionsFor can return null in certain scenarios
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
    try {
      // Always prefer stored token (the passed botToken might be masked from frontend)
      // Use ignoreEnabledStatus=true to get token even when bot is disabled
      const storedConfig = await this.loadConfig(true);
      const token = storedConfig?.bot_token || botToken;
      if (!token) {
        throw new Error("No bot token configured");
      }

      // Create temporary client
      const testClient = new Client({
        intents: [GatewayIntentBits.Guilds],
      });

      // Wait for client to be fully ready before accessing guilds
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Discord client login timeout"));
        }, 10000); // 10 second timeout

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

      await testClient.destroy();

      return guilds;
    } catch (error) {
      throw new Error(`Failed to fetch servers: ${error.message}`);
    }
  }

  async getChannels(serverId, botToken = null) {
    try {
      // Always prefer stored token (the passed botToken might be masked from frontend)
      // Use ignoreEnabledStatus=true to get token even when bot is disabled
      const storedConfig = await this.loadConfig(true);
      const token = storedConfig?.bot_token || botToken;
      if (!token) {
        throw new Error("No bot token configured");
      }

      // Create temporary client
      const testClient = new Client({
        intents: [GatewayIntentBits.Guilds],
      });

      // Wait for client to be fully ready before accessing guilds
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Discord client login timeout"));
        }, 10000); // 10 second timeout

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
        await testClient.destroy();
        throw new Error("Server not found or bot not added to this server");
      }

      // Fetch all channels to ensure cache is populated
      await guild.channels.fetch();

      const channels = guild.channels.cache
        .filter((channel) => channel.isTextBased() && !channel.isThread())
        .map((channel) => ({
          id: channel.id,
          name: channel.name,
          type: channel.type,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      await testClient.destroy();

      return channels;
    } catch (error) {
      throw new Error(`Failed to fetch channels: ${error.message}`);
    }
  }

  async getChannelDetails(channelId, botToken = null) {
    try {
      console.log(
        `[Discord] Fetching channel details for channel ID: ${channelId}`,
      );

      // Always prefer stored token
      // Use ignoreEnabledStatus=true to get token even when bot is disabled
      const storedConfig = await this.loadConfig(true);
      const token = storedConfig?.bot_token || botToken;

      if (!token) {
        throw new Error("No bot token configured");
      }

      console.log(
        `[Discord] Using ${storedConfig?.bot_token ? "stored" : "provided"} bot token`,
      );

      // Create temporary client
      const testClient = new Client({
        intents: [GatewayIntentBits.Guilds],
      });

      // Wait for client to be fully ready
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Discord client login timeout"));
        }, 10000); // 10 second timeout

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

        // Ensure guild is available and fetched
        let guildName = "Unknown Server";
        if (channel.guild) {
          // Fetch full guild object if not cached
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

        console.log(
          `[Discord] Successfully fetched channel: ${channel.name} in guild: ${channel.guild?.name || "Unknown"}`,
        );

        return result;
      } finally {
        await testClient.destroy();
      }
    } catch (error) {
      // Log the error with context, then re-throw for route handler
      console.error(
        `Failed to fetch channel details for ${channelId}:`,
        error.message,
      );
      throw error; // Re-throw so the route handler can return appropriate status
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

    // Handle interactions
    this.client.on("interactionCreate", async (interaction) => {
      await this.handleInteraction(interaction);
    });

    await this.client.login(token);
    this.isInitialized = true;
  }

  async sendClassificationNotification(metadata, result) {
    if (!this.isInitialized || !this.client) {
      console.warn("Discord bot not initialized");
      return;
    }

    try {
      const config = await this.loadConfig();

      // Check if notifications are enabled for classifications
      if (!config.notify_on_classification) {
        return;
      }

      const channel = await this.client.channels.fetch(this.channelId);
      if (!channel) {
        console.error("Discord channel not found");
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(
          `${this.getMediaTypeEmoji(metadata.media_type)} ${metadata.title} (${metadata.year || "N/A"})`,
        )
        .setDescription(`Classified as: **${result.library_name}**`)
        .setColor(this.getColorForConfidence(result.confidence))
        .setTimestamp();

      // Add fields based on config
      const fields = [
        {
          name: "Media Type",
          value: metadata.media_type === "movie" ? "Movie" : "TV Show",
          inline: true,
        },
      ];

      if (config.show_confidence) {
        fields.push({
          name: "Confidence",
          value: `${result.confidence}%`,
          inline: true,
        });
      }

      if (config.show_method) {
        fields.push({
          name: "Method",
          value: this.formatMethod(result.method),
          inline: true,
        });
      }

      if (config.show_reason && result.reason) {
        fields.push({ name: "Reason", value: result.reason, inline: false });
      }

      if (config.show_metadata && metadata) {
        const metadataStr = Object.entries(metadata)
          .filter(
            ([key]) =>
              !["title", "year", "media_type", "poster_path"].includes(key),
          )
          .map(([key, value]) => `${key}: ${value}`)
          .join("\n");
        if (metadataStr) {
          fields.push({
            name: "Metadata",
            value: metadataStr.substring(0, 1024),
            inline: false,
          });
        }
      }

      embed.addFields(fields);

      if (config.show_poster && metadata.poster_path) {
        embed.setThumbnail(
          `https://image.tmdb.org/t/p/w200${metadata.poster_path}`,
        );
      }

      // Create correction buttons if enabled
      let components = [];
      if (config.enable_corrections) {
        components = await this.createCorrectionComponents(
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

      // Store message ID for later updates
      await db.query(
        "UPDATE classification_history SET metadata = metadata || $1 WHERE id = $2",
        [
          JSON.stringify({ discord_message_id: message.id }),
          result.classification_id,
        ],
      );
    } catch (error) {
      console.error("Failed to send Discord notification:", error);
    }
  }

  async sendConfidenceBasedNotification(metadata, result) {
    // Enhanced logging for debugging notification issues (v0.38.4-alpha)
    // These console.log statements are intentional and help diagnose
    // why notifications may not appear on Discord (e.g., tier lookup failures)
    console.log("[Discord] Notification attempt", {
      title: metadata.title,
      confidence: result.confidence,
      initialized: this.isInitialized,
      hasClient: !!this.client,
      classificationId: result.classification_id,
    });

    if (!this.isInitialized || !this.client) {
      console.warn("[Discord] Bot not initialized - notification skipped", {
        isInitialized: this.isInitialized,
        hasClient: !!this.client,
      });
      return;
    }

    try {
      const config = await this.loadConfig();

      // Log enabled flag value (Bug #11 logging)
      console.log("[Discord] Config check", {
        enabled: config.enabled,
        notify_on_classification: config.notify_on_classification,
        bot_token_present: !!config.bot_token,
        channel_id_present: !!config.channel_id,
      });

      if (!config.enabled) {
        console.log(
          "[Discord] Notifications disabled via enabled flag - skipping",
          {
            enabled: config.enabled,
          },
        );
        return;
      }

      if (!config.notify_on_classification) {
        console.log("[Discord] Notifications disabled in config - skipping");
        return;
      }

      // Check if user requires all confirmations
      const requireAllConfirmations =
        await clarificationService.isRequireAllConfirmationsEnabled();

      // Prefer per-policy thresholds when available (matches the UI Policy Engine thresholds).
      // Fall back to DB-driven global confidence tiers when policy context is missing.
      let policyThresholds = null;
      const ranked = result?.policyResult?.ranked || [];
      const libraryId = result?.library?.id;
      if (Array.isArray(ranked) && ranked.length > 0 && libraryId) {
        const row = ranked.find((r) => r && r.library_id === libraryId);
        if (
          row &&
          typeof row.auto_classify_threshold === "number" &&
          typeof row.prompt_threshold === "number"
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

      console.log("[Discord] Tier lookup result", {
        confidence: result.confidence,
        tier: tier ? tier.tier : "null",
        action: tier ? tier.action : "null",
        policyThresholds: policyThresholds || "none",
      });

      if (!tier) {
        console.warn(
          "[Discord] No tier found, falling back to standard notification",
          {
            confidence: result.confidence,
          },
        );
        // Fallback to standard notification
        return this.sendClassificationNotification(metadata, result);
      }

      const channel = await this.client.channels.fetch(this.channelId);
      if (!channel) {
        console.error("[Discord] Channel not found", {
          channelId: this.channelId,
        });
        return;
      }

      // Check if AI needs clarification - use AI-generated question instead of pre-configured ones
      const hasClarification =
        result.needs_clarification && result.clarification;

      console.log("[Discord] Creating notification", {
        tier: tier.tier,
        hasClarification,
        requireAllConfirmations,
      });

      // Create embed based on tier (and clarification/requireAllConfirmations setting)
      const embed = await this.createTieredEmbed(
        metadata,
        result,
        tier,
        requireAllConfirmations,
        hasClarification,
      );

      // Create components based on tier and clarification
      const components = await this.createTieredComponents(
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

      console.log("[Discord] Notification sent successfully", {
        messageId: message.id,
        tier: tier.tier,
        confidence: result.confidence,
      });

      // Store message ID and clarification status
      const status = hasClarification ? "awaiting_clarification" : tier.action;
      await db.query(
        "UPDATE classification_history SET discord_message_id = $1, clarification_status = $2 WHERE id = $3",
        [message.id, status, result.classification_id],
      );
    } catch (error) {
      console.error("[Discord] Failed to send confidence-based notification:", {
        error: error.message,
        stack: error.stack,
        title: metadata.title,
        confidence: result.confidence,
      });
    }
  }

  /**
   * Get emoji for media type
   * @param {string} mediaType - 'movie' or 'tv'
   * @returns {string} Emoji for media type
   */
  getMediaTypeEmoji(mediaType) {
    return mediaType === "movie" ? "🎬" : "📺";
  }

  async createTieredEmbed(
    metadata,
    result,
    tier,
    requireAllConfirmations = false,
    hasClarification = false,
  ) {
    const colors = {
      auto: 0x00ff00, // Green
      verify: 0xffff00, // Yellow
      clarify: 0x0099ff, // Blue
      manual: 0xff0000, // Red
      clarification: 0x9333ea, // Purple - for AI clarification questions
    };

    const icons = {
      auto: "✅",
      verify: "⚠️",
      clarify: "❓",
      manual: "🛑",
      clarification: "🤔",
    };

    // Use clarification styling if AI needs help
    const effectiveTier = hasClarification ? "clarification" : tier.tier;

    // Use media type emoji for title instead of tier icon when showing clarification
    const titleEmoji = hasClarification
      ? this.getMediaTypeEmoji(metadata.media_type)
      : icons[effectiveTier];

    const embed = new EmbedBuilder()
      .setTitle(`${titleEmoji} ${metadata.title} (${metadata.year || "N/A"})`)
      .setColor(colors[effectiveTier])
      .setTimestamp();

    const topAlternatives = this.getTopAlternatives(result, 3);
    const suggestedLibraryName = this.resolveSuggestedLibraryName(result, topAlternatives);

    // AI Clarification - special format with context
    if (hasClarification && result.clarification) {
      const clarification = result.clarification;
      const mediaTypeLabel =
        metadata.media_type === "movie" ? "movie" : "TV show";
      embed.setDescription(
        `🤔 **I need your help classifying this ${mediaTypeLabel}**\n\n` +
          `⚠️ **Problem:** ${clarification.problem_summary}\n\n` +
          `💭 **Why I'm asking:** ${clarification.why_uncertain}\n\n` +
          `📁 **Question:** ${clarification.question}`,
      );
    } else if (tier.tier === "auto" && !requireAllConfirmations) {
      embed.setDescription(
        `✅ **Automatically routed to: ${result.library_name}**\n${tier.description}`,
      );
    } else if (tier.tier === "auto" && requireAllConfirmations) {
      embed.setDescription(
        `⚠️ **Suggested library: ${suggestedLibraryName}**\n${tier.description}\n\n🔒 **Manual confirmation required** (setting enabled)\nPlease confirm or select another option.`,
      );
      embed.setColor(colors.verify);
    } else if (tier.tier === "verify") {
      embed.setDescription(
        `⚠️ **Suggested library: ${suggestedLibraryName}**\n${tier.description}\n\nPlease confirm or select another option.`,
      );
    } else if (tier.tier === "clarify") {
      embed.setDescription(
        `❓ **Suggested library: ${suggestedLibraryName}**\n${tier.description}\n\nPlease answer the questions below to improve accuracy.`,
      );
    } else {
      embed.setDescription(
        `🛑 **Suggested library: ${suggestedLibraryName}**\n${tier.description}\n\nPlease answer the questions or select a library manually.`,
      );
    }

    const fields = [
      {
        name: "Media Type",
        value: metadata.media_type === "movie" ? "Movie" : "TV Show",
        inline: true,
      },
      { name: "Confidence", value: `${result.confidence}%`, inline: true },
      { name: "Method", value: this.formatMethod(result.method), inline: true },
    ];

    // Don't show reason if we're showing clarification context (redundant)
    if (result.reason && !hasClarification) {
      fields.push({ name: "Reason", value: result.reason, inline: false });
    }

    // Enhanced context: Add top alternatives with scores when available.
    if (topAlternatives.length > 0) {
      const alternativesText = topAlternatives
        .map((entry) => {
          const pct = this.formatDisplayPercent(entry.score);
          return pct ? `${entry.name} (${pct})` : entry.name;
        })
        .join(", ");

      fields.push({
        name: "📊 Top Alternatives",
        value: alternativesText,
        inline: false
      });
    }

    // Enhanced context: Add signal breakdown if available
    if (result.signal_scores) {
      const signalBreakdown = Object.entries(result.signal_scores)
        .filter(([_, score]) => score > 0)
        .map(([signal, score]) => `${signal}: ${score}%`)
        .join(', ');
      if (signalBreakdown) {
        fields.push({
          name: "🔍 Signal Breakdown",
          value: signalBreakdown,
          inline: false
        });
      }
    }

    // Enhanced context: Add matched genres/keywords if available
    if (metadata.genres && metadata.genres.length > 0) {
      const genreList = metadata.genres.slice(0, 5).join(', ');
      fields.push({
        name: "🎭 Genres",
        value: genreList,
        inline: false
      });
    }

    // Enhanced context: Add similar items from RAG if available
    try {
      const ragRetriever = require('./ragRetriever');
      if (metadata.title && result.library_id) {
        const similarItems = await ragRetriever.findSimilarItems(
          metadata.title,
          result.library_id,
          3
        );
        if (similarItems && similarItems.length > 0) {
          const similarList = similarItems
            .map(item => item.title || item.name)
            .filter(Boolean)
            .join(', ');
          if (similarList) {
            fields.push({
              name: "📚 Similar in Library",
              value: similarList,
              inline: false
            });
          }
        }
      }
    } catch (ragError) {
      // RAG is optional, don't fail if not available
      console.log('[Discord] RAG similar items not available:', ragError.message);
    }

    // Add content analysis if available
    if (metadata.contentAnalysis && metadata.contentAnalysis.bestMatch) {
      const analysis = metadata.contentAnalysis.bestMatch;
      fields.push({
        name: "Content Type Detected",
        value: `${analysis.type} (${analysis.confidence}% confidence)`,
        inline: false,
      });
    }

    embed.addFields(fields);

    if (metadata.poster_path) {
      embed.setThumbnail(
        `https://image.tmdb.org/t/p/w200${metadata.poster_path}`,
      );
    }

    return embed;
  }

  resolveSuggestedLibraryName(result, topAlternatives = []) {
    const candidates = [
      result?.library_name,
      result?.library?.name,
      result?.suggested_library_name,
      result?.signalContext?.suggestedLibrary?.name,
      result?.policyResult?.library?.library_name,
      result?.policyResult?.library?.name,
      Array.isArray(topAlternatives) && topAlternatives.length > 0 ? topAlternatives[0]?.name : null
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }

    return 'Unknown';
  }

  async createTieredComponents(
    classificationId,
    libraries,
    tier,
    metadata,
    confidence,
    requireAllConfirmations = false,
    clarification = null,
  ) {
    const components = [];

    // If AI provided clarification options, use those instead of pre-configured questions
    if (
      clarification &&
      clarification.options &&
      clarification.options.length > 0
    ) {
      const clarificationButtons = clarification.options.map((opt, idx) =>
        new ButtonBuilder()
          .setCustomId(`ai_clarify_${classificationId}_${idx}`)
          .setLabel(opt.label.substring(0, 80)) // Discord button label max 80 chars
          .setStyle(
            idx === 0
              ? ButtonStyle.Primary
              : idx === clarification.options.length - 1
                ? ButtonStyle.Secondary
                : ButtonStyle.Primary,
          ),
      );

      // Add buttons in row
      components.push(
        new ActionRowBuilder().addComponents(clarificationButtons.slice(0, 5)),
      );

      // Add library dropdown as fallback
      if (libraries && libraries.length > 1) {
        const options = libraries.map((lib) => ({
          label: lib.name,
          value: `${classificationId}_${lib.id}`,
          description: `${lib.media_type} library`,
        }));

        components.push(
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(`library_select`)
              .setPlaceholder("Or manually select a library...")
              .addOptions(options),
          ),
        );
      }

      return components;
    }

    // If requireAllConfirmations is enabled and tier is 'auto', treat it as 'verify'
    const effectiveTier =
      tier.tier === "auto" && requireAllConfirmations ? "verify" : tier.tier;

    if (effectiveTier === "auto") {
      // No interaction needed, just show a confirmation button
      components.push(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`acknowledge_${classificationId}`)
            .setLabel("✓ Acknowledged")
            .setStyle(ButtonStyle.Success),
        ),
      );
    } else if (effectiveTier === "verify") {
      // Yes/No buttons
      components.push(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`verify_yes_${classificationId}`)
            .setLabel("✓ Yes, Correct")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`verify_no_${classificationId}`)
            .setLabel("✗ No, Choose Different")
            .setStyle(ButtonStyle.Danger),
        ),
      );
    } else if (effectiveTier === "clarify" || effectiveTier === "manual") {
      // Policy-driven clarifications should supply options; otherwise show manual selection only
      // Add library selector dropdown
      if (libraries.length > 1) {
        const options = libraries.map((lib) => ({
          label: lib.name,
          value: `${classificationId}_${lib.id}`,
          description: `${lib.media_type} library`,
        }));

        components.push(
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(`library_select`)
              .setPlaceholder("Or manually select a library...")
              .addOptions(options),
          ),
        );
      }
    }

    return components;
  }

  async createCorrectionComponents(
    classificationId,
    libraries,
    buttonCount = 3,
    includeDropdown = true,
  ) {
    const components = [];

    // Get alternative libraries
    const alternativeLibraries = libraries.slice(1, buttonCount + 1);

    if (alternativeLibraries.length > 0) {
      const buttons = [
        new ButtonBuilder()
          .setCustomId(`correct_${classificationId}`)
          .setLabel("✓ Correct")
          .setStyle(ButtonStyle.Success),
      ];

      alternativeLibraries.forEach((lib) => {
        buttons.push(
          new ButtonBuilder()
            .setCustomId(`reclassify_${classificationId}_${lib.id}`)
            .setLabel(`→ ${lib.name}`)
            .setStyle(ButtonStyle.Secondary),
        );
      });

      components.push(new ActionRowBuilder().addComponents(buttons));
    }

    // Add dropdown for all libraries if enabled
    if (includeDropdown && libraries.length > 1) {
      const options = libraries.map((lib) => ({
        label: lib.name,
        value: `${classificationId}_${lib.id}`,
        description: `${lib.media_type} library`,
      }));

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`library_select`)
        .setPlaceholder("Or choose a different library...")
        .addOptions(options);

      components.push(new ActionRowBuilder().addComponents(selectMenu));
    }

    return components;
  }

  async handleInteraction(interaction) {
    try {
      if (interaction.isButton()) {
        const customId = interaction.customId;
        const parts = customId.split("_");
        const action = parts[0];

        if (action === "correct") {
          const classificationId = parts[1];
          await interaction.update({
            components: [],
            embeds: [
              EmbedBuilder.from(interaction.message.embeds[0]).setFooter({
                text: "✅ Confirmed correct by user",
              }),
            ],
          });
        } else if (action === "reclassify") {
          const classificationId = parts[1];
          const newLibraryId = parts[2];
          await this.processCorrection(
            parseInt(classificationId),
            parseInt(newLibraryId),
            interaction,
          );
        } else if (action === "ai") {
          // AI clarification response: ai_clarify_{classificationId}_{optionIndex}
          if (parts[1] === "clarify") {
            const classificationId = parseInt(parts[2]);
            const optionIndex = parseInt(parts[3]);
            await this.processClarificationResponse(
              classificationId,
              optionIndex,
              interaction,
            );
          }
        } else if (action === "verify") {
          const subAction = parts[1]; // 'yes' or 'no'
          const classificationId = parseInt(parts[2]);
          if (subAction === "yes") {
            // Confirmed - mark as verified and save learning pattern
            await this.processVerification(classificationId, true, interaction);
          } else if (subAction === "no") {
            // Not correct - show library selection
            await this.showLibrarySelection(classificationId, interaction);
          }
        } else if (action === "acknowledge") {
          const classificationId = parts[1];
          await interaction.update({
            components: [],
            embeds: [
              EmbedBuilder.from(interaction.message.embeds[0]).setFooter({
                text: "✅ Acknowledged",
              }),
            ],
          });
        } else if (action === "clarify") {
          // Pre-configured question response: clarify_{classificationId}_{questionId}_{responseKey}
          const classificationId = parseInt(parts[1]);
          const questionId = parseInt(parts[2]);
          const responseKey = parts[3];
          await this.processQuestionResponse(
            classificationId,
            questionId,
            responseKey,
            interaction,
          );
        }
      } else if (interaction.isStringSelectMenu()) {
        const [classificationId, newLibraryId] =
          interaction.values[0].split("_");
        await this.processCorrection(
          parseInt(classificationId),
          parseInt(newLibraryId),
          interaction,
        );
      }
    } catch (error) {
      console.error("Error handling Discord interaction:", error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "An error occurred",
          ephemeral: true,
        });
      }
    }
  }

  async processCorrection(classificationId, newLibraryId, interaction) {
    try {
      let routingOutcome = { routed: false, reason: null, error: null };

      // Get original classification
      const classResult = await db.query(
        "SELECT * FROM classification_history WHERE id = $1",
        [classificationId],
      );

      if (classResult.rows.length === 0) {
        await interaction.reply({
          content: "Classification not found",
          ephemeral: true,
        });
        return;
      }

      const originalLibraryId = classResult.rows[0].library_id;
      const classification = classResult.rows[0];

      // Get new library info
      const libResult = await db.query(
        "SELECT name FROM libraries WHERE id = $1",
        [newLibraryId],
      );

      if (libResult.rows.length === 0) {
        await interaction.reply({
          content: "Library not found",
          ephemeral: true,
        });
        return;
      }

      const newLibraryName = libResult.rows[0].name;

      const clarificationResponse = {
        corrected_library_id: newLibraryId,
        corrected_library_name: newLibraryName,
        corrected_by: interaction.user.username,
        corrected_at: new Date().toISOString(),
      };

      // Update classification with library_id and library_name
      await db.query(
        `UPDATE classification_history
         SET library_id = $1,
             library_name = $2,
             status = $3,
             clarification_status = 'resolved',
             pending_reason = NULL,
             clarification_response = $5
         WHERE id = $4`,
        [
          newLibraryId,
          newLibraryName,
          "corrected",
          classificationId,
          JSON.stringify(clarificationResponse),
        ],
      );

      // Save correction
      await db.query(
        "INSERT INTO classification_corrections (classification_id, original_library_id, corrected_library_id, corrected_by) VALUES ($1, $2, $3, $4)",
        [
          classificationId,
          originalLibraryId,
          newLibraryId,
          interaction.user.username,
        ],
      );

      // Learn from this correction (user selected a different library)
      try {
        const metadata = classification.item_metadata || {};
        const learningResult = await autoLearningService.learnFromFeedback({
          tmdbId: classification.tmdb_id,
          libraryId: newLibraryId, // Learn for the NEW library
          genres: metadata.genres || [],
          keywords: metadata.keywords || [],
          studio: metadata.studio,
          wasCorrection: true,
          userId: interaction.user.id
        });

        console.log("[Discord] Auto-learning from correction", {
          classificationId,
          originalLibrary: originalLibraryId,
          newLibrary: newLibraryId,
          learned: learningResult.learned,
          preferences: learningResult.preferences
        });
      } catch (learningError) {
        console.error("[Discord] Auto-learning from correction failed:", learningError);
        // Don't fail correction if learning fails
      }

      // Extract learning patterns
      try {
        await this.extractLearningPatterns(classificationId, newLibraryId);
      } catch (patternError) {
        console.error('Error extracting patterns during correction:', patternError);
        // Continue - don't fail user interaction
      }

      // Attempt routing with the corrected library selection
      try {
        routingOutcome = await this.routeAfterClarification(classificationId);
      } catch (routeError) {
        routingOutcome = {
          routed: false,
          reason: "exception",
          error: routeError.message,
        };
        console.error("Error routing after correction:", routeError);
      }

      const routingStatusText = routingOutcome.routed
        ? `✅ Routed to ${newLibraryName}`
        : `⚠️ Not routed (${routingOutcome.reason || "routing_skipped"})`;

      // Update message
      await interaction.update({
        components: [],
        embeds: [
          EmbedBuilder.from(interaction.message.embeds[0])
            .addFields(
              {
                name: "Corrected To",
                value: newLibraryName,
                inline: true,
              },
              {
                name: "Routing",
                value: routingStatusText,
                inline: false,
              },
            )
            .setFooter({
              text: `✅ Corrected by ${interaction.user.username}`,
            }),
        ],
      });

      if (!routingOutcome.routed) {
        await interaction.followUp({
          content: `Correction saved but routing did not complete. Reason: \`${routingOutcome.reason || "unknown"}\`${routingOutcome.error ? ` (${routingOutcome.error})` : ""}`,
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error("Error processing correction:", error);
      await interaction.reply({
        content: "Failed to process correction",
        ephemeral: true,
      });
    }
  }

  async extractLearningPatterns(classificationId, libraryId) {
    try {
      const result = await db.query(
        "SELECT tmdb_id, media_type, metadata FROM classification_history WHERE id = $1",
        [classificationId],
      );

      if (result.rows.length > 0) {
        const { tmdb_id, media_type, metadata } = result.rows[0];

        // Store exact match pattern
        await db.query(
          `INSERT INTO learning_patterns (tmdb_id, media_type, library_id, pattern_type, pattern_data, confidence)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT DO NOTHING`,
          [tmdb_id, media_type || "unknown", libraryId, "exact_match", metadata, 100.0],
        );
      }
    } catch (error) {
      console.error("Error extracting learning patterns:", error);
    }
  }

  /**
   * Process AI clarification response - when user clicks an AI-generated option button
   * v0.33: Enhanced to use policy_question with library_id mapping
   */
  async processClarificationResponse(
    classificationId,
    optionIndex,
    interaction,
  ) {
    try {
      // Get classification details
      const classResult = await db.query(
        "SELECT *, policy_question FROM classification_history WHERE id = $1",
        [classificationId],
      );

      if (classResult.rows.length === 0) {
        await interaction.reply({
          content: "Classification not found",
          ephemeral: true,
        });
        return;
      }

      const classification = classResult.rows[0];

      // Get the selected option from policy_question if available (v0.33)
      let selectedLabel = `Option ${optionIndex + 1}`;
      let libraryId = classification.library_id;
      let routingOutcome = { routed: false, reason: null, error: null };

      // v0.33: Check policy_question for library_id mapping
      if (classification.policy_question) {
        const policyQuestion =
          typeof classification.policy_question === "string"
            ? this.safeParseJson(classification.policy_question)
            : classification.policy_question;

        if (policyQuestion?.options && policyQuestion.options[optionIndex]) {
          const selectedOption = policyQuestion.options[optionIndex];
          selectedLabel = selectedOption.label;

          // Use library_id from the option if available
          if (selectedOption.library_id) {
            libraryId = selectedOption.library_id;
          }
        }
      } else {
        // Fallback: Get label from button if no policy_question
        const selectedButton =
          interaction.message.components[0]?.components[optionIndex];
        selectedLabel = selectedButton?.label || selectedLabel;
      }

      // v0.33: Use resolvePolicyQuestion for proper pattern generation
      try {
        const resolveResult = await clarificationService.resolvePolicyQuestion(
          classificationId,
          libraryId,
          selectedLabel,
          interaction.user.username,
          true, // generateRule = true
        );

        // Route to arr if resolution indicates we should
        if (resolveResult.shouldRoute) {
          routingOutcome = await this.routeAfterClarification(classificationId);
        }
      } catch (resolveError) {
        console.error(
          "resolvePolicyQuestion failed, falling back to legacy handling:",
          resolveError,
        );

        let resolvedLibraryId = libraryId;
        let resolvedLibraryName = null;

        if (!resolvedLibraryId && selectedLabel) {
          const normalizedLabel = selectedLabel
            .replace(/\s*\(.*\)\s*$/, "")
            .trim();
          let libResult = await db.query(
            "SELECT id, name FROM libraries WHERE LOWER(name) = LOWER($1) LIMIT 1",
            [normalizedLabel],
          );

          if (libResult.rows.length === 0) {
            libResult = await db.query(
              "SELECT id, name FROM libraries WHERE name ILIKE $1 LIMIT 1",
              [`%${normalizedLabel}%`],
            );
          }

          if (libResult.rows.length > 0) {
            resolvedLibraryId = libResult.rows[0].id;
            resolvedLibraryName = libResult.rows[0].name;
          }
        }

        if (resolvedLibraryId && !resolvedLibraryName) {
          const libResult = await db.query(
            "SELECT name FROM libraries WHERE id = $1",
            [resolvedLibraryId],
          );
          resolvedLibraryName = libResult.rows[0]?.name || null;
        }

        const displayLibraryName = resolvedLibraryName || selectedLabel;

        // Fallback to legacy handling
        await db.query(
          `UPDATE classification_history 
           SET status = 'completed', 
               clarification_status = 'resolved',
               library_id = $2,
               library_name = $3,
               method = 'manual_classification',
               confidence = 100,
               reason = $4,
               pending_reason = NULL,
               clarification_response = $1
           WHERE id = $5`,
          [
            JSON.stringify({
              option_index: optionIndex,
              label: selectedLabel,
              answered_by: interaction.user.username,
            }),
            resolvedLibraryId,
            displayLibraryName,
            `Resolved by ${interaction.user.username}: ${selectedLabel}`,
            classificationId,
          ],
        );

        await this.extractClarificationPatterns(
          classificationId,
          resolvedLibraryId,
          selectedLabel,
        );
        routingOutcome = await this.routeAfterClarification(classificationId);
        if (resolvedLibraryId) {
          libraryId = resolvedLibraryId;
        }
      }

      // Get library name for display
      let libraryName = selectedLabel;
      if (libraryId) {
        const libResult = await db.query(
          "SELECT name FROM libraries WHERE id = $1",
          [libraryId],
        );
        libraryName = libResult.rows[0]?.name || selectedLabel;
      }

      const routingStatusText = routingOutcome.routed
        ? `✅ Routed to ${libraryName}`
        : `⚠️ Not routed (${routingOutcome.reason || "routing_skipped"})`;

      // Update Discord message
      await interaction.update({
        components: [],
        embeds: [
          EmbedBuilder.from(interaction.message.embeds[0])
            .setColor(0x22c55e) // Green
            .addFields(
              { name: "Your Answer", value: selectedLabel, inline: true },
              { name: "Selected Library", value: libraryName, inline: true },
              { name: "Routing", value: routingStatusText, inline: false },
            )
            .setFooter({
              text: `✅ Resolved by ${interaction.user.username} • Pattern saved for future`,
            }),
        ],
      });

      if (!routingOutcome.routed) {
        await interaction.followUp({
          content: `Routing did not complete for **${libraryName}**. Reason: \`${routingOutcome.reason || "unknown"}\`${routingOutcome.error ? ` (${routingOutcome.error})` : ""}`,
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error("Error processing clarification response:", error);
      await interaction.reply({
        content: "Failed to process response",
        ephemeral: true,
      });
    }
  }

  /**
   * Process verification response (Yes/No buttons)
   */
  async processVerification(classificationId, isCorrect, interaction) {
    try {
      const classResult = await db.query(
        "SELECT * FROM classification_history WHERE id = $1",
        [classificationId],
      );

      if (classResult.rows.length === 0) {
        await interaction.reply({
          content: "Classification not found",
          ephemeral: true,
        });
        return;
      }

      const classification = classResult.rows[0];

      // Debug log
      console.log("[Discord] Processing verification", {
        id: classificationId,
        isCorrect,
        library_id: classification.library_id,
        status: classification.status,
      });

      // Update status
      await db.query(
        `UPDATE classification_history 
         SET status = 'verified',
             clarification_status = 'confirmed'
         WHERE id = $1`,
        [classificationId],
      );

      // Learn from this verification (user confirmed the classification)
      try {
        const metadata = classification.item_metadata || {};
        const learningResult = await autoLearningService.learnFromFeedback({
          tmdbId: classification.tmdb_id,
          libraryId: classification.library_id,
          genres: metadata.genres || [],
          keywords: metadata.keywords || [],
          studio: metadata.studio,
          wasCorrection: false,
          userId: interaction.user.id
        });

        console.log("[Discord] Auto-learning result", {
          classificationId,
          learned: learningResult.learned,
          preferences: learningResult.preferences
        });
      } catch (learningError) {
        console.error("[Discord] Auto-learning failed:", learningError);
        // Don't fail verification if learning fails
      }

      // Store learning pattern - this TMDB ID now has confirmed routing
      // Explicitly handle null library_id to avoid DB errors if schema expects integer
      const libraryIdToLearn =
        classification.library_id === undefined
          ? null
          : classification.library_id;
      await this.extractLearningPatterns(classificationId, libraryIdToLearn);

      // Route to arr if not already done
      // Use try/catch specifically for routing to avoid failing the whole verification
      try {
        await this.routeAfterClarification(classificationId);
      } catch (routeError) {
        console.error("Error routing after verification:", routeError);
        // Continue - don't fail the user interaction if just routing failed
      }

      // Build feedback message
      const metadata = classification.item_metadata || {};
      let feedbackMessage = "✅ **Verified!** System learned from your confirmation.";
      
      // Add details about what was learned
      try {
        const learnedItems = [];
        if (metadata.genres && metadata.genres.length > 0) {
          learnedItems.push(`Genres: ${metadata.genres.slice(0, 3).join(', ')}`);
        }
        if (metadata.keywords && metadata.keywords.length > 0) {
          learnedItems.push(`Keywords: ${metadata.keywords.slice(0, 3).join(', ')}`);
        }
        if (learnedItems.length > 0) {
          feedbackMessage += `\n\n_System is learning these preferences for this library:_\n${learnedItems.join('\n')}`;
        }
      } catch (error) {
        // Ignore errors in building feedback message
      }

      // Update message
      await interaction.update({
        components: [],
        embeds: [
          EmbedBuilder.from(interaction.message.embeds[0])
            .setColor(0x22c55e)
            .setFooter({
              text: `✅ Verified by ${interaction.user.username} • Will auto-route same title next time`,
            }),
        ],
      });

      // Send ephemeral feedback message
      await interaction.followUp({
        content: feedbackMessage,
        ephemeral: true
      });
    } catch (error) {
      console.error("Error processing verification:", error);
      // Return specific error message to user for debugging
      const errorMessage = error.message || "Unknown error";
      await interaction.reply({
        content: `Failed to process verification: ${errorMessage}\nClassification ID: ${classificationId}`,
        ephemeral: true,
      });
    }
  }

  /**
   * Show library selection dropdown when user says classification is wrong
   */
  async showLibrarySelection(classificationId, interaction) {
    try {
      const classResult = await db.query(
        "SELECT media_type FROM classification_history WHERE id = $1",
        [classificationId],
      );

      if (classResult.rows.length === 0) {
        await interaction.reply({
          content: "Classification not found",
          ephemeral: true,
        });
        return;
      }

      const mediaType = classResult.rows[0].media_type;

      // Get all libraries for this media type
      const libResult = await db.query(
        "SELECT id, name, media_type FROM libraries WHERE media_type = $1 AND is_active = true",
        [mediaType],
      );

      if (libResult.rows.length === 0) {
        await interaction.reply({
          content: "No libraries available",
          ephemeral: true,
        });
        return;
      }

      const options = libResult.rows.map((lib) => ({
        label: lib.name,
        value: `${classificationId}_${lib.id}`,
        description: `${lib.media_type} library`,
      }));

      // Replace buttons with dropdown
      await interaction.update({
        components: [
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId("library_select")
              .setPlaceholder("Select the correct library...")
              .addOptions(options),
          ),
        ],
      });
    } catch (error) {
      console.error("Error showing library selection:", error);
      await interaction.reply({
        content: "Failed to show options",
        ephemeral: true,
      });
    }
  }

  /**
   * Process pre-configured question response
   */
  async processQuestionResponse(
    classificationId,
    questionId,
    responseKey,
    interaction,
  ) {
    try {
      // Get classification
      const classResult = await db.query(
        "SELECT * FROM classification_history WHERE id = $1",
        [classificationId],
      );

      if (classResult.rows.length === 0) {
        await interaction.reply({
          content: "Classification not found",
          ephemeral: true,
        });
        return;
      }

      const classification = classResult.rows[0];

      // Record response via clarification service
      await clarificationService.recordResponse(
        classificationId,
        questionId,
        responseKey,
        interaction.user.id,
        classification.confidence,
      );

      // Update message
      await interaction.update({
        components: [],
        embeds: [
          EmbedBuilder.from(interaction.message.embeds[0])
            .addFields({ name: "Response", value: responseKey, inline: true })
            .setFooter({ text: `✅ Answered by ${interaction.user.username}` }),
        ],
      });
    } catch (error) {
      console.error("Error processing question response:", error);
      await interaction.reply({
        content: "Failed to process response",
        ephemeral: true,
      });
    }
  }

  /**
   * Extract learning patterns from clarification responses
   */
  async extractClarificationPatterns(
    classificationId,
    libraryId,
    selectedOption,
  ) {
    try {
      const result = await db.query(
        "SELECT tmdb_id, media_type, metadata, title FROM classification_history WHERE id = $1",
        [classificationId],
      );

      if (result.rows.length > 0) {
        const { tmdb_id, media_type, metadata, title } = result.rows[0];

        // Store exact match pattern with high confidence
        await db.query(
          `INSERT INTO learning_patterns (tmdb_id, media_type, library_id, pattern_type, pattern_data, confidence)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (tmdb_id, media_type, pattern_type) 
           DO UPDATE SET library_id = $3, confidence = $6, updated_at = NOW()`,
          [
            tmdb_id,
            media_type || "unknown",
            libraryId,
            "exact_match",
            { ...metadata, clarification_response: selectedOption },
            100.0,
          ],
        );

        console.log(
          `Learned: ${title} (TMDB: ${tmdb_id}) -> Library ${libraryId} via clarification`,
        );
      }
    } catch (error) {
      console.error("Error extracting clarification patterns:", error);
    }
  }

  /**
   * Route to Radarr/Sonarr after clarification is resolved
   */
  async routeAfterClarification(classificationId) {
    const outcome = {
      routed: false,
      reason: null,
      error: null,
      arrType: null,
    };

    try {
      // Get classification with library info
      const result = await db.query(
        `SELECT ch.*, l.arr_type, l.arr_id, l.name as library_name,
                l.radarr_settings, l.sonarr_settings, l.root_folder, l.quality_profile_id
         FROM classification_history ch
         JOIN libraries l ON ch.library_id = l.id
         WHERE ch.id = $1`,
        [classificationId],
      );

      if (result.rows.length === 0) {
        outcome.reason = "classification_not_found";
        return outcome;
      }

      const classification = result.rows[0];
      outcome.arrType = classification.arr_type || null;
      let metadata = classification.metadata;
      if (typeof metadata === "string") {
        metadata = this.safeParseJson(metadata);
      }

      if (!metadata || typeof metadata !== "object") {
        console.warn("Skipping *arr routing due to invalid metadata", {
          classificationId,
          metadataType: typeof classification.metadata,
        });
        outcome.reason = "invalid_metadata";
        return outcome;
      }

      // Check if already routed
      if (classification.status === "routed") {
        outcome.routed = true;
        outcome.reason = "already_routed";
        return outcome;
      }

      // Import classification service dynamically to avoid circular dependency
      const classificationService = require("./classification");

      // Route to appropriate *arr
      const routeResult = await classificationService.routeToArr(metadata, {
        id: classification.library_id,
        arr_type: classification.arr_type,
        arr_id: classification.arr_id,
        radarr_settings: classification.radarr_settings,
        sonarr_settings: classification.sonarr_settings,
        root_folder: classification.root_folder,
        quality_profile_id: classification.quality_profile_id,
        name: classification.library_name,
      });

      if (!routeResult?.routed) {
        outcome.reason = routeResult?.reason || "route_skipped";
        outcome.error = routeResult?.error || null;
        console.warn("Routing after clarification skipped", {
          classificationId,
          reason: outcome.reason,
          error: outcome.error,
        });
        return outcome;
      }

      // Update status
      await db.query(
        "UPDATE classification_history SET status = $1 WHERE id = $2",
        ["routed", classificationId],
      );

      console.log(
        `Routed after clarification: ${metadata.title} -> ${classification.library_name}`,
      );
      outcome.routed = true;
      outcome.reason = "routed";
      return outcome;
    } catch (error) {
      console.error("Error routing after clarification:", error);
      outcome.reason = "exception";
      outcome.error = error.message;
      return outcome;
    }
  }

  formatMethod(method) {
    const methods = {
      exact_match: "🎯 Exact Match",
      learned_pattern: "🧠 Learned Pattern",
      rule_match: "📋 Rule Match",
      ai_fallback: "🤖 AI Classification",
    };
    return methods[method] || method;
  }

  getColorForConfidence(confidence) {
    if (confidence >= 90) return 0x22c55e; // Green
    if (confidence >= 70) return 0x3b82f6; // Blue
    if (confidence >= 50) return 0xf59e0b; // Yellow
    return 0xef4444; // Red
  }

  safeParseJson(value) {
    if (!value || typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
      return null;
    }
    try {
      return JSON.parse(trimmed);
    } catch (error) {
      return null;
    }
  }

  getTopAlternatives(result, limit = 3) {
    const selectedLibraryId = this.toFiniteNumber(
      result?.library_id ?? result?.library?.id
    );
    const selectedLibraryName =
      typeof result?.library_name === "string" && result.library_name.trim()
        ? result.library_name.trim().toLowerCase()
        : null;

    const preferredSources = [
      result?.clarification?.meta?.candidates,
      result?.policy_question?.meta?.candidates,
      result?.policyResult?.ranked,
      result?.signalContext?.ranked,
      result?.libraries
    ];

    let source = [];
    for (const candidateSource of preferredSources) {
      if (Array.isArray(candidateSource) && candidateSource.length > 0) {
        source = candidateSource;
        break;
      }
    }

    if (!Array.isArray(source) || source.length === 0) {
      return [];
    }

    const normalized = source
      .map((entry) => {
        const id = this.toFiniteNumber(
          entry?.library_id ??
            entry?.id ??
            entry?.library?.id
        );
        const nameRaw =
          entry?.library_name ??
          entry?.name ??
          entry?.library?.name ??
          null;
        const name =
          typeof nameRaw === "string" ? nameRaw.trim() : null;
        const score = this.toFiniteNumber(entry?.score ?? entry?.confidence);
        return { id, name, score };
      })
      .filter((entry) => entry.name);

    const filtered = normalized.filter((entry) => {
      if (
        selectedLibraryId !== null &&
        entry.id !== null &&
        entry.id === selectedLibraryId
      ) {
        return false;
      }
      if (
        selectedLibraryName &&
        entry.name.toLowerCase() === selectedLibraryName
      ) {
        return false;
      }
      return true;
    });

    const deduped = [];
    const seenKeys = new Set();
    for (const entry of filtered) {
      const key = entry.id !== null ? `id:${entry.id}` : `name:${entry.name.toLowerCase()}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      deduped.push(entry);
    }

    deduped.sort((a, b) => {
      const aScore = a.score ?? -1;
      const bScore = b.score ?? -1;
      return bScore - aScore;
    });

    return deduped.slice(0, Math.max(1, limit));
  }

  toFiniteNumber(value) {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  formatDisplayPercent(value) {
    const numeric = this.toFiniteNumber(value);
    if (numeric === null) return null;
    const rounded = Math.round(numeric * 100) / 100;
    if (Number.isInteger(rounded)) {
      return `${rounded}%`;
    }
    return `${rounded.toFixed(2).replace(/\.?0+$/, "")}%`;
  }
}

module.exports = new DiscordBotService();
