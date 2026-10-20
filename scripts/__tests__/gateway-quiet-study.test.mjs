/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { captureGatewayHostSnapshot } from '../lib/gatewayHostSnapshot.mjs';
import { runGatewayQuietPressureStudy } from '../lib/gatewayQuietPressureStudy.mjs';

const image = `sha256:${'a'.repeat(64)}`, revision = 'b'.repeat(40);
const id = 'a'.repeat(64), otherId = 'b'.repeat(64);
const started = '2026-10-20T13:57:13.265584359Z', never = '0001-01-01T00:00:00Z';
const row = () => [id, 'running', started, never, 0];
const ok = stdout => ({ ok: true, exitCode: 0, stdout, stderr: 'private stderr', timedOut: false, outputLimited: false });
const responses = (rows = [row()]) => [JSON.stringify('daemon-test'), rows.map(v => v[0]).join('\n'),
  ...(rows.length ? [rows.map(v => JSON.stringify(v)).join('\n')] : []), rows.map(v => v[0]).join('\n'), JSON.stringify('daemon-test')];
const capture = values => captureGatewayHostSnapshot({ now: () => 0, command: () => ok(values.shift()) });
const arm = () => ({ captures: [{}, {}], historyPreserved: true, history: { bytes: 228000000,
  shape: { version: 1, rows: 3000, paddingBytes: 75000, payloadSha256: 'c'.repeat(64) } } });
const host = () => ({ containers: 1, sha256: 'd'.repeat(64) });

test('snapshot uses only bounded fixed reads and publishes count/digest, not host identifiers', () => {
  const commands = [], values = responses();
  const value = captureGatewayHostSnapshot({ now: () => 0, command: (args, options) => {
    commands.push(args); assert.deepEqual(options, { timeoutMs: 5000 }); return ok(values.shift());
  } });
  assert.deepEqual(commands[0], ['info', '--format', '{{json .ID}}']);
  assert.deepEqual(commands[1], ['ps', '-aq', '--no-trunc']);
  assert.deepEqual(commands[3], commands[1]); assert.deepEqual(commands[4], commands[0]);
  assert.deepEqual(commands[2].slice(0, 4), ['inspect', '--type', 'container', '--format']);
  assert.deepEqual(commands[2].slice(5), [id]);
  assert.ok(!/Env|Labels|Mounts|Name|Config/.test(commands[2][4]));
  assert.deepEqual(Object.keys(value), ['containers', 'sha256']); assert.equal(value.containers, 1);
  assert.match(value.sha256, /^[a-f0-9]{64}$/); assert.ok(!JSON.stringify(value).includes('private'));
  assert.ok(!JSON.stringify(value).includes(id)); assert.ok(!JSON.stringify(value).includes('daemon-test'));
});

test('empty inventories are legitimate and ordering is canonical without broad label exclusions', () => {
  assert.equal(capture(responses([])).containers, 0);
  const rows = [row(), [otherId, 'exited', never, started, 1]];
  const first = capture(responses(rows)), reversed = responses(rows.toReversed());
  reversed[3] = `${id}\n${otherId}`;
  assert.deepEqual(capture(reversed), first);
});

test('every projected lifecycle field and daemon identity affect the baseline fingerprint', () => {
  const baseline = capture(responses());
  for (const change of [v => { v[0] = otherId; }, v => { v[1] = 'paused'; },
    v => { v[2] = '2026-10-20T13:57:13.265584360Z'; }, v => { v[3] = started; }, v => { v[4] = 1; }]) {
    const value = row(); change(value); assert.notEqual(capture(responses([value])).sha256, baseline.sha256);
  }
  const changedDaemon = responses(); changedDaemon[0] = changedDaemon[4] = '"other-daemon"';
  assert.notEqual(capture(changedDaemon).sha256, baseline.sha256);
});

