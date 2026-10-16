/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ARCHIVE_TABLES, validateArchiveManifest } from '../ollamaGateway/archiveContract.mjs';
import { retentionInventorySha256 } from '../ollamaGateway/archiveRetentionContract.mjs';
import { validateArchiveReceipt } from '../ollamaGateway/onlineArchiveContract.mjs';
import { validateReceiptForArchive } from '../ollamaGateway/archiveReceiptBinding.mjs';
import { archiveProtectionPlan,candidateBatchSha256,rollingArchives } from '../ollamaGateway/archiveProtectionPolicy.mjs';

const id = n => `019a0000-0000-7000-8000-${String(n).padStart(12, '0')}`, hash = 'a'.repeat(64);
function manifest(total = 0) {
  const counts = Object.fromEntries(ARCHIVE_TABLES.map(name => [name, 0]));
  Object.assign(counts, { admission: 1, request_binding: total, completion_receipt: total });
  return { version: 4, schemaVersion: 7, archiveId: id(1), policyHash: hash, revision: hash,
    report: { ledgerId: id(2), providerHash: hash, capturedAt: '2026-10-16T00:00:00.000Z', cutoff: '2026-07-18T00:00:00.000Z',
      retentionDays: 90, attempts: String(total), bindingCount: total, counts,
      categories: { active: 0, lifecycle: 0, unknown: 0, recent: 0, older_terminal_review: total },
      counterMatches: true, legacyActiveWithoutBinding: false, purgeAuthorized: false },
    content: Object.fromEntries(ARCHIVE_TABLES.map(name => [name, { count: counts[name], maxId: counts[name] ? id(9) : null, sha256: hash }])),
    predecessors: [], dump: { name: 'gateway.dump', bytes: 5, sha256: hash },
    retention: { version: 1, ledgerSha256: hash, totalCandidates: total, hasMore: total > 100,
      entries: Array.from({ length: Math.min(100, total) }, (_, i) => ({ bindingId: id(i + 10), requestId: id(i + 1000), attempt: String(i + 1), rowSha256: hash })) } };
}
const receipt = m => ({ version: 2, archiveId: m.archiveId, manifestSha256: hash, dumpSha256: m.dump.sha256,
  verified: true, preserves: [], purgeAuthorized: false, retentionSha256: retentionInventorySha256(m.retention) });

test.each([0, 1, 100, 101, 100000])('v4 exact inventory is bounded at candidate total %i', total => {
  const value = manifest(total);
  value.predecessors = [3, 4].map(n => ({ archiveId: id(n), manifestSha256: hash, content: value.content }));
  expect(validateArchiveManifest(value)).toBe(value);
  expect(Buffer.byteLength(JSON.stringify(value))).toBeLessThan(65536);
  expect(validateReceiptForArchive(receipt(value), value, hash).purgeAuthorized).toBe(false);
});

test('new fields cannot be smuggled into legacy manifests or omitted from v4', () => {
  const value = manifest(1), { retention: _retention, ...legacy } = value;
  expect(validateArchiveManifest({ ...legacy, version: 3 }).version).toBe(3);
  for (const invalid of [legacy, { ...value, version: 3 }, { ...value, extra: true }, { ...value, retention: null },
    { ...value, retention: { ...value.retention, entries: [] } }]) expect(() => validateArchiveManifest(invalid)).toThrow();
});

test('v4 cutoff must match the declared retention period exactly', () => {
  const value = manifest(1); value.report.cutoff = '2026-10-15T00:00:00.000Z';
  expect(() => validateArchiveManifest(value)).toThrow('gateway_archive_content_invalid');
});

test('canonical inventory digest survives JSONB key ordering at every level', () => {
  const value = manifest(2).retention;
  const reverse = object => Object.fromEntries(Object.entries(object).reverse());
  expect(retentionInventorySha256({ ...reverse(value), entries: value.entries.map(reverse) })).toBe(retentionInventorySha256(value));
  const changed = structuredClone(value); changed.entries[1].rowSha256 = 'b'.repeat(64);
  expect(retentionInventorySha256(changed)).not.toBe(retentionInventorySha256(value));
  expect(() => retentionInventorySha256({ ...value, extra: true })).toThrow();
});

