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

      const clarificationService = require('./clarification');
      const action = await clarificationService.getActionForConfidence(result.confidence);

      // Route to appropriate notification method based on confidence
      switch (action) {
        case 'auto_route':
          await this.sendAutoRouteNotification(metadata, result, config);
          break;
        case 'route_and_verify':
          await this.sendVerificationRequest(metadata, result, config);
          break;
        case 'ask_questions':
          await this.sendClarificationRequest(metadata, result, config, 2);
          break;
        case 'manual_review':
          await this.sendClarificationRequest(metadata, result, config, 3);
          break;
        default:
          await this.sendAutoRouteNotification(metadata, result, config);
      }
    } catch (error) {
      console.error('Failed to send Discord notification:', error);
    }
  }

  async sendAutoRouteNotification(metadata, result, config) {
    const channel = await this.client.channels.fetch(this.channelId);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle(`✅ ${metadata.title} (${metadata.year || 'N/A'})`)
      .setDescription(`Auto-routed to: **${result.library_name}**`)
      .setColor(0x00ff00) // Green
      .setTimestamp();

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

    embed.addFields(fields);

    if (config.show_poster && metadata.poster_path) {
      embed.setThumbnail(`https://image.tmdb.org/t/p/w200${metadata.poster_path}`);
    }

    await channel.send({ embeds: [embed] });
  }

  async sendVerificationRequest(metadata, result, config) {
    const channel = await this.client.channels.fetch(this.channelId);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle(`⚠️ ${metadata.title} (${metadata.year || 'N/A'})`)
      .setDescription(`Routed to: **${result.library_name}**\n\nIs this correct?`)
      .setColor(0xffaa00) // Yellow/Orange
      .setTimestamp();

    const fields = [
      { name: 'Media Type', value: metadata.media_type === 'movie' ? 'Movie' : 'TV Show', inline: true },
      { name: 'Confidence', value: `${result.confidence}%`, inline: true },
    ];

    if (config.show_method) {
      fields.push({ name: 'Method', value: this.formatMethod(result.method), inline: true });
    }

    if (config.show_reason && result.reason) {
      fields.push({ name: 'Reason', value: result.reason, inline: false });
    }

    embed.addFields(fields);

    if (config.show_poster && metadata.poster_path) {
      embed.setThumbnail(`https://image.tmdb.org/t/p/w200${metadata.poster_path}`);
    }

    // Yes/No buttons
    const buttons = [
      new ButtonBuilder()
        .setCustomId(`verify_yes_${result.classification_id}`)
        .setLabel('✓ Yes, Correct')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`verify_no_${result.classification_id}`)
        .setLabel('✗ No, Wrong Library')
        .setStyle(ButtonStyle.Danger),
    ];

    const row = new ActionRowBuilder().addComponents(buttons);

    const message = await channel.send({
      embeds: [embed],
      components: [row],
    });

    // Store message ID
    await db.query(
      'UPDATE classification_history SET discord_message_id = $1 WHERE id = $2',
      [message.id, result.classification_id]
    );
  }

  async sendClarificationRequest(metadata, result, config, maxQuestions = 2) {
    const channel = await this.client.channels.fetch(this.channelId);
    if (!channel) return;

    const clarificationService = require('./clarification');
    const questions = await clarificationService.getQuestionsForMedia(metadata, maxQuestions);

    const isLowConfidence = result.confidence < 50;
    const emoji = isLowConfidence ? '🛑' : '❓';
    const color = isLowConfidence ? 0xff0000 : 0x0099ff; // Red or Blue

    const embed = new EmbedBuilder()
      .setTitle(`${emoji} ${metadata.title} (${metadata.year || 'N/A'})`)
      .setDescription(
        isLowConfidence 
          ? `**Low Confidence (${result.confidence}%)** - Manual review needed\n\nPlease answer these questions to help classify:` 
          : `**Medium Confidence (${result.confidence}%)** - Need clarification\n\nPlease answer to improve classification:`
      )
      .setColor(color)
      .setTimestamp();

    const fields = [
      { name: 'Media Type', value: metadata.media_type === 'movie' ? 'Movie' : 'TV Show', inline: true },
      { name: 'Confidence', value: `${result.confidence}%`, inline: true },
    ];

    if (result.library_name) {
      fields.push({ name: 'Current Guess', value: result.library_name, inline: true });
    }

    embed.addFields(fields);

    if (config.show_poster && metadata.poster_path) {
      embed.setThumbnail(`https://image.tmdb.org/t/p/w200${metadata.poster_path}`);
    }

    // Create button rows for each question
    const components = [];
    
    for (let i = 0; i < Math.min(questions.length, maxQuestions); i++) {
      const question = questions[i];
      const options = question.options;
      
      // Add question as field
      embed.addFields([{
        name: `Question ${i + 1}: ${question.question_text}`,
        value: options.map(opt => opt.label).join(' | '),
        inline: false
      }]);

      // Create buttons for this question (max 5 per row)
      const buttons = options.slice(0, 5).map(opt => 
        new ButtonBuilder()
          .setCustomId(`clarify_${result.classification_id}_${question.question_key}_${opt.value}`)
          .setLabel(opt.label.substring(0, 80)) // Discord button label limit
          .setStyle(ButtonStyle.Primary)
      );

      if (buttons.length > 0) {
        components.push(new ActionRowBuilder().addComponents(buttons));
      }
    }

    // If no questions matched, show library selection
    if (questions.length === 0 && result.libraries) {
      const libraryButtons = result.libraries.slice(0, 5).map(lib =>
        new ButtonBuilder()
          .setCustomId(`manual_select_${result.classification_id}_${lib.id}`)
          .setLabel(lib.name.substring(0, 80))
          .setStyle(ButtonStyle.Secondary)
      );

      if (libraryButtons.length > 0) {
        components.push(new ActionRowBuilder().addComponents(libraryButtons));
      }
    }

    const message = await channel.send({
      embeds: [embed],
      components: components,
    });

    // Store message ID and update status
    await db.query(
      `UPDATE classification_history 
       SET discord_message_id = $1, 
           clarification_status = 'pending',
           clarification_questions_asked = $2
       WHERE id = $3`,
      [message.id, questions.length, result.classification_id]
    );
  }

  async sendOldClassificationNotification(metadata, result) {
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
        const parts = interaction.customId.split('_');
        const action = parts[0];

        if (action === 'verify') {
          // Handle verification (yes/no)
          const response = parts[1]; // 'yes' or 'no'
          const classificationId = parseInt(parts[2]);
          await this.handleVerification(classificationId, response, interaction);
        } else if (action === 'clarify') {
          // Handle clarification response
          // Format: clarify_{classificationId}_{questionKey}_{value}
          const classificationId = parseInt(parts[1]);
          const questionKey = parts[2];
          const value = parts[3];
          await this.handleClarificationResponse(classificationId, questionKey, value, interaction);
        } else if (action === 'manual') {
          // Handle manual library selection
          const subAction = parts[1]; // 'select'
          const classificationId = parseInt(parts[2]);
          const libraryId = parseInt(parts[3]);
          await this.processCorrection(classificationId, libraryId, interaction);
        } else if (action === 'correct') {
          const classificationId = parts[1];
          await interaction.update({
            components: [],
            embeds: [
              EmbedBuilder.from(interaction.message.embeds[0])
                .setFooter({ text: '✅ Confirmed correct by user' })
            ],
          });
        } else if (action === 'reclassify') {
          const classificationId = parseInt(parts[1]);
          const newLibraryId = parseInt(parts[2]);
          await this.processCorrection(classificationId, newLibraryId, interaction);
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

  async handleVerification(classificationId, response, interaction) {
    try {
      if (response === 'yes') {
        // Mark as confirmed
        await db.query(
          `UPDATE classification_history 
           SET clarification_status = 'confirmed'
           WHERE id = $1`,
          [classificationId]
        );

        await interaction.update({
          components: [],
          embeds: [
            EmbedBuilder.from(interaction.message.embeds[0])
              .setColor(0x00ff00)
              .setFooter({ text: '✅ Verified correct by user' })
          ],
        });
      } else {
        // Show library selection or clarification questions
        await interaction.update({
          content: 'Please select the correct library or answer clarification questions.',
          components: [],
        });

        // Could trigger showing clarification questions here
      }
    } catch (error) {
      console.error('Error handling verification:', error);
      await interaction.reply({ content: 'Failed to process verification', ephemeral: true });
    }
  }

  async handleClarificationResponse(classificationId, questionKey, value, interaction) {
    try {
      const clarificationService = require('./clarification');
      
      // Process the response
      const result = await clarificationService.processResponse(
        classificationId,
        questionKey,
        value,
        `${interaction.user.username}#${interaction.user.discriminator}`
      );

      // Update message to show response was recorded
      await interaction.update({
        components: [],
        embeds: [
          EmbedBuilder.from(interaction.message.embeds[0])
            .setFooter({ text: `Response recorded: ${value}. Reclassifying...` })
        ],
      });

      // Reclassify with the new information
      const reclassResult = await clarificationService.reclassifyWithClarifications(classificationId);

      if (reclassResult.success) {
        // Save learning pattern
        await clarificationService.savePatternFromClarification(classificationId);

        // Send success message
        await interaction.followUp({
          content: `✅ Reclassified to **${reclassResult.library.name}** (Confidence: ${reclassResult.confidenceAfter}%)`,
          ephemeral: false,
        });
      } else {
        await interaction.followUp({
          content: '⚠️ Reclassification failed. Please try manual selection.',
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error('Error handling clarification response:', error);
      await interaction.reply({ content: 'Failed to process response', ephemeral: true });
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
