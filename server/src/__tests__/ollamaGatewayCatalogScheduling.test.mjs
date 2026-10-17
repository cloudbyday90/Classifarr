/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { catalogDue, catalogSemanticRevision } from '../ollamaGateway/catalogSchedule.mjs';
import { archiveDue } from '../ollamaGateway/archiveSchedule.mjs';
import { validateCatalogVerification } from '../ollamaGateway/catalogVerificationResult.mjs';
import { validateArchiveManifest } from '../ollamaGateway/archiveContract.mjs';
import { archiveDumpOptions } from '../ollamaGateway/archiveDump.mjs';
import { archiveWorkerConfiguration } from '../ollamaGateway/archiveWorkerConfiguration.mjs';
import { catalogSample, syntheticHash, syntheticId } from './fixtures/gatewayCatalogRetention.mjs';
import { resolve } from 'node:path';

function state() {
  const { manifest } = catalogSample(); manifest.report.counts.request_binding = 1;
  return { report: manifest.report, revision: syntheticHash, semantic: syntheticHash, jobs: [], inferenceJobs: [], roots: [], now: Date.now() };
}
const job = overrides => ({ ledger_id: syntheticId(2), provider_hash: syntheticHash, revision: syntheticHash,
  semantic_sha256: syntheticHash, status: 'verified', attempt: 1, completed_at: new Date().toISOString(), ...overrides });
const root = (semantic = syntheticHash) => ({ manifest: { revision: syntheticHash, catalog: { semanticSha256: semantic } } });

test('initial capture and second copy are due, stable two-copy state is quiet', () => {
  const value = state(); expect(catalogDue(value)).toBe('due');
  value.jobs = [job({})]; value.roots = [root()]; expect(catalogDue(value)).toBe('due');
  value.jobs.push(job({ attempt: 2 })); value.roots.push(root()); expect(catalogDue(value)).toBe('unchanged');
});
test.each(['exporting', 'awaiting_verification', 'interrupted', 'retiring'])('pending %s never duplicates work', status => {
  expect(catalogDue({ ...state(), inferenceJobs: [job({ status })] })).toBe('pending');
  expect(catalogDue({ ...state(), jobs: [job({ status })] })).toBe('pending');
});
test('new maintenance-only content follows daily/hourly timing, not an assessment loop', () => {
  const value = state(); value.jobs = [job({})]; value.roots = [root(), root()]; value.semantic = 'b'.repeat(64);
  expect(catalogDue(value)).toBe('not_due');
  value.now += 3600001; expect(catalogDue(value)).toBe('not_due');
  value.report.bindingCount = 80000; expect(catalogDue(value)).toBe('due');
  value.report.bindingCount = 1; value.now += 86400000; expect(catalogDue(value)).toBe('due');
});
test('original attempts and legacy aliases are shared across both job ledgers', () => {
  const value = state(); value.inferenceJobs = [job({ attempt: 2, status: 'failed', revision: 'b'.repeat(64) })];
  value.compatibleRevisions = ['b'.repeat(64)]; value.jobs = [job({ attempt: 3 })];
  expect(catalogDue(value)).toBe('attempts_exhausted');
  expect(archiveDue({ ...value, jobs: [], budgetJobs: value.jobs })).toBe('attempts_exhausted');
  value.jobs = [job({ attempt: 1 })];
  expect(archiveDue({ ...value, jobs: [], budgetJobs: value.jobs })).toBe('due');
});
test('failures preserve cooldown while source changes cannot hide inconsistent/foreign state', () => {
  const value = state(); value.jobs = [job({ status: 'failed', retry_after: new Date(value.now + 10000).toISOString() })];
  expect(catalogDue(value)).toBe('cooldown');
  value.now += 10001; expect(catalogDue(value)).toBe('due');
  value.report.counterMatches = false; expect(catalogDue(value)).toBe('source_inconsistent');
  value.report.counterMatches = true; value.jobs[0].provider_hash = 'b'.repeat(64); expect(catalogDue(value)).toBe('identity_changed');
});
test('semantic fingerprint excludes own job bookkeeping but includes independent maintenance', () => {
  const tables = catalogSample().manifest.catalog.tables, initial = catalogSemanticRevision(tables);
  expect(catalogSemanticRevision({ ...tables, 'gateway_catalog.job': { count: 9 } })).toBe(initial);
  for (const name of Object.keys(tables)) expect(catalogSemanticRevision({ ...tables, [name]: { ...tables[name], count: 1 } })).not.toBe(initial);
});
test('v6 is explicit, legacy v5 cannot silently take the new dependency meaning', () => {
  const value = catalogSample().manifest;
  value.version = 6; expect(() => validateArchiveManifest(value)).toThrow();
  value.catalog.version = 2; value.catalog.semanticSha256 = syntheticHash;
  value.catalog.tables['gateway_catalog.job'] = { count: 0, maxId: null, sha256: syntheticHash };
  expect(validateArchiveManifest(value)).toBe(value);
  value.version = 5; expect(() => validateArchiveManifest(value)).toThrow();
});
test('catalog verification cannot become inference success, purge authority or activation', () => {
  const result = catalogSample().verification; expect(validateCatalogVerification(result)).toBe(result);
  for (const change of [{ purgeAuthorized: true }, { runtimeEnabled: true }, { verified: true }, { rowsRestored: false }, { manifestSha256: 'bad' }]) {
    expect(() => validateCatalogVerification({ ...result, ...change })).toThrow();
  }
  expect(validateCatalogVerification({ ...result, rowsRestored: false, dependenciesAvailable: false }).rowsRestored).toBe(false);
});
test('new worker mode requires distinct private store paths and explicit versioned dump scope', () => {
  const source = { database: { host: '/socket', user: 'reader', database: 'fixture' }, providerHash: syntheticHash, retentionDays: 90 };
  const config = { source, maintenance: { ...source.database, user: 'maintainer' }, archives: resolve('/archives'), receipts: resolve('/receipts'), catalogs: resolve('/catalogs') };
  expect(archiveWorkerConfiguration(config).catalogs).toBe(config.catalogs);
  for (const catalogs of [config.archives, resolve('/archives/catalogs'), resolve('/receipts/sub'), 'relative']) {
    expect(() => archiveWorkerConfiguration({ ...config, catalogs })).toThrow();
  }
  expect(archiveDumpOptions(source, '00000001-00000001-1', 2).args).toContain('--table=gateway_catalog.job');
  expect(archiveDumpOptions(source, '00000001-00000001-1', true).args).not.toContain('--table=gateway_catalog.job');
});
