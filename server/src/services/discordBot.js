/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
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

const { Client, GatewayIntentBits, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const db = require('../config/database');
const clarificationService = require('./clarificationService');

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
    const enabledFilter = ignoreEnabledStatus ? '' : 'AND enabled = true';
    const result = await db.query(`SELECT * FROM notification_config WHERE type = $1 ${enabledFilter} LIMIT 1`, ['discord']);
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
        return { success: false, error: 'No bot token provided' };
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
        message: 'Bot connected successfully',
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
            return { success: false, error: 'Channel not found' };
          }

          // Ensure bot member is in cache for permission checking
          const guild = channel.guild;
          if (guild) {
            try {
              await guild.members.fetch(testClient.user.id);
            } catch (fetchError) {
              console.warn('Could not fetch bot member for permission check:', fetchError.message);
            }
          }

          // Check permissions
          const permissions = this.checkChannelPermissions(channel, testClient.user.id);
          response.permissions = permissions;

          // Check for critical missing permissions
          const missingCritical = permissions.missing.filter(p => 
            ['SendMessages', 'EmbedLinks'].includes(p)
          );

          if (missingCritical.length > 0) {
            return {
              success: false,
              error: `Missing critical permissions: ${missingCritical.join(', ')}`,
              permissions,
              botUser: response.botUser,
              guildsCount: response.guildsCount
            };
          }

          // Send test notification
          const testEmbed = new EmbedBuilder()
            .setTitle('✅ Classifarr Test Notification')
            .setDescription('Your Discord bot is configured correctly and can send notifications!')
            .setColor(0x00ff00)
            .addFields(
              { name: 'Bot', value: user.username, inline: true },
              { name: 'Channel', value: `#${channel.name}`, inline: true },
              { name: 'Server', value: channel.guild?.name || 'Unknown', inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'This is a test message from Classifarr' });

          const sentMessage = await channel.send({ embeds: [testEmbed] });

          response.notification = {
            sent: true,
            messageId: sentMessage.id,
            channelName: channel.name,
            serverName: channel.guild?.name || 'Unknown'
          };
          response.message = 'Test notification sent successfully! Check your Discord channel.';

          // Warn about non-critical missing permissions
          if (permissions.missing.length > 0) {
            response.warning = `Some optional permissions are missing: ${permissions.missing.join(', ')}. This may limit functionality.`;
          }
        } catch (channelError) {
          return {
            success: false,
            error: `Failed to send test notification: ${channelError.message}`,
            botUser: response.botUser,
            permissions: response.permissions
          };
        }
      }

      return response;
    } catch (error) {
      return {
        success: false,
        error: error.message.includes('token')
          ? 'Invalid bot token'
          : error.message
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
      'SendMessages',
      'EmbedLinks',
      'AttachFiles',
      'ReadMessageHistory',
      'UseExternalEmojis',
      'AddReactions'
    ];

    // Mapping for permission names to PermissionFlagsBits
    const permissionMap = {
      'SendMessages': PermissionFlagsBits.SendMessages,
      'EmbedLinks': PermissionFlagsBits.EmbedLinks,
      'AttachFiles': PermissionFlagsBits.AttachFiles,
      'ReadMessageHistory': PermissionFlagsBits.ReadMessageHistory,
      'UseExternalEmojis': PermissionFlagsBits.UseExternalEmojis,
      'AddReactions': PermissionFlagsBits.AddReactions
    };

    const botMember = channel.guild.members.cache.get(botUserId);
    if (!botMember) {
      return {
        granted: [],
        missing: requiredPermissions,
        all: false
      };
    }

    const channelPermissions = channel.permissionsFor(botMember);
    if (!channelPermissions) {
      // Edge case: permissionsFor can return null in certain scenarios
      return {
        granted: [],
        missing: requiredPermissions,
        all: false
      };
    }

    const granted = [];
    const missing = [];

    requiredPermissions.forEach(perm => {
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
      all: missing.length === 0
    };
  }

  async getServers(botToken = null) {
    try {
      // Always prefer stored token (the passed botToken might be masked from frontend)
      // Use ignoreEnabledStatus=true to get token even when bot is disabled
      const storedConfig = await this.loadConfig(true);
      const token = storedConfig?.bot_token || botToken;
      if (!token) {
        throw new Error('No bot token configured');
      }

      // Create temporary client
      const testClient = new Client({
        intents: [GatewayIntentBits.Guilds],
      });

      // Wait for client to be fully ready before accessing guilds
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Discord client login timeout'));
        }, 10000); // 10 second timeout

        testClient.once('ready', () => {
          clearTimeout(timeout);
          resolve();
        });
        testClient.once('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
        testClient.login(token).catch((err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      const guilds = testClient.guilds.cache.map(guild => ({
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
        throw new Error('No bot token configured');
      }

      // Create temporary client
      const testClient = new Client({
        intents: [GatewayIntentBits.Guilds],
      });

      // Wait for client to be fully ready before accessing guilds
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Discord client login timeout'));
        }, 10000); // 10 second timeout

        testClient.once('ready', () => {
          clearTimeout(timeout);
          resolve();
        });
        testClient.once('error', (err) => {
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
        throw new Error('Server not found or bot not added to this server');
      }

      // Fetch all channels to ensure cache is populated
      await guild.channels.fetch();

      const channels = guild.channels.cache
        .filter(channel => channel.isTextBased() && !channel.isThread())
        .map(channel => ({
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
      console.log(`[Discord] Fetching channel details for channel ID: ${channelId}`);
      
      // Always prefer stored token
      // Use ignoreEnabledStatus=true to get token even when bot is disabled
      const storedConfig = await this.loadConfig(true);
      const token = storedConfig?.bot_token || botToken;
      
      if (!token) {
        throw new Error('No bot token configured');
      }

      console.log(`[Discord] Using ${storedConfig?.bot_token ? 'stored' : 'provided'} bot token`);

      // Create temporary client
      const testClient = new Client({
        intents: [GatewayIntentBits.Guilds],
      });

      // Wait for client to be fully ready
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Discord client login timeout'));
        }, 10000); // 10 second timeout

        testClient.once('ready', () => {
          clearTimeout(timeout);
          resolve();
        });
        testClient.once('error', (err) => {
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
          throw new Error('Channel not found');
        }

        // Ensure guild is available and fetched
        let guildName = 'Unknown Server';
        if (channel.guild) {
          // Fetch full guild object if not cached
          if (!channel.guild.name) {
            await channel.guild.fetch();
          }
          guildName = channel.guild.name || 'Unknown Server';
        }

        const result = {
          id: channel.id,
          name: channel.name,
          guildId: channel.guildId,
          guildName: guildName
        };

        console.log(`[Discord] Successfully fetched channel: ${channel.name} in guild: ${channel.guild?.name || 'Unknown'}`);

        return result;
      } finally {
        await testClient.destroy();
      }
    } catch (error) {
      // Log the error with context, then re-throw for route handler
      console.error(`Failed to fetch channel details for ${channelId}:`, error.message);
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
      throw new Error('Discord bot not configured or not enabled');
    }

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
      ],
    });

    // Handle interactions
    this.client.on('interactionCreate', async (interaction) => {
      await this.handleInteraction(interaction);
    });

    await this.client.login(token);
    this.isInitialized = true;
  }

  async sendClassificationNotification(metadata, result) {
    if (!this.isInitialized || !this.client) {
      console.warn('Discord bot not initialized');
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
        console.error('Discord channel not found');
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`${metadata.title} (${metadata.year || 'N/A'})`)
        .setDescription(`Classified as: **${result.library_name}**`)
        .setColor(this.getColorForConfidence(result.confidence))
        .setTimestamp();

      // Add fields based on config
      const fields = [
        { name: 'Media Type', value: metadata.media_type === 'movie' ? 'Movie' : 'TV Show', inline: true },
      ];

      if (config.show_confidence) {
        fields.push({ name: 'Confidence', value: `${result.confidence}%`, inline: true });
      }

      if (config.show_method) {
        fields.push({ name: 'Method', value: this.formatMethod(result.method), inline: true });
      }

      if (config.show_reason && result.reason) {
        fields.push({ name: 'Reason', value: result.reason, inline: false });
      }

      if (config.show_metadata && metadata) {
        const metadataStr = Object.entries(metadata)
          .filter(([key]) => !['title', 'year', 'media_type', 'poster_path'].includes(key))
          .map(([key, value]) => `${key}: ${value}`)
          .join('\n');
        if (metadataStr) {
          fields.push({ name: 'Metadata', value: metadataStr.substring(0, 1024), inline: false });
        }
      }

      embed.addFields(fields);

      if (config.show_poster && metadata.poster_path) {
        embed.setThumbnail(`https://image.tmdb.org/t/p/w200${metadata.poster_path}`);
      }

      // Create correction buttons if enabled
      let components = [];
      if (config.enable_corrections) {
        components = await this.createCorrectionComponents(
          result.classification_id,
          result.libraries,
          config.correction_buttons_count || 3,
          config.include_library_dropdown !== false
        );
      }

      const message = await channel.send({
        embeds: [embed],
        components: components,
      });

      // Store message ID for later updates
      await db.query(
        'UPDATE classification_history SET metadata = metadata || $1 WHERE id = $2',
        [JSON.stringify({ discord_message_id: message.id }), result.classification_id]
      );
    } catch (error) {
      console.error('Failed to send Discord notification:', error);
    }
  }

  async sendConfidenceBasedNotification(metadata, result) {
    if (!this.isInitialized || !this.client) {
      console.warn('Discord bot not initialized');
      return;
    }

    try {
      const config = await this.loadConfig();

      if (!config.notify_on_classification) {
        return;
      }

      // Check if user requires all confirmations
      const requireAllConfirmations = await clarificationService.isRequireAllConfirmationsEnabled();

      // Get confidence tier
      const tier = await clarificationService.getTierForConfidence(result.confidence);
      if (!tier) {
        // Fallback to standard notification
        return this.sendClassificationNotification(metadata, result);
      }

      const channel = await this.client.channels.fetch(this.channelId);
      if (!channel) {
        console.error('Discord channel not found');
        return;
      }

      // Check if AI needs clarification - use AI-generated question instead of pre-configured ones
      const hasClarification = result.needs_clarification && result.clarification;

      // Create embed based on tier (and clarification/requireAllConfirmations setting)
      const embed = this.createTieredEmbed(metadata, result, tier, requireAllConfirmations, hasClarification);

      // Create components based on tier and clarification
      const components = await this.createTieredComponents(
        result.classification_id,
        result.libraries,
        tier,
        metadata,
        result.confidence,
        requireAllConfirmations,
        hasClarification ? result.clarification : null
      );

      const message = await channel.send({
        embeds: [embed],
        components: components,
      });

      // Store message ID and clarification status
      const status = hasClarification ? 'awaiting_clarification' : tier.action;
      await db.query(
        'UPDATE classification_history SET discord_message_id = $1, clarification_status = $2 WHERE id = $3',
        [message.id, status, result.classification_id]
      );
    } catch (error) {
      console.error('Failed to send confidence-based notification:', error);
    }
  }

  createTieredEmbed(metadata, result, tier, requireAllConfirmations = false, hasClarification = false) {
    const colors = {
      auto: 0x00ff00,      // Green
      verify: 0xffff00,    // Yellow
      clarify: 0x0099ff,   // Blue
      manual: 0xff0000,    // Red
      clarification: 0x9333ea, // Purple - for AI clarification questions
    };

    const icons = {
      auto: '✅',
      verify: '⚠️',
      clarify: '❓',
      manual: '🛑',
      clarification: '🤔',
    };

    // Use clarification styling if AI needs help
    const effectiveTier = hasClarification ? 'clarification' : tier.tier;

    const embed = new EmbedBuilder()
      .setTitle(`${icons[effectiveTier]} ${metadata.title} (${metadata.year || 'N/A'})`)
      .setColor(colors[effectiveTier])
      .setTimestamp();

    // AI Clarification - special format with context
    if (hasClarification && result.clarification) {
      const clarification = result.clarification;
      embed.setDescription(
        `🤔 **I need your help classifying this ${metadata.media_type}**\n\n` +
        `**Problem:** ${clarification.problem_summary}\n\n` +
        `**Why I'm asking:** ${clarification.why_uncertain}\n\n` +
        `**Question:** ${clarification.question}`
      );
    } else if (tier.tier === 'auto' && !requireAllConfirmations) {
      embed.setDescription(`✅ **Automatically routed to: ${result.library_name}**\n${tier.description}`);
    } else if (tier.tier === 'auto' && requireAllConfirmations) {
      embed.setDescription(`⚠️ **Suggested library: ${result.library_name}**\n${tier.description}\n\n🔒 **Manual confirmation required** (setting enabled)\nPlease confirm or select another option.`);
      embed.setColor(colors.verify);
    } else if (tier.tier === 'verify') {
      embed.setDescription(`⚠️ **Suggested library: ${result.library_name}**\n${tier.description}\n\nPlease confirm or select another option.`);
    } else if (tier.tier === 'clarify') {
      embed.setDescription(`❓ **Suggested library: ${result.library_name}**\n${tier.description}\n\nPlease answer the questions below to improve accuracy.`);
    } else {
      embed.setDescription(`🛑 **Suggested library: ${result.library_name}**\n${tier.description}\n\nPlease answer the questions or select a library manually.`);
    }

    const fields = [
      { name: 'Media Type', value: metadata.media_type === 'movie' ? 'Movie' : 'TV Show', inline: true },
      { name: 'Confidence', value: `${result.confidence}%`, inline: true },
      { name: 'Method', value: this.formatMethod(result.method), inline: true },
    ];

    // Don't show reason if we're showing clarification context (redundant)
    if (result.reason && !hasClarification) {
      fields.push({ name: 'Reason', value: result.reason, inline: false });
    }

    // Add content analysis if available
    if (metadata.contentAnalysis && metadata.contentAnalysis.bestMatch) {
      const analysis = metadata.contentAnalysis.bestMatch;
      fields.push({
        name: 'Content Type Detected',
        value: `${analysis.type} (${analysis.confidence}% confidence)`,
        inline: false,
      });
    }

    embed.addFields(fields);

    if (metadata.poster_path) {
      embed.setThumbnail(`https://image.tmdb.org/t/p/w200${metadata.poster_path}`);
    }

    return embed;
  }

  async createTieredComponents(classificationId, libraries, tier, metadata, confidence, requireAllConfirmations = false, clarification = null) {
    const components = [];

    // If AI provided clarification options, use those instead of pre-configured questions
    if (clarification && clarification.options && clarification.options.length > 0) {
      const clarificationButtons = clarification.options.map((opt, idx) =>
        new ButtonBuilder()
          .setCustomId(`ai_clarify_${classificationId}_${idx}`)
          .setLabel(opt.label.substring(0, 80)) // Discord button label max 80 chars
          .setStyle(idx === 0 ? ButtonStyle.Primary : (idx === clarification.options.length - 1 ? ButtonStyle.Secondary : ButtonStyle.Primary))
      );

      // Add buttons in row
      components.push(
        new ActionRowBuilder().addComponents(clarificationButtons.slice(0, 5))
      );

      // Add library dropdown as fallback
      if (libraries && libraries.length > 1) {
        const options = libraries.map(lib => ({
          label: lib.name,
          value: `${classificationId}_${lib.id}`,
          description: `${lib.media_type} library`,
        }));

        components.push(
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(`library_select`)
              .setPlaceholder('Or manually select a library...')
              .addOptions(options)
          )
        );
      }

      return components;
    }

    // If requireAllConfirmations is enabled and tier is 'auto', treat it as 'verify'
    const effectiveTier = (tier.tier === 'auto' && requireAllConfirmations) ? 'verify' : tier.tier;

    if (effectiveTier === 'auto') {
      // No interaction needed, just show a confirmation button
      components.push(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`acknowledge_${classificationId}`)
            .setLabel('✓ Acknowledged')
            .setStyle(ButtonStyle.Success)
        )
      );
    } else if (effectiveTier === 'verify') {
      // Yes/No buttons
      components.push(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`verify_yes_${classificationId}`)
            .setLabel('✓ Yes, Correct')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`verify_no_${classificationId}`)
            .setLabel('✗ No, Choose Different')
            .setStyle(ButtonStyle.Danger)
        )
      );
    } else if (effectiveTier === 'clarify' || effectiveTier === 'manual') {
      // Get clarification questions from pre-configured list (fallback)
      const questions = await clarificationService.matchQuestions(
        metadata,
        effectiveTier === 'clarify' ? 2 : 3
      );

      // Add question buttons (up to 2-3 questions)
      if (questions.length > 0) {
        const questionButtons = [];
        questions.slice(0, 2).forEach((q, idx) => {
          const options = JSON.parse(JSON.stringify(q.response_options));
          Object.keys(options).forEach(key => {
            questionButtons.push(
              new ButtonBuilder()
                .setCustomId(`clarify_${classificationId}_${q.id}_${key}`)
                .setLabel(`${options[key].label}`)
                .setStyle(ButtonStyle.Primary)
            );
          });
        });

        // Split into rows of 5 buttons max
        for (let i = 0; i < questionButtons.length; i += 5) {
          components.push(
            new ActionRowBuilder().addComponents(questionButtons.slice(i, i + 5))
          );
        }
      }

      // Add library selector dropdown
      if (libraries.length > 1) {
        const options = libraries.map(lib => ({
          label: lib.name,
          value: `${classificationId}_${lib.id}`,
          description: `${lib.media_type} library`,
        }));

        components.push(
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(`library_select`)
              .setPlaceholder('Or manually select a library...')
              .addOptions(options)
          )
        );
      }
    }

    return components;
  }

  async createCorrectionComponents(classificationId, libraries, buttonCount = 3, includeDropdown = true) {
    const components = [];

    // Get alternative libraries
    const alternativeLibraries = libraries.slice(1, buttonCount + 1);

    if (alternativeLibraries.length > 0) {
      const buttons = [
        new ButtonBuilder()
          .setCustomId(`correct_${classificationId}`)
          .setLabel('✓ Correct')
          .setStyle(ButtonStyle.Success),
      ];

      alternativeLibraries.forEach((lib) => {
        buttons.push(
          new ButtonBuilder()
            .setCustomId(`reclassify_${classificationId}_${lib.id}`)
            .setLabel(`→ ${lib.name}`)
            .setStyle(ButtonStyle.Secondary)
        );
      });

      components.push(new ActionRowBuilder().addComponents(buttons));
    }

    // Add dropdown for all libraries if enabled
    if (includeDropdown && libraries.length > 1) {
      const options = libraries.map(lib => ({
        label: lib.name,
        value: `${classificationId}_${lib.id}`,
        description: `${lib.media_type} library`,
      }));

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`library_select`)
        .setPlaceholder('Or choose a different library...')
        .addOptions(options);

      components.push(new ActionRowBuilder().addComponents(selectMenu));
    }

    return components;
  }

  async handleInteraction(interaction) {
    try {
      if (interaction.isButton()) {
        const customId = interaction.customId;
        const parts = customId.split('_');
        const action = parts[0];

        if (action === 'correct') {
          const classificationId = parts[1];
          await interaction.update({
            components: [],
            embeds: [
              EmbedBuilder.from(interaction.message.embeds[0])
                .setFooter({ text: '✅ Confirmed correct by user' })
            ],
          });
        } else if (action === 'reclassify') {
          const classificationId = parts[1];
          const newLibraryId = parts[2];
          await this.processCorrection(parseInt(classificationId), parseInt(newLibraryId), interaction);
        } else if (action === 'ai') {
          // AI clarification response: ai_clarify_{classificationId}_{optionIndex}
          if (parts[1] === 'clarify') {
            const classificationId = parseInt(parts[2]);
            const optionIndex = parseInt(parts[3]);
            await this.processClarificationResponse(classificationId, optionIndex, interaction);
          }
        } else if (action === 'verify') {
          const subAction = parts[1]; // 'yes' or 'no'
          const classificationId = parseInt(parts[2]);
          if (subAction === 'yes') {
            // Confirmed - mark as verified and save learning pattern
            await this.processVerification(classificationId, true, interaction);
          } else if (subAction === 'no') {
            // Not correct - show library selection
            await this.showLibrarySelection(classificationId, interaction);
          }
        } else if (action === 'acknowledge') {
          const classificationId = parts[1];
          await interaction.update({
            components: [],
            embeds: [
              EmbedBuilder.from(interaction.message.embeds[0])
                .setFooter({ text: '✅ Acknowledged' })
            ],
          });
        } else if (action === 'clarify') {
          // Pre-configured question response: clarify_{classificationId}_{questionId}_{responseKey}
          const classificationId = parseInt(parts[1]);
          const questionId = parseInt(parts[2]);
          const responseKey = parts[3];
          await this.processQuestionResponse(classificationId, questionId, responseKey, interaction);
        }
      } else if (interaction.isStringSelectMenu()) {
        const [classificationId, newLibraryId] = interaction.values[0].split('_');
        await this.processCorrection(parseInt(classificationId), parseInt(newLibraryId), interaction);
      }
    } catch (error) {
      console.error('Error handling Discord interaction:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'An error occurred', ephemeral: true });
      }
    }
  }

  async processCorrection(classificationId, newLibraryId, interaction) {
    try {
      // Get original classification
      const classResult = await db.query(
        'SELECT * FROM classification_history WHERE id = $1',
        [classificationId]
      );

      if (classResult.rows.length === 0) {
        await interaction.reply({ content: 'Classification not found', ephemeral: true });
        return;
      }

      const originalLibraryId = classResult.rows[0].library_id;

      // Get new library info
      const libResult = await db.query(
        'SELECT name FROM libraries WHERE id = $1',
        [newLibraryId]
      );

      if (libResult.rows.length === 0) {
        await interaction.reply({ content: 'Library not found', ephemeral: true });
        return;
      }

      const newLibraryName = libResult.rows[0].name;

      // Update classification
      await db.query(
        'UPDATE classification_history SET library_id = $1, status = $2 WHERE id = $3',
        [newLibraryId, 'corrected', classificationId]
      );

      // Save correction
      await db.query(
        'INSERT INTO classification_corrections (classification_id, original_library_id, corrected_library_id, corrected_by) VALUES ($1, $2, $3, $4)',
        [classificationId, originalLibraryId, newLibraryId, interaction.user.username]
      );

      // Extract learning patterns
      await this.extractLearningPatterns(classificationId, newLibraryId);

      // Update message
      await interaction.update({
        components: [],
        embeds: [
          EmbedBuilder.from(interaction.message.embeds[0])
            .addFields({ name: 'Corrected To', value: newLibraryName, inline: true })
            .setFooter({ text: `✅ Corrected by ${interaction.user.username}` })
        ],
      });
    } catch (error) {
      console.error('Error processing correction:', error);
      await interaction.reply({ content: 'Failed to process correction', ephemeral: true });
    }
  }

  async extractLearningPatterns(classificationId, libraryId) {
    try {
      const result = await db.query(
        'SELECT tmdb_id, metadata FROM classification_history WHERE id = $1',
        [classificationId]
      );

      if (result.rows.length > 0) {
        const { tmdb_id, metadata } = result.rows[0];

        // Store exact match pattern
        await db.query(
          `INSERT INTO learning_patterns (tmdb_id, library_id, pattern_type, pattern_data, confidence)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT DO NOTHING`,
          [tmdb_id, libraryId, 'exact_match', metadata, 100.00]
        );
      }
    } catch (error) {
      console.error('Error extracting learning patterns:', error);
    }
  }

  /**
   * Process AI clarification response - when user clicks an AI-generated option button
   * v0.33: Enhanced to use policy_question with library_id mapping
   */
  async processClarificationResponse(classificationId, optionIndex, interaction) {
    try {
      // Get classification details
      const classResult = await db.query(
        'SELECT *, policy_question FROM classification_history WHERE id = $1',
        [classificationId]
      );

      if (classResult.rows.length === 0) {
        await interaction.reply({ content: 'Classification not found', ephemeral: true });
        return;
      }

      const classification = classResult.rows[0];

      // Get the selected option from policy_question if available (v0.33)
      let selectedLabel = `Option ${optionIndex + 1}`;
      let libraryId = classification.library_id;

      // v0.33: Check policy_question for library_id mapping
      if (classification.policy_question) {
        try {
          const policyQuestion = typeof classification.policy_question === 'string'
            ? JSON.parse(classification.policy_question)
            : classification.policy_question;

          if (policyQuestion.options && policyQuestion.options[optionIndex]) {
            const selectedOption = policyQuestion.options[optionIndex];
            selectedLabel = selectedOption.label;

            // Use library_id from the option if available
            if (selectedOption.library_id) {
              libraryId = selectedOption.library_id;
            }
          }
        } catch (parseError) {
          console.error('Failed to parse policy_question:', parseError);
        }
      } else {
        // Fallback: Get label from button if no policy_question
        const selectedButton = interaction.message.components[0]?.components[optionIndex];
        selectedLabel = selectedButton?.label || selectedLabel;
      }

      // v0.33: Use resolvePolicyQuestion for proper pattern generation
      try {
        const resolveResult = await clarificationService.resolvePolicyQuestion(
          classificationId,
          libraryId,
          selectedLabel,
          interaction.user.username,
          true // generateRule = true
        );

        // Route to arr if resolution indicates we should
        if (resolveResult.shouldRoute) {
          await this.routeAfterClarification(classificationId);
        }
      } catch (resolveError) {
        console.error('resolvePolicyQuestion failed, falling back to legacy handling:', resolveError);

        // Fallback to legacy handling
        await db.query(
          `UPDATE classification_history 
           SET status = 'completed', 
               clarification_status = 'resolved',
               clarification_response = $1
           WHERE id = $2`,
          [JSON.stringify({ option_index: optionIndex, label: selectedLabel, answered_by: interaction.user.username }), classificationId]
        );

        await this.extractClarificationPatterns(classificationId, libraryId, selectedLabel);
        await this.routeAfterClarification(classificationId);
      }

      // Get library name for display
      const libResult = await db.query('SELECT name FROM libraries WHERE id = $1', [libraryId]);
      const libraryName = libResult.rows[0]?.name || 'Unknown';

      // Update Discord message
      await interaction.update({
        components: [],
        embeds: [
          EmbedBuilder.from(interaction.message.embeds[0])
            .setColor(0x22c55e) // Green
            .addFields(
              { name: 'Your Answer', value: selectedLabel, inline: true },
              { name: 'Routed To', value: libraryName, inline: true }
            )
            .setFooter({ text: `✅ Resolved by ${interaction.user.username} • Pattern saved for future` })
        ],
      });
    } catch (error) {
      console.error('Error processing clarification response:', error);
      await interaction.reply({ content: 'Failed to process response', ephemeral: true });
    }
  }

  /**
   * Process verification response (Yes/No buttons)
   */
  async processVerification(classificationId, isCorrect, interaction) {
    try {
      const classResult = await db.query(
        'SELECT * FROM classification_history WHERE id = $1',
        [classificationId]
      );

      if (classResult.rows.length === 0) {
        await interaction.reply({ content: 'Classification not found', ephemeral: true });
        return;
      }

      const classification = classResult.rows[0];

      // Update status
      await db.query(
        `UPDATE classification_history 
         SET status = 'verified',
             clarification_status = 'confirmed'
         WHERE id = $1`,
        [classificationId]
      );

      // Store learning pattern - this TMDB ID now has confirmed routing
      await this.extractLearningPatterns(classificationId, classification.library_id);

      // Route to arr if not already done
      await this.routeAfterClarification(classificationId);

      // Update message
      await interaction.update({
        components: [],
        embeds: [
          EmbedBuilder.from(interaction.message.embeds[0])
            .setColor(0x22c55e)
            .setFooter({ text: `✅ Verified by ${interaction.user.username} • Will auto-route same title next time` })
        ],
      });
    } catch (error) {
      console.error('Error processing verification:', error);
      await interaction.reply({ content: 'Failed to process verification', ephemeral: true });
    }
  }

  /**
   * Show library selection dropdown when user says classification is wrong
   */
  async showLibrarySelection(classificationId, interaction) {
    try {
      const classResult = await db.query(
        'SELECT media_type FROM classification_history WHERE id = $1',
        [classificationId]
      );

      if (classResult.rows.length === 0) {
        await interaction.reply({ content: 'Classification not found', ephemeral: true });
        return;
      }

      const mediaType = classResult.rows[0].media_type;

      // Get all libraries for this media type
      const libResult = await db.query(
        'SELECT id, name, media_type FROM libraries WHERE media_type = $1 AND is_active = true',
        [mediaType]
      );

      if (libResult.rows.length === 0) {
        await interaction.reply({ content: 'No libraries available', ephemeral: true });
        return;
      }

      const options = libResult.rows.map(lib => ({
        label: lib.name,
        value: `${classificationId}_${lib.id}`,
        description: `${lib.media_type} library`,
      }));

      // Replace buttons with dropdown
      await interaction.update({
        components: [
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('library_select')
              .setPlaceholder('Select the correct library...')
              .addOptions(options)
          )
        ],
      });
    } catch (error) {
      console.error('Error showing library selection:', error);
      await interaction.reply({ content: 'Failed to show options', ephemeral: true });
    }
  }

  /**
   * Process pre-configured question response
   */
  async processQuestionResponse(classificationId, questionId, responseKey, interaction) {
    try {
      // Get classification
      const classResult = await db.query(
        'SELECT * FROM classification_history WHERE id = $1',
        [classificationId]
      );

      if (classResult.rows.length === 0) {
        await interaction.reply({ content: 'Classification not found', ephemeral: true });
        return;
      }

      const classification = classResult.rows[0];

      // Record response via clarification service
      await clarificationService.recordResponse(
        classificationId,
        questionId,
        responseKey,
        interaction.user.id,
        classification.confidence
      );

      // Update message
      await interaction.update({
        components: [],
        embeds: [
          EmbedBuilder.from(interaction.message.embeds[0])
            .addFields({ name: 'Response', value: responseKey, inline: true })
            .setFooter({ text: `✅ Answered by ${interaction.user.username}` })
        ],
      });
    } catch (error) {
      console.error('Error processing question response:', error);
      await interaction.reply({ content: 'Failed to process response', ephemeral: true });
    }
  }

  /**
   * Extract learning patterns from clarification responses
   */
  async extractClarificationPatterns(classificationId, libraryId, selectedOption) {
    try {
      const result = await db.query(
        'SELECT tmdb_id, metadata, title FROM classification_history WHERE id = $1',
        [classificationId]
      );

      if (result.rows.length > 0) {
        const { tmdb_id, metadata, title } = result.rows[0];

        // Store exact match pattern with high confidence
        await db.query(
          `INSERT INTO learning_patterns (tmdb_id, library_id, pattern_type, pattern_data, confidence)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (tmdb_id, pattern_type) 
           DO UPDATE SET library_id = $2, confidence = $5, updated_at = NOW()`,
          [tmdb_id, libraryId, 'exact_match', { ...metadata, clarification_response: selectedOption }, 100.00]
        );

        console.log(`Learned: ${title} (TMDB: ${tmdb_id}) -> Library ${libraryId} via clarification`);
      }
    } catch (error) {
      console.error('Error extracting clarification patterns:', error);
    }
  }

  /**
   * Route to Radarr/Sonarr after clarification is resolved
   */
  async routeAfterClarification(classificationId) {
    try {
      // Get classification with library info
      const result = await db.query(
        `SELECT ch.*, l.arr_type, l.arr_id, l.name as library_name,
                l.radarr_settings, l.sonarr_settings
         FROM classification_history ch
         JOIN libraries l ON ch.library_id = l.id
         WHERE ch.id = $1`,
        [classificationId]
      );

      if (result.rows.length === 0) return;

      const classification = result.rows[0];
      const metadata = classification.metadata;

      // Check if already routed
      if (classification.status === 'routed') return;

      // Import classification service dynamically to avoid circular dependency
      const classificationService = require('./classification');

      // Route to appropriate *arr
      await classificationService.routeToArr(metadata, {
        arr_type: classification.arr_type,
        arr_id: classification.arr_id,
        radarr_settings: classification.radarr_settings,
        sonarr_settings: classification.sonarr_settings,
        name: classification.library_name,
      });

      // Update status
      await db.query(
        'UPDATE classification_history SET status = $1 WHERE id = $2',
        ['routed', classificationId]
      );

      console.log(`Routed after clarification: ${metadata.title} -> ${classification.library_name}`);
    } catch (error) {
      console.error('Error routing after clarification:', error);
    }
  }

  formatMethod(method) {
    const methods = {
      exact_match: '🎯 Exact Match',
      learned_pattern: '🧠 Learned Pattern',
      rule_match: '📋 Rule Match',
      ai_fallback: '🤖 AI Classification',
    };
    return methods[method] || method;
  }

  getColorForConfidence(confidence) {
    if (confidence >= 90) return 0x22c55e; // Green
    if (confidence >= 70) return 0x3b82f6; // Blue
    if (confidence >= 50) return 0xf59e0b; // Yellow
    return 0xef4444; // Red
  }

  /**
   * Send notification about smart rule suggestions for a library
   * @param {Object} library - Library object with id, name, media_type
   * @param {Array} suggestions - Array of suggestion objects with name, confidence, reasoning
   */
  async sendSmartSuggestionNotification(library, suggestions) {
    if (!this.isInitialized || !this.client) {
      console.warn('Discord bot not initialized for smart suggestions');
      return;
    }

    try {
      const config = await this.loadConfig();
      if (!config.enabled) return;

      const channel = await this.client.channels.fetch(this.channelId);
      if (!channel) {
        console.error('Discord channel not found');
        return;
      }

      // Build embed with suggestions
      const embed = new EmbedBuilder()
        .setTitle(`🧠 Smart Rule Suggestions Available`)
        .setDescription(`**Library:** ${library.name}\n**Type:** ${library.media_type}\n\nNew classification rules have been suggested based on content analysis.`)
        .setColor(0x9333ea) // Purple for suggestions
        .setTimestamp();

      // Add each suggestion as a field
      suggestions.slice(0, 5).forEach((suggestion, idx) => {
        embed.addFields({
          name: `${idx + 1}. ${suggestion.name} (${suggestion.confidence}% confidence)`,
          value: suggestion.reasoning || 'Rule suggested based on content patterns',
          inline: false
        });
      });

      // Add footer with action hint
      embed.setFooter({ text: `Open the Rule Builder in Classifarr to apply these suggestions` });

      // Create action button to open rule builder
      const components = [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel('Open Rule Builder')
            .setStyle(ButtonStyle.Link)
            .setURL(`${process.env.APP_URL || 'http://localhost:21324'}/rule-builder/${library.id}`)
        )
      ];

      await channel.send({
        embeds: [embed],
        components: components
      });

      console.log(`Sent smart suggestion notification for library ${library.name}`);
    } catch (error) {
      console.error('Failed to send smart suggestion notification:', error);
    }
  }
}

module.exports = new DiscordBotService();
