/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createVmJobModel } from '../lib/gatewayVmJobLifecycle.mjs';
import { VM_JOB_DEADLINES, VM_JOB_MAX_OBSERVATIONS } from '../lib/gatewayVmJobContract.mjs';
import { createVmJobSimulation, simulatedVmDrain, runVmJobSimulations } from '../lib/gatewayVmJobSimulation.mjs';
import { runVmJobLifecycleCli } from '../check-gateway-vm-job-lifecycle.mjs';

function reach(state) {
  const sim = createVmJobSimulation();
  const steps = [['inspect'], ['starting', 'inspected'], ['readiness', 'started'],
    ['work', 'ready', { ready: true }], ['drain', 'finished', { outcome: 'passed' }],
    ['confirm', 'drained', simulatedVmDrain()], ['stopping', 'inspected']];
  for (const [next, kind, details] of steps) {
    if (kind) sim.step(kind, details);
    assert.equal(sim.model.snapshot().state, next);
    if (next === state) return sim;
  }
  throw new Error('invalid_test_state');
}
const held = result => {
  assert.equal(result.state, 'held'); assert.equal(result.decision, 'leave_power_unchanged');
  assert.equal(result.liveOperationsEnabled, false); assert.equal(result.studyReady, false);
};

test('fixed simulations preserve passed/failed/cancelled outcomes, refuse adoption and never enable real operations', () => {
  const result = runVmJobSimulations();
  assert.equal(result.status, 'matched'); assert.equal(result.cases.length, 6);
  assert.equal(result.liveOperationsEnabled, false); assert.equal(result.studyReady, false);
  assert.ok(result.cases.every(row => row.matched));
});

test('binding permits only simulation, UUIDv7 job/ownership identities and an exact target digest', () => {
  const { binding } = createVmJobSimulation();
  for (const change of [{ mode: 'live' }, { jobId: binding.jobId.replace('-7000-', '-4000-') },
    { ownerToken: binding.ownerToken.replace('-8000-', '-0000-') }, { jobId: `${binding.jobId}\n` },
    { vmId: '*' }, { configDigest: 'main' }, { configDigest: 'a'.repeat(64) + '\n' }, { apply: true }]) {
    assert.throws(() => createVmJobModel({ ...binding, ...change }), /gateway_vm_job_binding_invalid/);
  }
  for (const clock of [NaN, -1, Infinity]) assert.throws(() => createVmJobModel(binding, { now: () => clock }), /clock_invalid/);
});

test('initial running/saved/paused/unknown targets never produce a start or shutdown request', () => {
  for (const power of ['Running', 'Saved', 'Paused', 'Unknown']) {
    const sim = createVmJobSimulation(); held(sim.step('inspected', {}, { power }));
    held(sim.step('stopped')); held(sim.model.cancel());
  }
});

test('foreign, malformed, replayed and out-of-order observations fail closed at every stage', () => {
  for (const state of Object.keys(VM_JOB_DEADLINES)) {
    for (const change of [{ vmId: '11111111-2222-3333-4444-555555555555' }, { configDigest: 'b'.repeat(64) },
      { jobId: '019a0000-0000-7000-8000-000000000099' }, { ownerToken: '019a0000-0000-7000-8000-000000000099' },
      { exclusive: false }, { exclusive: 'true' }, { sequence: 0 }, { sequence: 64 }, { extra: 'private' }]) {
      const sim = reach(state); held(sim.step('inspected', {}, change));
    }
    const sim = reach(state); held(sim.model.advance(null));
  }
});

test('no stage timeout, monotonic-clock failure or observation budget exhaustion forces shutdown', () => {
  for (const state of Object.keys(VM_JOB_DEADLINES)) {
    const sim = reach(state); sim.elapse(VM_JOB_DEADLINES[state]);
    const result = sim.step('inspected'); held(result); assert.equal(result.reason, 'deadline_or_clock_uncertain');
    assert.deepEqual(sim.model.snapshot(), result);
  }
  for (const delta of [-1, NaN, Infinity]) {
    const sim = reach('work'); sim.elapse(delta); held(sim.model.cancel());
  }
  const sim = reach('readiness');
  for (let i = 2; i < VM_JOB_MAX_OBSERVATIONS; i++) assert.equal(sim.step('ready', { ready: false }).state, 'readiness');
  held(sim.step('ready', { ready: true }));
});

test('unready observations and repeated cancellation do not renew deadlines or repeat start decisions', () => {
  const sim = reach('readiness'); sim.elapse(VM_JOB_DEADLINES.readiness - 1);
  assert.equal(sim.step('ready', { ready: false }).state, 'readiness'); sim.elapse(1);
  held(sim.step('ready', { ready: true }));
  const starting = reach('starting'); assert.equal(starting.model.cancel().decision, 'await_observation');
  assert.equal(starting.step('started').state, 'drain');
  starting.elapse(VM_JOB_DEADLINES.drain - 1); starting.model.cancel(); starting.elapse(1);
  held(starting.step('drained', simulatedVmDrain()));
});

