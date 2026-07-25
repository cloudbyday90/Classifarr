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
  createDbRowsResult,
  createMockLogger,
  createMockModule,
  createNamedMockModule,
  createServiceStubs,
  createTransactionalDbMock,
} from './helpers/mockFactory.mjs';
import {
  buildPolicyRuntimeQuestionReductionFromRuntimeInput,
} from '../services/policyRuntimeQuestionReduction.mjs';

const mockDb = createTransactionalDbMock();
const mockLogger = createMockLogger();
const mockLoggerObj = { createLogger: () => mockLogger };
const mockClassificationOutcomeService = createServiceStubs([], {
  recordOutcome: jest.fn().mockResolvedValue({ updated: true }),
});

jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));

jest.unstable_mockModule('../utils/logger.mjs', () => createMockModule(mockLoggerObj));

jest.unstable_mockModule('../services/classificationOutcomeService.mjs', () => createNamedMockModule('classificationOutcomeService', mockClassificationOutcomeService));

const db = mockDb;
const classificationOutcomeService = mockClassificationOutcomeService;
const { clarificationService } = await import('../services/clarificationService.mjs');

function getRequiredBindCount(sql) {
  if (typeof sql !== 'string') return 0;
  const matches = [...sql.matchAll(/\$(\d+)/g)];
  if (matches.length === 0) return 0;
  return Math.max(...matches.map(match => Number.parseInt(match[1], 10)));
}

function createStrictQueryMock(responses) {
  const queue = [...responses];
  return jest.fn(async (sql, params = []) => {
    const requiredBindCount = getRequiredBindCount(sql);
    const actualBindCount = Array.isArray(params) ? params.length : 0;
    if (requiredBindCount !== actualBindCount) {
      throw new Error(
        `Test query bind mismatch: expected ${requiredBindCount} params but received ${actualBindCount} for SQL: ${sql}`
      );
    }

    if (queue.length === 0) {
      throw new Error(`Unexpected query executed in test: ${sql}`);
    }

    return queue.shift();
  });
}

