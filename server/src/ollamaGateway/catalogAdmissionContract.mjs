/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { archiveUuid, archiveHash } from './archiveRetentionContract.mjs';
import { gatewayError } from './errors.mjs';

export const CATALOG_ADMISSION_LIMIT = 16384;
const fields = ['id','ledger_id','provider_hash','policy_hash','revision','compatible_revisions','semantic_sha256','attempt','status',
  'created_at','completed_at','retry_after','manifest_sha256','manifest','receipt','reason'];
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const invalid = () => gatewayError('gateway_catalog_admission_record');
const digest = row => createHash('sha256').update(row).digest('hex');
const pgTime = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) &&
  (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+00:00$/.test(value) ||
   /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{1,6}\+00:00$/.test(value));

/** Preserve PostgreSQL canonical text, including microseconds; never round-trip through Date. */
export function validateCatalogAdmission(value, manifest = null) {
  if (!exact(value, ['version','row','sha256']) || value.version !== 1 || typeof value.row !== 'string' ||
      Buffer.byteLength(value.row) > CATALOG_ADMISSION_LIMIT || !archiveHash(value.sha256) || digest(value.row) !== value.sha256) throw invalid();
  let row;
  try { row = JSON.parse(value.row); } catch { throw invalid(); }
  if (!exact(row, fields) || !archiveUuid(row.id) || !archiveUuid(row.ledger_id) ||
      !['provider_hash','policy_hash','revision','semantic_sha256'].every(key => archiveHash(row[key])) ||
      !Array.isArray(row.compatible_revisions) || row.compatible_revisions.length < 1 || row.compatible_revisions.length > 128 ||
      !row.compatible_revisions.every(archiveHash) || new Set(row.compatible_revisions).size !== row.compatible_revisions.length ||
      !row.compatible_revisions.includes(row.revision) || !Number.isInteger(row.attempt) || row.attempt < 1 || row.attempt > 3 ||
      row.status !== 'exporting' || !pgTime(row.created_at) ||
      !['completed_at','retry_after','manifest_sha256','manifest','receipt','reason'].every(key => row[key] === null)) throw invalid();
  // Reject duplicate keys, escaped spellings and noncanonical whitespace without losing timestamp precision.
  const canonical = `{${Object.entries(row).map(([key, entry]) => `${JSON.stringify(key)}: ${Array.isArray(entry) ?
    `[${entry.map(item => JSON.stringify(item)).join(', ')}]` : JSON.stringify(entry)}`).join(', ')}}`;
  if (canonical !== value.row) throw invalid();
  if (manifest && (row.id !== manifest.archiveId || row.ledger_id !== manifest.report.ledgerId ||
      row.provider_hash !== manifest.report.providerHash || row.revision !== manifest.revision || row.policy_hash !== manifest.policyHash ||
      row.semantic_sha256 !== manifest.catalog.semanticSha256 || Date.parse(row.created_at) < Date.parse(manifest.report.capturedAt))) throw invalid();
  return row;
}

export function catalogAdmissionRecord(row) {
  const value = { version: 1, row, sha256: digest(row) }; validateCatalogAdmission(value); return value;
}
