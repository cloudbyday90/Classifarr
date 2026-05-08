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

const mockClassificationPhaseService = {
  updatePhase: jest.fn(),
  completeTracking: jest.fn()
};

const mockDb = {
  query: jest.fn()
};

const mockTmdbService = {
  getMovieDetails: jest.fn(),
  getCertification: jest.fn()
};

const mockPolicyEngine = {
  evaluateItem: jest.fn()
};

const mockConfidenceCalculator = {
  calculate: jest.fn(),
  toAIContext: jest.fn(),
  loadWeights: jest.fn()
};

const mockRagRetriever = {
  semanticSearchCandidates: jest.fn(),
  hybridSearch: jest.fn(),
  getSuggestedLibrary: jest.fn()
};

const mockSignalCollector = {
  SignalCollector: jest.fn(() => ({ collectAll: jest.fn(), getSignals: jest.fn(() => []), getPatternSignals: jest.fn(() => []) })),
  SIGNAL_TYPES: {},
  PATTERN_SIGNAL_TYPES: {}
};

const mockMediaSyncService = {
  findExistingMedia: jest.fn()
};

const mockLibraryProfileService = {};

const mockDiscordBot = {};

const mockContentTypeAnalyzer = {
  analyze: jest.fn()
};

const mockPolicyQuestionBuilder = {
  build: jest.fn()
};

const mockClassificationRetryService = {
  retryClassifications: jest.fn()
};

const mockClassificationOutcomeService = {
  recordOutcome: jest.fn()
};

const mockLogger = {
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }))
};

jest.unstable_mockModule('../services/classificationPhaseService.mjs', () => ({
  ...mockClassificationPhaseService,
  classificationPhaseService: mockClassificationPhaseService
}));

jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));

jest.unstable_mockModule('../services/tmdb.mjs', () => createNamedMockModule('tmdbService', mockTmdbService));

jest.unstable_mockModule('../services/policyEngine.mjs', () => createNamedMockModule('policyEngine', mockPolicyEngine));

jest.unstable_mockModule('../services/confidenceCalculator.mjs', () => createNamedMockModule('confidenceCalculator', mockConfidenceCalculator));

jest.unstable_mockModule('../services/ragRetriever.mjs', () => createNamedMockModule('ragRetriever', mockRagRetriever));

jest.unstable_mockModule('../services/signalCollector.mjs', () => createNamedMockModule('SIGNAL_TYPES', mockSignalCollector));

jest.unstable_mockModule('../services/mediaSync.mjs', () => createNamedMockModule('mediaSyncService', mockMediaSyncService));

jest.unstable_mockModule('../services/libraryProfileService.mjs', () => createNamedMockModule('libraryProfileService', mockLibraryProfileService));

jest.unstable_mockModule('../services/discordBot.mjs', () => createNamedMockModule('discordBotService', mockDiscordBot));

jest.unstable_mockModule('../services/contentTypeAnalyzer.mjs', () => createNamedMockModule('contentTypeAnalyzer', mockContentTypeAnalyzer));

jest.unstable_mockModule('../services/policyQuestionBuilder.mjs', () => createNamedMockModule('policyQuestionBuilder', mockPolicyQuestionBuilder));

jest.unstable_mockModule('../services/classificationRetryService.mjs', () => ({
  ...mockClassificationRetryService,
  classificationRetryService: mockClassificationRetryService
}));

jest.unstable_mockModule('../services/classificationOutcomeService.mjs', () => ({
  ...mockClassificationOutcomeService,
  classificationOutcomeService: mockClassificationOutcomeService
}));

jest.unstable_mockModule('../utils/logger.mjs', () => createMockModule(mockLogger));

const { classificationService } = await import('../services/classification.mjs');
const { classificationPersistenceService } = await import('../services/classificationPersistenceService.mjs');
const { classificationLegacySignalPathService } = await import('../services/classificationLegacySignalPathService.mjs');
const { classificationPolicyPathService } = await import('../services/classificationPolicyPathService.mjs');
const { classificationRagLoopService } = await import('../services/classificationRagLoopService.mjs');
const { ragLoopResilienceManager } = await import('../services/ragLoopResilienceManager.mjs');
const { ollamaService } = await import('../services/ollama.mjs');
const { aiRouterService: aiRouter } = await import('../services/aiRouter.mjs');
const { providerLock } = await import('../services/providerLock.mjs');
const { ragLogger } = await import('../utils/ragLogger.mjs');
const { OperationController } = await import('../utils/operationController.mjs');

const classificationPhaseService = mockClassificationPhaseService;
const db = mockDb;
const tmdbService = mockTmdbService;
const policyEngine = mockPolicyEngine;
const confidenceCalculator = mockConfidenceCalculator;
const ragRetriever = mockRagRetriever;
const contentTypeAnalyzer = mockContentTypeAnalyzer;
const policyQuestionBuilder = mockPolicyQuestionBuilder;
const classificationRetryService = mockClassificationRetryService;
const classificationOutcomeService = mockClassificationOutcomeService;
const _mediaSyncService = mockMediaSyncService;

