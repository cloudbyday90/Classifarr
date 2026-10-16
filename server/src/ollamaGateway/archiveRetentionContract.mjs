/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { gatewayError } from './errors.mjs';

export const RETENTION_REVIEW_LIMIT = 100;
export const archiveUuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
export const archiveHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const attempt = value => typeof value === 'string' && /^[1-9][0-9]{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n;

export function validateRetentionInventory(value, totalCandidates) {
  if (!exact(value, ['version', 'ledgerSha256', 'entries', 'totalCandidates', 'hasMore']) || value.version !== 1 ||
      !archiveHash(value.ledgerSha256) || !Number.isInteger(totalCandidates) || totalCandidates < 0 || totalCandidates > 100000 ||
      value.totalCandidates !== totalCandidates || !Array.isArray(value.entries) ||
      value.entries.length !== Math.min(totalCandidates, RETENTION_REVIEW_LIMIT) ||
      value.hasMore !== (totalCandidates > RETENTION_REVIEW_LIMIT)) throw gatewayError('gateway_archive_inventory_invalid');
  const bindings = new Set(), requests = new Set(); let previous = 0n;
  for (const entry of value.entries) {
    if (!exact(entry, ['bindingId', 'requestId', 'attempt', 'rowSha256']) || !archiveUuid(entry.bindingId) ||
        !archiveUuid(entry.requestId) || !attempt(entry.attempt) || !archiveHash(entry.rowSha256) ||
        bindings.has(entry.bindingId) || requests.has(entry.requestId) || BigInt(entry.attempt) <= previous) {
      throw gatewayError('gateway_archive_inventory_invalid');
    }
    bindings.add(entry.bindingId); requests.add(entry.requestId); previous = BigInt(entry.attempt);
  }
  return value;
}
