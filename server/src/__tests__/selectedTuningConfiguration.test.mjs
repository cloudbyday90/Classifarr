/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFile } from 'node:fs/promises';
import { selectedApplicationConfiguration, isSelectedApplicationSetting } from '../bootstrap/selectedApplicationConfiguration.mjs';
import { SELECTED_TUNING_RULES } from '../bootstrap/selectedTuningConfiguration.mjs';
import { selectedApplicationEnvironment, assertSelectedApplicationBoundary } from '../bootstrap/embeddedSelectedApplication.mjs';
import { selectedMaintenanceEnvironment } from '../bootstrap/embeddedSelectedMaintenanceContract.mjs';
import { resolvePgvectorRecallTuning } from '../services/pgvectorRecallTuning.mjs';
import { getScheduledPreflightRetryDelayMs, parseCacheMs } from '../services/ollamaPreflightUtils.mjs';
import { getTaskQueueRetentionPolicy } from '../services/queueMaintenanceQueries.mjs';

const base = { OLLAMA_PREFLIGHT_RETRY_BASE_MS: '1000', OLLAMA_PREFLIGHT_RETRY_MAX_MS: '2147483647',
  PGVECTOR_CANDIDATE_LIMIT_MIN: '1', PGVECTOR_CANDIDATE_LIMIT: '5000' };
const accounts = { users: [{ name: 'classifarr', uid: 1000, gid: 1000 }, { name: 'postgres', uid: 70, gid: 70 }] };
const context = { uid: 1000, gid: 1000, platform: 'linux', cwd: '/app', args: ['--run'] };
const originalEnvironment = process.env;
afterEach(() => { process.env = originalEnvironment; });

test.each(Object.entries(SELECTED_TUNING_RULES))('preserves both reviewed bounds for %s through the child boundary', (key, [min, max]) => {
  for (const value of [String(min), String(max)]) {
    const input = Object.freeze({ ...base, [key]: value });
    const environment = selectedApplicationEnvironment(input);
    expect(environment[key]).toBe(value);
    expect(() => assertSelectedApplicationBoundary(environment, context, accounts)).not.toThrow();
    expect(environment.POSTGRES_USER).toBe('cf_runtime');
    expect(selectedMaintenanceEnvironment().POSTGRES_POOL_MAX).toBe('1');
    expect(input[key]).toBe(value);
  }
});

test.each(Object.entries(SELECTED_TUNING_RULES))('rejects malformed/out-of-range %s without echoing input', (key, [min, max, kind]) => {
  const invalid = [String(min - 1), String(max + 1), 'Infinity', 'NaN', '1e3', '10ms', ' 1000', '+1000', '1000\n'];
  if (!kind) invalid.push('');
  for (const value of invalid) expect(() => selectedApplicationConfiguration({ ...base, [key]: value }))
    .toThrow('selected_application_configuration_invalid');
});

test('preserves empty optional caps, fractional memory multiplier and explicit scan mode', () => {
  expect(selectedApplicationConfiguration({ PGVECTOR_HNSW_MAX_SCAN_TUPLES: '', PGVECTOR_HNSW_SCAN_MEM_MULTIPLIER: '' }))
    .toMatchObject({ PGVECTOR_HNSW_MAX_SCAN_TUPLES: '', PGVECTOR_HNSW_SCAN_MEM_MULTIPLIER: '' });
  expect(selectedApplicationConfiguration({ PGVECTOR_HNSW_SCAN_MEM_MULTIPLIER: '1.5', PGVECTOR_HNSW_ITERATIVE_SCAN: 'off' }))
    .toMatchObject({ PGVECTOR_HNSW_SCAN_MEM_MULTIPLIER: '1.5', PGVECTOR_HNSW_ITERATIVE_SCAN: 'off' });
});

test.each([{ OLLAMA_PREFLIGHT_RETRY_BASE_MS: '3600001' }, { OLLAMA_PREFLIGHT_RETRY_MAX_MS: '1000' },
  { PGVECTOR_CANDIDATE_LIMIT_MIN: '201' }, { PGVECTOR_CANDIDATE_LIMIT: '25' },
  { PGVECTOR_HNSW_ITERATIVE_SCAN: 'unexpected' }, { PGVECTOR_HNSW_SCAN_MEM_MULTIPLIER: '1.2.3' },
  { PGVECTOR_HNSW_SCAN_MEM_MULTIPLIER: '1.' }, { REFRESH_TOKEN_CLEANUP_ENABLED: 'no' },
])('refuses silently altered tuning %#', input => {
  expect(() => selectedApplicationConfiguration(input)).toThrow('selected_application_configuration_invalid');
});

