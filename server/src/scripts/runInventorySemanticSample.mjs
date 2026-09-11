/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { createInventorySemanticSampler, validateInventorySampleOptions } from '../services/inventorySemanticSampler.mjs';

async function loadPrivateRuntime() {
  process.env.LOG_LEVEL = 'fatal';
  process.env.FILE_LOGGING_ENABLED = 'false';
  process.env.PGOPTIONS = `${process.env.PGOPTIONS || ''} -c default_transaction_read_only=on`.trim();
  const db = await import('../config/database.mjs');
  try {
    return { sampler: createInventorySemanticSampler({ withTransaction: db.withTransaction }), close: () => db.pool.end() };
  } catch (error) {
    await db.pool.end();
    throw error;
  }
}

export async function runInventorySemanticSample({ argv = process.argv.slice(2), loadRuntime = loadPrivateRuntime } = {}) {
  const { values } = parseArgs({ args: argv, options: { seed: { type: 'string' }, size: { type: 'string' } } });
  const options = validateInventorySampleOptions({
    seed: values.seed, size: values.size === undefined ? 24 : Number(values.size),
  });
  const runtime = await loadRuntime();
  try {
    const { report } = await runtime.sampler.sample(options);
    return report;
  } finally {
    await runtime.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  runInventorySemanticSample().then(report => {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.status !== 'complete') process.exitCode = 1;
  }).catch(() => {
    process.stderr.write('Inventory semantic sample could not run; no routing or policy changes were made.\n');
    process.exitCode = 1;
  });
}
