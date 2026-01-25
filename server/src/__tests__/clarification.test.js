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

const clarificationService = require('../services/clarificationService');

// Mock database
jest.mock('../config/database', () => ({
  query: jest.fn(),
  pool: {
    connect: jest.fn(),
  },
}));

// Mock logger
jest.mock('../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

const db = require('../config/database');

describe('ClarificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getTierForConfidence', () => {
    test('should return auto tier for 95% confidence', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          tier: 'auto',
          min_confidence: 90,
          max_confidence: 100,
          action: 'auto_route',
          description: 'Automatically route without interaction',
        }],
      });

      const tier = await clarificationService.getTierForConfidence(95);

      expect(tier).toBeDefined();
      expect(tier.tier).toBe('auto');
      expect(tier.action).toBe('auto_route');
    });

    test('should return verify tier for 80% confidence', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          tier: 'verify',
          min_confidence: 70,
          max_confidence: 89,
          action: 'verify_buttons',
          description: 'Show Yes/No verification buttons',
        }],
      });

      const tier = await clarificationService.getTierForConfidence(80);

      expect(tier).toBeDefined();
      expect(tier.tier).toBe('verify');
      expect(tier.action).toBe('verify_buttons');
    });

    test('should return clarify tier for 60% confidence', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          tier: 'clarify',
          min_confidence: 50,
          max_confidence: 69,
          action: 'clarify_questions',
          description: 'Ask clarifying questions',
        }],
      });

      const tier = await clarificationService.getTierForConfidence(60);

      expect(tier).toBeDefined();
      expect(tier.tier).toBe('clarify');
    });

    test('should return manual tier for 40% confidence', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          tier: 'manual',
          min_confidence: 0,
          max_confidence: 49,
          action: 'manual_selection',
          description: 'Request manual library selection',
        }],
      });

      const tier = await clarificationService.getTierForConfidence(40);

      expect(tier).toBeDefined();
      expect(tier.tier).toBe('manual');
    });

    // New tests for v0.38.4-alpha fixes
    test('should round decimal confidence values (55.4 -> 55)', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          tier: 'clarify',
          min_confidence: 50,
          max_confidence: 69,
          action: 'clarify_questions',
          description: 'Ask clarifying questions',
        }],
      });

      const tier = await clarificationService.getTierForConfidence(55.4);

      expect(tier).toBeDefined();
      expect(tier.tier).toBe('clarify');
      // Verify the query was called with rounded value
      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [55] // Should be rounded
      );
    });

    test('should return fallback tier for low confidence when no tier found', async () => {
      // Mock no results from database
      db.query.mockResolvedValueOnce({
        rows: [],
      });

      const tier = await clarificationService.getTierForConfidence(55);

      expect(tier).toBeDefined();
      expect(tier.tier).toBe('clarify');
      expect(tier.action).toBe('clarify_questions');
      expect(tier.description).toBe('Requires clarification');
      expect(tier.min_confidence).toBe(50);
      expect(tier.max_confidence).toBe(69);
    });

    test('should return fallback auto tier for high confidence when no tier found', async () => {
      // Mock no results from database
      db.query.mockResolvedValueOnce({
        rows: [],
      });

      const tier = await clarificationService.getTierForConfidence(85);

      // Should return fallback auto tier for high-confidence items
      expect(tier).not.toBeNull();
      expect(tier.tier).toBe('auto');
      expect(tier.action).toBe('auto_route');
      expect(tier.description).toBe('High confidence - auto route');
      expect(tier.min_confidence).toBe(70);
      expect(tier.max_confidence).toBe(100);
    });

    test('should handle exact boundary values (50%, 69%, 70%)', async () => {
      // Test 50% (lower boundary of clarify tier)
      db.query.mockResolvedValueOnce({
        rows: [{
          tier: 'clarify',
          min_confidence: 50,
          max_confidence: 69,
          action: 'clarify_questions',
        }],
      });
      let tier = await clarificationService.getTierForConfidence(50);
      expect(tier.tier).toBe('clarify');

      // Test 69% (upper boundary of clarify tier)
      db.query.mockResolvedValueOnce({
        rows: [{
          tier: 'clarify',
          min_confidence: 50,
          max_confidence: 69,
          action: 'clarify_questions',
        }],
      });
      tier = await clarificationService.getTierForConfidence(69);
      expect(tier.tier).toBe('clarify');

      // Test 70% (lower boundary of verify tier)
      db.query.mockResolvedValueOnce({
        rows: [{
          tier: 'verify',
          min_confidence: 70,
          max_confidence: 89,
          action: 'verify_buttons',
        }],
      });
      tier = await clarificationService.getTierForConfidence(70);
      expect(tier.tier).toBe('verify');
    });
  });

  describe('matchQuestions', () => {
    test('should match questions by keywords', async () => {
      const mockQuestions = [
        {
          id: 1,
          question_text: 'Is this a stand-up comedy special?',
          question_type: 'content_type',
          trigger_keywords: ['stand-up comedy', 'comedy special'],
          trigger_genres: ['Documentary', 'Comedy'],
          response_options: {},
          priority: 10,
          enabled: true,
        },
        {
          id: 2,
          question_text: 'Is this a concert film?',
          question_type: 'content_type',
          trigger_keywords: ['concert', 'live performance'],
          trigger_genres: ['Documentary', 'Music'],
          response_options: {},
          priority: 9,
          enabled: true,
        },
      ];

      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: mockQuestions,
        });

      const metadata = {
        keywords: ['stand-up comedy', 'recorded live'],
        genres: ['Documentary', 'Comedy'],
      };

      const questions = await clarificationService.matchQuestions(metadata, 2);

      expect(questions).toBeDefined();
      expect(questions.length).toBeGreaterThan(0);
      expect(questions[0].score).toBeGreaterThan(0);
    });

    test('should limit number of questions returned', async () => {
      const mockQuestions = [
        {
          id: 1,
          question_text: 'Question 1',
          question_type: 'content_type',
          trigger_keywords: ['keyword1'],
          trigger_genres: [],
          response_options: {},
          priority: 10,
          enabled: true,
        },
        {
          id: 2,
          question_text: 'Question 2',
          question_type: 'content_type',
          trigger_keywords: ['keyword2'],
          trigger_genres: [],
          response_options: {},
          priority: 9,
          enabled: true,
        },
        {
          id: 3,
          question_text: 'Question 3',
          question_type: 'content_type',
          trigger_keywords: ['keyword3'],
          trigger_genres: [],
          response_options: {},
          priority: 8,
          enabled: true,
        },
      ];

      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: mockQuestions,
        });

      const metadata = {
        keywords: ['keyword1', 'keyword2', 'keyword3'],
        genres: [],
      };

      const questions = await clarificationService.matchQuestions(metadata, 2);

      expect(questions.length).toBeLessThanOrEqual(2);
    });

    test('should suppress language question when original language is English', async () => {
      const mockQuestions = [
        {
          id: 10,
          question_text: 'What language is this content primarily in?',
          question_type: 'language',
          trigger_keywords: [],
          trigger_genres: [],
          response_options: {},
          priority: 5,
          enabled: true,
        },
      ];

      db.query.mockResolvedValueOnce({
        rows: mockQuestions,
      });

      const metadata = {
        keywords: [],
        genres: [],
        original_language: 'en',
      };

      const questions = await clarificationService.matchQuestions(metadata, 2);

      expect(questions).toHaveLength(0);
    });

    test('should allow language question when language is missing and policies use language presets', async () => {
      const mockQuestions = [
        {
          id: 10,
          question_text: 'What language is this content primarily in?',
          question_type: 'language',
          trigger_keywords: [],
          trigger_genres: [],
          response_options: {},
          priority: 5,
          enabled: true,
        },
      ];

      db.query
        .mockResolvedValueOnce({ rows: [{ exists: true }] })
        .mockResolvedValueOnce({ rows: mockQuestions });

      const metadata = {
        keywords: [],
        genres: [],
        original_language: null,
        media_type: 'movie',
      };

      const questions = await clarificationService.matchQuestions(metadata, 2);

      expect(questions).toHaveLength(1);
      expect(questions[0].question_type).toBe('language');
    });
  });

  describe('recordResponse', () => {
    test('should record response and calculate new confidence', async () => {
      const mockQuestion = {
        id: 1,
        response_options: {
          yes: { label: 'Yes', confidence_boost: 30 },
          no: { label: 'No', confidence_boost: -10 },
        },
      };

      db.query
        .mockResolvedValueOnce({ rows: [mockQuestion] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await clarificationService.recordResponse(
        1, // classificationId
        1, // questionId
        'yes',
        'discord-user-123',
        60 // confidenceBefore
      );

      expect(result.success).toBe(true);
      expect(result.confidenceAfter).toBe(90); // 60 + 30
      expect(result.shouldReclassify).toBe(true); // >= 70
    });

    test('should handle negative confidence boost', async () => {
      const mockQuestion = {
        id: 1,
        response_options: {
          no: { label: 'No', confidence_boost: -10 },
        },
      };

      db.query
        .mockResolvedValueOnce({ rows: [mockQuestion] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await clarificationService.recordResponse(
        1,
        1,
        'no',
        'discord-user-123',
        70
      );

      expect(result.success).toBe(true);
      expect(result.confidenceAfter).toBe(60); // 70 - 10
    });

    test('should not exceed 100% confidence', async () => {
      const mockQuestion = {
        id: 1,
        response_options: {
          yes: { label: 'Yes', confidence_boost: 30 },
        },
      };

      db.query
        .mockResolvedValueOnce({ rows: [mockQuestion] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await clarificationService.recordResponse(
        1,
        1,
        'yes',
        'discord-user-123',
        95
      );

      expect(result.confidenceAfter).toBeLessThanOrEqual(100);
    });

    test('should not go below 0% confidence', async () => {
      const mockQuestion = {
        id: 1,
        response_options: {
          no: { label: 'No', confidence_boost: -50 },
        },
      };

      db.query
        .mockResolvedValueOnce({ rows: [mockQuestion] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await clarificationService.recordResponse(
        1,
        1,
        'no',
        'discord-user-123',
        30
      );

      expect(result.confidenceAfter).toBeGreaterThanOrEqual(0);
    });
  });

  describe('isRequireAllConfirmationsEnabled', () => {
    test('should return true when setting is enabled', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ value: 'true' }],
      });

      const result = await clarificationService.isRequireAllConfirmationsEnabled();

      expect(result).toBe(true);
      expect(db.query).toHaveBeenCalledWith(
        "SELECT value FROM settings WHERE key = 'require_all_confirmations'"
      );
    });

    test('should return false when setting is disabled', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ value: 'false' }],
      });

      const result = await clarificationService.isRequireAllConfirmationsEnabled();

      expect(result).toBe(false);
    });

    test('should return false when setting does not exist', async () => {
      db.query.mockResolvedValueOnce({
        rows: [],
      });

      const result = await clarificationService.isRequireAllConfirmationsEnabled();

      expect(result).toBe(false);
    });

    test('should return false on database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const result = await clarificationService.isRequireAllConfirmationsEnabled();

      expect(result).toBe(false);
    });
  });

  describe('resolvePolicyQuestion - v0.39.7b Bug Fix', () => {
    test('should handle policy_question as JSONB object from database', async () => {
      const mockClassification = {
        id: 1,
        title: 'Test Movie',
        media_type: 'movie',
        library_name: 'Movies',
        policy_question: {
          question: 'Is this a documentary?',
          options: ['Yes', 'No']
        },
        metadata: JSON.stringify({
          tmdb_id: 12345,
          title: 'Test Movie'
        })
      };

      // Mock the client for transaction
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [mockClassification] }) // Get classification
          .mockResolvedValueOnce({ rows: [] }) // UPDATE classification
          .mockResolvedValueOnce({ 
            rows: [{ 
              id: 1, 
              tmdb_id: 12345, 
              library_id: 2,
              pattern_type: 'exact_match',
              confidence: 100 
            }] 
          }) // INSERT learning pattern
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn()
      };

      db.pool.connect.mockResolvedValueOnce(mockClient);

      const result = await clarificationService.resolvePolicyQuestion(
        1, // classificationId
        2, // selectedLibraryId
        'No', // selectedOption
        'test-user',
        true // generateRule
      );

      expect(result.success).toBe(true);
      expect(result.classificationId).toBe(1);
      expect(result.libraryId).toBe(2);
      
      // Verify that the learning pattern was created with correct metadata
      const learningPatternCall = mockClient.query.mock.calls.find(call => 
        call[0] && call[0].includes('INSERT INTO learning_patterns')
      );
      expect(learningPatternCall).toBeDefined();
      
      // Parse the metadata parameter
      const metadataParam = JSON.parse(learningPatternCall[1][3]);
      expect(metadataParam.original_question).toBe('Is this a documentary?');
      expect(metadataParam.selected_option).toBe('No');
    });

    test('should handle policy_question as string (legacy data)', async () => {
      const mockClassification = {
        id: 1,
        title: 'Test Movie',
        media_type: 'movie',
        library_name: 'Movies',
        policy_question: '{"question":"Is this a documentary?","options":["Yes","No"]}',
        metadata: JSON.stringify({
          tmdb_id: 12345,
          title: 'Test Movie'
        })
      };

      // Mock the client for transaction
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [mockClassification] }) // Get classification
          .mockResolvedValueOnce({ rows: [] }) // UPDATE classification
          .mockResolvedValueOnce({ 
            rows: [{ 
              id: 1, 
              tmdb_id: 12345, 
              library_id: 2,
              pattern_type: 'exact_match',
              confidence: 100 
            }] 
          }) // INSERT learning pattern
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn()
      };

      db.pool.connect.mockResolvedValueOnce(mockClient);

      const result = await clarificationService.resolvePolicyQuestion(
        1, // classificationId
        2, // selectedLibraryId
        'No', // selectedOption
        'test-user',
        true // generateRule
      );

      expect(result.success).toBe(true);
      
      // Verify that the learning pattern was created with correct metadata
      const learningPatternCall = mockClient.query.mock.calls.find(call => 
        call[0] && call[0].includes('INSERT INTO learning_patterns')
      );
      expect(learningPatternCall).toBeDefined();
      
      // Parse the metadata parameter
      const metadataParam = JSON.parse(learningPatternCall[1][3]);
      expect(metadataParam.original_question).toBe('Is this a documentary?');
      expect(metadataParam.selected_option).toBe('No');
    });

    test('should handle null policy_question gracefully', async () => {
      const mockClassification = {
        id: 1,
        title: 'Test Movie',
        media_type: 'movie',
        library_name: 'Movies',
        policy_question: null,
        metadata: JSON.stringify({
          tmdb_id: 12345,
          title: 'Test Movie'
        })
      };

      // Mock the client for transaction
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [mockClassification] }) // Get classification
          .mockResolvedValueOnce({ rows: [] }) // UPDATE classification
          .mockResolvedValueOnce({ 
            rows: [{ 
              id: 1, 
              tmdb_id: 12345, 
              library_id: 2,
              pattern_type: 'exact_match',
              confidence: 100 
            }] 
          }) // INSERT learning pattern
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn()
      };

      db.pool.connect.mockResolvedValueOnce(mockClient);

      const result = await clarificationService.resolvePolicyQuestion(
        1,
        2,
        'Option',
        'test-user',
        true
      );

      expect(result.success).toBe(true);
      
      // Verify that the metadata was created with null original_question
      const learningPatternCall = mockClient.query.mock.calls.find(call => 
        call[0] && call[0].includes('INSERT INTO learning_patterns')
      );
      expect(learningPatternCall).toBeDefined();
      
      const metadataParam = JSON.parse(learningPatternCall[1][3]);
      expect(metadataParam.original_question).toBeNull();
    });

    test('should handle invalid policy_question string gracefully', async () => {
      const mockClassification = {
        id: 1,
        title: 'Test Movie',
        media_type: 'movie',
        library_name: 'Movies',
        policy_question: '[object Object]',
        metadata: JSON.stringify({
          tmdb_id: 12345,
          title: 'Test Movie'
        })
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [mockClassification] }) // Get classification
          .mockResolvedValueOnce({ rows: [] }) // UPDATE classification
          .mockResolvedValueOnce({ 
            rows: [{ 
              id: 1, 
              tmdb_id: 12345, 
              library_id: 2,
              pattern_type: 'exact_match',
              confidence: 100 
            }] 
          }) // INSERT learning pattern
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn()
      };

      db.pool.connect.mockResolvedValueOnce(mockClient);

      const result = await clarificationService.resolvePolicyQuestion(
        1,
        2,
        'Option',
        'test-user',
        true
      );

      expect(result.success).toBe(true);

      const learningPatternCall = mockClient.query.mock.calls.find(call =>
        call[0] && call[0].includes('INSERT INTO learning_patterns')
      );
      expect(learningPatternCall).toBeDefined();

      const metadataParam = JSON.parse(learningPatternCall[1][3]);
      expect(metadataParam.original_question).toBeNull();
    });
  });
});
