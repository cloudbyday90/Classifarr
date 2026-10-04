/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { fixtureRequest, fixtureSession, startRoutingProvider } from './httpRoutingTransport.mjs';
import { routingCases, seedHttpRouting, readHttpRouting } from './httpRoutingState.mjs';

export async function runHttpRoutingFixture(database, { tmdbService, hashPassword }) {
  await seedHttpRouting(database);
  const password = `Isolated-${randomBytes(24).toString('hex')}!`;
  const admin = fixtureSession(await fixtureRequest('/api/setup/create-admin', {
    body: { username: 'isolation-admin', password, confirmPassword: password },
  }));
  await database.query(`INSERT INTO users(username,password_hash,role,is_active,must_change_password)
    VALUES('isolation-user',$1,'user',true,false)`, [await hashPassword(password)]);
  const user = fixtureSession(await fixtureRequest('/api/auth/login', {
    body: { identifier: 'isolation-user', password },
  }));
  const provider = await startRoutingProvider();
  const originalUrl = tmdbService.baseUrl;
  tmdbService.baseUrl = 'http://127.0.0.1:21401/tmdb';
  try {
    const body = { tmdb_id: 910001, media_type: 'movie' };
    const before = (await database.query('SELECT count(*)::int AS count FROM classification_history')).rows[0].count;
    for (const [session, status] of [[undefined, 401], [user, 403], [{ cookie: admin.cookie }, 403]]) {
      assert.equal((await fixtureRequest('/api/classification/classify', { session, body })).status, status,
        'routing_fixture_auth_denial_failed');
    }
    assert.equal((await database.query('SELECT count(*)::int AS count FROM classification_history')).rows[0].count, before);
    assert(Object.values(provider.counts).every(count => count === 0), 'denied_request_contacted_provider');
    for (const item of routingCases) {
      const response = await fixtureRequest('/api/classification/classify', { session: admin,
        body: { tmdb_id: item.tmdbId, media_type: item.type, title: item.title } });
      assert.equal(response.status, 200, 'routing_fixture_classification_failed');
      assert.equal(response.body.success, true);
      assert.equal(response.body.method, 'policy_auto');
      assert.equal(response.body.destination.libraryName, item.title);
      assert.deepEqual(response.body.routingOutcome, { shouldRoute: true, reason: 'policy_auto',
        routeResult: { attempted: true, routed: true, reason: 'routed' } });
    }
    assert(await readHttpRouting(database, { completed: false }), 'routing_fixture_missing_history');
    assert.deepEqual(provider.counts, { tmdb: 5, movieReads: 2, tvReads: 2, movieAdds: 1, tvAdds: 1, unexpected: 0 });
  } finally {
    tmdbService.baseUrl = originalUrl;
    await provider.close();
    await database.query('UPDATE radarr_config SET is_active=false');
    await database.query('UPDATE sonarr_config SET is_active=false');
    await database.query('UPDATE tmdb_config SET is_active=false');
  }
  // Completion becomes visible only after every assertion and provider cleanup passed.
  await database.query(`UPDATE classification_history ch SET metadata=jsonb_set(ch.metadata,'{isolation_http_verified}','true')
    FROM libraries l WHERE l.id=ch.library_id AND l.external_id=ANY($1::text[])`,
  [routingCases.map(item => `isolation-http-${item.type}`)]);
}
