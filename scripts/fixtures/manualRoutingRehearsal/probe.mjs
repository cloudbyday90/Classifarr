/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { assertFixtureEnvironment, readFixtureFile, writeFixtureFile, request, sessionFrom, backgroundPath, checkPath } from './support.mjs';
import { seed } from './seed.mjs';

async function probe(db, phase) {
  if (phase === 'seed') return seed(db);
  const fixture = readFixtureFile('fixture'), [movie, tv] = fixture.items;
  // Normal nonpersistent sessions are deliberately invalidated by application restart.
  if (['upgraded', 'restarted', 'repair'].includes(phase)) {
    fixture.session = sessionFrom(await request('/api/auth/login', { body: { identifier: 'routing-drill-admin', password: fixture.password } }));
    if (phase === 'upgraded') fixture.user = sessionFrom(await request('/api/auth/login', {
      body: { identifier: 'routing-drill-user', password: fixture.password },
    }));
    writeFixtureFile('fixture', fixture);
  }
  const { session } = fixture;
  const counts = () => readFixtureFile('requests');
  const state = async item => {
    const response = await request(backgroundPath(item.id), { session });
    assert(response.status === 200, `status_read_failed_${response.status}`); assert.equal(response.cache, 'no-store');
    return response.body;
  };
  const stored = async item => (await db.query('SELECT * FROM manual_routing_check_state WHERE classification_id=$1', [item.id])).rows[0];
  const due = item => db.query("UPDATE manual_routing_check_state SET next_check_at=NOW()-INTERVAL '1 second' WHERE classification_id=$1", [item.id]);
  const mode = (type, value) => writeFixtureFile('control', { ...readFixtureFile('control'), [type]: value });
  if (phase === 'upgraded') {
    assert.equal((await db.query('SELECT count(*)::integer AS n FROM manual_routing_provider_state')).rows[0].n, 0);
    for (const item of fixture.items) {
      const current = await state(item);
      for (const key of ['enabled', 'attempts', 'nextCheckAt', 'lastResult']) assert.equal(current[key], item.state[key], `upgrade_${key}`);
    }
    assert.equal((await request(backgroundPath(movie.id))).status, 401);
    assert.equal((await request(backgroundPath(movie.id), { session: fixture.user })).status, 403);
    assert.equal((await request(backgroundPath(movie.id), { session: { cookie: session.cookie }, body: { enabled: false } })).status, 403);
    assert.equal((await request(backgroundPath(movie.id), { session, body: { enabled: true, url: 'http://forbidden' } })).status, 400);
    await state(movie); await state(movie);
    assert.equal((await request(backgroundPath(movie.id), { session })).status, 429);
    return { persisted: true, authorization: true, csrf: true, payload: true, rateLimit: true };
  }
  if (phase === 'arm-crash') { mode('movie', 'hold'); await due(movie); return { armed: true }; }
  if (phase === 'crash-ready') {
    if (!counts().heldAt) return { ready: false };
    const row = await stored(movie);
    assert.equal(row.automatic_attempts, 2); assert.equal(row.last_result, 'checking');
    assert(Date.now() - counts().heldAt < 7000, 'missed_crash_window');
    fixture.crashDue = row.next_check_at.toISOString(); writeFixtureFile('fixture', fixture);
    return { ready: true };
  }
  if (phase === 'restarted') {
    const current = await state(movie);
    assert.equal(current.attempts, 2); assert.equal(current.nextCheckAt, fixture.crashDue);
    assert.equal(current.lastResult, 'checking'); assert.equal(current.enabled, true);
    const refused = await request(checkPath(movie.id), { session, body: {} });
    assert(['cooldown', 'provider_paused'].includes(refused.body.reason), 'restart_read_not_withheld');
    assert.equal(counts().movie, 1); assert.equal(counts().writes, 0);
    mode('movie', 'empty');
    await db.query("UPDATE manual_routing_provider_state SET next_check_at=NOW()-INTERVAL '1 second' WHERE radarr_id=$1", [movie.config]);
    await due(movie);
    return { crashBudgetPreserved: true, earlyReadWithheld: true };
  }
  if (phase === 'movie-ready') return { ready: (await stored(movie)).last_result === 'not_present' };
  if (phase === 'exhausted') {
    const current = await state(movie); assert.equal(current.attempts, 3); assert.equal(current.enabled, false);
    const enabled = await request(backgroundPath(movie.id), { session, body: { enabled: true } });
    assert.equal(enabled.status, 200); assert.equal(enabled.body.enabled, false); assert.equal(enabled.body.attempts, 3);
    assert.equal(counts().movie, 2);
    mode('tv', 'unauthorized'); await due(tv);
    return { exhausted: true };
  }
  if (phase === 'pause-ready') return { ready: (await stored(tv)).last_result === 'provider_auth_required' };
  if (phase === 'paused') {
    const current = await state(tv); assert.equal(current.attempts, 1); assert.equal(current.enabled, true);
    assert.equal(current.provider.reason, 'provider_auth_required');
    fixture.pause = current.provider; writeFixtureFile('fixture', fixture);
    assert.equal(counts().tv, 1);
    return { refunded: true, paused: true };
  }
  if (phase === 'repair') {
    const current = await state(tv); assert.equal(current.attempts, 1); assert.deepEqual(current.provider, fixture.pause);
    const refused = await request(checkPath(tv.id), { session, body: {} });
    assert.equal(refused.body.reason, 'provider_auth_required'); assert.equal(counts().tv, 1);
    const rotated = await request(`/api/settings/sonarr/${tv.config}`, { session, method: 'PUT',
      body: { name: 'Routing rehearsal', url: 'http://127.0.0.1:21400/sonarr', api_key: 'rotated-synthetic', is_active: true } });
    assert.equal(rotated.status, 200, 'credential_update_failed');
    mode('tv', 'present'); await due(tv);
    return { pauseSurvivedRestart: true, credentialsUpdated: true };
  }
  if (phase === 'complete-ready') return { ready: (await stored(tv)).last_result === 'verified_present' };
  if (phase === 'complete') {
    const current = await state(tv); assert.equal(current.attempts, 2); assert.equal(current.enabled, false);
    assert.equal(current.lastResult, 'verified_present');
    assert.equal((await db.query('SELECT count(*)::integer AS n FROM manual_routing_check_state WHERE classification_id=$1', [fixture.legacy])).rows[0].n, 0);
    for (const item of fixture.items) {
      const row = (await db.query('SELECT status,method,metadata FROM classification_history WHERE id=$1', [item.id])).rows[0];
      assert.equal(row.status, 'completed'); assert.equal(row.method, 'manual_classification');
      assert.equal(row.metadata.classification_details.routing, 'manual_routing_pending');
      assert.equal(row.metadata.classification_details.manual_routing_attempt_id, item.attemptId);
    }
    assert.deepEqual({ ...counts(), heldAt: null }, { movie: 2, tv: 2, writes: 0, unexpected: 0, heldAt: null });
    return { movieGets: 2, tvGets: 2, providerWrites: 0, historyPreserved: true, legacyNotEnrolled: true };
  }
  throw new Error('unknown_phase');
}

assertFixtureEnvironment();
const phase = process.argv[2];
const db = await import('/app/src/config/database.mjs');
try {
  const result = await probe(db, phase);
  process.stdout.write(`ROUTING_PROBE ${JSON.stringify(result)}\n`);
} catch (error) {
  // Only fixed assertion identifiers; actual values may contain sessions/credentials.
  const safe = typeof error.message === 'string' && /^[a-z0-9_]{1,80}$/.test(error.message) ? error.message : 'assertion_failed';
  const line = error.stack?.match(/routing-fixture\/(seed|probe|support)\.mjs:(\d+):/)?.slice(1).join('_');
  const code = typeof error.code === 'string' && /^[0-9A-Z]{5}$/.test(error.code) ? `_${error.code.toLowerCase()}` : '';
  process.stderr.write(`ROUTING_PROBE_FAILURE ${safe}${line ? `_${line}` : ''}${code}\n`); process.exitCode = 1;
} finally { await db.pool.end(); }
