/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { withRoutingRehearsal } from './manualRoutingRehearsalDocker.mjs';

export const ROUTING_EXPECTED = Object.freeze({
  seed: { seeded: 2, legacy: 1, priorAttempts: 1 },
  upgraded: { persisted: true, authorization: true, csrf: true, payload: true, rateLimit: true },
  'arm-crash': { armed: true },
  restarted: { crashBudgetPreserved: true, earlyReadWithheld: true },
  exhausted: { exhausted: true },
  paused: { refunded: true, paused: true },
  repair: { pauseSurvivedRestart: true, credentialsUpdated: true },
  complete: { movieGets: 2, tvGets: 2, providerWrites: 0, historyPreserved: true, legacyNotEnrolled: true },
});

export async function runManualRoutingRehearsal(options, { container = withRoutingRehearsal,
  report = message => process.stdout.write(`${message}\n`) } = {}) {
  return container(options, async ({ name, baseline, candidate, docker, start, healthy, inspect, waitFor, removeContainer, probe, provider }) => {
    const checks = [];
    const pass = phase => { checks.push(phase); report(`PASS routing_${phase}`); };
    const step = async phase => {
      const result = await probe(phase);
      assert.deepEqual(result, ROUTING_EXPECTED[phase], `routing_receipt_invalid:${phase}`);
      pass(phase); return result;
    };
    const wait = phase => waitFor(async () => {
      const receipt = await probe(phase);
      assert.deepEqual(Object.keys(receipt), ['ready'], `routing_receipt_invalid:${phase}`);
      assert.equal(typeof receipt.ready, 'boolean', `routing_receipt_invalid:${phase}`);
      return receipt.ready;
    });
    const restart = async killed => {
      await docker(killed ? ['kill', '--signal', 'SIGKILL', name] : ['stop', '--timeout', '60', name], 70_000);
      const state = await inspect(); assert.equal(state.OOMKilled, false); assert.equal(state.ExitCode, killed ? 137 : 0);
      await docker(['start', name]); await healthy(); await provider();
    };
    report('START routing_baseline');
    await start(baseline); await step('seed');
    await docker(['stop', '--timeout', '60', name], 70_000);
    assert.equal((await inspect()).ExitCode, 0); await removeContainer();
    report('START routing_candidate');
    await start(candidate); await step('upgraded'); await provider();
    await step('arm-crash'); await wait('crash-ready'); await restart(true); await step('restarted');
    await wait('movie-ready'); await step('exhausted');
    await wait('pause-ready'); await step('paused'); await restart(false); await step('repair');
    await wait('complete-ready'); const result = await step('complete');
    return { status: 'passed', baseline, candidate, checks, ...result };
  });
}
