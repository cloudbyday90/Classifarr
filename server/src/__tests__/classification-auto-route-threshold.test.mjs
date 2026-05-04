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

jest.mock('../config/database', () => mockDb);
jest.unstable_mockModule('../config/database', () => ({ ...mockDb, default: mockDb }));
jest.unstable_mockModule('../config/database.mjs', () => ({ ...mockDb, default: mockDb }));

jest.mock('../services/tmdb', () => mockTmdb);
jest.unstable_mockModule('../services/tmdb', () => ({ ...mockTmdb, default: mockTmdb }));
jest.unstable_mockModule('../services/tmdb.mjs', () => ({ ...mockTmdb, default: mockTmdb }));

jest.mock('../services/ollama', () => mockOllama);
jest.unstable_mockModule('../services/ollama', () => ({ ...mockOllama, default: mockOllama }));
jest.unstable_mockModule('../services/ollama.mjs', () => ({ ...mockOllama, default: mockOllama }));

jest.mock('../services/radarr', () => mockRadarr);
jest.unstable_mockModule('../services/radarr', () => ({ ...mockRadarr, default: mockRadarr }));
jest.unstable_mockModule('../services/radarr.mjs', () => ({ ...mockRadarr, default: mockRadarr }));

jest.mock('../services/sonarr', () => mockSonarr);
jest.unstable_mockModule('../services/sonarr', () => ({ ...mockSonarr, default: mockSonarr }));
jest.unstable_mockModule('../services/sonarr.mjs', () => ({ ...mockSonarr, default: mockSonarr }));

jest.mock('../services/discordBot', () => mockDiscordBot);
jest.unstable_mockModule('../services/discordBot', () => ({ ...mockDiscordBot, default: mockDiscordBot }));
jest.unstable_mockModule('../services/discordBot.mjs', () => ({ ...mockDiscordBot, default: mockDiscordBot }));

jest.mock('../services/clarificationService', () => mockClarificationService);
jest.unstable_mockModule('../services/clarificationService', () => ({ ...mockClarificationService, default: mockClarificationService }));
jest.unstable_mockModule('../services/clarificationService.mjs', () => ({ ...mockClarificationService, default: mockClarificationService }));

jest.mock('../utils/logger', () => mockLogger);
jest.unstable_mockModule('../utils/logger', () => ({ ...mockLogger, default: mockLogger }));
jest.unstable_mockModule('../utils/logger.mjs', () => ({ ...mockLogger, default: mockLogger }));

const { default: classificationService } = await import('../services/classification.mjs');
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
