/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { jest } from '@jest/globals';

const mockDb = { query: jest.fn() };
const mockTmdb = {};
const mockOllama = {};
const mockRadarr = {};
const mockSonarr = {};
const mockDiscordBot = {
  isInitialized: false,
  sendConfidenceBasedNotification: jest.fn(),
};
const mockClarificationService = {
  isRequireAllConfirmationsEnabled: jest.fn(),
};
const mockLogger = {
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
};

jest.unstable_mockModule('../config/database.mjs', () => ({ ...mockDb, default: mockDb }));

jest.unstable_mockModule('../services/tmdb.mjs', () => ({ ...mockTmdb, default: mockTmdb }));

jest.unstable_mockModule('../services/ollama.mjs', () => ({ ...mockOllama, default: mockOllama }));

jest.unstable_mockModule('../services/radarr.mjs', () => ({ ...mockRadarr, default: mockRadarr }));

jest.unstable_mockModule('../services/sonarr.mjs', () => ({ ...mockSonarr, default: mockSonarr }));

jest.unstable_mockModule('../services/discordBot.mjs', () => ({ ...mockDiscordBot, default: mockDiscordBot }));

jest.unstable_mockModule('../services/clarificationService.mjs', () => ({ ...mockClarificationService, default: mockClarificationService }));

jest.unstable_mockModule('../utils/logger.mjs', () => ({ ...mockLogger, default: mockLogger }));

const clarificationService = mockClarificationService;

describe('Classification with require_all_confirmations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should skip auto-routing when require_all_confirmations is enabled', async () => {
    clarificationService.isRequireAllConfirmationsEnabled.mockResolvedValue(true);

    const result = await clarificationService.isRequireAllConfirmationsEnabled();

    expect(result).toBe(true);
    expect(clarificationService.isRequireAllConfirmationsEnabled).toHaveBeenCalled();
  });

  test('should allow auto-routing when require_all_confirmations is disabled', async () => {
    clarificationService.isRequireAllConfirmationsEnabled.mockResolvedValue(false);

    const result = await clarificationService.isRequireAllConfirmationsEnabled();

    expect(result).toBe(false);
    expect(clarificationService.isRequireAllConfirmationsEnabled).toHaveBeenCalled();
  });

  test('should handle database errors gracefully', async () => {
    clarificationService.isRequireAllConfirmationsEnabled.mockResolvedValue(false);

    const result = await clarificationService.isRequireAllConfirmationsEnabled();

    expect(result).toBe(false);
  });
});