test('real retention and vector consumers preserve zero/false choices and DB precedence', async () => {
  process.env = selectedApplicationEnvironment({ TASK_QUEUE_RETENTION_DAYS: '0', TASK_QUEUE_FAILED_RETENTION_DAYS: '0',
    TASK_QUEUE_CANCELLED_RETENTION_DAYS: '0', REFRESH_TOKEN_CLEANUP_ENABLED: 'false',
    PGVECTOR_EF_SEARCH: '123', PGVECTOR_CANDIDATE_LIMIT_MIN: '75', PGVECTOR_CANDIDATE_LIMIT: '400',
    PGVECTOR_HNSW_ITERATIVE_SCAN: 'off', PGVECTOR_HNSW_SCAN_MEM_MULTIPLIER: '1.5',
    OLLAMA_PREFLIGHT_CACHE_MS: '0', OLLAMA_PREFLIGHT_RETRY_BASE_MS: '1000', OLLAMA_PREFLIGHT_RETRY_MAX_MS: '1000' });
  expect(await getTaskQueueRetentionPolicy({ query: async () => ({ rows: [] }) }, {}))
    .toEqual({ completed: 0, failed: 0, cancelled: 0 });
  expect(await getTaskQueueRetentionPolicy({ query: async () => ({ rows: [{ key: 'task_queue_retention_days', value: '14' }] }) }, {}))
    .toEqual({ completed: 14, failed: 0, cancelled: 0 });
  expect(process.env.REFRESH_TOKEN_CLEANUP_ENABLED).toBe('false');
  expect(resolvePgvectorRecallTuning()).toMatchObject({ efSearch: 123, candidateLimitMin: 75,
    candidateLimitMax: 400, iterativeScan: 'off', scanMemMultiplier: 1.5 });
  expect(parseCacheMs(process.env.OLLAMA_PREFLIGHT_CACHE_MS)).toBe(0);
  expect(getScheduledPreflightRetryDelayMs(20)).toBe(1000);
});

test('documents every example setting without forwarding deployment or privileged authority', async () => {
  const deferred = {
    CLASSIFARR_MEDIA_PATH: 'Compose host mount', CLASSIFARR_APPDATA_PATH: 'Compose host mount',
    CLASSIFARR_MEDIA_READ_ONLY: 'Compose mount permission', CLASSIFARR_RUNTIME_MODE: 'supervisor mode',
    CLASSIFARR_SCHEMA_MAINTENANCE: 'supervisor schema authority', DATABASE_URL: 'database identity',
    POSTGRES_HOST: 'database identity', POSTGRES_PORT: 'database identity', POSTGRES_DB: 'database identity',
    POSTGRES_USER: 'database identity', POSTGRES_PASSWORD: 'database identity',
    PGVECTOR_RUNTIME_STAGING: 'image startup policy', CLASSIFARR_POSTGRES_STARTUP_TIMEOUT_SECONDS: 'supervisor deadline',
    POLICY_COMPATIBILITY_NAMED_SCOPE_REPOSITORY_ROOT: 'privileged retirement: deferred',
    POLICY_COMPATIBILITY_NAMED_SCOPE_EVIDENCE_ROOT: 'privileged retirement: deferred',
    POLICY_COMPATIBILITY_NAMED_SCOPE_AUTHORIZATION_TTL_MS: 'privileged retirement: deferred',
  };
  const example = await readFile(new URL('../../../.env.example', import.meta.url), 'utf8');
  const names = new Set([...example.matchAll(/^#?\s*([A-Z][A-Z0-9_]*)=/gm)].map(match => match[1]));
  expect(names.size).toBeGreaterThan(50);
  for (const name of names) {
    expect(isSelectedApplicationSetting(name) || Object.hasOwn(deferred, name)).toBe(true);
  }
  for (const name of Object.keys(deferred)) {
    expect(names.has(name)).toBe(true);
    expect(isSelectedApplicationSetting(name)).toBe(false);
    expect(() => selectedApplicationConfiguration({ [name]: 'untrusted' })).toThrow('configuration_invalid');
  }
});
