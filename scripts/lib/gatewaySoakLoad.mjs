/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { studyNodeArgs } from './gatewayStudyBootstrap.mjs';
import { studyBindingRecord } from './gatewayStudyPolicy.mjs';

/** Shared orchestration; the off treatment has explicit absence checks, not skipped co-load assertions. */
export async function runGatewaySoakLoad({ docker, source, binding, profile, read, create, check, once, fixture, report,
  now = () => Date.now(), sleep = delay }) {
  const baseline = profile.name === 'comparison-off', windows = [], workers = [];
  docker(['exec', '-d', '--user', '1000:1000', '-e', 'CLASSIFARR_GATEWAY_FIXTURE=isolated', '-e', `CLASSIFARR_SOAK_PROFILE=${profile.name}`,
    source, 'node', ...studyNodeArgs(binding, 'soakInference.mjs')]);
  const deadline = now() + profile.runnerMs;
  let workerAt, verifierAt, stopped = false, result;
  while (!(result = read('/results/soak-result.json'))) {
    assert.equal(read('/results/binding-failed.json'), null, 'inference_bootstrap_failed');
    assert.ok(now() < deadline, 'soak_deadline');
    const archiveMarker = read('/results/soak-archives.json'), afterMarker = read('/results/soak-after.json');
    if (!baseline && workerAt === undefined && archiveMarker) {
      create('archiver', 'loop'); workerAt = now(); report({ stage: 'scheduled_archive_started' });
    }
    if (!baseline && workerAt !== undefined && verifierAt === undefined && now() - workerAt >= 20000) {
      create('catalog-verifier', 'loop'); verifierAt = now();
    }
    if (!baseline && workerAt !== undefined && !stopped && afterMarker) {
      for (const kind of ['archiver', 'catalog-verifier']) {
        // A fixed kind is resolved to the exact owned name by the caller.
        const rows = check(kind, true);
        workers.push({ kind, rows }); windows.push(...rows.filter(row => row.fixture === 'child-window'));
      }
      stopped = true; report({ stage: 'scheduled_workers_stopped' });
    }
    if (!baseline && !stopped) for (const kind of ['archiver', 'catalog-verifier']) {
      if ((kind === 'archiver' ? workerAt : verifierAt) !== undefined) check(kind, false);
    }
    await sleep(2000);
  }
  assert.deepEqual(read('/results/inference-binding.json'), studyBindingRecord(binding, 'soakInference.mjs'));
  report({ stage: 'inference', ...result }); assert.equal(result.passed, true);
  if (baseline) {
    assert.equal(workerAt, undefined); assert.equal(verifierAt, undefined); assert.equal(workers.length, 0);
  } else {
    assert.ok(stopped && verifierAt !== undefined);
    // Accept actual receipts after load drains; never alter schedules or retry state.
    await once('catalog-verifier'); await once('archiver');
  }
  const data = fixture('check', JSON.stringify(windows)); data.forEach(report);
  return { inference: result, data, workers };
}
