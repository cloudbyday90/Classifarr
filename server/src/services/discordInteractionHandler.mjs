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
import { createLogger } from '../utils/logger.mjs';
import { processCorrection as correctionHandlerProcessCorrection } from './discordCorrectionHandler.mjs';
import { processVerification as verificationHandlerProcessVerification } from './discordVerificationHandler.mjs';
import { processClarificationResponse as clarificationHandlerProcessClarificationResponse } from './discordClarificationHandler.mjs';
import { showLibrarySelection as librarySelectionShowLibrarySelection, processQuestionResponse as librarySelectionProcessQuestionResponse } from './discordLibrarySelectionHandler.mjs';
import { processPolicyQuestionAnswer as policyQuestionAnswerHandlerProcess } from './discordPolicyQuestionAnswerHandler.mjs';
import { isDiscordId } from './discordDeliveryContract.mjs';
import { getOfferedDiscordCorrectionKind } from './discordLibrarySelectionControl.mjs';
import { DISCORD_COMPLETED_BUTTON_REQUIRED, DISCORD_SELECTOR_CORRECTION_REQUIRED } from './discordCompletedControlAdmission.mjs';
import {
  DISCORD_LEGACY_MESSAGE_REQUIRED, isOfferedDiscordButton, parseDiscordCompletedButton,
  parseDiscordLegacyClarificationButton, parseDiscordLibrarySelectValues,
} from './discordLegacyControlIdentity.mjs';

const logger = createLogger('discordInteractionHandler');

export async function handleInteraction(interaction) {
  try {
    if (interaction.isButton()) {
      const customId = interaction.customId;
      const parts = customId.split('_');
      const action = parts[0];

      if (action === 'correct' || action === 'reclassify' || action === 'verify') {
        await handleCompletedButton(interaction);
      } else if (action === 'ai') {
        if (parts[1] === 'clarify') {
          const answer = parseDiscordLegacyClarificationButton(customId);
          if (!answer) {
            await interaction.reply({ content: 'Invalid policy question action.', ephemeral: true });
            return;
          }
          await processClarificationResponse(answer.classificationId, answer.optionIndex, interaction);
        } else if (parts[1] === 'answer') {
          await processPolicyQuestionAnswer(interaction);
        }
      } else if (action === 'acknowledge') {
        const _classificationId = parts[1];
        await interaction.update({
          components: [],
          embeds: [
            setDeliveryFooter(EmbedBuilder.from(interaction.message.embeds[0]), '\u2705 Acknowledged'),
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
    } else if (interaction.isStringSelectMenu() && interaction.customId === 'library_select') {
      const selection = parseDiscordLibrarySelectValues(interaction.values);
      if (!selection) {
        await interaction.reply({ content: 'Invalid library selection', ephemeral: true });
        return;
      }
      const discordMessageId = interaction.message?.id;
      if (!isDiscordId(discordMessageId)) {
        await interaction.reply({ content: DISCORD_LEGACY_MESSAGE_REQUIRED, ephemeral: true });
        return;
      }
      const selectorNotificationKind = getOfferedDiscordCorrectionKind(interaction);
      if (!selectorNotificationKind) {
        await interaction.reply({ content: DISCORD_SELECTOR_CORRECTION_REQUIRED, ephemeral: true });
        return;
      }
      await processCorrection(selection.classificationId, selection.newLibraryId, interaction, {
        discordMessageId, notificationKind: selectorNotificationKind, unavailableMessage: DISCORD_SELECTOR_CORRECTION_REQUIRED,
      });
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

async function handleCompletedButton(interaction) {
  const control = parseDiscordCompletedButton(interaction.customId);
  const discordMessageId = interaction.message?.id;
  if (!control || !isDiscordId(discordMessageId) || !isOfferedDiscordButton(interaction)) {
    await interaction.reply({ content: DISCORD_COMPLETED_BUTTON_REQUIRED, ephemeral: true });
    return;
  }

  const binding = { discordMessageId, notificationKind: control.notificationKind };
  if (control.action === 'reclassify') {
    await processCorrection(control.classificationId, control.destinationLibraryId, interaction, binding);
  } else if (control.action === 'verify_no') {
    await showLibrarySelection(control.classificationId, interaction, binding);
  } else {
    await processVerification(control.classificationId, interaction, binding);
  }
}

export async function processCorrection(classificationId, newLibraryId, interaction, options = undefined) {
  return correctionHandlerProcessCorrection(classificationId, newLibraryId, interaction, options);
}

export async function processClarificationResponse(
  classificationId,
  optionIndex,
  interaction,
) {
  return clarificationHandlerProcessClarificationResponse(classificationId, optionIndex, interaction);
}

export async function processPolicyQuestionAnswer(interaction) {
  return policyQuestionAnswerHandlerProcess(interaction);
}

export async function processVerification(classificationId, interaction, binding) {
  return verificationHandlerProcessVerification(classificationId, interaction, binding);
}

export async function showLibrarySelection(classificationId, interaction, binding) {
  return librarySelectionShowLibrarySelection(classificationId, interaction, binding);
}

export async function processQuestionResponse(classificationId, questionId, responseKey, interaction) {
  return librarySelectionProcessQuestionResponse(classificationId, questionId, responseKey, interaction);
}
