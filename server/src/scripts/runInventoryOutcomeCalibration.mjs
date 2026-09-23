/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildInventoryDescriptionCorpusSql } from '../services/inventoryDescriptionCorpus.mjs';
import { SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS } from '../services/sourceConflictAuthorityGuard.mjs';
import { INVENTORY_OUTCOME_LABEL_SQL } from '../services/inventoryOutcomeLabels.mjs';
import { benchmarkInventoryOutcomeCalibration } from '../services/inventoryOutcomeCalibration.mjs';
import { validateDescriptionBenchmarkOptions } from '../services/inventoryDescriptionBenchmarkSelection.mjs';
import { INVENTORY_PROSPECTIVE_OUTCOME_SQL } from '../services/inventoryProspectiveOutcomeRepository.mjs';
import { evaluateInventoryProspectiveOutcomes } from '../services/inventoryProspectiveOutcomes.mjs';

async function loadRuntime() {
  process.env.LOG_LEVEL = 'fatal';
  process.env.FILE_LOGGING_ENABLED = 'false';
  const db = await import('../config/database.mjs');
  return { withTransaction: db.withTransaction, close: () => db.pool.end() };
}

/** Read-only aggregate CLI; no provider, embedding, training writes, or routing calls. */
export async function runInventoryOutcomeCalibration({ argv = process.argv.slice(2), load = loadRuntime } = {}) {
  const { values } = parseArgs({ args: argv, options: { seed: { type: 'string' }, size: { type: 'string' }, folds: { type: 'string' },
    prospective: { type: 'boolean' }, since: { type: 'string' }, until: { type: 'string' } } });
  if (values.prospective && [values.seed, values.size, values.folds].some(value => value !== undefined) ||
      !values.prospective && [values.since, values.until].some(value => value !== undefined)) throw new Error('inventory_outcome_mode_options');
  const now = Date.now();
  const until = values.until === undefined ? now : Date.parse(values.until);
  const since = values.since === undefined ? until - 30 * 86400000 : Date.parse(values.since);
  if (!Number.isFinite(since) || !Number.isFinite(until) || since >= until || until > now) throw new Error('inventory_outcome_window');
  const options = values.prospective ? null : validateDescriptionBenchmarkOptions({ seed: values.seed,
    size: Number(values.size ?? 300), folds: Number(values.folds ?? 3) });
  if (options && !options.folds) throw new Error('inventory_outcome_requires_grouped_zero_generation');
  const runtime = await load();
  try {
    const snapshot = await runtime.withTransaction(async client => {
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      await client.query("SET LOCAL statement_timeout = '15s'");
      await client.query("SET LOCAL lock_timeout = '1s'");
      await client.query("SET LOCAL idle_in_transaction_session_timeout = '20s'");
      if (values.prospective) return (await client.query(INVENTORY_PROSPECTIVE_OUTCOME_SQL,
        [new Date(since).toISOString(), new Date(until).toISOString()])).rows;
      const { rows } = await client.query(buildInventoryDescriptionCorpusSql({ includeCandidateMetadata: true, includeCompanyMetadata: true }),
        [SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS]);
      const { rows: libraries } = await client.query("SELECT id, media_type FROM libraries WHERE is_active=true AND media_type IN ('movie','tv') ORDER BY id LIMIT 65");
      const { rows: feedbackRows } = await client.query(INVENTORY_OUTCOME_LABEL_SQL);
      return { rows, libraries, feedbackRows };
    });
    return values.prospective ? { ...evaluateInventoryProspectiveOutcomes(snapshot, { now }),
      window: { since: new Date(since).toISOString(), until: new Date(until).toISOString(), outcomesAsOf: new Date(now).toISOString() } }
      : benchmarkInventoryOutcomeCalibration(snapshot, options);
  } finally { await runtime.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runInventoryOutcomeCalibration().then(result => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch(() => { process.stderr.write('inventory_outcome_calibration_failed\n'); process.exitCode = 1; });
}
