/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const request = require('supertest');
const express = require('express');

jest.mock('../config/database', () => ({
  query: jest.fn()
}));

jest.mock('../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })
}));

const db = require('../config/database');
const policiesRouter = require('../routes/policies');

describe('Policies routes coverage', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/policies', policiesRouter);
  });

  describe('GET /api/policies/presets/all', () => {
    test('returns presets with category and search filters', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Family', usage_count: 2 }]
      });

      const res = await request(app)
        .get('/api/policies/presets/all?category=audience&search=family')
        .expect(200);

      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('cp.category = $1');
      expect(sql).toContain('cp.name ILIKE $2');
      expect(params).toEqual(['audience', '%family%']);
      expect(res.body).toHaveLength(1);
    });

    test('returns 500 on database failure', async () => {
      db.query.mockRejectedValueOnce(new Error('preset list failure'));

      const res = await request(app)
        .get('/api/policies/presets/all')
        .expect(500);

      expect(res.body.error).toContain('preset list failure');
    });
  });

  test('GET /api/policies/presets/categories returns categories', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ category: 'audience', count: '3' }]
    });

    const res = await request(app)
      .get('/api/policies/presets/categories')
      .expect(200);

    expect(res.body[0].category).toBe('audience');
  });

  describe('GET /api/policies/presets/:presetId/usage', () => {
    test('validates presetId', async () => {
      await request(app)
        .get('/api/policies/presets/0/usage')
        .expect(400);
    });

    test('returns usage count as number', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '7' }] });

      const res = await request(app)
        .get('/api/policies/presets/2/usage')
        .expect(200);

      expect(res.body.count).toBe(7);
    });
  });

  describe('GET /api/policies/presets/suggest/:libraryId', () => {
    test('returns 404 when library does not exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app)
        .get('/api/policies/presets/suggest/999')
        .expect(404);
    });

    test('returns ranked suggestions with scoring', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 7, name: 'Anime Family Movies', media_type: 'movie' }]
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 10,
              key: 'anime',
              name: 'Anime',
              description: 'Animation and anime content',
              icon: 'sparkles',
              category: 'genre',
              signals: { genres: { require_any: ['Animation'], prefer: ['Family'] } },
              is_system: true,
              display_order: 1
            },
            {
              id: 11,
              key: 'drama',
              name: 'Drama',
              description: 'Drama only',
              icon: 'mask',
              category: 'genre',
              signals: { genres: { require_any: ['Drama'], prefer: [] } },
              is_system: true,
              display_order: 2
            }
          ]
        });

      const res = await request(app)
        .get('/api/policies/presets/suggest/7')
        .expect(200);

      expect(res.body.library_name).toBe('Anime Family Movies');
      expect(Array.isArray(res.body.suggestions)).toBe(true);
      expect(res.body.suggestions[0].match_score).toBeGreaterThan(0);
      expect(Array.isArray(res.body.suggestions[0].match_reasons)).toBe(true);
    });
  });

  test('GET /api/policies returns policy list', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 1, name: 'Movies Policy', preset_count: 2 }]
    });

    const res = await request(app)
      .get('/api/policies')
      .expect(200);

    expect(res.body[0].id).toBe(1);
  });

  describe('GET /api/policies/:id', () => {
    test('returns 404 when policy does not exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app)
        .get('/api/policies/123')
        .expect(404);
    });

    test('returns policy with presets', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 5, name: 'Policy', library_name: 'Movies' }]
        })
        .mockResolvedValueOnce({
          rows: [{ id: 11, weight: 1.2 }]
        });

      const res = await request(app)
        .get('/api/policies/5')
        .expect(200);

      expect(res.body.id).toBe(5);
      expect(res.body.presets).toHaveLength(1);
    });
  });

  describe('POST /api/policies', () => {
    test('validates required fields', async () => {
      await request(app)
        .post('/api/policies')
        .send({ description: 'missing required fields' })
        .expect(400);
    });

    test('validates threshold and weight constraints', async () => {
      await request(app)
        .post('/api/policies')
        .send({
          library_id: 1,
          name: 'Bad policy',
          auto_classify_threshold: 101
        })
        .expect(400);

      await request(app)
        .post('/api/policies')
        .send({
          library_id: 1,
          name: 'Bad weights',
          preset_weight: 0.5,
          pattern_weight: 0.3,
          rag_weight: 0.3,
          history_weight: 0.1
        })
        .expect(400);
    });

    test('creates policy with presets and commits transaction', async () => {
      db.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({
          rows: [{ id: 77, library_id: 4, name: 'Family Policy' }]
        }) // INSERT policy
        .mockResolvedValueOnce({}) // INSERT preset 1
        .mockResolvedValueOnce({}) // INSERT preset 2
        .mockResolvedValueOnce({}) // COMMIT
        .mockResolvedValueOnce({
          rows: [{ id: 77, library_id: 4, name: 'Family Policy', library_name: 'Family' }]
        })
        .mockResolvedValueOnce({
          rows: [{ id: 5, key: 'family', weight: 1.0 }]
        });

      const res = await request(app)
        .post('/api/policies')
        .send({
          library_id: 4,
          name: 'Family Policy',
          preset_weight: 0.4,
          pattern_weight: 0.3,
          rag_weight: 0.2,
          history_weight: 0.1,
          presets: [
            { preset_id: 5, weight: 1.0 },
            { preset_id: 6, customSignals: { genres: ['Family'] } }
          ]
        })
        .expect(201);

      expect(db.query).toHaveBeenCalledWith('BEGIN');
      expect(db.query).toHaveBeenCalledWith('COMMIT');
      expect(res.body.id).toBe(77);
      expect(res.body.presets).toHaveLength(1);
    });

    test('rolls back when insert fails after BEGIN', async () => {
      db.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({
          rows: [{ id: 12, library_id: 1, name: 'Broken policy' }]
        })
        .mockRejectedValueOnce(new Error('policy preset insert failed'))
        .mockResolvedValueOnce({}); // ROLLBACK

      const res = await request(app)
        .post('/api/policies')
        .send({
          library_id: 1,
          name: 'Broken policy',
          presets: [{ preset_id: 1 }]
        })
        .expect(500);

      expect(res.body.error).toContain('policy preset insert failed');
      expect(db.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('PUT /api/policies/:id', () => {
    test('validates update constraints and rolls back', async () => {
      db.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}); // ROLLBACK

      const res = await request(app)
        .put('/api/policies/8')
        .send({ auto_classify_threshold: -1 })
        .expect(400);

      expect(res.body.error).toContain('auto_classify_threshold');
      expect(db.query).toHaveBeenCalledWith('ROLLBACK');
    });

    test('updates policy with preset replacement', async () => {
      db.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // UPDATE
        .mockResolvedValueOnce({}) // DELETE presets
        .mockResolvedValueOnce({}) // INSERT preset
        .mockResolvedValueOnce({}) // COMMIT
        .mockResolvedValueOnce({
          rows: [{ id: 8, name: 'Updated', library_id: 1, library_name: 'Movies' }]
        })
        .mockResolvedValueOnce({
          rows: [{ id: 3, weight: 2.0 }]
        });

      const res = await request(app)
        .put('/api/policies/8')
        .send({
          name: 'Updated',
          preset_weight: 0.4,
          pattern_weight: 0.3,
          rag_weight: 0.2,
          history_weight: 0.1,
          presets: [{ preset_id: 3, weight: 2.0 }]
        })
        .expect(200);

      expect(res.body.name).toBe('Updated');
      expect(res.body.presets).toHaveLength(1);
    });

    test('returns 404 after update when policy no longer exists', async () => {
      db.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // UPDATE
        .mockResolvedValueOnce({}) // COMMIT
        .mockResolvedValueOnce({ rows: [] }); // SELECT updated policy

      await request(app)
        .put('/api/policies/404')
        .send({ name: 'not found path' })
        .expect(404);
    });
  });

  describe('DELETE /api/policies/:id', () => {
    test('returns 404 for missing policy', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app)
        .delete('/api/policies/44')
        .expect(404);
    });

    test('resets policy and returns old/new policy payload', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 9, library_id: 3, library_name: 'Family', name: 'Old' }]
        })
        .mockResolvedValueOnce({}) // DELETE old policy
        .mockResolvedValueOnce({
          rows: [{ id: 10, library_id: 3, name: 'Family Policy' }]
        });

      const res = await request(app)
        .delete('/api/policies/9')
        .expect(200);

      expect(res.body.message).toContain('reset');
      expect(res.body.oldPolicy.id).toBe(9);
      expect(res.body.newPolicy.id).toBe(10);
    });
  });

  test('GET /api/policies/:id/presets returns attached presets', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 5, key: 'family', weight: 1.0 }]
    });

    const res = await request(app)
      .get('/api/policies/22/presets')
      .expect(200);

    expect(res.body).toHaveLength(1);
  });

  describe('POST /api/policies/:id/presets', () => {
    test('requires preset_id', async () => {
      await request(app)
        .post('/api/policies/22/presets')
        .send({})
        .expect(400);
    });

    test('rejects duplicate preset', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await request(app)
        .post('/api/policies/22/presets')
        .send({ preset_id: 8, weight: 1.2 })
        .expect(400);
    });

    test('attaches preset and returns inserted row', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ policy_id: 22, preset_id: 8, weight: 1.2 }]
        });

      const res = await request(app)
        .post('/api/policies/22/presets')
        .send({ preset_id: 8, weight: 1.2, customSignals: { ratings: ['PG'] } })
        .expect(201);

      expect(res.body.policy_id).toBe(22);
      expect(res.body.preset_id).toBe(8);
    });
  });

  describe('DELETE /api/policies/:id/presets/:presetId', () => {
    test('returns 404 when preset not attached', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app)
        .delete('/api/policies/11/presets/99')
        .expect(404);
    });

    test('removes attached preset', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const res = await request(app)
        .delete('/api/policies/11/presets/8')
        .expect(200);

      expect(res.body.message).toContain('removed');
    });
  });
});