describe('ClassificationService', () => {
  describe('withTimeout', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('passes timeout message as operation name to OperationController', async () => {
      const runSpy = jest.spyOn(OperationController.prototype, 'run').mockResolvedValue('ok');
      const operation = jest.fn().mockResolvedValue('ok');

      const result = await classificationService.withTimeout(
        operation,
        10000,
        'rag_pass2_semantic_timeout'
      );

      expect(result).toBe('ok');
      expect(runSpy).toHaveBeenCalledWith(
        expect.any(Function),
        'rag_pass2_semantic_timeout'
      );
    });

    test('normalizes OperationController timeout errors to requested timeout message', async () => {
      const timeoutError = new Error('unnamed timed out after 10000ms');
      timeoutError.name = 'TimeoutError';
      timeoutError.code = 'ETIMEDOUT';
      jest.spyOn(OperationController.prototype, 'run').mockRejectedValue(timeoutError);

      await expect(
        classificationService.withTimeout(
          () => Promise.resolve('ok'),
          10000,
          'rag_pass2_semantic_timeout'
        )
      ).rejects.toMatchObject({
        name: 'TimeoutError',
        message: 'rag_pass2_semantic_timeout',
        code: 'ETIMEDOUT'
      });
    });
  });

  describe('mergeMetadataForRecheck', () => {
    test('replaces weak metadata with richer authoritative enrichment values', () => {
      const merged = classificationService.mergeMetadataForRecheck(
        {
          title: 'Example',
          genres: ['Drama'],
          keywords: ['family'],
          production_companies: [{ name: 'Studio' }],
          cast: [{ name: 'Lead Actor' }],
          original_title: 'Example',
          overview: 'Short summary.'
        },
        {
          genres: ['Drama', 'Mystery'],
          keywords: ['family', 'investigation', 'crime'],
          belongs_to_collection: { name: 'Example Collection' },
          production_companies: [{ name: 'Studio' }, { name: 'Distributor' }],
          cast: [{ name: 'Lead Actor' }, { name: 'Supporting Actor' }],
          original_title: 'Original Example',
          overview: 'A much richer authoritative summary that provides substantially more context for retrieval.'
        }
      );

      expect(merged.genres).toEqual(['Drama', 'Mystery']);
      expect(merged.keywords).toEqual(['family', 'investigation', 'crime']);
      expect(merged.belongs_to_collection).toEqual({ name: 'Example Collection' });
      expect(merged.production_companies).toEqual([{ name: 'Studio' }, { name: 'Distributor' }]);
      expect(merged.cast).toEqual([{ name: 'Lead Actor' }, { name: 'Supporting Actor' }]);
      expect(merged.original_title).toBe('Original Example');
      expect(merged.overview).toContain('authoritative summary');
    });

    test('preserves richer existing metadata when enrichment is weaker', () => {
      const merged = classificationService.mergeMetadataForRecheck(
        {
          title: 'Example',
          genres: ['Drama', 'Mystery', 'Thriller'],
          keywords: ['family', 'investigation', 'crime'],
          belongs_to_collection: { name: 'Example Collection' },
          production_companies: [{ name: 'Studio' }, { name: 'Distributor' }],
          cast: [{ name: 'Lead Actor' }, { name: 'Supporting Actor' }],
          original_title: 'Original Example',
          overview: 'A much richer authoritative summary that provides substantially more context for retrieval.'
        },
        {
          genres: ['Drama'],
          keywords: ['family'],
          belongs_to_collection: { name: 'Ex' },
          production_companies: [{ name: 'Studio' }],
          cast: [{ name: 'Lead Actor' }],
          original_title: 'Example',
          overview: 'Short summary.'
        }
      );

      expect(merged.genres).toEqual(['Drama', 'Mystery', 'Thriller']);
      expect(merged.keywords).toEqual(['family', 'investigation', 'crime']);
      expect(merged.belongs_to_collection).toEqual({ name: 'Example Collection' });
      expect(merged.production_companies).toEqual([{ name: 'Studio' }, { name: 'Distributor' }]);
      expect(merged.cast).toEqual([{ name: 'Lead Actor' }, { name: 'Supporting Actor' }]);
      expect(merged.original_title).toBe('Original Example');
      expect(merged.overview).toContain('authoritative summary');
    });
  });

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

      test('should match when metadata genres are objects with name fields', () => {
        const metadata = {
          genres: [{ id: 28, name: 'Action' }, { id: 12, name: 'Adventure' }]
        };
        const label = {
          tmdb_match_field: 'genres',
          tmdb_match_values: ['action']
        };

        expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(true);
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

      test('should match when metadata keywords are objects with name fields', () => {
        const metadata = {
          keywords: [{ id: 1, name: 'SuperHero' }, { id: 2, name: 'Marvel' }]
        };
        const label = {
          tmdb_match_field: 'keywords',
          tmdb_match_values: ['superhero']
        };

        expect(classificationService.metadataMatchesLabel(metadata, label)).toBe(true);
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
    db.query.mockReset();
    tmdbService.getMovieDetails.mockReset();
    tmdbService.getCertification.mockReset();
    policyEngine.evaluateItem.mockReset();
    confidenceCalculator.calculate.mockReset();
    confidenceCalculator.toAIContext.mockReset();
    contentTypeAnalyzer.analyze.mockReset();
    classificationPhaseService.updatePhase.mockReset();
    classificationPhaseService.completeTracking.mockReset();

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
    db.query.mockImplementation((text, _params) => {
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

describe('PolicyEngine -> AI flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockReset();
    tmdbService.getMovieDetails.mockReset();
    tmdbService.getCertification.mockReset();
    policyQuestionBuilder.build.mockReset();

    db.query.mockResolvedValue({ rows: [] });
    tmdbService.getMovieDetails.mockResolvedValue({ title: 'Test Movie', genres: [] });
    tmdbService.getCertification.mockResolvedValue('PG');
    policyQuestionBuilder.build.mockResolvedValue(null);

    db.query.mockImplementation((text) => {
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

  test('should run AI analysis for policy prompt paths', async () => {
    policyEngine.evaluateItem.mockResolvedValue({
      action: 'prompt_confirm',
      confidence: 55,
      ranked: [{
        library_id: 1,
        library_name: 'Movies',
        score: 55,
        policy_id: 11,
        policy_name: 'Movies Policy',
        scores: { preset: 60, profile: 50, pattern: 0, rag: 0, history: 0 },
        weights: { preset: 0.35, profile: 0.25, pattern: 0.15, rag: 0.15, history: 0.10 }
      }],
      ragCache: { matches: [], timestamp: Date.now() }
    });

    const aiSpy = jest.spyOn(classificationPolicyPathService, 'aiClassify').mockResolvedValue({
      library: { id: 1, name: 'Movies' },
      confidence: 60,
      verified_by_ai: false
    });

    await classificationService.classify({
      media: { media_type: 'movie', tmdbId: 123 },
      taskId: 'task-456'
    });

    expect(aiSpy).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Array),
      expect.any(Object),
      expect.objectContaining({ mode: 'classify' })
    );
    expect(classificationPhaseService.updatePhase).toHaveBeenCalledWith(
      'task-456',
      'ai_analysis',
      expect.objectContaining({
        skippedPhases: ['signal_combine']
      })
    );
  });
});

describe('Classification Details Storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockReset();
    tmdbService.getMovieDetails.mockReset();
    tmdbService.getCertification.mockReset();
    policyQuestionBuilder.build.mockReset();
    contentTypeAnalyzer.analyze.mockReset();

    db.query.mockResolvedValue({ rows: [] });
    tmdbService.getMovieDetails.mockResolvedValue({ title: 'Test Movie', genres: [] });
    tmdbService.getCertification.mockResolvedValue('PG');
    policyQuestionBuilder.build.mockResolvedValue(null);
    contentTypeAnalyzer.analyze.mockResolvedValue({ analyzed: false });

    db.query.mockImplementation((text) => {
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

  test('should store classification_details with scores and weights in metadata', async () => {
    const mockPolicyResult = {
      action: 'auto_classify',
      library: {
        library_id: 1,
        library_name: 'Movies',
        policy_id: 11,
        policy_name: 'Movies Policy'
      },
      confidence: 85,
      method: 'policy_engine',
      scores: { preset: 80, profile: 70, pattern: 0, rag: 0, history: 0 },
      weights: { preset: 0.35, profile: 0.25, pattern: 0.15, rag: 0.15, history: 0.10 },
      ranked: [{
        library_id: 1,
        library_name: 'Movies',
        score: 85,
        policy_id: 11,
        policy_name: 'Movies Policy',
        scores: { preset: 80, profile: 70, pattern: 0, rag: 0, history: 0 },
        weights: { preset: 0.35, profile: 0.25, pattern: 0.15, rag: 0.15, history: 0.10 }
      }]
    };

    policyEngine.evaluateItem.mockResolvedValue(mockPolicyResult);

    await classificationService.classify({
      media: { media_type: 'movie', tmdbId: 123 },
      taskId: 'task-456'
    });

    // Verify that INSERT INTO classification_history was called
    const insertCalls = db.query.mock.calls.filter(call => 
      typeof call[0] === 'string' && call[0].includes('INSERT INTO classification_history')
    );

    expect(insertCalls.length).toBeGreaterThan(0);

    // Get the metadata parameter (10th parameter, index 9)
    const metadataParam = insertCalls[0][1][9];
    const metadata = JSON.parse(metadataParam);

    // Verify classification_details exists with correct structure
    expect(metadata.classification_details).toBeDefined();
    expect(metadata.classification_details.scores).toEqual({
      preset: 80,
      profile: 70,
      pattern: 0,
      rag: 0,
      history: 0
    });
    expect(metadata.classification_details.weights).toEqual({
      preset: 0.35,
      profile: 0.25,
      pattern: 0.15,
      rag: 0.15,
      history: 0.10
    });
    expect(metadata.classification_details.policy_name).toBe('Movies Policy');
    expect(metadata.classification_details.processing_time_ms).toBeDefined();
  });

  test('should store rag_details when RAG context is available', async () => {
    // Disable rag loop for this test — it verifies rag_details storage from
    // policyResult.ragCache, not second-pass behaviour.
    db.query.mockImplementation((text) => {
      const query = typeof text === 'string' ? text : '';
      if (query.includes('ai_provider_config')) {
        return { rows: [{ id: 1, rag_retrieval_loop_enabled: false }] };
      }
      if (query.includes('FROM libraries')) {
        return { rows: [{ id: 1, name: 'Movies', media_type: 'movie' }] };
      }
      if (query.includes('INSERT INTO classification_history') || query.includes('INSERT INTO logs') || query.includes('INSERT INTO error_logs')) {
        return { rows: [{ id: 12345, error_id: 67890 }] };
      }
      return { rows: [] };
    });

    const mockPolicyResult = {
      action: 'prompt_confirm',
      confidence: 85,
      method: 'policy_engine',
      scores: { preset: 80, profile: 70, pattern: 0, rag: 10, history: 0 },
      weights: { preset: 0.35, profile: 0.25, pattern: 0.15, rag: 0.15, history: 0.10 },
      ranked: [{
        library_id: 1,
        library_name: 'Movies',
        score: 85,
        policy_id: 11,
        policy_name: 'Movies Policy',
        scores: { preset: 80, profile: 70, pattern: 0, rag: 10, history: 0 },
        weights: { preset: 0.35, profile: 0.25, pattern: 0.15, rag: 0.15, history: 0.10 }
      }],
      ragCache: {
        matches: [{
          similarity: 0.88,
          textSimilarity: 0.84,
          imageSimilarity: 0.92,
          textWeight: 0.6,
          imageWeight: 0.4,
          libraryId: 1,
          libraryName: 'Movies'
        }],
        timestamp: Date.now()
      }
    };

    policyEngine.evaluateItem.mockResolvedValue(mockPolicyResult);
    jest.spyOn(classificationPolicyPathService, 'aiClassify').mockResolvedValue({
      library: { id: 1, name: 'Movies' },
      confidence: 85,
      verified_by_ai: false,
      needs_clarification: false
    });

    await classificationService.classify({
      media: { media_type: 'movie', tmdbId: 123 },
      taskId: 'task-789'
    });

    const insertCalls = db.query.mock.calls.filter(call =>
      typeof call[0] === 'string' && call[0].includes('INSERT INTO classification_history')
    );

    expect(insertCalls.length).toBeGreaterThan(0);

    const metadataParam = insertCalls[0][1][9];
    const metadata = JSON.parse(metadataParam);

    expect(metadata.classification_details.rag_details).toEqual({
      combined_similarity: 0.88,
      text_similarity: 0.84,
      image_similarity: 0.92,
      text_weight: 0.6,
      image_weight: 0.4
    });
  });

  test('should store compact rag_loop_summary when second-pass trace is present', async () => {
    const result = await classificationService.logClassification(
      {
        tmdb_id: 123,
        media_type: 'movie',
        title: 'Summary Example',
        year: 2025
      },
      {
        library: { id: 1, name: 'Movies' },
        confidence: 74,
        method: 'policy_recheck',
        reason: 'Policy re-check upgraded confidence',
        ragLoopTrace: {
          mode: 'apply',
          ran: true,
          trigger: 'policy_prompt_select',
          strategy: 'hybrid',
          diagnostics: {
            pass1: { match_count: 1, top_similarity: 0.61 },
            pass2: { match_count: 3, top_similarity: 0.78 }
          },
          decision: {
            outcome: 'policy',
            reason: 'policy_precedence',
            comparator: 'policy_gate'
          },
          events: [
            { stage: 'gate', outcome: 'run', reason_code: 'policy_prompt_select' },
            { stage: 'gate', outcome: 'strategy_selected', reason_code: 'low_signal' },
            { stage: 'enrichment', outcome: 'applied', reason_code: 'metadata_updated' },
            { stage: 'retrieval_pass2', outcome: 'applied', reason_code: 'hybrid' },
            { stage: 'policy_recheck', outcome: 'accepted', reason_code: 'policy_upgrade_accepted' }
          ]
        }
      }
    );

    expect(result).toBe(12345);

    const insertCalls = db.query.mock.calls.filter(call =>
      typeof call[0] === 'string' && call[0].includes('INSERT INTO classification_history')
    );
    const metadataParam = insertCalls[0][1][9];
    const metadata = JSON.parse(metadataParam);

    expect(metadata.classification_details.rag_loop_summary).toEqual({
      ran: true,
      mode: 'apply',
      trigger: 'policy_prompt_select',
      strategy: 'hybrid',
      decision_outcome: 'policy',
      decision_reason: 'policy_precedence',
      comparator: 'policy_gate',
      adopted: true,
      had_error: false,
      pass1_match_count: 1,
      pass1_top_similarity: 0.61,
      pass2_match_count: 3,
      pass2_top_similarity: 0.78,
      stages: {
        gate: { outcome: 'run', reason_code: 'policy_prompt_select' },
        enrichment: { outcome: 'applied', reason_code: 'metadata_updated' },
        retrieval_pass2: { outcome: 'applied', reason_code: 'hybrid' },
        policy_recheck: { outcome: 'accepted', reason_code: 'policy_upgrade_accepted' },
        ai_rerun: null
      }
    });
  });

  test('should use default scores and weights when policyResult is missing', async () => {
    policyEngine.evaluateItem.mockResolvedValue({
      action: 'manual',
      confidence: 0,
      ranked: []
    });

    // Enable RAG loop so the gate runs and emits a skipped event with reason_code
    db.query.mockImplementation((text) => {
      const query = typeof text === 'string' ? text : '';
      if (query.includes('ai_provider_config')) {
        return { rows: [{ id: 1, rag_retrieval_loop_enabled: true }] };
      }
      if (query.includes('FROM libraries')) {
        return { rows: [{ id: 1, name: 'Movies', media_type: 'movie' }] };
      }
      if (query.includes('INSERT INTO classification_history') || query.includes('INSERT INTO logs') || query.includes('INSERT INTO error_logs')) {
        return { rows: [{ id: 12345, error_id: 67890 }] };
      }
      return { rows: [] };
    });

    // Mock confidence calculator to avoid undefined error
    confidenceCalculator.calculate.mockReturnValue({ confidence: 50, suggestedLibrary: null });
    confidenceCalculator.toAIContext.mockReturnValue('');

    // Mock AI so it succeeds with confidence >= 70 — below that threshold,
    // shouldTriggerSecondPass fires ai_low_confidence which would attempt real
    // RAG retrieval (ragRetriever is auto-mocked and returns undefined).
    jest.spyOn(classificationLegacySignalPathService, 'aiClassify').mockResolvedValue({
      library: { id: 1, name: 'Movies' },
      confidence: 75,
      verified_by_ai: false,
    });

    await classificationService.classify({
      media: { media_type: 'movie', tmdbId: 123 }
    });

    const insertCalls = db.query.mock.calls.filter(call => 
      typeof call[0] === 'string' && call[0].includes('INSERT INTO classification_history')
    );

    expect(insertCalls.length).toBeGreaterThan(0);

    const metadataParam = insertCalls[0][1][9];
    const metadata = JSON.parse(metadataParam);

    // Verify default values are used
    expect(metadata.classification_details).toBeDefined();
    expect(metadata.classification_details.scores).toEqual({
      preset: 0,
      profile: 0,
      pattern: 0,
      rag: 0,
      history: 0
    });
    expect(metadata.classification_details.weights).toEqual({
      preset: 0.35,
      profile: 0.25,
      pattern: 0.15,
      rag: 0.15,
      history: 0.10
    });
    expect(metadata.classification_details.rag_loop_summary).toEqual(
      expect.objectContaining({
        decision_outcome: 'baseline',
        decision_reason: 'not_ran',
        adopted: false,
        stages: expect.objectContaining({
          gate: expect.objectContaining({
            outcome: 'skipped',
            reason_code: 'policy_context_missing'
          })
        })
      })
    );
  });
});

describe('retry lineage outcome linking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockReset();
    db.query.mockResolvedValue({ rows: [] });
  });

  test('rebindRetryLineage links replacement classification on the original row', async () => {
    await classificationService.rebindRetryLineage(902, {
      retry_lineage: {
        original_classification_id: 901,
        media_request_ids: [11, 12],
        webhook_log_ids: [31]
      }
    });

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE media_requests'),
      [902, [11, 12]]
    );
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE webhook_log'),
      [902, [31]]
    );
    expect(classificationOutcomeService.recordOutcome).toHaveBeenCalledWith(901, {
      replacement_classification_id: 902
    });
  });
});

describe('RAG loop orchestration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ragLoopResilienceManager.reset();
    ragRetriever.semanticSearchCandidates.mockReset();
    ragRetriever.hybridSearch.mockReset();
    ragRetriever.getSuggestedLibrary.mockReset();
    ragRetriever.semanticSearchCandidates.mockResolvedValue([
      { libraryId: 1, libraryName: 'Movies', similarity: 0.61 },
      { libraryId: 2, libraryName: 'Family', similarity: 0.60 }
    ]);
    ragRetriever.hybridSearch.mockResolvedValue([
      { libraryId: 2, libraryName: 'Family', similarity: 0.74 },
      { libraryId: 2, libraryName: 'Family', similarity: 0.71 }
    ]);
    ragRetriever.getSuggestedLibrary.mockReturnValue({
      libraryId: 2,
      libraryName: 'Family',
      voteCount: 2,
      avgSimilarity: 0.73
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const buildRagConfig = (rolloutMode) => ({
    rag_retrieval_loop_enabled: true,
    rag_loop_rollout_mode: rolloutMode,
    rag_loop_trace_enabled: true,
    rag_loop_trace_max_events: 20,
    rag_loop_trace_max_bytes: 16384,
    rag_loop_conflict_detection_enabled: true,
    rag_conflict_top_n: 5,
    rag_loop_candidate_limit: 25,
    rag_retry_strategy: 'hybrid',
    policy_recheck_below_prompt_threshold_enabled: true,
    policy_recheck_identifier_caps: {
      keywords: 8,
      genres: 5,
      studios: 3,
      cast: 3
    },
    policy_recheck_min_similarity_delta: 0.08,
    policy_recheck_min_margin_delta: 10,
    policy_recheck_min_confidence_gain: 5,
    policy_recheck_max_ai_calls_per_item: 2,
    policy_recheck_metadata_enrichment_enabled: false,
    policy_recheck_metadata_timeout_ms: 2000,
    rag_loop_resilience_enabled: true,
    rag_loop_resilience_window_ms: 60000,
    rag_loop_resilience_min_samples: 3,
    rag_loop_resilience_timeout_streak_threshold: 2,
    rag_loop_resilience_timeout_rate_threshold: 0.5,
    rag_loop_resilience_error_rate_threshold: 0.5,
    rag_loop_cooldown_tmdb_ms: 60000,
    rag_loop_cooldown_rag_ms: 60000,
    rag_loop_cooldown_ai_ms: 60000,
    rag_loop_half_open_probe_count: 2,
    rag_loop_global_bypass_multi_open_enabled: true,
    rag_loop_global_bypass_ms: 60000
  });

  test('retries metadata enrichment within the configured second-pass attempt budget', async () => {
    const config = {
      ...buildRagConfig('apply'),
      policy_recheck_metadata_enrichment_enabled: true,
      policy_recheck_metadata_max_attempts: 2
    };
    jest.spyOn(classificationRagLoopService, 'getRagLoopConfig').mockResolvedValue(config);

    const timeoutError = new Error('metadata_enrichment_timeout');
    timeoutError.name = 'TimeoutError';
    timeoutError.code = 'ETIMEDOUT';

    const enrichSpy = jest.spyOn(classificationRagLoopService, 'enrichWithTMDB')
      .mockRejectedValueOnce(timeoutError)
      .mockResolvedValueOnce({
        tmdb_id: 123,
        media_type: 'movie',
        title: 'Example',
        genres: ['Drama'],
        keywords: ['family'],
        belongs_to_collection: { name: 'Example Collection' },
        production_companies: [{ name: 'Studio' }],
        cast: [{ name: 'Lead Actor' }]
      });
    jest.spyOn(classificationService, 'sleep').mockResolvedValue();

    policyEngine.evaluateItem.mockResolvedValue({
      action: 'prompt_confirm',
      confidence: 74,
      library: {
        library_id: 2,
        library_name: 'Family',
        policy_id: 99,
        policy_name: 'Family Policy'
      },
      ranked: [
        {
          library_id: 2,
          library_name: 'Family',
          score: 74,
          prompt_threshold: 60,
          auto_classify_threshold: 85
        }
      ]
    });

    const result = await classificationService.evaluateRagLoopSecondPass({
      metadata: {
        tmdb_id: 123,
        media_type: 'movie',
        title: 'Example',
        genres: ['Drama'],
        keywords: ['family']
      },
      libraries: [
        { id: 1, name: 'Movies' },
        { id: 2, name: 'Family' }
      ],
      baselineResult: {
        library: { id: 1, name: 'Movies' },
        confidence: 58,
        method: 'ai_analysis',
        needs_clarification: false
      },
      policyResult: {
        action: 'prompt_select',
        confidence: 54,
        ranked: [{
          library_id: 1,
          library_name: 'Movies',
          score: 54,
          prompt_threshold: 60,
          auto_classify_threshold: 85
        }]
      },
      signalContext: { confidence: 58 },
      ragContext: {
        similarItems: [{ libraryId: 1, libraryName: 'Movies', similarity: 0.61 }]
      }
    });

    expect(enrichSpy).toHaveBeenCalledTimes(2);
    expect(result.ragLoopTrace.events.some((event) =>
      event.stage === 'enrichment' &&
      event.outcome === 'retry' &&
      event.recoverable === true
    )).toBe(true);
    expect(result.ragLoopTrace.events.some((event) =>
      event.stage === 'enrichment' &&
      event.outcome === 'applied' &&
      event.reason_code === 'metadata_updated'
    )).toBe(true);
  });

  test('passes richer authoritative enrichment metadata into policy recheck', async () => {
    const config = {
      ...buildRagConfig('apply'),
      policy_recheck_metadata_enrichment_enabled: true,
      policy_recheck_metadata_max_attempts: 1
    };
    jest.spyOn(classificationRagLoopService, 'getRagLoopConfig').mockResolvedValue(config);
    jest.spyOn(classificationRagLoopService, 'enrichWithTMDB').mockResolvedValue({
      tmdb_id: 123,
      media_type: 'movie',
      title: 'Example',
      genres: ['Drama', 'Mystery'],
      keywords: ['family', 'investigation', 'crime'],
      belongs_to_collection: { name: 'Example Collection' },
      production_companies: [{ name: 'Studio' }, { name: 'Distributor' }],
      cast: [{ name: 'Lead Actor' }, { name: 'Supporting Actor' }],
      original_title: 'Original Example',
      overview: 'A much richer authoritative summary that provides substantially more context for retrieval.'
    });

    policyEngine.evaluateItem.mockResolvedValue({
      action: 'prompt_confirm',
      confidence: 74,
      library: {
        library_id: 2,
        library_name: 'Family',
        policy_id: 99,
        policy_name: 'Family Policy'
      },
      ranked: [
        {
          library_id: 2,
          library_name: 'Family',
          score: 74,
          prompt_threshold: 60,
          auto_classify_threshold: 85
        }
      ]
    });

    await classificationService.evaluateRagLoopSecondPass({
      metadata: {
        tmdb_id: 123,
        media_type: 'movie',
        title: 'Example',
        genres: ['Drama'],
        keywords: ['family'],
        original_title: 'Example',
        overview: 'Short summary.'
      },
      libraries: [
        { id: 1, name: 'Movies' },
        { id: 2, name: 'Family' }
      ],
      baselineResult: {
        library: { id: 1, name: 'Movies' },
        confidence: 58,
        method: 'ai_analysis',
        needs_clarification: false
      },
      policyResult: {
        action: 'prompt_select',
        confidence: 54,
        ranked: [{
          library_id: 1,
          library_name: 'Movies',
          score: 54,
          prompt_threshold: 60,
          auto_classify_threshold: 85
        }]
      },
      signalContext: { confidence: 58 },
      ragContext: {
        similarItems: [{ libraryId: 1, libraryName: 'Movies', similarity: 0.61 }]
      }
    });

    expect(policyEngine.evaluateItem).toHaveBeenCalledWith(
      expect.objectContaining({
        genres: ['drama', 'mystery'],
        keywords: ['family', 'investigation', 'crime'],
        belongs_to_collection: { name: 'Example Collection' },
        original_title: 'Original Example'
      }),
      expect.any(Object)
    );
  });

  test('skips metadata enrichment when the configured second-pass attempt cap is zero', async () => {
    const config = {
      ...buildRagConfig('apply'),
      policy_recheck_metadata_enrichment_enabled: true,
      policy_recheck_metadata_max_attempts: 0
    };
    jest.spyOn(classificationRagLoopService, 'getRagLoopConfig').mockResolvedValue(config);

    const enrichSpy = jest.spyOn(classificationRagLoopService, 'enrichWithTMDB');

    const result = await classificationService.evaluateRagLoopSecondPass({
      metadata: {
        tmdb_id: 123,
        media_type: 'movie',
        title: 'Example',
        genres: ['Drama'],
        keywords: ['family']
      },
      libraries: [
        { id: 1, name: 'Movies' },
        { id: 2, name: 'Family' }
      ],
      baselineResult: {
        library: { id: 1, name: 'Movies' },
        confidence: 58,
        method: 'ai_analysis',
        needs_clarification: false
      },
      policyResult: {
        action: 'prompt_select',
        confidence: 54,
        ranked: [{
          library_id: 1,
          library_name: 'Movies',
          score: 54,
          prompt_threshold: 60,
          auto_classify_threshold: 85
        }]
      },
      signalContext: { confidence: 58 },
      ragContext: {
        similarItems: [{ libraryId: 1, libraryName: 'Movies', similarity: 0.61 }]
      }
    });

    expect(enrichSpy).not.toHaveBeenCalled();
    expect(result.ragLoopTrace.events.some((event) =>
      event.stage === 'enrichment' &&
      event.outcome === 'skipped' &&
      event.reason_code === 'attempt_cap_reached'
    )).toBe(true);
  });

  test('skips the whole second pass when rag_loop_max_passes is limited to one', async () => {
    const config = {
      ...buildRagConfig('apply'),
      rag_loop_max_passes: 1
    };
    jest.spyOn(classificationRagLoopService, 'getRagLoopConfig').mockResolvedValue(config);

    const result = await classificationService.evaluateRagLoopSecondPass({
      metadata: {
        tmdb_id: 123,
        media_type: 'movie',
        title: 'Example',
        genres: ['Drama'],
        keywords: ['family']
      },
      libraries: [
        { id: 1, name: 'Movies' },
        { id: 2, name: 'Family' }
      ],
      baselineResult: {
        library: { id: 1, name: 'Movies' },
        confidence: 58,
        method: 'ai_analysis',
        needs_clarification: false
      },
      policyResult: {
        action: 'prompt_select',
        confidence: 54,
        ranked: [{
          library_id: 1,
          library_name: 'Movies',
          score: 54,
          prompt_threshold: 60,
          auto_classify_threshold: 85
        }]
      },
      signalContext: { confidence: 58 },
      ragContext: {
        similarItems: [{ libraryId: 1, libraryName: 'Movies', similarity: 0.61 }]
      }
    });

    expect(ragRetriever.semanticSearchCandidates).not.toHaveBeenCalled();
    expect(result.ragLoopTrace.events.some((event) =>
      event.stage === 'gate' &&
      event.outcome === 'skipped' &&
      event.reason_code === 'max_passes_reached'
    )).toBe(true);
  });

  test('shadow mode remains non-invasive while attaching trace', async () => {
    jest.spyOn(classificationRagLoopService, 'getRagLoopConfig').mockResolvedValue(buildRagConfig('shadow'));

    policyEngine.evaluateItem.mockResolvedValue({
      action: 'prompt_confirm',
      confidence: 74,
      library: {
        library_id: 2,
        library_name: 'Family',
        policy_id: 99,
        policy_name: 'Family Policy'
      },
      ranked: [
        {
          library_id: 2,
          library_name: 'Family',
          score: 74,
          prompt_threshold: 60,
          auto_classify_threshold: 85
        }
      ]
    });

    const baselineResult = {
      library: { id: 1, name: 'Movies' },
      confidence: 58,
      method: 'ai_analysis',
      needs_clarification: false
    };
    const policyResult = {
      action: 'prompt_select',
      confidence: 54,
      ranked: [{
        library_id: 1,
        library_name: 'Movies',
        score: 54,
        prompt_threshold: 60,
        auto_classify_threshold: 85
      }]
    };
    const libraries = [
      { id: 1, name: 'Movies' },
      { id: 2, name: 'Family' }
    ];

    const result = await classificationService.evaluateRagLoopSecondPass({
      metadata: {
        tmdb_id: 123,
        media_type: 'movie',
        title: 'Example',
        genres: ['Drama'],
        keywords: ['family']
      },
      libraries,
      baselineResult,
      policyResult,
      signalContext: { confidence: 58 },
      ragContext: {
        similarItems: [{ libraryId: 1, libraryName: 'Movies', similarity: 0.61 }]
      }
    });

    expect(result.library.id).toBe(1);
    expect(result.confidence).toBe(58);
    expect(result.ragLoopTrace).toBeDefined();
    expect(result.ragLoopTrace.mode).toBe('shadow');
  });

  test('apply mode can adopt policy recheck result when comparator gates pass', async () => {
    jest.spyOn(classificationRagLoopService, 'getRagLoopConfig').mockResolvedValue(buildRagConfig('apply'));

    policyEngine.evaluateItem.mockResolvedValue({
      action: 'prompt_confirm',
      confidence: 74,
      library: {
        library_id: 2,
        library_name: 'Family',
        policy_id: 99,
        policy_name: 'Family Policy'
      },
      ranked: [
        {
          library_id: 2,
          library_name: 'Family',
          score: 74,
          prompt_threshold: 60,
          auto_classify_threshold: 85
        }
      ]
    });

    const baselineResult = {
      library: { id: 1, name: 'Movies' },
      confidence: 58,
      method: 'ai_analysis',
      needs_clarification: false
    };
    const policyResult = {
      action: 'prompt_select',
      confidence: 54,
      ranked: [{
        library_id: 1,
        library_name: 'Movies',
        score: 54,
        prompt_threshold: 60,
        auto_classify_threshold: 85
      }]
    };
    const libraries = [
      { id: 1, name: 'Movies' },
      { id: 2, name: 'Family' }
    ];

    const result = await classificationService.evaluateRagLoopSecondPass({
      metadata: {
        tmdb_id: 123,
        media_type: 'movie',
        title: 'Example',
        genres: ['Drama'],
        keywords: ['family']
      },
      libraries,
      baselineResult,
      policyResult,
      signalContext: { confidence: 58 },
      ragContext: {
        similarItems: [{ libraryId: 1, libraryName: 'Movies', similarity: 0.61 }]
      }
    });

    expect(result.library.id).toBe(2);
    expect(result.method).toBe('policy_recheck');
    expect(result.ragLoopTrace).toBeDefined();
    expect(result.ragLoopTrace.mode).toBe('apply');
  });

  test('apply mode preserves baseline when second-pass conflict persists despite improvement', async () => {
    jest.spyOn(classificationRagLoopService, 'getRagLoopConfig').mockResolvedValue(buildRagConfig('apply'));

    ragRetriever.semanticSearchCandidates.mockResolvedValue([
      { libraryId: 1, libraryName: 'Movies', similarity: 0.76 },
      { libraryId: 1, libraryName: 'Movies', similarity: 0.75 },
      { libraryId: 2, libraryName: 'Family', similarity: 0.755 },
      { libraryId: 2, libraryName: 'Family', similarity: 0.745 }
    ]);
    ragRetriever.hybridSearch.mockResolvedValue([
      { libraryId: 2, libraryName: 'Family', similarity: 0.82 },
      { libraryId: 2, libraryName: 'Family', similarity: 0.80 }
    ]);

    policyEngine.evaluateItem.mockResolvedValue({
      action: 'prompt_confirm',
      confidence: 74,
      library: {
        library_id: 2,
        library_name: 'Family',
        policy_id: 99,
        policy_name: 'Family Policy'
      },
      ranked: [
        {
          library_id: 2,
          library_name: 'Family',
          score: 74,
          prompt_threshold: 60,
          auto_classify_threshold: 85
        }
      ]
    });

    const result = await classificationService.evaluateRagLoopSecondPass({
      metadata: {
        tmdb_id: 123,
        media_type: 'movie',
        title: 'Example',
        genres: ['Drama'],
        keywords: ['family']
      },
      libraries: [
        { id: 1, name: 'Movies' },
        { id: 2, name: 'Family' }
      ],
      baselineResult: {
        library: { id: 1, name: 'Movies' },
        confidence: 58,
        method: 'ai_analysis',
        needs_clarification: false
      },
      policyResult: {
        action: 'prompt_select',
        confidence: 54,
        ranked: [{
          library_id: 1,
          library_name: 'Movies',
          score: 54,
          prompt_threshold: 60,
          auto_classify_threshold: 85
        }]
      },
      signalContext: { confidence: 58 },
      ragContext: {
        similarItems: [{ libraryId: 1, libraryName: 'Movies', similarity: 0.61 }]
      }
    });

    expect(result.library.id).toBe(1);
    expect(result.confidence).toBe(58);
    expect(result.ragLoopTrace.decision.outcome).toBe('baseline');
    expect(result.ragLoopTrace.decision.reason).toBe('conflict_persists');
  });

  test('uses one unified pass2 evidence pool for diagnostics, rag context, and policy recheck cache', async () => {
    jest.spyOn(classificationRagLoopService, 'getRagLoopConfig').mockResolvedValue(buildRagConfig('apply'));

    ragRetriever.semanticSearchCandidates.mockResolvedValue([
      { libraryId: 1, libraryName: 'Movies', similarity: 0.78 },
      { libraryId: 1, libraryName: 'Movies', similarity: 0.77 },
      { libraryId: 1, libraryName: 'Movies', similarity: 0.76 }
    ]);
    ragRetriever.hybridSearch.mockResolvedValue([
      { libraryId: 2, libraryName: 'Family', similarity: 0.91 },
      { libraryId: 2, libraryName: 'Family', similarity: 0.90 }
    ]);

    policyEngine.evaluateItem.mockResolvedValue({
      action: 'prompt_confirm',
      confidence: 74,
      library: {
        library_id: 2,
        library_name: 'Family',
        policy_id: 99,
        policy_name: 'Family Policy'
      },
      ranked: [
        {
          library_id: 2,
          library_name: 'Family',
          score: 74,
          prompt_threshold: 60,
          auto_classify_threshold: 85
        }
      ]
    });

    const result = await classificationService.evaluateRagLoopSecondPass({
      metadata: {
        tmdb_id: 123,
        media_type: 'movie',
        title: 'Example',
        genres: ['Drama'],
        keywords: ['family']
      },
      libraries: [
        { id: 1, name: 'Movies' },
        { id: 2, name: 'Family' }
      ],
      baselineResult: {
        library: { id: 1, name: 'Movies' },
        confidence: 58,
        method: 'ai_analysis',
        needs_clarification: false
      },
      policyResult: {
        action: 'prompt_select',
        confidence: 54,
        ranked: [{
          library_id: 1,
          library_name: 'Movies',
          score: 54,
          prompt_threshold: 60,
          auto_classify_threshold: 85
        }]
      },
      signalContext: { confidence: 58 },
      ragContext: {
        similarItems: [{ libraryId: 1, libraryName: 'Movies', similarity: 0.61 }]
      }
    });

    expect(policyEngine.evaluateItem).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        ragCache: expect.objectContaining({
          matches: expect.arrayContaining([
            expect.objectContaining({ libraryId: 1, libraryName: 'Movies', similarity: 0.78 })
          ])
        })
      })
    );
    expect(result.ragContext.similarItems[0]).toEqual(
      expect.objectContaining({ libraryId: 1, libraryName: 'Movies', similarity: 0.78 })
    );
    expect(result.ragLoopTrace.diagnostics.pass2.top_similarity).toBe(0.78);
  });

  test('policy-first trigger fails open with deterministic guard reason when tmdb mapping is missing', async () => {
    jest.spyOn(classificationRagLoopService, 'getRagLoopConfig').mockResolvedValue(buildRagConfig('apply'));

    const baselineResult = {
      library: { id: 1, name: 'Movies' },
      confidence: 58,
      method: 'ai_analysis',
      needs_clarification: false
    };
    const policyResult = {
      action: 'prompt_select',
      confidence: 54,
      ranked: [{
        library_id: 1,
        library_name: 'Movies',
        score: 54,
        prompt_threshold: 60,
        auto_classify_threshold: 85
      }]
    };

    const result = await classificationService.evaluateRagLoopSecondPass({
      metadata: {
        media_type: 'movie',
        title: 'Example',
        genres: ['Drama'],
        keywords: ['family']
      },
      libraries: [
        { id: 1, name: 'Movies' },
        { id: 2, name: 'Family' }
      ],
      baselineResult,
      policyResult,
      signalContext: { confidence: 58 },
      ragContext: null
    });

    expect(result.library.id).toBe(1);
    expect(result.confidence).toBe(58);
    expect(policyEngine.evaluateItem).not.toHaveBeenCalled();
    expect(result.ragLoopTrace.events.some(event =>
      event.stage === 'gate' &&
      event.reason_code === 'missing_tmdb_id' &&
      event.fallback_action === 'policy_recheck_skipped'
    )).toBe(true);
  });

  test('non-actionable policy results still allow low-confidence ai second pass', async () => {
    jest.spyOn(classificationRagLoopService, 'getRagLoopConfig').mockResolvedValue(buildRagConfig('shadow'));

    const result = await classificationService.evaluateRagLoopSecondPass({
      metadata: {
        tmdb_id: 321,
        media_type: 'movie',
        title: 'Low Confidence Example',
        genres: ['Drama'],
        keywords: ['family']
      },
      libraries: [
        { id: 1, name: 'Movies' },
        { id: 2, name: 'Family' }
      ],
      baselineResult: {
        library: { id: 1, name: 'Movies' },
        confidence: 55,
        method: 'ai_analysis',
        needs_clarification: false
      },
      policyResult: {
        action: 'manual',
        confidence: 0,
        ranked: []
      },
      signalContext: { confidence: 55 },
      ragContext: null
    });

    expect(result.ragLoopTrace.trigger).toBe('ai_low_confidence');
    expect(result.ragLoopTrace.events.some(event =>
      event.stage === 'gate' &&
      event.outcome === 'run' &&
      event.reason_code === 'ai_low_confidence'
    )).toBe(true);
  });

  test('skips second pass when policy prompt risk is clear and confidence already exceeds auto threshold', async () => {
    jest.spyOn(classificationRagLoopService, 'getRagLoopConfig').mockResolvedValue({
      ...buildRagConfig('apply'),
      policy_recheck_skip_when_ai_confident_enabled: true
    });

    const baselineResult = {
      library: { id: 1, name: 'Movies' },
      confidence: 95,
      method: 'ai_analysis',
      needs_clarification: false
    };
    const policyResult = {
      action: 'prompt_select',
      confidence: 74,
      ranked: [{
        library_id: 1,
        library_name: 'Movies',
        score: 74,
        prompt_threshold: 60,
        auto_classify_threshold: 85
      }]
    };

    const result = await classificationService.evaluateRagLoopSecondPass({
      metadata: {
        tmdb_id: 321,
        media_type: 'movie',
        title: 'High Confidence Example',
        genres: ['Drama'],
        keywords: ['family']
      },
      libraries: [
        { id: 1, name: 'Movies' },
        { id: 2, name: 'Family' }
      ],
      baselineResult,
      policyResult,
      signalContext: { confidence: 95, hasConflict: false },
      ragContext: null
    });

    expect(ragRetriever.semanticSearchCandidates).not.toHaveBeenCalled();
    expect(result.library.id).toBe(1);
    expect(result.ragLoopTrace.events.some(event =>
      event.stage === 'gate' &&
      event.outcome === 'skipped' &&
      event.reason_code === 'policy_prompt_risk_clear' &&
      event.fallback_action === 'gate_skipped'
    )).toBe(true);
  });

  test('retries pass1 candidate retrieval on transient timeout and records specific retry reason', async () => {
    jest.spyOn(classificationRagLoopService, 'getRagLoopConfig').mockResolvedValue({
      ...buildRagConfig('apply'),
      rag_loop_retry_backoff_ms: 1
    });

    let pass1Attempts = 0;
    ragRetriever.semanticSearchCandidates.mockImplementation(async (_metadata, _limit, options = {}) => {
      if (options.pass === 'pass1') {
        pass1Attempts += 1;
        if (pass1Attempts === 1) {
          const timeoutError = new Error('rag_pass1_candidate_timeout');
          timeoutError.name = 'TimeoutError';
          throw timeoutError;
        }
        return [
          { libraryId: 1, libraryName: 'Movies', similarity: 0.64 },
          { libraryId: 2, libraryName: 'Family', similarity: 0.63 }
        ];
      }

      return [];
    });
    ragRetriever.hybridSearch.mockResolvedValue([]);
    policyEngine.evaluateItem.mockResolvedValue({
      action: 'prompt_select',
      confidence: 54,
      ranked: [{
        library_id: 1,
        library_name: 'Movies',
        score: 54,
        prompt_threshold: 60,
        auto_classify_threshold: 85
      }]
    });

    const result = await classificationService.evaluateRagLoopSecondPass({
      metadata: {
        tmdb_id: 123,
        media_type: 'movie',
        title: 'Example',
        genres: ['Drama'],
        keywords: ['family']
      },
      libraries: [
        { id: 1, name: 'Movies' },
        { id: 2, name: 'Family' }
      ],
      baselineResult: {
        library: { id: 1, name: 'Movies' },
        confidence: 58,
        method: 'ai_analysis',
        needs_clarification: false
      },
      policyResult: {
        action: 'prompt_select',
        confidence: 54,
        ranked: [{
          library_id: 1,
          library_name: 'Movies',
          score: 54,
          prompt_threshold: 60,
          auto_classify_threshold: 85
        }]
      },
      signalContext: { confidence: 58 },
      ragContext: null
    });

    expect(pass1Attempts).toBe(2);
    expect(result.ragLoopTrace.events.some(event =>
      event.stage === 'gate' &&
      event.outcome === 'retry' &&
      event.reason_code === 'rag_pass1_candidate_timeout'
    )).toBe(true);
  });

  test('retries pass2 retrieval and reports specific provider failure reason when retries are exhausted', async () => {
    jest.spyOn(classificationRagLoopService, 'getRagLoopConfig').mockResolvedValue({
      ...buildRagConfig('apply'),
      rag_loop_retry_backoff_ms: 1
    });

    let pass2Attempts = 0;
    ragRetriever.semanticSearchCandidates.mockImplementation(async (_metadata, _limit, options = {}) => {
      if (options.pass === 'pass1') {
        return [
          { libraryId: 1, libraryName: 'Movies', similarity: 0.64 },
          { libraryId: 2, libraryName: 'Family', similarity: 0.63 }
        ];
      }

      return [];
    });
    ragRetriever.hybridSearch.mockImplementation(async () => {
      pass2Attempts += 1;
      throw new Error('Ollama provider unavailable');
    });
    policyEngine.evaluateItem.mockResolvedValue({
      action: 'prompt_select',
      confidence: 54,
      ranked: [{
        library_id: 1,
        library_name: 'Movies',
        score: 54,
        prompt_threshold: 60,
        auto_classify_threshold: 85
      }]
    });

    const result = await classificationService.evaluateRagLoopSecondPass({
      metadata: {
        tmdb_id: 123,
        media_type: 'movie',
        title: 'Example',
        genres: ['Drama'],
        keywords: ['family']
      },
      libraries: [
        { id: 1, name: 'Movies' },
        { id: 2, name: 'Family' }
      ],
      baselineResult: {
        library: { id: 1, name: 'Movies' },
        confidence: 58,
        method: 'ai_analysis',
        needs_clarification: false
      },
      policyResult: {
        action: 'prompt_select',
        confidence: 54,
        ranked: [{
          library_id: 1,
          library_name: 'Movies',
          score: 54,
          prompt_threshold: 60,
          auto_classify_threshold: 85
        }]
      },
      signalContext: { confidence: 58 },
      ragContext: null
    });

    expect(pass2Attempts).toBe(2);
    expect(result.ragLoopTrace.events.some(event =>
      event.stage === 'retrieval_pass2' &&
      event.outcome === 'retry' &&
      event.reason_code === 'rag_pass2_provider_failed'
    )).toBe(true);
    expect(result.ragLoopTrace.events.some(event =>
      event.stage === 'retrieval_pass2' &&
      event.outcome === 'error' &&
      event.reason_code === 'rag_pass2_provider_failed'
    )).toBe(true);
  });

  test('retries retryable sqlstate conflicts during policy recheck and records deterministic reason', async () => {
    jest.spyOn(classificationRagLoopService, 'getRagLoopConfig').mockResolvedValue({
      ...buildRagConfig('apply'),
      policy_recheck_max_attempts: 2
    });

    const retryableConflict = new Error('serialization failure');
    retryableConflict.code = '40001';
    policyEngine.evaluateItem
      .mockRejectedValueOnce(retryableConflict)
      .mockResolvedValueOnce({
        action: 'prompt_confirm',
        confidence: 74,
        library: {
          library_id: 2,
          library_name: 'Family',
          policy_id: 99,
          policy_name: 'Family Policy'
        },
        ranked: [
          {
            library_id: 2,
            library_name: 'Family',
            score: 74,
            prompt_threshold: 60,
            auto_classify_threshold: 85
          }
        ]
      });

    const result = await classificationService.evaluateRagLoopSecondPass({
      metadata: {
        tmdb_id: 123,
        media_type: 'movie',
        title: 'Example',
        genres: ['Drama'],
        keywords: ['family']
      },
      libraries: [
        { id: 1, name: 'Movies' },
        { id: 2, name: 'Family' }
      ],
      baselineResult: {
        library: { id: 1, name: 'Movies' },
        confidence: 58,
        method: 'ai_analysis',
        needs_clarification: false
      },
      policyResult: {
        action: 'prompt_select',
        confidence: 54,
        ranked: [{
          library_id: 1,
          library_name: 'Movies',
          score: 54,
          prompt_threshold: 60,
          auto_classify_threshold: 85
        }]
      },
      signalContext: { confidence: 58 },
      ragContext: {
        similarItems: [{ libraryId: 1, libraryName: 'Movies', similarity: 0.61 }]
      }
    });

    expect(policyEngine.evaluateItem).toHaveBeenCalledTimes(2);
    expect(result.library.id).toBe(2);
    expect(result.ragLoopTrace.events.some(event =>
      event.stage === 'policy_recheck' &&
      event.outcome === 'retry' &&
      event.reason_code === 'db_retryable_conflict' &&
      event.sql_state === '40001'
    )).toBe(true);
  });

  test('skips policy recheck when the configured policy recheck attempt cap is zero', async () => {
    jest.spyOn(classificationRagLoopService, 'getRagLoopConfig').mockResolvedValue({
      ...buildRagConfig('apply'),
      policy_recheck_max_attempts: 0
    });

    const result = await classificationService.evaluateRagLoopSecondPass({
      metadata: {
        tmdb_id: 123,
        media_type: 'movie',
        title: 'Example',
        genres: ['Drama'],
        keywords: ['family']
      },
      libraries: [
        { id: 1, name: 'Movies' },
        { id: 2, name: 'Family' }
      ],
      baselineResult: {
        library: { id: 1, name: 'Movies' },
        confidence: 58,
        method: 'ai_analysis',
        needs_clarification: false
      },
      policyResult: {
        action: 'prompt_select',
        confidence: 54,
        ranked: [{
          library_id: 1,
          library_name: 'Movies',
          score: 54,
          prompt_threshold: 60,
          auto_classify_threshold: 85
        }]
      },
      signalContext: { confidence: 58 },
      ragContext: {
        similarItems: [{ libraryId: 1, libraryName: 'Movies', similarity: 0.61 }]
      }
    });

    expect(policyEngine.evaluateItem).not.toHaveBeenCalled();
    expect(result.ragLoopTrace.events.some((event) =>
      event.stage === 'policy_recheck' &&
      event.outcome === 'skipped' &&
      event.reason_code === 'attempt_cap_reached'
    )).toBe(true);
  });

  test('scoped rag_pass2 breaker skip is fail-open and traceable', async () => {
    const config = buildRagConfig('shadow');
    jest.spyOn(classificationRagLoopService, 'getRagLoopConfig').mockResolvedValue(config);

    const timeoutError = new Error('timeout');
    timeoutError.code = 'ETIMEDOUT';
    ragLoopResilienceManager.recordFailure('rag_pass2', timeoutError, config);
    ragLoopResilienceManager.recordFailure('rag_pass2', timeoutError, config);
    ragLoopResilienceManager.recordFailure('rag_pass2', timeoutError, config);

    const result = await classificationService.evaluateRagLoopSecondPass({
      metadata: {
        tmdb_id: 123,
        media_type: 'movie',
        title: 'Example',
        genres: ['Drama'],
        keywords: ['family']
      },
      libraries: [
        { id: 1, name: 'Movies' },
        { id: 2, name: 'Family' }
      ],
      baselineResult: {
        library: { id: 1, name: 'Movies' },
        confidence: 55,
        method: 'ai_analysis',
        needs_clarification: false
      },
      policyResult: null,
      signalContext: { confidence: 55 },
      ragContext: null
    });

    expect(result.library.id).toBe(1);
    expect(result.ragLoopTrace.events.some(event =>
      event.stage === 'retrieval_pass2' &&
      event.outcome === 'skipped' &&
      event.reason_code === 'rag_pass2_cooldown' &&
      event.fallback_action === 'pass2_skipped'
    )).toBe(true);
  });

  test('enforces per-item ai call budget and skips ai rerun when exhausted', async () => {
    const config = {
      ...buildRagConfig('apply'),
      policy_recheck_max_ai_calls_per_item: 1
    };
    jest.spyOn(classificationRagLoopService, 'getRagLoopConfig').mockResolvedValue(config);
    const aiClassifySpy = jest.spyOn(classificationRagLoopService, 'aiClassify');

    const result = await classificationService.evaluateRagLoopSecondPass({
      metadata: {
        tmdb_id: 456,
        media_type: 'movie',
        title: 'Low Confidence Example',
        genres: ['Drama'],
        keywords: ['mystery']
      },
      libraries: [
        { id: 1, name: 'Movies' },
        { id: 2, name: 'Family' }
      ],
      baselineResult: {
        library: { id: 1, name: 'Movies' },
        confidence: 58,
        method: 'ai_analysis',
        needs_clarification: false
      },
      policyResult: null,
      signalContext: { confidence: 58 },
      ragContext: null
    });

    expect(aiClassifySpy).not.toHaveBeenCalled();
    expect(result.library.id).toBe(1);
    expect(result.ragLoopTrace.events.some(event =>
      event.stage === 'ai_rerun' &&
      event.outcome === 'skipped' &&
      event.reason_code === 'ai_budget_exhausted'
    )).toBe(true);
  });

  test('runs second-pass ai rerun in verify mode instead of classify mode', async () => {
    const config = {
      ...buildRagConfig('apply'),
      policy_recheck_max_ai_calls_per_item: 2
    };
    jest.spyOn(classificationRagLoopService, 'getRagLoopConfig').mockResolvedValue(config);
    ragRetriever.semanticSearchCandidates.mockImplementation(async (_metadata, _limit, options = {}) => {
      if (options.pass === 'pass1') {
        return [
          { libraryId: 1, libraryName: 'Movies', similarity: 0.58 },
          { libraryId: 2, libraryName: 'Family', similarity: 0.57 }
        ];
      }

      return [
        { libraryId: 1, libraryName: 'Movies', similarity: 0.74 },
        { libraryId: 1, libraryName: 'Movies', similarity: 0.73 }
      ];
    });
    policyEngine.evaluateItem.mockResolvedValue({
      action: 'prompt_select',
      confidence: 54,
      ranked: [{
        library_id: 1,
        library_name: 'Movies',
        score: 54,
        prompt_threshold: 60,
        auto_classify_threshold: 85
      }]
    });

    const aiClassifySpy = jest.spyOn(classificationRagLoopService, 'aiClassify').mockResolvedValue({
      library: { id: 2, name: 'Family' },
      confidence: 74,
      verified_by_ai: true,
      reason: 'Verified against suggested library'
    });

    const result = await classificationService.evaluateRagLoopSecondPass({
      metadata: {
        tmdb_id: 456,
        media_type: 'movie',
        title: 'Low Confidence Example',
        genres: ['Drama'],
        keywords: ['mystery']
      },
      libraries: [
        { id: 1, name: 'Movies' },
        { id: 2, name: 'Family' }
      ],
      baselineResult: {
        library: { id: 1, name: 'Movies' },
        confidence: 58,
        method: 'ai_analysis',
        needs_clarification: false
      },
      policyResult: null,
      signalContext: {
        confidence: 58,
        suggestedLibrary: { id: 1, name: 'Movies' }
      },
      ragContext: null
    });

    expect(aiClassifySpy).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Array),
      expect.objectContaining({
        suggestedLibrary: { id: 1, name: 'Movies' }
      }),
      expect.objectContaining({
        mode: 'verify'
      })
    );
    expect(result.method).toBe('ai_verified');
  });

  test('treats schema mismatch during policy recheck as fail-open and traceable', async () => {
    const config = {
      ...buildRagConfig('apply'),
      policy_recheck_max_ai_calls_per_item: 1
    };
    jest.spyOn(classificationRagLoopService, 'getRagLoopConfig').mockResolvedValue(config);

    const schemaError = new Error('relation missing');
    schemaError.code = '42P01';
    policyEngine.evaluateItem.mockRejectedValueOnce(schemaError);

    const result = await classificationService.evaluateRagLoopSecondPass({
      metadata: {
        tmdb_id: 123,
        media_type: 'movie',
        title: 'Schema Mismatch Example',
        genres: ['Drama'],
        keywords: ['family']
      },
      libraries: [
        { id: 1, name: 'Movies' },
        { id: 2, name: 'Family' }
      ],
      baselineResult: {
        library: { id: 1, name: 'Movies' },
        confidence: 58,
        method: 'ai_analysis',
        needs_clarification: false
      },
      policyResult: {
        action: 'prompt_select',
        confidence: 54,
        ranked: [{
          library_id: 1,
          library_name: 'Movies',
          score: 54,
          prompt_threshold: 60,
          auto_classify_threshold: 85
        }]
      },
      signalContext: { confidence: 58 },
      ragContext: {
        similarItems: [{ libraryId: 1, libraryName: 'Movies', similarity: 0.61 }]
      }
    });

    expect(result.library.id).toBe(1);
    expect(result.ragLoopTrace.events.some(event =>
      event.stage === 'policy_recheck' &&
      event.outcome === 'error' &&
      event.reason_code === 'db_schema_mismatch' &&
      event.sql_state === '42P01'
    )).toBe(true);
  });

  test('writes rag_metrics parity events for persisted pass1 and pass2 stage errors', async () => {
    const stageSpy = jest.spyOn(ragLogger, 'logStageEvent')
      .mockResolvedValue({ logged: true, deduped: false });
    const operationSpy = jest.spyOn(ragLogger, 'logOperation')
      .mockResolvedValue(undefined);

    await classificationService.persistRagLoopStageEvents({
      classificationId: 6606,
      metadata: {
        tmdb_id: 1327819,
        media_type: 'movie',
        title: 'Hoppers'
      },
      result: {
        ragLoopLogContext: {
          correlationId: 'corr-phase3',
          mode: 'apply',
          strategy: 'hybrid',
          trigger: 'policy_prompt_select',
          events: [
            {
              stage: 'gate',
              outcome: 'error',
              reason_code: 'rag_pass1_candidate_timeout',
              recoverable: true
            },
            {
              stage: 'retrieval_pass2',
              outcome: 'error',
              reason_code: 'rag_pass2_provider_failed',
              recoverable: true
            }
          ]
        }
      }
    });

    expect(stageSpy).toHaveBeenCalledTimes(2);
    expect(operationSpy).toHaveBeenCalledTimes(2);
    expect(operationSpy).toHaveBeenNthCalledWith(
      1,
      'second_pass_gate_pass1',
      0,
      false,
      expect.objectContaining({
        itemsProcessed: 1,
        metadata: expect.objectContaining({
          stage: 'gate',
          reason_code: 'rag_pass1_candidate_timeout',
          classification_id: 6606
        })
      })
    );
    expect(operationSpy).toHaveBeenNthCalledWith(
      2,
      'second_pass_retrieval_pass2',
      0,
      false,
      expect.objectContaining({
        itemsProcessed: 1,
        metadata: expect.objectContaining({
          stage: 'retrieval_pass2',
          reason_code: 'rag_pass2_provider_failed',
          classification_id: 6606
        })
      })
    );
  });

  test('writes pass2 success metrics when retrieval_pass2 applied events are logged', async () => {
    const stageSpy = jest.spyOn(ragLogger, 'logStageEvent')
      .mockResolvedValue({ logged: true, deduped: false });
    const operationSpy = jest.spyOn(ragLogger, 'logOperation')
      .mockResolvedValue(undefined);

    await classificationService.persistRagLoopStageEvents({
      classificationId: 7707,
      metadata: {
        tmdb_id: 2468,
        media_type: 'movie',
        title: 'Pass2 Success Example'
      },
      result: {
        ragLoopLogContext: {
          correlationId: 'corr-pass2-success',
          mode: 'apply',
          strategy: 'hybrid',
          trigger: 'policy_prompt_select',
          events: [
            {
              stage: 'retrieval_pass2',
              outcome: 'applied',
              reason_code: 'hybrid',
              recoverable: true
            }
          ]
        }
      }
    });

    expect(stageSpy).toHaveBeenCalledTimes(1);
    expect(operationSpy).toHaveBeenCalledWith(
      'second_pass_retrieval_pass2',
      0,
      true,
      expect.objectContaining({
        itemsProcessed: 1,
        metadata: expect.objectContaining({
          stage: 'retrieval_pass2',
          outcome: 'applied',
          reason_code: 'hybrid',
          classification_id: 7707
        })
      })
    );
  });

  test('preserves rag_candidate stage identity when persisting second-pass stage events', async () => {
    const stageSpy = jest.spyOn(ragLogger, 'logStageEvent')
      .mockResolvedValue({ logged: true, deduped: false });

    await classificationService.persistRagLoopStageEvents({
      classificationId: 8808,
      metadata: {
        tmdb_id: 97531,
        media_type: 'movie',
        title: 'Candidate Stage Example'
      },
      result: {
        ragLoopLogContext: {
          correlationId: 'corr-rag-candidate',
          mode: 'apply',
          strategy: 'hybrid',
          trigger: 'ai_low_confidence',
          events: [
            {
              stage: 'rag_candidate',
              outcome: 'applied',
              reason_code: 'rag_candidate_built',
              recoverable: true
            }
          ]
        }
      }
    });

    expect(stageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'rag_candidate',
        reason_code: 'rag_candidate_built',
        metadata: expect.objectContaining({
          source_stage: 'rag_candidate'
        })
      })
    );
  });

  test('does not write rag_metrics parity rows when stage event write was deduped', async () => {
    jest.spyOn(ragLogger, 'logStageEvent')
      .mockResolvedValue({ logged: false, deduped: true });
    const operationSpy = jest.spyOn(ragLogger, 'logOperation')
      .mockResolvedValue(undefined);

    await classificationService.persistRagLoopStageEvents({
      classificationId: 42,
      metadata: {
        tmdb_id: 100,
        media_type: 'movie',
        title: 'Example'
      },
      result: {
        ragLoopLogContext: {
          correlationId: 'corr-deduped',
          mode: 'apply',
          strategy: 'hybrid',
          trigger: 'policy_prompt_select',
          events: [
            {
              stage: 'retrieval_pass2',
              outcome: 'error',
              reason_code: 'rag_pass2_timeout',
              recoverable: true
            }
          ]
        }
      }
    });

    expect(operationSpy).not.toHaveBeenCalled();
  });

  test('refines generic pass2 reason codes and preserves raw stage error details', async () => {
    const stageSpy = jest.spyOn(ragLogger, 'logStageEvent')
      .mockResolvedValue({ logged: true, deduped: false });
    const operationSpy = jest.spyOn(ragLogger, 'logOperation')
      .mockResolvedValue(undefined);

    await classificationService.persistRagLoopStageEvents({
      classificationId: 99,
      metadata: {
        tmdb_id: 777,
        media_type: 'movie',
        title: 'Refine Example'
      },
      result: {
        ragLoopLogContext: {
          correlationId: 'corr-refine',
          mode: 'apply',
          strategy: 'hybrid',
          trigger: 'policy_prompt_select',
          events: [
            {
              stage: 'retrieval_pass2',
              outcome: 'error',
              reason_code: 'rag_pass2_failed',
              reason: 'Failed to generate embedding: provider unavailable',
              recoverable: true,
              error_message: 'Failed to generate embedding: provider unavailable',
              error_name: 'Error',
              error_code: 'EPIPE'
            }
          ]
        }
      }
    });

    expect(stageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'retrieval_pass2',
        reason_code: 'rag_pass2_embed_failed',
        error: expect.objectContaining({
          message: 'Failed to generate embedding: provider unavailable',
          name: 'Error',
          code: 'EPIPE'
        }),
        metadata: expect.objectContaining({
          raw_reason: 'Failed to generate embedding: provider unavailable',
          raw_reason_code: 'rag_pass2_failed',
          raw_error_message: 'Failed to generate embedding: provider unavailable',
          raw_error_name: 'Error',
          raw_error_code: 'EPIPE'
        })
      })
    );
    expect(operationSpy).toHaveBeenCalledWith(
      'second_pass_retrieval_pass2',
      0,
      false,
      expect.objectContaining({
        metadata: expect.objectContaining({
          reason_code: 'rag_pass2_embed_failed'
        })
      })
    );
  });
});

