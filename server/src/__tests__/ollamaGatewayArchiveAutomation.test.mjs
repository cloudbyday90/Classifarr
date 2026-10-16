/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { archiveDue,archivePolicyHash,ARCHIVE_POLICY } from '../ollamaGateway/archiveSchedule.mjs';
import { validateArchiveContent,validateArchiveReceipt } from '../ollamaGateway/onlineArchiveContract.mjs';
import { preservesArchiveContent } from '../ollamaGateway/archiveContent.mjs';
import { ARCHIVE_TABLES } from '../ollamaGateway/archiveContract.mjs';

const id = '019a0000-0000-7000-8000-000000000001', hash = 'a'.repeat(64);
const report = { ledgerId: id,providerHash: hash,counterMatches: true,legacyActiveWithoutBinding: false,
  counts: { request_binding: 1 },bindingCount: 1 };
const now = Date.parse('2026-10-16T12:00:00Z');
const job = { ledger_id: id,provider_hash: hash,revision: 'old',status: 'verified',completed_at: new Date(now-1000).toISOString() };
const due = (changes={}) => archiveDue({ report,revision: hash,jobs: [],now,...changes });
test('initial nonempty history is automatic, empty is not',() => {
  expect(due()).toBe('due'); expect(due({ report: { ...report,counts: { request_binding: 0 } } })).toBe('empty');
});
test('daily changes and earlier capacity checks use different minimum intervals',() => {
  expect(due({ jobs: [job] })).toBe('not_due');
  expect(due({ jobs: [job],now: now+ARCHIVE_POLICY.dailyMs })).toBe('due');
  expect(due({ jobs: [job],now: now+ARCHIVE_POLICY.pressureMs,report: { ...report,bindingCount: 80000 } })).toBe('due');
});
test.each(['verified','retired'])('unchanged %s history is not dumped repeatedly',status => {
  expect(due({ jobs: [{ ...job,status,revision: hash }] })).toBe('unchanged');
});
test.each(['exporting','awaiting_verification','interrupted','retiring'])('%s work blocks concurrent jobs',status => {
  expect(due({ jobs: [{ ...job,status }] })).toBe('pending');
});
test('cooldowns and attempts survive restart; new content does not bypass normal schedule',() => {
  const failed = { ...job,status: 'failed',revision: hash,retry_after: new Date(now+300000).toISOString() };
  expect(due({ jobs: [failed] })).toBe('cooldown');
  expect(due({ jobs: [failed],now: now+300000 })).toBe('due');
  expect(due({ jobs: [failed,failed,failed],now: now+9999999 })).toBe('attempts_exhausted');
  expect(due({ jobs: [job,failed],revision: 'changed' })).toBe('not_due');
});
test('identity drift and inconsistent counters fail closed',() => {
  expect(due({ jobs: [{ ...job,ledger_id: 'different' }] })).toBe('identity_changed');
  expect(due({ report: { ...report,counterMatches: false } })).toBe('source_inconsistent');
  expect(due({ report: { ...report,legacyActiveWithoutBinding: true } })).toBe('source_inconsistent');
});
test('policy fingerprint includes retention and stable resource policy',() => {
  expect(archivePolicyHash(90)).toMatch(/^[a-f0-9]{64}$/);
  expect(archivePolicyHash(90)).toBe(archivePolicyHash(90)); expect(archivePolicyHash(91)).not.toBe(archivePolicyHash(90));
});
test('native Date cooldowns retain millisecond precision',() => {
  const failed = { ...job,status: 'failed',revision: hash,retry_after: new Date(now+900) };
  expect(due({ jobs: [failed],now: now+899 })).toBe('cooldown');
  expect(due({ jobs: [failed],now: now+900 })).toBe('due');
});
const content = () => Object.fromEntries(ARCHIVE_TABLES.map(name => [name,{ count: 0,maxId: null,sha256: hash }]));
test('full table proof rejects omissions, invalid IDs, counts and foreign keys',() => {
  expect(validateArchiveContent(content())).toEqual(content());
  for (const invalid of [{}, { ...content(),evil: {} },{ ...content(),admission: { count: -1,maxId: null,sha256: hash } },
    { ...content(),admission: { count: 1,maxId: 'v4',sha256: hash } }]) expect(() => validateArchiveContent(invalid)).toThrow();
});
test('rotation requires identical immutable prefixes; mutable admission may advance',() => {
  const old = content(), next = content(); next.admission.sha256 = 'b'.repeat(64);
  expect(preservesArchiveContent(next,old)).toBe(true);
  next.request_binding.sha256 = 'b'.repeat(64); expect(preservesArchiveContent(next,old)).toBe(false);
});
const receipt = () => ({ version: 1,archiveId: id,manifestSha256: hash,dumpSha256: hash,verified: true,preserves: [],purgeAuthorized: false });
test('receipts are strictly bounded and never authorize deletion',() => {
  expect(validateArchiveReceipt(receipt())).toEqual(receipt());
  expect(validateArchiveReceipt({ ...receipt(),verified: false }).verified).toBe(false);
  for (const invalid of [{ ...receipt(),purgeAuthorized: true },{ ...receipt(),foreign: 'secret' },
    { ...receipt(),preserves: [id,id] },{ ...receipt(),verified: false,preserves: [id] },{ ...receipt(),archiveId: '../escape' }]) {
    expect(() => validateArchiveReceipt(invalid)).toThrow();
  }
});
