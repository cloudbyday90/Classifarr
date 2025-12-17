const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { query } = require('../config/database');
const tmdbService = require('./tmdb');
const radarrService = require('./radarr');
const sonarrService = require('./sonarr');

class DiscordBotService {
  constructor() {
    this.client = null;
    this.channelId = null;
    this.enabled = false;
  }

  /**
   * Initialize Discord bot
   */
  async initialize() {
    try {
      // Get config from database or environment
      const result = await query('SELECT * FROM notification_config WHERE discord_enabled = true LIMIT 1');
      let token, channelId;

      if (result.rows.length > 0) {
        token = result.rows[0].discord_bot_token;
        channelId = result.rows[0].discord_channel_id;
      } else {
        token = process.env.DISCORD_BOT_TOKEN;
        channelId = process.env.DISCORD_CHANNEL_ID;
      }

      if (!token || !channelId) {
        console.log('⚠ Discord bot not configured - notifications disabled');
        return;
      }

      this.channelId = channelId;

      // Create client
      this.client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages
        ]
      });

      // Setup event handlers
      this.client.on('ready', () => {
        console.log(`✓ Discord bot connected as ${this.client.user.tag}`);
        this.enabled = true;
      });

      this.client.on('interactionCreate', async (interaction) => {
        await this.handleInteraction(interaction);
      });

      this.client.on('error', (err) => {
        console.error('Discord bot error:', err);
      });

      // Login
      await this.client.login(token);

    } catch (err) {
      console.error('Failed to initialize Discord bot:', err.message);
      this.enabled = false;
    }
  }

  /**
   * Send classification notification
   */
  async sendClassificationNotification(metadata, result) {
    if (!this.enabled || !this.client) {
      console.log('Discord notifications disabled');
      return;
    }

    try {
      const channel = await this.client.channels.fetch(this.channelId);
      if (!channel) {
        console.error('Discord channel not found');
        return;
      }

      // Create embed
      const embed = new EmbedBuilder()
        .setColor(this.getColorForConfidence(result.confidence))
        .setTitle(`🎬 ${metadata.title}${metadata.year ? ` (${metadata.year})` : ''}`)
        .setDescription(metadata.overview?.substring(0, 200) || 'No description available')
        .addFields([
          { name: 'Type', value: metadata.mediaType === 'tv' ? 'TV Show' : 'Movie', inline: true },
          { name: 'Library', value: result.library?.name || 'Unassigned', inline: true },
          { name: 'Confidence', value: `${result.confidence}%`, inline: true },
          { name: 'Method', value: this.formatMethod(result.method), inline: true },
          { name: 'Reason', value: result.reason || 'No reason provided', inline: false }
        ])
        .setTimestamp();

      // Add poster image if available
      if (metadata.posterPath) {
        const posterUrl = tmdbService.getPosterUrl(metadata.posterPath);
        if (posterUrl) {
          embed.setThumbnail(posterUrl);
        }
      }

      // Get classification ID for corrections
      const classificationResult = await query(
        'SELECT id FROM classification_history WHERE tmdb_id = $1 AND media_type = $2 ORDER BY created_at DESC LIMIT 1',
        [metadata.tmdbId, metadata.mediaType || 'movie']
      );

      const classificationId = classificationResult.rows[0]?.id;

      // Create action components
      const components = [];
      if (classificationId && result.library) {
        const libraries = await this.getAlternativeLibraries(result.library.id, metadata.mediaType || 'movie');
        if (libraries.length > 0) {
          components.push(...this.createCorrectionComponents(classificationId, result.library, libraries));
        }
      }

      // Send message
      const message = await channel.send({
        embeds: [embed],
        components: components.length > 0 ? components : undefined
      });

      console.log('✓ Discord notification sent');

    } catch (err) {
      console.error('Failed to send Discord notification:', err.message);
    }
  }

  /**
   * Get alternative libraries for corrections
   */
  async getAlternativeLibraries(currentLibraryId, mediaType) {
    const result = await query(`
      SELECT id, name 
      FROM libraries 
      WHERE enabled = true 
        AND id != $1
        AND (media_type = $2 OR media_type = 'mixed')
      ORDER BY name
      LIMIT 10
    `, [currentLibraryId, mediaType]);

    return result.rows;
  }

  /**
   * Create correction components (buttons and dropdown)
   */
  createCorrectionComponents(classificationId, currentLibrary, alternativeLibraries) {
    const components = [];

    // Button row - Show correct button and top 3 alternatives
    const buttonRow = new ActionRowBuilder();
    
    buttonRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`correct_${classificationId}`)
        .setLabel('✓ Correct')
        .setStyle(ButtonStyle.Success)
    );

    // Add up to 3 alternative library buttons
    for (let i = 0; i < Math.min(3, alternativeLibraries.length); i++) {
      const lib = alternativeLibraries[i];
      buttonRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`move_${classificationId}_${lib.id}`)
          .setLabel(`→ ${lib.name}`)
          .setStyle(ButtonStyle.Primary)
      );
    }

    components.push(buttonRow);

    // If more than 3 alternatives, add dropdown
    if (alternativeLibraries.length > 3) {
      const selectRow = new ActionRowBuilder()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`select_${classificationId}`)
            .setPlaceholder('Or choose another library...')
            .addOptions(
              alternativeLibraries.map(lib => ({
                label: lib.name,
                value: `${classificationId}_${lib.id}`
              }))
            )
        );
      
      components.push(selectRow);
    }

    return components;
  }

  /**
   * Handle Discord interactions (button clicks, dropdown selections)
   */
  async handleInteraction(interaction) {
    try {
      if (interaction.isButton()) {
        const [action, classificationId, newLibraryId] = interaction.customId.split('_');

        if (action === 'correct') {
          // Mark as correct
          await interaction.update({
            content: '✅ Classification marked as correct',
            components: []
          });
        } else if (action === 'move') {
          // Process correction
          await this.processCorrection(
            parseInt(classificationId),
            parseInt(newLibraryId),
            interaction.user.id,
            interaction
          );
        }
      } else if (interaction.isStringSelectMenu()) {
        const [action, classificationId] = interaction.customId.split('_');
        const [selectedClassificationId, newLibraryId] = interaction.values[0].split('_');

        await this.processCorrection(
          parseInt(selectedClassificationId),
          parseInt(newLibraryId),
          interaction.user.id,
          interaction
        );
      }
    } catch (err) {
      console.error('Failed to handle interaction:', err.message);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: '❌ Failed to process correction', ephemeral: true });
      } else {
        await interaction.reply({ content: '❌ Failed to process correction', ephemeral: true });
      }
    }
  }

  /**
   * Process a correction
   */
  async processCorrection(classificationId, newLibraryId, userId, interaction) {
    try {
      // Get classification details
      const classResult = await query(
        'SELECT * FROM classification_history WHERE id = $1',
        [classificationId]
      );

      if (classResult.rows.length === 0) {
        throw new Error('Classification not found');
      }

      const classification = classResult.rows[0];
      const originalLibraryId = classification.assigned_library_id;

      // Get library details
      const libResult = await query('SELECT * FROM libraries WHERE id = $1', [newLibraryId]);
      const newLibrary = libResult.rows[0];

      if (!newLibrary) {
        throw new Error('Library not found');
      }

      // Save correction
      await query(`
        INSERT INTO classification_corrections (
          classification_id, original_library_id, corrected_library_id,
          corrected_by, discord_user_id
        ) VALUES ($1, $2, $3, $4, $5)
      `, [classificationId, originalLibraryId, newLibraryId, 'discord_user', userId]);

      // Update classification history
      await query(
        'UPDATE classification_history SET assigned_library_id = $1 WHERE id = $2',
        [newLibraryId, classificationId]
      );

      // Extract and save learning patterns
      await this.extractLearningPatterns(classification, newLibraryId);

      // Move in *arr if possible
      const moveResult = await this.moveInArr(classification, originalLibraryId, newLibraryId);

      // Update Discord message
      const moveStatus = moveResult.success ? '✓' : '⚠';
      await interaction.update({
        content: `✅ Corrected to: **${newLibrary.name}**\n${moveStatus} ${moveResult.message}`,
        components: []
      });

      console.log(`✓ Correction processed: ${classification.title} → ${newLibrary.name}`);

    } catch (err) {
      console.error('Correction error:', err.message);
      throw err;
    }
  }

  /**
   * Extract learning patterns from correction
   */
  async extractLearningPatterns(classification, newLibraryId) {
    const metadata = classification.metadata;

    // Genre patterns
    if (metadata.genres && Array.isArray(metadata.genres)) {
      for (const genre of metadata.genres) {
        await query(`
          INSERT INTO learning_patterns (pattern_type, pattern_key, pattern_value, library_id, confidence_score)
          VALUES ('genre', 'genre', $1, $2, 0.6)
          ON CONFLICT (pattern_type, pattern_key, library_id)
          DO UPDATE SET 
            occurrence_count = learning_patterns.occurrence_count + 1,
            confidence_score = LEAST(0.95, learning_patterns.confidence_score + 0.05),
            last_seen = CURRENT_TIMESTAMP
        `, [genre, newLibraryId]);
      }
    }

    // Rating pattern
    if (metadata.rating) {
      await query(`
        INSERT INTO learning_patterns (pattern_type, pattern_key, pattern_value, library_id, confidence_score)
        VALUES ('rating', 'rating', $1, $2, 0.7)
        ON CONFLICT (pattern_type, pattern_key, library_id)
        DO UPDATE SET 
          occurrence_count = learning_patterns.occurrence_count + 1,
          confidence_score = LEAST(0.95, learning_patterns.confidence_score + 0.05),
          last_seen = CURRENT_TIMESTAMP
      `, [metadata.rating, newLibraryId]);
    }

    // Keyword patterns (top 5)
    if (metadata.keywords && Array.isArray(metadata.keywords)) {
      for (const keyword of metadata.keywords.slice(0, 5)) {
        await query(`
          INSERT INTO learning_patterns (pattern_type, pattern_key, pattern_value, library_id, confidence_score)
          VALUES ('keyword', 'keyword', $1, $2, 0.5)
          ON CONFLICT (pattern_type, pattern_key, library_id)
          DO UPDATE SET 
            occurrence_count = learning_patterns.occurrence_count + 1,
            confidence_score = LEAST(0.90, learning_patterns.confidence_score + 0.03),
            last_seen = CURRENT_TIMESTAMP
        `, [keyword, newLibraryId]);
      }
    }
  }

  /**
   * Move media in Radarr/Sonarr
   */
  async moveInArr(classification, oldLibraryId, newLibraryId) {
    try {
      const mediaType = classification.media_type;
      
      if (mediaType === 'movie') {
        const oldConfig = await radarrService.getConfig(oldLibraryId);
        const newConfig = await radarrService.getConfig(newLibraryId);
        
        if (oldConfig && newConfig) {
          const result = await radarrService.moveMovie(oldConfig, newConfig, classification.tmdb_id);
          return result.success 
            ? { success: true, message: 'Moved in Radarr' }
            : { success: false, message: `Radarr move failed: ${result.error}` };
        }
      } else {
        const oldConfig = await sonarrService.getConfig(oldLibraryId);
        const newConfig = await sonarrService.getConfig(newLibraryId);
        
        if (oldConfig && newConfig) {
          const result = await sonarrService.moveSeries(oldConfig, newConfig, classification.tmdb_id);
          return result.success 
            ? { success: true, message: 'Moved in Sonarr' }
            : { success: false, message: `Sonarr move failed: ${result.error}` };
        }
      }

      return { success: false, message: '*arr not configured for libraries' };
    } catch (err) {
      return { success: false, message: `Move failed: ${err.message}` };
    }
  }

  /**
   * Get color based on confidence
   */
  getColorForConfidence(confidence) {
    if (confidence >= 90) return 0x4CAF50; // Green
    if (confidence >= 70) return 0x8BC34A; // Light green
    if (confidence >= 50) return 0xFFC107; // Yellow
    return 0xFF9800; // Orange
  }

  /**
   * Format classification method
   */
  formatMethod(method) {
    const methodMap = {
      'exact_match': '🎯 Exact Match',
      'learned_pattern': '🧠 Learned Pattern',
      'rule_match': '📋 Rule Match',
      'ai_classification': '🤖 AI Classification',
      'no_libraries': '❌ No Libraries'
    };
    return methodMap[method] || method;
  }
}

// Create singleton instance
const discordBot = new DiscordBotService();

module.exports = {
  initializeDiscordBot: () => discordBot.initialize(),
  sendClassificationNotification: (metadata, result) => discordBot.sendClassificationNotification(metadata, result),
  discordBot
};
