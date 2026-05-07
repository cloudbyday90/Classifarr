/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { createMockModule, createNamedMockModule } from './helpers/mockFactory.mjs';

const mockDb = { query: jest.fn() };
const mockLoggerModule = {
    createLogger: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    })
};
const mockPatternMiningService = { discoverPatterns: jest.fn() };
const mockPatternReinforcementService = { resolveConflicts: jest.fn(), getPatternAccuracy: jest.fn() };
const mockEmbeddingRouter = { getConfig: jest.fn() };

jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));

jest.unstable_mockModule('../utils/logger.mjs', () => createMockModule(mockLoggerModule));

jest.unstable_mockModule('../services/patternMiningService.mjs', () => createNamedMockModule('patternMiningService', mockPatternMiningService));

jest.unstable_mockModule('../services/patternReinforcementService.mjs', () => createNamedMockModule('patternReinforcementService', mockPatternReinforcementService));

jest.unstable_mockModule('../services/embeddingRouter.mjs', () => createNamedMockModule('embeddingRouter', mockEmbeddingRouter));

const db = mockDb;
const patternMiningService = mockPatternMiningService;
const patternReinforcementService = mockPatternReinforcementService;
const embeddingRouter = mockEmbeddingRouter;
const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
};
describe('Patterns Routes', () => {
  let app;

  beforeEach(async () => {
    jest.clearAllMocks();
    const { createPatternsRouter } = await import('../routes/patternsRouteShared.mjs');
    app = express();
    app.use(express.json());
    app.use('/patterns', createPatternsRouter({
      express,
      db,
      logger,
      patternMiningService,
      patternReinforcementService,
      embeddingRouter
    }));
  });

  describe('GET /patterns/summary', () => {
    it('should return pattern summary', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{
            total: '10',
            discovered: '5',
            approved: '3',
            rejected: '2',
            decayed: '0',
            avg_confidence: '0.85',
            total_samples: '100'
          }]
        })
        .mockResolvedValueOnce({ rows: [{ conflicts: '2' }] })
        .mockResolvedValueOnce({
          rows: [
            { pattern_type: 'genre', count: '5', avg_confidence: '0.90' },
            { pattern_type: 'keyword', count: '3', avg_confidence: '0.80' }
          ]
        });

      const res = await request(app).get('/patterns/summary');

      expect(res.status).toBe(200);
      expect(res.body.total).toBe('10');
      expect(res.body.conflicts).toBe(2);
      expect(res.body.by_type).toHaveLength(2);
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app).get('/patterns/summary');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to get pattern summary');
    });
  });

  describe('GET /patterns/cost-summary', () => {
    it('should return cost summary', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ calls_made: '10', calls_avoided: '90' }]
      });

      const res = await request(app).get('/patterns/cost-summary');

      expect(res.status).toBe(200);
      expect(res.body.callsMade).toBe(10);
      expect(res.body.callsAvoided).toBe(90);
      expect(res.body.savingsPercent).toBe(90);
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app).get('/patterns/cost-summary');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('DB error');
    });
  });

  describe('POST /patterns/resolve-conflicts', () => {
    it('should resolve conflicts', async () => {
      patternReinforcementService.resolveConflicts.mockResolvedValueOnce({
        resolved: 5
      });

      const res = await request(app).post('/patterns/resolve-conflicts');

      expect(res.status).toBe(200);
      expect(res.body.resolved).toBe(5);
    });

    it('should handle errors', async () => {
      patternReinforcementService.resolveConflicts.mockRejectedValueOnce(
        new Error('Failed')
      );

      const res = await request(app).post('/patterns/resolve-conflicts');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to resolve conflicts');
    });
  });

  describe('POST /patterns/discover', () => {
    it('should trigger pattern discovery for all libraries', async () => {
      patternMiningService.discoverPatterns.mockResolvedValueOnce({
        patternsFound: 20
      });

      const res = await request(app).post('/patterns/discover');

      expect(res.status).toBe(200);
      expect(res.body.patternsFound).toBe(20);
    });

    it('should handle errors', async () => {
      patternMiningService.discoverPatterns.mockRejectedValueOnce(
        new Error('Discovery failed')
      );

      const res = await request(app).post('/patterns/discover');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to discover patterns');
    });
  });

  describe('POST /patterns/discover/:libraryId', () => {
    it('should discover patterns for specific library', async () => {
      patternMiningService.discoverPatterns.mockResolvedValueOnce({
        patternsFound: 10
      });

      const res = await request(app).post('/patterns/discover/1');

      expect(res.status).toBe(200);
      expect(res.body.patternsFound).toBe(10);
      expect(patternMiningService.discoverPatterns).toHaveBeenCalledWith({ libraryId: 1 });
    });

    it('should return 400 for invalid library ID', async () => {
      const res = await request(app).post('/patterns/discover/invalid');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid library ID');
    });

    it('should handle errors', async () => {
      patternMiningService.discoverPatterns.mockRejectedValueOnce(
        new Error('Discovery failed')
      );

      const res = await request(app).post('/patterns/discover/1');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to discover patterns for library');
    });
  });

  describe('GET /patterns/library/:libraryId', () => {
    it('should return patterns for specific library', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, pattern_type: 'genre', library_name: 'Movies' }]
      });

      const res = await request(app).get('/patterns/library/1');

      expect(res.status).toBe(200);
      expect(res.body.patterns).toHaveLength(1);
    });

    it('should return 400 for invalid library ID', async () => {
      const res = await request(app).get('/patterns/library/invalid');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid library ID');
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app).get('/patterns/library/1');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to get library patterns');
    });
  });

  describe('GET /patterns/config', () => {
    it('should return pattern config', async () => {
      embeddingRouter.getConfig.mockResolvedValueOnce({
        pattern_mining_enabled: true,
        pattern_rule_priority: 'rules_first',
        pattern_ai_skip_threshold: 90
      });

      const res = await request(app).get('/patterns/config');

      expect(res.status).toBe(200);
      expect(res.body.pattern_mining_enabled).toBe(true);
    });

    it('should return defaults when config is null', async () => {
      embeddingRouter.getConfig.mockResolvedValueOnce(null);

      const res = await request(app).get('/patterns/config');

      expect(res.status).toBe(200);
      expect(res.body.pattern_mining_enabled).toBe(true);
      expect(res.body.pattern_rule_priority).toBe('rules_first');
    });

    it('should handle errors', async () => {
      embeddingRouter.getConfig.mockRejectedValueOnce(new Error('Failed'));

      const res = await request(app).get('/patterns/config');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to get pattern config');
    });
  });

  describe('PUT /patterns/config', () => {
    it('should update pattern config', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          pattern_mining_enabled: false,
          pattern_rule_priority: 'rules_first',
          pattern_ai_skip_threshold: 80,
          pattern_notification_dismissed: false,
          formula_pattern_weight: 0.4,
          formula_rule_weight: 0.3,
          formula_rag_weight: 0.2,
          formula_history_weight: 0.1
        }]
      });

      const res = await request(app)
        .put('/patterns/config')
        .send({ pattern_mining_enabled: false, pattern_ai_skip_threshold: 80 });

      expect(res.status).toBe(200);
      expect(res.body.pattern_mining_enabled).toBe(false);
    });

    it('should return 400 for invalid pattern_rule_priority', async () => {
      const res = await request(app)
        .put('/patterns/config')
        .send({ pattern_rule_priority: 'invalid' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid pattern_rule_priority');
    });

    it('should return 400 for out of range pattern_ai_skip_threshold', async () => {
      const res = await request(app)
        .put('/patterns/config')
        .send({ pattern_ai_skip_threshold: 150 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('must be between 0 and 100');
    });

    it('should return 400 for out of range formula weight', async () => {
      const res = await request(app)
        .put('/patterns/config')
        .send({ formula_pattern_weight: 1.5 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('must be between 0 and 1');
    });

    it('should return 400 when formula weights do not sum to 1', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          formula_pattern_weight: 0.4,
          formula_rule_weight: 0.3,
          formula_rag_weight: 0.2,
          formula_history_weight: 0.1
        }]
      });

      const res = await request(app)
        .put('/patterns/config')
        .send({ formula_pattern_weight: 0.8 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('must sum to 1.0');
    });

    it('should return 400 when no valid updates provided', async () => {
      const res = await request(app)
        .put('/patterns/config')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('No valid updates provided');
    });

    it('should handle errors', async () => {
      db.query.mockImplementationOnce(() => {
        throw new Error('DB error');
      });

      const res = await request(app)
        .put('/patterns/config')
        .send({ pattern_mining_enabled: false });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to update pattern config');
    });
  });

  describe('GET /patterns', () => {
    it('should return patterns list with defaults', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, pattern_type: 'genre', pattern_value: 'Action' }]
        })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });

      const res = await request(app).get('/patterns');

      expect(res.status).toBe(200);
      expect(res.body.patterns).toHaveLength(1);
      expect(res.body.pagination.page).toBe(1);
    });

    it('should apply pagination parameters', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await request(app).get('/patterns?page=2&per_page=50');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $'),
        expect.arrayContaining([50, 50])
      );
    });

    it('should filter by status', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await request(app).get('/patterns?status=approved');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('status = $'),
        expect.arrayContaining(['approved'])
      );
    });

    it('should filter by type', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await request(app).get('/patterns?type=genre');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('pattern_type = $'),
        expect.arrayContaining(['genre'])
      );
    });

    it('should return 400 for invalid libraryId', async () => {
      const res = await request(app).get('/patterns?libraryId=invalid');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('libraryId must be a valid integer');
    });

    it('should return 400 for invalid min_confidence', async () => {
      const res = await request(app).get('/patterns?min_confidence=invalid');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('min_confidence must be a number between 0 and 100');
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('Query failed'));

      const res = await request(app).get('/patterns');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to list patterns');
    });
  });

  describe('GET /patterns/:id', () => {
    it('should return pattern by ID', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, pattern_type: 'genre', pattern_value: 'Action', confidence: 0.9 }]
        })
        .mockResolvedValueOnce({ rows: [] });
      patternReinforcementService.getPatternAccuracy.mockResolvedValueOnce({ accuracy: 0.95 });

      const res = await request(app).get('/patterns/1');

      expect(res.status).toBe(200);
      expect(res.body.pattern.id).toBe(1);
    });

    it('should return 400 for invalid pattern ID', async () => {
      const res = await request(app).get('/patterns/invalid');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid pattern ID');
    });

    it('should return 404 for non-existent pattern', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/patterns/999');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Pattern not found');
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app).get('/patterns/1');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to get pattern details');
    });
  });

  describe('PUT /patterns/:id/approve', () => {
    it('should return 400 for invalid pattern ID', async () => {
      const res = await request(app).put('/patterns/invalid/approve');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid pattern ID');
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app).put('/patterns/1/approve');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to approve pattern');
    });
  });

  describe('PUT /patterns/:id/reject', () => {
    it('should return 400 for invalid pattern ID', async () => {
      const res = await request(app).put('/patterns/invalid/reject');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid pattern ID');
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app).put('/patterns/1/reject');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to reject pattern');
    });
  });

  describe('DELETE /patterns/:id', () => {
    it('should return 400 for invalid pattern ID', async () => {
      const res = await request(app).delete('/patterns/invalid');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid pattern ID');
    });
  });
});
