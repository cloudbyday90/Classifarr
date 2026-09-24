/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, beforeEach, afterEach, test, expect } from '@jest/globals';
import { getPool, createIntegrationDatabaseModuleMock } from './setup.mjs';
import { classificationMoveRevision } from '../../services/reclassificationMoveContract.mjs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const { ReclassificationService } = await import('../../services/reclassificationService.mjs');
const { createReclassificationMoveAdapter } = await import('../../services/reclassificationMoves.mjs');
const { FileOperationsService } = await import('../../services/fileOperationsService.mjs');

let db, database, libraries, row, adapter, service, remoteAvailable;
beforeEach(async () => {
  db = getPool();
  database = createIntegrationDatabaseModuleMock();
  libraries = (await db.query(`INSERT INTO libraries(name,external_id,media_type)
    VALUES('Move A','capture-move-a','movie'),('Move B','capture-move-b','movie') RETURNING id`)).rows.map(value => value.id);
  row = (await db.query(`INSERT INTO classification_history(tmdb_id,media_type,title,library_id,status)
    VALUES(920001,'movie','Synthetic move',$1,'completed') RETURNING *`, [libraries[0]])).rows[0];
  remoteAvailable = true;
  adapter = {
    prepare: jest.fn(async classification => ({ mediaType: classification.media_type, providerId: 920001, configId: 1, remoteId: 2,
      originalLibraryId: libraries[0], targetLibraryId: libraries[1], oldPath: '/synthetic/old/item', newPath: '/synthetic/new/item',
      localOldPath: '/synthetic/old/item', localNewPath: '/synthetic/new/item', classificationStatus: classification.status,
      classificationRevision: classificationMoveRevision(classification) })),
    moveFiles: jest.fn().mockResolvedValue(undefined),
    reconcile: jest.fn(async () => { if (!remoteAvailable) throw new Error('remote offline'); }),
  };
  service = new ReclassificationService({ database, adapter, scan: jest.fn().mockResolvedValue({ success: true }) });
});
afterEach(async () => {
  await db.query('DELETE FROM reclassification_move_operations');
  await db.query('DELETE FROM classification_history WHERE library_id=ANY($1::integer[]) OR id=$2', [libraries, row.id]);
  await db.query('DELETE FROM libraries WHERE id=ANY($1::integer[])', [libraries]);
});
const execute = () => service.executeReclassification({ classificationId: row.id, targetLibraryId: libraries[1], correctedBy: 'operator' });
const journal = async () => (await db.query('SELECT * FROM reclassification_move_operations WHERE classification_id=$1 ORDER BY created_at DESC', [row.id])).rows[0];
const makeDue = () => db.query('UPDATE reclassification_move_operations SET next_attempt_at=NOW()');

