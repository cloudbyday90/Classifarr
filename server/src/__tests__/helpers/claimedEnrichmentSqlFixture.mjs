/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { processMetadataEnrichmentTask } from '../../services/queueTaskProcessorEnrichment.mjs';

/** Savepoints keep existing connection-local SQL fixtures inside their outer rollback. */
export function enrichmentFixtureDatabase(client) {
  return {
    query: (...args) => client.query(...args),
    withTransaction: async work => {
      await client.query('SAVEPOINT enrichment_write');
      try {
        const result = await work(client);
        await client.query('RELEASE SAVEPOINT enrichment_write');
        return result;
      } catch (error) {
        await client.query('ROLLBACK TO SAVEPOINT enrichment_write');
        await client.query('RELEASE SAVEPOINT enrichment_write');
        throw error;
      }
    },
  };
}

export async function createEnrichmentQueueFixture(client) {
  await client.query(`CREATE TEMP TABLE task_queue (
    id serial PRIMARY KEY, task_type text, status text, payload jsonb,
    claim_token uuid, visible_at timestamptz, completed_at timestamptz, attempts integer DEFAULT 0
  ) ON COMMIT DROP`);
}

/** Real claim and real completion SQL; the old callback is only an outcome observer. */
export async function runClaimedEnrichmentFixture(task, deps) {
  const claimed = (await deps.db.query(`INSERT INTO task_queue
    (task_type, status, payload, claim_token, visible_at)
    VALUES ('metadata_enrichment', 'processing', $1, $2, clock_timestamp() + interval '5 minutes') RETURNING *`,
  [JSON.stringify(task.payload), task.claim_token || randomUUID()])).rows[0];
  await processMetadataEnrichmentTask(claimed, deps);
  const stored = (await deps.db.query('SELECT status, payload FROM task_queue WHERE id=$1', [claimed.id])).rows[0];
  assert.equal(stored.status, 'completed');
  await deps.completeTask?.(task.id, stored.payload.result, task.claim_token);
  return stored.payload.result;
}
