/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import request from 'supertest';
import { jest } from '@jest/globals';
import { createStandardDbMock, loggerMockFactory, createTestApp } from './helpers/setupRouteTest.mjs';

const query = jest.fn();

jest.unstable_mockModule('../config/database.mjs', () => createStandardDbMock(query));

jest.unstable_mockModule('../middleware/apiKeyAuth.mjs', () => ({
  authenticateTokenOrApiKey: (req, res, next) => next(),
  requireReadWrite: (req, res, next) => next(),
}));

jest.unstable_mockModule('../utils/logger.mjs', loggerMockFactory);

const { router: statsRouter } = await import('../routes/stats.mjs');

describe('Stats routes coverage', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createTestApp();
    app.use('/api/stats', statsRouter);
  });

  test('GET /api/stats returns overall + byMethod', async () => {
    query
      .mockResolvedValueOnce({
        rows: [{
          total: '5',
          avg_confidence: '81.2',
          high_confidence: '2',
          low_confidence: '1',
          last_24h: '3',
          last_7d: '5',
        }],
      })
      .mockResolvedValueOnce({
        rows: [{ method: 'ai_rerun', count: '4', avg_confidence: '85.0' }],
      });

    const res = await request(app)
      .get('/api/stats')
      .expect(200);

    expect(res.body.total).toBe('5');
    expect(Array.isArray(res.body.byMethod)).toBe(true);
    expect(res.body.byMethod[0].method).toBe('ai_rerun');
  });

  test('GET /api/stats returns 500 on failure', async () => {
    query.mockRejectedValueOnce(new Error('stats boom'));

    const res = await request(app)
      .get('/api/stats')
      .expect(500);

    expect(res.body.error).toContain('stats boom');
  });

  test('GET /api/stats/detailed returns all sections and queue fallback', async () => {
    query.mockImplementation((sql) => {
      if (sql.includes('FROM classification_history') && sql.includes('COUNT(*) as total')) {
        return Promise.resolve({ rows: [{ total: '10' }] });
      }
      if (sql.includes('FROM libraries l')) {
        return Promise.resolve({ rows: [{ id: 1, name: 'Movies', count: '4' }] });
      }
      if (sql.includes('FROM classification_history') && sql.includes('GROUP BY method')) {
        return Promise.resolve({ rows: [{ method: 'manual', count: '1' }] });
      }
      if (sql.includes('FROM (') && sql.includes('confidence as avg_conf')) {
        return Promise.resolve({ rows: [{ level: 'high', count: '4' }] });
      }
      if (sql.includes('FROM task_queue')) {
        return Promise.reject(new Error('task_queue not available'));
      }
      if (sql.includes('GROUP BY DATE(created_at)')) {
        return Promise.resolve({ rows: [{ date: '2026-02-18', count: '2' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .get('/api/stats/detailed')
      .expect(200);

    expect(res.body).toHaveProperty('overall');
    expect(res.body).toHaveProperty('byLibrary');
    expect(res.body).toHaveProperty('byMethod');
    expect(res.body).toHaveProperty('confidenceDistribution');
    expect(res.body).toHaveProperty('queueHealth');
    expect(res.body.queueHealth.success_rate).toBe(100);
  });

  test('GET /api/stats/daily accepts custom days', async () => {
    query.mockResolvedValueOnce({
      rows: [{ date: '2026-02-18', count: '1', avg_confidence: '90.0' }],
    });

    const res = await request(app)
      .get('/api/stats/daily?days=14')
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(query.mock.calls[0][0]).toContain("INTERVAL '14 days'");
  });

  describe('GET /api/stats/overview', () => {
    test('calculates auto_rate when totals are present', async () => {
      query.mockResolvedValueOnce({
        rows: [{
          total_policies: '2',
          total_decisions: '10',
          avg_accuracy: '0.82',
          improving_count: '1',
          declining_count: '0',
          total_auto_classified: '4',
        }],
      });

      const res = await request(app)
        .get('/api/stats/overview')
        .expect(200);

      expect(res.body.total_decisions).toBe(10);
      expect(res.body.total_auto_classified).toBe(4);
      expect(res.body.auto_rate).toBe(0.4);
    });

    test('sets auto_rate to zero safely', async () => {
      query.mockResolvedValueOnce({
        rows: [{ total_decisions: null, total_auto_classified: null }],
      });

      const res = await request(app)
        .get('/api/stats/overview')
        .expect(200);

      expect(res.body.total_decisions).toBe(0);
      expect(res.body.auto_rate).toBe(0);
    });
  });

  describe('GET /api/stats/policies/:id', () => {
    test('validates policy id', async () => {
      await request(app)
        .get('/api/stats/policies/not-a-number')
        .expect(400);
    });

    test('returns 404 when policy stats not found', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await request(app)
        .get('/api/stats/policies/11')
        .expect(404);
    });

    test('returns policy detail with charts', async () => {
      query
        .mockResolvedValueOnce({
          rows: [{ policy_id: 11, total_decisions: 7, accuracy_rate: 0.8 }],
        })
        .mockResolvedValueOnce({
          rows: [{ date: '2026-02-18', decisions: '2', corrections: '0' }],
        })
        .mockResolvedValueOnce({
          rows: [{ prompt_type: 'auto_classify', count: '2', accuracy: 1 }],
        });

      const res = await request(app)
        .get('/api/stats/policies/11')
        .expect(200);

      expect(res.body.policy_id).toBe(11);
      expect(Array.isArray(res.body.time_series)).toBe(true);
      expect(Array.isArray(res.body.prompt_breakdown)).toBe(true);
    });
  });

  describe('GET /api/stats/live-feed', () => {
    test('clamps high limit to max', async () => {
      query.mockResolvedValueOnce({
        rows: [{ type: 'decision', id: 1, title: 'Movie', created_at: new Date().toISOString() }],
      });

      await request(app)
        .get('/api/stats/live-feed?limit=500')
        .expect(200);

      const params = query.mock.calls[0][1];
      expect(params).toEqual([100]);
    });

    test('uses default limit for invalid value', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await request(app)
        .get('/api/stats/live-feed?limit=bad')
        .expect(200);

      const params = query.mock.calls[0][1];
      expect(params).toEqual([20]);
    });
  });

  describe('GET /api/stats/alerts', () => {
    test('builds alerts from three checks', async () => {
      query
        .mockResolvedValueOnce({
          rows: [{ id: 1, name: 'Policy A', accuracy_rate: 0.71 }],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 1, name: 'Policy A', correction_rate: 25.3 }],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 2, name: 'Policy B', pending_count: '6' }],
        });

      const res = await request(app)
        .get('/api/stats/alerts')
        .expect(200);

      expect(res.body).toHaveLength(3);
      expect(res.body.map((alert) => alert.type)).toEqual(
        expect.arrayContaining(['declining_accuracy', 'high_corrections', 'pending_suggestions'])
      );
    });

    test('continues when individual alert queries fail', async () => {
      query
        .mockRejectedValueOnce(new Error('declining query error'))
        .mockRejectedValueOnce(new Error('high correction query error'))
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get('/api/stats/alerts')
        .expect(200);

      expect(res.body).toEqual([]);
    });
  });

  describe('GET /api/stats/policies/:id/compare', () => {
    test('validates id', async () => {
      await request(app)
        .get('/api/stats/policies/nope/compare')
        .expect(400);
    });

    test('returns period comparison rows', async () => {
      query.mockResolvedValueOnce({
        rows: [
          { period: 'last_7_days', decisions: '4', accuracy: 0.75, auto_rate: 50 },
          { period: 'previous_7_days', decisions: '3', accuracy: 0.66, auto_rate: 33.3 },
        ],
      });

      const res = await request(app)
        .get('/api/stats/policies/11/compare')
        .expect(200);

      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toHaveProperty('period');
    });
  });

  test('GET /api/stats/policies returns enabled policies with stats', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 1, name: 'Policy A', library_id: 1, library_name: 'Movies' }],
    });

    const res = await request(app)
      .get('/api/stats/policies')
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].name).toBe('Policy A');
  });
});