test('external verification followed by commit records history, event, evidence and operation together', async () => {
  expect((await execute()).success).toBe(true);
  expect((await db.query('SELECT library_id,status FROM classification_history WHERE id=$1', [row.id])).rows[0])
    .toEqual({ library_id: libraries[1], status: 'reclassified' });
  expect((await db.query('SELECT identity_key FROM classification_correction_outcomes WHERE selected_library_id=$1', [libraries[1]])).rows)
    .toEqual([{ identity_key: 'movie:920001' }]);
  expect((await journal()).state).toBe('completed');
  await execute();
  expect(adapter.moveFiles).toHaveBeenCalledTimes(1);
  expect((await db.query('SELECT * FROM classification_corrections WHERE classification_id=$1', [row.id])).rows).toHaveLength(1);
});
test('restart after file work can finish durable intent without repeating file work', async () => {
  adapter.moveFiles.mockRejectedValueOnce(new Error('crashed after file movement'));
  await expect(execute()).rejects.toMatchObject({ status: 503 });
  expect((await journal()).state).toBe('moving');
  service = new ReclassificationService({ database, adapter, scan: jest.fn() });
  await makeDue();
  expect(await service.recoverDue()).toEqual({ status: 'completed' });
  expect((await journal()).state).toBe('completed');
  expect(adapter.moveFiles).toHaveBeenCalledTimes(1);
});
test('outage retries preserve journal, back off, and finish automatically when remote returns', async () => {
  remoteAvailable = false;
  await expect(execute()).rejects.toMatchObject({ status: 503 });
  const pending = await journal();
  expect(pending.attempts).toBe(1);
  expect(new Date(pending.next_attempt_at).getTime()).toBeGreaterThan(Date.now());
  expect(await service.recoverDue()).toEqual({ status: 'idle' });
  await makeDue();
  expect(await service.recoverDue()).toEqual({ status: 'deferred' });
  remoteAvailable = true;
  await makeDue();
  expect(await service.recoverDue()).toEqual({ status: 'completed' });
  expect(adapter.moveFiles).toHaveBeenCalledTimes(1);
});
test('identity drift during external verification cannot commit stale correction evidence', async () => {
  adapter.reconcile.mockImplementationOnce(async () => {
    await db.query('UPDATE classification_history SET tmdb_id=920002 WHERE id=$1', [row.id]);
  });
  await expect(execute()).rejects.toMatchObject({ code: 'move_classification_changed' });
  expect((await journal()).state).toBe('needs_attention');
  expect((await db.query('SELECT library_id FROM classification_history WHERE id=$1', [row.id])).rows[0].library_id).toBe(libraries[0]);
  expect((await db.query('SELECT * FROM classification_corrections WHERE classification_id=$1', [row.id])).rows).toHaveLength(0);
  await makeDue();
  expect(await service.recoverDue()).toEqual({ status: 'idle' });
});
test('correction insert failure rolls back history and completion, then retry captures once', async () => {
  const transaction = database.withTransaction;
  let fail = true;
  database.withTransaction = callback => transaction(client => callback({
    query: async (sql, values) => {
      if (fail && sql.includes('INSERT INTO classification_corrections')) { fail = false; throw new Error('injected snapshot outage'); }
      return client.query(sql, values);
    },
  }));
  await expect(execute()).rejects.toMatchObject({ status: 503 });
  expect((await db.query('SELECT library_id,status FROM classification_history WHERE id=$1', [row.id])).rows[0])
    .toEqual({ library_id: libraries[0], status: 'completed' });
  expect((await journal()).state).toBe('files_verified');
  expect((await db.query('SELECT * FROM classification_correction_outcomes WHERE selected_library_id=$1', [libraries[1]])).rows).toHaveLength(0);
  await makeDue();
  expect(await service.recoverDue()).toEqual({ status: 'completed' });
  expect(adapter.moveFiles).toHaveBeenCalledTimes(1);
  expect((await db.query('SELECT * FROM classification_corrections WHERE classification_id=$1', [row.id])).rows).toHaveLength(1);
});
test('journal survives history deletion and safely stops recovery', async () => {
  remoteAvailable = false;
  await expect(execute()).rejects.toThrow();
  await db.query('DELETE FROM classification_history WHERE id=$1', [row.id]);
  await makeDue();
  expect(await service.recoverDue()).toEqual({ status: 'deferred' });
  expect((await journal()).state).toBe('needs_attention');
  expect((await journal()).reason_code).toBe('move_classification_changed');
});
test('another history row for the same remote resource cannot initiate a second move', async () => {
  remoteAvailable = false;
  await expect(execute()).rejects.toThrow();
  const duplicate = (await db.query(`INSERT INTO classification_history(tmdb_id,media_type,title,library_id,status)
    VALUES(920001,'movie','Synthetic duplicate',$1,'completed') RETURNING id`, [libraries[0]])).rows[0];
  await expect(service.executeReclassification({ classificationId: duplicate.id, targetLibraryId: libraries[1] }))
    .rejects.toMatchObject({ code: 'move_reserved' });
  expect(adapter.moveFiles).toHaveBeenCalledTimes(1);
});
test('real advisory lock prevents a concurrent request from starting', async () => {
  const client = await db.connect();
  try {
    await client.query('SELECT pg_advisory_lock(2021)');
    await expect(execute()).rejects.toMatchObject({ code: 'move_busy' });
    expect(adapter.moveFiles).not.toHaveBeenCalled();
  } finally { await client.query('SELECT pg_advisory_unlock(2021)'); client.release(); }
});
test('invalid actors are rejected before file movement', async () => {
  await expect(service.executeReclassification({ classificationId: row.id,
    targetLibraryId: libraries[1], correctedBy: 'x'.repeat(101) })).rejects.toThrow('actor');
  expect(adapter.moveFiles).not.toHaveBeenCalled();
});
test('completed retention prunes at most 100 rows and never removes unresolved evidence', async () => {
  await execute();
  const original = await journal();
  await db.query(`INSERT INTO reclassification_move_operations
    (id,classification_id,target_library_id,resource_key,plan,corrected_by,state,completed_at)
    SELECT gen_random_uuid(), $1,$2,'synthetic-retention-' || n,$3::jsonb,'operator','completed',NOW()-INTERVAL '31 days'
    FROM generate_series(1,105) n`, [row.id, libraries[1], JSON.stringify(original.plan)]);
  await service.recoverDue();
  expect((await db.query("SELECT count(*)::integer AS count FROM reclassification_move_operations WHERE completed_at < NOW()-INTERVAL '30 days'")).rows[0].count).toBe(5);
  expect((await db.query('SELECT count(*)::integer AS count FROM reclassification_move_operations')).rows[0].count).toBe(6);
});

