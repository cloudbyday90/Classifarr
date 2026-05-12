/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export function createAiSettingsActionService({ cloudLLMService }) {
  return {
    async resetUsage() {
      await cloudLLMService.resetMonthlyUsage();

      return {
        success: true,
        message: 'Monthly usage reset successfully',
      };
    },
  };
}