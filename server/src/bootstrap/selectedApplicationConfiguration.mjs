/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { posix } from 'node:path';
import { SELECTED_TUNING_RULES, validSelectedTuning, validSelectedTuningRelationships } from './selectedTuningConfiguration.mjs';

const encryptionKeyPath = '/app/data/secrets/api_key_encryption_key';
export const SELECTED_APPLICATION_DEFAULTS = Object.freeze({
  API_KEY_ENCRYPTION_KEY_FILE: encryptionKeyPath,
  RUNTIME_SETTINGS_FILE: '/app/data/config/runtime.json',
  LOG_DIR: '/app/data/logs', BACKUP_DIR: '/app/data/backups',
  LOG_LEVEL: 'info', FILE_LOGGING_ENABLED: 'true', PORT: '21324', TZ: 'UTC',
});
const paths = new Set(['API_KEY_ENCRYPTION_KEY_FILE', 'RUNTIME_SETTINGS_FILE', 'LOG_DIR', 'BACKUP_DIR']);
const booleans = new Set(['FILE_LOGGING_ENABLED', 'FORCE_SECURE_COOKIES', 'CSRF_PROTECTION',
  'SECURITY_HEADERS_STRICT', 'ENFORCE_HTTPS_HEADERS', 'REFRESH_TOKEN_CLEANUP_ENABLED',
  'POLICY_INTENT_REPLAY_TMDB_METADATA_LIVE_PREVIEW_ENABLED']);
const integers = new Set(['OMDB_REQUEST_TIMEOUT_MS', 'OMDB_MAX_REQUEST_TIMEOUT_MS', 'OMDB_MAX_RETRIES',
  'OMDB_SSL_WARN_THROTTLE_MS', 'OMDB_SSL_BLOCK_MS', 'LOG_MAX_FILE_SIZE', 'LOG_MAX_FILES',
  'LOG_MAX_AGE_DAYS', 'LOG_MAX_TOTAL_SIZE']);
const keys = new Set([...Object.keys(SELECTED_APPLICATION_DEFAULTS), ...booleans, ...integers,
  ...Object.keys(SELECTED_TUNING_RULES), 'PGVECTOR_HNSW_ITERATIVE_SCAN',
  'API_KEY_ENCRYPTION_KEY', 'CORS_ORIGIN', 'OMDB_RETRY_TIMEOUT_MULTIPLIER', 'LOG_COMPRESS']);
export const isSelectedApplicationSetting = key => keys.has(key);
const invalid = () => new Error('selected_application_configuration_invalid');
export const validSelectedKey = value => typeof value === 'string' && /^[a-fA-F0-9]{64}$/.test(value);

export function assertSelectedConfigurationPath(value) {
  if (typeof value !== 'string' || value.length > 1024 || !posix.isAbsolute(value)
    || posix.normalize(value) !== value || value.endsWith('/') || /[\\\x00-\x1f\x7f]/.test(value)
    || value.split('/').length > 32) throw invalid();
  const top = value.split('/')[1];
  if (['proc', 'sys', 'dev', 'etc', 'usr', 'bin', 'sbin', 'lib', 'lib64', 'boot', 'root'].includes(top)
    || (top === 'app' && !/^\/app\/data\/(config|secrets|logs|backups)(\/|$)/.test(value))) throw invalid();
}

/** Reviewed application settings only. No implicit inheritance or authority fields. */
export function selectedApplicationConfiguration(input = {}) {
  if (!input || Object.getPrototypeOf(input) !== Object.prototype) throw invalid();
  for (const [key, value] of Object.entries(input)) {
    if (!keys.has(key) || typeof value !== 'string' || value.length > 4096 || /[\x00-\x1f\x7f]/.test(value)) throw invalid();
    if (paths.has(key)) assertSelectedConfigurationPath(value);
    else if (Object.hasOwn(SELECTED_TUNING_RULES, key)) { if (!validSelectedTuning(key, value)) throw invalid(); }
    else if (key === 'PGVECTOR_HNSW_ITERATIVE_SCAN') { if (!['off', 'strict_order', 'relaxed_order'].includes(value)) throw invalid(); }
    else if (key === 'API_KEY_ENCRYPTION_KEY') { if (!validSelectedKey(value)) throw invalid(); }
    else if (booleans.has(key) || key === 'LOG_COMPRESS') { if (!['true', 'false'].includes(value)) throw invalid(); }
    else if (integers.has(key)) { if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) throw invalid(); }
    else if (key === 'PORT') { if (!/^[1-9]\d*$/.test(value) || Number(value) > 65535) throw invalid(); }
    else if (key === 'LOG_LEVEL') { if (!['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'].includes(value)) throw invalid(); }
    else if (key === 'TZ') {
      try { new Intl.DateTimeFormat('en', { timeZone: value }); } catch { throw invalid(); }
    } else if (key === 'OMDB_RETRY_TIMEOUT_MULTIPLIER') {
      const parts = value.split('.');
      if (parts.length > 2 || parts.some(part => !/^\d+$/.test(part))
        || !Number.isFinite(Number(value)) || Number(value) < 1) throw invalid();
    } else if (key === 'CORS_ORIGIN' && value !== '') {
      for (const origin of value.split(',').map(item => item.trim())) {
        let url; try { url = new URL(origin); } catch { throw invalid(); }
        if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin || url.username || url.password) throw invalid();
      }
    }
  }
  if (!validSelectedTuningRelationships(input)) throw invalid();
  return { ...SELECTED_APPLICATION_DEFAULTS, ...input };
}

export function selectedConfigurationFromEnvironment(environment) {
  return selectedApplicationConfiguration(Object.fromEntries(Object.entries(environment).filter(([key]) => keys.has(key))));
}
