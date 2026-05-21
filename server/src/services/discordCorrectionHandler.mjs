/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import { EmbedBuilder } from 'discord.js';
import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { normalizeMetadataList } from '../utils/metadataNormalization.mjs';
import { classificationOutcomeService } from './classificationOutcomeService.mjs';
import { autoLearningService } from './autoLearningService.mjs';
import * as notificationBuilder from './discordNotificationBuilder.mjs';
import { extractLearningPatterns, routeAfterClarification } from './discordInteractionHandler.mjs';

const logger = createLogger('discordCorrectionHandler');

export async function processCorrection(classificationId, newLibraryId, interaction) {
  try {
    await interaction.deferUpdate();

    let routingOutcome = { routed: false, reason: null, error: null };

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

    const originalLibraryId = classResult.rows[0].library_id;
    const classification = classResult.rows[0];
    const existingLibraryId = notificationBuilder.toFiniteNumber(classification.library_id);

    const libResult = await db.query(
      'SELECT name FROM libraries WHERE id = $1',
      [newLibraryId],
    );

    if (libResult.rows.length === 0) {
      await interaction.followUp({
        content: 'Library not found',
        ephemeral: true,
      });
      return;
    }

    const newLibraryName = libResult.rows[0].name;

    if (existingLibraryId !== null && existingLibraryId === newLibraryId) {
      await interaction.followUp({
        content: '\u2705 Already processed \u2014 no changes made.',
        ephemeral: true,
      });
      return;
    }

    const clarificationResponse = {
      corrected_library_id: newLibraryId,
      corrected_library_name: newLibraryName,
      corrected_by: interaction.user.username,
      corrected_at: new Date().toISOString(),
    };

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
        'corrected',
        classificationId,
        JSON.stringify(clarificationResponse),
      ],
    );
    await db.query(
      'INSERT INTO classification_corrections (classification_id, original_library_id, corrected_library_id, corrected_by) VALUES ($1, $2, $3, $4)',
      [
        classificationId,
        originalLibraryId,
        newLibraryId,
        interaction.user.username,
      ],
    );
    await classificationOutcomeService.recordOutcome(classificationId, {
      type: 'corrected',
      source: 'discord_correction',
      actor: interaction.user.username,
      final_library_id: newLibraryId,
      final_library_name: newLibraryName,
    });

    try {
      const metadata = classification.item_metadata || {};
      const learningResult = await autoLearningService.learnFromFeedback({
        tmdbId: classification.tmdb_id,
        libraryId: newLibraryId,
        genres: normalizeMetadataList(metadata.genres),
        keywords: normalizeMetadataList(metadata.keywords),
        studio: metadata.studio,
        wasCorrection: true,
        userId: interaction.user.id,
      });

      logger.info('[Discord] Auto-learning from correction', {
        classificationId,
        originalLibrary: originalLibraryId,
        newLibrary: newLibraryId,
        learned: learningResult.learned,
        preferences: learningResult.preferences,
      });
    } catch (learningError) {
      logger.error('[Discord] Auto-learning from correction failed:', learningError);
    }

    try {
      await extractLearningPatterns(classificationId, newLibraryId);
    } catch (patternError) {
      logger.error('Error extracting patterns during correction:', patternError);
    }

    try {
      routingOutcome = await routeAfterClarification(classificationId);
    } catch (routeError) {
      routingOutcome = {
        routed: false,
        reason: 'exception',
        error: routeError.message,
      };
      logger.error('Error routing after correction:', routeError);
    }

    const routingStatusText = routingOutcome.routed
      ? `\u2705 Routed to ${newLibraryName}`
      : `\u26A0\uFE0F Not routed (${routingOutcome.reason || 'routing_skipped'})`;

    await interaction.editReply({
      components: [],
      embeds: [
        EmbedBuilder.from(interaction.message.embeds[0])
          .addFields(
            {
              name: 'Corrected To',
              value: newLibraryName,
              inline: true,
            },
            {
              name: 'Routing',
              value: routingStatusText,
              inline: false,
            },
          )
          .setFooter({
            text: `\u2705 Corrected by ${interaction.user.username}`,
          }),
      ],
    });

    if (!routingOutcome.routed) {
      await interaction.followUp({
        content: `Correction saved but routing did not complete. Reason: \`${routingOutcome.reason || 'unknown'}\`${routingOutcome.error ? ` (${routingOutcome.error})` : ''}`,
        ephemeral: true,
      });
    }
  } catch (error) {
    logger.error('Error processing correction:', error);
    try {
      await interaction.followUp({
        content: 'Failed to process correction',
        ephemeral: true,
      });
    } catch (_replyErr) {
      logger.debug('[Discord] Could not send error reply for correction', { error: _replyErr.message });
    }
  }
}