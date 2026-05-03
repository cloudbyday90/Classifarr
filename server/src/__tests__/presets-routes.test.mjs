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

jest.unstable_mockModule('../utils/logger.js', loggerMockFactory);
jest.unstable_mockModule('../utils/logger.mjs', loggerMockFactory);

const { default: presetsRouter } = await import('../routes/presets.mjs');

describe('Presets routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createTestApp();
    app.use('/api/presets', presetsRouter);
  });

  describe('GET /api/presets/all', () => {
    test('includes custom presets by default', async () => {
      query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Family', source: 'builtin' }, { id: 7, name: 'My Family', source: 'custom' }],
      });

      const res = await request(app)
        .get('/api/presets/all')
        .expect(200);

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('UNION ALL');
      expect(params).toEqual([]);
      expect(res.body.map((preset) => preset.source)).toEqual(['builtin', 'custom']);
    });

    test('parameterizes category and search filters across builtin and custom queries', async () => {
      query.mockResolvedValueOnce({
        rows: [{ id: 7, name: 'Updated Preset', source: 'custom' }],
      });

      await request(app)
        .get('/api/presets/all?category=genre&search=updated')
        .expect(200);

      const [sql, params] = query.mock.calls[0];
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
      query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Family', source: 'builtin' }],
      });

      const res = await request(app)
        .get('/api/presets/all?include_custom=false')
        .expect(200);

      const [sql] = query.mock.calls[0];
      expect(sql).not.toContain('UNION ALL');
      expect(res.body).toHaveLength(1);
      expect(res.body[0].source).toBe('builtin');
    });
  });

  describe('custom preset validation', () => {
    test('lists custom presets from content_presets', async () => {
      query.mockResolvedValueOnce({
        rows: [{ id: 9, name: 'My Preset', is_system: false, user_id: 5 }],
      });

      const res = await request(app)
        .get('/api/presets/custom')
        .expect(200);

      expect(query.mock.calls[0][0]).toContain('FROM content_presets cp');
      expect(query.mock.calls[0][0]).toContain('cp.is_system = false');
      expect(res.body[0]).toMatchObject({
        id: 9,
        name: 'My Preset',
        created_by: 5,
        source: 'custom',
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
      query.mockResolvedValueOnce({
        rows: [{ id: 7, name: 'Existing Preset', is_system: false }],
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
