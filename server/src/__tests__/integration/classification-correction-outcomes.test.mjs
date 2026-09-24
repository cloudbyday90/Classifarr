/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, test, expect } from '@jest/globals';
import { getPool } from './setup.mjs';
import { recordClassificationCorrection, pruneClassificationCorrectionOutcomes } from '../../services/classificationCorrectionWriter.mjs';
import { INVENTORY_OUTCOME_LABEL_SQL, prepareInventoryOutcomeLabels } from '../../services/inventoryOutcomeLabels.mjs';
import { inventorySourceDescriptionKey } from '../../services/inventorySourceDescriptionIdentity.mjs';
import { applyPolicyManualCorrectionLifecycle } from '../../services/policyManualCorrectionExecutionLifecycle.mjs';
import { persistDiscordCorrection } from '../../services/discordCorrectionPersistence.mjs';

let client, libraries;
beforeEach(async () => {
  client = await getPool().connect();
  await client.query('BEGIN');
  libraries = (await client.query(`INSERT INTO libraries(name,external_id,media_type)
    VALUES('Capture movie A','capture-ma','movie'),('Capture movie B','capture-mb','movie'),
      ('Capture TV A','capture-ta','tv'),('Capture TV B','capture-tb','tv') RETURNING *`)).rows;
});
afterEach(async () => { await client.query('ROLLBACK'); client.release(); });

async function history(type = 'movie', overrides = {}) {
  const library = libraries.find(row => row.media_type === type);
  return (await client.query(`INSERT INTO classification_history(tmdb_id,media_type,title,year,library_id,status,method,metadata)
    VALUES($1,$2,'Synthetic correction item',2020,$3,'corrected','source_library',$4) RETURNING *`,
  [Object.hasOwn(overrides, 'tmdb_id') ? overrides.tmdb_id : 920001, type, library.id, overrides.metadata ?? {}])).rows[0];
}
async function write(row, options = {}) {
  return recordClassificationCorrection(client, { classification: row, originalLibraryId: row.library_id,
    destinationLibraryId: libraries.filter(library => library.media_type === row.media_type)[1].id,
    correctedBy: 'synthetic-operator', ...options });
}
async function outcomes() {
  return (await client.query(INVENTORY_OUTCOME_LABEL_SQL)).rows
    .filter(row => libraries.some(library => library.id === row.selected_library_id));
}

test.each(['movie', 'tv'])('new %s outcomes survive mutable history, event cleanup, and history deletion', async type => {
  const row = await history(type), event = await write(row);
  expect(event.id).toBeGreaterThan(0);
  expect(await outcomes()).toEqual([expect.objectContaining({ tmdb_id: 920001, identity_key: `${type}:920001` })]);
  await client.query("UPDATE classification_history SET tmdb_id=920002,status='pending' WHERE id=$1", [row.id]);
  await client.query('DELETE FROM classification_corrections WHERE classification_id=$1', [row.id]);
  await client.query('DELETE FROM classification_history WHERE id=$1', [row.id]);
  expect(await outcomes()).toEqual([expect.objectContaining({ tmdb_id: 920001, identity_key: `${type}:920001` })]);
});

test('API lifecycle captures evidence without a mutable history join or double counting', async () => {
  const row = await history();
  const result = await applyPolicyManualCorrectionLifecycle({ client, classificationId: row.id,
    destinationLibraryId: libraries[1].id, actorId: 'synthetic-operator' });
  expect(result.ok).toBe(true);
  expect(await outcomes()).toHaveLength(1);
  expect((await client.query('SELECT library_id FROM classification_history WHERE id=$1', [row.id])).rows[0].library_id).toBe(libraries[1].id);
});

test('failure after capture rolls back history, event and evidence together', async () => {
  const row = await history();
  await client.query('SAVEPOINT correction');
  await applyPolicyManualCorrectionLifecycle({ client, classificationId: row.id, destinationLibraryId: libraries[1].id, actorId: 'operator' });
  await client.query('ROLLBACK TO SAVEPOINT correction');
  expect(await outcomes()).toHaveLength(0);
  expect((await client.query('SELECT library_id FROM classification_history WHERE id=$1', [row.id])).rows[0].library_id).toBe(row.library_id);
  expect((await client.query('SELECT * FROM classification_corrections WHERE classification_id=$1', [row.id])).rows).toHaveLength(0);
});

test('a snapshot constraint failure cannot commit the correction event or history transition', async () => {
  const row = await history();
  await client.query('SAVEPOINT failing_capture');
  await client.query('ALTER TABLE classification_correction_outcomes ADD CONSTRAINT synthetic_failure CHECK (false)');
  await expect(applyPolicyManualCorrectionLifecycle({ client, classificationId: row.id,
    destinationLibraryId: libraries[1].id, actorId: 'operator' })).rejects.toMatchObject({ code: '23514' });
  await client.query('ROLLBACK TO SAVEPOINT failing_capture');
  expect(await outcomes()).toHaveLength(0);
  expect((await client.query('SELECT library_id FROM classification_history WHERE id=$1', [row.id])).rows[0].library_id).toBe(row.library_id);
  expect((await client.query('SELECT * FROM classification_corrections WHERE classification_id=$1', [row.id])).rows).toHaveLength(0);
});

