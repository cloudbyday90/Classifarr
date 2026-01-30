/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
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
});
