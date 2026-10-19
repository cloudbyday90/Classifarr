/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { RESTORE_STUDY, restoreStudyLane } from '../fixtures/ollamaGatewayRehearsal/restoreStudyContract.mjs';
import { requireRestoreCoverage } from '../fixtures/ollamaGatewayRehearsal/restoreStudyMetrics.mjs';
import { requireRestoreHeapSummary } from '../fixtures/ollamaGatewayRehearsal/restoreStudyHeap.mjs';
import { studyNodeArgs } from './gatewayStudyBootstrap.mjs';
import { assertStudyCommand,assertStudyVolumes } from './gatewayStudyInputs.mjs';
import { requireBoundStudyRecords } from './gatewayStudyPolicy.mjs';

export function restoreStudyDockerArgs({ name, label, image, lane, mount,binding,entry = 'restoreStudyWorker.mjs' }) {
  restoreStudyLane(lane);
  return ['create', '--name', name, '--label', label, '--network', 'none', '--read-only', '--init', '--no-healthcheck',
    '--user', '1000:1000', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
    '--memory', '1536m', '--memory-swap', '1536m', '--cpus', '1', '--pids-limit', '64',
    ...['archives','receipts','catalogs','fixtures','results'].flatMap(kind => mount(kind, `/${kind}`, true)),
    '--tmpfs', '/verification:rw,size=1g,uid=1000,gid=1000,mode=0700,noexec,nosuid,nodev',
    '--tmpfs', '/tmp:rw,size=16m,uid=1000,gid=1000,mode=0700,noexec,nosuid,nodev',
    '-e', 'CLASSIFARR_GATEWAY_FIXTURE=isolated','-e',`CLASSIFARR_SOAK_PROFILE=${binding.manifest.profile}`,
    '--entrypoint', 'node', image,...studyNodeArgs(binding,entry,[lane])];
}
export function assertRestoreStudySandbox(value, image, lane, volumes,binding,entry = 'restoreStudyWorker.mjs') {
  restoreStudyLane(lane);
  const host = value.HostConfig, config = value.Config;
  assert.equal(value.Image, image); assert.equal(host.NetworkMode, 'none'); assert.equal(host.ReadonlyRootfs, true);
  assert.equal(host.Privileged, false); assert.equal(host.PidMode, ''); assert.equal(host.Init, true);
  assert.deepEqual(host.CapDrop, ['ALL']); assert.ok(host.SecurityOpt.includes('no-new-privileges'));
  assert.equal(host.Memory, 1610612736); assert.equal(host.MemorySwap, host.Memory);
  assert.equal(host.NanoCpus, 1000000000); assert.equal(host.PidsLimit, 64);
  assert.equal(config.User, '1000:1000'); assert.deepEqual(config.Entrypoint, ['node']);
  assertStudyCommand(value,binding,entry,[lane]); assertStudyVolumes(value,volumes);
  assert.deepEqual(Object.keys(host.PortBindings ?? {}), []);
  assert.ok(config.Env.every(value => !/PASSWORD=|TOKEN=|CONFIG_FILE=|NODE_OPTIONS=|DATABASE_URL=/.test(value)));
  assert.deepEqual(value.Mounts.map(item => item.Destination).sort(), ['/archives','/catalogs','/fixtures','/receipts','/results']);
  assert.ok(value.Mounts.every(item => item.RW === false && item.Type === 'volume'));
  assert.ok(value.Mounts.every(item => item.Name === volumes[item.Destination.slice(1)]));
  assert.deepEqual(host.Tmpfs, { '/verification': 'rw,size=1g,uid=1000,gid=1000,mode=0700,noexec,nosuid,nodev',
    '/tmp': 'rw,size=16m,uid=1000,gid=1000,mode=0700,noexec,nosuid,nodev' });
}
export function requireRestoreStudyRecords(rows, lane) {
  restoreStudyLane(lane);
  assert.ok(rows.every(row => row.lane === lane && ['restore-limits','restore-cycle','restore-study'].includes(row.fixture)));
  const limits = rows.filter(row => row.fixture === 'restore-limits'); assert.equal(limits.length, 1);
  assert.ok([1,2].includes(limits[0].version)); assert.equal(limits[0].memory, '1610612736');
  assert.equal(limits[0].swap, '0'); assert.equal(limits[0].pids, '64');
  const [quota, period] = limits[0].cpu.split(' ').map(Number); assert.ok(period > 0); assert.equal(quota / period, 1);
  const cycles = rows.filter(row => row.fixture === 'restore-cycle' && row.lane === lane);
  assert.deepEqual(cycles.map(row => row.cycle), [1,2,3,4,5]);
  assert.ok(cycles.every(row => row.verified === true && row.scratchEmpty === true && row.noChildren === true &&
    Number.isFinite(row.durationMs) && row.durationMs >= 0));
  for (const row of cycles) { if (lane === 'allocations') requireRestoreHeapSummary(row.profile); else assert.equal(row.profile, undefined); }
  const results = rows.filter(row => row.fixture === 'restore-study' && row.lane === lane);
  assert.equal(results.length, 1); const result = results[0];
  assert.equal(result.passed, true); assert.equal(result.cycles, 5); requireRestoreCoverage(result.observations, lane);
  assert.ok(Object.keys(result.memoryEvents).length >= 3 && Object.values(result.memoryEvents).every(value => value === '0'));
  assert.equal(result.pidsEvents, 'max 0');
  if (lane === 'natural') assert.equal(result.gc.forced, 0);
  return result;
}

/** Only called from the existing isolated producer. No source authority is passed into a verifier. */
export async function runGatewayRestoreMemoryStudy({ docker, image, label, names, stores, mount, remove, inspect, once, report,binding,execFixture }) {
  const sourceCheck = action => {
    const output = execFixture('restoreStudySource.mjs',[action],{timeoutMs:150000});
    assert.equal(output.ok, true, 'restore_study_source_failed');
    requireBoundStudyRecords(output.stdout.trim().split('\n').map(line => JSON.parse(line)),binding,'restoreStudySource.mjs').forEach(report);
  };
  assert.ok((await once('archiver')).some(row => row.state === 'awaiting_catalog_verification'));
  sourceCheck('before');
  for (const lane of ['natural','allocations']) {
    const name = names[`restore-${lane}`]; remove(name);
    docker(restoreStudyDockerArgs({ name, label, image, lane, mount,binding })); assertRestoreStudySandbox(inspect(name), image, lane, stores,binding);
    docker(['start', name]); report({ stage: 'restore_lane_started', lane });
    const started = Date.now(), deadline = started + (lane === 'natural' ? RESTORE_STUDY.naturalMs : RESTORE_STUDY.allocationsMs) + 30000;
    let emitted = 0;
    for (;;) {
      const state = inspect(name).State;
      const lines = docker(['logs', name]).trim().split('\n').filter(Boolean); assert.ok(lines.length <= 20, 'restore_study_output_limit');
      for (const line of lines.slice(emitted)) { assert.ok(Buffer.byteLength(line) <= 60000); report(JSON.parse(line)); }
      emitted = lines.length;
      if (!state.Running) {
        const rows = lines.map(line => JSON.parse(line));
        assert.equal(state.OOMKilled, false); assert.equal(state.ExitCode, 0);
        requireRestoreStudyRecords(requireBoundStudyRecords(rows,binding,'restoreStudyWorker.mjs'), lane); break;
      }
      assert.ok(Date.now() < deadline, 'restore_study_deadline'); await delay(2000);
    }
  }
  sourceCheck('after'); report({ stage: 'restore_memory_study_passed' });
}
