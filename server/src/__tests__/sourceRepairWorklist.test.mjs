/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { registerSourceRepairWorklistRoutes } from '../routes/librariesRouteSourceRepairWorklist.mjs';
import { readSourceRepairWorklist } from '../services/sourceRepairWorklist.mjs';

const row = (patch = {}) => ({
  observed_at: '2026-09-09T12:00:00Z', active_library_count: 2, selected_library_count: 1,
  library_id: 1, library_name: 'Movies', media_server_id: 2, external_id: 'source-key', title: 'Fixture title',
  year: 2020, media_type: 'movie', provider_fields: ['tmdb_id'], last_seen_at: '2026-09-09T11:00:00Z',
  ...patch,
});

test('returns a fair, bounded, provider-neutral source repair worklist', async () => {
  const db = { query: jest.fn().mockResolvedValue({ rows: [row()] }) };
  await expect(readSourceRepairWorklist(db)).resolves.toEqual(expect.objectContaining({
    version: 'library.source_repair_worklist.v1', status: { id: 'complete' },
    scope: expect.objectContaining({ maximumEntries: 32, maximumEntriesPerLibrary: 8, libraryLimit: 12, retentionDays: 30,
      librarySelection: 'daily_rotating_library_id_window', activeLibraryCount: 2, selectedLibraryCount: 1,
      excludedLibraryCount: 1, selectedEntryCount: 1 }),
    conflictCategories: [{ id: 'conflicting_provider_ids', count: 1 }],
    entries: [expect.objectContaining({ library: { name: 'Movies' }, title: 'Fixture title', year: 2020,
      mediaType: 'movie', identityIssue: 'conflicting_provider_ids', providerFields: ['tmdb_id'],
      repairActionId: 'correct_source_match_then_resync' })],
  }));
  const [sql, values] = db.query.mock.calls[0];
  expect(sql).toContain("identity_issue='conflicting_provider_ids'");
  expect(sql).toContain("capture.phase='complete' AND capture.mode='full'");
  expect(sql).toContain('ORDER BY library_rank, library_id');
  expect(sql).toContain("date_trunc('day', statement_timestamp())");
  expect(sql).toContain('LIMIT $4::integer');
  expect(values).toEqual([8, 32, 30, 12]);
  const entry = (await readSourceRepairWorklist({ query: jest.fn().mockResolvedValue({ rows: [row()] }) })).entries[0];
  expect(entry.sourceFingerprint).toMatch(/^[a-f0-9]{64}$/);
  expect(entry.external_id).toBeUndefined();
  expect(entry.mediaServerId).toBeUndefined();
});

test('reports no current conflicts from the anchor row without exposing a synthetic entry', async () => {
  const db = { query: jest.fn().mockResolvedValue({ rows: [row({ library_id: null, library_name: null, media_server_id: null,
    external_id: null, title: null, year: null, media_type: null, provider_fields: null, last_seen_at: null })] }) };
  await expect(readSourceRepairWorklist(db)).resolves.toMatchObject({
    status: { id: 'no_current_conflicts' }, scope: { selectedEntryCount: 0 },
    conflictCategories: [], entries: [],
  });
});

test('read endpoint sets no-store and rejects query parameters before SQL', async () => {
  const db = { query: jest.fn().mockResolvedValue({ rows: [row()] }) };
  const app = express();
  registerSourceRepairWorklistRoutes(app, { db });
  app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ error: 'unavailable' }));
  const bad = await request(app).get('/source-repair-worklist?limit=32');
  expect(bad.status).toBe(400);
  expect(bad.headers['cache-control']).toBe('no-store');
  expect(db.query).not.toHaveBeenCalled();
  await expect(request(app).get('/source-repair-worklist')).resolves.toMatchObject({ status: 200 });
});
