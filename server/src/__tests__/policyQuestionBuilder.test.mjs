/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Tests for policy-driven clarification question builder.
 */

import { jest } from '@jest/globals';

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

const mockDb = { query: jest.fn() };

jest.unstable_mockModule('../config/database.mjs', () => ({
  ...mockDb,
  default: mockDb,
}));

jest.unstable_mockModule('../utils/logger.mjs', () => ({
  createLogger: () => mockLogger,
}));

const { policyQuestionBuilder } = await import('../services/policyQuestionBuilder.mjs');
const db = mockDb;

describe('PolicyQuestionBuilder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should fall back to library selection when no presets exist', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const libraries = [
      { id: 1, name: 'Movies', media_type: 'movie' },
      { id: 2, name: 'Family', media_type: 'movie' },
    ];

    const result = await policyQuestionBuilder.build({
      metadata: { title: 'Test Movie', media_type: 'movie' },
      policyResult: {
        ranked: [{ library_id: 1, library_name: 'Movies', score: 45, policy_id: 11, policy_name: 'Movies Policy' }]
      },
      libraries
    });

    expect(result).toBeDefined();
    expect(result.problem_summary).toBe('Manual selection needed');
    expect(result.options.length).toBeGreaterThan(0);
  });

  test('should ask a language question when language is missing and presets include language signals', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{
        policy_id: 11,
        preset_id: 201,
        preset_name: 'Anime',
        signals: { language: { require_any: ['ja'] } },
        custom_signals: null,
      }]
    });

    const libraries = [
      { id: 1, name: 'Anime Movies', media_type: 'movie' },
      { id: 2, name: 'Movies', media_type: 'movie' },
    ];

    const result = await policyQuestionBuilder.build({
      metadata: { title: 'Test Movie', media_type: 'movie', original_language: null },
      policyResult: {
        ranked: [
          { library_id: 1, library_name: 'Anime Movies', score: 52, policy_id: 11, policy_name: 'Anime Movies Policy' },
          { library_id: 2, library_name: 'Movies', score: 48, policy_id: 12, policy_name: 'Movies Policy' }
        ]
      },
      libraries
    });

    expect(result).toBeDefined();
    expect(result.question.toLowerCase()).toContain('language');
    expect(result.options.length).toBe(2);
  });

  test('should skip language question when original_language is English', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{
        policy_id: 11,
        preset_id: 201,
        preset_name: 'Anime',
        signals: { language: { require_any: ['ja'] } },
        custom_signals: null,
      }]
    });

    const libraries = [
      { id: 1, name: 'Anime Movies', media_type: 'movie' },
      { id: 2, name: 'Movies', media_type: 'movie' },
    ];

    const result = await policyQuestionBuilder.build({
      metadata: { title: 'Test Movie', media_type: 'movie', original_language: 'en' },
      policyResult: {
        ranked: [
          { library_id: 1, library_name: 'Anime Movies', score: 52, policy_id: 11, policy_name: 'Anime Movies Policy' },
          { library_id: 2, library_name: 'Movies', score: 48, policy_id: 12, policy_name: 'Movies Policy' }
        ]
      },
      libraries
    });

    expect(result).toBeDefined();
    expect(result.problem_summary.toLowerCase()).not.toContain('language');
  });

  test('should include enriched metadata in policy question payload', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{
        policy_id: 11,
        preset_id: 201,
        preset_name: 'Action',
        signals: { genres: { require_any: ['action'] } },
        custom_signals: null,
      }]
    });

    const libraries = [
      { id: 1, name: 'Movies', media_type: 'movie' },
      { id: 2, name: 'Family', media_type: 'movie' },
    ];

    const policyResult = {
      ranked: [{
        library_id: 1,
        library_name: 'Movies',
        score: 55,
        policy_id: 11,
        policy_name: 'Movies Policy',
        scores: { preset: 60, profile: 50, pattern: 20, rag: 40, history: 10 },
        weights: { preset: 0.35, profile: 0.25, pattern: 0.15, rag: 0.15, history: 0.10 },
        candidate_diagnostics: {
          primary_viability: 'multi_source_support',
          positive_sources: { preset: 'compatibility', profile: true, pattern: true, rag: true, history: true },
          drivers: ['compatibility_only', 'profile_supported', 'pattern_supported', 'rag_improved', 'history_supported'],
          agreement_boosted: false
        }
      }]
    };

    const result = await policyQuestionBuilder.build({
      metadata: {
        title: 'Test Movie',
        media_type: 'movie',
        original_language: 'en',
        genres: ['Action', 'Thriller'],
        keywords: ['test', 'action', 'hero']
      },
      policyResult,
      libraries,
      ragContext: {
        similarItems: [
          { title: 'Similar Movie', libraryName: 'Movies', similarity: 0.82 }
        ]
      },
      aiResult: {
        reason: 'AI saw mixed signals between candidates.'
      }
    });

    expect(result).toBeDefined();
    expect(result.meta.policy_scores).toEqual(policyResult.ranked[0].scores);
    expect(result.meta.policy_weights).toEqual(policyResult.ranked[0].weights);
    expect(result.meta.ai_rationale).toBe('AI saw mixed signals between candidates.');
    expect(result.meta.rag_summary).toEqual([
      { title: 'Similar Movie', library: 'Movies', similarity: 0.82 }
    ]);
    expect(result.meta.tags.genres).toEqual(['Action', 'Thriller']);
    expect(result.meta.tags.keywords).toEqual(['test', 'action', 'hero']);
    expect(result.meta.candidates[0]).toEqual(expect.objectContaining({
      library_id: 1,
      library_name: 'Movies',
      score: 55,
      policy_id: 11,
      policy_name: 'Movies Policy',
      candidate_diagnostics: expect.objectContaining({
        primary_viability: 'multi_source_support'
      })
    }));
    expect(result.meta.candidate_diagnostics).toEqual(expect.objectContaining({
      primary_viability: 'multi_source_support'
    }));
  });

  test('should normalize object-shaped tags in policy question payload metadata', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{
        policy_id: 11,
        preset_id: 201,
        preset_name: 'Action',
        signals: { genres: { require_any: ['action'] } },
        custom_signals: null,
      }]
    });

    const libraries = [
      { id: 1, name: 'Movies', media_type: 'movie' },
      { id: 2, name: 'Family', media_type: 'movie' },
    ];

    const result = await policyQuestionBuilder.build({
      metadata: {
        title: 'Test Movie',
        media_type: 'movie',
        genres: [{ id: 1, name: 'Action' }],
        keywords: [{ id: 2, name: 'Hero' }, { id: 3, name: 'Villain' }]
      },
      policyResult: {
        ranked: [{
          library_id: 1,
          library_name: 'Movies',
          score: 45,
          policy_id: 11,
          policy_name: 'Movies Policy',
          scores: {},
          weights: {}
        }]
      },
      libraries
    });

    expect(result).toBeDefined();
    expect(result.meta.tags.genres).toEqual(['Action']);
    expect(result.meta.tags.keywords).toEqual(['Hero', 'Villain']);
  });

  test('should generate a language conflict question when policyResult has languageConflicts', async () => {
    const libraries = [
      { id: 11, name: 'Anime Movies', media_type: 'movie' },
      { id: 14, name: 'Family', media_type: 'movie' },
      { id: 15, name: 'Movies', media_type: 'movie' },
    ];

    const policyResult = {
      ranked: [
        { library_id: 14, library_name: 'Family', score: 52, policy_id: 2, policy_name: 'Family Policy', scores: {}, weights: {} },
        { library_id: 15, library_name: 'Movies', score: 48, policy_id: 3, policy_name: 'Movies Policy', scores: {}, weights: {} },
      ],
      languageConflicts: [
        {
          policy_id: 1,
          policy_name: 'Anime Movies Policy',
          library_id: 11,
          library_name: 'Anime Movies',
          score: 0,
          required_languages: ['ja'],
          item_language: 'zh',
        }
      ]
    };

    const result = await policyQuestionBuilder.build({
      metadata: {
        title: 'Ne Zha 2',
        media_type: 'movie',
        original_language: 'zh',
        genres: ['Animation', 'Action', 'Fantasy'],
      },
      policyResult,
      libraries,
    });

    expect(result).toBeDefined();
    expect(result.problem_summary).toBe('Language conflict');
    expect(result.question).toContain('Chinese');
    expect(result.question).toContain('Anime Movies');
    expect(result.question).toContain('Japanese');
    expect(result.question).toContain('Family');
    expect(result.options.some(o => o.library_name === 'Anime Movies')).toBe(true);
    expect(result.options[0].library_name).toBe('Family');
    expect(result.meta.candidates[0].library_name).toBe('Family');
    expect(result.meta.primary_candidate_library_name).toBe('Family');
    expect(result.meta.question_anchor_library_name).toBe('Family');
    expect(result.meta.question_anchor_reason).toBe('primary_candidate');
    expect(result.options.every(o => o.library_id != null)).toBe(true);
  });

  test('should generate a language conflict question covering all conflicts when multiple libraries require different languages', async () => {
    const libraries = [
      { id: 11, name: 'Anime Movies', media_type: 'movie' },
      { id: 12, name: 'Anime Classics', media_type: 'movie' },
      { id: 15, name: 'Movies', media_type: 'movie' },
    ];

    const policyResult = {
      ranked: [
        { library_id: 15, library_name: 'Movies', score: 45, policy_id: 3, policy_name: 'Movies Policy', scores: {}, weights: {} },
      ],
      languageConflicts: [
        {
          policy_id: 1,
          policy_name: 'Anime Movies Policy',
          library_id: 11,
          library_name: 'Anime Movies',
          score: 0,
          required_languages: ['ja'],
          item_language: 'zh',
        },
        {
          policy_id: 2,
          policy_name: 'Anime Classics Policy',
          library_id: 12,
          library_name: 'Anime Classics',
          score: 0,
          required_languages: ['ja'],
          item_language: 'zh',
        },
      ]
    };

    const result = await policyQuestionBuilder.build({
      metadata: {
        title: 'Detective Conan Movie',
        media_type: 'movie',
        original_language: 'zh',
        genres: ['Animation'],
      },
      policyResult,
      libraries,
    });

    expect(result).toBeDefined();
    expect(result.problem_summary).toBe('Language conflict');
    expect(result.question).toContain('Chinese');
    expect(result.question).toContain('Anime Movies');
    expect(result.question).toContain('Anime Classics');
    expect(result.question).toContain('Movies');
    expect(result.options.every(o => o.library_id != null)).toBe(true);
    const optionIds = result.options.map(o => o.library_id);
    expect(optionIds).toContain(11);
    expect(optionIds).toContain(12);
    expect(result.options[0].library_name).toBe('Movies');
    expect(result.meta.primary_candidate_library_name).toBe('Movies');
    expect(result.meta.question_anchor_library_name).toBe('Movies');
  });

  test('should preserve ranked candidate as option 1 for lower-ranked multi-language conflicts', async () => {
    const libraries = [
      { id: 56, name: 'Comedy and Standup', media_type: 'movie' },
      { id: 57, name: 'Family', media_type: 'movie' },
      { id: 58, name: 'Movies', media_type: 'movie' },
    ];

    const policyResult = {
      ranked: [
        { library_id: 58, library_name: 'Movies', score: 11.06, policy_id: 29, policy_name: 'Movies Policy', scores: {}, weights: {} },
        { library_id: 57, library_name: 'Family', score: 8, policy_id: 28, policy_name: 'Family Policy', scores: {}, weights: {} },
      ],
      languageConflicts: [
        {
          policy_id: 27,
          policy_name: 'Comedy and Standup Policy',
          library_id: 56,
          library_name: 'Comedy and Standup',
          score: 0,
          required_languages: ['sv', 'no', 'da', 'fi'],
          item_language: 'ka',
        }
      ]
    };

    const result = await policyQuestionBuilder.build({
      metadata: {
        title: 'Taming the Garden',
        media_type: 'movie',
        original_language: 'ka',
        genres: ['Documentary'],
      },
      policyResult,
      libraries,
    });

    expect(result).toBeDefined();
    expect(result.problem_summary).toBe('Language conflict');
    expect(result.options[0].library_name).toBe('Movies');
    expect(result.meta.candidates[0].library_name).toBe('Movies');
    expect(result.meta.primary_candidate_library_name).toBe('Movies');
    expect(result.meta.question_anchor_library_name).toBe('Movies');
    expect(result.meta.question_anchor_reason).toBe('primary_candidate');
    expect(result.question).toContain('Movies');
    expect(result.question).toContain('Swedish/Norwegian/Danish/Finnish');
    expect(result.why_uncertain).toContain('Swedish/Norwegian/Danish/Finnish');
  });

  test('should keep named conflict libraries in options even when ranked fallbacks would otherwise fill the first three slots', async () => {
    const libraries = [
      { id: 11, name: 'Foreign Language', media_type: 'movie' },
      { id: 14, name: 'Movies', media_type: 'movie' },
      { id: 15, name: 'Family', media_type: 'movie' },
      { id: 16, name: 'Comedy', media_type: 'movie' },
    ];

    const policyResult = {
      ranked: [
        { library_id: 14, library_name: 'Movies', score: 52, policy_id: 2, policy_name: 'Movies Policy', scores: {}, weights: {} },
        { library_id: 15, library_name: 'Family', score: 48, policy_id: 3, policy_name: 'Family Policy', scores: {}, weights: {} },
        { library_id: 16, library_name: 'Comedy', score: 44, policy_id: 4, policy_name: 'Comedy Policy', scores: {}, weights: {} },
      ],
      languageConflicts: [
        {
          policy_id: 1,
          policy_name: 'Foreign Language Policy',
          library_id: 11,
          library_name: 'Foreign Language',
          score: 0,
          required_languages: ['fr'],
          item_language: 'en',
        }
      ]
    };

    const result = await policyQuestionBuilder.build({
      metadata: {
        title: 'Test Import',
        media_type: 'movie',
        original_language: 'en',
      },
      policyResult,
      libraries,
    });

    expect(result).toBeDefined();
    expect(result.question).toContain('Foreign Language');
    expect(result.options[0].library_name).toBe('Movies');
    expect(result.options.some(option => option.library_name === 'Foreign Language')).toBe(true);
    expect(result.options.some(option => option.library_name === 'Comedy')).toBe(false);
  });

  test('should generate a language mismatch question when known language conflicts with active candidate presets', async () => {
    const libraries = [
      { id: 11, name: 'Anime Movies', media_type: 'movie' },
      { id: 14, name: 'Family', media_type: 'movie' },
    ];

    jest.spyOn(policyQuestionBuilder, 'getPresetsByPolicy').mockResolvedValueOnce({
      1: [{ preset_id: 10, preset_name: 'Anime', signals: { language: { require_any: ['ja'] } } }]
    });

    const policyResult = {
      ranked: [
        { library_id: 11, library_name: 'Anime Movies', score: 40, policy_id: 1, policy_name: 'Anime Movies Policy', scores: {}, weights: {} },
        { library_id: 14, library_name: 'Family', score: 35, policy_id: 2, policy_name: 'Family Policy', scores: {}, weights: {} },
      ],
      languageConflicts: [],
    };

    const result = await policyQuestionBuilder.build({
      metadata: {
        title: 'Ne Zha 2',
        media_type: 'movie',
        original_language: 'zh',
        genres: ['Animation'],
      },
      policyResult,
      libraries,
    });

    expect(result).toBeDefined();
    expect(result.problem_summary).toBe('Language mismatch');
    expect(result.question).toContain('Chinese');
    expect(result.why_uncertain).toContain('Anime Movies');
    expect(result.why_uncertain).toContain('Japanese');
    expect(result.question).not.toContain('Japanese');

    jest.restoreAllMocks();
  });

  test('should generate a language conflict question for English strict exclude conflicts', async () => {
    const libraries = [
      { id: 21, name: 'Movies', media_type: 'movie' },
      { id: 22, name: 'Foreign Language', media_type: 'movie' },
    ];

    const policyResult = {
      ranked: [
        { library_id: 21, library_name: 'Movies', score: 58, policy_id: 2, policy_name: 'Movies Policy', scores: {}, weights: {} },
      ],
      languageConflicts: [
        {
          policy_id: 1,
          policy_name: 'Foreign Language Policy',
          library_id: 22,
          library_name: 'Foreign Language',
          score: 0,
          required_languages: [],
          excluded_languages: ['en'],
          item_language: 'en',
        }
      ]
    };

    const result = await policyQuestionBuilder.build({
      metadata: {
        title: 'English Drama',
        media_type: 'movie',
        original_language: 'en',
        genres: ['Drama'],
      },
      policyResult,
      libraries,
    });

    expect(result).toBeDefined();
    expect(result.problem_summary).toBe('Language conflict');
    expect(result.question).toContain('English');
    expect(result.question).toContain('Foreign Language');
    expect(result.options[0].library_name).toBe('Movies');
    expect(result.options.some(option => option.library_name === 'Foreign Language')).toBe(true);
    expect(result.meta.primary_candidate_library_name).toBe('Movies');
    expect(result.meta.question_anchor_library_name).toBe('Movies');
    expect(result.meta.question_anchor_reason).toBe('primary_candidate');
  });

  test('should format expanded language codes using human-readable labels', () => {
    const cases = [
      ['ar', 'Arabic'],
      ['tr', 'Turkish'],
      ['sv', 'Swedish'],
      ['nl', 'Dutch'],
      ['pl', 'Polish'],
      ['he', 'Hebrew'],
      ['fa', 'Farsi'],
      ['th', 'Thai'],
      ['vi', 'Vietnamese'],
      ['id', 'Indonesian'],
    ];

    for (const [code, expected] of cases) {
      expect(policyQuestionBuilder.formatLanguage(code)).toBe(expected);
    }

    expect(policyQuestionBuilder.formatLanguage('xx')).toBe('XX');
    expect(policyQuestionBuilder.formatLanguage(null)).toBe('non-English');
  });

  test('buildLanguageConflictQuestion returns null when original language is missing', () => {
    const result = policyQuestionBuilder.buildLanguageConflictQuestion(
      { title: 'Unknown Language', original_language: null },
      [],
      [{ library_id: 1, library_name: 'Anime Movies', required_languages: ['ja'] }]
    );

    expect(result).toBeNull();
  });

  test('buildLanguageConflictQuestion returns null when fewer than two options are available', () => {
    const result = policyQuestionBuilder.buildLanguageConflictQuestion(
      { title: 'Single Conflict', original_language: 'zh' },
      [],
      [{ library_id: 11, library_name: 'Anime Movies', required_languages: ['ja'] }]
    );

    expect(result).toBeNull();
  });

  test('buildLanguageConflictQuestion handles conflicts without a ranked top candidate', () => {
    const result = policyQuestionBuilder.buildLanguageConflictQuestion(
      { title: 'Manual Review', original_language: 'zh' },
      [],
      [
        { library_id: 11, library_name: 'Anime Movies', required_languages: ['ja'] },
        { library_id: 15, library_name: 'Movies', required_languages: ['en'] },
      ]
    );

    expect(result).toBeDefined();
    expect(result.question).toContain('This is Chinese content');
    expect(result.question).not.toContain('Top match is');
    expect(result.meta.question_anchor_reason).toBe('manual_review_required');
  });

  test('buildLanguageQuestion returns binary confirmation when language matches a candidate preset', () => {
    const candidates = [
      { library_id: 11, library_name: 'Anime Movies', library: { id: 11, name: 'Anime Movies' }, policy_id: 1 },
      { library_id: 15, library_name: 'Movies', library: { id: 15, name: 'Movies' }, policy_id: 2 },
    ];

    const result = policyQuestionBuilder.buildLanguageQuestion(
      { title: 'Japanese Film', original_language: 'ja' },
      candidates,
      {
        1: [{ signals: { language: { require_any: ['ja'] } } }],
        2: [{ signals: { language: { require_any: ['en'] } } }],
      }
    );

    expect(result).toBeDefined();
    expect(result.problem_summary).toBe('Language clarification');
    expect(result.question).toBe('Is this primarily Japanese language content?');
    expect(result.options[0].label).toContain('Anime Movies');
    expect(result.options[1].label).toContain('Movies');
    expect(result.meta.question_anchor_reason).toBe('primary_candidate');
  });

  test('buildLanguageQuestion falls back to manual selection when there is no alternative candidate', () => {
    const candidates = [
      { library_id: 11, library_name: 'Anime Movies', library: { id: 11, name: 'Anime Movies' }, policy_id: 1 },
    ];

    const result = policyQuestionBuilder.buildLanguageQuestion(
      { title: 'Japanese Film', original_language: 'ja' },
      candidates,
      {
        1: [{ signals: { language: { require_any: ['ja'] } } }],
      }
    );

    expect(result).toBeDefined();
    expect(result.problem_summary).toBe('Manual selection needed');
    expect(result.why_uncertain).toContain('no alternative library found');
  });

  test('buildCandidates falls back to suggested library and pads with remaining libraries', () => {
    const libraries = [
      { id: 1, name: 'Movies', media_type: 'movie' },
      { id: 2, name: 'Family', media_type: 'movie' },
      { id: 3, name: 'Anime Movies', media_type: 'movie' },
    ];

    const result = policyQuestionBuilder.buildCandidates(
      { ranked: [] },
      libraries,
      { id: 2, name: 'Family', media_type: 'movie' },
      3
    );

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual(expect.objectContaining({
      library_id: 2,
      library_name: 'Family',
      score: null
    }));
    expect(result.map(candidate => candidate.library_id)).toEqual([2, 1, 3]);
  });

  test('getPresetsByPolicy returns an empty object when preset lookup fails', async () => {
    db.query.mockRejectedValueOnce(new Error('db offline'));

    await expect(policyQuestionBuilder.getPresetsByPolicy([1, 2])).resolves.toEqual({});
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to load policy presets for clarification',
      expect.objectContaining({ error: 'db offline' })
    );
  });

  test('buildQuestionPayload does not warn when first option differs under a non-primary anchor reason', () => {
    const payload = policyQuestionBuilder.buildQuestionPayload(
      { title: 'Manual Override' },
      {
        problem_summary: 'Manual review',
        why_uncertain: 'Needs review',
        question: 'Pick a library',
        options: [
          { label: 'Family', value: 'family', library_id: 2, library_name: 'Family' },
          { label: 'Movies', value: 'movies', library_id: 1, library_name: 'Movies' },
        ],
        candidates: [
          {
            library_id: 1,
            library_name: 'Movies',
            library: { id: 1, name: 'Movies' },
            score: 50,
            policy_id: 11,
            policy_name: 'Movies Policy',
          }
        ],
        extras: {
          question_anchor_library: { id: 2, name: 'Family' },
          question_anchor_reason: 'manual_review_required',
        },
      }
    );

    expect(payload.meta.question_anchor_reason).toBe('manual_review_required');
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  test('buildQuestionPayload warns when primary candidate diverges from the first option', () => {
    policyQuestionBuilder.buildQuestionPayload(
      { title: 'Divergent Options' },
      {
        problem_summary: 'Review',
        why_uncertain: 'Conflict',
        question: 'Pick one',
        options: [
          { label: 'Family', value: 'family', library_id: 2, library_name: 'Family' },
          { label: 'Movies', value: 'movies', library_id: 1, library_name: 'Movies' },
        ],
        candidates: [
          {
            library_id: 1,
            library_name: 'Movies',
            library: { id: 1, name: 'Movies' },
            score: 90,
            policy_id: 11,
            policy_name: 'Movies Policy',
          }
        ],
      }
    );

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Policy question option order diverges from primary candidate',
      expect.objectContaining({
        title: 'Divergent Options',
        primaryCandidateLibraryId: 1,
        firstOptionLibraryId: 2,
      })
    );
  });

  test('buildLibrarySelectionQuestion returns null when there are no libraries to offer', () => {
    const result = policyQuestionBuilder.buildLibrarySelectionQuestion(
      { title: 'No Libraries' },
      [],
      { reason: 'Nothing available' }
    );

    expect(result).toBeNull();
  });

  test('getLanguagesForPolicy merges require, prefer, and exclude values as lowercase unique codes', () => {
    const languages = policyQuestionBuilder.getLanguagesForPolicy([
      { signals: { language: { require_any: ['JA'], prefer: ['en'], exclude: ['FR'] } } },
      { signals: { language: { require_any: ['ja', 'DE'] } } },
    ]);

    expect(languages.sort()).toEqual(['de', 'en', 'fr', 'ja']);
  });

  test('collectSignalTypes ignores media_type and empty signal configs', () => {
    const types = policyQuestionBuilder.collectSignalTypes(
      {
        1: [
          {
            signals: {
              media_type: { require_any: ['movie'] },
              genres: { require_any: ['Comedy'] },
              keywords: {},
            }
          }
        ]
      },
      [{ policy_id: 1 }]
    );

    expect(types).toEqual(['genres']);
  });

  test('formatLanguageList handles empty, single, and duplicate language codes', () => {
    expect(policyQuestionBuilder.formatLanguageList([])).toBe('non-English');
    expect(policyQuestionBuilder.formatLanguageList(['ja'])).toBe('Japanese');
    expect(policyQuestionBuilder.formatLanguageList(['ja', 'JA', 'en'])).toBe('Japanese/English');
  });

  test('toOption supplies safe defaults when label or library are missing', () => {
    expect(policyQuestionBuilder.toOption(null, null)).toEqual({
      label: 'Option',
      value: 'option',
      library_id: null,
      library_name: null
    });
  });

  test('filterLibrariesByMediaType returns all libraries when media type is missing', () => {
    const libraries = [
      { id: 1, name: 'Movies', media_type: 'movie' },
      { id: 2, name: 'TV', media_type: 'tv' },
    ];

    expect(policyQuestionBuilder.filterLibrariesByMediaType(libraries, null)).toEqual(libraries);
    expect(policyQuestionBuilder.filterLibrariesByMediaType(libraries, 'movie')).toEqual([libraries[0]]);
  });
});
