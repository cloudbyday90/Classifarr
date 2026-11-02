/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { isFinalizationAttemptId } from './adjudicationFinalizationClaim.mjs';
import { createAdjudicationCheckpointRefusal } from './adjudicationCheckpointRefusal.mjs';
import { readAdjudicationBatch, adjudicationDigest } from './cachedAdjudicationContract.mjs';
import { LOCK_OWNED_ADJUDICATION_BUDGET_SQL, PUBLISH_ADJUDICATION_PROGRESS_SQL } from './adjudicationBudgetSql.mjs';
import { READ_OWNED_ADJUDICATION_PROGRESS_SQL, READ_REUSABLE_ADJUDICATION_BATCH_SQL,
  OPEN_ADJUDICATION_PROGRESS_SQL, RECORD_ADJUDICATION_PROGRESS_SQL } from './adjudicationCheckpointSql.mjs';

const requireWrite = result => {
  if (result?.rowCount === 0) throw new Error('adjudication_budget_changed');
  if (result?.rowCount !== 1) throw new Error('adjudication_checkpoint_result_invalid');
};

/** One automatic checkpoint; the caller supplies the existing bounded transaction wrapper. */
export function createAdjudicationCheckpoint(transaction, revision, attemptId) {
  if (!isFinalizationAttemptId(attemptId)) throw new Error('adjudication_claim_invalid');
  let key, batch, keys;
  async function lockOwner(client, signal) {
    const result = await client.query(LOCK_OWNED_ADJUDICATION_BUDGET_SQL, [revision, attemptId]);
    if (result?.rowCount === 0) throw createAdjudicationCheckpointRefusal();
    if (result?.rowCount !== 1) throw new Error('adjudication_checkpoint_result_invalid');
    signal?.throwIfAborted();
  }
  return {
    async open(plan, template, signal) {
      key = adjudicationDigest({ configuration: template.configuration, identity: template.identity, requests: plan.map(row => row.key) });
      keys = new Set(plan.map(row => row.key));
      batch = await transaction(async client => {
        await lockOwner(client, signal);
        const { rows: [state] } = await client.query(READ_OWNED_ADJUDICATION_PROGRESS_SQL, [revision, attemptId]);
        if (!state) throw new Error('adjudication_budget_changed');
        const retained = state.progress_key === key ? readAdjudicationBatch(state.progress, template.configuration) : null;
        if (retained && retained.records.every(row => keys.has(row.key)) &&
            adjudicationDigest(retained.identity) === adjudicationDigest(template.identity)) return retained;
        // Reuse an exact published batch without renewing its retention deadline.
        const { rows: [cached] } = await client.query(READ_REUSABLE_ADJUDICATION_BATCH_SQL);
        const previous = readAdjudicationBatch(cached?.batch, template.configuration);
        const matching = previous && adjudicationDigest(previous.identity) === adjudicationDigest(template.identity)
          ? previous.records.filter(row => keys.has(row.key)) : [];
        const reuse = matching.length > 0, next = { ...template, records: matching };
        requireWrite(await client.query(OPEN_ADJUDICATION_PROGRESS_SQL,
          [revision, key, JSON.stringify(next), reuse ? cached.captured_at : null, reuse ? cached.expires_at : null, attemptId]));
        return next;
      }, signal);
      return structuredClone(batch);
    },
    async record(record, signal) {
      if (!keys?.has(record.key)) throw new Error('adjudication_checkpoint_invalid');
      const records = batch.records.filter(row => row.key !== record.key); records.push(structuredClone(record));
      const next = { ...batch, records };
      if (!readAdjudicationBatch(next, next.configuration)) throw new Error('adjudication_checkpoint_invalid');
      await transaction(async client => {
        await lockOwner(client, signal);
        requireWrite(await client.query(RECORD_ADJUDICATION_PROGRESS_SQL, [revision, key, JSON.stringify(next), attemptId]));
      }, signal);
      batch = next;
    },
    publish: (next = batch, signal) => transaction(async client => {
      if (!readAdjudicationBatch(next, batch.configuration) || adjudicationDigest(next.identity) !== adjudicationDigest(batch.identity) ||
          next.records.some(row => !batch.records.some(saved => adjudicationDigest(saved) === adjudicationDigest(row)))) {
        throw new Error('adjudication_checkpoint_invalid');
      }
      await lockOwner(client, signal);
      // Progress and existing cache publication remain atomic, in the requested replay order.
      requireWrite(await client.query(RECORD_ADJUDICATION_PROGRESS_SQL, [revision, key, JSON.stringify(next), attemptId]));
      requireWrite(await client.query(PUBLISH_ADJUDICATION_PROGRESS_SQL, [revision, key, attemptId]));
    }, signal),
  };
}
