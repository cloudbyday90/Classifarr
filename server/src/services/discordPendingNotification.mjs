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
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import * as db from '../config/database.mjs';
import {
  formatDisplayPercent,
  getColorForConfidence,
  getMediaTypeEmoji,
  safeParseJson,
} from './discordNotificationBuilder.mjs';
import {
  POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS,
  buildPolicyRuntimeQuestionAnswerContract,
  getPolicyRuntimeQuestionAnswerActionCode,
} from './policyRuntimeQuestionAnswerContract.mjs';

const MAX_BUTTONS_PER_ROW = 5;
const MAX_FIELD_VALUE_LENGTH = 1024;
const VALID_MENTION_TYPES = new Set(['user', 'role']);

function truncateText(value, maxLength) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
}

function normalizePolicyQuestion(policyQuestion) {
  if (!policyQuestion) {
    return null;
  }
  if (typeof policyQuestion === 'string') {
    return safeParseJson(policyQuestion);
  }
  return typeof policyQuestion === 'object' ? policyQuestion : null;
}

function buildPendingDecisionAnswerContract(metadata, result) {
  const question = normalizePolicyQuestion(result?.policy_question || result?.clarification);

  return buildPolicyRuntimeQuestionAnswerContract({
    classification: {
      id: result?.classification_id,
      title: metadata?.title,
      year: metadata?.year,
      media_type: metadata?.media_type,
    },
    question,
  });
}

function buildPendingDecisionComponents(metadata, result) {
  const classificationId = Number(result?.classification_id);
  const answerContract = buildPendingDecisionAnswerContract(metadata, result);
  const confirmAction = answerContract?.allowed_actions?.find(
    action => action.id === POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.CONFIRM_DESTINATION,
  );
  const actionCode = getPolicyRuntimeQuestionAnswerActionCode(
    POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.CONFIRM_DESTINATION,
  );

  if (!Number.isInteger(classificationId) || classificationId < 1 ||
      !answerContract || confirmAction?.available !== true || !actionCode) {
    return [];
  }

  const buttons = answerContract.candidate_destinations
    .slice(0, MAX_BUTTONS_PER_ROW)
    .map((destination, index) => {
      const customId = [
        'ai',
        'answer',
        classificationId,
        actionCode,
        destination.library_id,
        answerContract.fingerprint,
      ].join('_');
      if (customId.length > 100) return null;

      return new ButtonBuilder()
        .setCustomId(customId)
        .setLabel(truncateText(`Resolve in ${destination.library_name}`, 80))
        .setStyle(index === 0 ? ButtonStyle.Success : ButtonStyle.Secondary);
    })
    .filter(Boolean);

  return buttons.length > 0 ? [new ActionRowBuilder().addComponents(buttons)] : [];
}

function buildPendingDecisionEmbed(metadata = {}, result = {}) {
  const question = normalizePolicyQuestion(result.policy_question || result.clarification);
  const answerContract = buildPendingDecisionAnswerContract(metadata, result);
  const title = typeof metadata.title === 'string' && metadata.title.trim()
    ? metadata.title.trim()
    : 'Unknown title';
  const mediaType = metadata.media_type === 'tv' ? 'tv' : 'movie';
  const confidence = Number.isFinite(Number(result.confidence))
    ? Number(result.confidence)
    : null;
  const reason = result.pending_reason || result.reason || 'Manual review required';

  const hasInvalidQuestion = Boolean(question) && !answerContract;

  const embed = new EmbedBuilder()
    .setTitle(`${getMediaTypeEmoji(mediaType)} Pending classification: ${title} (${metadata.year || 'N/A'})`)
    .setDescription(answerContract
      ? 'Choose a server-validated destination. This resolves only the current item and cannot update future policy learning.'
      : hasInvalidQuestion
        ? 'This policy question cannot be safely displayed. Retry Classification in Classifarr to refresh it from the current policy state.'
        : 'A classification needs an operator decision in Classifarr.')
    .setColor(confidence === null ? 0xf59e0b : getColorForConfidence(confidence))
    .setTimestamp();

  const fields = [
    {
      name: 'Media Type',
      value: mediaType === 'movie' ? 'Movie' : 'TV Show',
      inline: true,
    },
    {
      name: 'Status',
      value: 'Needs attention',
      inline: true,
    },
  ];

  if (confidence !== null) {
    fields.push({
      name: 'Confidence',
      value: formatDisplayPercent(confidence) || `${confidence}%`,
      inline: true,
    });
  }

  if (reason) {
    fields.push({
      name: 'Reason',
      value: truncateText(reason, MAX_FIELD_VALUE_LENGTH),
      inline: false,
    });
  }

  if (answerContract?.question?.text) {
    fields.push({
      name: 'Question',
      value: truncateText(answerContract.question.text, MAX_FIELD_VALUE_LENGTH),
      inline: false,
    });
  }

  if (answerContract?.candidate_destinations?.length) {
    fields.push(
      {
        name: 'Candidate destinations',
        value: truncateText(
          answerContract.candidate_destinations.map(destination => destination.library_name).join(', '),
          MAX_FIELD_VALUE_LENGTH,
        ),
        inline: true,
      },
      {
        name: 'Another destination',
        value: 'Choose another active library in Classifarr when none of these candidates is correct.',
        inline: false,
      },
    );
  }

  embed.addFields(fields);

  if (metadata.poster_path) {
    embed.setThumbnail(`https://image.tmdb.org/t/p/w200${metadata.poster_path}`);
  }

  return embed;
}

