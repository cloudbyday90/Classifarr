/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

/**
 * @typedef {{
 *   warn?: (message: string, payload?: Record<string, unknown>) => void,
 * }} SettingsRefreshLogger
 */

/**
 * @typedef {{
 *   label: string,
 *   run: () => void,
 * }} SettingsRefreshAction
 */

/**
 * @param {{
 *   context: string,
 *   logger?: SettingsRefreshLogger,
 *   actions: SettingsRefreshAction[],
 * }} options
 */
export function runSettingsRuntimeRefresh({ context, logger, actions }) {
  for (const action of actions) {
    try {
      action.run();
    } catch (error) {
      logger?.warn?.('Settings runtime refresh failed after config update', {
        context,
        action: action.label,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}