test('races, partial/duplicate rows, malformed fields and oversized inventories fail closed without raw errors', () => {
  const cases = [
    v => { v[3] = ''; }, v => { v[4] = '"different"'; }, v => { v[1] = `${id}\n${id}`; },
    v => { v[1] = '--malicious'; }, v => { v[2] = ''; }, v => { v[2] += `\n${v[2]}`; },
    v => { v[2] = 'private secret malformed'; }, v => { v[0] = '{}'; }, v => { v[0] = '""'; },
    v => { v[0] = '"https://private-host"'; }, v => { v[2] = JSON.stringify([id, 'unknown', started, never, 0]); },
    v => { v[2] = JSON.stringify([id, 'running', '2026-02-30T00:00:00Z', never, 0]); },
    v => { v[2] = JSON.stringify([id, 'running', started, never, -1]); },
    v => { v[2] = JSON.stringify([id, 'running', started, never, Number.MAX_SAFE_INTEGER + 1]); },
    v => { v[2] = JSON.stringify([id, 'running', started, 'private timestamp', 0]); },
    v => { v[2] = JSON.stringify([id, 'running', started, never, 0, 'extra']); },
    v => { v[2] = JSON.stringify([otherId, 'running', started, never, 0]); },
    v => { v[1] = Array.from({ length: 129 }, (_, i) => i.toString(16).padStart(64, '0')).join('\n'); },
  ];
  for (const change of cases) {
    const values = responses(); change(values);
    assert.throws(() => capture(values), error => error.message === 'gateway_host_snapshot_unavailable' && !error.cause);
  }
});

test('failed, truncated, timed-out, thrown and late commands refuse within a shared observation deadline', () => {
  for (const value of [{ ...ok('"daemon"'), ok: false }, { ...ok('"daemon"'), exitCode: 1 },
    { ...ok('"daemon"'), timedOut: true }, { ...ok('"daemon"'), outputLimited: true },
    ok('x'.repeat(65536)), ok('é'.repeat(32768))]) {
    let calls = 0;
    assert.throws(() => captureGatewayHostSnapshot({ now: () => 0, command: () => { calls++; return value; } }), /snapshot_unavailable/);
    assert.equal(calls, 1);
  }
  assert.throws(() => captureGatewayHostSnapshot({ command: () => { throw Error('private credential'); } }), /snapshot_unavailable/);
  let ticks = 0, calls = 0;
  assert.throws(() => captureGatewayHostSnapshot({ now: () => ticks++ * 2000, command: (_args, options) => {
    calls++; assert.equal(options.timeoutMs, 3000); return ok('"daemon"');
  } }), /snapshot_unavailable/); assert.equal(calls, 1);
  ticks = 0;
  assert.throws(() => captureGatewayHostSnapshot({ now: () => ticks++ * 6000, command: () => assert.fail() }), /snapshot_unavailable/);
});

test('all five commands share one shrinking read budget rather than five fresh timeouts', () => {
  let elapsed = 0; const timeouts = [], values = responses();
  captureGatewayHostSnapshot({ now: () => elapsed, command: (_args, options) => {
    timeouts.push(options.timeoutMs); elapsed += 900; return ok(values.shift());
  } });
  assert.deepEqual(timeouts, [5000, 4100, 3200, 2300, 1400]);
});

test('quiet study retains the same sequential ABBA work and requires five matching endpoint observations', async () => {
  const events = [], reports = [], calls = [];
  await runGatewayQuietPressureStudy(image, revision, {
    snapshot: () => { events.push('observe'); return { ...host(), private: 'never publish' }; },
    run: async (...args) => { calls.push(args); events.push('run_and_cleanup'); return [arm()]; },
    report: value => reports.push(value),
  });
  assert.deepEqual(events, ['observe', 'run_and_cleanup', 'observe', 'run_and_cleanup', 'observe', 'run_and_cleanup', 'observe', 'run_and_cleanup', 'observe']);
  assert.deepEqual(calls.map(v => v[5]), [false, true, true, false]);
  assert.ok(calls.every(v => JSON.stringify(v.slice(0, 5)) === JSON.stringify([image, revision, false, true, 'catalog-pressure'])));
  assert.equal(reports.at(-1).observations, 5); assert.equal(reports.at(-1).completedArms, 4);
  assert.equal(reports.at(-1).timing, 'matching_endpoints_not_proof_of_idleness');
  assert.ok(!JSON.stringify(reports).includes('never publish'));
});

