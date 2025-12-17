const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const db = require('../config/database');
const clarificationService = require('./clarification');

class DiscordBotService {
  constructor() {
    this.client = null;
    this.channelId = null;
    this.isInitialized = false;
  }

  async initialize() {
    const token = process.env.DISCORD_BOT_TOKEN;
    this.channelId = process.env.DISCORD_CHANNEL_ID;

    if (!token || !this.channelId) {
      throw new Error('Discord bot token or channel ID not configured');
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
      // Determine action based on confidence
      const action = await clarificationService.getActionForConfidence(result.confidence);
      
      switch (action.action_type) {
        case 'auto_route':
          await this.sendAutoRouteNotification(metadata, result);
          break;
        case 'verify':
          await this.sendVerificationRequest(metadata, result);
          break;
        case 'clarify':
        case 'manual':
          await this.sendClarificationRequest(metadata, result);
          break;
        default:
          // Fallback to old behavior
          await this.sendAutoRouteNotification(metadata, result);
      }
    } catch (error) {
      console.error('Failed to send Discord notification:', error);
    }
  }

  /**
   * Send auto-route confirmation (high confidence 90%+)
   */
  async sendAutoRouteNotification(metadata, result) {
    if (!this.isInitialized || !this.client) {
      console.warn('Discord bot not initialized');
      return;
    }

    try {
      const channel = await this.client.channels.fetch(this.channelId);
      if (!channel) {
        console.error('Discord channel not found');
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`✅ ${metadata.title} (${metadata.year || 'N/A'})`)
        .setDescription(`Automatically routed to **${result.library_name || result.library?.name}**`)
        .addFields(
          { name: 'Confidence', value: `${result.confidence}%`, inline: true },
          { name: 'Method', value: this.formatMethod(result.method), inline: true }
        )
        .setColor(0x22c55e) // Green
        .setTimestamp()
        .setFooter({ text: 'High confidence - no action needed' });

      if (metadata.poster_path) {
        embed.setThumbnail(`https://image.tmdb.org/t/p/w200${metadata.poster_path}`);
      }

      await channel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Failed to send auto-route notification:', error);
    }
  }