describe('ClarificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(mockLogger).forEach(mockFn => mockFn.mockClear());
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

  describe('getTierFromPolicyThresholds', () => {
    test('should return auto tier when confidence meets policy auto threshold', () => {
      const tier = clarificationService.getTierFromPolicyThresholds(
        85,
        { auto_classify_threshold: 85, prompt_threshold: 60 },
        false
      );

      expect(tier).toBeDefined();
      expect(tier.tier).toBe('auto');
      expect(tier.action).toBe('auto_route');
    });

    test('should return verify tier when confidence meets policy prompt threshold but not auto threshold', () => {
      const tier = clarificationService.getTierFromPolicyThresholds(
        75,
        { auto_classify_threshold: 85, prompt_threshold: 60 },
        false
      );

      expect(tier).toBeDefined();
      expect(tier.tier).toBe('verify');
      expect(tier.action).toBe('verify_buttons');
    });

    test('should return null when confidence is below policy prompt threshold (caller should fall back)', () => {
      const tier = clarificationService.getTierFromPolicyThresholds(
        55,
        { auto_classify_threshold: 85, prompt_threshold: 60 },
        false
      );

      expect(tier).toBeNull();
    });

    test('should not return auto tier when requireAllConfirmations is enabled', () => {
      const tier = clarificationService.getTierFromPolicyThresholds(
        95,
        { auto_classify_threshold: 85, prompt_threshold: 60 },
        true
      );

      // With confirmations required, we never return the auto tier.
      expect(tier).toBeDefined();
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
        .mockResolvedValueOnce(createDbRowsResult())
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
        .mockResolvedValueOnce(createDbRowsResult())
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
        .mockResolvedValueOnce(createDbRowsResult());

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
        .mockResolvedValueOnce(createDbRowsResult());

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
        .mockResolvedValueOnce(createDbRowsResult());

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
        .mockResolvedValueOnce(createDbRowsResult());

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
      db.query.mockResolvedValueOnce(createDbRowsResult());

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
    test('should handle classification.metadata as JSONB object', async () => {
      const mockClassification = {
        id: 1,
        title: 'Test Movie',
        media_type: 'movie',
        library_name: 'Movies',
        policy_question: '{"question":"Which library?","options":["Yes","No"]}',
        metadata: {
          tmdb_id: 12345,
          title: 'Test Movie'
        }
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(createDbRowsResult()) // BEGIN
          .mockResolvedValueOnce({ rows: [mockClassification] }) // Get classification
          .mockResolvedValueOnce({ rows: [{ id: 2, name: 'Movies', media_type: 'movie', is_active: true }] }) // selected library
          .mockResolvedValueOnce(createDbRowsResult()) // UPDATE classification
          .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Phase 7: INSERT classification_evidence (item_exact)
          .mockResolvedValueOnce(createDbRowsResult()), // COMMIT
        release: jest.fn()
      };

      db.pool.connect.mockResolvedValueOnce(mockClient);

      const result = await clarificationService.resolvePolicyQuestion(
        1,
        2,
        'Yes',
        'test-user',
        true
      );

      expect(result.success).toBe(true);

      const evidenceInsertCall = mockClient.query.mock.calls.find(call =>
        call[0] && call[0].includes('INSERT INTO classification_evidence') && call[1] && call[1][0] === 'item_exact'
      );
      expect(evidenceInsertCall).toBeDefined();

      const evidenceDataParam = JSON.parse(evidenceInsertCall[1][5]);
      expect(evidenceDataParam.selected_option).toBe('Yes');
      expect(classificationOutcomeService.recordOutcome).toHaveBeenCalledWith(1, expect.objectContaining({
        type: 'resolved',
        source: 'policy_question',
        actor: 'test-user',
        selected_option: 'Yes',
        final_library_id: 2,
        final_library_name: expect.any(String)
      }), { client: mockClient });
    });

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
          .mockResolvedValueOnce(createDbRowsResult()) // BEGIN
          .mockResolvedValueOnce({ rows: [mockClassification] }) // Get classification
          .mockResolvedValueOnce({ rows: [{ id: 2, name: 'Movies', media_type: 'movie', is_active: true }] }) // selected library
          .mockResolvedValueOnce(createDbRowsResult()) // UPDATE classification
          .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Phase 7: INSERT classification_evidence (item_exact)
          .mockResolvedValueOnce(createDbRowsResult()), // COMMIT
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
      
      // Verify that item_exact evidence was written with correct payload
      const evidenceInsertCall = mockClient.query.mock.calls.find(call => 
        call[0] && call[0].includes('INSERT INTO classification_evidence') && call[1] && call[1][0] === 'item_exact'
      );
      expect(evidenceInsertCall).toBeDefined();
      
      // Parse the evidenceData parameter (position 5 in upsertEvidence params)
      const evidenceDataParam = JSON.parse(evidenceInsertCall[1][5]);
      expect(evidenceDataParam.original_question).toBe('Is this a documentary?');
      expect(evidenceDataParam.selected_option).toBe('No');

      const updateCall = mockClient.query.mock.calls.find(call =>
        call[0] && call[0].includes('UPDATE classification_history')
      );
      expect(updateCall[0]).toContain('policy_question = NULL');
    });

    test('rejects malformed native runtime questions before any legacy rule path can run', async () => {
      const nativeQuestion = {
        version: 'policy.runtime_question_persistence.v1',
        question: 'Should this item be resolved here?',
        options: [{
          label: 'Resolve current item',
          outcomeId: 'resolve_current_item',
          library_id: 2,
        }],
        runtimeQuestion: {
          contractVersion: 'policy.runtime_question_reduction.v1',
        },
        runtimeQuestionReductionPlan: {
          version: 'policy.runtime_question_reduction.v1',
        },
        meta: {
          runtime_question_persistence: {
            destinationLibraryId: 2,
          },
        },
      };
      const mockClassification = {
        id: 1,
        title: 'Test Movie',
        media_type: 'movie',
        library_name: 'Movies',
        policy_question: nativeQuestion,
        metadata: JSON.stringify({
          tmdb_id: 12345,
          title: 'Test Movie',
        }),
      };
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(createDbRowsResult()) // BEGIN
          .mockResolvedValueOnce({ rows: [mockClassification] }) // Get classification
          .mockResolvedValueOnce({ rows: [{ id: 2, name: 'Movies', media_type: 'movie', is_active: true }] }) // selected library
          .mockResolvedValueOnce({ rows: [{ context_version: null }] }) // Question context
          .mockResolvedValueOnce(createDbRowsResult()) // UPDATE classification
          .mockResolvedValueOnce(createDbRowsResult()), // COMMIT
        release: jest.fn(),
      };

      db.pool.connect.mockResolvedValueOnce(mockClient);

      await expect(clarificationService.resolvePolicyQuestion(
        1,
        2,
        'Resolve current item',
        'test-user',
        true,
      )).rejects.toMatchObject({
        statusCode: 409,
        code: 'native_policy_question_invalid',
      });
      expect(mockClient.query.mock.calls.some(([sql]) =>
        typeof sql === 'string' && sql.includes('INSERT INTO classification_evidence')
      )).toBe(false);
    });

    test('persists native request-time provenance before the resolved outcome', async () => {
      const plan = buildPolicyRuntimeQuestionReductionFromRuntimeInput({
        libraryProfile: {
          identityCandidates: [{ label: 'Animation', count: 1, confidence: 0.6 }],
        },
        metadataSignals: [{ label: 'Family', confidence: 0.7 }],
      });
      const nativeQuestion = {
        version: 'policy.runtime_question_persistence.v1',
        question: plan.question.operatorQuestion,
        options: [
          {
            label: 'Resolve current item',
            outcomeId: 'resolve_current_item',
            library_id: 2,
          },
          {
            label: 'Do not learn',
            outcomeId: 'do_not_learn',
          },
        ],
        runtimeQuestion: plan.question,
        runtimeQuestionReductionPlan: plan,
        meta: {
          runtime_question_persistence: {
            destinationLibraryId: 2,
            destinationLibraryName: 'Movies',
          },
        },
      };
      const mockClassification = {
        id: 1,
        title: 'Test Movie',
        media_type: 'movie',
        library_name: 'Movies',
        policy_question: nativeQuestion,
        metadata: JSON.stringify({ tmdb_id: 12345, title: 'Test Movie' }),
      };
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(createDbRowsResult()) // BEGIN
          .mockResolvedValueOnce({ rows: [mockClassification] }) // Get classification
          .mockResolvedValueOnce({ rows: [{ id: 2, name: 'Movies', media_type: 'movie', is_active: true }] }) // selected library
          .mockResolvedValueOnce({ rows: [{ context_version: null }] }) // Question context
          .mockResolvedValueOnce(createDbRowsResult()) // UPDATE classification
          .mockResolvedValueOnce(createDbRowsResult()), // COMMIT
        release: jest.fn(),
      };

      db.pool.connect.mockResolvedValueOnce(mockClient);

      const result = await clarificationService.resolvePolicyQuestion(
        1,
        2,
        'Resolve current item',
        'test-user',
        false,
      );

      expect(result.nativeResolutionProvenance).toEqual(expect.objectContaining({
        statusId: 'outcome_only',
        selection: expect.objectContaining({
          eventTypeId: 'operator_confirmed_destination',
          selectedOutcomeId: 'resolve_current_item',
          alternateDestination: false,
        }),
        requestTimeDecision: expect.objectContaining({ validationOk: true }),
        learningGuard: expect.objectContaining({ canWriteLearning: false }),
      }));
      expect(classificationOutcomeService.recordOutcome).toHaveBeenNthCalledWith(
        1,
        1,
        expect.objectContaining({
          type: 'native_pending_resolution',
          source: 'policy_request_time',
          event_type_id: 'operator_confirmed_destination',
          selected_outcome_id: 'resolve_current_item',
          suggested_library_id: 2,
          selected_library_id: 2,
          alternate_destination: false,
        }),
        { client: mockClient },
      );
      expect(classificationOutcomeService.recordOutcome).toHaveBeenNthCalledWith(
        2,
        1,
        expect.objectContaining({ type: 'resolved', source: 'policy_question' }),
        { client: mockClient },
      );
      expect(mockClient.query.mock.calls.some(([sql]) =>
        typeof sql === 'string' && sql.includes('INSERT INTO classification_evidence')
      )).toBe(false);
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
          .mockResolvedValueOnce(createDbRowsResult()) // BEGIN
          .mockResolvedValueOnce({ rows: [mockClassification] }) // Get classification
          .mockResolvedValueOnce({ rows: [{ id: 2, name: 'Movies', media_type: 'movie', is_active: true }] }) // selected library
          .mockResolvedValueOnce(createDbRowsResult()) // UPDATE classification
          .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Phase 7: INSERT classification_evidence (item_exact)
          .mockResolvedValueOnce(createDbRowsResult()), // COMMIT
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
      
      // Verify item_exact evidence was written with correct payload
      const evidenceInsertCall = mockClient.query.mock.calls.find(call => 
        call[0] && call[0].includes('INSERT INTO classification_evidence') && call[1] && call[1][0] === 'item_exact'
      );
      expect(evidenceInsertCall).toBeDefined();
      
      // Parse the evidenceData parameter (position 5 in upsertEvidence params)
      const evidenceDataParam = JSON.parse(evidenceInsertCall[1][5]);
      expect(evidenceDataParam.original_question).toBe('Is this a documentary?');
      expect(evidenceDataParam.selected_option).toBe('No');
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
          .mockResolvedValueOnce(createDbRowsResult()) // BEGIN
          .mockResolvedValueOnce({ rows: [mockClassification] }) // Get classification
          .mockResolvedValueOnce({ rows: [{ id: 2, name: 'Movies', media_type: 'movie', is_active: true }] }) // selected library
          .mockResolvedValueOnce(createDbRowsResult()) // UPDATE classification
          .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Phase 7: INSERT classification_evidence (item_exact)
          .mockResolvedValueOnce(createDbRowsResult()), // COMMIT
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
      
      // Verify item_exact evidence was written with null original_question in payload
      const evidenceInsertCall = mockClient.query.mock.calls.find(call => 
        call[0] && call[0].includes('INSERT INTO classification_evidence') && call[1] && call[1][0] === 'item_exact'
      );
      expect(evidenceInsertCall).toBeDefined();
      
      const evidenceDataParam = JSON.parse(evidenceInsertCall[1][5]);
      expect(evidenceDataParam.original_question).toBeNull();
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
          .mockResolvedValueOnce(createDbRowsResult()) // BEGIN
          .mockResolvedValueOnce({ rows: [mockClassification] }) // Get classification
          .mockResolvedValueOnce({ rows: [{ id: 2, name: 'Movies', media_type: 'movie', is_active: true }] }) // selected library
          .mockResolvedValueOnce(createDbRowsResult()) // UPDATE classification
          .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Phase 7: INSERT classification_evidence (item_exact)
          .mockResolvedValueOnce(createDbRowsResult()), // COMMIT
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

      const evidenceInsertCall = mockClient.query.mock.calls.find(call =>
        call[0] && call[0].includes('INSERT INTO classification_evidence') && call[1] && call[1][0] === 'item_exact'
      );
      expect(evidenceInsertCall).toBeDefined();

      const evidenceDataParam = JSON.parse(evidenceInsertCall[1][5]);
      expect(evidenceDataParam.original_question).toBeNull();
    });
  });

  describe('resolvePolicyQuestion - genre_pattern writing', () => {
    test('validates SQL bind counts across the full successful resolution path', async () => {
      const mockClassification = {
        id: 1,
        title: 'Planet Earth',
        media_type: 'movie',
        library_name: 'Movies',
        policy_question: null,
        metadata: JSON.stringify({
          tmdb_id: 99999,
          title: 'Planet Earth',
          genres: ['Documentary', 'Family']
        })
      };

      const mockClient = {
        query: createStrictQueryMock([
          createDbRowsResult(), // BEGIN
          { rows: [mockClassification] }, // Get classification
          { rows: [{ id: 5, name: 'Movies', media_type: 'movie', is_active: true }] }, // selected library
          createDbRowsResult(), // UPDATE classification_history
          { rows: [{ id: 1 }] }, // Phase 7: INSERT classification_evidence (item_exact)
          { rows: [{ id: 2 }] }, // Phase 7: INSERT classification_evidence (genre: documentary)
          { rows: [{ id: 3 }] }, // Phase 7: INSERT classification_evidence (genre: family)
          createDbRowsResult(), // COMMIT
        ]),
        release: jest.fn()
      };

      db.pool.connect.mockResolvedValueOnce(mockClient);

      const result = await clarificationService.resolvePolicyQuestion(1, 5, 'Movies', 'test-user', true);

      expect(result.success).toBe(true);
      expect(mockClient.query).toHaveBeenCalled();
    });

    test('updates then inserts one genre_pattern per new genre when metadata has genres', async () => {
      const mockClassification = {
        id: 1,
        title: 'Planet Earth',
        media_type: 'movie',
        library_name: 'Movies',
        policy_question: null,
        metadata: JSON.stringify({
          tmdb_id: 99999,
          title: 'Planet Earth',
          genres: ['Documentary', 'Family']
        })
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(createDbRowsResult()) // BEGIN
          .mockResolvedValueOnce({ rows: [mockClassification] }) // Get classification
          .mockResolvedValueOnce({ rows: [{ id: 5, name: 'Movies', media_type: 'movie', is_active: true }] }) // selected library
          .mockResolvedValueOnce(createDbRowsResult()) // UPDATE classification_history
          .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Phase 7: INSERT classification_evidence (item_exact)
          .mockResolvedValueOnce({ rows: [{ id: 2 }] }) // Phase 7: INSERT classification_evidence (genre: documentary)
          .mockResolvedValueOnce({ rows: [{ id: 3 }] }) // Phase 7: INSERT classification_evidence (genre: family)
          .mockResolvedValueOnce(createDbRowsResult()), // COMMIT
        release: jest.fn()
      };

      db.pool.connect.mockResolvedValueOnce(mockClient);

      const result = await clarificationService.resolvePolicyQuestion(1, 5, 'Movies', 'test-user', true);

      expect(result.success).toBe(true);

      // Phase 7: genre evidence is written via INSERT INTO classification_evidence with ON CONFLICT DO UPDATE
      const genreEvidenceCalls = mockClient.query.mock.calls.filter(call =>
        call[0] && call[0].includes('INSERT INTO classification_evidence') && call[1] && call[1][0] === 'genre'
      );
      expect(genreEvidenceCalls).toHaveLength(2);
      // evidence_key is params[4]: 'genre:documentary', 'genre:family'
      expect(genreEvidenceCalls[0][1][4]).toBe('genre:documentary');
      expect(genreEvidenceCalls[1][1][4]).toBe('genre:family');
    });

    test('stores genre lowercase in genre_pattern update and insert params', async () => {
      const mockClassification = {
        id: 1,
        title: 'Nature Film',
        media_type: 'movie',
        library_name: 'Movies',
        policy_question: null,
        metadata: JSON.stringify({
          tmdb_id: 88888,
          title: 'Nature Film',
          genres: ['Documentary']
        })
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(createDbRowsResult()) // BEGIN
          .mockResolvedValueOnce({ rows: [mockClassification] }) // Get classification
          .mockResolvedValueOnce({ rows: [{ id: 5, name: 'Movies', media_type: 'movie', is_active: true }] }) // selected library
          .mockResolvedValueOnce(createDbRowsResult()) // UPDATE classification_history
          .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Phase 7: INSERT classification_evidence (item_exact)
          .mockResolvedValueOnce({ rows: [{ id: 2 }] }) // Phase 7: INSERT classification_evidence (genre: documentary)
          .mockResolvedValueOnce(createDbRowsResult()), // COMMIT
        release: jest.fn()
      };

      db.pool.connect.mockResolvedValueOnce(mockClient);

      await clarificationService.resolvePolicyQuestion(1, 5, 'Movies', 'test-user', true);

      // Phase 7: genre evidence uses INSERT INTO classification_evidence with ON CONFLICT DO UPDATE (evidence_key is lowercase)
      const genreEvidenceCall = mockClient.query.mock.calls.find(call =>
        call[0] && call[0].includes('INSERT INTO classification_evidence') && call[1] && call[1][0] === 'genre'
      );
      expect(genreEvidenceCall).toBeDefined();
      // evidence_key (params[4]) should be lowercase
      expect(genreEvidenceCall[1][4]).toBe('genre:documentary');
    });

    test('handles object-shaped metadata genres when writing genre_pattern rows', async () => {
      const mockClassification = {
        id: 1,
        title: 'Nature Film',
        media_type: 'movie',
        library_name: 'Movies',
        policy_question: null,
        metadata: JSON.stringify({
          tmdb_id: 88888,
          title: 'Nature Film',
          genres: [{ id: 99, name: 'Documentary' }, { id: 10751, name: 'Family' }]
        })
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(createDbRowsResult()) // BEGIN
          .mockResolvedValueOnce({ rows: [mockClassification] }) // Get classification
          .mockResolvedValueOnce({ rows: [{ id: 5, name: 'Movies', media_type: 'movie', is_active: true }] }) // selected library
          .mockResolvedValueOnce(createDbRowsResult()) // UPDATE classification_history
          .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Phase 7: INSERT classification_evidence (item_exact)
          .mockResolvedValueOnce({ rows: [{ id: 2 }] }) // Phase 7: INSERT classification_evidence (genre: documentary)
          .mockResolvedValueOnce({ rows: [{ id: 3 }] }) // Phase 7: INSERT classification_evidence (genre: family)
          .mockResolvedValueOnce(createDbRowsResult()), // COMMIT
        release: jest.fn()
      };

      db.pool.connect.mockResolvedValueOnce(mockClient);

      const result = await clarificationService.resolvePolicyQuestion(1, 5, 'Movies', 'test-user', true);

      expect(result.success).toBe(true);

      // Phase 7: genres are written as classification_evidence rows with lowercase evidence_key
      const genreEvidenceCalls = mockClient.query.mock.calls.filter(call =>
        call[0] && call[0].includes('INSERT INTO classification_evidence') && call[1] && call[1][0] === 'genre'
      );
      expect(genreEvidenceCalls).toHaveLength(2);
      expect(genreEvidenceCalls[0][1][4]).toBe('genre:documentary');
      expect(genreEvidenceCalls[1][1][4]).toBe('genre:family');
    });

    test('updates an existing genre_pattern without inserting a duplicate row', async () => {
      const mockClassification = {
        id: 1,
        title: 'Nature Film',
        media_type: 'movie',
        library_name: 'Movies',
        policy_question: null,
        metadata: JSON.stringify({
          tmdb_id: 88888,
          title: 'Nature Film',
          genres: ['Documentary']
        })
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(createDbRowsResult()) // BEGIN
          .mockResolvedValueOnce({ rows: [mockClassification] }) // Get classification
          .mockResolvedValueOnce({ rows: [{ id: 5, name: 'Movies', media_type: 'movie', is_active: true }] }) // selected library
          .mockResolvedValueOnce(createDbRowsResult()) // UPDATE classification_history
          .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Phase 7: INSERT classification_evidence (item_exact)
          .mockResolvedValueOnce({ rows: [{ id: 2 }] }) // Phase 7: INSERT classification_evidence (genre: documentary) — always upserts, no duplication
          .mockResolvedValueOnce(createDbRowsResult()), // COMMIT
        release: jest.fn()
      };

      db.pool.connect.mockResolvedValueOnce(mockClient);

      const result = await clarificationService.resolvePolicyQuestion(1, 5, 'Movies', 'test-user', true);

      expect(result.success).toBe(true);

      // Phase 7: single upsert per genre — ON CONFLICT DO UPDATE handles the existing-row case
      const genreEvidenceCalls = mockClient.query.mock.calls.filter(call =>
        call[0] && call[0].includes('INSERT INTO classification_evidence') && call[1] && call[1][0] === 'genre'
      );
      expect(genreEvidenceCalls).toHaveLength(1);
      expect(genreEvidenceCalls[0][1][4]).toBe('genre:documentary');
    });

    test('skips genre_pattern INSERTs when metadata has no genres', async () => {
      const mockClassification = {
        id: 1,
        title: 'Test Movie',
        media_type: 'movie',
        library_name: 'Movies',
        policy_question: null,
        metadata: JSON.stringify({ tmdb_id: 77777, title: 'Test Movie' })
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(createDbRowsResult()) // BEGIN
          .mockResolvedValueOnce({ rows: [mockClassification] }) // Get classification
          .mockResolvedValueOnce({ rows: [{ id: 5, name: 'Movies', media_type: 'movie', is_active: true }] }) // selected library
          .mockResolvedValueOnce(createDbRowsResult()) // UPDATE classification_history
          .mockResolvedValueOnce({
            rows: [{ id: 1, tmdb_id: 77777, library_id: 5, pattern_type: 'exact_match', confidence: 100 }]
          }) // INSERT exact_match
          .mockResolvedValueOnce(createDbRowsResult()) // Phase 3 shadow-write: item_exact (classification_evidence)
          .mockResolvedValueOnce(createDbRowsResult()), // COMMIT
        release: jest.fn()
      };

      db.pool.connect.mockResolvedValueOnce(mockClient);

      const result = await clarificationService.resolvePolicyQuestion(1, 5, 'Movies', 'test-user', true);

      expect(result.success).toBe(true);

      const genrePatternCalls = mockClient.query.mock.calls.filter(call =>
        call[0] && call[0].includes('genre_pattern')
      );
      expect(genrePatternCalls).toHaveLength(0);
    });

    test('rejects classifications that are no longer awaiting decision', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(createDbRowsResult()) // BEGIN
          .mockResolvedValueOnce(createDbRowsResult()) // locked pending lookup
          .mockResolvedValueOnce({ rows: [{ id: 5 }] }) // library check
          .mockResolvedValueOnce({ rows: [{ status: 'completed', library_id: 8, library_name: 'Family' }] }) // existence/status check
          .mockResolvedValueOnce(createDbRowsResult()), // ROLLBACK
        release: jest.fn()
      };

      db.pool.connect.mockResolvedValueOnce(mockClient);

      await expect(
        clarificationService.resolvePolicyQuestion(1, 5, 'Movies', 'test-user', true)
      ).rejects.toMatchObject({
        message: 'Classification is no longer awaiting decision',
        statusCode: 409
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Policy question resolution rejected',
        expect.objectContaining({
          classificationId: 1,
          selectedLibraryId: 5,
          statusCode: 409,
          error: 'Classification is no longer awaiting decision'
        })
      );
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('treats duplicate resolution to the same completed library as idempotent success', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(createDbRowsResult()) // BEGIN
          .mockResolvedValueOnce(createDbRowsResult()) // locked pending lookup
          .mockResolvedValueOnce({ rows: [{ id: 5 }] }) // library check
          .mockResolvedValueOnce({ rows: [{ status: 'completed', library_id: 5, library_name: 'Movies' }] }) // existence/status check
          .mockResolvedValueOnce(createDbRowsResult()), // COMMIT
        release: jest.fn()
      };

      db.pool.connect.mockResolvedValueOnce(mockClient);

      const result = await clarificationService.resolvePolicyQuestion(1, 5, 'Movies', 'test-user', true);

      expect(result).toEqual(expect.objectContaining({
        success: true,
        classificationId: 1,
        libraryId: 5,
        libraryName: 'Movies',
        shouldRoute: false,
        alreadyResolved: true,
        generatedPattern: null
      }));
      expect(mockClient.query).toHaveBeenCalledTimes(5);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('rejects invalid selected libraries for direct service callers', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(createDbRowsResult()) // BEGIN
          .mockResolvedValueOnce(createDbRowsResult()) // locked pending lookup
          .mockResolvedValueOnce(createDbRowsResult()) // library check
          .mockResolvedValueOnce(createDbRowsResult()), // ROLLBACK
        release: jest.fn()
      };

      db.pool.connect.mockResolvedValueOnce(mockClient);

      await expect(
        clarificationService.resolvePolicyQuestion(1, 999, 'Movies', 'discord-user', true)
      ).rejects.toMatchObject({
        message: 'Invalid library_id',
        statusCode: 400
      });
    });

    test('rejects inactive selected libraries', async () => {
      const mockClassification = {
        id: 1,
        title: 'Test Movie',
        media_type: 'movie',
        policy_question: null,
        metadata: '{}'
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(createDbRowsResult()) // BEGIN
          .mockResolvedValueOnce({ rows: [mockClassification] }) // locked pending lookup
          .mockResolvedValueOnce({ rows: [{ id: 5, name: 'Movies', media_type: 'movie', is_active: false }] }) // selected library
          .mockResolvedValueOnce(createDbRowsResult()), // ROLLBACK
        release: jest.fn()
      };

      db.pool.connect.mockResolvedValueOnce(mockClient);

      await expect(
        clarificationService.resolvePolicyQuestion(1, 5, 'Movies', 'admin', true)
      ).rejects.toMatchObject({
        message: 'Selected library is inactive',
        statusCode: 400,
        code: 'inactive_library'
      });
    });

    test('rejects selected libraries with mismatched media types', async () => {
      const mockClassification = {
        id: 1,
        title: 'Test Movie',
        media_type: 'movie',
        policy_question: null,
        metadata: '{}'
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(createDbRowsResult()) // BEGIN
          .mockResolvedValueOnce({ rows: [mockClassification] }) // locked pending lookup
          .mockResolvedValueOnce({ rows: [{ id: 5, name: 'TV Shows', media_type: 'tv', is_active: true }] }) // selected library
          .mockResolvedValueOnce(createDbRowsResult()), // ROLLBACK
        release: jest.fn()
      };

      db.pool.connect.mockResolvedValueOnce(mockClient);

      await expect(
        clarificationService.resolvePolicyQuestion(1, 5, 'TV Shows', 'admin', true)
      ).rejects.toMatchObject({
        message: 'Selected library is not valid for this media type',
        statusCode: 400,
        code: 'library_media_type_mismatch'
      });
    });

    test('rejects selected libraries that are no longer valid options for the current policy question', async () => {
      const mockClassification = {
        id: 1,
        title: 'Test Movie',
        media_type: 'movie',
        policy_question: {
          question: 'Which library should this go to?',
          options: [
            { label: 'Movies', library_id: 5 }
          ],
          meta: {
            question_context: {
              version: '2026-03-21T00:00:00.000Z',
              policy_ids: [1],
              library_ids: [5]
            }
          }
        },
        metadata: '{}'
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(createDbRowsResult()) // BEGIN
          .mockResolvedValueOnce({ rows: [mockClassification] }) // locked pending lookup
          .mockResolvedValueOnce({ rows: [{ id: 6, name: 'Family', media_type: 'movie', is_active: true }] }) // selected library
          .mockResolvedValueOnce({ rows: [{ context_version: '2026-03-21T00:00:00.000Z' }] }) // current context
          .mockResolvedValueOnce(createDbRowsResult()), // ROLLBACK
        release: jest.fn()
      };

      db.pool.connect.mockResolvedValueOnce(mockClient);

      await expect(
        clarificationService.resolvePolicyQuestion(1, 6, 'Family', 'admin', true)
      ).rejects.toMatchObject({
        message: 'Selected library is no longer valid for this policy question',
        statusCode: 400,
        code: 'invalid_policy_option'
      });
    });

    test('rejects stale policy questions before applying a resolution', async () => {
      const mockClassification = {
        id: 1,
        title: 'Test Movie',
        media_type: 'movie',
        policy_question: {
          question: 'Which library should this go to?',
          options: [
            { label: 'Movies', library_id: 5 }
          ],
          meta: {
            question_context: {
              version: '2026-03-20T00:00:00.000Z',
              policy_ids: [1],
              library_ids: [5]
            }
          }
        },
        metadata: '{}'
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(createDbRowsResult()) // BEGIN
          .mockResolvedValueOnce({ rows: [mockClassification] }) // locked pending lookup
          .mockResolvedValueOnce({ rows: [{ id: 5, name: 'Movies', media_type: 'movie', is_active: true }] }) // selected library
          .mockResolvedValueOnce({ rows: [{ context_version: '2026-03-21T00:00:00.000Z' }] }) // current context
          .mockResolvedValueOnce(createDbRowsResult()), // ROLLBACK
        release: jest.fn()
      };

      db.pool.connect.mockResolvedValueOnce(mockClient);

      await expect(
        clarificationService.resolvePolicyQuestion(1, 5, 'Movies', 'admin', true)
      ).rejects.toMatchObject({
        message: 'Policy question is stale and must be retried',
        statusCode: 409,
        code: 'policy_question_stale'
      });
    });
  });
});
