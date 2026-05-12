/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { buildSettingsErrorResponse } from './settingsErrorSupport.mjs';
import { maskDiscordConfig } from '../../services/shared/discordSettingsModel.mjs';

export function buildDiscordConfigUpdateResponse(config) {
  return maskDiscordConfig(config);
}

export function sendDiscordErrorResponse(res, error, {
  logger,
  logMessage,
  logLevel = 'error',
} = {}) {
  if (logger && logMessage && typeof logger[logLevel] === 'function') {
    logger[logLevel](logMessage, { error: error.message });
  }

  const response = buildSettingsErrorResponse(error);
  res.status(response.status).json(response.body);
}

export async function reinitializeDiscordBotIfNeeded({
  shouldReinitialize,
  discordBotService,
  logger,
}) {
  if (!shouldReinitialize) {
    return;
  }

  try {
    await discordBotService.reinitialize();
  } catch (error) {
    logger.warn('Failed to reinitialize Discord bot:', { error: error.message });
  }
}