describe('second-pass result materialization', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('buildPolicyRecheckCandidate clears stale clarification state while carrying updated policy result', () => {
    const baselineResult = {
      library: { id: 1, name: 'Movies' },
      confidence: 58,
      method: 'ai_analysis',
      needs_clarification: true,
      policy_question: { problem_summary: 'Old question' },
      clarification: { problem_summary: 'Old question' },
      pending_reason: 'Old question',
      policyResult: { action: 'prompt_select' },
      ragContext: { similarItems: [{ libraryId: 1 }] }
    };

    const policyResult = {
      action: 'auto_classify',
      confidence: 77,
      library: {
        library_id: 2,
        library_name: 'Family'
      }
    };

    const result = classificationService.buildPolicyRecheckCandidate({
      baselineResult,
      libraries: [
        { id: 1, name: 'Movies' },
        { id: 2, name: 'Family' }
      ],
      policyResult,
      ragContext: { similarItems: [{ libraryId: 2 }] },
      adoptionReason: 'Policy re-check upgraded confidence'
    });

    expect(result.library.id).toBe(2);
    expect(result.needs_clarification).toBe(false);
    expect(result.policy_question).toBeNull();
    expect(result.clarification).toBeNull();
    expect(result.pending_reason).toBeNull();
    expect(result.policyResult).toBe(policyResult);
  });

  test('buildAiRerunCandidate clears stale clarification state when rerun result does not carry one', () => {
    const baselineResult = {
      library: { id: 1, name: 'Movies' },
      confidence: 58,
      method: 'ai_analysis',
      needs_clarification: true,
      policy_question: { problem_summary: 'Old question' },
      clarification: { problem_summary: 'Old question' },
      pending_reason: 'Old question',
      policyResult: { action: 'prompt_select' }
    };

    const aiRerunMatch = {
      library: { id: 2, name: 'Family' },
      confidence: 72,
      verified_by_ai: false,
      reason: 'Rerun result'
    };

    const result = classificationService.buildAiRerunCandidate({
      baselineResult,
      aiRerunMatch,
      libraries: [
        { id: 1, name: 'Movies' },
        { id: 2, name: 'Family' }
      ],
      signalContext: { confidence: 58 },
      policyResult: { action: 'prompt_confirm' },
      ragContext: null
    });

    expect(result.library.id).toBe(2);
    expect(result.policy_question).toBeNull();
    expect(result.clarification).toBeNull();
    expect(result.pending_reason).toBeNull();
  });

  test('ensureDecisionQuestion builds from the adopted result policy context', async () => {
    policyQuestionBuilder.build.mockResolvedValue({
      problem_summary: 'Use updated policy context',
      question: 'Which library?',
      options: [{ label: 'Family', library_id: 2, library_name: 'Family' }]
    });

    const stalePolicyResult = {
      action: 'prompt_select',
      ranked: [{ library_id: 1, library_name: 'Movies' }]
    };
    const updatedPolicyResult = {
      action: 'prompt_confirm',
      ranked: [{ library_id: 2, library_name: 'Family' }]
    };

    const result = await classificationService.ensureDecisionQuestion({
      metadata: {
        tmdb_id: 1001,
        media_type: 'movie',
        title: 'Ambiguous Family Title'
      },
      result: {
        library: { id: 2, name: 'Family' },
        confidence: 62,
        method: 'policy_recheck',
        policyResult: updatedPolicyResult
      },
      policyResult: stalePolicyResult,
      libraries: [
        { id: 1, name: 'Movies' },
        { id: 2, name: 'Family' }
      ],
      ragContext: null
    });

    expect(policyQuestionBuilder.build).toHaveBeenCalledWith(expect.objectContaining({
      policyResult: updatedPolicyResult
    }));
    expect(result.pending_reason).toBe('Use updated policy context');
  });

  test('deriveClassificationPersistenceState drops stale question state for completed results', async () => {
    const normalizeSpy = jest.spyOn(classificationService, 'normalizePolicyQuestion');

    const state = await classificationService.deriveClassificationPersistenceState({
      library: { id: 2, name: 'Family' },
      confidence: 82,
      method: 'policy_recheck',
      pending_reason: 'Old question',
      policy_question: { problem_summary: 'Old question' },
      clarification: { problem_summary: 'Old question' }
    });

    expect(state.status).toBe('completed');
    expect(state.pendingReason).toBeNull();
    expect(state.policyQuestion).toBeNull();
    expect(normalizeSpy).not.toHaveBeenCalled();
  });
});

