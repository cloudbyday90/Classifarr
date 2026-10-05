/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { migrationCommand } from './identityMigrationDatabase.mjs';

export const SELECTED_TUNING_FIXTURE = Object.freeze({
  NODE_OPTIONS: '--max-old-space-size=1536',
  TASK_QUEUE_RETENTION_DAYS: '0', TASK_QUEUE_FAILED_RETENTION_DAYS: '0', TASK_QUEUE_CANCELLED_RETENTION_DAYS: '0',
  TASK_QUEUE_MAX_TOTAL_ROWS: '250000', REFRESH_TOKEN_CLEANUP_ENABLED: 'false', API_AUDIT_RETENTION_DAYS: '120',
  OMDB_SSL_RECOVERY_PROBE_MS: '90000', OLLAMA_CONNECTIVITY_TIMEOUT_MS: '6000', OLLAMA_PROBE_TIMEOUT_MS: '150000',
  OLLAMA_PREFLIGHT_RETRY_BASE_MS: '400000', OLLAMA_PREFLIGHT_RETRY_MAX_MS: '4000000',
  OLLAMA_PREFLIGHT_WARN_DEDUPE_MS: '1900000', OLLAMA_PREFLIGHT_CACHE_MS: '0', OLLAMA_PROBE_CONTEXT_LENGTH: '2048',
  PGVECTOR_EF_SEARCH: '120', PGVECTOR_EF_SEARCH_CANDIDATES: '150', PGVECTOR_CANDIDATE_LIMIT_MIN: '60',
  PGVECTOR_CANDIDATE_LIMIT_MULTIPLIER: '12', PGVECTOR_CANDIDATE_LIMIT: '300', PGVECTOR_HNSW_ITERATIVE_SCAN: 'strict_order',
  PGVECTOR_HNSW_MAX_SCAN_TUPLES: '', PGVECTOR_HNSW_SCAN_MEM_MULTIPLIER: '1.5',
  POSTGRES_POOL_MAX: '4', POSTGRES_CONN_TIMEOUT_MS: '6000', POSTGRES_IDLE_TIMEOUT_MS: '45000',
  POSTGRES_STATEMENT_TIMEOUT_MS: '35000', POSTGRES_CONNECT_RETRIES: '1', POSTGRES_CONNECT_RETRY_DELAY_MS: '0',
  POSTGRES_SLOW_QUERY_THRESHOLD_MS: '750', POLICY_INTENT_REPLAY_TMDB_METADATA_LIVE_PREVIEW_ENABLED: 'false',
});

/** Guarded disposable network-none fixture only. Never output the process environment. */
export async function verifySelectedTuningProcess() {
  if (process.getuid?.() === 0) {
    // No SYS_PTRACE privilege: inspect only from the same application identity.
    await migrationCommand('classifarr', 'node', ['--input-type=module', '-e',
      "import { verifySelectedTuningProcess } from '/app/src/scripts/embeddedIsolationDrill/selectedTuningProbe.mjs'; await verifySelectedTuningProcess();"]);
    return;
  }
  assert.equal(process.getuid?.(), 1000, 'fixture_application_user_required');
  const pids = (await readdir('/proc')).filter(name => /^[1-9]\d*$/.test(name));
  assert(pids.length <= 256, 'fixture_process_budget_exceeded');
  const matches = [];
  for (const pid of pids) {
    let args;
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Numeric PID from this disposable container's procfs, fixed leaf, read-only.
    try { args = (await readFile(`/proc/${pid}/cmdline`, 'utf8')).split('\0'); }
    catch (error) { if (error.code === 'ENOENT' || error.code === 'ESRCH') continue; throw error; }
    if (args[1] === '/app/src/scripts/runSelectedApplication.mjs' && args[2] === '--run') matches.push(pid);
  }
  assert.equal(matches.length, 1, 'fixture_application_identity_ambiguous');
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Exact uniquely matched synthetic application PID, no caller path, never logged.
  const raw = await readFile(`/proc/${matches[0]}/environ`, 'utf8');
  assert(raw.length < 65536, 'fixture_environment_budget_exceeded');
  const environment = Object.fromEntries(raw.split('\0').filter(Boolean).map(entry => {
    const separator = entry.indexOf('=');
    return [entry.slice(0, separator), entry.slice(separator + 1)];
  }));
  for (const [key, value] of Object.entries(SELECTED_TUNING_FIXTURE)) {
    assert(environment[key] === value, 'fixture_operator_tuning_changed');
  }
  assert(environment.POSTGRES_USER === 'cf_runtime', 'fixture_database_authority_changed');
}
