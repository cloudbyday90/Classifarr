/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { catalogSample, syntheticHash } from './gatewayCatalogRetention.mjs';
import { catalogAdmissionRecord } from '../../ollamaGateway/catalogAdmissionContract.mjs';

export function canonicalAdmission(row) {
  return `{${Object.entries(row).map(([key, value]) => `${JSON.stringify(key)}: ${Array.isArray(value) ?
    `[${value.map(item => JSON.stringify(item)).join(', ')}]` : JSON.stringify(value)}`).join(', ')}}`;
}
export function frozenCatalogSample() {
  const { manifest } = catalogSample(); manifest.version = 7; manifest.catalog.version = 3;
  manifest.catalog.semanticSha256 = syntheticHash;
  manifest.catalog.tables['gateway_catalog.job'] = { count: 0, maxId: null, sha256: syntheticHash };
  const row = { id: manifest.archiveId, ledger_id: manifest.report.ledgerId, provider_hash: syntheticHash, policy_hash: syntheticHash,
    revision: syntheticHash, compatible_revisions: [syntheticHash], semantic_sha256: syntheticHash, attempt: 1, status: 'exporting',
    created_at: '2026-10-18T13:00:00.123456+00:00', completed_at: null, retry_after: null, manifest_sha256: null,
    manifest: null, receipt: null, reason: null };
  manifest.catalog.admission = catalogAdmissionRecord(canonicalAdmission(row));
  return { manifest, row };
}
