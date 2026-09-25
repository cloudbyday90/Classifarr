/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { validateAdjudicationBudget } from './adjudicationBudgetContract.mjs';
import { READ_ADJUDICATION_BUDGET_SQL, RESET_ADJUDICATION_DAY_SQL, PRUNE_ADJUDICATION_PROGRESS_SQL,
  RESERVE_ADJUDICATION_SQL, PUBLISH_ADJUDICATION_PROGRESS_SQL } from './adjudicationBudgetSql.mjs';
import { readAdjudicationBatch, adjudicationDigest } from './cachedAdjudicationContract.mjs';

const requireWrite = result => { if (result.rowCount !== 1) throw new Error('adjudication_budget_changed'); };
export function createAdjudicationBudgetRepository(database) {
  const transaction = (callback, signal) => database.withTransaction(async client => {
    signal?.throwIfAborted();
    await client.query("SET LOCAL statement_timeout='15s'; SET LOCAL lock_timeout='1s'");
    // Schema snapshots contain structure only; fresh installations start disabled too.
    await client.query('INSERT INTO adjudication_capture_budget(singleton) VALUES(true) ON CONFLICT DO NOTHING');
    const value = await callback(client); signal?.throwIfAborted(); return value;
  });
  return {
    read: signal => transaction(async client => {
      await client.query(RESET_ADJUDICATION_DAY_SQL);
      await client.query(PRUNE_ADJUDICATION_PROGRESS_SQL);
      return (await client.query(READ_ADJUDICATION_BUDGET_SQL)).rows[0];
    }, signal),
    configure: options => {
      const { dailyCalls, dailyTokens } = validateAdjudicationBudget(options);
      return transaction(async client => {
        requireWrite(await client.query(`UPDATE adjudication_capture_budget SET daily_calls=$1,daily_tokens=$2,
          revision=revision+1,next_check_at=statement_timestamp(),status=CASE WHEN $1=0 THEN 'disabled' ELSE 'ready' END
          WHERE singleton=true`, [dailyCalls,dailyTokens]));
        return (await client.query(READ_ADJUDICATION_BUDGET_SQL)).rows[0];
      });
    },
    reserve: (revision, signal) => transaction(async client => {
      await client.query(RESET_ADJUDICATION_DAY_SQL);
      if ((await client.query(RESERVE_ADJUDICATION_SQL,[revision])).rowCount !== 1) throw new Error('adjudication_budget_exhausted');
    }, signal),
    finish: (revision, status, fingerprint = null, signal) => {
      if (!['captured','waiting_for_replay','budget_exhausted','deferred','unavailable'].includes(status) ||
          fingerprint !== null && !/^[a-f0-9]{64}$/.test(fingerprint)) throw new Error('adjudication_budget_status_invalid');
      return transaction(client => client.query(`UPDATE adjudication_capture_budget SET status=$2,
        next_check_at=statement_timestamp()+CASE WHEN $2='unavailable' THEN interval '60 minutes' ELSE interval '5 minutes' END,
        published_fingerprint=COALESCE($3,published_fingerprint) WHERE singleton=true AND revision=$1`,
      [revision,status,fingerprint]), signal);
    },
    advance: (revision, eligible, signal) => transaction(async client => {
      if (!Number.isInteger(eligible) || eligible < 0 || eligible > 300) throw new Error('adjudication_rotation_invalid');
      requireWrite(await client.query(`UPDATE adjudication_capture_budget SET
        selection_offset=CASE WHEN selection_offset+25 >= $2 THEN 0 ELSE selection_offset+25 END,
        published_fingerprint=NULL,progress_key=NULL,progress=NULL,captured_at=NULL,expires_at=NULL
        WHERE singleton=true AND revision=$1`, [revision,eligible]));
    }, signal),
    checkpoint(revision) {
      let key, batch, keys;
      return {
        async open(plan, template, signal) {
          key = adjudicationDigest({ configuration: template.configuration, identity: template.identity, requests: plan.map(row => row.key) });
          keys = new Set(plan.map(row => row.key));
          batch = await transaction(async client => {
            const { rows: [state] } = await client.query(`SELECT progress_key,
              CASE WHEN captured_at<=statement_timestamp() AND expires_at>statement_timestamp() THEN progress END AS progress
              FROM adjudication_capture_budget
              WHERE singleton=true AND revision=$1 AND daily_calls>0 FOR UPDATE`, [revision]);
            if (!state) throw new Error('adjudication_budget_changed');
            const retained = state.progress_key === key ? readAdjudicationBatch(state.progress,template.configuration) : null;
            if (retained && retained.records.every(row => keys.has(row.key)) &&
                adjudicationDigest(retained.identity) === adjudicationDigest(template.identity)) return retained;
            // Reuse an exact published batch without renewing its retention deadline.
            const { rows: [cached] } = await client.query(`SELECT batch,captured_at,expires_at FROM cached_adjudication_batch
              WHERE captured_at<=statement_timestamp() AND expires_at>statement_timestamp()`);
            const previous = readAdjudicationBatch(cached?.batch,template.configuration);
            const matching = previous && adjudicationDigest(previous.identity) === adjudicationDigest(template.identity)
              ? previous.records.filter(row => keys.has(row.key)) : [];
            const reuse = matching.length > 0;
            const next = { ...template, records: matching };
            requireWrite(await client.query(`UPDATE adjudication_capture_budget SET progress_key=$2,progress=$3::jsonb,
              captured_at=COALESCE($4::timestamptz,statement_timestamp()),expires_at=COALESCE($5::timestamptz,statement_timestamp()+interval '7 days'),
              published_fingerprint=NULL WHERE singleton=true AND revision=$1`,
            [revision,key,JSON.stringify(next),reuse ? cached.captured_at : null,reuse ? cached.expires_at : null]));
            return next;
          }, signal);
          return structuredClone(batch);
        },
        async record(record, signal) {
          if (!keys?.has(record.key)) throw new Error('adjudication_checkpoint_invalid');
          const records = batch.records.filter(row => row.key !== record.key); records.push(structuredClone(record));
          const next = { ...batch, records };
          if (!readAdjudicationBatch(next,next.configuration)) throw new Error('adjudication_checkpoint_invalid');
          await transaction(async client => requireWrite(await client.query(`UPDATE adjudication_capture_budget SET progress=$3::jsonb
            WHERE singleton=true AND revision=$1 AND daily_calls>0 AND progress_key=$2
              AND captured_at<=statement_timestamp() AND expires_at>statement_timestamp()`, [revision,key,JSON.stringify(next)])),signal);
          batch = next;
        },
        publish: (next = batch, signal) => transaction(async client => {
          if (!readAdjudicationBatch(next,batch.configuration) || adjudicationDigest(next.identity) !== adjudicationDigest(batch.identity) ||
              next.records.some(row => !batch.records.some(saved => adjudicationDigest(saved) === adjudicationDigest(row)))) {
            throw new Error('adjudication_checkpoint_invalid');
          }
          // Match publication order to the exact fingerprint used for replay/rotation.
          requireWrite(await client.query(`UPDATE adjudication_capture_budget SET progress=$3::jsonb
            WHERE singleton=true AND revision=$1 AND progress_key=$2 AND daily_calls>0
              AND captured_at<=statement_timestamp() AND expires_at>statement_timestamp()`,[revision,key,JSON.stringify(next)]));
          requireWrite(await client.query(PUBLISH_ADJUDICATION_PROGRESS_SQL,[revision,key]));
        },signal),
      };
    },
  };
}
