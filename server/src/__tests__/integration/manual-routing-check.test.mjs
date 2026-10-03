/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';
jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());
const db = await import('../../config/database.mjs');
const { captureManualRoutingIntent } = await import('../../services/manualRoutingIntentPersistence.mjs');
const { manualRoutingLibraryFingerprint } = await import('../../services/manualRoutingIntent.mjs');
const { createManualRoutingCheckRepository } = await import('../../services/manualRoutingCheckRepository.mjs');
const { createManualRoutingCheckService } = await import('../../services/manualRoutingCheckService.mjs');
const { resolveRoutingConfig } = await import('../../services/classificationRoutingService.mjs');
let library, providerId, historyId;
const attemptId = 'c98f1028-cbfc-49c6-9e1b-a137c060dd07';
const item = { id: 9, tmdbId: 42, path: '/movies/Fixture' };
const read = jest.fn();
const providers = { radarr: { getMovieByTmdbId: read, buildUrl: () => 'http://fixture' } };

beforeEach(async () => {
  read.mockReset().mockResolvedValue(item);
  providerId = (await getPool().query(`INSERT INTO radarr_config(name,url,api_key,is_active)
    VALUES('Routing check fixture','http://fixture','synthetic-key',true) RETURNING id`)).rows[0].id;
  library = (await getPool().query(`INSERT INTO libraries(name,external_id,media_type,arr_type,arr_id,root_folder,is_active)
    VALUES('Routing check fixture','routing-check-fixture','movie','radarr',$1,'/movies',true) RETURNING *`, [providerId])).rows[0];
  historyId = (await getPool().query(`INSERT INTO classification_history(tmdb_id,media_type,title,library_id,method,status,metadata)
    VALUES(42,'movie','Routing check fixture',$1,'manual_classification','completed',$2) RETURNING id`,
  [library.id, JSON.stringify({ classification_details: { routing: 'manual_routing_pending', manual_routing_attempt_id: attemptId,
    candidate_capture: { status: 'not_applicable' } } })])).rows[0].id;
  await capture();
});
afterEach(async () => {
  await getPool().query('DELETE FROM classification_history WHERE id=$1', [historyId]);
  await getPool().query('DELETE FROM library_arr_mappings WHERE library_id=$1', [library.id]);
  await getPool().query('DELETE FROM libraries WHERE id=$1', [library.id]);
  await getPool().query('DELETE FROM radarr_config WHERE id=$1', [providerId]);
});
async function capture(resolved = library) {
  await captureManualRoutingIntent(db, { classificationId: historyId, library, attemptId }, {
    arrType: 'radarr', configId: providerId, baseUrl: 'http://fixture', libraryFingerprint: manualRoutingLibraryFingerprint(resolved),
    expected: { identityKey: 'tmdbId', identity: 42, rootFolderPath: '/movies' },
  });
}
const service = () => createManualRoutingCheckService({ db, providers });
const history = async () => (await getPool().query('SELECT * FROM classification_history WHERE id=$1', [historyId])).rows[0];

test('fresh service after restart uses persisted intent, not an add; no transaction spans provider I/O', async () => {
  read.mockImplementation(async () => {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM classification_history WHERE id=$1 FOR UPDATE NOWAIT', [historyId]);
      await client.query('SELECT id FROM libraries WHERE id=$1 FOR UPDATE NOWAIT', [library.id]);
    } finally { await client.query('ROLLBACK'); client.release(); }
    return item;
  });
  expect(await service().check(historyId)).toMatchObject({ reason: 'verified_present', recorded: true });
  expect(await service().check(historyId)).toMatchObject({ reason: 'verified_present', recorded: true });
  const row = await history();
  expect(row.status).toBe('completed');
  expect(row.metadata.classification_details).toMatchObject({ routing: 'manual_routing_pending',
    candidate_capture: { status: 'not_applicable' }, manual_routing_observation: { reason: 'verified_present' } });
  expect(JSON.stringify(row.metadata)).not.toMatch(/synthetic-key|http:\/\/fixture/);
  expect(read).toHaveBeenCalledTimes(2);
  await expect(capture()).rejects.toThrow('could not be saved');
});

