/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const TABLES = new Set(['enrichment_retry_queue', 'enrichment_retry_cooldowns', 'media_server_items',
  'media_source_observations', 'libraries', 'omdb_config', 'tavily_config', 'web_search_provider_config']);
const VIEWS = new Set(['enrichment_provider_credential_status', 'enrichment_retry_provider_contexts']);
const NAMESPACE = 'retry_query_benchmark';

/** Read only the checked-in snapshot. Never accept arbitrary DDL, paths or identifiers. */
export async function installRetryBenchmarkSchema(db) {
  const { rows: [target] } = await db.query('SELECT current_database() AS name');
  if (target?.name !== 'scan_recovery_benchmark' && !/^classifarr_suite_[a-f0-9]{12}$/.test(target?.name ?? '')) {
    throw new Error('Retry benchmark requires a disposable database');
  }
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Fixed repository snapshot URL; no caller-controlled path.
  const snapshot = (await readFile(new URL('../../../../database/schema/current.sql', import.meta.url), 'utf8')).replaceAll('\r\n', '\n');
  const tables = [...snapshot.matchAll(/^CREATE TABLE public\.(\w+) \([\s\S]*?^\);/gm)]
    .filter(match => TABLES.has(match[1]));
  const views = [...snapshot.matchAll(/^CREATE VIEW public\.(\w+) AS\n[\s\S]*?;\r?$/gm)]
    .filter(match => VIEWS.has(match[1]));
  if (tables.length !== TABLES.size || views.length !== VIEWS.size) throw new Error('Retry benchmark snapshot shape changed');
  const indexes = [...snapshot.matchAll(/^CREATE (?:UNIQUE )?INDEX \w+ ON public\.(\w+) [^\n]+;/gm)]
    .filter(match => TABLES.has(match[1]));
  const keys = [...snapshot.matchAll(/^ALTER TABLE ONLY public\.(\w+)\r?\n\s+ADD CONSTRAINT \w+ (?:PRIMARY KEY|UNIQUE) [^\n]+;/gm)]
    .filter(match => TABLES.has(match[1]));
  // This namespace must be new. No IF NOT EXISTS, source connections, triggers or application startup.
  await db.query(`CREATE SCHEMA ${NAMESPACE}; SET LOCAL search_path=${NAMESPACE},pg_catalog`);
  for (const match of [...tables, ...keys, ...indexes, ...views]) {
    await db.query(match[0].replaceAll('public.', `${NAMESPACE}.`));
  }
  return { snapshotSha256: createHash('sha256').update(snapshot.replaceAll('\r\n', '\n')).digest('hex'),
    tableCount: tables.length, viewCount: views.length, indexCount: indexes.length + keys.length };
}

export async function requireRetryBenchmarkSchema(db) {
  const { rows: [scope] } = await db.query(`SELECT current_schema() AS name,
    to_regclass('retry_query_benchmark.enrichment_retry_queue') IS NOT NULL AS installed`);
  if (scope?.name !== NAMESPACE || scope?.installed !== true) throw new Error('Retry benchmark fixture is not installed');
}

export async function installRetryBenchmarkCandidateIndex(db) {
  await requireRetryBenchmarkSchema(db);
  await db.query(`CREATE INDEX retry_benchmark_pending_order ON retry_query_benchmark.enrichment_retry_queue
    (enrichment_type,priority,created_at,id) WHERE status='pending'`);
  return Number((await db.query("SELECT pg_relation_size('retry_query_benchmark.retry_benchmark_pending_order') AS bytes")).rows[0].bytes);
}
