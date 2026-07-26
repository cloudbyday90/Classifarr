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
import { routeAfterClarification } from './discordClarificationRouting.mjs';
import {
  DISCORD_PENDING_ANSWER_ACTION_IDS,
  policyDiscordPendingAnswerIntakeService,
} from './policyDiscordPendingAnswerIntake.mjs';

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
    const outcomeRecord = await classificationOutcomeService.recordOutcome(classificationId, {
      type: 'verified',
      source: 'discord_verification',
      actor: interaction.user.username,
      final_library_id: classification.library_id || null,
      final_library_name: classification.library_name || null,
    });
    const pendingAnswerIntake = policyDiscordPendingAnswerIntakeService.build({
      classification,
      destination: {
        libraryId: classification.library_id,
        libraryName: classification.library_name,
      },
      actionId: DISCORD_PENDING_ANSWER_ACTION_IDS.VERIFY_DESTINATION,
      finalOutcomeRecorded: outcomeRecord.updated === true,
    });

    logger.info('Discord verification pending-answer intake evaluated', {
      classificationId,
      statusId: pendingAnswerIntake.statusId,
      sourceStateId: pendingAnswerIntake.sourceStateId,
      sourceEventId: pendingAnswerIntake.learningIntake?.sourceEventId || null,
      guardDecisionId: pendingAnswerIntake.learningGuard?.learning?.decisionId || null,
      auditOk: pendingAnswerIntake.audit.ok,
      reasonCodes: pendingAnswerIntake.reasonCodes,
    });

    try {
      await routeAfterClarification(classificationId);
    } catch (routeError) {
      logger.error('Error routing after verification:', routeError);
    }

    await interaction.editReply({
      components: [],
      embeds: [
        EmbedBuilder.from(interaction.message.embeds[0])
          .setColor(0x22c55e)
          .setFooter({
            text: `\u2705 Verified by ${interaction.user.username} \u2022 Outcome recorded`,
          }),
      ],
    });

    await interaction.followUp({
      content: '\u2705 **Verified.** The outcome was recorded for this item.',
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
