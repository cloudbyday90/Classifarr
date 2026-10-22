/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createVmRemovalSimulation } from '../lib/vmRemovalSimulation.mjs';
import { createVmRemovalMemoryJournal, defaultVmRemovalJournalOptions } from '../lib/vmRemovalMemoryJournal.mjs';
import { createVmRemovalMockOperations } from '../lib/vmRemovalMockOperations.mjs';
import { successfulVmRemovalScenario, requireVmRemovalScenario, simulationField, simulationArray,
  vmRemovalSimulationLimits as limits, simulationSteps } from '../lib/vmRemovalSimulationContract.mjs';
import { emptyVmRemovalErrorDetail } from '../lib/vmRemovalErrorContract.mjs';

const captured = (code = -2146233088) => ({ ...emptyVmRemovalErrorDetail(), status: 'captured', category: 7,
  errorId: 'other', detailsPresent: false, targetPresent: false,
  nodes: [{ kind: 'exception', via: 'root', parent: null, hresult: code, nativeErrorCode: null }] });
const scenario = patch => ({ ...successfulVmRemovalScenario(), ...patch });
const fault = (step, outcome = 'error', detail = captured()) => ({ step, outcome, detail });
const rejects = fn => assert.throws(fn, { message: 'vm_removal_simulation_invalid' });
function setup(options) {
  const environment = createVmRemovalSimulation(options), runner = environment.runner();
  return { environment, runner, run: (phase, value) => runner.runPhase(phase, value) };
}
function prepared(options) {
  const fixture = setup(options);
  fixture.run('create'); fixture.run('inspect'); return fixture;
}
function noAuthority(result) {
  assert.equal(result.mode, 'simulation');
  for (const key of ['nativeMutationAttempted', 'liveOperationsEnabled', 'retryAllowed', 'rootCauseConfirmed',
    'studyReady', 'cleanupComplete', 'simulatedPayloadCleanupAttempted']) assert.equal(result[key], false);
  assert.ok(Buffer.byteLength(JSON.stringify(result)) <= limits.outputBytes);
}

test('three explicit phases preserve recorded identities and independently verify absence without payload cleanup', () => {
  const { run } = setup();
  const created = run('create');
  assert.deepEqual(created.completed, ['create']); assert.equal(created.simulatedVmState, 'verified_off');
  assert.equal(created.journal.committed, 7); assert.equal(created.operations.effects.remove_vm, 0);
  assert.deepEqual(created.simulatedIdentity, { diskReturned: 201, vmReturned: 201, diskRecorded: 201, vmRecorded: 201 });
  const inspected = run('inspect');
  assert.deepEqual(inspected.completed, ['create', 'inspect']); assert.equal(inspected.journal.committed, 9);
  const removed = run('remove');
  assert.deepEqual(removed.completed, ['create', 'inspect', 'remove']); assert.equal(removed.simulatedVmState, 'verified_absent');
  assert.equal(removed.operations.effects.remove_vm, 1); assert.equal(removed.operations.observations, 6);
  assert.equal(removed.operations.calls, 13); assert.equal(removed.journal.committed, 12);
  assert.deepEqual(removed.journal.records.map(row => [row.kind, row.step]), [
    ['claim', 'journal'], ['intent', 'create_disk'], ['identity', 'create_disk'], ['intent', 'create_vm'],
    ['identity', 'create_vm'], ['intent', 'configure_vm'], ['complete', 'observe_created'],
    ['claim', 'journal'], ['complete', 'admission'], ['claim', 'journal'], ['intent', 'remove_vm'], ['complete', 'observe_absence']]);
  [created, inspected, removed].forEach(noAuthority);
});

test('replay, competing runner views and out-of-order phases halt without another modeled effect', () => {
  const { environment, run } = setup();
  run('create');
  const competing = environment.runner().runPhase('create');
  assert.equal(competing.reason, 'phase_order_or_prior_attempt'); assert.equal(competing.operations.effects.create_vm, 1);
  assert.deepEqual(run('inspect'), competing); assert.deepEqual(run('create'), competing);
  for (const phase of ['inspect', 'remove']) {
    const result = setup().run(phase); assert.equal(result.reason, 'phase_order_or_prior_attempt');
    assert.equal(result.journal.attempted, 0); assert.equal(result.operations.calls, 0); noAuthority(result);
  }
  const complete = prepared(); complete.run('remove');
  assert.equal(complete.run('remove').operations.effects.remove_vm, 1);
});