describe('Classification retry persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('retryClassification delegates scheduler retries through the shared retry service', async () => {
    classificationRetryService.retryClassifications.mockResolvedValue({
      requested: 1,
      queued: 1,
      skipped: 0,
      failed: 0,
      results: [{ classificationId: 123, queued: true, reasonCode: 'queued', taskId: 5001 }]
    });

    const result = await classificationService.retryClassification(123);

    expect(result).toEqual({
      classificationId: 123,
      queued: true,
      reasonCode: 'queued',
      taskId: 5001
    });
    expect(classificationRetryService.retryClassifications).toHaveBeenCalledWith({
      classificationIds: [123],
      actor: 'scheduler',
      purgeLearning: false,
      correlationId: 'scheduler-retry-123',
      taskSource: 'retry_queue',
      metadataEnrichmentSource: 'retry_queue_followup',
      route: 'scheduler:retry-queue'
    });
  });

  test('retryClassification returns null when the shared retry service has no per-item result', async () => {
    classificationRetryService.retryClassifications.mockResolvedValue({
      requested: 1,
      queued: 0,
      skipped: 1,
      failed: 0,
      results: []
    });

    const result = await classificationService.retryClassification(456);

    expect(result).toBeNull();
    expect(classificationRetryService.retryClassifications).toHaveBeenCalledWith({
      classificationIds: [456],
      actor: 'scheduler',
      purgeLearning: false,
      correlationId: 'scheduler-retry-456',
      taskSource: 'retry_queue',
      metadataEnrichmentSource: 'retry_queue_followup',
      route: 'scheduler:retry-queue'
    });
  });

  test('logClassification persists fallback clarification when policy_question is absent', async () => {
    const insertCalls = [];
    db.query.mockImplementation((text, params) => {
      const query = typeof text === 'string' ? text : '';
      if (query.includes('INSERT INTO classification_history')) {
        insertCalls.push([text, params]);
        return { rows: [{ id: 999 }] };
      }
      return { rows: [] };
    });

    jest.spyOn(classificationPersistenceService, 'normalizePolicyQuestion').mockResolvedValue('{"problem_summary":"Unable to auto-classify"}');

    await classificationService.logClassification(
      { tmdb_id: 55, media_type: 'movie', title: 'Fallback Test', year: 2026 },
      {
        needs_retry: false,
        needs_clarification: true,
        method: 'fallback',
        reason: 'AI could not determine classification - manual review needed',
        confidence: 50,
        clarification: {
          problem_summary: 'Unable to auto-classify',
          question: 'Which library should this item go to?',
          options: [{ label: 'Movies', library_id: 1, library_name: 'Movies' }]
        }
      }
    );

    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0][1][14]).toBe('{"problem_summary":"Unable to auto-classify"}');
  });
});

