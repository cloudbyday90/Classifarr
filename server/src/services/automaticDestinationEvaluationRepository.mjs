/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readDestinationOutcomeInputs } from './destinationOutcomeEvaluationRepository.mjs';
import { readAutomaticDestinationEvaluationReport } from './automaticDestinationEvaluationReport.mjs';
import { READ_AUTOMATIC_EVALUATION_STATE_SQL, SAVE_AUTOMATIC_EVALUATION_SQL,
  FAIL_AUTOMATIC_EVALUATION_SQL, READ_AUTOMATIC_EVALUATION_STATUS_SQL } from './automaticDestinationEvaluationSql.mjs';

export function createAutomaticDestinationEvaluationRepository(database) {
  const transaction = (callback, { readOnly = false, signal } = {}) => database.withTransaction(async client => {
    signal?.throwIfAborted();
    if (readOnly) await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
    await client.query("SET LOCAL statement_timeout = '15s'");
    await client.query("SET LOCAL lock_timeout = '1s'");
    await client.query("SET LOCAL transaction_timeout = '45s'");
    const result = await callback(client);
    signal?.throwIfAborted();
    return result;
  });
  return {
    readState: signal => transaction(async client => (await client.query(READ_AUTOMATIC_EVALUATION_STATE_SQL)).rows[0] ?? null,
      { readOnly: true, signal }),
    readSnapshot: signal => transaction(async client => {
      const { rows: [clock] } = await client.query('SELECT transaction_timestamp()::text AS observed_at');
      return { observedAt: clock.observed_at, inputs: await readDestinationOutcomeInputs(client) };
    }, { readOnly: true, signal }),
    save: (fingerprint, report, observedAt, signal) => {
      if (!readAutomaticDestinationEvaluationReport(report)) throw new Error('automatic_evaluation_invalid_report');
      return transaction(client => client.query(SAVE_AUTOMATIC_EVALUATION_SQL,
        [fingerprint, JSON.stringify(report), observedAt]), { signal }).then(result => result.rowCount === 1);
    },
    fail: (code, signal) => transaction(client => client.query(FAIL_AUTOMATIC_EVALUATION_SQL, [code]), { signal }),
  };
}

export async function readAutomaticDestinationEvaluationStatus(client) {
  const { rows } = await client.query(READ_AUTOMATIC_EVALUATION_STATUS_SQL);
  const state = rows[0] ?? { status: 'never_run', report: null };
  if (state.status === 'complete' && !readAutomaticDestinationEvaluationReport(state.report)) {
    state.status = 'invalid'; state.report = null;
  }
  return { version: 'automatic_destination_evaluation.v1', ...state,
    promotionAllowed: false, routingWrites: 0, providerCalls: 0 };
}