test('existing and partial memory journals are never imported, reset or adopted', () => {
  for (const initialState of ['existing', 'partial']) {
    const { run } = setup({ ...defaultVmRemovalJournalOptions(), initialState });
    const result = run('create');
    assert.equal(result.reason, 'prior_attempt'); assert.equal(result.journal.committed, 0);
    assert.equal(result.journal.attempted, 0); assert.equal(result.operations.calls, 0);
    assert.equal(result.simulatedIdentity.vmRecorded, null); assert.deepEqual(run('create'), result);
  }
});

test('every journal write/flush fault boundary stops without replay or promoting unrecorded identities', () => {
  for (const outcome of ['write_error', 'short_write', 'flush_error']) {
    for (let record = 1; record <= 12; record++) {
      const { run } = setup({ ...defaultVmRemovalJournalOptions(), faultRecord: record, fault: outcome });
      let result;
      for (const phase of ['create', 'inspect', 'remove']) { result = run(phase); if (result.status === 'stopped') break; }
      assert.equal(result.reason, outcome, `${outcome}/${record}`);
      assert.equal(result.journal.attempted, record); assert.equal(result.journal.committed, record - 1);
      assert.equal(result.journal.poisoned, true); noAuthority(result);
      assert.deepEqual(run('create'), result); assert.deepEqual(run('remove'), result);
      if (record <= 3) { assert.equal(result.operations.effects.create_vm, 0); assert.equal(result.simulatedIdentity.diskRecorded, null); }
      if (record <= 5) { assert.equal(result.operations.effects.configure_vm, 0); assert.equal(result.simulatedIdentity.vmRecorded, null); }
      if (record <= 11) assert.equal(result.operations.effects.remove_vm, 0);
      if (record === 3) assert.equal(result.simulatedIdentity.diskReturned, 201);
      if (record === 5) { assert.equal(result.simulatedIdentity.vmReturned, 201); assert.equal(result.simulatedVmState, 'unconfirmed'); }
      if (record === 12) { assert.equal(result.operations.effects.remove_vm, 1); assert.equal(result.simulatedVmState, 'unconfirmed'); }
    }
  }
});

test('all scripted operation faults terminate at their boundary with no later effect or automatic cleanup', () => {
  const perPhase = { create: ['observe_initial', 'create_disk', 'create_vm', 'configure_vm', 'observe_created'],
    inspect: ['observe_inspect'], remove: ['observe_remove', 'observe_remove_final', 'remove_vm', 'observe_absence'] };
  for (const [phase, steps] of Object.entries(perPhase)) {
    for (const at of steps) {
      for (const outcome of ['error', 'timeout', 'cancelled', 'capture_failed', 'source_changed', 'identity_changed']) {
        const current = phase === 'remove' ? prepared() : setup();
        if (phase === 'inspect') current.run('create');
        const result = current.run(phase, scenario({ faults: [fault(at, outcome)] }));
        assert.equal(result.reason, outcome, `${phase}/${at}/${outcome}`);
        assert.equal(result.step, at); assert.equal(result.status, 'stopped'); noAuthority(result);
        assert.deepEqual(result.errors.primary, captured());
        const index = result.operations.trace.indexOf(at);
        assert.deepEqual(result.operations.trace.slice(index + 1), ['dispose']);
        assert.deepEqual(current.run('remove'), result);
        if (['create_vm', 'configure_vm', 'remove_vm', 'observe_absence', 'observe_created'].includes(at)) {
          assert.equal(result.simulatedVmState, 'unconfirmed');
        }
      }
    }
  }
});