describe('AI availability fallback handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ragLoopResilienceManager.reset();
    tmdbService.getMovieDetails.mockReset();
    tmdbService.getCertification.mockReset();
    contentTypeAnalyzer.analyze.mockReset();
    policyQuestionBuilder.build.mockReset();

    tmdbService.getMovieDetails.mockResolvedValue({ title: 'Test Movie', genres: [] });
    tmdbService.getCertification.mockResolvedValue('PG');
    contentTypeAnalyzer.analyze.mockResolvedValue({ analyzed: false });
    policyQuestionBuilder.build.mockResolvedValue(null);

    db.query.mockImplementation((text) => {
      const query = typeof text === 'string' ? text : '';
      if (query.includes('FROM libraries')) {
        return { rows: [{ id: 1, name: 'Movies', media_type: 'movie' }] };
      }
      if (query.includes('FROM ai_provider_config WHERE id = 1')) {
        return { rows: [{ rag_retrieval_loop_enabled: true, rag_loop_rollout_mode: 'apply' }] };
      }
      if (query.includes('INSERT INTO classification_history') || query.includes('INSERT INTO logs') || query.includes('INSERT INTO error_logs')) {
        return { rows: [{ id: 12345, error_id: 67890 }] };
      }
      return { rows: [] };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('queues retry when AI is busy/unavailable even if confidence is high', async () => {
    policyEngine.evaluateItem.mockResolvedValue({
      action: 'prompt_confirm',
      confidence: 82,
      ranked: [{
        library_id: 1,
        library_name: 'Movies',
        score: 82,
        prompt_threshold: 60,
        auto_classify_threshold: 85
      }]
    });

    jest.spyOn(classificationPolicyPathService, 'aiClassify').mockRejectedValue(
      new Error('[ProviderLock] Timeout waiting for lock (requestor: classification)')
    );

    const result = await classificationService.classify({
      media: { media_type: 'movie', tmdbId: 123 }
    });

    expect(result.success).toBe(true);
    expect(result.method).toBe('queued_for_retry');
    expect(result.reason).toContain('queued for retry');
  });

  test('uses specific queued retry reason when generation ends before completion signal', async () => {
    policyEngine.evaluateItem.mockResolvedValue({
      action: 'prompt_confirm',
      confidence: 82,
      ranked: [{
        library_id: 1,
        library_name: 'Movies',
        score: 82,
        prompt_threshold: 60,
        auto_classify_threshold: 85
      }]
    });

    const incompleteError = new Error('Generation ended before completion signal');
    incompleteError.code = 'EINCOMPLETE';
    jest.spyOn(classificationPolicyPathService, 'aiClassify').mockRejectedValue(incompleteError);

    const result = await classificationService.classify({
      media: { media_type: 'movie', tmdbId: 123 }
    });

    expect(result.success).toBe(true);
    expect(result.method).toBe('queued_for_retry');
    expect(result.reason).toBe('AI stream ended before completion signal - queued for retry');
    expect(result.retry_reason_code).toBe('ai_stream_incomplete');
  });

  test('increments persisted retry state when a requeued classification fails again', async () => {
    policyEngine.evaluateItem.mockResolvedValue({
      action: 'prompt_confirm',
      confidence: 82,
      ranked: [{
        library_id: 1,
        library_name: 'Movies',
        score: 82,
        prompt_threshold: 60,
        auto_classify_threshold: 85
      }]
    });

    jest.spyOn(classificationPolicyPathService, 'aiClassify').mockRejectedValue(
      new Error('[ProviderLock] Timeout waiting for lock (requestor: classification)')
    );

    const result = await classificationService.classify({
      media: { media_type: 'movie', tmdbId: 123 },
      retry_count: 2,
      max_retries: 4
    });

    expect(result.success).toBe(true);
    expect(result.method).toBe('queued_for_retry');

    const insertCalls = db.query.mock.calls.filter(call =>
      typeof call[0] === 'string' && call[0].includes('INSERT INTO classification_history')
    );
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0][1][10]).toBe('pending_retry');
    expect(insertCalls[0][1][17]).toBe(3);
    expect(insertCalls[0][1][18]).toBe(4);
  });

  test('rebinds request and webhook lineage after retry-created classifications are persisted', async () => {
    policyEngine.evaluateItem.mockResolvedValue({
      action: 'prompt_confirm',
      confidence: 82,
      ranked: [{
        library_id: 1,
        library_name: 'Movies',
        score: 82,
        prompt_threshold: 60,
        auto_classify_threshold: 85
      }]
    });

    jest.spyOn(classificationPolicyPathService, 'aiClassify').mockRejectedValue(
      new Error('[ProviderLock] Timeout waiting for lock (requestor: classification)')
    );

    const result = await classificationService.classify({
      media: { media_type: 'movie', tmdbId: 123 },
      retry_lineage: {
        original_classification_id: 991,
        media_request_ids: [14, 18],
        webhook_log_ids: [27]
      }
    });

    expect(result.success).toBe(true);
    expect(result.method).toBe('queued_for_retry');
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE media_requests'),
      [12345, [14, 18]]
    );
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE webhook_log'),
      [12345, [27]]
    );
  });

  // checkLearnedPatterns tests removed (Phase 7): method retired from classification.js alongside LEARNED_PATTERN signal removal.

  test('keeps non-transient AI failures on signal-calculation fallback path', async () => {
    policyEngine.evaluateItem.mockResolvedValue({
      action: 'prompt_confirm',
      confidence: 82,
      ranked: [{
        library_id: 1,
        library_name: 'Movies',
        score: 82,
        prompt_threshold: 60,
        auto_classify_threshold: 85
      }]
    });

    jest.spyOn(classificationService, 'aiClassify').mockRejectedValue(
      new Error('response_parse_failure')
    );

    const result = await classificationService.classify({
      media: { media_type: 'movie', tmdbId: 123 }
    });

    expect(result.success).toBe(true);
    expect(result.method).toBe('signal_calculation');
  });

  test('adds a policy question when policy-signal fallback stays in awaiting-decision confidence band', async () => {
    policyEngine.evaluateItem.mockResolvedValue({
      action: 'prompt_select',
      confidence: 60,
      ranked: [{
        library_id: 1,
        library_name: 'Movies',
        score: 60,
        prompt_threshold: 60,
        auto_classify_threshold: 85
      }]
    });
    policyQuestionBuilder.build.mockResolvedValue({
      problem_summary: 'Low confidence',
      question: 'Which library should this go to?',
      options: [{ label: 'Movies', library_id: 1, library_name: 'Movies' }]
    });

    jest.spyOn(classificationService, 'aiClassify').mockRejectedValue(
      new Error('response_parse_failure')
    );

    const result = await classificationService.classify({
      media: { media_type: 'movie', tmdbId: 123 }
    });

    expect(result.success).toBe(true);
    expect(result.method).toBe('signal_calculation');

    const insertCalls = db.query.mock.calls.filter(call =>
      typeof call[0] === 'string' && call[0].includes('INSERT INTO classification_history')
    );
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0][1][10]).toBe('awaiting_decision');
    expect(insertCalls[0][1][14]).not.toBeNull();
    expect(JSON.parse(insertCalls[0][1][14])).toEqual(expect.objectContaining({
      problem_summary: 'Low confidence',
      question: 'Which library should this go to?'
    }));
    expect(insertCalls[0][1][13]).toBe('Low confidence');
  });

  test('adds a manual-selection question when legacy signal fallback stays in awaiting-decision confidence band', async () => {
    policyEngine.evaluateItem.mockResolvedValue({
      action: 'manual',
      confidence: 0,
      ranked: []
    });
    confidenceCalculator.calculate.mockReturnValue({
      confidence: 60,
      suggestedLibrary: { id: 1, name: 'Movies', media_type: 'movie' }
    });
    confidenceCalculator.toAIContext.mockReturnValue('');
    policyQuestionBuilder.build.mockResolvedValue({
      problem_summary: 'Manual selection needed',
      question: 'Which library should this go to?',
      options: [{ label: 'Movies', library_id: 1, library_name: 'Movies' }]
    });

    jest.spyOn(classificationService, 'aiClassify').mockRejectedValue(
      new Error('response_parse_failure')
    );

    const result = await classificationService.classify({
      media: { media_type: 'movie', tmdbId: 123 }
    });

    expect(result.success).toBe(true);
    expect(result.method).toBe('signal_calculation');

    const insertCalls = db.query.mock.calls.filter(call =>
      typeof call[0] === 'string' && call[0].includes('INSERT INTO classification_history')
    );
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0][1][10]).toBe('awaiting_decision');
    expect(insertCalls[0][1][14]).not.toBeNull();
    expect(JSON.parse(insertCalls[0][1][14])).toEqual(expect.objectContaining({
      problem_summary: 'Manual selection needed',
      question: 'Which library should this go to?'
    }));
    expect(insertCalls[0][1][13]).toBe('Manual selection needed');
  });
});

