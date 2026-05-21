/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { clarificationService } from './clarificationService.mjs';

const logger = createLogger('discordLibrarySelectionHandler');

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