test('collisions, source changes and incomplete/reference-unsupported inventory fail before creation', () => {
  for (const [patch, reason] of [[{ nameAbsent: false }, 'collision'], [{ rootAbsent: false }, 'collision'],
    [{ sourceRevision: 2 }, 'source_changed'], [{ inventoryComplete: false }, 'observation_incomplete'],
    [{ referenceCoverage: 'configured_only' }, 'references_unsupported'], [{ referenceCoverage: 'unsupported' }, 'references_unsupported']]) {
    const result = setup().run('create', scenario(patch)); assert.equal(result.reason, reason);
    assert.equal(result.operations.effects.create_disk, 0); assert.equal(result.operations.effects.create_vm, 0);
  }
});

test('bounded inventories reject overflow, missing/duplicate IDs, malformed disk handles and configured foreign references', () => {
  for (const [inventory, reason] of [
    [Array.from({ length: 129 }, (_, i) => ({ id: i + 1, disks: [] })), 'inventory_limit'],
    [[{ id: 1, disks: Array(65).fill(1) }], 'inventory_limit'],
    [Array.from({ length: 17 }, (_, i) => ({ id: i + 1, disks: Array(64).fill(1) })), 'inventory_limit'],
    [[{ id: 0, disks: [] }], 'inventory_identity'], [[{ id: 1, disks: [0] }], 'inventory_identity'],
    [[{ id: 1, disks: [] }, { id: 1, disks: [] }], 'inventory_identity'],
    [[{ id: 1, disks: [201] }], 'foreign_reference'],
  ]) {
    const result = setup().run('create', scenario({ inventory }));
    assert.equal(result.reason, reason); assert.equal(result.operations.effects.create_disk, 0);
  }
  const max = Array.from({ length: 128 }, (_, i) => ({ id: i + 1, disks: [] }));
  const boundary = setup().run('create', scenario({ inventory: max }));
  // Reserve one inventory slot before creation rather than knowingly exceeding the next pass.
  assert.equal(boundary.reason, 'inventory_limit'); assert.equal(boundary.operations.effects.create_vm, 0);
  const exact = Array.from({ length: 127 }, (_, i) => ({ id: i + 1, disks: i < 16 ? Array(64).fill(1) : [] }));
  const { run } = setup();
  for (const phase of ['create', 'inspect', 'remove']) {
    const result = run(phase, scenario({ inventory: exact })); assert.equal(result.status, 'phase_complete');
    if (phase === 'remove') assert.equal(result.operations.drivesValidated, 6144);
  }
});

test('missing returned identities and observed/configuration drift never admit removal', () => {
  for (const patch of [{ returnedDisk: 0 }, { returnedVm: 0 }, { returnedVm: 1 }]) {
    const result = setup().run('create', scenario(patch)); assert.equal(result.reason, 'created_identity_missing');
    assert.equal(result.simulatedIdentity.vmRecorded, null); assert.equal(result.operations.effects.configure_vm, 0);
  }
  const alias = setup().run('create', scenario({ returnedDisk: 1 }));
  assert.equal(alias.reason, 'foreign_reference'); assert.equal(alias.operations.effects.create_vm, 0);
  for (const phase of ['create', 'inspect', 'remove']) {
    for (const patch of [{ observedVm: 202 }, { observedDisk: 202 }, { off: false }, { disconnected: false },
      { startupDisabled: false }, { checkpoints: 1 }, { diskUnchanged: false }, { treeUnchanged: false }]) {
      const { run } = setup();
      if (phase !== 'create') run('create'); if (phase === 'remove') run('inspect');
      const result = run(phase, scenario(patch));
      assert.ok(['identity_changed', 'configuration_unconfirmed'].includes(result.reason));
      assert.equal(result.operations.effects.remove_vm, 0); assert.equal(result.completed.includes(phase), false);
    }
  }
  const inspect = setup(); inspect.run('create');
  assert.equal(inspect.run('inspect', scenario({ sourceRevision: 2 })).reason, 'source_changed');
});

