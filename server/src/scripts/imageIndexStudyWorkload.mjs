/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { assertStudyProviderEnvironment } from './resourceStudyProviderFixture.mjs';
import { createStudySampler, readStudyCgroup } from './resourceStudyMetrics.mjs';
import { assertStudyBudget } from './resourceStudyBudget.mjs';
import { IMAGE_INDEX_STUDY_CASES, assertImageIndexStudyReceipt } from './imageIndexStudyContract.mjs';
import { clearStudyImageIndexes, claimStudyImageIndex, readStudyImageData, seedImageIndexStudy } from './imageIndexStudyFixture.mjs';
import { summarizeImageIndexSamples } from './imageIndexStudyObservation.mjs';
import { executeStudyImageWorker, awaitStudyIndexIdle } from './imageIndexStudyWorker.mjs';
import { inspectImageIndexes } from '../services/imageIndexMaintenanceCatalog.mjs';

export async function runImageIndexStudy(db, budget = 'baseline', progress = () => {}) {
  assertStudyProviderEnvironment();
  assertStudyBudget(await readStudyCgroup(), budget);
  const started = performance.now(), client = await db.pool.connect();
  const query = (...args) => client.query(...args);
  let sampler;
  try {
    await query("SET statement_timeout='30s'; SET lock_timeout='2s'");
    assert.equal((await query('SELECT gate_state FROM policy_native_intent_reconciliation_restore_gates WHERE gate_id=1')).rows[0]?.gate_state, 'ready');
    assert.deepEqual(await readStudyImageData(query), { rows: 0, vectors: 0, history: 0, identity_sum: '0' });
    assert.equal((await query('SELECT count(*)::integer n FROM task_queue')).rows[0].n, 0);
    sampler = await createStudySampler();
    const cases = [], interruption = {};
    let seeded = 0;
    for (const scenario of IMAGE_INDEX_STUDY_CASES) {
      await awaitStudyIndexIdle(query);
      await clearStudyImageIndexes(query);
      if (seeded !== scenario.rows) {
        await seedImageIndexStudy({ query }, seeded, scenario.rows, sampler.sample);
        seeded = scenario.rows;
      }
      const before = await readStudyImageData(query);
      assert.equal(before.rows, scenario.rows); assert.equal(before.vectors, scenario.rows);
      assert.equal(before.history, scenario.rows);
      let task = await claimStudyImageIndex(query);
      if (scenario.name === 'interrupted_recovery') {
        const writer = await db.pool.connect();
        try {
          await writer.query("BEGIN; SET LOCAL idle_in_transaction_session_timeout='15s'; SET LOCAL lock_timeout='2s'");
          await writer.query('LOCK TABLE classification_embeddings IN ROW EXCLUSIVE MODE');
          const stopped = await executeStudyImageWorker({ task, query, sampler, phase: 'interruption', interrupt: true });
          assert.equal(stopped.interrupted, true); assert.equal(stopped.signal, 'SIGTERM');
          assert.equal((await inspectImageIndexes(query))[0].action, 'repair');
          interruption.invalidObserved = true;
        } finally { try { await writer.query('ROLLBACK'); } finally { writer.release(true); } }
        const stale = task;
        task = (await query(`UPDATE task_queue SET claim_token=gen_random_uuid(),
          visible_at=clock_timestamp()+INTERVAL '150 seconds' WHERE id=$1
          RETURNING id::text,claim_token`, [task.id])).rows[0];
        assert.notEqual(stale.claim_token, task.claim_token); interruption.claimRotated = true;
        const rejected = await executeStudyImageWorker({ task: stale, query, sampler, phase: 'stale_claim' });
        assert.equal(rejected.exitCode, 75); interruption.staleClaimRejected = true;
      }
      const sampleStart = sampler.samples.length;
      const execution = await executeStudyImageWorker({ task, query, sampler, phase: scenario.name });
      const plan = await inspectImageIndexes(query);
      const acknowledgement = (await query("SELECT status,claim_token,payload->'result'->'workMemMiB' AS work_mem_mib FROM task_queue WHERE id=$1", [task.id])).rows[0];
      const acknowledged = acknowledgement.status === 'completed' && acknowledgement.claim_token === null;
      assert.equal(acknowledged, execution.exitCode === 0);
      assert.deepEqual(await readStudyImageData(query), before);
      const { interrupted: _interrupted, ...metrics } = execution;
      cases.push({ ...scenario, ...metrics, outcome: acknowledged ? 'complete' : 'incomplete', acknowledged,
        workMemMiB: acknowledged ? acknowledgement.work_mem_mib : null,
        validIndexes: plan.filter(row => row.action === 'preserve').length,
        ...summarizeImageIndexSamples(sampler.samples.slice(sampleStart)) });
      progress({ scenario: scenario.name, outcome: cases.at(-1).outcome });
      // Retire only the synthetic claim; do not simulate production retry success.
      if (!acknowledged) await query(`UPDATE task_queue SET status='failed',claim_token=NULL,visible_at=NULL
        WHERE id=$1 AND claim_token=$2`, [task.id, task.claim_token]);
    }
    await awaitStudyIndexIdle(query);
    const result = { version: 'image_index_study.v1', status: 'measured', profile: 'image-index', budget,
      dimensions: 2000, rowsPreserved: true, workersStopped: true, databaseIdle: true, interruption, cases,
      durationMs: Math.round(performance.now() - started), initial: sampler.initial, final: await readStudyCgroup() };
    assertImageIndexStudyReceipt(result, budget);
    return result;
  } finally { sampler?.close(); client.release(true); }
}
