/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { normalizeMetadataList } from '../utils/metadataNormalization.mjs';
import { classificationOutcomeService } from './classificationOutcomeService.mjs';
import { classificationEvidenceService } from './classificationEvidenceService.mjs';
import { clarificationService } from './clarificationService.mjs';
import { autoLearningService } from './autoLearningService.mjs';
import { routeToArr } from './classificationRoutingService.mjs';
import * as notificationBuilder from './discordNotificationBuilder.mjs';

const logger = createLogger('discordInteractionHandler');

function safeParseJson(value) {
  return notificationBuilder.safeParseJson(value);
}

function toFiniteNumber(value) {
  return notificationBuilder.toFiniteNumber(value);
}

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
  try {
    await interaction.deferUpdate();

    let routingOutcome = { routed: false, reason: null, error: null };

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

    const originalLibraryId = classResult.rows[0].library_id;
    const classification = classResult.rows[0];
    const existingLibraryId = toFiniteNumber(classification.library_id);

    const libResult = await db.query(
      'SELECT name FROM libraries WHERE id = $1',
      [newLibraryId],
    );

    if (libResult.rows.length === 0) {
      await interaction.followUp({
        content: 'Library not found',
        ephemeral: true,
      });
      return;
    }

    const newLibraryName = libResult.rows[0].name;

    if (existingLibraryId !== null && existingLibraryId === newLibraryId) {
      await interaction.followUp({
        content: '\u2705 Already processed \u2014 no changes made.',
        ephemeral: true,
      });
      return;
    }

    const clarificationResponse = {
      corrected_library_id: newLibraryId,
      corrected_library_name: newLibraryName,
      corrected_by: interaction.user.username,
      corrected_at: new Date().toISOString(),
    };

    await db.query(
      `UPDATE classification_history
       SET library_id = $1,
           library_name = $2,
           status = $3,
           clarification_status = 'resolved',
           pending_reason = NULL,
           clarification_response = $5
       WHERE id = $4`,
      [
        newLibraryId,
        newLibraryName,
        'corrected',
        classificationId,
        JSON.stringify(clarificationResponse),
      ],
    );
    await db.query(
      'INSERT INTO classification_corrections (classification_id, original_library_id, corrected_library_id, corrected_by) VALUES ($1, $2, $3, $4)',
      [
        classificationId,
        originalLibraryId,
        newLibraryId,
        interaction.user.username,
      ],
    );
    await classificationOutcomeService.recordOutcome(classificationId, {
      type: 'corrected',
      source: 'discord_correction',
      actor: interaction.user.username,
      final_library_id: newLibraryId,
      final_library_name: newLibraryName,
    });

    try {
      const metadata = classification.item_metadata || {};
      const learningResult = await autoLearningService.learnFromFeedback({
        tmdbId: classification.tmdb_id,
        libraryId: newLibraryId,
        genres: normalizeMetadataList(metadata.genres),
        keywords: normalizeMetadataList(metadata.keywords),
        studio: metadata.studio,
        wasCorrection: true,
        userId: interaction.user.id,
      });

      logger.info('[Discord] Auto-learning from correction', {
        classificationId,
        originalLibrary: originalLibraryId,
        newLibrary: newLibraryId,
        learned: learningResult.learned,
        preferences: learningResult.preferences,
      });
    } catch (learningError) {
      logger.error('[Discord] Auto-learning from correction failed:', learningError);
    }

    try {
      await extractLearningPatterns(classificationId, newLibraryId);
    } catch (patternError) {
      logger.error('Error extracting patterns during correction:', patternError);
    }

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

export async function extractLearningPatterns(classificationId, libraryId) {
  try {
    const result = await db.query(
      'SELECT tmdb_id, media_type, metadata FROM classification_history WHERE id = $1',
      [classificationId],
    );

    if (result.rows.length > 0) {
      const { tmdb_id, media_type, metadata } = result.rows[0];

      await classificationEvidenceService.rememberExactMatch({
        tmdbId: tmdb_id,
        mediaType: media_type || 'unknown',
        libraryId,
        payload: metadata,
        payloadColumn: 'pattern_data',
        conflictMode: 'do_nothing',
      });
    }
  } catch (error) {
    logger.error('Error extracting learning patterns:', error);
  }
}

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
          ? safeParseJson(classification.policy_question)
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

    const existingLibraryId = toFiniteNumber(classification.library_id);
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

export async function extractClarificationPatterns(
  classificationId,
  libraryId,
  selectedOption,
) {
  try {
    const result = await db.query(
      'SELECT tmdb_id, media_type, metadata, title FROM classification_history WHERE id = $1',
      [classificationId],
    );

    if (result.rows.length > 0) {
      const { tmdb_id, media_type, metadata, title } = result.rows[0];

      await classificationEvidenceService.rememberExactMatch({
        tmdbId: tmdb_id,
        mediaType: media_type || 'unknown',
        libraryId,
        payload: { ...metadata, clarification_response: selectedOption },
        payloadColumn: 'pattern_data',
        conflictMode: 'update_payload',
      });

      logger.info(
        `Learned: ${title} (TMDB: ${tmdb_id}) -> Library ${libraryId} via clarification`,
      );
    }
  } catch (error) {
    logger.error('Error extracting clarification patterns:', error);
  }
}

export async function routeAfterClarification(classificationId) {
  const outcome = {
    routed: false,
    reason: null,
    error: null,
    arrType: null,
  };

  try {
    const result = await db.query(
      `SELECT ch.*, l.arr_type, l.arr_id, l.name as library_name,
              l.radarr_settings, l.sonarr_settings, l.root_folder, l.quality_profile_id
       FROM classification_history ch
       JOIN libraries l ON ch.library_id = l.id
       WHERE ch.id = $1`,
      [classificationId],
    );

    if (result.rows.length === 0) {
      outcome.reason = 'classification_not_found';
      return outcome;
    }

    const classification = result.rows[0];
    outcome.arrType = classification.arr_type || null;
    let metadata = classification.metadata;
    if (typeof metadata === 'string') {
      metadata = safeParseJson(metadata);
    }

    if (!metadata || typeof metadata !== 'object') {
      logger.warn('Skipping *arr routing due to invalid metadata', {
        classificationId,
        metadataType: typeof classification.metadata,
      });
      outcome.reason = 'invalid_metadata';
      return outcome;
    }

    if (classification.status === 'routed') {
      outcome.routed = true;
      outcome.reason = 'already_routed';
      return outcome;
    }

    const routeResult = await routeToArr(metadata, {
      id: classification.library_id,
      arr_type: classification.arr_type,
      arr_id: classification.arr_id,
      radarr_settings: classification.radarr_settings,
      sonarr_settings: classification.sonarr_settings,
      root_folder: classification.root_folder,
      quality_profile_id: classification.quality_profile_id,
      name: classification.library_name,
    });

    if (!routeResult?.routed) {
      outcome.reason = routeResult?.reason || 'route_skipped';
      outcome.error = routeResult?.error || null;
      logger.warn('Routing after clarification skipped', {
        classificationId,
        reason: outcome.reason,
        error: outcome.error,
      });
      return outcome;
    }

    await db.query(
      "UPDATE classification_history SET status = $1 WHERE id = $2",
      ['routed', classificationId],
    );

    logger.info(
      `Routed after clarification: ${metadata.title} -> ${classification.library_name}`,
    );
    outcome.routed = true;
    outcome.reason = 'routed';
    return outcome;
  } catch (error) {
    logger.error('Error routing after clarification:', error);
    outcome.reason = 'exception';
    outcome.error = error.message;
    return outcome;
  }
}