test('unavailable preflight starts no work; invalid identity is rejected even before host reads', async () => {
  const reports = [];
  await assert.rejects(runGatewayQuietPressureStudy(image, revision, {
    snapshot: () => { throw Error('private data'); }, run: async () => assert.fail(), report: value => reports.push(value),
  }), /snapshot_unavailable/);
  assert.deepEqual(reports, [{ study: 'archiver-quiet', stage: 'timing_inconclusive', reason: 'host_snapshot_unavailable', completedArms: 0, observations: 0 }]);
  for (const value of [{}, { containers: 129, sha256: host().sha256 }, { ...host(), sha256: 'bad' }]) {
    await assert.rejects(runGatewayQuietPressureStudy(image, revision, {
      snapshot: () => value, run: async () => assert.fail(), report: () => {},
    }), /snapshot_unavailable/);
  }
  await assert.rejects(runGatewayQuietPressureStudy('tag', revision, { snapshot: () => assert.fail() }));
});

test('interference or a failed check retains completed results and stops without retries after any arm', async () => {
  for (const stopAfter of [1, 2, 3, 4]) for (const failure of ['changed', 'unavailable']) {
    let runs = 0, checks = 0; const reports = [];
    await assert.rejects(runGatewayQuietPressureStudy(image, revision, {
      snapshot: () => {
        if (checks++ === stopAfter) {
          if (failure === 'unavailable') throw Error('private');
          return { ...host(), sha256: 'e'.repeat(64) };
        }
        return host();
      },
      run: async () => { runs++; return [arm()]; }, report: value => reports.push(value),
    }), failure === 'changed' ? /host_state_changed/ : /snapshot_unavailable/);
    assert.equal(runs, stopAfter); assert.equal(checks, stopAfter + 1);
    assert.equal(reports.filter(v => v.historyPreserved).length, stopAfter);
    assert.equal(reports.at(-1).completedArms, stopAfter); assert.equal(reports.at(-1).stage, 'timing_inconclusive');
    assert.ok(!reports.some(v => v.stage === 'passed_cleanup_verified'));
    const completed = reports.findLastIndex(v => v.historyPreserved);
    assert.ok(completed < reports.length - 1); assert.ok(!JSON.stringify(reports).includes('private'));
  }
});

test('failed fixture or cleanup preserves the original failure, with no successful arm or later snapshot', async () => {
  const original = Error('cleanup_failed'); let checks = 0, runs = 0; const reports = [];
  await assert.rejects(runGatewayQuietPressureStudy(image, revision, {
    snapshot: () => { checks++; return host(); }, run: async () => { runs++; throw original; }, report: value => reports.push(value),
  }), error => error === original);
  assert.equal(checks, 1); assert.equal(runs, 1); assert.ok(!reports.some(v => v.historyPreserved));
  assert.ok(!reports.some(v => v.stage === 'passed_cleanup_verified'));
});

test('CLI rejects malformed identity and extra quiet-study controls before any Docker work', () => {
  for (const args of [['tag', revision, '--archiver-quiet-study'], [image, revision, '--archiver-quiet-study', '--retry'],
    [image, revision, '--archiver-quiet-study=unsafe']]) {
    const value = spawnSync(process.execPath, ['scripts/run-gateway-online-archive-rehearsal.mjs', ...args], { encoding: 'utf8', timeout: 10000 });
    assert.equal(value.status, 1); assert.match(value.stderr, /immutable_image_and_revision_required|archive_rehearsal_arguments_invalid/);
  }
});
