/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildInventoryDescriptionCorpusSql } from '../services/inventoryDescriptionCorpus.mjs';
import { SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS } from '../services/sourceConflictAuthorityGuard.mjs';
import { INVENTORY_OUTCOME_LABEL_SQL } from '../services/inventoryOutcomeLabels.mjs';
import { benchmarkInventoryOutcomeCalibration } from '../services/inventoryOutcomeCalibration.mjs';
import { validateDescriptionBenchmarkOptions } from '../services/inventoryDescriptionBenchmarkSelection.mjs';

async function loadRuntime() {
  process.env.LOG_LEVEL = 'fatal';
  process.env.FILE_LOGGING_ENABLED = 'false';
  const db = await import('../config/database.mjs');
  return { withTransaction: db.withTransaction, close: () => db.pool.end() };
}

/** Read-only aggregate CLI; no provider, embedding, training writes, or routing calls. */
export async function runInventoryOutcomeCalibration({ argv = process.argv.slice(2), load = loadRuntime } = {}) {
  const { values } = parseArgs({ args: argv, options: { seed: { type: 'string' }, size: { type: 'string' }, folds: { type: 'string' } } });
  const options = validateDescriptionBenchmarkOptions({ seed: values.seed, size: Number(values.size ?? 300), folds: Number(values.folds ?? 3) });
  if (!options.folds) throw new Error('inventory_outcome_requires_grouped_zero_generation');
  const runtime = await load();
  try {
    const snapshot = await runtime.withTransaction(async client => {
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      await client.query("SET LOCAL statement_timeout = '15s'");
      await client.query("SET LOCAL lock_timeout = '1s'");
      await client.query("SET LOCAL idle_in_transaction_session_timeout = '20s'");
      const { rows } = await client.query(buildInventoryDescriptionCorpusSql({ includeCandidateMetadata: true, includeCompanyMetadata: true }),
        [SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS]);
      const { rows: libraries } = await client.query("SELECT id, media_type FROM libraries WHERE is_active=true AND media_type IN ('movie','tv') ORDER BY id LIMIT 65");
      const { rows: feedbackRows } = await client.query(INVENTORY_OUTCOME_LABEL_SQL);
      return { rows, libraries, feedbackRows };
    });
    return benchmarkInventoryOutcomeCalibration(snapshot, options);
  } finally { await runtime.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runInventoryOutcomeCalibration().then(result => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch(() => { process.stderr.write('inventory_outcome_calibration_failed\n'); process.exitCode = 1; });
}
