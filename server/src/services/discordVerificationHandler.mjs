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
import { setDeliveryFooter } from './discordDeliveryPayload.mjs';
import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { classificationOutcomeService } from './classificationOutcomeService.mjs';
import { persistDiscordVerification } from './discordVerificationPersistence.mjs';
import { routeAfterClarification } from './discordClarificationRouting.mjs';
import {
  DISCORD_PENDING_ANSWER_ACTION_IDS,
  policyDiscordPendingAnswerIntakeService,
} from './policyDiscordPendingAnswerIntake.mjs';

const logger = createLogger('discordVerificationHandler');

export async function processVerification(classificationId, interaction, binding) {
  try {
    await interaction.deferUpdate();

    const { classification, message } = await persistDiscordVerification(db, classificationOutcomeService, {
      classificationId, actor: interaction.user.username, binding,
    });
    if (message) {
      await interaction.followUp({ content: message, ephemeral: true });
      return;
    }

    const pendingAnswerIntake = policyDiscordPendingAnswerIntakeService.build({
      classification,
      destination: {
        libraryId: classification.library_id,
        libraryName: classification.library_name,
      },
      actionId: DISCORD_PENDING_ANSWER_ACTION_IDS.VERIFY_DESTINATION,
      finalOutcomeRecorded: true,
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
        setDeliveryFooter(EmbedBuilder.from(interaction.message.embeds[0])
          .setColor(0x22c55e), `\u2705 Verified by ${interaction.user.username} \u2022 Outcome recorded`),
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
        content: 'Failed to process verification. Open Classifarr to review the item.',
        ephemeral: true,
      });
    } catch (_replyErr) {
      logger.debug('[Discord] Could not send error reply for verification', { error: _replyErr.message });
    }
  }
}
