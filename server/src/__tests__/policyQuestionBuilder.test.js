/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Tests for policy-driven clarification question builder.
 */

const policyQuestionBuilder = require('../services/policyQuestionBuilder');

jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

const db = require('../config/database');

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
        weights: { preset: 0.35, profile: 0.25, pattern: 0.15, rag: 0.15, history: 0.10 }
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
      policy_name: 'Movies Policy'
    }));
  });

  test('should generate a language conflict question when policyResult has languageConflicts', async () => {
    // Ne Zha 2 scenario: Anime Movies (requires 'ja') was hard-blocked because
    // the film is Chinese ('zh'). policyEngine passes this as a languageConflict.
    // The question should surface the conflict, not ask about themes.
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
    // Anime Movies should be one of the presented options
    expect(result.options.some(o => o.library_name === 'Anime Movies')).toBe(true);
    // Ranked candidate order must be preserved in options and metadata
    expect(result.options[0].library_name).toBe('Family');
    expect(result.meta.candidates[0].library_name).toBe('Family');
    expect(result.meta.primary_candidate_library_name).toBe('Family');
    expect(result.meta.question_anchor_library_name).toBe('Family');
    expect(result.meta.question_anchor_reason).toBe('primary_candidate');
    // All options must have real library_id values (no nulls)
    expect(result.options.every(o => o.library_id != null)).toBe(true);
  });

  test('should generate a language conflict question covering all conflicts when multiple libraries require different languages', async () => {
    // Two libraries both require Japanese; the Chinese item conflicts with both.
    // The question should mention both libraries and offer valid options for all.
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
    // Multi-conflict path: question should mention both conflicting library names
    expect(result.question).toContain('Anime Movies');
    expect(result.question).toContain('Anime Classics');
    expect(result.question).toContain('Movies');
    // All options must have real library_id values
    expect(result.options.every(o => o.library_id != null)).toBe(true);
    // Both conflict libraries should appear in options
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

  test('should generate a language mismatch question when known language conflicts with active candidate presets', async () => {
    // Scenario: Anime Movies IS in ranked candidates (preset scored it via genre only,
    // language preset not attached), but its policy's presets have language: { require_any: ['ja'] }.
    // The known language 'zh' doesn't match. Should ask which library, not a broken Yes/No.
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
    // Should NOT ask "Is this Japanese content? Yes → Anime Movies"
    expect(result.question).not.toContain('Japanese');

    jest.restoreAllMocks();
  });

  test('should format expanded language codes using human-readable labels', () => {
    // Regression guard: LANGUAGE_LABELS now covers all common ISO 639-1 codes.
    // These must return readable names, not raw uppercase fallback strings.
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

    // Unknown codes should still fall back gracefully (uppercase)
    expect(policyQuestionBuilder.formatLanguage('xx')).toBe('XX');
    // Null / undefined should return the default label
    expect(policyQuestionBuilder.formatLanguage(null)).toBe('non-English');
  });
});
