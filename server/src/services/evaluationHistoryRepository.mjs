/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { adjudicationDigest } from './cachedAdjudicationContract.mjs';
import { validEvaluationHistory } from './evaluationHistoryContract.mjs';
import { projectEvaluationHistory } from './evaluationHistorySummary.mjs';

export const PRUNE_EVALUATION_HISTORY_SQL = `DELETE FROM automatic_evaluation_history WHERE
  observed_at <= statement_timestamp() - INTERVAL '30 days' OR observed_at > statement_timestamp()
  OR last_observed_at > statement_timestamp()
  OR result_key IN (SELECT result_key FROM automatic_evaluation_history ORDER BY last_observed_at DESC,result_key DESC OFFSET 500)`;

/** Caller owns the same transaction/serialization as singleton publication. */
export async function appendEvaluationHistory(client, history, observedAt) {
  if (!validEvaluationHistory(history)) throw new Error('evaluation_history_invalid');
  await client.query(`INSERT INTO automatic_evaluation_history(result_key,observed_at,last_observed_at,result)
    SELECT $1,$2::timestamptz,$2::timestamptz,$3::jsonb WHERE $2::timestamptz<=statement_timestamp()
      AND $2::timestamptz>statement_timestamp()-INTERVAL '30 days' ON CONFLICT(result_key)
      DO UPDATE SET last_observed_at=GREATEST(automatic_evaluation_history.last_observed_at,EXCLUDED.last_observed_at)`,
  [adjudicationDigest([history.version, history.revision, history.sampled, history.eligible, history.offset,
    history.cases.map(row => [row.item, row.mediaType, row.paired, row.labeled, row.gain, row.regression,
      row.deferralReduced, row.deferralIncreased, ...(history.version !== 'evaluation_history.v1' ? [row.gaps] : []),
      ...(history.version === 'evaluation_history.v3' ? [row.pairKind] : [])])
      .sort(([a], [b]) => a.localeCompare(b))]), observedAt, JSON.stringify(history)]);
  await client.query(PRUNE_EVALUATION_HISTORY_SQL);
}

export async function readEvaluationHistory(database) {
  return database.withTransaction(async client => {
    await client.query('SET TRANSACTION READ ONLY');
    await client.query("SET LOCAL statement_timeout = '5s'");
    const { rows } = await client.query(`SELECT last_observed_at::text AS observed_at,result FROM automatic_evaluation_history
      WHERE observed_at>statement_timestamp()-INTERVAL '30 days' AND observed_at<=statement_timestamp()
        AND last_observed_at<=statement_timestamp()
      ORDER BY last_observed_at DESC,result_key DESC LIMIT 500`);
    return projectEvaluationHistory(rows);
  });
}
