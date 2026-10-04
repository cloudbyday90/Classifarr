/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import { discordDelivery } from './discordDelivery.mjs';
import { buildSimpleNotificationEmbed } from './discordNotificationBuilder.mjs';
import { createCorrectionComponents } from './discordNotificationComponents.mjs';

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

    const embed = buildSimpleNotificationEmbed(metadata, result, config);

    let components = [];
    if (config.enable_corrections) {
      components = await createCorrectionComponents(
        result.classification_id,
        result.libraries,
        config.correction_buttons_count || 3,
        config.include_library_dropdown !== false,
      );
    }

    return await discordDelivery.send({
      classificationId: result.classification_id, kind: 'classification',
      client, channelId, config, channel, warnFn,
      payload: { embeds: [embed], components },
    });
  } catch {
    warnFn({
      category: 'notification_send_failed',
      message: 'Discord classification notification failed to send',
      metadata: {
        error: 'notification_preparation_failed',
        classificationId: result?.classification_id || null,
      },
      dedupeSignature: 'notification_preparation_failed:classification',
    });
  }
}
