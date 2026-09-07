/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { readSourceObservationSummary } from '../services/mediaSourceObservationSummary.mjs';
import { registerSourceObservationRoutes } from '../routes/librariesRouteSourceObservations.mjs';
const snapshot = library => ({ observed_at: '2026-09-07T20:00:00Z', active_count: 2,
  libraries: [{ id: 1, mediaServerId: 1, name: 'Fixture', retainedCount: 0, capture: null, examples: [], ...library }] });
test('keeps uncaptured state unknown and parameters bounded', async () => {
  const db = { query: jest.fn().mockResolvedValue({ rows: [snapshot()] }) };
  expect(await readSourceObservationSummary(db)).toMatchObject({ scope: { selectedLibraryCount: 1, excludedLibraryCount: 1 },
    libraries: [{ status: 'not_captured' }] });
  expect(db.query.mock.calls[0][1]).toEqual([12, 30, 20001, 5]);
});
test('withholds over-capacity data even if the database is populated outside the capture writer', async () => {
  const db = { query: jest.fn().mockResolvedValue({ rows: [snapshot({ retainedCount: 20001, examples: [{ private: true }] })] }) };
  expect((await readSourceObservationSummary(db)).libraries[0]).toMatchObject({ status: 'capacity_exceeded', retainedCount: null, examples: [] });
});
test('read endpoint sets no-store and rejects all unexpected query parameters before SQL', async () => {
  const db = { query: jest.fn().mockResolvedValue({ rows: [snapshot()] }) };
  const app = express(); registerSourceObservationRoutes(app, { db });
  app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ error: 'unavailable' }));
  const bad = await request(app).get('/source-observations?limit=10000');
  expect(bad.status).toBe(400); expect(bad.headers['cache-control']).toBe('no-store');
  expect(db.query).not.toHaveBeenCalled();
  expect((await request(app).get('/source-observations')).status).toBe(200);
});