test.each(['endpoint', 'library', 'provider', 'identity', 'legacy'])('changed %s blocks reads', async change => {
  if (change === 'endpoint') await getPool().query("UPDATE radarr_config SET url='http://other' WHERE id=$1", [providerId]);
  if (change === 'library') await getPool().query("UPDATE libraries SET root_folder='/other' WHERE id=$1", [library.id]);
  if (change === 'provider') await getPool().query('UPDATE radarr_config SET is_active=false WHERE id=$1', [providerId]);
  if (change === 'identity') await getPool().query('UPDATE classification_history SET tmdb_id=43 WHERE id=$1', [historyId]);
  if (change === 'legacy') await getPool().query("UPDATE classification_history SET metadata=metadata #- '{classification_details,manual_routing_intent}' WHERE id=$1", [historyId]);
  expect((await service().check(historyId)).recorded).toBe(false);
  expect(read).not.toHaveBeenCalled();
});

test('mapping-only libraries use the same resolution and refuse changed mappings', async () => {
  await getPool().query('UPDATE libraries SET arr_type=NULL,arr_id=NULL,root_folder=NULL WHERE id=$1', [library.id]);
  await getPool().query(`INSERT INTO library_arr_mappings(library_id,arr_type,arr_config_id,arr_root_folder_id,arr_root_folder_path,quality_profile_id)
    VALUES($1,'radarr',$2,1,'/movies',1)`, [library.id, providerId]);
  await getPool().query("UPDATE classification_history SET metadata=metadata #- '{classification_details,manual_routing_intent}' WHERE id=$1", [historyId]);
  const current = (await getPool().query('SELECT * FROM libraries WHERE id=$1', [library.id])).rows[0];
  await capture(await resolveRoutingConfig(current));
  expect((await service().check(historyId)).reason).toBe('verified_present');
  await getPool().query("UPDATE library_arr_mappings SET arr_root_folder_path='/other' WHERE library_id=$1", [library.id]);
  expect((await service().check(historyId)).reason).toBe('configuration_changed');
  expect(read).toHaveBeenCalledTimes(1);
});

test.each(['settings', 'token', 'decision', 'observation'])('late read cannot overwrite changed %s', async change => {
  read.mockImplementation(async () => {
    if (change === 'settings') await getPool().query('UPDATE libraries SET is_active=false WHERE id=$1', [library.id]);
    if (change === 'decision') await getPool().query("UPDATE classification_history SET status='failed' WHERE id=$1", [historyId]);
    if (change === 'token') await getPool().query("UPDATE classification_history SET metadata=jsonb_set(metadata,'{classification_details,manual_routing_attempt_id}','\"changed\"') WHERE id=$1", [historyId]);
    if (change === 'observation') await getPool().query("UPDATE classification_history SET metadata=jsonb_set(metadata,'{classification_details,manual_routing_observation}','{\"reason\":\"newer\"}') WHERE id=$1", [historyId]);
    return item;
  });
  expect(await service().check(historyId)).toMatchObject({ reason: 'changed', recorded: false });
  expect((await history()).metadata.classification_details.manual_routing_observation?.reason).not.toBe('verified_present');
});

test('current credentials may rotate without changing the verification target', async () => {
  await getPool().query("UPDATE radarr_config SET api_key='rotated-synthetic' WHERE id=$1", [providerId]);
  expect((await service().check(historyId)).reason).toBe('verified_present');
  expect(read).toHaveBeenCalledWith('http://fixture', 'rotated-synthetic', 42);
});

test('lock contention fails within the budget and preserves history', async () => {
  const records = createManualRoutingCheckRepository({ db, providers });
  const initial = await records.load(historyId);
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM classification_history WHERE id=$1 FOR UPDATE', [historyId]);
    await expect(records.save(initial, { reason: 'verified_present' })).rejects.toMatchObject({ code: '55P03' });
  } finally { await client.query('ROLLBACK'); client.release(); }
  expect((await history()).metadata.classification_details.manual_routing_observation).toBeUndefined();
});
