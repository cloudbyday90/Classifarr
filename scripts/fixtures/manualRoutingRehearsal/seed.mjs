/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { assertFixtureEnvironment, writeFixtureFile, request, sessionFrom, backgroundPath } from './support.mjs';

export async function seed(db) {
  assertFixtureEnvironment();
  for (const table of ['users', 'libraries', 'classification_history', 'manual_routing_check_state']) {
    assert.equal((await db.query(`SELECT count(*)::integer AS n FROM ${table}`)).rows[0].n, 0, 'fixture_not_empty');
  }
  assert.equal((await db.query("SELECT to_regclass('manual_routing_provider_state') AS name")).rows[0].name, null,
    'baseline_already_has_guard');
  mkdirSync('/app/data/routing-rehearsal', { recursive: true, mode: 0o700 });
  const password = `Fixture-${randomBytes(24).toString('hex')}!`;
  const session = sessionFrom(await request('/api/setup/create-admin', {
    body: { username: 'routing-drill-admin', password, confirmPassword: password },
  }));
  const { hashPassword } = await import('/app/src/services/auth.mjs');
  await db.query("INSERT INTO users(username,password_hash,role,is_active,must_change_password) VALUES('routing-drill-user',$1,'user',true,false)",
    [await hashPassword(password)]);
  const user = sessionFrom(await request('/api/auth/login', { body: { identifier: 'routing-drill-user', password } }));
  const { captureManualRoutingIntent } = await import('/app/src/services/manualRoutingIntentPersistence.mjs');
  const { manualRoutingLibraryFingerprint } = await import('/app/src/services/manualRoutingIntent.mjs');
  const items = [];
  for (const [type, arr, identityKey, root] of [['movie', 'radarr', 'tmdbId', '/movies'], ['tv', 'sonarr', 'tvdbId', '/tv']]) {
    const url = `http://127.0.0.1:21400/${arr}`;
    const config = (await db.query(`INSERT INTO ${arr}_config(name,url,api_key,is_active)
      VALUES('Routing rehearsal',$1,'synthetic-key',true) RETURNING id`, [url])).rows[0].id;
    const library = (await db.query(`INSERT INTO libraries(name,external_id,media_type,arr_type,arr_id,root_folder,is_active)
      VALUES('Routing rehearsal',$1,$2,$3,$4,$5,true) RETURNING *`, [`routing-${type}`, type, arr, config, root])).rows[0];
    const attemptId = randomUUID();
    const id = (await db.query(`INSERT INTO classification_history(tmdb_id,media_type,title,library_id,method,status,metadata)
      VALUES(42,$1,'Routing rehearsal',$2,'manual_classification','completed',$3) RETURNING id`, [type, library.id,
      JSON.stringify({ classification_details: { routing: 'manual_routing_pending', manual_routing_attempt_id: attemptId } })])).rows[0].id;
    await captureManualRoutingIntent(db, { classificationId: id, library, attemptId }, {
      arrType: arr, configId: config, baseUrl: url, libraryFingerprint: manualRoutingLibraryFingerprint(library),
      expected: { identityKey, identity: 42, rootFolderPath: root },
    });
    // Keep the real scheduler idle until the isolated scenario explicitly arms this item.
    await db.query(`INSERT INTO manual_routing_check_state(classification_id,attempt_id,automatic_attempts,next_check_at,last_result)
      VALUES($1,$2,1,NOW()+INTERVAL '1 hour','not_present')`, [id, attemptId]);
    const enabled = await request(backgroundPath(id), { session, body: { enabled: true } });
    assert.equal(enabled.status, 200); assert.equal(enabled.body.enabled, true); assert.equal(enabled.body.attempts, 1);
    items.push({ type, arr, config, id, attemptId, state: enabled.body });
  }
  const legacy = (await db.query(`INSERT INTO classification_history(tmdb_id,media_type,title,library_id,method,status,metadata)
    SELECT 43,'movie','Legacy rehearsal',library_id,'manual_classification','completed','{}'
    FROM classification_history WHERE id=$1 RETURNING id`, [items[0].id])).rows[0].id;
  writeFixtureFile('fixture', { session, user, password, items, legacy });
  writeFixtureFile('control', { movie: 'empty', tv: 'empty' });
  writeFixtureFile('requests', { movie: 0, tv: 0, writes: 0, unexpected: 0, heldAt: null });
  return { seeded: 2, legacy: 1, priorAttempts: 1 };
}
