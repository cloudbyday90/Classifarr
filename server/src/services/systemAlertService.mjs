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

export const SYSTEM_ALERT_COOLDOWN_MS = 15 * 60 * 1000;

const _systemAlertLastSent = new Map();

export const STATUS_META = {
  degraded:     { emoji: '\u26A0\uFE0F',  color: 0xF0A500, label: 'Degraded' },
  disconnected: { emoji: '\uD83D\uDD34',  color: 0xE74C3C, label: 'Disconnected' },
  error:        { emoji: '\uD83D\uDD34',  color: 0xE74C3C, label: 'Error' },
  connected:    { emoji: '\u2705',  color: 0x2ECC71, label: 'Recovered' },
};

export const SERVICE_LABELS = {
  imageEmbeddings: 'Image Embedding Service',
  textEmbeddings:  'Text Embedding Service',
  ollama:          'Ollama',
  discordBot:      'Discord Bot',
  plex:            'Plex',
};

export function shouldThrottleAlert(serviceKey, isRecovery) {
  if (isRecovery) return false;
  const last = _systemAlertLastSent.get(serviceKey);
  if (last && Date.now() - last < SYSTEM_ALERT_COOLDOWN_MS) return true;
  return false;
}

export function recordAlertSent(serviceKey) {
  _systemAlertLastSent.set(serviceKey, Date.now());
}

export function buildSystemAlertEmbed(serviceKey, newStatus, previousStatus) {
  const isRecovery = newStatus === 'connected';
  const meta = STATUS_META[newStatus] || { emoji: '\u2139\uFE0F', color: 0x95A5A6, label: newStatus };
  const serviceLabel = SERVICE_LABELS[serviceKey] || serviceKey;

  const prevLabel = previousStatus ? ` (was: ${previousStatus})` : '';
  const description = isRecovery
    ? `${serviceLabel} has recovered and is now online${prevLabel}.`
    : `${serviceLabel} status changed to **${meta.label}**${prevLabel}. Check the Classifarr logs for details.`;

  return new EmbedBuilder()
    .setTitle(`${meta.emoji} ${serviceLabel} \u2014 ${meta.label}`)
    .setDescription(description)
    .setColor(meta.color)
    .setFooter({ text: 'Classifarr \u00B7 System Health' })
    .setTimestamp();
}