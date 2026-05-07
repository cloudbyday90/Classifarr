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
import { createMockModule, createNamedMockModule } from './helpers/mockFactory.mjs';

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

jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));

jest.unstable_mockModule('../services/tmdb.mjs', () => createNamedMockModule('tmdbService', mockTmdb));

jest.unstable_mockModule('../services/ollama.mjs', () => createNamedMockModule('ollamaService', mockOllama));

jest.unstable_mockModule('../services/radarr.mjs', () => createNamedMockModule('radarrService', mockRadarr));

jest.unstable_mockModule('../services/sonarr.mjs', () => createNamedMockModule('sonarrService', mockSonarr));

jest.unstable_mockModule('../services/discordBot.mjs', () => createNamedMockModule('discordBotService', mockDiscordBot));

jest.unstable_mockModule('../services/clarificationService.mjs', () => createNamedMockModule('clarificationService', mockClarificationService));

jest.unstable_mockModule('../utils/logger.mjs', () => createMockModule(mockLogger));

const { classificationService } = await import('../services/classification.mjs');
const clarificationService = mockClarificationService;

describe('ClassificationService auto-routing thresholds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clarificationService.isRequireAllConfirmationsEnabled.mockReset();
    clarificationService.isRequireAllConfirmationsEnabled.mockResolvedValue(
      false,
    );
  });

  test('should auto-route when confidence meets policy auto_classify_threshold (not hardcoded 90)', async () => {
    const library = { id: 1, name: 'Movies', arr_type: 'radarr' };

    jest
      .spyOn(classificationService, 'runDecisionTree')
      .mockResolvedValue({
        library,
        confidence: 88,
        method: 'ai_analysis',
        policyResult: {
          ranked: [
            {
              library_id: 1,
              auto_classify_threshold: 85,
              prompt_threshold: 60,
            },
          ],
        },
      });

    jest.spyOn(classificationService, 'logClassification').mockResolvedValue(1);

    const routeSpy = jest
      .spyOn(classificationService, 'routeToArr')
      .mockResolvedValue();

    await classificationService.classify({
      media_type: 'movie',
      tmdb_id: 123,
      title: 'Test Movie',
      overview: 'x',
      genres: ['Drama'],
    });

    expect(routeSpy).toHaveBeenCalledTimes(1);
  });

  test('should not auto-route when confidence is below policy auto_classify_threshold', async () => {
    const library = { id: 1, name: 'Movies', arr_type: 'radarr' };

    jest
      .spyOn(classificationService, 'runDecisionTree')
      .mockResolvedValue({
        library,
        confidence: 84,
        method: 'ai_analysis',
        policyResult: {
          ranked: [
            {
              library_id: 1,
              auto_classify_threshold: 85,
              prompt_threshold: 60,
            },
          ],
        },
      });

    jest.spyOn(classificationService, 'logClassification').mockResolvedValue(1);

    const routeSpy = jest
      .spyOn(classificationService, 'routeToArr')
      .mockResolvedValue();

    await classificationService.classify({
      media_type: 'movie',
      tmdb_id: 123,
      title: 'Test Movie',
      overview: 'x',
      genres: ['Drama'],
    });

    expect(routeSpy).not.toHaveBeenCalled();
  });

  test('should normalize policy auto thresholds above 95 before auto-routing', async () => {
    const library = { id: 1, name: 'Movies', arr_type: 'radarr' };

    jest
      .spyOn(classificationService, 'runDecisionTree')
      .mockResolvedValue({
        library,
        confidence: 95,
        method: 'ai_analysis',
        policyResult: {
          ranked: [
            {
              library_id: 1,
              auto_classify_threshold: 100,
              prompt_threshold: 60,
            },
          ],
        },
      });

    jest.spyOn(classificationService, 'logClassification').mockResolvedValue(1);

    const routeSpy = jest
      .spyOn(classificationService, 'routeToArr')
      .mockResolvedValue();

    await classificationService.classify({
      media_type: 'movie',
      tmdb_id: 123,
      title: 'Threshold Clamp',
      overview: 'x',
      genres: ['Drama'],
    });

    expect(routeSpy).toHaveBeenCalledTimes(1);
  });
});
