/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';

/** Test-only bounded cohort. IDs and payloads never appear in the aggregate receipt. */
export function createStudyQueueRecovery({ db, queue, admission, now = () => performance.now(), wait = delay }) {
  const ids = new Set(), started = new Set();
  let heldAt = null, clearedAt = null;
  const receipt = { cohortSize: 20, started: 0, completed: 0, startedDuringPressure: 0,
    holdChecks: 0, heldMs: null, firstDispatchMs: null, completedMs: null };
  const rows = async () => (await db.query("SELECT id,status,attempts,payload->'result' AS result FROM task_queue WHERE id=ANY($1::integer[])", [[...ids]])).rows;
  return {
    receipt,
    onStart(task) {
      if (!ids.has(task.id)) return;
      if (clearedAt === null) receipt.startedDuringPressure++;
      assert.notEqual(clearedAt, null, 'study_queue_dispatched_under_pressure');
      assert.equal(started.has(task.id), false, 'study_queue_duplicate_dispatch');
      started.add(task.id); receipt.started = started.size;
      receipt.firstDispatchMs ??= now() - clearedAt;
    },
    async hold() {
      assert.equal(heldAt, null, 'study_queue_pressure_repeated');
      // Pressure is already active. Let operations admitted before the boundary settle.
      const deadline = now() + 5000;
      while (admission.classes.queue.active > 0 && now() < deadline) await wait(25);
      assert.equal(admission.classes.queue.active, 0, 'study_queue_inflight_did_not_settle');
      const items = (await db.query(`SELECT * FROM (
        SELECT i.*,row_number() OVER (PARTITION BY library_id ORDER BY id) AS study_rank
        FROM media_server_items i
      ) ranked ORDER BY study_rank,library_id LIMIT 20`)).rows;
      assert.equal(items.length, receipt.cohortSize, 'study_queue_cohort_missing');
      assert.equal(new Set(items.map(item => item.library_id)).size, 4, 'study_queue_library_coverage_missing');
      assert.deepEqual([...new Set(items.map(item => item.media_type))].sort(), ['movie', 'tv']);
      for (const item of items) {
        const payload = queue.queueRefillService.buildMetadataEnrichmentPayload(item);
        assert.ok(payload);
        ids.add(await queue.enqueue('metadata_enrichment', payload, { source: 'resource_study_pressure', priority: 10 }));
      }
      assert.equal(ids.size, receipt.cohortSize);
      heldAt = now();
    },
    async checkHeld() {
      assert.notEqual(heldAt, null, 'study_queue_pressure_missing');
      assert.equal(clearedAt, null);
      const cohort = await rows();
      assert.equal(cohort.length, receipt.cohortSize);
      assert.ok(cohort.every(row => row.status === 'pending' && row.attempts === 0), 'study_queue_not_preserved');
      receipt.holdChecks++;
    },
    clear() {
      assert.notEqual(heldAt, null, 'study_queue_pressure_missing');
      assert.equal(clearedAt, null);
      clearedAt = now(); receipt.heldMs = clearedAt - heldAt;
      assert.ok(receipt.heldMs >= 5000 && receipt.holdChecks >= 2, 'study_queue_hold_not_observed');
    },
    async checkRecovery() {
      if (clearedAt === null || receipt.completedMs !== null) return;
      assert.ok(receipt.firstDispatchMs !== null || now() - clearedAt <= 30000, 'study_queue_resume_deadline');
      const cohort = await rows();
      const elapsed = now() - clearedAt;
      assert.equal(cohort.length, receipt.cohortSize);
      // Queue attempts counts failures, not dispatches. Successful work stays at zero.
      assert.ok(cohort.every(row => row.status !== 'failed' && row.attempts === 0 &&
        (row.status !== 'completed' || row.result?.enriched === true)), 'study_queue_recovery_failed');
      receipt.completed = cohort.filter(row => row.status === 'completed').length;
      if (receipt.completed === receipt.cohortSize) receipt.completedMs = elapsed;
      assert.ok(elapsed <= 120000, 'study_queue_completion_deadline');
    },
  };
}
