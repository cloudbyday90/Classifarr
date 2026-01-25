/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
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

const classificationService = require('../services/classification');
const classificationPhaseService = require('../services/classificationPhaseService');
const db = require('../config/database');
const tmdbService = require('../services/tmdb');
const policyEngine = require('../services/policyEngine');
const confidenceCalculator = require('../services/confidenceCalculator');
const contentTypeAnalyzer = require('../services/contentTypeAnalyzer');

// Mock dependencies
jest.mock('../services/classificationPhaseService');
jest.mock('../config/database');
jest.mock('../services/tmdb');
jest.mock('../services/policyEngine');
jest.mock('../services/confidenceCalculator');
jest.mock('../services/ragRetriever');
jest.mock('../services/signalCollector');
jest.mock('../services/mediaSync');
jest.mock('../services/libraryProfileService');
jest.mock('../services/discordBot');
jest.mock('../services/contentTypeAnalyzer');
jest.mock('../utils/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

describe('ClassificationService', () => {
  describe('evaluateCustomRule', () => {
    const metadata = {
      title: 'Die Hard',
      year: 1988,
      genres: ['Action', 'Thriller'],
      keywords: ['police', 'terrorist', 'christmas party'],
      contentAnalysis: {
        bestMatch: {
          type: 'holiday',
          confidence: 0.9
        }
      }
    };

    test('should match single condition (legacy format)', () => {
      const rule = { field: 'title', operator: 'equals', value: 'Die Hard' };
      expect(classificationService.evaluateCustomRule(metadata, rule)).toBe(true);
    });

    test('should match array of conditions (AND logic)', () => {
      const rule = [
        { field: 'title', operator: 'equals', value: 'Die Hard' },
        { field: 'year', operator: 'equals', value: '1988' }
      ];
      expect(classificationService.evaluateCustomRule(metadata, rule)).toBe(true);
    });

    test('should fail if one condition in array fails', () => {
      const rule = [
        { field: 'title', operator: 'equals', value: 'Die Hard' },
        { field: 'year', operator: 'equals', value: '1990' } // Wrong year
      ];
      expect(classificationService.evaluateCustomRule(metadata, rule)).toBe(false);
    });

    test('should handle content_type condition', () => {
      const rule = [
        { field: 'content_type', operator: 'equals', value: 'holiday' }
      ];
      expect(classificationService.evaluateCustomRule(metadata, rule)).toBe(true);
    });

    test('should handle contains operator for arrays (keywords)', () => {
      const rule = [
        { field: 'keywords', operator: 'contains', value: 'christmas' }
      ];
      expect(classificationService.evaluateCustomRule(metadata, rule)).toBe(true);
    });

    test('should handle not_contains operator', () => {
      const rule = [
        { field: 'genres', operator: 'not_contains', value: 'Romance' }
      ];
      expect(classificationService.evaluateCustomRule(metadata, rule)).toBe(true);
    });

    test('should handle nested fields gracefully if missing', () => {
      const emptyMetadata = {};
      const rule = [
        { field: 'content_type', operator: 'equals', value: 'holiday' }
      ];
      expect(classificationService.evaluateCustomRule(emptyMetadata, rule)).toBe(false);
    });
  });

  describe('metadataMatchesLabel', () => {
    describe('Genre Matching', () => {
      test('should match when metadata genre matches label value', () => {
        const metadata = {
          genres: ['Action', 'Adventure', 'Sci-Fi']
        };
        const label = {
          tmdb_match_field: 'genres',
          tmdb_match_values: ['action']
        };

        expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(true);
      });

      test('should not match when metadata genre does not match label value', () => {
        const metadata = {
          genres: ['Action', 'Adventure']
        };
        const label = {
          tmdb_match_field: 'genres',
          tmdb_match_values: ['horror']
        };

        expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(false);
      });

      test('should return false when metadata genres is null', () => {
        const metadata = {
          genres: null
        };
        const label = {
          tmdb_match_field: 'genres',
          tmdb_match_values: ['action']
        };

        expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(false);
      });

      test('should return false when metadata genres is not an array', () => {
        const metadata = {
          genres: 'Action'
        };
        const label = {
          tmdb_match_field: 'genres',
          tmdb_match_values: ['action']
        };

        expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(false);
      });

      test('should return false when metadata genres is empty array', () => {
        const metadata = {
          genres: []
        };
        const label = {
          tmdb_match_field: 'genres',
          tmdb_match_values: ['action']
        };

        expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(false);
      });
    });

    describe('Certification/Rating Matching', () => {
      test('should match when metadata certification matches label value', () => {
        const metadata = {
          certification: 'PG-13'
        };
        const label = {
          tmdb_match_field: 'certification',
          tmdb_match_values: ['pg-13']
        };

        expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(true);
      });

      test('should match certification case-insensitively', () => {
        const metadata = {
          certification: 'R'
        };
        const label = {
          tmdb_match_field: 'certification',
          tmdb_match_values: ['r']
        };

        expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(true);
      });

      test('should not match when certification does not match', () => {
        const metadata = {
          certification: 'G'
        };
        const label = {
          tmdb_match_field: 'certification',
          tmdb_match_values: ['r', 'pg-13']
        };

        expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(false);
      });

      test('should return false when certification is null', () => {
        const metadata = {
          certification: null
        };
        const label = {
          tmdb_match_field: 'certification',
          tmdb_match_values: ['pg-13']
        };

        expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(false);
      });
    });

    describe('Keyword Matching', () => {
      test('should match when metadata keyword matches label value', () => {
        const metadata = {
          keywords: ['superhero', 'marvel', 'action']
        };
        const label = {
          tmdb_match_field: 'keywords',
          tmdb_match_values: ['superhero']
        };

        expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(true);
      });

      test('should match keywords case-insensitively', () => {
        const metadata = {
          keywords: ['SuperHero', 'Marvel']
        };
        const label = {
          tmdb_match_field: 'keywords',
          tmdb_match_values: ['superhero']
        };

        expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(true);
      });

      test('should not match when no keywords match', () => {
        const metadata = {
          keywords: ['action', 'adventure']
        };
        const label = {
          tmdb_match_field: 'keywords',
          tmdb_match_values: ['horror', 'scary']
        };

        expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(false);
      });

      test('should return false when keywords is null', () => {
        const metadata = {
          keywords: null
        };
        const label = {
          tmdb_match_field: 'keywords',
          tmdb_match_values: ['superhero']
        };

        expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(false);
      });

      test('should return false when keywords is empty array', () => {
        const metadata = {
          keywords: []
        };
        const label = {
          tmdb_match_field: 'keywords',
          tmdb_match_values: ['superhero']
        };

        expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(false);
      });
    });

    describe('Language Matching', () => {
      test('should match when original language matches label value', () => {
        const metadata = {
          original_language: 'en'
        };
        const label = {
          tmdb_match_field: 'original_language',
          tmdb_match_values: ['en']
        };

        expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(true);
      });

      test('should match language case-insensitively', () => {
        const metadata = {
          original_language: 'JA'
        };
        const label = {
          tmdb_match_field: 'original_language',
          tmdb_match_values: ['ja']
        };

        expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(true);
      });

      test('should not match when language does not match', () => {
        const metadata = {
          original_language: 'en'
        };
        const label = {
          tmdb_match_field: 'original_language',
          tmdb_match_values: ['ja', 'ko']
        };

        expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(false);
      });

      test('should return false when original_language is null', () => {
        const metadata = {
          original_language: null
        };
        const label = {
          tmdb_match_field: 'original_language',
          tmdb_match_values: ['en']
        };

        expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(false);
      });
    });

    describe('Edge Cases', () => {
      test('should return false when tmdb_match_field is not defined', () => {
        const metadata = {
          genres: ['Action']
        };
        const label = {
          tmdb_match_field: null,
          tmdb_match_values: ['action']
        };

        expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(false);
      });

      test('should return false when tmdb_match_values is not defined', () => {
        const metadata = {
          genres: ['Action']
        };
        const label = {
          tmdb_match_field: 'genres',
          tmdb_match_values: null
        };

        expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(false);
      });

      test('should return false when tmdb_match_values is empty array', () => {
        const metadata = {
          genres: ['Action']
        };
        const label = {
          tmdb_match_field: 'genres',
          tmdb_match_values: []
        };

        expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(false);
      });

      test('should return false for unknown match field', () => {
        const metadata = {
          genres: ['Action']
        };
        const label = {
          tmdb_match_field: 'unknown_field',
          tmdb_match_values: ['action']
        };

        expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(false);
      });

      test('should handle multiple matching values', () => {
        const metadata = {
          genres: ['Action', 'Comedy']
        };
        const label = {
          tmdb_match_field: 'genres',
          tmdb_match_values: ['horror', 'comedy', 'thriller']
        };

        expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(true);
      });
    });
  });
});

describe('Phase Tracking in classify()', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    db.query.mockResolvedValue({ rows: [] });
    tmdbService.getMovieDetails.mockResolvedValue({ title: 'Test Movie', genres: [] });
    tmdbService.getCertification.mockResolvedValue('PG');
    policyEngine.evaluateItem.mockResolvedValue({ action: 'auto_classify', library: { library_id: 1 }, confidence: 95 });
    confidenceCalculator.calculate.mockReturnValue({ confidence: 95, suggestedLibrary: { id: 1 } });
    confidenceCalculator.toAIContext.mockReturnValue('');
    contentTypeAnalyzer.analyze.mockResolvedValue({ analyzed: false });

    classificationPhaseService.updatePhase.mockResolvedValue(true);
    classificationPhaseService.completeTracking.mockResolvedValue(true);

    // Mock libraries
    db.query.mockImplementation((text, params) => {
      const query = typeof text === 'string' ? text : '';
      if (query.includes('FROM libraries')) {
        return { rows: [{ id: 1, name: 'Movies', media_type: 'movie' }] };
      }
      if (query.includes('INSERT INTO classification_history') || query.includes('INSERT INTO logs') || query.includes('INSERT INTO error_logs')) {
        return { rows: [{ id: 12345, error_id: 67890 }] };
      }
      return { rows: [] };
    });
  });

  test('should track phases when taskId is present', async () => {
    const payload = {
      media: { media_type: 'movie', tmdbId: 123 },
      taskId: 'task-123'
    };

    await classificationService.classify(payload);

    // Check for phase updates
    expect(classificationPhaseService.updatePhase).toHaveBeenCalledWith('task-123', 'metadata_fetch', expect.anything());
    expect(classificationPhaseService.updatePhase).toHaveBeenCalledWith('task-123', 'policy_eval');

    // Tracking completion
    expect(classificationPhaseService.completeTracking).toHaveBeenCalledWith('task-123', expect.anything());
  });

  test('should SKIP phase tracking when taskId is missing', async () => {
    const payload = {
      media: { media_type: 'movie', tmdbId: 123 }
      // No taskId
    };

    await classificationService.classify(payload);

    expect(classificationPhaseService.updatePhase).not.toHaveBeenCalled();
    expect(classificationPhaseService.completeTracking).not.toHaveBeenCalled();
  });

  test('should SKIP phase tracking for source_library items', async () => {
    const payload = {
      media: { media_type: 'movie', tmdbId: 123 },
      taskId: 'task-123',
      source_library_id: 99
    };

    await classificationService.classify(payload);

    expect(classificationPhaseService.updatePhase).not.toHaveBeenCalled();
    expect(classificationPhaseService.completeTracking).not.toHaveBeenCalled();
  });
});
