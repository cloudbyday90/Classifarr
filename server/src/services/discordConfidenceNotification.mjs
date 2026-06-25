/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { clarificationService } from './clarificationService.mjs';
import { createTieredComponents } from './discordNotificationComponents.mjs';
import { createTieredEmbed } from './discordTieredEmbedBuilder.mjs';

const logger = createLogger('discordConfidenceNotification');

export async function sendConfidenceBasedNotification(
  metadata,
  result,
  {
    client,
    channelId,
    config,
    sendClassificationNotification,
    warnFn,
  },
) {
  logger.info('[Discord] Notification attempt', {
    title: metadata.title,
    confidence: result.confidence,
    classificationId: result.classification_id,
  });

  try {
    logger.info('[Discord] Config check', {
      enabled: config.enabled,
      notify_on_classification: config.notify_on_classification,
      bot_token_present: !!config.bot_token,
      channel_id_present: !!config.channel_id,
    });

    if (!config.enabled) {
      logger.info(
        '[Discord] Notifications disabled via enabled flag - skipping',
        {
          enabled: config.enabled,
        },
      );
      return;
    }

    if (!config.notify_on_classification) {
      logger.info('[Discord] Notifications disabled in config - skipping');
      return;
    }

    if (result?.classification_id) {
      const existingNotification = await db.query(
        'SELECT status, discord_message_id FROM classification_history WHERE id = $1 LIMIT 1',
        [result.classification_id],
      );
      const existingRow = existingNotification.rows[0];
      if (
        existingRow?.status === 'awaiting_decision' &&
        existingRow.discord_message_id
      ) {
        logger.debug('[Discord] Confidence notification skipped because pending notification already exists', {
          classificationId: result.classification_id,
          messageId: existingRow.discord_message_id,
        });
        return;
      }
    }

    const requireAllConfirmations =
      await clarificationService.isRequireAllConfirmationsEnabled();

    let policyThresholds = null;
    const ranked = result?.policyResult?.ranked || [];
    const libraryId = result?.library?.id;
    if (Array.isArray(ranked) && ranked.length > 0 && libraryId) {
      const row = ranked.find((r) => r && r.library_id === libraryId);
      if (
        row &&
        typeof row.auto_classify_threshold === 'number' &&
        typeof row.prompt_threshold === 'number'
      ) {
        policyThresholds = {
          auto_classify_threshold: row.auto_classify_threshold,
          prompt_threshold: row.prompt_threshold,
        };
      }
    }

    const tier =
      clarificationService.getTierFromPolicyThresholds(
        result.confidence,
        policyThresholds,
        requireAllConfirmations,
      ) || (await clarificationService.getTierForConfidence(result.confidence));

    logger.info('[Discord] Tier lookup result', {
      confidence: result.confidence,
      tier: tier ? tier.tier : 'null',
      action: tier ? tier.action : 'null',
      policyThresholds: policyThresholds || 'none',
    });

    if (!tier) {
      logger.warn(
        '[Discord] No tier found, falling back to standard notification',
        {
          confidence: result.confidence,
        },
      );
      return sendClassificationNotification(metadata, result);
    }

    const channel = await client.channels.fetch(channelId);
    if (!channel) {
      warnFn({
        category: 'channel_not_found',
        message: 'Discord confidence-based notification skipped because the configured channel was not found',
        metadata: {
          channelId,
        },
        dedupeSignature: `confidence:${channelId || 'missing'}`,
      });
      return;
    }

    const hasClarification =
      result.needs_clarification && result.clarification;

    logger.info('[Discord] Creating notification', {
      tier: tier.tier,
      hasClarification,
      requireAllConfirmations,
    });

    const embed = await createTieredEmbed(
      metadata,
      result,
      tier,
      requireAllConfirmations,
      hasClarification,
    );

    const components = await createTieredComponents(
      result.classification_id,
      result.libraries,
      tier,
      metadata,
      result.confidence,
      requireAllConfirmations,
      hasClarification ? result.clarification : null,
    );

    const message = await channel.send({
      embeds: [embed],
      components: components,
    });

    logger.info('[Discord] Notification sent successfully', {
      messageId: message.id,
      tier: tier.tier,
      confidence: result.confidence,
    });

    const status = hasClarification ? 'awaiting_clarification' : tier.action;
    await db.query(
      'UPDATE classification_history SET discord_message_id = $1, clarification_status = $2 WHERE id = $3',
      [message.id, status, result.classification_id],
    );
  } catch (error) {
    warnFn({
      category: 'notification_send_failed',
      message: 'Discord confidence-based notification failed to send',
      metadata: {
        error: error.message,
        title: metadata.title,
        confidence: result.confidence,
        classificationId: result?.classification_id || null,
      },
      dedupeSignature: `${error.code || error.name || error.message}:confidence`,
    });
  }
}
