/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { startRoutingProvider } from './httpRoutingTransport.mjs';
import { startRuntime, waitForRuntime, stopRuntime } from './processes.mjs';
import { crashRoutingRuntime } from './interruptedRoutingFixture.mjs';

export async function runQueuedRoutingFixture({ data, providerFactory = startRoutingProvider,
  start = startRuntime, ready = waitForRuntime, stop = stopRuntime, crash = crashRoutingRuntime,
  wait = sleep, now = Date.now } = {}) {
  let runtime, provider, stage = 'seed';
  const accepted = [];
  const until = async predicate => {
    const deadline = now() + 20_000;
    while (now() < deadline) { if (await predicate()) return; await wait(100); }
    throw new Error('queued_fixture_timeout');
  };
  try {
    await data('seed');
    provider = await providerFactory({ healthChecks: true, hideAccepted: true, holdAfterAdd: type => accepted.push(type) });
    runtime = start();
    await ready(runtime);
    for (const type of ['movie', 'tv']) {
      stage = 'admission';
      await data(`release-${type}`);
      await until(() => accepted.includes(type));
      // Remote side effect observed; kill only the app, not the provider or database.
      stage = 'crash';
      await crash(runtime); runtime = null;
      const original = (await data('read')).find(row => row.media_type === type);
      assert.equal(original.status, 'processing');
      assert.match(original.claim_token, /^[a-f0-9-]{36}$/);
      assert.match(original.routing_classification_id, /^[1-9]\d*$/);
      assert.equal(original.method, 'policy_auto');
      assert.equal(original.history_count, 1);
      assert.equal(original.details.routing, 'automatic_routing_pending');
      stage = 'reclaim';
      // Explicit fixture clock advance, not evidence of an elapsed ten-minute lease.
      await data(`expire-${type}`);
      runtime = start(); await ready(runtime);
      let recovered;
      await until(async () => {
        recovered = (await data('read')).find(row => row.media_type === type);
        return recovered.status === 'completed';
      });
      assert.equal(recovered.claim_token, null);
      assert.equal(recovered.attempts, original.attempts);
      assert.equal(recovered.routing_classification_id, original.routing_classification_id);
      assert.equal(recovered.history_count, 1);
      assert.equal(recovered.history_status, 'completed');
      assert.deepEqual(recovered.details, original.details);
      assert.equal(recovered.result.recovered, true);
      assert.equal(String(recovered.result.classification_id), original.routing_classification_id);
      assert.deepEqual(recovered.result.routingOutcome.routeResult,
        { attempted: true, routed: false, reason: 'automatic_routing_unconfirmed' });
    }
    stage = 'counts';
    assert.deepEqual(accepted, ['movie', 'tv']);
    assert.deepEqual(provider.counts, { tmdb: 0, movieReads: 1, tvReads: 1, movieAdds: 1, tvAdds: 1, healthReads: 24, unexpected: 0 });
    await stop(runtime); runtime = null;
    await data('disable');
    return { acceptedAdds: 2, duplicateAdds: 0, replayReads: 0, recoveredCommands: 2, syntheticDeadlineAdvances: 2 };
  } catch (error) {
    error.fixtureStage = stage;
    error.fixtureCounts = provider?.counts;
    throw error;
  } finally {
    try { await stop(runtime); } finally { await provider?.close(); }
  }
}
