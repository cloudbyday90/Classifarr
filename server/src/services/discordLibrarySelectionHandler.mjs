/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import { ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { VERIFICATION_CORRECTION_PLACEHOLDER } from './discordLibrarySelectionControl.mjs';
import { getDiscordCompletedControlRefusal } from './discordCompletedControlAdmission.mjs';

const logger = createLogger('discordLibrarySelectionHandler');

export async function showLibrarySelection(classificationId, interaction, binding) {
  try {
    await interaction.deferUpdate();

    const result = await db.withTransaction(async client => {
      const { rows: [classification] } = await client.query(
        'SELECT id, status, discord_message_id, media_type FROM classification_history WHERE id = $1 FOR SHARE',
        [classificationId],
      );
      if (!classification) return { message: 'Classification not found' };
      const refusal = await getDiscordCompletedControlRefusal(client, classification, binding);
      if (refusal) return { message: refusal };
      const { rows } = await client.query(
        'SELECT id, name, media_type FROM libraries WHERE media_type = $1 AND is_active = true',
        [classification.media_type],
      );
      return rows.length ? { libraries: rows } : { message: 'No libraries available' };
    });
    if (result.message) {
      await interaction.followUp({ content: result.message, ephemeral: true });
      return;
    }

    const options = result.libraries.map((lib) => ({
      label: lib.name,
      value: `${classificationId}_${lib.id}`,
      description: `${lib.media_type} library`,
    }));

    await interaction.editReply({
      components: [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('library_select')
            .setPlaceholder(VERIFICATION_CORRECTION_PLACEHOLDER)
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