function buildPendingMentionPayload(config = {}) {
  const contentParts = [];
  const allowedMentions = {
    parse: [],
    users: [],
    roles: [],
  };

  if (config.pending_mention_here === true) {
    contentParts.push('@here');
    allowedMentions.parse.push('everyone');
  }

  const mentionType = typeof config.pending_mention_type === 'string'
    ? config.pending_mention_type.trim().toLowerCase()
    : 'none';
  const targetId = typeof config.pending_mention_target_id === 'string'
    ? config.pending_mention_target_id.trim()
    : '';

  if (VALID_MENTION_TYPES.has(mentionType) && /^\d{5,32}$/.test(targetId)) {
    if (mentionType === 'user') {
      contentParts.push(`<@${targetId}>`);
      allowedMentions.users.push(targetId);
    } else {
      contentParts.push(`<@&${targetId}>`);
      allowedMentions.roles.push(targetId);
    }
  }

  if (contentParts.length === 0) {
    return {};
  }

  return {
    content: contentParts.join(' '),
    allowedMentions,
  };
}

export async function sendPendingDecisionNotification(
  metadata,
  result,
  {
    client,
    channelId,
    config,
    warnFn,
  },
) {
  try {
    if (!config?.enabled || config.notify_on_pending_items === false) {
      return { sent: false, reason: 'disabled' };
    }

    if (!result?.classification_id) {
      return { sent: false, reason: 'missing_classification_id' };
    }

    const existing = await db.query(
      'SELECT discord_message_id FROM classification_history WHERE id = $1 LIMIT 1',
      [result.classification_id],
    );
    if (existing.rows[0]?.discord_message_id) {
      return { sent: false, reason: 'already_notified' };
    }

    const channel = await client.channels.fetch(channelId);
    if (!channel) {
      warnFn({
        category: 'channel_not_found',
        message: 'Discord pending-item notification skipped because the configured channel was not found',
        metadata: { channelId },
        dedupeSignature: `pending:${channelId || 'missing'}`,
      });
      return { sent: false, reason: 'channel_not_found' };
    }

    const embed = buildPendingDecisionEmbed(metadata, result);
    const components = buildPendingDecisionComponents(metadata, result);

    const mentionPayload = buildPendingMentionPayload(config);
    const message = await channel.send({
      ...mentionPayload,
      embeds: [embed],
      components,
    });

    await db.query(
      'UPDATE classification_history SET discord_message_id = $1 WHERE id = $2',
      [message.id, result.classification_id],
    );

    return { sent: true, messageId: message.id };
  } catch (error) {
    warnFn({
      category: 'pending_notification_send_failed',
      message: 'Discord pending-item notification failed to send',
      metadata: {
        error: error.message,
        title: metadata?.title || null,
        classificationId: result?.classification_id || null,
      },
      dedupeSignature: `${error.code || error.name || error.message}:pending`,
    });
    return { sent: false, reason: 'send_failed', error: error.message };
  }
}
