/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { maskDiscordConfig } from '../../services/shared/discordSettingsModel.mjs';

export function buildDiscordConfigUpdateResponse(config) {
  return maskDiscordConfig(config);
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