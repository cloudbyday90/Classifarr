/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { buildInventoryDescriptionCorpusSql, prepareInventoryDescriptionCorpus } from './inventoryDescriptionCorpus.mjs';
import { SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS } from './sourceConflictAuthorityGuard.mjs';
import { readInventoryDescriptionVectorRows, decodeInventoryDescriptionVectorRows } from './inventoryDescriptionVectorCache.mjs';
import { collectInventoryCandidateMetadata } from './inventoryMetadataCandidates.mjs';

export const INVENTORY_METADATA_BENCHMARK_SQL = buildInventoryDescriptionCorpusSql({ includeCandidateMetadata: true });
const LIBRARIES_SQL = `SELECT id, name, media_type FROM libraries
  WHERE is_active=true AND media_type IN ('movie','tv') ORDER BY id LIMIT 65`;
const EVALUATION_LIBRARIES_SQL = `SELECT id, name, media_type, is_active FROM libraries
  WHERE is_active=true AND media_type IN ('movie','tv') ORDER BY id LIMIT 65`;

export function createDescriptionBenchmarkRepository({ withTransaction, includeEvaluationMetadata = false }) {
  return {
    async read(identity) {
      const source = await withTransaction(client => readDescriptionBenchmarkSnapshot(client, identity, includeEvaluationMetadata));
      return decodeDescriptionBenchmarkSnapshot(source, identity, includeEvaluationMetadata);
    },
  };
}

/** Shared capture boundary for ordinary and policy-replay readers. */
export async function readDescriptionBenchmarkSnapshot(client, identity, includeEvaluationMetadata = false) {
  await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await client.query("SET LOCAL statement_timeout = '15s'");
  await client.query("SET LOCAL lock_timeout = '1s'");
  await client.query("SET LOCAL idle_in_transaction_session_timeout = '20s'");
  await client.query("SET LOCAL transaction_timeout = '90s'");
  const { rows } = await client.query(includeEvaluationMetadata
    ? buildInventoryDescriptionCorpusSql({ includeCandidateMetadata: true, includeEvaluationMetadata: true })
    : INVENTORY_METADATA_BENCHMARK_SQL, [SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS]);
  const corpus = prepareInventoryDescriptionCorpus(rows);
  if (corpus.texts.size * identity.dimensions > 20_000_000) throw new Error('description_benchmark_vector_budget');
  const libraries = (await client.query(includeEvaluationMetadata ? EVALUATION_LIBRARIES_SQL : LIBRARIES_SQL)).rows;
  if (libraries.length > 64) throw new Error('description_benchmark_library_budget');
  const vectorRows = await readInventoryDescriptionVectorRows((sql, params) => client.query(sql, params), identity, [...corpus.texts.keys()]);
  if (vectorRows.length !== corpus.texts.size) throw new Error('description_benchmark_cache_incomplete');
  return { corpus, libraries, vectorRows, rows };
}

export function decodeDescriptionBenchmarkSnapshot({ corpus, libraries, vectorRows, rows }, identity, includeEvaluationMetadata = false) {
  return { corpus, libraries, vectors: decodeInventoryDescriptionVectorRows(vectorRows, identity),
    candidateMetadata: collectInventoryCandidateMetadata(rows), ...(includeEvaluationMetadata ? { evaluationRows: rows } : {}) };
}
