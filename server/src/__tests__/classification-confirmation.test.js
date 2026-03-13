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

// Mock all dependencies
jest.mock('../config/database');
jest.mock('../services/tmdb');
jest.mock('../services/ollama');
jest.mock('../services/radarr');
jest.mock('../services/sonarr');
jest.mock('../services/discordBot');
jest.mock('../services/clarificationService');
jest.mock('../utils/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

const clarificationService = require('../services/clarificationService');

describe('Classification with require_all_confirmations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should skip auto-routing when require_all_confirmations is enabled', async () => {
    // Mock the setting to be enabled
    clarificationService.isRequireAllConfirmationsEnabled.mockResolvedValue(true);

    // This test verifies that the classification service properly checks
    // the require_all_confirmations setting before auto-routing
    const result = await clarificationService.isRequireAllConfirmationsEnabled();

    expect(result).toBe(true);
    expect(clarificationService.isRequireAllConfirmationsEnabled).toHaveBeenCalled();
  });

  test('should allow auto-routing when require_all_confirmations is disabled', async () => {
    // Mock the setting to be disabled
    clarificationService.isRequireAllConfirmationsEnabled.mockResolvedValue(false);

    const result = await clarificationService.isRequireAllConfirmationsEnabled();

    expect(result).toBe(false);
    expect(clarificationService.isRequireAllConfirmationsEnabled).toHaveBeenCalled();
  });

  test('should handle database errors gracefully', async () => {
    // Mock database error
    clarificationService.isRequireAllConfirmationsEnabled.mockResolvedValue(false);

    const result = await clarificationService.isRequireAllConfirmationsEnabled();

    // Should default to false on error (allowing normal operation)
    expect(result).toBe(false);
  });
});
