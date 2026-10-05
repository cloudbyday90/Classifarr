/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

// Limits are admission bounds, never silent clamps. Existing consumers retain
// precedence/defaults. Privileged maintenance uses a separate fixed environment.
const timerMax = 2_147_483_647;
export const SELECTED_TUNING_RULES = Object.freeze(Object.fromEntries(Object.entries({
  OMDB_SSL_RECOVERY_PROBE_MS: [1, timerMax],
  OLLAMA_CONNECTIVITY_TIMEOUT_MS: [1000, timerMax],
  OLLAMA_PROBE_TIMEOUT_MS: [1000, timerMax],
  OLLAMA_PREFLIGHT_RETRY_BASE_MS: [1000, timerMax],
  OLLAMA_PREFLIGHT_RETRY_MAX_MS: [1000, timerMax],
  OLLAMA_PREFLIGHT_WARN_DEDUPE_MS: [1000, timerMax],
  OLLAMA_PREFLIGHT_CACHE_MS: [0, timerMax],
  OLLAMA_PROBE_CONTEXT_LENGTH: [256, 131072],
  TASK_QUEUE_MAX_TOTAL_ROWS: [1, 10_000_000],
  TASK_QUEUE_RETENTION_DAYS: [0, 36500],
  TASK_QUEUE_FAILED_RETENTION_DAYS: [0, 36500],
  TASK_QUEUE_CANCELLED_RETENTION_DAYS: [0, 36500],
  API_AUDIT_RETENTION_DAYS: [0, 36500],
  // Normal admission pins one connection for its lifetime.
  POSTGRES_POOL_MAX: [2, 100],
  POSTGRES_CONN_TIMEOUT_MS: [1, 60000],
  POSTGRES_IDLE_TIMEOUT_MS: [1, 600000],
  POSTGRES_STATEMENT_TIMEOUT_MS: [1, 600000],
  POSTGRES_CONNECT_RETRIES: [0, 10],
  POSTGRES_CONNECT_RETRY_DELAY_MS: [0, 30000],
  POSTGRES_SLOW_QUERY_THRESHOLD_MS: [0, timerMax],
  PGVECTOR_EF_SEARCH: [40, 1000],
  PGVECTOR_EF_SEARCH_CANDIDATES: [40, 1000],
  PGVECTOR_CANDIDATE_LIMIT_MIN: [1, 500],
  PGVECTOR_CANDIDATE_LIMIT_MULTIPLIER: [1, 50],
  PGVECTOR_CANDIDATE_LIMIT: [25, 5000],
  PGVECTOR_HNSW_MAX_SCAN_TUPLES: [1000, 1_000_000, 'optional'],
  PGVECTOR_HNSW_SCAN_MEM_MULTIPLIER: [1, 100, 'optional-decimal'],
}).map(([key, rule]) => [key, Object.freeze(rule)])));

export function validSelectedTuning(key, value) {
  const rule = Object.hasOwn(SELECTED_TUNING_RULES, key) && SELECTED_TUNING_RULES[key];
  if (!rule || typeof value !== 'string' || value.length > 32) return false;
  const [min, max, kind] = rule;
  if (value === '') return kind === 'optional' || kind === 'optional-decimal';
  const parts = value.split('.');
  if (kind === 'optional-decimal') {
    if (parts.length > 2 || parts.some(part => !/^\d+$/.test(part))) return false;
  } else if (!/^(0|[1-9]\d*)$/.test(value)) return false;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max;
}

export function validSelectedTuningRelationships(input) {
  const retryBase = Number(input.OLLAMA_PREFLIGHT_RETRY_BASE_MS ?? 300000);
  const retryMax = Number(input.OLLAMA_PREFLIGHT_RETRY_MAX_MS ?? 3600000);
  const candidateMin = Number(input.PGVECTOR_CANDIDATE_LIMIT_MIN ?? 50);
  const candidateMax = Number(input.PGVECTOR_CANDIDATE_LIMIT ?? 200);
  return retryMax >= retryBase && candidateMax >= candidateMin;
}
