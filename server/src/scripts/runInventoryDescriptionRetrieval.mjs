/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { validateInventorySampleOptions } from '../services/inventorySemanticSampler.mjs';
import { createInventoryDescriptionSnapshot } from '../services/inventoryDescriptionCorpus.mjs';
import { createLocalStudyEmbeddingClient } from '../services/localStudyEmbeddingClient.mjs';
import { createInventoryDescriptionVectorCache } from '../services/inventoryDescriptionVectorCache.mjs';
import { createInventoryDescriptionRetrieval, runExclusiveInventoryDescriptionRetrieval, validateDescriptionRetrievalBudget } from '../services/inventoryDescriptionRetrieval.mjs';

async function loadPrivateRuntime() {
  process.env.LOG_LEVEL = 'fatal';
  process.env.FILE_LOGGING_ENABLED = 'false';
  // Snapshot reads are read-only; only the isolated cache repository can write.
  process.env.PGOPTIONS = `${process.env.PGOPTIONS || ''} -c statement_timeout=15000 -c lock_timeout=2000`.trim();
  const db = await import('../config/database.mjs');
  try {
    const { rows } = await db.query(`SELECT rag_enabled, embedding_provider_mode,
      primary_provider, embedding_model, embedding_ollama_host, embedding_ollama_port,
      embedding_ollama_model, ollama_host, ollama_port FROM ai_provider_config WHERE id=1`);
    const embedder = createLocalStudyEmbeddingClient(rows[0]);
    const sampler = createInventoryDescriptionSnapshot({ withTransaction: db.withTransaction });
    const cache = createInventoryDescriptionVectorCache({ query: db.query });
    const retrieval = createInventoryDescriptionRetrieval({ sampler, cache, embedder });
    return { retrieval: { run: (options, settings) => runExclusiveInventoryDescriptionRetrieval(
      { withSessionAdvisoryLock: db.withSessionAdvisoryLock, retrieval }, options, settings) }, close: () => db.pool.end() };
  } catch (error) { await db.pool.end(); throw error; }
}

export async function runInventoryDescriptionRetrieval({ argv = process.argv.slice(2), loadRuntime = loadPrivateRuntime, onProgress } = {}) {
  const { values } = parseArgs({ args: argv, options: {
    seed: { type: 'string' }, size: { type: 'string' }, 'max-new-descriptions': { type: 'string' },
  } });
  const options = validateInventorySampleOptions({ seed: values.seed, size: values.size === undefined ? 24 : Number(values.size) });
  const maxNewDescriptions = validateDescriptionRetrievalBudget(values['max-new-descriptions'] === undefined ? 512 : Number(values['max-new-descriptions']));
  const runtime = await loadRuntime();
  try { return await runtime.retrieval.run(options, { maxNewDescriptions, onProgress }); }
  finally { await runtime.close(); }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  let previousReport = 0;
  runInventoryDescriptionRetrieval({ onProgress: progress => {
    if (Date.now() - previousReport >= 30_000) {
      process.stderr.write(`${JSON.stringify({ status: 'indexing', ...progress })}\n`);
      previousReport = Date.now();
    }
  } }).then(report => {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.status !== 'complete') process.exitCode = 1;
  }).catch(() => {
    process.stderr.write('Description retrieval did not complete. Verified shadow cache batches may be retained; live routing is unchanged.\n');
    process.exitCode = 1;
  });
}
