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

function buildPendingDecisionComponents(classificationId, policyQuestion) {
  const question = normalizePolicyQuestion(policyQuestion);
  const options = Array.isArray(question?.options) ? question.options : [];
  if (!classificationId || options.length === 0) {
    return [];
  }

  const buttons = options.slice(0, MAX_BUTTONS_PER_ROW).map((option, index) => {
    const label = typeof option?.label === 'string' && option.label.trim()
      ? option.label.trim()
      : `Option ${index + 1}`;

    return new ButtonBuilder()
      .setCustomId(`ai_clarify_${classificationId}_${index}`)
      .setLabel(truncateText(label, 80))
      .setStyle(index === 0 ? ButtonStyle.Primary : ButtonStyle.Secondary);
  });

  return [new ActionRowBuilder().addComponents(buttons)];
}

function buildPendingDecisionEmbed(metadata = {}, result = {}) {
  const title = typeof metadata.title === 'string' && metadata.title.trim()
    ? metadata.title.trim()
    : 'Unknown title';
  const mediaType = metadata.media_type === 'tv' ? 'tv' : 'movie';
  const confidence = Number.isFinite(Number(result.confidence))
    ? Number(result.confidence)
    : null;
  const reason = result.pending_reason || result.reason || 'Manual review required';

  const embed = new EmbedBuilder()
    .setTitle(`${getMediaTypeEmoji(mediaType)} Pending classification: ${title} (${metadata.year || 'N/A'})`)
    .setDescription('A classification needs an operator decision in Classifarr.')
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

  const question = normalizePolicyQuestion(result.policy_question || result.clarification);
  if (question?.question) {
    fields.push({
      name: 'Question',
      value: truncateText(question.question, MAX_FIELD_VALUE_LENGTH),
      inline: false,
    });
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
    const components = buildPendingDecisionComponents(
      result.classification_id,
      result.policy_question || result.clarification,
    );

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