test('Discord outcome failure rolls back its history and correction through the transaction owner', async () => {
  const row = await history();
  const db = { withTransaction: async callback => {
    await client.query('SAVEPOINT discord_correction');
    try { return await callback(client); }
    catch (error) { await client.query('ROLLBACK TO SAVEPOINT discord_correction'); throw error; }
  } };
  await expect(persistDiscordCorrection(db, { recordOutcome: async () => ({ updated: false }) },
    { classificationId: row.id, newLibraryId: libraries[1].id, actor: 'operator' })).rejects.toThrow('outcome_not_recorded');
  expect(await outcomes()).toHaveLength(0);
  expect((await client.query('SELECT library_id FROM classification_history WHERE id=$1', [row.id])).rows[0].library_id).toBe(row.library_id);
});

test('source-only capture requires the exact typed inventory pointer and preserves no raw metadata', async () => {
  const server = (await client.query(`INSERT INTO media_server(type,name,url,api_key)
    VALUES('plex','Synthetic','http://unused.invalid','synthetic') RETURNING id`)).rows[0].id;
  const source = (await client.query(`INSERT INTO media_server_items(media_server_id,library_id,external_id,title,year,media_type)
    VALUES($1,$2,'synthetic-source','Synthetic correction item',2020,'movie') RETURNING *`, [server, libraries[0].id])).rows[0];
  const row = await history('movie', { tmdb_id: null, metadata: { itemId: source.id, source_library_id: source.library_id } });
  await write(row);
  const rows = await outcomes();
  const key = inventorySourceDescriptionKey(source);
  expect(rows).toEqual([expect.objectContaining({ identity_key: key, tmdb_id: null })]);
  expect(prepareInventoryOutcomeLabels(rows, [{ key, libraryIds: [libraries[0].id] }], libraries).coverage.corrections).toBe(1);
  const snapshot = (await client.query('SELECT * FROM classification_correction_outcomes WHERE selected_library_id=$1', [libraries[1].id])).rows;
  expect(Object.keys(snapshot[0]).sort()).toEqual(['correction_id', 'identity_key', 'media_type', 'observed_at', 'selected_library_id']);
  await client.query("UPDATE media_server_items SET title='Changed identity' WHERE id=$1", [source.id]);
  await write(row);
  expect(await outcomes()).toHaveLength(1);
});

test('missing identity, same destination, and blank actor never produce synthetic labels', async () => {
  await write(await history('movie', { tmdb_id: null }));
  const row = await history();
  await write(row, { destinationLibraryId: row.library_id });
  await write(row, { correctedBy: '   ' });
  expect(await outcomes()).toHaveLength(0);
});

test('inactive/type-changed destinations are excluded and library deletion cascades snapshots', async () => {
  await write(await history());
  await client.query('UPDATE libraries SET is_active=false WHERE id=$1', [libraries[1].id]);
  expect(await outcomes()).toHaveLength(0);
  await client.query("UPDATE libraries SET is_active=true,media_type='tv' WHERE id=$1", [libraries[1].id]);
  expect(await outcomes()).toHaveLength(0);
  await client.query('DELETE FROM libraries WHERE id=$1', [libraries[1].id]);
  expect((await client.query('SELECT * FROM classification_correction_outcomes WHERE selected_library_id=$1', [libraries[1].id])).rows).toHaveLength(0);
});

test('expired snapshots and legacy events cannot reappear after bounded cleanup', async () => {
  const row = await history(), event = await write(row);
  await client.query('UPDATE classification_history SET library_id=$1 WHERE id=$2', [libraries[1].id, row.id]);
  await client.query("UPDATE classification_corrections SET created_at=NOW()-INTERVAL '31 days' WHERE id=$1", [event.id]);
  await client.query("UPDATE classification_correction_outcomes SET observed_at=NOW()-INTERVAL '31 days' WHERE correction_id=$1", [event.id]);
  expect(await outcomes()).toHaveLength(0);
  expect(await pruneClassificationCorrectionOutcomes(client)).toBe(1);
  expect(await outcomes()).toHaveLength(0);
});

test('expiry has a 1000-row budget and the next pass drains the remainder', async () => {
  await client.query(`INSERT INTO classification_correction_outcomes(correction_id,media_type,identity_key,selected_library_id,observed_at)
    SELECT n,'movie','movie:920001',$1,NOW()-INTERVAL '31 days' FROM generate_series(1000000,1001000) n`, [libraries[1].id]);
  expect(await pruneClassificationCorrectionOutcomes(client)).toBe(1000);
  expect(await pruneClassificationCorrectionOutcomes(client)).toBe(1);
});
