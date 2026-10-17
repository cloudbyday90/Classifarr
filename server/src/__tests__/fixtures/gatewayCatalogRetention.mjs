/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { ARCHIVE_TABLES } from '../../ollamaGateway/archiveTables.mjs';
import { CATALOG_TABLES } from '../../ollamaGateway/catalogContract.mjs';
import { catalogInventorySummary } from '../../ollamaGateway/catalogRetentionContract.mjs';

export const syntheticId = n => `0199ea26-7d80-7000-8000-${String(n).padStart(12, '0')}`;
export const syntheticHash = 'a'.repeat(64);
export const inventory = (id = syntheticId(1)) => ['dump', 'manifest', 'receipt'].map(kind => ({ id, kind, bytes: 50, sha256: syntheticHash }));
export function catalogSample(archiveId = syntheticId(10), ledgerId = syntheticId(2), entries = inventory()) {
  const report = { ledgerId, providerHash: syntheticHash, capturedAt: '2026-10-15T00:00:00.000Z', cutoff: '2026-07-17T00:00:00.000Z',
    retentionDays: 90, attempts: '0', bindingCount: 0, counts: Object.fromEntries(ARCHIVE_TABLES.map(name => [name, name === 'admission' ? 1 : 0])),
    categories: { active: 0, lifecycle: 0, unknown: 0, recent: 0, older_terminal_review: 0 }, counterMatches: true,
    legacyActiveWithoutBinding: false, purgeAuthorized: false };
  const manifest = { version: 5, schemaVersion: 7, archiveId, report, dump: { name: 'gateway.dump', bytes: 50, sha256: syntheticHash },
    retention: { version: 1, ledgerSha256: syntheticHash, entries: [], totalCandidates: 0, hasMore: false },
    content: Object.fromEntries(ARCHIVE_TABLES.map(name => [name, { count: report.counts[name], maxId: report.counts[name] ? ledgerId : null, sha256: syntheticHash }])),
    predecessors: [], policyHash: syntheticHash, revision: syntheticHash,
    catalog: { version: 1, tables: Object.fromEntries(CATALOG_TABLES.map(name => [name, { count: 0, maxId: null, sha256: syntheticHash }])),
      dependencies: catalogInventorySummary(entries) } };
  const manifestSha256 = createHash('sha256').update(`${JSON.stringify(manifest)}\n`).digest('hex');
  const verification = { kind: 'catalog_verification', version: 1, archiveId, manifestSha256, dumpSha256: manifest.dump.sha256,
    rowsRestored: true, dependenciesAvailable: true, runtimeEnabled: false, purgeAuthorized: false };
  return { manifest, manifestSha256, verification, entries };
}
