const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder, ButtonStyle } = require('discord.js');
const db = require('../db');
require('dotenv').config();

/**
 * Discord Notification Service
 * Handles Discord notifications and user interactions for classification
 */
class DiscordService {
  constructor() {
    this.client = null;
    this.channelId = process.env.DISCORD_CHANNEL_ID;
    this.isReady = false;
  }

  /**
   * Initialize Discord bot
   */
  async initialize() {
    if (!process.env.DISCORD_BOT_TOKEN) {
      console.warn('Discord bot token not configured, notifications disabled');
      return;
    }

    try {
      this.client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
        ],
      });

      this.client.on('ready', () => {
        console.log(`Discord bot logged in as ${this.client.user.tag}`);
        this.isReady = true;
      });

      // Handle interactions
      this.client.on('interactionCreate', async (interaction) => {
        if (interaction.isButton() || interaction.isStringSelectMenu()) {
          await this.handleCorrectionInteraction(interaction);
        }
      });

      await this.client.login(process.env.DISCORD_BOT_TOKEN);
    } catch (error) {
      console.error('Failed to initialize Discord bot:', error);
    }
  }

  /**
   * Send classification notification to Discord
   * @param {Object} classification - Classification result
   * @param {number} classificationId - Classification ID from database
   * @param {Object} mediaData - Original media data
   * @returns {Promise<void>}
   */
  async sendClassificationNotification(classification, classificationId, mediaData) {
    if (!this.isReady || !this.channelId) {
      console.log('Discord not configured, skipping notification');
      return;
    }

    try {
      const channel = await this.client.channels.fetch(this.channelId);
      if (!channel) {
        console.error('Discord channel not found');
        return;
      }

      // Create embed
      const embed = this.createClassificationEmbed(classification, mediaData);

      // Get top alternative libraries
      const alternatives = await this.getAlternativeLibraries(
        classification.libraryId,
        mediaData.mediaType,
        3
      );

      // Create action rows
      const actionRows = [];

      // Button row with Correct + top 3 alternatives
      const buttonRow = this.createCorrectionButtons(
        classificationId,
        classification.library,
        alternatives
      );
      if (buttonRow) {
        actionRows.push(buttonRow);
      }

      // Dropdown for all other libraries
      const dropdown = await this.createLibraryDropdown(
        classificationId,
        mediaData.mediaType,
        [classification.libraryId, ...alternatives.map(a => a.id)]
      );
      if (dropdown) {
        actionRows.push(dropdown);
      }

      await channel.send({
        embeds: [embed],
        components: actionRows,
      });

      console.log('Discord notification sent for:', mediaData.title);
    } catch (error) {
      console.error('Failed to send Discord notification:', error);
    }
  }

  /**
   * Create classification embed
   * @param {Object} classification - Classification result
   * @param {Object} mediaData - Original media data
   * @returns {EmbedBuilder} Discord embed
   */
  createClassificationEmbed(classification, mediaData) {
    const emoji = mediaData.mediaType === 'movie' ? '🎬' : '📺';
    const methodEmojis = {
      past_correction: '🔄',
      learned_pattern: '🧠',
      rule_match: '📋',
      ai_decision: '🤖',
    };

    const methodEmoji = methodEmojis[classification.method] || '❓';

    const embed = new EmbedBuilder()
      .setTitle(`${emoji} New ${mediaData.mediaType === 'movie' ? 'Movie' : 'TV Show'} Classified`)
      .setColor(this.getConfidenceColor(classification.confidence))
      .setDescription('━━━━━━━━━━━━━━━━━━━━')
      .addFields([
        { name: 'Title', value: mediaData.title, inline: true },
        { name: 'Year', value: mediaData.year?.toString() || 'Unknown', inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: 'Library', value: `**${classification.library}**`, inline: true },
        { name: 'Confidence', value: `${classification.confidence}%`, inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: 'Method', value: `${methodEmoji} ${this.getMethodLabel(classification.method)}`, inline: false },
        { name: 'Reason', value: classification.reason.substring(0, 1000), inline: false },
      ])
      .setTimestamp();

    // Add poster if available
    if (mediaData.posterUrl) {
      embed.setThumbnail(mediaData.posterUrl);
    }

    // Add genres and rating if available
    if (mediaData.genres && mediaData.genres.length > 0) {
      embed.addFields({
        name: 'Genres',
        value: mediaData.genres.slice(0, 5).join(', '),
        inline: true,
      });
    }

    if (mediaData.certification) {
      embed.addFields({
        name: 'Rating',
        value: mediaData.certification,
        inline: true,
      });
    }

    return embed;
  }

  /**
   * Get color based on confidence level
   * @param {number} confidence - Confidence percentage
   * @returns {number} Discord color
   */
  getConfidenceColor(confidence) {
    if (confidence >= 90) return 0x00ff00; // Green
    if (confidence >= 80) return 0x90ee90; // Light green
    if (confidence >= 70) return 0xffff00; // Yellow
    if (confidence >= 60) return 0xffa500; // Orange
    return 0xff0000; // Red
  }

  /**
   * Get human-readable method label
   * @param {string} method - Classification method
   * @returns {string} Label
   */
  getMethodLabel(method) {
    const labels = {
      past_correction: 'Past Correction',
      learned_pattern: 'Learned Pattern',
      rule_match: 'Rule Match',
      ai_decision: 'AI Decision',
    };
    return labels[method] || 'Unknown';
  }

  /**
   * Get alternative libraries for suggestions
   * @param {number} currentLibraryId - Current library ID
   * @param {string} mediaType - 'movie' or 'tv'
   * @param {number} limit - Number of alternatives to return
   * @returns {Promise<Array>} Alternative libraries
   */
  async getAlternativeLibraries(currentLibraryId, mediaType, limit = 3) {
    const result = await db.query(
      `SELECT id, name FROM libraries 
       WHERE media_type = $1 AND id != $2
       ORDER BY name ASC
       LIMIT $3`,
      [mediaType, currentLibraryId, limit]
    );

    return result.rows;
  }

  /**
   * Create correction buttons
   * @param {number} classificationId - Classification ID
   * @param {string} currentLibrary - Current library name
   * @param {Array} alternatives - Alternative libraries
   * @returns {ActionRowBuilder} Button row
   */
  createCorrectionButtons(classificationId, currentLibrary, alternatives) {
    const buttons = [];

    // "Correct" button (confirms the current classification)
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`correct_${classificationId}`)
        .setLabel('✓ Correct')
        .setStyle(ButtonStyle.Success)
    );

    // Top 3 alternative library buttons
    for (const alt of alternatives.slice(0, 3)) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`move_${classificationId}_${alt.id}`)
          .setLabel(`→ ${alt.name}`)
          .setStyle(ButtonStyle.Primary)
      );
    }

    if (buttons.length === 0) return null;

    return new ActionRowBuilder().addComponents(buttons);
  }

  /**
   * Create library dropdown for all other options
   * @param {number} classificationId - Classification ID
   * @param {string} mediaType - 'movie' or 'tv'
   * @param {Array} excludeIds - Library IDs to exclude
   * @returns {Promise<ActionRowBuilder|null>} Dropdown row
   */
  async createLibraryDropdown(classificationId, mediaType, excludeIds = []) {
    const result = await db.query(
      `SELECT id, name FROM libraries 
       WHERE media_type = $1 AND id != ALL($2)
       ORDER BY name ASC`,
      [mediaType, excludeIds]
    );

    if (result.rows.length === 0) return null;

    const options = result.rows.map(lib => ({
      label: lib.name,
      value: `${classificationId}_${lib.id}`,
      description: `Move to ${lib.name}`,
    }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('move_library')
      .setPlaceholder('▼ Move to different library...')
      .addOptions(options);

    return new ActionRowBuilder().addComponents(selectMenu);
  }

  /**
   * Handle correction interaction from Discord
   * @param {Interaction} interaction - Discord interaction
   */
  async handleCorrectionInteraction(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      let classificationId;
      let newLibraryId = null;
      let action;

      if (interaction.isButton()) {
        const [actionType, classId, libId] = interaction.customId.split('_');
        classificationId = parseInt(classId);
        action = actionType;

        if (actionType === 'move' && libId) {
          newLibraryId = parseInt(libId);
        }
      } else if (interaction.isStringSelectMenu()) {
        const [classId, libId] = interaction.values[0].split('_');
        classificationId = parseInt(classId);
        newLibraryId = parseInt(libId);
        action = 'move';
      }

      // Get classification details
      const classResult = await db.query(
        'SELECT * FROM classifications WHERE id = $1',
        [classificationId]
      );

      if (classResult.rows.length === 0) {
        await interaction.editReply('Classification not found.');
        return;
      }

      const classification = classResult.rows[0];

      if (action === 'correct') {
        // User confirmed the classification is correct
        await interaction.editReply(`✓ Classification confirmed! This helps improve future accuracy.`);
        
        // Update confidence/learning (optional)
        await this.recordCorrectClassification(classification);
      } else if (action === 'move' && newLibraryId) {
        // User wants to move to a different library
        const libResult = await db.query(
          'SELECT name FROM libraries WHERE id = $1',
          [newLibraryId]
        );

        if (libResult.rows.length === 0) {
          await interaction.editReply('Library not found.');
          return;
        }

        const newLibrary = libResult.rows[0].name;

        // Record correction
        await db.query(
          `INSERT INTO corrections 
           (classification_id, tmdb_id, media_type, original_library_id, corrected_library_id, corrected_by, correction_source)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            classificationId,
            classification.tmdb_id,
            classification.media_type,
            classification.library_id,
            newLibraryId,
            interaction.user.tag,
            'discord',
          ]
        );

        await interaction.editReply(
          `✓ Moved to **${newLibrary}**. This correction will help improve future classifications!`
        );

        // Update message to show it's been corrected
        try {
          const originalEmbed = interaction.message.embeds[0];
          const updatedEmbed = EmbedBuilder.from(originalEmbed)
            .setColor(0x808080)
            .setFooter({ text: `Corrected by ${interaction.user.tag} → ${newLibrary}` });

          await interaction.message.edit({
            embeds: [updatedEmbed],
            components: [],
          });
        } catch (e) {
          console.error('Failed to update original message:', e);
        }

        // Learn from this correction
        await this.learnFromCorrection(classification, newLibraryId);
      }

    } catch (error) {
      console.error('Error handling correction interaction:', error);
      try {
        await interaction.editReply('An error occurred while processing your correction.');
      } catch (e) {
        console.error('Failed to send error reply:', e);
      }
    }
  }

  /**
   * Record that a classification was correct
   * @param {Object} classification - Classification record
   */
  async recordCorrectClassification(classification) {
    // Could update learned patterns confidence here
    console.log('Classification confirmed correct:', classification.id);
  }

  /**
   * Learn from correction
   * @param {Object} classification - Original classification
   * @param {number} correctLibraryId - Correct library ID
   */
  async learnFromCorrection(classification, correctLibraryId) {
    try {
      const metadata = classification.metadata || {};
      
      // Extract pattern from metadata
      const patternData = {
        genres: metadata.genres,
        keywords: metadata.keywords,
        certification: metadata.certification,
      };

      // Check if similar pattern exists
      const existingPattern = await db.query(
        `SELECT id, correct_count, match_count 
         FROM learned_patterns 
         WHERE library_id = $1 
         AND pattern_data @> $2
         LIMIT 1`,
        [correctLibraryId, JSON.stringify(patternData)]
      );

      if (existingPattern.rows.length > 0) {
        // Update existing pattern
        const pattern = existingPattern.rows[0];
        const newCorrectCount = pattern.correct_count + 1;
        const newMatchCount = pattern.match_count + 1;
        const newConfidence = (newCorrectCount / newMatchCount) * 100;

        await db.query(
          `UPDATE learned_patterns 
           SET correct_count = $1, match_count = $2, confidence = $3, updated_at = NOW()
           WHERE id = $4`,
          [newCorrectCount, newMatchCount, newConfidence, pattern.id]
        );
      } else {
        // Create new pattern
        await db.query(
          `INSERT INTO learned_patterns 
           (pattern_type, pattern_data, library_id, confidence, match_count, correct_count)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          ['genre_keyword_combo', JSON.stringify(patternData), correctLibraryId, 70, 1, 1]
        );
      }

      console.log('Learned from correction:', classification.id);
    } catch (error) {
      console.error('Error learning from correction:', error);
    }
  }
}

// Create singleton instance
const discordService = new DiscordService();

module.exports = discordService;
