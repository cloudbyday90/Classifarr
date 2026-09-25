/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { INVENTORY_DESCRIPTION_REFRESH_STATE_SQL } from './inventoryDescriptionRefreshRepository.mjs';
import { resolveLocalStudyEmbeddingConfig } from './localStudyEmbeddingClient.mjs';
import { readCurrentDescriptionRepresentation, descriptionConfigDigest } from './inventoryDescriptionRepresentationCheckpoint.mjs';
import { readSourceDescriptionEvaluationSnapshot, decodeSourceDescriptionEvaluationSnapshot } from './sourceDescriptionEvaluationRuntime.mjs';
import { readAutomaticSourcePairReport } from './automaticSourcePairReport.mjs';
import { validSourcePairCohort } from './automaticSourcePairCohort.mjs';
import { READ_SOURCE_PAIR_STATE_SQL, SAVE_SOURCE_PAIR_SQL, FAIL_SOURCE_PAIR_SQL, READ_SOURCE_PAIR_STATUS_SQL } from './automaticSourcePairSql.mjs';

export function createAutomaticSourcePairRepository(database) {
  const transaction = (callback, signal, readOnly = false) => database.withTransaction(async client => {
    signal?.throwIfAborted();
    if (readOnly) await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query("SET LOCAL statement_timeout = '15s'");
    await client.query("SET LOCAL lock_timeout = '1s'");
    await client.query("SET LOCAL transaction_timeout = '90s'");
    const value = await callback(client);
    signal?.throwIfAborted();
    return value;
  });
  return {
    readState: signal => transaction(async client => (await client.query(READ_SOURCE_PAIR_STATE_SQL)).rows[0] ?? null, signal, true),
    readSnapshot: signal => transaction(async client => {
      const state = (await client.query(INVENTORY_DESCRIPTION_REFRESH_STATE_SQL)).rows[0];
      if (state?.rag_enabled !== true) throw new Error('disabled');
      let configKey;
      try { configKey = JSON.stringify(resolveLocalStudyEmbeddingConfig(state)); }
      catch { throw new Error('unsupported_provider'); }
      if (state.busy !== false) throw new Error('busy');
      const identity = await readCurrentDescriptionRepresentation((...args) => client.query(...args), configKey);
      if (!identity) throw new Error('representation_unavailable');
      const captured = await readSourceDescriptionEvaluationSnapshot(client, identity, { configureTransaction: false });
      const { rows: [clock] } = await client.query('SELECT transaction_timestamp()::text AS observed_at');
      return { observedAt: clock.observed_at, captured, identity, configuration: descriptionConfigDigest(configKey) };
    }, signal, true).then(({ observedAt, captured, identity, configuration }) => {
      signal?.throwIfAborted();
      const { config: _config, ...source } = decodeSourceDescriptionEvaluationSnapshot(captured, identity);
      return { observedAt, inputs: { source, identity, configuration } };
    }),
    save: (fingerprint, report, observedAt, signal, { cohort, cohortCreatedAt } = {}) => {
      if (!readAutomaticSourcePairReport(report) || !validSourcePairCohort(cohort) || cohort.length !== report.sampled ||
        !Number.isFinite(Date.parse(cohortCreatedAt)) || Date.parse(cohortCreatedAt) > Date.parse(observedAt)) {
        throw new Error('automatic_source_pair_report_invalid');
      }
      return transaction(client => client.query(SAVE_SOURCE_PAIR_SQL,
        [fingerprint, JSON.stringify(report), observedAt, JSON.stringify(cohort), cohortCreatedAt]), signal).then(result => result.rowCount === 1);
    },
    fail: (code, signal) => transaction(client => client.query(FAIL_SOURCE_PAIR_SQL, [code]), signal),
  };
}

export async function readAutomaticSourcePairStatus(client) {
  const { rows } = await client.query(READ_SOURCE_PAIR_STATUS_SQL);
  const state = rows[0] ?? { status: 'never_run', report: null };
  if (state.status === 'complete' && !readAutomaticSourcePairReport(state.report)) { state.status = 'invalid'; state.report = null; }
  return { version: 'automatic_source_pair_status.v1', ...state, providerCalls: 0, routingWrites: 0, promotionAllowed: false };
}
