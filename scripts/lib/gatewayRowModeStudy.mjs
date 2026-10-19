/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { bindStudySources } from './gatewayStudyBinding.mjs';
import { requireBoundStudyRecords } from './gatewayStudyPolicy.mjs';
import { restoreStudyDockerArgs, assertRestoreStudySandbox } from './gatewayRestoreMemoryStudy.mjs';
import { requireRowRuns, rowPromotionScreen } from '../fixtures/ollamaGatewayRehearsal/rowModeContract.mjs';
import { requireRestoreHeapSummary } from '../fixtures/ollamaGatewayRehearsal/restoreStudyHeap.mjs';

export function assertRowModeSandbox(value,image,lane,stores,binding) {
  assert.match(binding.sha256,/^[a-f0-9]{64}$/);
  const socket = value.Mounts.filter(item => item.Destination === '/source-socket');
  assert.equal(socket.length,1); assert.equal(socket[0].Name,stores.socket);
  assert.equal(socket[0].Type,'volume'); assert.equal(socket[0].RW,false);
  // Apply the existing verifier's common resource/input-only contract, then the
  // separately asserted study command and SELECT-only source socket above.
  assertRestoreStudySandbox({ ...value,
    Mounts:value.Mounts.filter(item => item.Destination !== '/source-socket') },image,lane,stores,binding,'rowModeWorker.mjs');
}
export function requireRowModeRecords(rows,lane,binding) {
  assert.equal(rows.length,10);
  requireBoundStudyRecords(rows,binding,'rowModeWorker.mjs');
  const runs = rows.slice(1,9); assert.ok(runs.every(row => row.fixture === 'row-mode-run')); requireRowRuns(runs,lane);
  for (const row of runs) {
    if (lane === 'allocations') requireRestoreHeapSummary(row.profile); else assert.equal(row.profile,undefined);
    assert.equal(row.gc.forced,0); assert.ok(row.observations.samples >= 2 && row.observations.samples <= 512);
    assert.ok(row.observations.maxGapMs <= 2000);
    for (const key of ['rss','heapUsed','heapTotal','external','arrayBuffers','heapPhysical','v8Malloc','currentBytes','anonBytes','fileBytes']) {
      const metric = row.observations.memory[key]; assert.equal(metric.count,row.observations.samples);
      for (const value of [metric.first,metric.last,metric.min,metric.max]) assert.ok(Number.isFinite(value) && value >= 0);
      assert.ok(metric.min <= metric.first && metric.max >= metric.last);
    }
  }
  const last = rows[9]; assert.equal(last.fixture,'row-mode-complete'); assert.equal(last.lane,lane);
  assert.equal(last.equivalent,true); assert.equal(last.probes,10); assert.equal(last.dependencyRows,1);
  assert.equal(last.readOnlyDenial,true);
  assert.equal(last.warmups,1); assert.equal(last.baselineReads,1); assert.equal(last.pidsEvents,'max 0');
  assert.ok(Object.keys(last.memoryEvents).length >= 3 && Object.values(last.memoryEvents).every(value => value === '0'));
  assert.equal(last.limits.memory,'1610612736'); assert.equal(last.limits.swap,'0');
  assert.equal(last.limits.cpu,'100000 100000'); assert.equal(last.limits.pids,'64');
  return runs;
}
export async function runGatewayRowModeStudy({ docker,image,revision,label,names,stores,mount,remove,inspect,once,report,binding,execFixture }) {
  assert.deepEqual(bindStudySources({ revision,image }),binding);
  const create = lane => {
    const name = names[`row-${lane}`]; remove(name);
    const args = restoreStudyDockerArgs({ name,label,image,lane,mount,binding,entry:'rowModeWorker.mjs' });
    args.splice(args.indexOf('--entrypoint'),0,...mount('socket','/source-socket',true));
    docker(args); assertRowModeSandbox(inspect(name),image,lane,stores,binding); return name;
  };
  const sourceCheck = action => {
    const checked = execFixture('restoreStudySource.mjs',[action],{timeoutMs:150000});
    assert.equal(checked.ok,true,'row_mode_source_check_failed');
    requireBoundStudyRecords(checked.stdout.trim().split('\n').map(line => JSON.parse(line)),binding,'restoreStudySource.mjs').forEach(report);
  };
  assert.ok((await once('archiver')).some(row => row.state === 'awaiting_catalog_verification')); sourceCheck('before');
  const results = {};
  for (const lane of ['natural','allocations']) {
    const name = create(lane); docker(['start',name]); report({ stage:'row_mode_lane_started',lane });
    const deadline = Date.now()+630000; let emitted = 0;
    for (;;) {
      const state = inspect(name).State, lines = docker(['logs',name]).trim().split('\n').filter(Boolean);
      assert.ok(lines.length <= 12);
      for (const line of lines.slice(emitted)) { assert.ok(Buffer.byteLength(line) <= 20000); report(JSON.parse(line)); } emitted = lines.length;
      if (!state.Running) {
        assert.equal(state.OOMKilled,false); assert.equal(state.ExitCode,0,'row_mode_worker_failed');
        results[lane] = requireRowModeRecords(lines.map(line => JSON.parse(line)),lane,binding); break;
      }
      assert.ok(Date.now() < deadline,'row_mode_deadline'); await delay(2000);
    }
  }
  sourceCheck('after'); assert.deepEqual(bindStudySources({ revision,image }),binding);
  report({ stage:'row_mode_study_passed',...rowPromotionScreen(results.natural,results.allocations) });
}
