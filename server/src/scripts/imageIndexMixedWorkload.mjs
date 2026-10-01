/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { assertStudyProviderEnvironment } from './resourceStudyProviderFixture.mjs';
import { createStudySampler, readStudyCgroup } from './resourceStudyMetrics.mjs';
import { assertStudyBudget } from './resourceStudyBudget.mjs';
import { seedImageIndexStudy, clearStudyImageIndexes, claimStudyImageIndex, readStudyImageData } from './imageIndexStudyFixture.mjs';
import { executeStudyImageWorker, awaitStudyIndexIdle } from './imageIndexStudyWorker.mjs';
import { summarizeImageIndexSamples } from './imageIndexStudyObservation.mjs';
import { inspectImageIndexes } from '../services/imageIndexMaintenanceCatalog.mjs';
import { createImageIndexMixedForeground } from './imageIndexMixedForeground.mjs';
import { IMAGE_MIXED_CASES, assertImageIndexMixedReceipt } from './imageIndexMixedContract.mjs';

/** Fresh, isolated installation only. Aggregate evidence, never media or credentials. */
export async function runImageIndexMixedStudy(db, budget, progress = () => {}, profile = 'image-index-mixed') {
  assertStudyProviderEnvironment(); assert.equal(budget, 'image-capacity');
  assert(['image-index-mixed', 'classification-retrieval'].includes(profile));
  assertStudyBudget(await readStudyCgroup(), budget);
  const started = performance.now(), client = await db.pool.connect(), query = (...args) => client.query(...args);
  let sampler;
  try {
    await query("SET statement_timeout='30s'; SET lock_timeout='2s'");
    assert.equal((await query('SELECT gate_state FROM policy_native_intent_reconciliation_restore_gates WHERE gate_id=1')).rows[0]?.gate_state, 'ready');
    assert.deepEqual(await readStudyImageData(query), { rows: 0, vectors: 0, history: 0, identity_sum: '0' });
    assert.equal((await query('SELECT count(*)::integer n FROM task_queue')).rows[0].n, 0);
    sampler = await createStudySampler();
    await clearStudyImageIndexes(query);
    for (const [before, after] of [[0, 1000], [1000, 10000], [10000, 50000]]) {
      await seedImageIndexStudy({ query }, before, after, sampler.sample);
    }
    const original = await readStudyImageData(query);
    const foreground = await createImageIndexMixedForeground(db, profile), cases = [];
    let replacement, invalidObserved = false, staleClaimRejected = false;
    for (const name of IMAGE_MIXED_CASES) {
      await awaitStudyIndexIdle(query);
      if (name !== 'recovery') await clearStudyImageIndexes(query);
      let work, failure, foregroundResult, execution = null, task;
      let overlapRetrievals = 0, buildActive = false, startedDuringBuild = false, baselineDone = false;
      const sampleStart = sampler.samples.length;
      const launch = () => {
        work = foreground(() => { if (buildActive) overlapRetrievals++; });
        work.then(value => { foregroundResult = value; }, error => { failure = error; }).finally(() => { baselineDone = true; });
      };
      try {
        if (name === 'baseline') {
          launch();
          while (!baselineDone) { await sampler.sample(name, { indexPhase: 'idle', wait: 'none' }); await delay(500); }
        } else {
          task = name === 'recovery' ? replacement : await claimStudyImageIndex(query);
          execution = await executeStudyImageWorker({ task, query, sampler, phase: name, onActivity: async activity => {
            buildActive = Boolean(activity?.phase?.startsWith('building index'));
            if (failure) throw failure;
            if (!work && buildActive) { startedDuringBuild = true; launch(); }
            return name === 'cancelled_build' && buildActive && overlapRetrievals >= 5;
          } });
        }
      } finally {
        buildActive = false;
        if (work) {
          try {
            // Foreground can outlive a cancelled or completed build. Keep sampling
            // through its drain, but never leave it running if telemetry fails.
            while (!baselineDone) { await sampler.sample(name, { indexPhase: 'idle', wait: 'none' }); await delay(500); }
          } finally { await work; }
        }
      }
      if (failure) throw failure;
      assert(foregroundResult, 'mixed_study_build_overlap_missing');
      const plan = await inspectImageIndexes(query);
      const ack = task ? (await query("SELECT status,claim_token,payload->'result'->'workMemMiB' AS work_mem_mib FROM task_queue WHERE id=$1", [task.id])).rows[0] : null;
      const acknowledged = ack?.status === 'completed' && ack.claim_token === null;
      if (name === 'cancelled_build') {
        assert.equal(plan[0].action, 'repair'); invalidObserved = true;
        assert.equal(ack.claim_token, task.claim_token);
        replacement = (await query(`UPDATE task_queue SET claim_token=gen_random_uuid(),
          visible_at=clock_timestamp()+INTERVAL '150 seconds' WHERE id=$1 AND claim_token=$2 RETURNING id::text,claim_token`,
        [task.id, task.claim_token])).rows[0];
        assert(replacement); assert.notEqual(replacement.claim_token, task.claim_token);
        const rejected = await executeStudyImageWorker({ task, query, sampler, phase: 'stale_claim' });
        assert.equal(rejected.exitCode, 75); staleClaimRejected = true;
      }
      const preserved = await readStudyImageData(query);
      for (const key of ['rows', 'vectors', 'identity_sum']) assert.equal(preserved[key], original[key]);
      assert(preserved.history >= original.history);
      cases.push({ name, execution, foreground: foregroundResult, startedDuringBuild, overlapRetrievals,
        acknowledged, workMemMiB: acknowledged ? ack.work_mem_mib : null,
        validIndexes: plan.filter(row => row.action === 'preserve').length,
        ...summarizeImageIndexSamples(sampler.samples.slice(sampleStart)) });
      progress({ scenario: name, exitCode: execution?.exitCode ?? null, overlapRetrievals });
    }
    await awaitStudyIndexIdle(query);
    const result = { version: 'image_index_mixed.v1', status: 'measured', profile, budget,
      rows: 50000, rowsPreserved: true, workersStopped: true, databaseIdle: true, invalidObserved, staleClaimRejected,
      durationMs: Math.round(performance.now() - started), cases, initial: sampler.initial, final: await readStudyCgroup() };
    assertImageIndexMixedReceipt(result, budget); return result;
  } finally { sampler?.close(); client.release(true); }
}