test('successful remove call is not verified absence or fixture cleanup', () => {
  const { run } = prepared(); const result = run('remove', scenario({ vmAbsent: false }));
  assert.equal(result.reason, 'absence_unconfirmed'); assert.equal(result.operations.effects.remove_vm, 1);
  assert.equal(result.simulatedVmState, 'unconfirmed'); assert.deepEqual(result.completed, ['create', 'inspect']);
  noAuthority(result);
  const stillListed = prepared().run('remove', scenario({ inventory: [{ id: 201, disks: [] }] }));
  assert.equal(stillListed.reason, 'inventory_identity'); assert.equal(stillListed.operations.effects.remove_vm, 0);
});

test('later foreign references, incomplete observations and unsupported coverage stop before removal', () => {
  for (const phase of ['inspect', 'remove']) {
    for (const [patch, reason] of [[{ inventory: [{ id: 1, disks: [201] }] }, 'foreign_reference'],
      [{ inventory: [{ id: 1, disks: [] }, { id: 1, disks: [] }] }, 'inventory_identity'],
      [{ inventoryComplete: false }, 'observation_incomplete'], [{ referenceCoverage: 'configured_only' }, 'references_unsupported']]) {
      const fixture = phase === 'remove' ? prepared() : setup();
      if (phase === 'inspect') fixture.run('create');
      const result = fixture.run(phase, scenario(patch));
      assert.equal(result.reason, reason); assert.equal(result.operations.effects.remove_vm, 0);
      assert.deepEqual(fixture.run('remove'), result);
    }
  }
});

test('phase transitions bind to the recorded returned identities, not the default mock IDs', () => {
  const { run } = setup();
  const value = scenario({ returnedDisk: 202, returnedVm: 203, observedDisk: 202, observedVm: 203 });
  assert.equal(run('create', value).status, 'phase_complete');
  assert.equal(run('inspect', value).status, 'phase_complete');
  const stale = run('remove');
  assert.equal(stale.reason, 'identity_changed'); assert.equal(stale.operations.effects.remove_vm, 0);
});

test('primary, failed failure-record write and failed disposal remain separate and bounded', () => {
  const { run } = prepared({ ...defaultVmRemovalJournalOptions(), faultRecord: 12, fault: 'flush_error' });
  const result = run('remove', scenario({ faults: [fault('remove_vm'), fault('dispose', 'error', captured(-2147024891))] }));
  assert.deepEqual(result.errors.primary, captured());
  assert.deepEqual(result.errors.secondary.map(row => row.phase), ['journal', 'dispose']);
  assert.equal(result.errors.secondary[1].detail.nodes[0].hresult, -2147024891);
  assert.equal(result.journal.committed, 11); assert.equal(result.journal.poisoned, true);
  assert.equal(result.journal.records.some(row => row.kind === 'failure'), false);
  const separate = prepared().run('remove', scenario({ faults: [fault('remove_vm'), fault('dispose')] }));
  assert.equal(separate.journal.records.at(-1).kind, 'failure');
  assert.deepEqual(separate.journal.records.at(-1).failure, captured());
});

test('projection failure is explicit and a disposal-only failure blocks the next phase', () => {
  const { run } = prepared();
  const result = run('remove', scenario({ faults: [fault('remove_vm', 'error', { private: 'not an error DTO' }), fault('dispose')] }));
  assert.equal(result.errors.primary.status, 'unavailable'); assert.equal(result.errors.primary.projectionFailed, true);
  assert.deepEqual(result.errors.secondary.map(row => row.phase), ['projection', 'dispose']);
  const creator = setup(); const disposal = creator.run('create', scenario({ faults: [fault('dispose')] }));
  assert.equal(disposal.reason, 'error'); assert.equal(disposal.step, 'dispose'); assert.deepEqual(disposal.completed, ['create']);
  assert.deepEqual(creator.run('inspect'), disposal);
});

