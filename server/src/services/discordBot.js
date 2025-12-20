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

const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const db = require('../config/database');
const clarificationService = require('./clarificationService');

class DiscordBotService {
  constructor() {
    this.client = null;
    this.channelId = null;
    this.isInitialized = false;
    this.config = null;
  }

  async loadConfig() {
    const result = await db.query('SELECT * FROM notification_config WHERE type = $1 LIMIT 1', ['discord']);
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

  async testConnection(botToken = null) {
    let testClient = null;
    try {
      const token = botToken || (await this.loadConfig()).bot_token;
      if (!token) {
        return { success: false, error: 'No bot token provided' };
      }

      // Create temporary client to test
      testClient = new Client({
        intents: [GatewayIntentBits.Guilds],
      });

      await testClient.login(token);
      
      const user = testClient.user;
      const guilds = testClient.guilds.cache.size;

      return { 
        success: true, 
        message: 'Bot connected successfully',
        botUser: {
          id: user.id,
          username: user.username,
          discriminator: user.discriminator,
        },
        guildsCount: guilds,
      };
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

  async getServers(botToken = null) {
    try {
      const token = botToken || (await this.loadConfig()).bot_token;
      if (!token) {
        throw new Error('No bot token provided');
      }

      // Create temporary client
      const testClient = new Client({
        intents: [GatewayIntentBits.Guilds],
      });

      await testClient.login(token);

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
      const token = botToken || (await this.loadConfig()).bot_token;
      if (!token) {
        throw new Error('No bot token provided');
      }

      // Create temporary client
      const testClient = new Client({
        intents: [GatewayIntentBits.Guilds],
      });

      await testClient.login(token);

      const guild = testClient.guilds.cache.get(serverId);
      if (!guild) {
        await testClient.destroy();
        throw new Error('Server not found');
      }

      const channels = guild.channels.cache
        .filter(channel => channel.isTextBased())
        .map(channel => ({
          id: channel.id,
          name: channel.name,
          type: channel.type,
        }));

      await testClient.destroy();

      return channels;
    } catch (error) {
      throw new Error(`Failed to fetch channels: ${error.message}`);
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

      // Create embed based on tier (and requireAllConfirmations setting)
      const embed = this.createTieredEmbed(metadata, result, tier, requireAllConfirmations);

      // Create components based on tier (and requireAllConfirmations setting)
      const components = await this.createTieredComponents(
        result.classification_id,
        result.libraries,
        tier,
        metadata,
        result.confidence,
        requireAllConfirmations
      );

      const message = await channel.send({
        embeds: [embed],
        components: components,
      });

      // Store message ID
      await db.query(
        'UPDATE classification_history SET discord_message_id = $1, clarification_status = $2 WHERE id = $3',
        [message.id, tier.action, result.classification_id]
      );
    } catch (error) {
      console.error('Failed to send confidence-based notification:', error);
    }
  }

  createTieredEmbed(metadata, result, tier, requireAllConfirmations = false) {
    const colors = {
      auto: 0x00ff00,      // Green
      verify: 0xffff00,    // Yellow
      clarify: 0x0099ff,   // Blue
      manual: 0xff0000,    // Red
    };

    const icons = {
      auto: '✅',
      verify: '⚠️',
      clarify: '❓',
      manual: '🛑',
    };

    const embed = new EmbedBuilder()
      .setTitle(`${icons[tier.tier]} ${metadata.title} (${metadata.year || 'N/A'})`)
      .setColor(colors[tier.tier])
      .setTimestamp();

    if (tier.tier === 'auto' && !requireAllConfirmations) {
      embed.setDescription(`✅ **Automatically routed to: ${result.library_name}**\n${tier.description}`);
    } else if (tier.tier === 'auto' && requireAllConfirmations) {
      // Override auto behavior when user requires all confirmations
      embed.setDescription(`⚠️ **Suggested library: ${result.library_name}**\n${tier.description}\n\n🔒 **Manual confirmation required** (setting enabled)\nPlease confirm or select another option.`);
      embed.setColor(colors.verify); // Use verify color since it requires confirmation
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

    if (result.reason) {
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

  async createTieredComponents(classificationId, libraries, tier, metadata, confidence, requireAllConfirmations = false) {
    const components = [];

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
      // Get clarification questions
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
        const [action, classificationId, newLibraryId] = interaction.customId.split('_');

        if (action === 'correct') {
          await interaction.update({
            components: [],
            embeds: [
              EmbedBuilder.from(interaction.message.embeds[0])
                .setFooter({ text: '✅ Confirmed correct by user' })
            ],
          });
        } else if (action === 'reclassify') {
          await this.processCorrection(parseInt(classificationId), parseInt(newLibraryId), interaction);
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
}

module.exports = new DiscordBotService();
