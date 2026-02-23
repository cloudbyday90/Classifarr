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

const classificationService = require('../services/classification');
const classificationPhaseService = require('../services/classificationPhaseService');
const db = require('../config/database');
const tmdbService = require('../services/tmdb');
const policyEngine = require('../services/policyEngine');
const confidenceCalculator = require('../services/confidenceCalculator');
const contentTypeAnalyzer = require('../services/contentTypeAnalyzer');
const policyQuestionBuilder = require('../services/policyQuestionBuilder');
const ragRetriever = require('../services/ragRetriever');
const ragLoopResilienceManager = require('../services/ragLoopResilienceManager');
const ollamaService = require('../services/ollama');
const providerLock = require('../services/providerLock');
const ragLogger = require('../utils/ragLogger');

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
jest.mock('../services/policyQuestionBuilder', () => ({
  build: jest.fn()
}));
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

describe('PolicyEngine -> AI flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();

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

    const aiSpy = jest.spyOn(classificationService, 'aiClassify').mockResolvedValue({
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
    jest.spyOn(classificationService, 'aiClassify').mockResolvedValue({
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

  test('should use default scores and weights when policyResult is missing', async () => {
    policyEngine.evaluateItem.mockResolvedValue({
      action: 'manual',
      confidence: 0,
      ranked: []
    });

    // Mock confidence calculator to avoid undefined error
    confidenceCalculator.calculate.mockReturnValue({ confidence: 50, suggestedLibrary: null });
    confidenceCalculator.toAIContext.mockReturnValue('');

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
  });
});

describe('Issue 275 rag loop orchestration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ragLoopResilienceManager.reset();
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

  test('shadow mode remains non-invasive while attaching trace', async () => {
    jest.spyOn(classificationService, 'getRagLoopConfig').mockResolvedValue(buildRagConfig('shadow'));

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
    jest.spyOn(classificationService, 'getRagLoopConfig').mockResolvedValue(buildRagConfig('apply'));

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

  test('policy-first trigger fails open with deterministic guard reason when tmdb mapping is missing', async () => {
    jest.spyOn(classificationService, 'getRagLoopConfig').mockResolvedValue(buildRagConfig('apply'));

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

  test('skips second pass when policy prompt risk is clear and confidence already exceeds auto threshold', async () => {
    jest.spyOn(classificationService, 'getRagLoopConfig').mockResolvedValue({
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
    jest.spyOn(classificationService, 'getRagLoopConfig').mockResolvedValue({
      ...buildRagConfig('apply'),
      rag_loop_retry_backoff_ms: 1
    });

    let pass1Attempts = 0;
    jest.spyOn(classificationService, 'withTimeout').mockImplementation(async (operationOrPromise, timeoutMs, timeoutMessage = 'operation_timeout') => {
      if (timeoutMessage === 'rag_pass1_candidate_timeout') {
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

      if (
        timeoutMessage === 'rag_pass2_hybrid_timeout' ||
        timeoutMessage === 'rag_pass2_semantic_timeout' ||
        timeoutMessage === 'rag_pass2_candidate_timeout'
      ) {
        return [];
      }

      if (timeoutMessage === 'policy_recheck_timeout') {
        return {
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
      }

      if (typeof operationOrPromise === 'function') {
        return operationOrPromise(null);
      }
      return operationOrPromise;
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
    jest.spyOn(classificationService, 'getRagLoopConfig').mockResolvedValue({
      ...buildRagConfig('apply'),
      rag_loop_retry_backoff_ms: 1
    });

    let pass2Attempts = 0;
    jest.spyOn(classificationService, 'withTimeout').mockImplementation(async (operationOrPromise, timeoutMs, timeoutMessage = 'operation_timeout') => {
      if (timeoutMessage === 'rag_pass1_candidate_timeout') {
        return [
          { libraryId: 1, libraryName: 'Movies', similarity: 0.64 },
          { libraryId: 2, libraryName: 'Family', similarity: 0.63 }
        ];
      }

      if (timeoutMessage === 'rag_pass2_hybrid_timeout') {
        pass2Attempts += 1;
        throw new Error('Ollama provider unavailable');
      }

      if (timeoutMessage === 'rag_pass2_candidate_timeout') {
        return [];
      }

      if (timeoutMessage === 'policy_recheck_timeout') {
        return {
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
      }

      if (typeof operationOrPromise === 'function') {
        return operationOrPromise(null);
      }
      return operationOrPromise;
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
    jest.spyOn(classificationService, 'getRagLoopConfig').mockResolvedValue(buildRagConfig('apply'));

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

  test('scoped rag_pass2 breaker skip is fail-open and traceable', async () => {
    const config = buildRagConfig('shadow');
    jest.spyOn(classificationService, 'getRagLoopConfig').mockResolvedValue(config);

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
    jest.spyOn(classificationService, 'getRagLoopConfig').mockResolvedValue(config);
    const aiClassifySpy = jest.spyOn(classificationService, 'aiClassify');

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

  test('treats schema mismatch during policy recheck as fail-open and traceable', async () => {
    const config = {
      ...buildRagConfig('apply'),
      policy_recheck_max_ai_calls_per_item: 1
    };
    jest.spyOn(classificationService, 'getRagLoopConfig').mockResolvedValue(config);

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

describe('AI availability fallback handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ragLoopResilienceManager.reset();

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

    jest.spyOn(classificationService, 'aiClassify').mockRejectedValue(
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
    jest.spyOn(classificationService, 'aiClassify').mockRejectedValue(incompleteError);

    const result = await classificationService.classify({
      media: { media_type: 'movie', tmdbId: 123 }
    });

    expect(result.success).toBe(true);
    expect(result.method).toBe('queued_for_retry');
    expect(result.reason).toBe('AI stream ended before completion signal - queued for retry');
    expect(result.retry_reason_code).toBe('ai_stream_incomplete');
  });

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

  test('repairs incident-style malformed prose into valid classify contract response', async () => {
    const malformed = 'The media item is an animated family comedy with science fiction elements. The profile shows a strong presence of Animation and Family genres. The RAG data suggests similar movies have been classified';
    jest.spyOn(ollamaService, 'generateWithProgress').mockResolvedValue(malformed);
    jest.spyOn(ollamaService, 'generate').mockResolvedValue(
      'CONFIDENT|2|85|Animated family comedy profile aligns with Family library.'
    );

    const result = await classificationService.aiClassify(metadata, libraries, signalContext, {
      mode: 'classify'
    });

    expect(result.format).toBe('confident');
    expect(result.library).toEqual(libraries[1]);
    expect(result.parse_diagnostics).toEqual(expect.objectContaining({
      contract_version: 'phase1_v1',
      mode: 'classify',
      attempt_count: 2,
      repaired: true,
      repair_attempted: true,
      repair_succeeded: true
    }));

    expect(ollamaService.generate).toHaveBeenCalledTimes(1);
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
});
