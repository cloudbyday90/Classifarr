/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import * as db from '/app/src/config/database.mjs';
import { queueService } from '/app/src/services/queueService.mjs';
import { createQueueEnrichmentWriteSession } from '/app/src/services/queueEnrichmentWriteSession.mjs';
import { assertFixtureEnvironment, poll, receipt } from './common.mjs';

export async function installQueueWorkload() {
  await assertFixtureEnvironment();
  assert.deepEqual((await db.query('SELECT value FROM shutdown_sentinel')).rows, [{ value: 'preserved' }]);
  const { rows: [counts] } = await db.query('SELECT (SELECT count(*) FROM libraries)::int AS libraries, (SELECT count(*) FROM users)::int AS users');
  assert.deepEqual(counts, { libraries: 0, users: 0 });
  const { rows: [control] } = await db.query('SELECT generation FROM queue_drill_control');
  assert(['initial', 'replay'].includes(control.generation));
  const original = queueService.processTask.bind(queueService);
  queueService.processTask = task => {
    if (task.payload?.shutdownFixture !== 'v1') return original(task);
    return execute(task, control.generation).catch(async error => {
      await receipt('failure', { phase: 'queue_task', reason: String(error.message).slice(0, 300) });
      throw error;
    });
  };
  // Only the synthetic readiness dependency is replaced; no real AI/provider
  // settings are enabled. Real CPU/memory admission and claim selection remain.
  queueService.queueWorkerLoopService.aiRouterService = { checkAvailability: async () => true };
  await receipt('ready', { mode: 'queue', generation: control.generation, pid: process.pid });
}

async function execute(task, generation) {
  assert(['metadata_enrichment', 'classification'].includes(task.task_type));
  await db.query('INSERT INTO queue_drill_claims(task_id, token, generation, task_type) VALUES ($1,$2,$3,$4)',
    [task.id, task.claim_token, generation, task.task_type]);
  if (generation === 'initial') {
    // Simulate provider work outside any transaction. The real app/host exit
    // must interrupt it; never let this old execution complete as a fallback.
    await sleep(180_000);
    throw new Error('initial_claim_was_not_interrupted');
  }
  await poll(async () => (await db.query('SELECT finish FROM queue_drill_control')).rows[0].finish, 120_000);
  const result = { fixture: 'current' };
  if (task.task_type === 'metadata_enrichment') {
    const session = createQueueEnrichmentWriteSession({ db, task, logger: queueService.logger });
    await session.finish(result, null, client => client.query(
      'INSERT INTO queue_drill_effects(task_id, token) VALUES ($1,$2)', [task.id, task.claim_token]));
  } else assert.equal(await queueService.completeTask(task.id, result, task.claim_token), true);
}
