/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { gatewayError } from './errors.mjs';
import { archiveUuid, validateRetentionInventory } from './archiveRetentionContract.mjs';
export { archiveUuid } from './archiveRetentionContract.mjs';

export const ARCHIVE_LIMIT = 256 * 1024 * 1024;
export const ARCHIVE_TABLES = Object.freeze(['admission', 'request_binding', 'completion_receipt',
  'recovery_receipt', 'provider_stop_intent', 'provider_stop_observation', 'upstream_peer_observation']);
export const ARCHIVE_CATEGORIES = Object.freeze(['active', 'lifecycle', 'unknown', 'recent', 'older_terminal_review']);
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const time = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const counts = (value, keys) => exact(value, keys) && Object.values(value).every(count => Number.isSafeInteger(count) && count >= 0);
const days = value => Number.isInteger(value) && value >= 1 && value <= 3650;
const integer = value => typeof value === 'string' && /^(0|[1-9][0-9]{0,18})$/.test(value) && BigInt(value) <= 9223372036854775807n;

export function gatewayArchiveConfiguration(value) {
  const db = value?.database;
  if (!exact(value, ['database', 'providerHash', 'retentionDays']) || !hash(value.providerHash) || !days(value.retentionDays) ||
      !object(db) || Object.keys(db).some(key => !['host', 'port', 'database', 'user', 'password'].includes(key)) ||
      typeof db.host !== 'string' || !/^\/[A-Za-z0-9_./-]{1,255}$/.test(db.host) || db.host.split('/').includes('..') ||
      !['database', 'user'].every(key => typeof db[key] === 'string' && /^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(db[key])) ||
      db.port !== undefined && (!Number.isInteger(db.port) || db.port < 1 || db.port > 65535) ||
      db.password !== undefined && (typeof db.password !== 'string' || db.password.length > 4096 || db.password.includes('\0'))) {
    throw gatewayError('gateway_archive_config_invalid');
  }
  return { database: { ...db }, providerHash: value.providerHash, retentionDays: value.retentionDays };
}

export function validateArchiveReport(value) {
  if (!exact(value, ['ledgerId', 'providerHash', 'capturedAt', 'cutoff', 'retentionDays', 'attempts', 'bindingCount',
    'counts', 'categories', 'counterMatches', 'legacyActiveWithoutBinding', 'purgeAuthorized']) ||
      !archiveUuid(value.ledgerId) || !hash(value.providerHash) || !time(value.capturedAt) || !time(value.cutoff) ||
      Date.parse(value.cutoff) >= Date.parse(value.capturedAt) || !days(value.retentionDays) || !integer(value.attempts) ||
      !Number.isInteger(value.bindingCount) || value.bindingCount < 0 || value.bindingCount > 100000 ||
      !counts(value.counts, ARCHIVE_TABLES) || value.counts.admission !== 1 || !counts(value.categories, ARCHIVE_CATEGORIES) ||
      Object.values(value.categories).reduce((sum, count) => sum + count, 0) !== value.counts.request_binding ||
      value.counterMatches !== (value.bindingCount === value.counts.request_binding) ||
      typeof value.legacyActiveWithoutBinding !== 'boolean' || value.purgeAuthorized !== false) {
    throw gatewayError('gateway_archive_report_invalid');
  }
  return value;
}

export function validateArchiveManifest(value) {
  const keys = ['version', 'schemaVersion', 'archiveId', 'report', 'dump', ...(value?.version === 2 ? ['retention'] : [])];
  if (!exact(value, keys) || ![1, 2].includes(value.version) || value.schemaVersion !== 7 ||
      !archiveUuid(value.archiveId) || !exact(value.dump, ['name', 'bytes', 'sha256']) || value.dump.name !== 'gateway.dump' ||
      !Number.isSafeInteger(value.dump.bytes) || value.dump.bytes < 5 || value.dump.bytes > ARCHIVE_LIMIT || !hash(value.dump.sha256)) {
    throw gatewayError('gateway_archive_manifest_invalid');
  }
  validateArchiveReport(value.report);
  if (value.version === 2) validateRetentionInventory(value.retention, value.report.categories.older_terminal_review);
  return value;
}