  /**
   * Send verification request (medium-high confidence 70-89%)
   */
  async sendVerificationRequest(metadata, result) {
    if (!this.isInitialized || !this.client) {
      console.warn('Discord bot not initialized');
      return;
    }

    try {
      const channel = await this.client.channels.fetch(this.channelId);
      if (!channel) {
        console.error('Discord channel not found');
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`⚠️ ${metadata.title} (${metadata.year || 'N/A'})`)
        .setDescription(`Routed to **${result.library_name || result.library?.name}**\n\nIs this correct?`)
        .addFields(
          { name: 'Confidence', value: `${result.confidence}%`, inline: true },
          { name: 'Reason', value: result.reason || 'Based on metadata analysis', inline: false }
        )
        .setColor(0xf59e0b) // Yellow
        .setTimestamp();

      if (metadata.poster_path) {
        embed.setThumbnail(`https://image.tmdb.org/t/p/w200${metadata.poster_path}`);
      }

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`verify_correct_${result.classification_id}`)
            .setLabel('✓ Correct')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`verify_wrong_${result.classification_id}`)
            .setLabel('✗ Wrong')
            .setStyle(ButtonStyle.Danger)
        );

      const message = await channel.send({ embeds: [embed], components: [row] });

      // Save message ID
      await db.query(
        'UPDATE classification_history SET discord_message_id = $1 WHERE id = $2',
        [message.id, result.classification_id]
      );
    } catch (error) {
      console.error('Failed to send verification request:', error);
    }
  }

  /**
   * Send clarification request (low-medium confidence 50-69% or lower)
   */
  async sendClarificationRequest(metadata, result) {
    if (!this.isInitialized || !this.client) {
      console.warn('Discord bot not initialized');
      return;
    }

    try {
      const channel = await this.client.channels.fetch(this.channelId);
      if (!channel) {
        console.error('Discord channel not found');
        return;
      }

      const questions = await clarificationService.getQuestionsForMedia(metadata, result);
      
      if (questions.length === 0) {
        // No relevant questions - fall back to verification
        return this.sendVerificationRequest(metadata, result);
      }
      
      // Update classification with pending status
      await db.query(`
        UPDATE classification_history 
        SET clarification_status = 'pending',
            clarification_questions_asked = $1,
            confidence_before_clarification = $2
        WHERE id = $3
      `, [questions.length, result.confidence, result.classification_id]);
      
      const confidenceIcon = result.confidence < 50 ? '🛑' : '❓';
      const embed = new EmbedBuilder()
        .setTitle(`${confidenceIcon} ${metadata.title} (${metadata.year || 'N/A'})`)
        .setDescription(`I need help understanding this title better.\n\n**Confidence:** ${result.confidence}%`)
        .setColor(0x3b82f6) // Blue
        .setTimestamp()
        .addFields({
          name: '🤔 Why I\'m Uncertain',
          value: result.reason || 'Multiple possible classifications detected.'
        });

      if (metadata.poster_path) {
        embed.setThumbnail(`https://image.tmdb.org/t/p/w200${metadata.poster_path}`);
      }

      const components = [];
      
      for (const question of questions) {
        embed.addFields({
          name: `❓ ${question.text}`,
          value: '\u200B' // Zero-width space
        });
        
        const row = new ActionRowBuilder();
        
        if (question.options.length <= 5) {
          // Use buttons (Discord limit is 5 per row)
          for (const option of question.options.slice(0, 5)) {
            row.addComponents(
              new ButtonBuilder()
                .setCustomId(`clarify_${result.classification_id}_${question.key}_${option.value}`)
                .setLabel(option.label.substring(0, 80)) // Discord button label limit
                .setStyle(ButtonStyle.Secondary)
            );
          }
        } else {
          // Use select menu for more options
          row.addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(`clarify_select_${result.classification_id}_${question.key}`)
              .setPlaceholder('Select an option...')
              .addOptions(question.options.map(opt => ({
                label: opt.label.substring(0, 100),
                value: opt.value,
                description: opt.description?.substring(0, 100) || undefined
              })))
          );
        }
        
        components.push(row);
      }

      const message = await channel.send({ embeds: [embed], components });
      
      // Save message ID for later updates
      await db.query(
        'UPDATE classification_history SET discord_message_id = $1 WHERE id = $2',
        [message.id, result.classification_id]
      );
    } catch (error) {
      console.error('Failed to send clarification request:', error);
    }
  }

  async createCorrectionComponents(classificationId, libraries) {
    const components = [];

    // Get top 3 alternative libraries
    const alternativeLibraries = libraries.slice(1, 4);

    if (alternativeLibraries.length > 0) {
      const buttons = [
        new ButtonBuilder()
          .setCustomId(`correct_${classificationId}`)
          .setLabel('✓ Correct')
          .setStyle(ButtonStyle.Success),
      ];

      alternativeLibraries.forEach((lib, index) => {
        buttons.push(
          new ButtonBuilder()
            .setCustomId(`reclassify_${classificationId}_${lib.id}`)
            .setLabel(`→ ${lib.name}`)
            .setStyle(ButtonStyle.Secondary)
        );
      });

      components.push(new ActionRowBuilder().addComponents(buttons));
    }

    // Add dropdown for all libraries
    if (libraries.length > 1) {
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
        
        // Handle verification buttons
        if (customId.startsWith('verify_correct_')) {
          const classificationId = customId.replace('verify_correct_', '');
          await interaction.update({
            components: [],
            embeds: [
              EmbedBuilder.from(interaction.message.embeds[0])
                .setFooter({ text: `✅ Confirmed correct by ${interaction.user.username}` })
            ],
          });
          await clarificationService.confirmClassification(classificationId, interaction.user.id);
        } else if (customId.startsWith('verify_wrong_')) {
          const classificationId = customId.replace('verify_wrong_', '');
          // Get clarification questions for this media
          const classification = await clarificationService.getClassification(classificationId);
          await this.sendClarificationRequest(classification.metadata, { 
            ...classification, 
            classification_id: parseInt(classificationId),
            confidence: classification.confidence,
            library_name: classification.library?.name,
            method: classification.method,
            reason: classification.reason
          });
          await interaction.update({ components: [] });
        }
        // Handle clarification buttons
        else if (customId.startsWith('clarify_')) {
          const parts = customId.split('_');
          const classificationId = parts[1];
          const questionKey = parts[2];
          const selectedValue = parts.slice(3).join('_');
          
          await interaction.deferUpdate();
          
          const result = await clarificationService.processResponse(
            classificationId,
            questionKey,
            selectedValue,
            interaction.user.id,
            interaction.user.username
          );
          
          if (result.status === 'completed') {
            // Update the message to show final result
            await this.updateMessageWithResult(interaction.message, result);
          } else {
            // Update to show progress
            await this.updateMessageWithProgress(interaction.message, classificationId);
          }
        }
        // Handle old correction buttons
        else {
          const [action, classificationId, newLibraryId] = customId.split('_');

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
        }
      } else if (interaction.isStringSelectMenu()) {
        const customId = interaction.customId;
        
        // Handle clarification select menus
        if (customId.startsWith('clarify_select_')) {
          const parts = customId.split('_');
          const classificationId = parts[2];
          const questionKey = parts[3];
          const selectedValue = interaction.values[0];
          
          await interaction.deferUpdate();
          
          const result = await clarificationService.processResponse(
            classificationId,
            questionKey,
            selectedValue,
            interaction.user.id,
            interaction.user.username
          );
          
          if (result.status === 'completed') {
            await this.updateMessageWithResult(interaction.message, result);
          } else {
            await this.updateMessageWithProgress(interaction.message, classificationId);
          }
        }
        // Handle old library select
        else if (customId === 'library_select') {
          const [classificationId, newLibraryId] = interaction.values[0].split('_');
          await this.processCorrection(parseInt(classificationId), parseInt(newLibraryId), interaction);
        }
      }
    } catch (error) {
      console.error('Error handling Discord interaction:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'An error occurred', ephemeral: true });
      }
    }
  }

  /**
   * Update message with final classification result
   */
  async updateMessageWithResult(message, result) {
    try {
      const embed = EmbedBuilder.from(message.embeds[0])
        .setColor(0x22c55e) // Green
        .addFields(
          { name: 'Final Library', value: result.library?.name || 'Unknown', inline: true },
          { name: 'Final Confidence', value: `${result.confidence}%`, inline: true }
        )
        .setFooter({ text: '✅ Classification completed with clarifications' });

      await message.edit({
        embeds: [embed],
        components: []
      });
    } catch (error) {
      console.error('Error updating message with result:', error);
    }
  }

  /**
   * Update message with clarification progress
   */
  async updateMessageWithProgress(message, classificationId) {
    try {
      const classification = await clarificationService.getClassification(classificationId);
      const answered = classification.clarification_questions_answered;
      const total = classification.clarification_questions_asked;
      
      const embed = EmbedBuilder.from(message.embeds[0])
        .setFooter({ text: `⏳ Questions answered: ${answered}/${total}` });

      await message.edit({
        embeds: [embed]
      });
    } catch (error) {
      console.error('Error updating message with progress:', error);
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
