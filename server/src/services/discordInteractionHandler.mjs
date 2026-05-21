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
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { classificationEvidenceService } from './classificationEvidenceService.mjs';
import { clarificationService } from './clarificationService.mjs';
import { routeToArr } from './classificationRoutingService.mjs';
import * as notificationBuilder from './discordNotificationBuilder.mjs';
import { processCorrection as correctionHandlerProcessCorrection } from './discordCorrectionHandler.mjs';
import { processVerification as verificationHandlerProcessVerification } from './discordVerificationHandler.mjs';
import { processClarificationResponse as clarificationHandlerProcessClarificationResponse } from './discordClarificationHandler.mjs';

const logger = createLogger('discordInteractionHandler');

export async function handleInteraction(interaction) {
  try {
    if (interaction.isButton()) {
      const customId = interaction.customId;
      const parts = customId.split('_');
      const action = parts[0];

      if (action === 'correct') {
        const classificationId = parseInt(parts[1]);
        await processVerification(classificationId, true, interaction);
      } else if (action === 'reclassify') {
        const classificationId = parts[1];
        const newLibraryId = parts[2];
        await processCorrection(
          parseInt(classificationId),
          parseInt(newLibraryId),
          interaction,
        );
      } else if (action === 'ai') {
        if (parts[1] === 'clarify') {
          const classificationId = parseInt(parts[2]);
          const optionIndex = parseInt(parts[3]);
          await processClarificationResponse(
            classificationId,
            optionIndex,
            interaction,
          );
        }
      } else if (action === 'verify') {
        const subAction = parts[1];
        const classificationId = parseInt(parts[2]);
        if (subAction === 'yes') {
          await processVerification(classificationId, true, interaction);
        } else if (subAction === 'no') {
          await showLibrarySelection(classificationId, interaction);
        }
      } else if (action === 'acknowledge') {
        const _classificationId = parts[1];
        await interaction.update({
          components: [],
          embeds: [
            EmbedBuilder.from(interaction.message.embeds[0]).setFooter({
              text: '\u2705 Acknowledged',
            }),
          ],
        });
      } else if (action === 'clarify') {
        const classificationId = parseInt(parts[1]);
        const questionId = parseInt(parts[2]);
        const responseKey = parts[3];
        await processQuestionResponse(
          classificationId,
          questionId,
          responseKey,
          interaction,
        );
      }
    } else if (interaction.isStringSelectMenu()) {
      const [classificationId, newLibraryId] =
        interaction.values[0].split('_');
      await processCorrection(
        parseInt(classificationId),
        parseInt(newLibraryId),
        interaction,
      );
    }
  } catch (error) {
    logger.error('Error handling Discord interaction:', error);
    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({
          content: 'An error occurred',
          ephemeral: true,
        });
      } catch (_replyErr) {
        logger.debug('[Discord] Could not send top-level error reply', { error: _replyErr.message });
      }
    }
  }
}

export async function processCorrection(classificationId, newLibraryId, interaction) {
  return correctionHandlerProcessCorrection(classificationId, newLibraryId, interaction);
}

export async function extractLearningPatterns(classificationId, libraryId) {
  try {
    const result = await db.query(
      'SELECT tmdb_id, media_type, metadata FROM classification_history WHERE id = $1',
      [classificationId],
    );

    if (result.rows.length > 0) {
      const { tmdb_id, media_type, metadata } = result.rows[0];

      await classificationEvidenceService.rememberExactMatch({
        tmdbId: tmdb_id,
        mediaType: media_type || 'unknown',
        libraryId,
        payload: metadata,
        payloadColumn: 'pattern_data',
        conflictMode: 'do_nothing',
      });
    }
  } catch (error) {
    logger.error('Error extracting learning patterns:', error);
  }
}

export async function processClarificationResponse(
  classificationId,
  optionIndex,
  interaction,
) {
  return clarificationHandlerProcessClarificationResponse(classificationId, optionIndex, interaction);
}

export async function processVerification(classificationId, isCorrect, interaction) {
  return verificationHandlerProcessVerification(classificationId, isCorrect, interaction);
}

export async function showLibrarySelection(classificationId, interaction) {
  try {
    await interaction.deferUpdate();

    const classResult = await db.query(
      'SELECT media_type FROM classification_history WHERE id = $1',
      [classificationId],
    );

    if (classResult.rows.length === 0) {
      await interaction.followUp({
        content: 'Classification not found',
        ephemeral: true,
      });
      return;
    }

    const mediaType = classResult.rows[0].media_type;

    const libResult = await db.query(
      'SELECT id, name, media_type FROM libraries WHERE media_type = $1 AND is_active = true',
      [mediaType],
    );

    if (libResult.rows.length === 0) {
      await interaction.followUp({
        content: 'No libraries available',
        ephemeral: true,
      });
      return;
    }

    const options = libResult.rows.map((lib) => ({
      label: lib.name,
      value: `${classificationId}_${lib.id}`,
      description: `${lib.media_type} library`,
    }));

    await interaction.editReply({
      components: [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('library_select')
            .setPlaceholder('Select the correct library...')
            .addOptions(options),
        ),
      ],
    });
  } catch (error) {
    logger.error('Error showing library selection:', error);
    try {
      await interaction.followUp({
        content: 'Failed to show options',
        ephemeral: true,
      });
    } catch (_replyErr) {
      logger.debug('[Discord] Could not send error reply for library selection', { error: _replyErr.message });
    }
  }
}