test('real temporary files, real journal, and simulated lost remote response recover end to end', async () => {
  const temp = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'classifarr-journal-move-')));
  const sourceRoot = path.join(temp, 'source').replaceAll('\\', '/');
  const targetRoot = path.join(temp, 'target').replaceAll('\\', '/');
  const source = `${sourceRoot}/item`, destination = `${targetRoot}/item`;
  try {
    await fs.mkdir(source, { recursive: true });
    await fs.mkdir(targetRoot);
    await fs.writeFile(path.join(source, 'synthetic.txt'), 'synthetic content only');
    const fileService = new FileOperationsService({ db: database, logger: { info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() } });
    const files = { translatePath: async value => value,
      moveFolder: jest.fn((...args) => fileService.moveFolder(...args)) };
    const remote = { id: 4, tmdbId: row.tmdb_id, path: source, qualityProfileId: 1 };
    const radarr = { getMovieByTmdbId: async () => ({ ...remote }), getMovieById: async () => ({ ...remote }),
      validatePathInRootFolder: async () => ({ isValid: true }),
      updateMoviePath: jest.fn(async (_url, _key, _id, next) => { remote.path = next; throw new Error('lost response'); }) };
    const moveAdapter = createReclassificationMoveAdapter({
      database: { query: (sql, values) => sql.includes('radarr_config') ? { rows: [{ url: 'http://synthetic.invalid', api_key: 'test' }] } : database.query(sql, values) },
      mappings: { getLibraryMapping: async id => ({ arr_config_id: 1, arr_type: 'radarr', quality_profile_id: 1,
        arr_root_folder_path: id === libraries[0] ? sourceRoot : targetRoot }) }, files, radarr,
    });
    service = new ReclassificationService({ database, adapter: moveAdapter, scan: jest.fn() });
    await expect(execute()).rejects.toMatchObject({ status: 503 });
    await expect(fs.stat(source)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await fs.readFile(path.join(destination, 'synthetic.txt'), 'utf8')).toBe('synthetic content only');
    await makeDue();
    expect(await service.recoverDue()).toEqual({ status: 'completed' });
    expect(files.moveFolder).toHaveBeenCalledTimes(1);
    expect(radarr.updateMoviePath).toHaveBeenCalledTimes(1);
    expect((await journal()).state).toBe('completed');
  } finally { await fs.rm(temp, { recursive: true, force: true }); }
});

test('different remote IDs cannot reserve overlapping filesystem paths', async () => {
  remoteAvailable = false;
  await expect(execute()).rejects.toThrow();
  const duplicate = (await db.query(`INSERT INTO classification_history(tmdb_id,media_type,title,library_id,status)
    VALUES(920005,'movie','Synthetic overlap',$1,'completed') RETURNING id`, [libraries[0]])).rows[0];
  const prepare = adapter.prepare.getMockImplementation();
  adapter.prepare.mockImplementation(async (...args) => ({ ...await prepare(...args), remoteId: 555,
    localOldPath: '/synthetic/old/item/child', localNewPath: '/synthetic/other/item' }));
  await expect(service.executeReclassification({ classificationId: duplicate.id, targetLibraryId: libraries[1] }))
    .rejects.toMatchObject({ code: 'move_reserved' });
  expect(adapter.moveFiles).toHaveBeenCalledTimes(1);
});

test('capacity refuses new moves without deleting unresolved reservations', async () => {
  await db.query(`INSERT INTO reclassification_move_operations
    (id,classification_id,target_library_id,resource_key,plan,corrected_by,state)
    SELECT gen_random_uuid(), 1000000+n,$1,'synthetic-capacity-' || n,'{}'::jsonb,'operator','needs_attention'
    FROM generate_series(1,1000) n`, [libraries[1]]);
  await expect(execute()).rejects.toMatchObject({ code: 'move_reserved' });
  expect(adapter.moveFiles).not.toHaveBeenCalled();
  await service.recoverDue();
  expect((await db.query('SELECT count(*)::integer AS count FROM reclassification_move_operations')).rows[0].count).toBe(1000);
});
