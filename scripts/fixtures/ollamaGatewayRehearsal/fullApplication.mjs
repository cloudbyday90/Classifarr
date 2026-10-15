/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { connect } from 'node:net';
import pg from '/app/node_modules/pg/lib/index.js';
import { request, sessionFrom } from './pilotHttp.mjs';

assert.equal(process.env.CLASSIFARR_GATEWAY_FIXTURE, 'isolated');
const [phase] = process.argv.slice(2);
assert.ok(['seed', 'active', 'unavailable', 'replaced'].includes(phase));
const stateFile = '/app/data/gateway-pilot-state.json';
const routing = JSON.parse(await readFile('/app/data/gateway-pilot-routing.json', 'utf8'));
const path = '/api/settings/ollama/gateway-history';
const db = new pg.Client({ host: '/var/run/postgresql', user: 'classifarr', database: 'classifarr' });
await db.connect();
try {
  assert.equal((await db.query('SELECT count(*)::int AS n FROM libraries')).rows[0].n, 0);
  assert.equal((await db.query("SELECT to_regnamespace('ollama_gateway') AS n")).rows[0].n, null);
  if (phase === 'seed') {
    assert.equal((await db.query('SELECT count(*)::int AS n FROM users')).rows[0].n, 0);
    const password = `Pilot-${randomBytes(24).toString('hex')}!`;
    const session = sessionFrom(await request('/api/setup/create-admin', {
      body: { username: 'gateway-pilot-admin', password, confirmPassword: password },
    }));
    const { hashPassword } = await import('/app/src/services/auth.mjs');
    await db.query("INSERT INTO users(username,password_hash,role,is_active,must_change_password) VALUES('gateway-pilot-user',$1,'user',true,false)",
      [await hashPassword(password)]);
    assert.deepEqual((await request(path, { session })).body, { state: 'not_configured' });
    const upstream = new URL(routing.configuration.baseUrl);
    const saved = await request('/api/settings/ollama', { session, method: 'PUT',
      body: { host: upstream.hostname, port: Number(upstream.port), model: routing.configuration.model } });
    assert.equal(saved.status, 200);
    await writeFile(stateFile, JSON.stringify({ password }), { mode: 0o600 });
  } else {
    const state = JSON.parse(await readFile(stateFile, 'utf8'));
    const session = sessionFrom(await request('/api/auth/login', {
      body: { identifier: 'gateway-pilot-admin', password: state.password },
    }));
    assert.equal((await request(path)).status, 401);
    const user = sessionFrom(await request('/api/auth/login', {
      body: { identifier: 'gateway-pilot-user', password: state.password },
    }));
    assert.equal((await request(path, { session: user })).status, 403);
    assert.equal((await request(`${path}?taskId=invalid`, { session })).status, 400);
    if (phase === 'unavailable') {
      const response = await request(path, { session });
      assert.equal(response.status, 503);
      assert.deepEqual(response.body, { error: 'gateway_history_unavailable' });
    } else {
      const before = await request(path, { session });
      assert.equal(before.status, 200); assert.equal(before.cache, 'no-store');
      assert.equal(before.body.state, 'available'); assert.equal(before.body.installation, 'synthetic');
      if (phase === 'active') {
        assert.equal(before.body.items.length, 1); // Existing composition generation.
        const warm = await request('/api/settings/ollama/warm', { session,
          body: { model: routing.configuration.model, keepAlive: '5m' } });
        assert.equal(warm.status, 200); assert.equal(warm.body.success, true);
        const after = await request(path, { session });
        assert.equal(after.status, 200); assert.equal(after.body.items.length, 2);
        assert.ok(after.body.items.every(item => item.outcome.state === 'response_completed'));
        assert.ok(after.body.items.every(item => /^[a-f0-9-]{14}7/.test(item.requestId)));
        await writeFile(stateFile, JSON.stringify({ ...state, history: after.body }), { mode: 0o600 });
      } else assert.deepEqual(before.body, state.history, 'pilot_history_changed_during_replacement');
      const filtered = await request(`${path}?taskId=999999`, { session });
      assert.equal(filtered.status, 200); assert.deepEqual(filtered.body.items, []);
      const upstream = new URL(routing.configuration.baseUrl);
      const reachable = await new Promise(resolve => {
        const socket = connect({ host: upstream.hostname, port: Number(upstream.port) });
        const finish = value => { socket.destroy(); resolve(value); };
        socket.setTimeout(2500, () => finish(false));
        socket.once('connect', () => finish(true)); socket.once('error', () => finish(false));
      });
      assert.equal(reachable, false, 'pilot_direct_provider_bypass');
    }
  }
} finally { await db.end(); }
