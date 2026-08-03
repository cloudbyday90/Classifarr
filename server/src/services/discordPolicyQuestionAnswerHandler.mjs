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
import { clarificationService } from './clarificationService.mjs';
import { routeAfterClarification } from './discordClarificationRouting.mjs';
import { recordNativePendingRouteOutcome } from './policyNativePendingRouteOutcomePersistence.mjs';

const logger = createLogger('discordPolicyQuestionAnswerHandler');

function normalizePositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function isAuthorizedDiscordTarget(classification, interaction) {
  const expectedMessageId = String(classification?.discord_message_id || '').trim();
  const interactionMessageId = String(interaction?.message?.id || '').trim();

  return Boolean(expectedMessageId && interactionMessageId && expectedMessageId === interactionMessageId);
}

async function sendResolutionError(interaction, error) {
  if (error?.statusCode === 404) {
    await interaction.followUp({ content: 'Classification not found.', ephemeral: true });
    return;
  }
  if (error?.statusCode === 409) {
    const content = error?.code === 'policy_question_stale'
      ? 'This policy question is stale. Retry Classification from the latest queue state.'
      : 'This policy question changed or was already handled. Refresh the latest queue state.';
    await interaction.followUp({ content, ephemeral: true });
    return;
  }
  if (error?.statusCode === 400) {
    await interaction.followUp({
      content: 'This answer is no longer valid. Refresh the latest queue state before trying again.',
      ephemeral: true,
    });
    return;
  }

  logger.error('Discord policy question answer failed', {
    statusCode: error?.statusCode || null,
    error: error?.message || 'unknown',
  }, { error });
  await interaction.followUp({
    content: 'Could not resolve this item. No changes were made; retry from the latest queue state.',
    ephemeral: true,
  });
}

export async function processPolicyQuestionAnswer({
  classificationId,
  destinationLibraryId,
  contractVersion,
  contractFingerprint,
  actionId,
} = {}, interaction) {
  const normalizedClassificationId = normalizePositiveInteger(classificationId);
  const normalizedDestinationLibraryId = normalizePositiveInteger(destinationLibraryId);
  if (!normalizedClassificationId || !normalizedDestinationLibraryId ||
      typeof contractVersion !== 'string' || typeof contractFingerprint !== 'string' ||
      typeof actionId !== 'string') {
    await interaction.reply({ content: 'Invalid policy question action.', ephemeral: true });
    return;
  }

  try {
    await interaction.deferUpdate();

    const classResult = await db.query(
      'SELECT *, policy_question FROM classification_history WHERE id = $1',
      [normalizedClassificationId],
    );
    const classification = classResult.rows[0];
    if (!classification) {
      await interaction.followUp({ content: 'Classification not found.', ephemeral: true });
      return;
    }
    if (!isAuthorizedDiscordTarget(classification, interaction)) {
      logger.warn('Discord policy question answer rejected for an unexpected message target', {
        classificationId: normalizedClassificationId,
        expectedMessageId: classification.discord_message_id || null,
        interactionMessageId: interaction?.message?.id || null,
      });
      await interaction.followUp({
        content: 'This action does not belong to the current pending notification. Refresh the latest queue state.',
        ephemeral: true,
      });
      return;
    }

    let resolveResult;
    try {
      resolveResult = await clarificationService.resolveRuntimeQuestionAnswer(
        normalizedClassificationId,
        {
          contract_version: contractVersion,
          contract_fingerprint: contractFingerprint,
          action_id: actionId,
          destination_library_id: normalizedDestinationLibraryId,
        },
        interaction.user?.username || `discord:${interaction.user?.id || 'operator'}`,
      );
    } catch (error) {
      await sendResolutionError(interaction, error);
      return;
    }

    if (resolveResult.alreadyResolved) {
      await interaction.followUp({ content: 'Already processed. No changes were made.', ephemeral: true });
      return;
    }

    const routingOutcome = resolveResult.shouldRoute
      ? await routeAfterClarification(normalizedClassificationId)
      : { routed: false, reason: 'route_not_applicable', error: null };
    if (resolveResult.nativeResolutionProvenance) {
      await recordNativePendingRouteOutcome({
        classificationId: normalizedClassificationId,
        nativeResolutionProvenance: resolveResult.nativeResolutionProvenance,
        routingOutcome,
      });
    }

    const libraryName = resolveResult.libraryName || 'selected destination';
    const routingStatus = resolveResult.shouldRoute
      ? (routingOutcome.routed
        ? `Routed to ${libraryName}`
        : `Not routed (${routingOutcome.reason || 'routing_skipped'})`)
      : 'Routing was intentionally not requested.';

    await interaction.editReply({
      components: [],
      embeds: [
        EmbedBuilder.from(interaction.message.embeds[0])
          .setColor(0x22c55e)
          .addFields(
            { name: 'Selected Library', value: libraryName, inline: true },
            { name: 'Routing', value: routingStatus, inline: false },
          )
          .setFooter({
            text: `Resolved by ${interaction.user?.username || 'Discord operator'} - resolution recorded`,
          }),
      ],
    });

    if (resolveResult.shouldRoute && !routingOutcome.routed) {
      await interaction.followUp({
        content: `Routing did not complete for **${libraryName}**. Reason: \`${routingOutcome.reason || 'unknown'}\`${routingOutcome.error ? ` (${routingOutcome.error})` : ''}`,
        ephemeral: true,
      });
    }
  } catch (error) {
    logger.error('Error processing Discord policy question answer', {
      classificationId: normalizedClassificationId,
      error: error?.message || 'unknown',
    }, { error });
    try {
      await interaction.followUp({ content: 'Failed to process response.', ephemeral: true });
    } catch (replyError) {
      logger.debug('Could not send Discord policy question answer error reply', {
        error: replyError?.message || 'unknown',
      });
    }
  }
}

export { isAuthorizedDiscordTarget };
