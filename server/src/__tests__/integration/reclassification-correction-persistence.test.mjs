/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, beforeEach, afterEach, test, expect } from '@jest/globals';
import { getPool, createIntegrationDatabaseModuleMock } from './setup.mjs';

const move = jest.fn();
const rollback = jest.fn();
jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());
jest.unstable_mockModule('../../services/reclassificationMoves.mjs', () => ({ moveMovie: move, moveSeries: move }));
jest.unstable_mockModule('../../services/reclassificationQueries.mjs', () => ({ rollback,
  previewReclassification: jest.fn(), triggerPlexScan: jest.fn().mockResolvedValue({ scans: [] }) }));
jest.unstable_mockModule('../../services/libraryMappingService.mjs', () => ({ libraryMappingService: {
  getLibraryMapping: async () => ({ arr_type: 'radarr', arr_root_folder_path: '/synthetic' }),
} }));
const { ReclassificationService } = await import('../../services/reclassificationService.mjs');
let db, libraries, row;
beforeEach(async () => {
  db = getPool();
  libraries = (await db.query(`INSERT INTO libraries(name,external_id,media_type)
    VALUES('Move A','capture-move-a','movie'),('Move B','capture-move-b','movie') RETURNING id`)).rows.map(value => value.id);
  row = (await db.query(`INSERT INTO classification_history(tmdb_id,media_type,title,library_id,status)
    VALUES(920001,'movie','Synthetic move',$1,'completed') RETURNING *`, [libraries[0]])).rows[0];
  move.mockReset().mockResolvedValue({ success: true, newPath: '/synthetic/new', oldPath: '/synthetic/old' });
  rollback.mockReset().mockResolvedValue(undefined);
});
afterEach(async () => {
  await db.query('DELETE FROM classification_history WHERE id=$1', [row.id]);
  await db.query('DELETE FROM libraries WHERE id=ANY($1::integer[])', [libraries]);
});

test('external move followed by database commit records history, event and bounded evidence', async () => {
  expect((await new ReclassificationService().executeReclassification({
    classificationId: row.id, targetLibraryId: libraries[1], correctedBy: 'operator',
  })).success).toBe(true);
  expect((await db.query('SELECT library_id,status FROM classification_history WHERE id=$1', [row.id])).rows[0])
    .toEqual({ library_id: libraries[1], status: 'reclassified' });
  expect((await db.query('SELECT identity_key FROM classification_correction_outcomes WHERE selected_library_id=$1', [libraries[1]])).rows)
    .toEqual([{ identity_key: 'movie:920001' }]);
  expect(rollback).not.toHaveBeenCalled();
});

test('identity drift during the external move cannot commit a stale correction label', async () => {
  move.mockImplementationOnce(async () => {
    await db.query('UPDATE classification_history SET tmdb_id=920002 WHERE id=$1', [row.id]);
    return { success: true };
  });
  await expect(new ReclassificationService().executeReclassification({ classificationId: row.id,
    targetLibraryId: libraries[1], correctedBy: 'operator' })).rejects.toThrow('Classification changed');
  expect((await db.query('SELECT library_id FROM classification_history WHERE id=$1', [row.id])).rows[0].library_id).toBe(libraries[0]);
  expect((await db.query('SELECT * FROM classification_corrections WHERE classification_id=$1', [row.id])).rows).toHaveLength(0);
  expect((await db.query('SELECT * FROM classification_correction_outcomes WHERE selected_library_id=$1', [libraries[1]])).rows).toHaveLength(0);
  // This verifies the existing hook, not physical compensation (the production hook only logs).
  expect(rollback).toHaveBeenCalledTimes(1);
});

test('correction insert failure rolls back the already-issued history update', async () => {
  await expect(new ReclassificationService().executeReclassification({ classificationId: row.id,
    targetLibraryId: libraries[1], correctedBy: 'x'.repeat(101) })).rejects.toMatchObject({ code: '22001' });
  expect((await db.query('SELECT library_id,status FROM classification_history WHERE id=$1', [row.id])).rows[0])
    .toEqual({ library_id: libraries[0], status: 'completed' });
  expect((await db.query('SELECT * FROM classification_correction_outcomes WHERE selected_library_id=$1', [libraries[1]])).rows).toHaveLength(0);
  expect(rollback).toHaveBeenCalledTimes(1);
});
