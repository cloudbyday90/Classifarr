/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/errorHandler.mjs';
import { registerLibraryEvidenceCoverageRoutes } from '../routes/librariesRouteEvidenceCoverage.mjs';

test('evidence coverage is admin-only, no-store, and rejects unbounded request controls', async () => {
  const query = jest.fn(async sql => ({ rows: sql.includes('FROM libraries l') ? [{
    id: 7, media_type: 'movie', is_active: true, inventory_revision: 2,
    observed_at: '2026-09-24T12:00:00.000Z', item_count: 0,
    type_mismatch_count: 0, missing_identity_count: 0, source_conflict_count: 0,
  }] : [] }));
  const db = { withTransaction: callback => callback({ query }) };
  const app = express();
  app.use((req, _res, next) => { req.user = { role: req.get('x-test-role') || 'viewer' }; next(); });
  const router = express.Router();
  registerLibraryEvidenceCoverageRoutes(router, { db });
  app.use('/api/libraries', router);
  app.use(errorHandler);

  const denied = await request(app).get('/api/libraries/7/evidence-coverage').expect(403);
  expect(denied.headers['cache-control']).toBe('no-store');
  expect(query).not.toHaveBeenCalled();
  await request(app).get('/api/libraries/not-an-id/evidence-coverage')
    .set('x-test-role', 'admin').expect(400);
  await request(app).get('/api/libraries/7/evidence-coverage?limit=99999')
    .set('x-test-role', 'admin').expect(400);
  expect(query).not.toHaveBeenCalled();
  const allowed = await request(app).get('/api/libraries/7/evidence-coverage')
    .set('x-test-role', 'admin').expect(200);
  expect(allowed.headers['cache-control']).toBe('no-store');
  expect(allowed.body).toMatchObject({ libraryId: 7, statusId: 'no_inventory',
    source: { itemCount: 0 }, classificationQuality: 'not_measured' });
});
