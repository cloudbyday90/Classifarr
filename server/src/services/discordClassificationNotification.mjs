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
import * as notificationBuilder from './discordNotificationBuilder.mjs';

export async function sendClassificationNotification(
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
    if (!config.notify_on_classification) {
      return;
    }

    const channel = await client.channels.fetch(channelId);
    if (!channel) {
      warnFn({
        category: 'channel_not_found',
        message: 'Discord classification notification skipped because the configured channel was not found',
        metadata: {
          channelId,
        },
        dedupeSignature: `classification:${channelId || 'missing'}`,
      });
      return;
    }

    const embed = notificationBuilder.buildSimpleNotificationEmbed(metadata, result, config);

    let components = [];
    if (config.enable_corrections) {
      components = await notificationBuilder.createCorrectionComponents(
        result.classification_id,
        result.libraries,
        config.correction_buttons_count || 3,
        config.include_library_dropdown !== false,
      );
    }

    const message = await channel.send({
      embeds: [embed],
      components: components,
    });

    await db.query(
      'UPDATE classification_history SET metadata = metadata || $1 WHERE id = $2',
      [
        JSON.stringify({ discord_message_id: message.id }),
        result.classification_id,
      ],
    );
  } catch (error) {
    warnFn({
      category: 'notification_send_failed',
      message: 'Discord classification notification failed to send',
      metadata: {
        error: error.message,
        title: metadata?.title || null,
        classificationId: result?.classification_id || null,
      },
      dedupeSignature: `${error.code || error.name || error.message}:classification`,
    });
  }
}