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
import * as notificationBuilder from './discordNotificationBuilder.mjs';
import { extractClarificationPatterns, routeAfterClarification } from './discordInteractionHandler.mjs';

const logger = createLogger('discordClarificationHandler');

export async function processClarificationResponse(
  classificationId,
  optionIndex,
  interaction,
) {
  try {
    await interaction.deferUpdate();

    const classResult = await db.query(
      'SELECT *, policy_question FROM classification_history WHERE id = $1',
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

    let selectedLabel = `Option ${optionIndex + 1}`;
    let libraryId = classification.library_id;
    let routingOutcome = { routed: false, reason: null, error: null };

    if (classification.policy_question) {
      const policyQuestion =
        typeof classification.policy_question === 'string'
          ? notificationBuilder.safeParseJson(classification.policy_question)
          : classification.policy_question;

      if (policyQuestion?.options && policyQuestion.options[optionIndex]) {
        const selectedOption = policyQuestion.options[optionIndex];
        selectedLabel = selectedOption.label;

        if (selectedOption.library_id) {
          libraryId = selectedOption.library_id;
        }
      }
    } else {
      const selectedButton =
        interaction.message.components[0]?.components[optionIndex];
      selectedLabel = selectedButton?.label || selectedLabel;
    }

    const existingLibraryId = notificationBuilder.toFiniteNumber(classification.library_id);
    if (
      ['completed', 'routed', 'corrected', 'verified'].includes(classification.status) &&
      existingLibraryId !== null &&
      libraryId !== null &&
      existingLibraryId === libraryId
    ) {
      await interaction.followUp({
        content: '\u2705 Already processed \u2014 no changes made.',
        ephemeral: true,
      });
      return;
    }

    try {
      const resolveResult = await clarificationService.resolvePolicyQuestion(
        classificationId,
        libraryId,
        selectedLabel,
        interaction.user.username,
        true,
      );

      if (resolveResult.alreadyResolved) {
        await interaction.followUp({
          content: '\u2705 Already processed \u2014 no changes made.',
          ephemeral: true,
        });
        return;
      }

      if (resolveResult.shouldRoute) {
        routingOutcome = await routeAfterClarification(classificationId);
      }
    } catch (resolveError) {
      if (resolveError?.statusCode === 404) {
        await interaction.followUp({
          content: 'Classification not found',
          ephemeral: true,
        });
        return;
      }

      if (resolveError?.statusCode === 400) {
        await interaction.followUp({
          content: 'Invalid library selection',
          ephemeral: true,
        });
        return;
      }

      if (resolveError?.statusCode === 409 && resolveError?.code === 'policy_question_stale') {
        await interaction.followUp({
          content: 'This policy question is stale and must be retried from the latest queue state.',
          ephemeral: true,
        });
        return;
      }

      if (resolveError?.statusCode === 409) {
        await interaction.followUp({
          content: '\u2705 Already processed \u2014 no changes made.',
          ephemeral: true,
        });
        return;
      }

      logger.error(
        'resolvePolicyQuestion failed, falling back to legacy handling:',
        resolveError,
      );

      let resolvedLibraryId = libraryId;
      let resolvedLibraryName = null;

      if (!resolvedLibraryId && selectedLabel) {
        const normalizedLabel = selectedLabel
          .replace(/\s*\(.*\)\s*$/, '')
          .trim();
        let libResult = await db.query(
          'SELECT id, name FROM libraries WHERE LOWER(name) = LOWER($1) LIMIT 1',
          [normalizedLabel],
        );

        if (libResult.rows.length === 0) {
          libResult = await db.query(
            'SELECT id, name FROM libraries WHERE name ILIKE $1 LIMIT 1',
            [`%${normalizedLabel}%`],
          );
        }

        if (libResult.rows.length > 0) {
          resolvedLibraryId = libResult.rows[0].id;
          resolvedLibraryName = libResult.rows[0].name;
        }
      }

      if (resolvedLibraryId && !resolvedLibraryName) {
        const libResult = await db.query(
          'SELECT name FROM libraries WHERE id = $1',
          [resolvedLibraryId],
        );
        resolvedLibraryName = libResult.rows[0]?.name || null;
      }

      const displayLibraryName = resolvedLibraryName || selectedLabel;

      await db.query(
        `UPDATE classification_history 
         SET status = 'completed', 
             clarification_status = 'resolved',
             library_id = $2,
             library_name = $3,
             method = 'manual_classification',
             confidence = 100,
             reason = $4,
             pending_reason = NULL,
             clarification_response = $1
         WHERE id = $5`,
        [
          JSON.stringify({
            option_index: optionIndex,
            label: selectedLabel,
            answered_by: interaction.user.username,
          }),
          resolvedLibraryId,
          displayLibraryName,
          `Resolved by ${interaction.user.username}: ${selectedLabel}`,
          classificationId,
        ],
      );

      await extractClarificationPatterns(
        classificationId,
        resolvedLibraryId,
        selectedLabel,
      );
      routingOutcome = await routeAfterClarification(classificationId);
      if (resolvedLibraryId) {
        libraryId = resolvedLibraryId;
      }
    }

    let libraryName = selectedLabel;
    if (libraryId) {
      const libResult = await db.query(
        'SELECT name FROM libraries WHERE id = $1',
        [libraryId],
      );
      libraryName = libResult.rows[0]?.name || selectedLabel;
    }

    const routingStatusText = routingOutcome.routed
      ? `\u2705 Routed to ${libraryName}`
      : `\u26A0\uFE0F Not routed (${routingOutcome.reason || 'routing_skipped'})`;

    await interaction.editReply({
      components: [],
      embeds: [
        EmbedBuilder.from(interaction.message.embeds[0])
          .setColor(0x22c55e)
          .addFields(
            { name: 'Your Answer', value: selectedLabel, inline: true },
            { name: 'Selected Library', value: libraryName, inline: true },
            { name: 'Routing', value: routingStatusText, inline: false },
          )
          .setFooter({
            text: `\u2705 Resolved by ${interaction.user.username} \u2022 Pattern saved for future`,
          }),
      ],
    });

    if (!routingOutcome.routed) {
      await interaction.followUp({
        content: `Routing did not complete for **${libraryName}**. Reason: \`${routingOutcome.reason || 'unknown'}\`${routingOutcome.error ? ` (${routingOutcome.error})` : ''}`,
        ephemeral: true,
      });
    }
  } catch (error) {
    logger.error('Error processing clarification response:', error);
    try {
      await interaction.followUp({
        content: 'Failed to process response',
        ephemeral: true,
      });
    } catch (_replyErr) {
      logger.debug('[Discord] Could not send error reply for clarification', { error: _replyErr.message });
    }
  }
}