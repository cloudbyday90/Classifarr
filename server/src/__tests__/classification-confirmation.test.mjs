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
import {
  createLoggerModuleMock,
  createNamedMockModule,
  createServiceStubs,
} from './helpers/mockFactory.mjs';

const mockDb = { query: jest.fn() };
const mockTmdb = createServiceStubs();
const mockOllama = createServiceStubs();
const mockRadarr = createServiceStubs();
const mockSonarr = createServiceStubs();
const mockDiscordBot = createServiceStubs(['sendConfidenceBasedNotification'], {
  isInitialized: false,
});
const mockClarificationService = createServiceStubs(['isRequireAllConfirmationsEnabled']);

jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));

jest.unstable_mockModule('../services/tmdb.mjs', () => createNamedMockModule('tmdbService', mockTmdb));

jest.unstable_mockModule('../services/ollama.mjs', () => createNamedMockModule('ollamaService', mockOllama));

jest.unstable_mockModule('../services/radarr.mjs', () => createNamedMockModule('radarrService', mockRadarr));

jest.unstable_mockModule('../services/sonarr.mjs', () => createNamedMockModule('sonarrService', mockSonarr));

jest.unstable_mockModule('../services/discordBot.mjs', () => createNamedMockModule('discordBotService', mockDiscordBot));

jest.unstable_mockModule('../services/clarificationService.mjs', () => createNamedMockModule('clarificationService', mockClarificationService));

jest.unstable_mockModule('../utils/logger.mjs', () => createLoggerModuleMock().module);

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