test('composed failure evidence keeps the primary six-node budget and never reads an error-detail accessor', () => {
  const primary = captured();
  primary.nodes.push(...Array.from({ length: 5 }, (_, i) => ({ ...primary.nodes[0], via: 'inner', parent: i })));
  const fixture = prepared({ ...defaultVmRemovalJournalOptions(), faultRecord: 12, fault: 'short_write' });
  const result = fixture.run('remove', scenario({ faults: [fault('remove_vm', 'error', primary), fault('dispose')] }));
  assert.deepEqual(result.errors.primary, primary);
  assert.ok(result.errors.secondary.every(row => row.detail.nodes.length === 0));
  assert.equal(result.errors.secondary.at(-1).detail.truncated, true);
  let reads = 0;
  const accessor = fault('remove_vm');
  Object.defineProperty(accessor, 'detail', { get() { reads++; throw new Error('private'); } });
  const unknown = prepared().run('remove', scenario({ faults: [accessor] }));
  assert.equal(reads, 0); assert.equal(unknown.errors.primary.status, 'unavailable');
  const empty = prepared().run('remove', scenario({ faults: [fault('remove_vm', 'error', emptyVmRemovalErrorDetail())] }));
  assert.equal(empty.errors.primary.status, 'unavailable'); assert.equal(empty.errors.secondary[0].phase, 'projection');
});

test('journal limits are enforced on serialized bytes and records, with failed acknowledgements never committed', () => {
  for (const patch of [{ maxRecordBytes: 1 }, { maxBytes: 1 }]) {
    const journal = createVmRemovalMemoryJournal({ ...defaultVmRemovalJournalOptions(), ...patch });
    assert.throws(() => journal.append('create', 'claim', 'journal'), { reason: 'journal_limit' });
    assert.equal(journal.snapshot().committed, 0); assert.equal(journal.snapshot().attempted, 0);
    assert.throws(() => journal.append('create', 'claim', 'journal'), { reason: 'journal_poisoned' });
  }
  const journal = createVmRemovalMemoryJournal(); journal.append('create', 'claim', 'journal');
  for (let i = 1; i < 16; i++) journal.append('create', 'intent', 'create_disk');
  assert.throws(() => journal.append('create', 'intent', 'create_vm'), { reason: 'journal_limit' });
  assert.equal(journal.snapshot().committed, 16);
  const probe = createVmRemovalMemoryJournal(); probe.append('create', 'claim', 'journal');
  const bytes = createVmRemovalMemoryJournal({ ...defaultVmRemovalJournalOptions(), maxBytes: probe.snapshot().bytes });
  bytes.append('create', 'claim', 'journal');
  assert.throws(() => bytes.append('create', 'intent', 'create_disk'), { reason: 'journal_limit' });
  const claimed = createVmRemovalMemoryJournal(); claimed.append('create', 'claim', 'journal');
  assert.throws(() => claimed.append('create', 'claim', 'journal'), { reason: 'prior_attempt' });
  assert.equal(claimed.snapshot().committed, 1);
});

test('all public snapshots are immutable and cannot replace recorded identity, journal history or operation state', () => {
  const { environment, run } = setup(); const initial = environment.snapshot(); const created = run('create');
  for (const change of [() => { created.simulatedIdentity.vmRecorded = 1; }, () => created.completed.push('remove'),
    () => { created.journal.records[0].kind = 'complete'; }, () => { created.operations.effects.remove_vm = 99; }]) assert.throws(change, TypeError);
  assert.equal(initial.journal.committed, 0); assert.equal(created.journal.committed, 7);
  assert.equal(run('inspect').simulatedIdentity.vmRecorded, 201);
});

