/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildInventoryDescriptionCorpusSql } from '../services/inventoryDescriptionCorpus.mjs';
import { SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS } from '../services/sourceConflictAuthorityGuard.mjs';
import { benchmarkInventoryCompanyProfiles } from '../services/inventoryCompanyBenchmark.mjs';
import { validateDescriptionBenchmarkOptions } from '../services/inventoryDescriptionBenchmarkSelection.mjs';

async function loadRuntime() {
  process.env.LOG_LEVEL = 'fatal';
  process.env.FILE_LOGGING_ENABLED = 'false';
  const db = await import('../config/database.mjs');
  return { withTransaction: db.withTransaction, close: () => db.pool.end() };
}

/** Usage: node src/scripts/runInventoryCompanyBenchmark.mjs --seed <16+ chars> --size 300 --folds 3. */
export async function runInventoryCompanyBenchmark({ argv = process.argv.slice(2), load = loadRuntime } = {}) {
  const { values } = parseArgs({ args: argv, options: { seed: { type: 'string' }, size: { type: 'string' }, folds: { type: 'string' } } });
  const options = validateDescriptionBenchmarkOptions({ seed: values.seed, size: Number(values.size ?? 300), folds: Number(values.folds ?? 3) });
  if (!options.folds) throw new Error('company_benchmark_requires_grouped_zero_generation');
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
      return { rows, libraries };
    });
    return benchmarkInventoryCompanyProfiles(snapshot, options);
  } finally { await runtime.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runInventoryCompanyBenchmark().then(result => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch(() => { process.stderr.write('company_benchmark_failed\n'); process.exitCode = 1; });
}