test('cancellation before startup never starts; cancellation during work requires verified work completion and cleanup', () => {
  const early = reach('inspect'); const cancelled = early.model.cancel();
  assert.equal(cancelled.state, 'done'); assert.equal(cancelled.outcome, 'cancelled');
  assert.equal(cancelled.decision, 'leave_power_unchanged'); assert.deepEqual(early.step('inspected'), cancelled);
  const sim = reach('work'); assert.equal(sim.model.cancel().state, 'drain');
  for (const change of [{ admissionsClosed: false }, { activeJobs: 1 }, { ownedResources: 1 },
    { workComplete: false }, { cleanupVerified: false }]) {
    assert.equal(sim.step('drained', { ...simulatedVmDrain(), ...change }).decision, 'await_verified_drain');
  }
  assert.equal(sim.step('drained', simulatedVmDrain()).state, 'confirm');
  assert.equal(sim.step('inspected').decision, 'would_request_graceful_shutdown');
  const done = sim.step('stopped'); assert.equal(done.state, 'done'); assert.equal(done.outcome, 'cancelled');
  assert.deepEqual(sim.step('started'), done);
});

test('boot and power changes between startup and shutdown leave power unchanged', () => {
  for (const state of ['readiness', 'work', 'drain', 'confirm', 'stopping']) {
    for (const change of [{ bootId: null }, { bootId: '22222222-3333-4444-5555-666666666666' },
      { power: 'Unknown' }, { power: 'Saved' }]) held(reach(state).step('inspected', {}, change));
  }
});

test('invalid drain counts, missing cleanup fields and false shutdown confirmation cannot mark completion', () => {
  for (const change of [{ activeJobs: -1 }, { activeJobs: '0' }, { ownedResources: Infinity },
    { workComplete: null }, { cleanupVerified: 'yes' }]) held(reach('drain').step('drained', { ...simulatedVmDrain(), ...change }));
  held(reach('drain').step('drained', {}));
  held(reach('stopping').step('stopped', {}, { power: 'Running' }));
  held(reach('work').step('finished', { outcome: 'unknown' }));
  held(reach('starting').step('started', {}, { bootId: null }));
});

test('snapshots are immutable and sanitized; caller mutation cannot alter the binding', () => {
  const binding = { ...createVmJobSimulation().binding };
  const model = createVmJobModel(binding); binding.ownerToken = 'private';
  assert.ok(Object.isFrozen(model)); assert.ok(Object.isFrozen(model.snapshot()));
  const output = JSON.stringify(model.snapshot());
  assert.ok(!output.includes(binding.vmId)); assert.ok(!output.includes('private'));
});

test('wrong phase events never skip readiness, completion, drain or final confirmation', () => {
  for (const state of Object.keys(VM_JOB_DEADLINES)) {
    const sim = reach(state); held(sim.step('unavailable'));
  }
  held(reach('inspect').step('inspected', { extra: true }));
  held(reach('inspect').step('inspected', { '': true }));
  held(reach('readiness').step('ready', { ready: 'true' }));
  held(reach('confirm').step('inspected', { extra: true }));
});

test('late cancellation preserves completed job results; readiness cancellation still drains', () => {
  for (const outcome of ['passed', 'failed']) {
    const sim = reach('work'); sim.step('finished', { outcome }); sim.model.cancel();
    assert.equal(sim.model.snapshot().outcome, outcome);
    sim.step('drained', simulatedVmDrain()); sim.model.cancel(); sim.step('inspected'); sim.model.cancel();
    const result = sim.step('stopped'); assert.equal(result.outcome, outcome); assert.equal(result.state, 'done');
  }
  const sim = reach('readiness'); assert.equal(sim.model.cancel().state, 'drain');
  assert.equal(sim.step('drained', { ...simulatedVmDrain(), workComplete: false }).state, 'drain');
});

test('unavailable monotonic clock fails closed without exposing its exception', () => {
  let fail = false;
  const model = createVmJobModel(createVmJobSimulation().binding, { now: () => {
    if (fail) throw new Error('private-clock-data'); return 0;
  } });
  fail = true; const result = model.advance(null); held(result);
  assert.ok(!JSON.stringify(result).includes('private-clock-data'));
});

test('CLI accepts only simulation and rejects live/proof/power parameters without exposing arguments', () => {
  assert.equal(runVmJobLifecycleCli(['--simulate']).status, 'matched');
  for (const args of [[], ['--apply'], ['--simulate', '--live'], ['--receipt', 'private'], ['--vm-id', '*']]) {
    assert.throws(() => runVmJobLifecycleCli(args), /invocation_invalid/);
  }
  const cli = fileURLToPath(new URL('../check-gateway-vm-job-lifecycle.mjs', import.meta.url));
  for (const [args, status] of [[['--simulate'], 0], [['--apply', 'private'], 1]]) {
    const child = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', timeout: 10000,
      maxBuffer: 16384, shell: false, windowsHide: true });
    assert.equal(child.status, status); assert.equal(child.stderr, '');
    const result = JSON.parse(child.stdout);
    assert.equal(result.liveOperationsEnabled, false); assert.equal(result.studyReady, false);
    assert.ok(!child.stdout.includes('private'));
  }
});
