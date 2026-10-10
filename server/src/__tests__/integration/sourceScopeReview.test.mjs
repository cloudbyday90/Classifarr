/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { getPool } from './setup.mjs';
import { readSourceIdentityIssues } from '../../services/sourceIdentityIssues.mjs';
import { reviewSourceScope } from '../../services/sourceScopeReview.mjs';

let client, serverId, libraryId, actorId;
beforeEach(async () => {
  client = await getPool().connect(); await client.query('BEGIN');
  actorId = (await client.query(`INSERT INTO users(username,password_hash,role,is_active)
    VALUES ($1,'fixture','admin',true) RETURNING id`, [randomUUID()])).rows[0].id;
  serverId = (await client.query(`INSERT INTO media_server(type,name,url,api_key,is_active)
    VALUES ('plex',$1,'http://fixture.invalid','fixture-secret',true) RETURNING id`, [randomUUID()])).rows[0].id;
  libraryId = (await client.query(`INSERT INTO libraries(name,external_id,media_type,media_server_id,is_active)
    VALUES ($1,'library','tv',$2,true) RETURNING id`, [randomUUID(), serverId])).rows[0].id;
  await client.query(`INSERT INTO media_source_capture_state(library_id,media_server_id,generation,mode,phase,source)
    VALUES ($1,$2,2,'full','complete','media_sync')`, [libraryId, serverId]);
  await client.query(`INSERT INTO media_source_observations
    (library_id,media_server_id,external_id,title,media_type,identity_issue,provider_fields,generation)
    VALUES ($1,$2,'private-source','Fixture','tv','conflicting_provider_ids',ARRAY['tvdb_id'],2)`, [libraryId, serverId]);
});
afterEach(async () => { await client.query('ROLLBACK'); client.release(); });
const inputFor = item => ({ offset: 0, sourceVersion: item.sourceVersion, scope: { kind: 'whole_work', tmdbId: 10 } });
const read = async () => (await readSourceIdentityIssues(client)).items.find(item => item.libraryId === libraryId);
test('reviews real retained evidence and preserves every observation field', async () => {
  const item = await read(); expect(item.sourceVersion).toMatch(/^[a-f0-9]{64}$/);
  const before = (await client.query('SELECT * FROM media_source_observations WHERE library_id=$1', [libraryId])).rows;
  const result = await reviewSourceScope(client, actorId, item.key, inputFor(item));
  expect(result).toMatchObject({ canApply: false, persisted: false, parentConflict: { providerFields: ['tvdb_id'] } });
  expect(JSON.stringify(result)).not.toMatch(/fixture-secret|fixture.invalid|private-source/);
  expect((await client.query('SELECT * FROM media_source_observations WHERE library_id=$1', [libraryId])).rows).toEqual(before);
});
test.each([
  ["UPDATE libraries SET is_active=false WHERE id=$1", 'library'],
  ["UPDATE media_source_capture_state SET phase='collecting' WHERE library_id=$1", 'library'],
  ["UPDATE media_source_observations SET provider_fields=ARRAY['tmdb_id'] WHERE library_id=$1", 'library'],
  ["UPDATE media_source_observations SET last_seen_at=statement_timestamp()-INTERVAL '31 days' WHERE library_id=$1", 'library'],
  ["UPDATE media_server SET api_key='changed-secret' WHERE id=$1", 'server'],
  ["UPDATE media_server SET url='http://changed.invalid' WHERE id=$1", 'server'],
  ["UPDATE media_server SET is_active=false WHERE id=$1", 'server'],
  ["UPDATE libraries SET external_id='changed' WHERE id=$1", 'library'],
])('rejects stale evidence: %s', async (sql, target) => {
  const item = await read(); await client.query(sql, [target === 'server' ? serverId : libraryId]);
  await expect(reviewSourceScope(client, actorId, item.key, inputFor(item))).rejects.toMatchObject({ statusCode: 409 });
});
test('denies a demoted database actor despite an older administrator session', async () => {
  const item = await read(); await client.query("UPDATE users SET role='user' WHERE id=$1", [actorId]);
  await expect(reviewSourceScope(client, actorId, item.key, inputFor(item))).rejects.toMatchObject({ statusCode: 403 });
});
