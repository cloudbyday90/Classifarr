/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { validateCatalogAdmission, catalogAdmissionRecord } from '../ollamaGateway/catalogAdmissionContract.mjs';
import { validateArchiveManifest } from '../ollamaGateway/archiveContract.mjs';
import { catalogTables } from '../ollamaGateway/catalogContract.mjs';
import { archiveDumpOptions } from '../ollamaGateway/archiveDump.mjs';
import { frozenCatalogSample, canonicalAdmission } from './fixtures/gatewayCatalogAdmission.mjs';

test('v7 admission preserves exact PostgreSQL timestamp text and is bound to its manifest', () => {
  const { manifest, row } = frozenCatalogSample();
  expect(validateArchiveManifest(manifest)).toBe(manifest);
  expect(validateCatalogAdmission(manifest.catalog.admission, manifest)).toEqual(row);
  expect(manifest.catalog.admission.row).toContain('.123456+00:00');
  for (const version of [5, 6]) expect(() => validateArchiveManifest({ ...manifest, version })).toThrow();
});
test.each([
  { attempt: 0 }, { attempt: 4 }, { status: 'verified' }, { receipt: {} }, { manifest: {} }, { reason: 'cancelled' },
  { compatible_revisions: [] }, { compatible_revisions: ['b'.repeat(64)] }, { created_at: 'bad' }, { extra: 1 },
  { id: '0199ea26-7d80-4000-8000-000000000010' }, { retry_after: '2026-10-18T13:00:00Z' },
])('malformed or already-used admission is refused %#', patch => {
  const { row } = frozenCatalogSample(); expect(() => catalogAdmissionRecord(canonicalAdmission({ ...row, ...patch }))).toThrow();
});
test.each(['id', 'ledger_id', 'provider_hash', 'policy_hash', 'revision', 'semantic_sha256'])('cannot rebind %s independently', field => {
  const { manifest, row } = frozenCatalogSample();
  row[field] = ['id', 'ledger_id'].includes(field) ? '0199ea26-7d80-7000-8000-000000000099' : 'b'.repeat(64);
  if (field === 'revision') row.compatible_revisions = [row.revision];
  manifest.catalog.admission = catalogAdmissionRecord(canonicalAdmission(row));
  expect(() => validateArchiveManifest(manifest)).toThrow();
});
test('duplicate keys, altered hash, oversize rows, foreign envelope fields and source-time rebinding fail', () => {
  const { manifest, row } = frozenCatalogSample();
  const original = manifest.catalog.admission;
  const duplicate = original.row.replace('{', '{"attempt": 1, ');
  const digest = value => createHash('sha256').update(value).digest('hex');
  for (const value of [{ ...original, sha256: 'b'.repeat(64) }, { ...original, extra: true },
    { version: 1, row: duplicate, sha256: digest(duplicate) }, { version: 1, row: 'x'.repeat(16385), sha256: digest('x'.repeat(16385)) }]) {
    expect(() => validateCatalogAdmission(value)).toThrow();
  }
  row.created_at = '2026-10-01T00:00:00+00:00'; manifest.catalog.admission = catalogAdmissionRecord(canonicalAdmission(row));
  expect(() => validateArchiveManifest(manifest)).toThrow();
});
test('frozen table count reserves its additional job, unknown versions cannot select legacy tables', () => {
  const { manifest } = frozenCatalogSample();
  manifest.catalog.tables['gateway_catalog.job'] = { count: 10000, maxId: manifest.archiveId, sha256: 'a'.repeat(64) };
  expect(() => validateArchiveManifest(manifest)).toThrow();
  for (const version of [0, 4, undefined, '3']) expect(() => catalogTables(version)).toThrow();
  const config = { database: { host: '/socket', user: 'reader', database: 'fixture' }, providerHash: 'a'.repeat(64), retentionDays: 90 };
  expect(archiveDumpOptions(config, '00000001-00000001-1', 3).args).toContain('--table=gateway_catalog.job');
  expect(() => archiveDumpOptions(config, '00000001-00000001-1', 4)).toThrow();
});