describe('Phase 1 AI contract and stream guard', () => {
  const libraries = [
    { id: 1, name: 'Movies', media_type: 'movie' },
    { id: 2, name: 'Family', media_type: 'movie' }
  ];
  const metadata = {
    title: 'Hoppers',
    tmdb_id: 1327819,
    media_type: 'movie',
    genres: ['Animation', 'Family']
  };
  const signalContext = {
    confidence: 84,
    suggestedLibrary: libraries[0],
    breakdown: []
  };

  beforeEach(() => {
    jest.clearAllMocks();
    aiRouter.clearCache();

    providerLock.config = { heartbeatInterval: 10 };
    jest.spyOn(providerLock, 'acquireLock').mockResolvedValue(true);
    jest.spyOn(providerLock, 'releaseLock').mockReturnValue(true);
    jest.spyOn(providerLock, 'heartbeat').mockResolvedValue(true);

    jest.spyOn(ollamaService, 'setGenerationStatus').mockImplementation(() => {});
    jest.spyOn(ollamaService, 'updateTokenCount').mockImplementation(() => {});

    db.query.mockImplementation((text) => {
      const query = typeof text === 'string' ? text : '';
      if (query.includes('FROM tavily_config')) {
        return { rows: [] };
      }
      if (query.includes('FROM ai_provider_config WHERE id = 1')) {
        return {
          rows: [{
            primary_provider: 'ollama',
            ollama_model: 'gemma3:12b',
            temperature: 0.3,
            ai_response_repair_enabled: true,
            classification_disallow_partial_stream_response: true
          }]
        };
      }
      return { rows: [] };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('converts incident-style malformed prose into deterministic contract violation without repair', async () => {
    const malformed = 'The media item is an animated family comedy with science fiction elements. The profile shows a strong presence of Animation and Family genres. The RAG data suggests similar movies have been classified';
    jest.spyOn(ollamaService, 'generateWithProgress').mockResolvedValue(malformed);
    jest.spyOn(ollamaService, 'generate').mockResolvedValue(
      'CONFIDENT|2|85|Animated family comedy profile aligns with Family library.'
    );

    const result = await classificationService.aiClassify(metadata, libraries, signalContext, {
      mode: 'classify'
    });

    expect(result.format).toBe('contract_violation');
    expect(result.needs_clarification).toBe(true);
    expect(result.library).toEqual(libraries[0]);
    expect(result.policy_question).toEqual(expect.objectContaining({
      problem_summary: 'AI response contract violation',
      why_uncertain: expect.stringContaining('required response contract format'),
      question: expect.stringContaining('Movies')
    }));
    expect(result.parse_diagnostics).toEqual(expect.objectContaining({
      contract_version: 'phase1_v1',
      mode: 'classify',
      attempt_count: 1,
      repaired: false,
      repair_attempted: false,
      repair_succeeded: false
    }));

    expect(ollamaService.generate).not.toHaveBeenCalled();
  });

  test('enforces completion-only stream parse options in classify mode', async () => {
    jest.spyOn(ollamaService, 'generateWithProgress').mockResolvedValue(
      'CONFIDENT|1|81|Signals align with Movies library.'
    );
    jest.spyOn(ollamaService, 'generate').mockResolvedValue('');

    await classificationService.aiClassify(metadata, libraries, signalContext, {
      mode: 'classify'
    });

    const promptArg = ollamaService.generateWithProgress.mock.calls[0][0];
    expect(promptArg).toContain('NEVER use CONFIRM format');
    expect(promptArg).toContain('use CONFIDENT format, not CLARIFY');

    expect(ollamaService.generateWithProgress).toHaveBeenCalledWith(
      expect.any(String),
      'gemma3:12b',
      0.3,
      expect.any(Function),
      null,
      expect.objectContaining({
        allowPartialOnAbort: false,
        allowPartialOnStall: false,
        requireDoneSignal: true
      })
    );
  });

  test('retries once on transient stream interruption before parsing AI response', async () => {
    const incompleteError = new Error('Generation ended before completion signal');
    incompleteError.code = 'EINCOMPLETE';

    jest.spyOn(ollamaService, 'generateWithProgress')
      .mockRejectedValueOnce(incompleteError)
      .mockResolvedValueOnce('CONFIDENT|1|81|Signals align with Movies library.');
    jest.spyOn(ollamaService, 'generate').mockResolvedValue('');

    const result = await classificationService.aiClassify(metadata, libraries, signalContext, {
      mode: 'classify'
    });

    expect(result.format).toBe('confident');
    expect(ollamaService.generateWithProgress).toHaveBeenCalledTimes(2);
  });

  test('routes classification generation through aiRouter for cloud providers', async () => {
    db.query.mockImplementation((text) => {
      const query = typeof text === 'string' ? text : '';
      if (query.includes('FROM tavily_config')) {
        return { rows: [] };
      }
      if (query.includes('FROM ai_provider_config WHERE id = 1')) {
        return {
          rows: [{
            primary_provider: 'openai',
            model: 'gpt-5-mini',
            temperature: 0.2,
            ai_response_repair_enabled: true,
            classification_disallow_partial_stream_response: true
          }]
        };
      }
      return { rows: [] };
    });

    jest.spyOn(aiRouter, 'getProvider').mockResolvedValue({
      type: 'openai',
      isCloud: true,
      config: {
        primary_provider: 'openai',
        model: 'gpt-5-mini',
        temperature: 0.2
      }
    });
    jest.spyOn(aiRouter, 'classify').mockResolvedValue(
      'CONFIDENT|1|81|Signals align with Movies library.'
    );
    jest.spyOn(ollamaService, 'generateWithProgress').mockResolvedValue('');

    const result = await classificationService.aiClassify(metadata, libraries, signalContext, {
      mode: 'classify'
    });

    expect(result.format).toBe('confident');
    expect(aiRouter.getProvider).toHaveBeenCalledWith('classification');
    expect(aiRouter.classify).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        taskType: 'classification',
        requestType: 'classification',
        itemTitle: 'Hoppers'
      })
    );
    expect(ollamaService.generateWithProgress).not.toHaveBeenCalled();
  });

  test('treats stream timeout/abort errors as transient availability failures', () => {
    const timeoutError = new Error('ollama_generate stalled with partial response blocked');
    timeoutError.code = 'ESTALL';

    const abortedError = new Error('Generation aborted');
    abortedError.code = 'ABORT_ERR';

    const incompleteDoneSignalError = new Error('Generation ended before completion signal');

    const http500Error = new Error('Request failed with status code 500');
    const http502Error = new Error('Request failed with status code 502');
    const http503Error = new Error('Request failed with status code 503');
    const http504Error = new Error('Request failed with status code 504');

    expect(classificationService.isAiTransientAvailabilityError(timeoutError)).toBe(true);
    expect(classificationService.isAiTransientAvailabilityError(abortedError)).toBe(true);
    expect(classificationService.isAiTransientAvailabilityError(incompleteDoneSignalError)).toBe(true);
    expect(classificationService.isAiTransientAvailabilityError(http500Error)).toBe(true);
    expect(classificationService.isAiTransientAvailabilityError(http502Error)).toBe(true);
    expect(classificationService.isAiTransientAvailabilityError(http503Error)).toBe(true);
    expect(classificationService.isAiTransientAvailabilityError(http504Error)).toBe(true);
  });

  test('treats 429 rate-limit as transient — via response.status (no message pattern)', () => {
    // Cloud LLM providers (Anthropic, OpenAI) set error.response.status without
    // putting the numeric code in error.message; ensure we check the status field.
    const rateLimitViaSatus = { response: { status: 429 }, message: 'Too Many Requests', code: undefined };
    const rateLimitViaMessage = new Error('Request failed with status code 429');
    const rateLimitViaMessageAlt = new Error('rate limit exceeded, please retry');

    expect(classificationService.isAiTransientAvailabilityError(rateLimitViaSatus)).toBe(true);
    expect(classificationService.isAiTransientAvailabilityError(rateLimitViaMessage)).toBe(true);
    expect(classificationService.isAiTransientAvailabilityError(rateLimitViaMessageAlt)).toBe(true);
  });

  test('resolves specific retry reason for HTTP 500 errors', () => {
    const http500Error = new Error('Failed to generate: Request failed with status code 500');
    const http503Error = new Error('Request failed with status code 503');

    const result500 = classificationService.resolveRetryReason(http500Error);
    const result503 = classificationService.resolveRetryReason(http503Error);

    expect(result500.code).toBe('ai_server_error');
    expect(result500.reason).toContain('500');
    expect(result503.code).toBe('ai_unavailable');
    expect(result503.reason).toContain('503');
  });

  test('resolves 429 rate-limit retry reason — via message and via response.status', () => {
    const via429Message = new Error('Request failed with status code 429');
    const via429Status = { response: { status: 429 }, message: 'Too Many Requests', code: undefined };

    const resultMsg = classificationService.resolveRetryReason(via429Message);
    const resultStatus = classificationService.resolveRetryReason(via429Status);

    expect(resultMsg.code).toBe('ai_rate_limited');
    expect(resultMsg.reason).toContain('429');
    expect(resultStatus.code).toBe('ai_rate_limited');
    expect(resultStatus.reason).toContain('429');
  });

  test('resolves 502/504 gateway errors via response.status when message is generic', () => {
    // Providers like OpenAI return a generic "Bad Gateway" message without the numeric code.
    const via502Status = { response: { status: 502 }, message: 'Bad Gateway', code: undefined };
    const via504Status = { response: { status: 504 }, message: 'Gateway Timeout', code: undefined };

    const result502 = classificationService.resolveRetryReason(via502Status);
    const result504 = classificationService.resolveRetryReason(via504Status);

    expect(result502.code).toBe('ai_gateway_error');
    expect(result504.code).toBe('ai_gateway_error');
  });

  test('buildAiRepairPrompt uses library_number placeholders in CLARIFY format', () => {
    const libraries = [
      { id: 1, name: 'Movies', media_type: 'movie' },
      { id: 2, name: 'TV Shows', media_type: 'show' },
    ];
    const signalContext = { confidence: 60, suggestedLibrary: libraries[0] };

    const classifyPrompt = classificationService.buildAiRepairPrompt({
      response: 'some raw AI text',
      libraries,
      signalContext,
      mode: 'classify'
    });
    const verifyPrompt = classificationService.buildAiRepairPrompt({
      response: 'some raw AI text',
      libraries,
      signalContext,
      mode: 'verify'
    });

    // Must NOT use the old generic placeholders
    expect(classifyPrompt).not.toContain('<option1>');
    expect(classifyPrompt).not.toContain('<option2>');
    expect(verifyPrompt).not.toContain('<option1>');
    expect(verifyPrompt).not.toContain('<option2>');

    // Must NOT use the old name-based placeholders (which allowed hallucinated genre names)
    expect(classifyPrompt).not.toContain('<exact_library_name_1>');
    expect(verifyPrompt).not.toContain('<exact_library_name_1>');

    // Must use numeric placeholders — consistent with CONFIDENT/CONFIRM, eliminates name hallucination
    expect(classifyPrompt).toContain('<library_number_1>');
    expect(classifyPrompt).toContain('<library_number_2>');
    expect(verifyPrompt).toContain('<library_number_1>');
    expect(verifyPrompt).toContain('<library_number_2>');
  });

  test('aiClassify end-to-end: LLM returns CLARIFY with numbered prefixes and library IDs are resolved', async () => {
    // Reproduces the full Bug 3/4 pipeline: LLM returns "1. Movies|2. Family" in a
    // CLARIFY response. Verifies that aiClassify correctly strips the prefixes via
    // parseClarifyFormat → mapOptionsToLibraries and returns a clarify result with
    // real library_id values — not null or unmatched options.
    jest.spyOn(ollamaService, 'generateWithProgress').mockResolvedValue(
      'CLARIFY|Genre ambiguity|Content has both Animation and Family signals|Is this for the main Movies library or the Family library?|1. Movies|2. Family'
    );
    jest.spyOn(ollamaService, 'generate').mockResolvedValue('');

    const result = await classificationService.aiClassify(metadata, libraries, signalContext, {
      mode: 'classify'
    });

    expect(result.format).toBe('clarify');
    expect(result.needs_clarification).toBe(true);
    expect(result.clarification.options).toHaveLength(2);

    const optionIds = result.clarification.options.map(o => o.library_id);
    // Both library IDs must resolve — not null/undefined
    expect(optionIds).toContain(1); // Movies
    expect(optionIds).toContain(2); // Family
    expect(optionIds.every(id => id != null)).toBe(true);
  });
});
