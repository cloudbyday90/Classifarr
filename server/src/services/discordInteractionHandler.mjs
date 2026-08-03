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
import { createLogger } from '../utils/logger.mjs';
import { processCorrection as correctionHandlerProcessCorrection } from './discordCorrectionHandler.mjs';
import { processVerification as verificationHandlerProcessVerification } from './discordVerificationHandler.mjs';
import { processClarificationResponse as clarificationHandlerProcessClarificationResponse } from './discordClarificationHandler.mjs';
import { showLibrarySelection as librarySelectionShowLibrarySelection, processQuestionResponse as librarySelectionProcessQuestionResponse } from './discordLibrarySelectionHandler.mjs';
import { processPolicyQuestionAnswer as policyQuestionAnswerHandlerProcess } from './discordPolicyQuestionAnswerHandler.mjs';
import { getPolicyRuntimeQuestionAnswerActionIdFromCode } from './policyRuntimeQuestionAnswerContract.mjs';

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
        } else if (parts[1] === 'answer') {
          const classificationId = Number.parseInt(parts[2], 10);
          const actionId = getPolicyRuntimeQuestionAnswerActionIdFromCode(parts[3]);
          const destinationLibraryId = Number.parseInt(parts[4], 10);
          const contractFingerprint = parts[5];
          await processPolicyQuestionAnswer({
            classificationId,
            destinationLibraryId,
            contractVersion: 'policy.runtime_question_answer.v1',
            contractFingerprint,
            actionId,
          }, interaction);
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

export async function processClarificationResponse(
  classificationId,
  optionIndex,
  interaction,
) {
  return clarificationHandlerProcessClarificationResponse(classificationId, optionIndex, interaction);
}

export async function processPolicyQuestionAnswer(answer, interaction) {
  return policyQuestionAnswerHandlerProcess(answer, interaction);
}

export async function processVerification(classificationId, isCorrect, interaction) {
  return verificationHandlerProcessVerification(classificationId, isCorrect, interaction);
}

export async function showLibrarySelection(classificationId, interaction) {
  return librarySelectionShowLibrarySelection(classificationId, interaction);
}

export async function processQuestionResponse(classificationId, questionId, responseKey, interaction) {
  return librarySelectionProcessQuestionResponse(classificationId, questionId, responseKey, interaction);
}
