/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { createInventorySemanticSampler, validateInventorySampleOptions } from '../services/inventorySemanticSampler.mjs';
import { createLocalStudyEmbeddingClient } from '../services/localStudyEmbeddingClient.mjs';
import { createInventoryDescriptionComparison } from '../services/inventoryDescriptionComparison.mjs';

async function loadPrivateRuntime() {
  process.env.LOG_LEVEL = 'fatal';
  process.env.FILE_LOGGING_ENABLED = 'false';
  process.env.PGOPTIONS = `${process.env.PGOPTIONS || ''} -c default_transaction_read_only=on`.trim();
  const db = await import('../config/database.mjs');
  try {
    const { rows } = await db.query(`SELECT rag_enabled, embedding_provider_mode,
      primary_provider, embedding_model, embedding_ollama_host, embedding_ollama_port,
      embedding_ollama_model, ollama_host, ollama_port FROM ai_provider_config WHERE id = 1`);
    const embedder = createLocalStudyEmbeddingClient(rows[0]);
    const sampler = createInventorySemanticSampler({ withTransaction: db.withTransaction });
    return { comparison: createInventoryDescriptionComparison({ sampler, embedder }), close: () => db.pool.end() };
  } catch (error) {
    await db.pool.end();
    throw error;
  }
}

export async function runInventoryDescriptionComparison({ argv = process.argv.slice(2), loadRuntime = loadPrivateRuntime } = {}) {
  const { values } = parseArgs({ args: argv, options: { seed: { type: 'string' }, size: { type: 'string' } } });
  const options = validateInventorySampleOptions({ seed: values.seed, size: values.size === undefined ? 24 : Number(values.size) });
  const runtime = await loadRuntime();
  try { return await runtime.comparison.compare(options); }
  finally { await runtime.close(); }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  runInventoryDescriptionComparison().then(report => {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.status !== 'complete') process.exitCode = 1;
  }).catch(() => {
    process.stderr.write('Local description comparison could not complete; no routing or policy changes were made.\n');
    process.exitCode = 1;
  });
}
