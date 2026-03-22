/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const request = require('supertest');
const express = require('express');

jest.mock('../config/database', () => {
  const queryMock = jest.fn();
  return {
    query: queryMock,
  };
});

jest.mock('../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })
}));

const db = require('../config/database');
const presetsRouter = require('../routes/presets');

describe('Presets routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/presets', presetsRouter);
  });

  describe('GET /api/presets/all', () => {
    test('includes custom presets by default', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Family', source: 'builtin' }, { id: 7, name: 'My Family', source: 'custom' }]
      });

      const res = await request(app)
        .get('/api/presets/all')
        .expect(200);

      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('UNION ALL');
      expect(params).toEqual([]);
      expect(res.body.map((preset) => preset.source)).toEqual(['builtin', 'custom']);
    });

    test('parameterizes category and search filters across builtin and custom queries', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 7, name: 'Updated Preset', source: 'custom' }]
      });

      await request(app)
        .get('/api/presets/all?category=genre&search=updated')
        .expect(200);

      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('cp.category = $1');
      expect(sql).toContain('cp.name ILIKE $2');
      expect(sql).toContain('category = $1');
      expect(sql).toContain('name ILIKE $2');
      expect(sql).toContain('UNION ALL');
      expect(sql).not.toContain("'%updated%'");
      expect(sql).not.toContain("'genre'");
      expect(params).toEqual(['genre', '%updated%']);
    });

    test('supports builtin-only mode when include_custom is false', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Family', source: 'builtin' }]
      });

      const res = await request(app)
        .get('/api/presets/all?include_custom=false')
        .expect(200);

      const [sql] = db.query.mock.calls[0];
      expect(sql).not.toContain('UNION ALL');
      expect(res.body).toHaveLength(1);
      expect(res.body[0].source).toBe('builtin');
    });
  });

  describe('custom preset validation', () => {
    test('lists custom presets from content_presets', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 9, name: 'My Preset', is_system: false, user_id: 5 }]
      });

      const res = await request(app)
        .get('/api/presets/custom')
        .expect(200);

      expect(db.query.mock.calls[0][0]).toContain('FROM content_presets cp');
      expect(db.query.mock.calls[0][0]).toContain('cp.is_system = false');
      expect(res.body[0]).toMatchObject({
        id: 9,
        name: 'My Preset',
        created_by: 5,
        source: 'custom'
      });
    });

    test('rejects null signals on create', async () => {
      const res = await request(app)
        .post('/api/presets/custom')
        .send({
          name: 'Broken Preset',
          signals: null,
        })
        .expect(400);

      expect(res.body.error).toContain('Signals must be a valid object');
    });

    test('rejects array signals on update', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 7, name: 'Existing Preset', is_system: false }]
      });

      const res = await request(app)
        .put('/api/presets/custom/7')
        .send({
          signals: ['not', 'an', 'object'],
        })
        .expect(400);

      expect(res.body.error).toContain('Signals must be a valid object');
    });
  });
});