export async function processQuestionResponse(
  classificationId,
  questionId,
  responseKey,
  interaction,
) {
  try {
    await interaction.deferUpdate();

    const classResult = await db.query(
      'SELECT * FROM classification_history WHERE id = $1',
      [classificationId],
    );

    if (classResult.rows.length === 0) {
      await interaction.followUp({
        content: 'Classification not found',
        ephemeral: true,
      });
      return;
    }

    const classification = classResult.rows[0];

    await clarificationService.recordResponse(
      classificationId,
      questionId,
      responseKey,
      interaction.user.id,
      classification.confidence,
    );

    await interaction.editReply({
      components: [],
      embeds: [
        EmbedBuilder.from(interaction.message.embeds[0])
          .addFields({ name: 'Response', value: responseKey, inline: true })
          .setFooter({ text: `\u2705 Answered by ${interaction.user.username}` }),
      ],
    });
  } catch (error) {
    logger.error('Error processing question response:', error);
    try {
      await interaction.followUp({
        content: 'Failed to process response',
        ephemeral: true,
      });
    } catch (_replyErr) {
      logger.debug('[Discord] Could not send error reply for question response', { error: _replyErr.message });
    }
  }
}

export async function extractClarificationPatterns(
  classificationId,
  libraryId,
  selectedOption,
) {
  try {
    const result = await db.query(
      'SELECT tmdb_id, media_type, metadata, title FROM classification_history WHERE id = $1',
      [classificationId],
    );

    if (result.rows.length > 0) {
      const { tmdb_id, media_type, metadata, title } = result.rows[0];

      await classificationEvidenceService.rememberExactMatch({
        tmdbId: tmdb_id,
        mediaType: media_type || 'unknown',
        libraryId,
        payload: { ...metadata, clarification_response: selectedOption },
        payloadColumn: 'pattern_data',
        conflictMode: 'update_payload',
      });

      logger.info(
        `Learned: ${title} (TMDB: ${tmdb_id}) -> Library ${libraryId} via clarification`,
      );
    }
  } catch (error) {
    logger.error('Error extracting clarification patterns:', error);
  }
}

export async function routeAfterClarification(classificationId) {
  const outcome = {
    routed: false,
    reason: null,
    error: null,
    arrType: null,
  };

  try {
    const result = await db.query(
      `SELECT ch.*, l.arr_type, l.arr_id, l.name as library_name,
              l.radarr_settings, l.sonarr_settings, l.root_folder, l.quality_profile_id
       FROM classification_history ch
       JOIN libraries l ON ch.library_id = l.id
       WHERE ch.id = $1`,
      [classificationId],
    );

    if (result.rows.length === 0) {
      outcome.reason = 'classification_not_found';
      return outcome;
    }

    const classification = result.rows[0];
    outcome.arrType = classification.arr_type || null;
    let metadata = classification.metadata;
    if (typeof metadata === 'string') {
      metadata = notificationBuilder.safeParseJson(metadata);
    }

    if (!metadata || typeof metadata !== 'object') {
      logger.warn('Skipping *arr routing due to invalid metadata', {
        classificationId,
        metadataType: typeof classification.metadata,
      });
      outcome.reason = 'invalid_metadata';
      return outcome;
    }

    if (classification.status === 'routed') {
      outcome.routed = true;
      outcome.reason = 'already_routed';
      return outcome;
    }

    const routeResult = await routeToArr(metadata, {
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
      outcome.reason = routeResult?.reason || 'route_skipped';
      outcome.error = routeResult?.error || null;
      logger.warn('Routing after clarification skipped', {
        classificationId,
        reason: outcome.reason,
        error: outcome.error,
      });
      return outcome;
    }

    await db.query(
      "UPDATE classification_history SET status = $1 WHERE id = $2",
      ['routed', classificationId],
    );

    logger.info(
      `Routed after clarification: ${metadata.title} -> ${classification.library_name}`,
    );
    outcome.routed = true;
    outcome.reason = 'routed';
    return outcome;
  } catch (error) {
    logger.error('Error routing after clarification:', error);
    outcome.reason = 'exception';
    outcome.error = error.message;
    return outcome;
  }
}