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

      db.query.mockResolvedValueOnce({
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

      db.query.mockResolvedValueOnce({
        rows: mockQuestions,
      });

      const metadata = {
        keywords: ['keyword1', 'keyword2', 'keyword3'],
        genres: [],
      };

      const questions = await clarificationService.matchQuestions(metadata, 2);

      expect(questions.length).toBeLessThanOrEqual(2);
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
});
