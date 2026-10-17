/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ARCHIVE_TABLES } from './archiveTables.mjs';
import { archiveUuid } from './archiveRetentionContract.mjs';
import { gatewayError } from './errors.mjs';

const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

export function validateArchiveContent(value) {
  if (!exact(value, ARCHIVE_TABLES) || !ARCHIVE_TABLES.every(name => {
    const entry = value[name];
    return exact(entry, ['count', 'maxId', 'sha256']) && Number.isInteger(entry.count) && entry.count >= 0 && entry.count <= 200000 &&
      (entry.count === 0 ? entry.maxId === null : archiveUuid(entry.maxId)) && hash(entry.sha256);
  })) throw gatewayError('gateway_archive_content_invalid');
  return value;
}

export function validateOnlineArchiveFields(value) {
  validateArchiveContent(value.content);
  if ([4, 5].includes(value.version) && Date.parse(value.report.capturedAt) - Date.parse(value.report.cutoff) !== value.report.retentionDays * 86400000) {
    throw gatewayError('gateway_archive_content_invalid');
  }
  if (!hash(value.policyHash) || !hash(value.revision) || !Array.isArray(value.predecessors) || value.predecessors.length > 2 ||
      new Set(value.predecessors.map(entry => entry.archiveId)).size !== value.predecessors.length) throw gatewayError('gateway_archive_content_invalid');
  for (const prior of value.predecessors) {
    if (!exact(prior, ['archiveId', 'manifestSha256', 'content']) || !archiveUuid(prior.archiveId) ||
        prior.archiveId === value.archiveId || !hash(prior.manifestSha256)) throw gatewayError('gateway_archive_content_invalid');
    validateArchiveContent(prior.content);
  }
  for (const table of ARCHIVE_TABLES) if (value.content[table].count !== value.report.counts[table]) throw gatewayError('gateway_archive_content_invalid');
}

export function validateArchiveReceipt(value) {
  if (!exact(value, ['version', 'archiveId', 'manifestSha256', 'dumpSha256', 'verified', 'preserves', 'purgeAuthorized',
    ...(value?.version === 2 ? ['retentionSha256'] : [])]) ||
      ![1, 2].includes(value.version) || !archiveUuid(value.archiveId) || !hash(value.manifestSha256) || !hash(value.dumpSha256) ||
      typeof value.verified !== 'boolean' || value.purgeAuthorized !== false || !Array.isArray(value.preserves) || value.preserves.length > 2 ||
      value.version === 2 && (value.verified ? !hash(value.retentionSha256) : value.retentionSha256 !== null) ||
      (!value.verified && value.preserves.length !== 0) ||
      !value.preserves.every(archiveUuid) || new Set(value.preserves).size !== value.preserves.length) throw gatewayError('gateway_archive_receipt_invalid');
  return value;
}
