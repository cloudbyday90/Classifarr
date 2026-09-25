/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { INVENTORY_DESCRIPTION_REFRESH_STATE_SQL } from './inventoryDescriptionRefreshRepository.mjs';
import { resolveLocalStudyEmbeddingConfig } from './localStudyEmbeddingClient.mjs';
import { readCurrentDescriptionRepresentation, descriptionConfigDigest } from './inventoryDescriptionRepresentationCheckpoint.mjs';
import { readSourceDescriptionEvaluationSnapshot, decodeSourceDescriptionEvaluationSnapshot } from './sourceDescriptionEvaluationRuntime.mjs';
import { readAutomaticSourcePairReport } from './automaticSourcePairReport.mjs';
import { validSourcePairCohort } from './automaticSourcePairCohort.mjs';
import { projectAdjudicationConfig, readCachedAdjudication, PRUNE_ADJUDICATION_SQL } from './cachedAdjudicationRepository.mjs';
import { READ_SOURCE_PAIR_STATE_SQL, SAVE_SOURCE_PAIR_SQL, FAIL_SOURCE_PAIR_SQL, READ_SOURCE_PAIR_STATUS_SQL } from './automaticSourcePairSql.mjs';
import { appendEvaluationHistory, PRUNE_EVALUATION_HISTORY_SQL } from './evaluationHistoryRepository.mjs';
import { validEvaluationHistory } from './evaluationHistoryContract.mjs';
import { advanceEvaluatedSourcePairWindow } from './sourcePairWindowProgressionRepository.mjs';

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
    readState: signal => transaction(async client => {
      await client.query(PRUNE_ADJUDICATION_SQL);
      await client.query(PRUNE_EVALUATION_HISTORY_SQL);
      return (await client.query(READ_SOURCE_PAIR_STATE_SQL)).rows[0] ?? null;
    }, signal),
    readSnapshot: signal => transaction(async client => {
      const state = (await client.query(INVENTORY_DESCRIPTION_REFRESH_STATE_SQL)).rows[0];
      if (state?.rag_enabled !== true) throw new Error('disabled');
      let configKey;
      try { configKey = JSON.stringify(resolveLocalStudyEmbeddingConfig(state)); }
      catch { throw new Error('unsupported_provider'); }
      if (state.busy !== false) throw new Error('busy');
      const identity = await readCurrentDescriptionRepresentation((...args) => client.query(...args), configKey);
      if (!identity) throw new Error('representation_unavailable');
      const captured = await readSourceDescriptionEvaluationSnapshot(client, identity, { configureTransaction: false, includePolicyReplay: true });
      const adjudicationConfig = projectAdjudicationConfig(captured.config);
      const adjudicationBatch = await readCachedAdjudication(client, adjudicationConfig?.fingerprint);
      const { rows: [budget] } = await client.query('SELECT revision,selection_offset FROM adjudication_capture_budget WHERE singleton=true');
      const { rows: [clock] } = await client.query('SELECT transaction_timestamp()::text AS observed_at');
      return { observedAt: clock.observed_at, captured, identity, configuration: descriptionConfigDigest(configKey), adjudicationConfig, adjudicationBatch,
        adjudicationSelectionOffset: budget?.selection_offset ?? 0, adjudicationBudgetRevision: budget?.revision ?? 0 };
    }, signal, true).then(({ observedAt, captured, identity, configuration, adjudicationConfig, adjudicationBatch, adjudicationSelectionOffset, adjudicationBudgetRevision }) => {
      signal?.throwIfAborted();
      const { config: _config, ...source } = decodeSourceDescriptionEvaluationSnapshot(captured, identity);
      return { observedAt, adjudicationBudgetRevision,
        inputs: { source: { ...source, adjudicationConfig, adjudicationBatch, adjudicationSelectionOffset }, identity, configuration } };
    }),
    save: (fingerprint, report, observedAt, signal, { cohort, cohortCreatedAt, history, replayWindow } = {}) => {
      if (!readAutomaticSourcePairReport(report) || !validSourcePairCohort(cohort) || cohort.length !== report.sampled ||
        !Number.isFinite(Date.parse(cohortCreatedAt)) || Date.parse(cohortCreatedAt) > Date.parse(observedAt) ||
        (history !== undefined && !validEvaluationHistory(history, report))) {
        throw new Error('automatic_source_pair_report_invalid');
      }
      return transaction(async client => {
        const saved = await client.query(SAVE_SOURCE_PAIR_SQL,
          [fingerprint, JSON.stringify(report), observedAt, JSON.stringify(cohort), cohortCreatedAt]);
        if (saved.rowCount === 1 && history) await appendEvaluationHistory(client, history, observedAt);
        if (saved.rowCount === 1 && replayWindow) await advanceEvaluatedSourcePairWindow(client, fingerprint, report, replayWindow);
        return saved.rowCount === 1;
      }, signal);
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
