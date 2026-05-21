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
import { extractLearningPatterns, routeAfterClarification } from './discordInteractionHandler.mjs';

const logger = createLogger('discordVerificationHandler');

export async function processVerification(classificationId, isCorrect, interaction) {
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

    logger.info('[Discord] Processing verification', {
      id: classificationId,
      isCorrect,
      library_id: classification.library_id,
      status: classification.status,
    });

    if (classification.status === 'verified' || classification.status === 'routed') {
      await interaction.followUp({
        content: '\u2705 Already processed \u2014 no changes made.',
        ephemeral: true,
      });
      return;
    }

    await db.query(
      `UPDATE classification_history 
       SET status = 'verified',
           clarification_status = 'confirmed'
       WHERE id = $1`,
      [classificationId],
    );
    await classificationOutcomeService.recordOutcome(classificationId, {
      type: 'verified',
      source: 'discord_verification',
      actor: interaction.user.username,
      final_library_id: classification.library_id || null,
      final_library_name: classification.library_name || null,
    });

    try {
      const metadata = classification.item_metadata || {};
      const learningResult = await autoLearningService.learnFromFeedback({
        tmdbId: classification.tmdb_id,
        libraryId: classification.library_id,
        genres: normalizeMetadataList(metadata.genres),
        keywords: normalizeMetadataList(metadata.keywords),
        studio: metadata.studio,
        wasCorrection: false,
        userId: interaction.user.id,
      });

      logger.info('[Discord] Auto-learning result', {
        classificationId,
        learned: learningResult.learned,
        preferences: learningResult.preferences,
      });
    } catch (learningError) {
      logger.error('[Discord] Auto-learning failed:', learningError);
    }

    const libraryIdToLearn =
      classification.library_id === undefined
        ? null
        : classification.library_id;
    await extractLearningPatterns(classificationId, libraryIdToLearn);

    try {
      await routeAfterClarification(classificationId);
    } catch (routeError) {
      logger.error('Error routing after verification:', routeError);
    }

    const metadata = classification.item_metadata || {};
    let feedbackMessage = '\u2705 **Verified!** System learned from your confirmation.';

    try {
      const learnedItems = [];
      const learnedGenres = normalizeMetadataList(metadata.genres);
      const learnedKeywords = normalizeMetadataList(metadata.keywords);
      if (learnedGenres.length > 0) {
        learnedItems.push(`Genres: ${learnedGenres.slice(0, 3).join(', ')}`);
      }
      if (learnedKeywords.length > 0) {
        learnedItems.push(`Keywords: ${learnedKeywords.slice(0, 3).join(', ')}`);
      }
      if (learnedItems.length > 0) {
        feedbackMessage += `\n\n_System is learning these preferences for this library:_\n${learnedItems.join('\n')}`;
      }
    } catch (_error) {
    }

    await interaction.editReply({
      components: [],
      embeds: [
        EmbedBuilder.from(interaction.message.embeds[0])
          .setColor(0x22c55e)
          .setFooter({
            text: `\u2705 Verified by ${interaction.user.username} \u2022 Will auto-route same title next time`,
          }),
      ],
    });

    await interaction.followUp({
      content: feedbackMessage,
      ephemeral: true,
    });
  } catch (error) {
    logger.error('Error processing verification:', error);
    try {
      await interaction.followUp({
        content: `Failed to process verification: ${error.message || 'Unknown error'}\nClassification ID: ${classificationId}`,
        ephemeral: true,
      });
    } catch (_replyErr) {
      logger.debug('[Discord] Could not send error reply for verification', { error: _replyErr.message });
    }
  }
}