test('malformed inputs reject opaquely and private extras/accessors/proxies never execute or escape', () => {
  let reads = 0;
  const privateText = 'PRIVATE_VM_HOST_PATH_ACCOUNT_SECRET';
  const value = scenario(); Object.defineProperty(value, 'private', { get() { reads++; throw new Error(privateText); } });
  value.inventory[0].raw = privateText;
  const projection = requireVmRemovalScenario(value); assert.equal(reads, 0);
  assert.doesNotMatch(JSON.stringify(projection), /PRIVATE|raw|private/);
  for (const key of Object.keys(scenario())) {
    const accessor = scenario(); Object.defineProperty(accessor, key, { get() { reads++; throw new Error(privateText); } });
    rejects(() => requireVmRemovalScenario(accessor));
  }
  const proxy = new Proxy({}, { getPrototypeOf() { reads++; throw new Error(privateText); }, get() { reads++; throw new Error(privateText); } });
  for (const bad of [null, [], proxy, () => {}, Object.create(scenario()), scenario({ mode: 'live' }),
    scenario({ sourceRevision: '1' }), scenario({ off: 1 }), scenario({ returnedVm: 'real-guid' }),
    scenario({ inventory: Array(1) }), scenario({ inventory: Array(130).fill({}) }),
    scenario({ inventory: [{ id: 1, disks: Array(66).fill(1) }] }), scenario({ faults: [fault('native')] }),
    scenario({ faults: [fault('remove_vm', 'retry')] }), scenario({ faults: [fault('remove_vm'), fault('remove_vm')] })]) {
    rejects(() => requireVmRemovalScenario(bad));
  }
  const array = [1]; Object.defineProperty(array, '0', { get() { reads++; throw new Error(privateText); } });
  rejects(() => simulationArray(array, 1)); rejects(() => simulationField(proxy, 'mode'));
  for (const bad of [{ ...defaultVmRemovalJournalOptions(), mode: 'live' },
    { ...defaultVmRemovalJournalOptions(), faultRecord: 1 }, { ...defaultVmRemovalJournalOptions(), maxRecords: 17 },
    { ...defaultVmRemovalJournalOptions(), initialState: [] }, proxy]) rejects(() => createVmRemovalSimulation(bad));
  rejects(() => setup().run('native')); assert.equal(reads, 0);
  const final = prepared().run('remove', scenario({ faults: [fault('remove_vm', 'error', { private: privateText })], raw: privateText }));
  assert.doesNotMatch(JSON.stringify(final), /PRIVATE|raw|private/); noAuthority(final);
});

test('mock call and whole-environment observation budgets stop unbounded scripted use', () => {
  const ops = createVmRemovalMockOperations(), value = requireVmRemovalScenario(scenario());
  for (let i = 0; i < limits.calls; i++) ops.call('dispose', value);
  assert.throws(() => ops.call('dispose', value), { reason: 'call_limit' });
  assert.equal(ops.snapshot().calls, limits.calls);
  const observations = createVmRemovalMockOperations();
  for (let i = 0; i < limits.observations; i++) observations.observe('observe_initial', value, false, 201, 201);
  assert.throws(() => observations.observe('observe_initial', value, false, 201, 201), { reason: 'observation_limit' });
  assert.equal(observations.snapshot().observations, limits.observations);
  rejects(() => ops.call('native', value)); assert.ok(simulationSteps.includes('dispose'));
});

test('all model modules are data-only ESM with no launcher, callback adapter, transport or native capability', () => {
  const files = ['vmRemovalSimulation.mjs', 'vmRemovalSimulationContract.mjs', 'vmRemovalMemoryJournal.mjs',
    'vmRemovalMockOperations.mjs', 'vmRemovalErrorContract.mjs'];
  const allowed = new Set(['node:util/types', ...files.map(file => `./${file}`)]);
  for (const file of files) {
    const source = readFileSync(new URL(`../lib/${file}`, import.meta.url), 'utf8');
    for (const match of source.matchAll(/from ['"]([^'"]+)['"]/g)) assert.ok(allowed.has(match[1]), `${file}: ${match[1]}`);
    assert.doesNotMatch(source, /node:(?:fs|child_process|net|http|vm|module|worker_threads)|process\.|globalThis|registryCommand|\.tmp|\b(?:eval|Function)\s*\(|import\s*\(|Get-VM\b|New-VM\b|Remove-VM\b|Import-Module|DllImport|setTimeout|setInterval|require\s*\(/);
  }
  const manifest = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  const workflow = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert.equal(manifest.scripts['test:tooling:vm-simulation'], 'node --test scripts/__tests__/vm-removal-simulation.test.mjs');
  assert.ok(manifest.scripts['test:ci:preflight'].split(' ').includes('test:tooling:vm-simulation'));
  assert.match(workflow, /run: npm run test:tooling:vm-simulation(?:\r?\n|$)/);
});
