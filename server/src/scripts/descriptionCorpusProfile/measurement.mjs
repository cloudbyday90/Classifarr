/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { INVENTORY_DESCRIPTION_REFRESH_CORPUS_SQL } from '../../services/inventoryDescriptionRefreshRepository.mjs';
import { prepareInventoryDescriptionCorpus } from '../../services/inventoryDescriptionCorpus.mjs';
import { SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS } from '../../services/sourceConflictAuthorityGuard.mjs';
import { memorySnapshot, summarizeCorpusPlan } from './observation.mjs';

export const corpusQuerySha256 = createHash('sha256').update(INVENTORY_DESCRIPTION_REFRESH_CORPUS_SQL).digest('hex');
const parameters = [SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS];

export async function beginCorpusRead(db) {
  await db.query('BEGIN READ ONLY');
  try {
    await db.query(`SET LOCAL search_path=description_corpus_profile,pg_catalog;
      SET LOCAL statement_timeout='15s'; SET LOCAL lock_timeout='2s';
      SET LOCAL idle_in_transaction_session_timeout='30s'; SET LOCAL transaction_timeout='30s'`);
  } catch (error) { await db.query('ROLLBACK'); throw error; }
}

export async function measureCorpusRead(db, expectedRows, mode = 'select') {
  if (!['select', 'plan', 'serialize'].includes(mode)) throw new Error('corpus_profile_mode_invalid');
  await beginCorpusRead(db);
  try {
    const before = memorySnapshot(), cpu = process.cpuUsage(), start = performance.now();
    const prefix = mode === 'select' ? '' : mode === 'plan'
      ? 'EXPLAIN (ANALYZE, BUFFERS, TIMING OFF, FORMAT JSON) '
      : 'EXPLAIN (ANALYZE, BUFFERS, SERIALIZE TEXT, TIMING ON, FORMAT JSON) ';
    const { rows } = await db.query(prefix + INVENTORY_DESCRIPTION_REFRESH_CORPUS_SQL, parameters);
    const queryMs = performance.now() - start;
    if (mode !== 'select') {
      const plan = summarizeCorpusPlan(rows[0]?.['QUERY PLAN']?.[0]);
      if (plan.actualRows !== expectedRows) throw new Error('corpus_profile_plan_rows_mismatch');
      return { mode, queryMs, plan };
    }
    const preparationStart = performance.now();
    const corpus = prepareInventoryDescriptionCorpus(rows, { includeSourceItems: true });
    const preparationMs = performance.now() - preparationStart;
    if (rows.length !== expectedRows || corpus.documents.length !== expectedRows || corpus.texts.size !== expectedRows) {
      throw new Error('corpus_profile_result_mismatch');
    }
    const usage = process.cpuUsage(cpu), after = memorySnapshot();
    const fingerprint = createHash('sha256').update(JSON.stringify(corpus.documents)).digest('hex');
    return { mode, queryMs, preparationMs, rows: rows.length, fingerprint,
      processCpuMicros: { user: usage.user, system: usage.system }, before, after };
  } finally { await db.query('ROLLBACK'); }
}
