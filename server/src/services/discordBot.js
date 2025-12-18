const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const db = require('../config/database');

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
    try {
      const token = botToken || (await this.loadConfig()).bot_token;
      if (!token) {
        return { success: false, error: 'No bot token provided' };
      }

      // Create temporary client to test
      const testClient = new Client({
        intents: [GatewayIntentBits.Guilds],
      });

      await testClient.login(token);
      
      const user = testClient.user;
      const guilds = testClient.guilds.cache.size;

      await testClient.destroy();

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
