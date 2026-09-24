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
import { classificationOutcomeService } from './classificationOutcomeService.mjs';
import { persistDiscordCorrection } from './discordCorrectionPersistence.mjs';
import { routeAfterClarification } from './discordClarificationRouting.mjs';
import {
  DISCORD_PENDING_ANSWER_ACTION_IDS,
  policyDiscordPendingAnswerIntakeService,
} from './policyDiscordPendingAnswerIntake.mjs';

const logger = createLogger('discordCorrectionHandler');

export async function processCorrection(classificationId, newLibraryId, interaction) {
  try {
    await interaction.deferUpdate();

    let routingOutcome = { routed: false, reason: null, error: null };

    const persisted = await persistDiscordCorrection(db, classificationOutcomeService, {
      classificationId, newLibraryId, actor: interaction.user.username,
    });
    if (persisted.message) {
      await interaction.followUp({ content: persisted.message, ephemeral: true });
      return;
    }
    const { classification, newLibraryName, outcomeRecord } = persisted;
    const originalLibraryId = classification.library_id;
    const pendingAnswerIntake = policyDiscordPendingAnswerIntakeService.build({
      classification,
      destination: {
        libraryId: newLibraryId,
        libraryName: newLibraryName,
      },
      actionId: DISCORD_PENDING_ANSWER_ACTION_IDS.CORRECT_DESTINATION,
      finalOutcomeRecorded: outcomeRecord.updated === true,
    });

    logger.info('Discord correction pending-answer intake evaluated', {
      classificationId,
      originalLibraryId,
      newLibraryId,
      statusId: pendingAnswerIntake.statusId,
      sourceStateId: pendingAnswerIntake.sourceStateId,
      sourceEventId: pendingAnswerIntake.learningIntake?.sourceEventId || null,
      guardDecisionId: pendingAnswerIntake.learningGuard?.learning?.decisionId || null,
      auditOk: pendingAnswerIntake.audit.ok,
      reasonCodes: pendingAnswerIntake.reasonCodes,
    });

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
