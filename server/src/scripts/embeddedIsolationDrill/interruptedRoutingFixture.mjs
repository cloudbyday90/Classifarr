/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { fixtureRequest, fixtureSession, startRoutingProvider } from './httpRoutingTransport.mjs';
import { startRuntime, waitForRuntime, stopRuntime } from './processes.mjs';

async function bounded(promise, milliseconds, code) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(code)), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

export async function crashRoutingRuntime(runtime) {
  assert(runtime.child.kill('SIGKILL'), 'routing_crash_not_sent');
  assert.deepEqual(await bounded(runtime.done, 5000, 'routing_crash_timeout'), { code: null, signal: 'SIGKILL' });
}

export async function runInterruptedRoutingFixture({ data,
  request = fixtureRequest, providerFactory = startRoutingProvider,
  start = startRuntime, ready = waitForRuntime, stop = stopRuntime, crash = crashRoutingRuntime } = {}) {
  let runtime, provider, waiting, acceptedType;
  let stage = 'seed';
  const observed = [];
  try {
    const { password, items } = await data('seed');
    assert.deepEqual(items.map(item => item.type), ['movie', 'tv']);
    provider = await providerFactory({ healthChecks: true, holdAfterAdd: type => {
      acceptedType = type;
      waiting?.();
    } });
    const login = async () => fixtureSession(await request('/api/auth/login', {
      body: { identifier: 'interrupted-routing-admin', password },
    }));
    runtime = start(); await ready(runtime);
    stage = 'login';
    let session = await login();
    for (const item of items) {
      assert.match(String(item.taskId), /^[1-9]\d*$/);
      assert(Number.isSafeInteger(item.libraryId) && item.libraryId > 0);
      const path = `/api/queue/tasks/${item.taskId}/classify`;
      const body = { library_id: item.libraryId };
      acceptedType = null;
      const accepted = new Promise(resolve => { waiting = resolve; });
      // Attach rejection handling immediately; the killed connection must not succeed.
      const pending = request(path, { session, body }).then(() => true, () => false);
      stage = 'admission';
      await bounded(accepted, 10_000, 'routing_add_not_observed');
      assert.equal(acceptedType, item.type);
      await crash(runtime); runtime = null;
      stage = 'crashed';
      assert.equal(await pending, false, 'routing_add_was_acknowledged');
      const before = await data('read');
      stage = 'committed';
      assert.equal(before.length, observed.length + 1);
      const original = before.find(row => row.media_type === item.type);
      assert(original && !original.details.manual_routing_observation);
      runtime = start(); await ready(runtime);
      stage = 'restarted';
      assert.deepEqual(await data('read'), before, 'routing_state_changed_on_restart');
      session = await login();
      stage = 'replay';
      const counts = { ...provider.counts };
      const replay = await request(path, { session, body });
      assert.equal(replay.status, 409, 'completed_task_replayed');
      assert.deepEqual(provider.counts, counts, 'replay_contacted_provider');
      const checkPath = `/api/queue/manual-routing/${original.id}/check`;
      const check = await request(checkPath, { session, body: {} });
      stage = 'checked';
      assert.equal(check.status, 200);
      assert.equal(check.body.reason, 'verified_present');
      assert.equal(check.body.recorded, true);
      const after = (await data('read')).find(row => row.id === original.id);
      stage = 'observation';
      const { manual_routing_observation: observation, ...details } = after.details;
      assert.deepEqual(details, original.details, 'original_decision_rewritten');
      assert.equal(observation.reason, 'verified_present');
      assert.equal(after.last_result, 'verified_present');
      assert.equal(after.attempt_id, original.details.manual_routing_attempt_id);
      assert.equal(after.automatic_attempts, 0);
      assert.equal(after.enabled, false);
      observed.push({ id: original.id, checkPath });
    }
    const completed = await data('read');
    stage = 'final_restart';
    await stop(runtime); runtime = null;
    runtime = start(); await ready(runtime);
    session = await login();
    assert.deepEqual(await data('read'), completed, 'routing_observation_lost_on_restart');
    const counts = { ...provider.counts };
    for (const item of observed) {
      stage = 'cooldown';
      const response = await request(item.checkPath, { session, body: {} });
      assert.equal(response.status, 429);
      assert.equal(response.body.reason, 'cooldown');
    }
    assert.deepEqual(provider.counts, counts, 'cooldown_contacted_provider');
    stage = 'counts';
    assert.deepEqual(provider.counts, { tmdb: 0, movieReads: 2, tvReads: 2, movieAdds: 1, tvAdds: 1,
      healthReads: 32, unexpected: 0 });
    await stop(runtime); runtime = null;
    await data('disable');
    return { interruptedAdds: 2, duplicateAdds: 0, verifiedObservations: 2, preservedCooldowns: 2 };
  } catch (error) {
    // Only fixed fixture stages leave the process; no assertion values or child stdout.
    error.fixtureStage = stage;
    error.fixtureCounts = provider?.counts;
    throw error;
  } finally {
    try { await stop(runtime); }
    finally { await provider?.close(); }
  }
}