test('legacy receipts remain usable only for v3 archives', () => {
  const value = manifest(), { retention: _retention, ...old } = value;
  old.version = 3;
  const { retentionSha256: _digest, ...priorReceipt } = receipt(value); priorReceipt.version = 1;
  expect(validateReceiptForArchive(priorReceipt, old, hash)).toBe(priorReceipt);
  expect(() => validateReceiptForArchive(priorReceipt, value, hash)).toThrow('gateway_archive_receipt_invalid');
  expect(() => validateReceiptForArchive(receipt(value), old, hash)).toThrow('gateway_archive_receipt_invalid');
});

test.each([{ retentionSha256: null }, { retentionSha256: 'wrong' }, { retentionSha256: 'b'.repeat(64) },
  { archiveId: id(8) }, { manifestSha256: 'b'.repeat(64) }, { dumpSha256: 'b'.repeat(64) },
  { preserves: [id(8)] }, { purgeAuthorized: true }, { extra: 'private' }])('receipt cannot misrepresent verified candidates %j', override => {
  const value = manifest(1);
  expect(() => validateReceiptForArchive({ ...receipt(value), ...override }, value, hash)).toThrow();
});

test('failed v2 receipts carry neither a candidate digest nor preservation claims', () => {
  const value = manifest(), failed = { ...receipt(value), verified: false, retentionSha256: null };
  expect(validateReceiptForArchive(failed, value, hash)).toBe(failed);
  expect(() => validateArchiveReceipt({ ...failed, retentionSha256: hash })).toThrow();
  expect(() => validateArchiveReceipt({ ...failed, preserves: [id(9)] })).toThrow();
  const { retentionSha256: _digest, ...missing } = failed;
  expect(() => validateArchiveReceipt(missing)).toThrow();
});

test('pressure readiness requires two independently verified exact candidate pages, not ledger digest equality',() => {
  const first = manifest(80000), second = structuredClone(first); second.archiveId = id(3);
  second.retention.ledgerSha256 = 'b'.repeat(64);
  const job = m => ({ id: m.archiveId,status: 'verified',ledger_id: m.report.ledgerId,provider_hash: hash,
    revision: hash,manifest_sha256: hash,manifest: m,receipt: receipt(m) });
  const jobs = [job(first),job(second)], input = { report: first.report,inventory: first.retention,revision: hash,jobs };
  expect(candidateBatchSha256(first.retention)).toBe(candidateBatchSha256(second.retention));
  expect(archiveProtectionPlan(input).pair).toEqual(jobs);
  expect(archiveProtectionPlan({ ...input,jobs: jobs.slice(0,1) })).toEqual({ needsRecoveryCopy: true });
  expect(archiveProtectionPlan({ ...input,revision: 'changed',jobs: jobs.slice(0,1) })).toEqual({ needsRecoveryCopy: false });
  jobs[1].manifest.retention.entries[0].rowSha256 = 'c'.repeat(64); jobs[1].receipt = receipt(jobs[1].manifest);
  expect(archiveProtectionPlan(input)).toEqual({ needsRecoveryCopy: true });
});

test('no protection on empty/nonpressure, legacy, or already-protected history',() => {
  const m = manifest(80000), j = { id: m.archiveId,status: 'verified',ledger_id: m.report.ledgerId,provider_hash: hash,
    revision: hash,manifest_sha256: hash,manifest: m,receipt: receipt(m) };
  const input = { report: m.report,inventory: m.retention,revision: hash,jobs: [j] };
  expect(archiveProtectionPlan({ ...input,report: { ...m.report,bindingCount: 79999 } }).needsRecoveryCopy).toBe(false);
  expect(archiveProtectionPlan({ ...input,inventory: manifest().retention }).needsRecoveryCopy).toBe(false);
  expect(archiveProtectionPlan({ ...input,jobs: [{ ...j,manifest: { ...m,version: 3 } }] }).needsRecoveryCopy).toBe(false);
  expect(archiveProtectionPlan({ ...input,jobs: [{ ...j,protection: { candidates_sha256: candidateBatchSha256(m.retention) } }] })
    .needsRecoveryCopy).toBe(false);
  expect(() => archiveProtectionPlan({ ...input,jobs: [{ ...j,receipt: { ...j.receipt,retentionSha256: hash } }] })).toThrow();
  expect(rollingArchives([{ ...j,recovery_protection_id: id(8) },{ ...j,id: id(6) },{ ...j,id: id(7) }]).map(x => x.id))
    .toEqual([id(6),id(7)]);
});
