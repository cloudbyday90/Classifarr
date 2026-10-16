/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { archiveRevision, archiveAttemptsUsed } from '../ollamaGateway/archiveRevision.mjs';
import { archiveDue } from '../ollamaGateway/archiveSchedule.mjs';
import { ARCHIVE_TABLES } from '../ollamaGateway/archiveTables.mjs';

const admission = '{"attempts": 1}', counts = Object.fromEntries(ARCHIVE_TABLES.map((name, index) => [name, index + 1]));
const legacy = (keys, value = admission, totals = counts) => createHash('sha256').update(value)
  .update(JSON.stringify(Object.fromEntries(keys.map(name => [name, totals[name]])))).digest('hex');

test('canonical identity preserves the old serial encoding regardless of incoming key order', () => {
  const expected = legacy(ARCHIVE_TABLES);
  for (let offset = 0; offset < ARCHIVE_TABLES.length; offset++) {
    const keys = [...ARCHIVE_TABLES.slice(offset), ...ARCHIVE_TABLES.slice(0, offset)].reverse();
    expect(archiveRevision(admission, Object.fromEntries(keys.map(name => [name, counts[name]]))))
      .toEqual({ revision: expected, compatibleRevisions: [expected] });
  }
});

test('legacy aliases require the same admission and counts; duplicates never duplicate attempts', () => {
  const reversed = legacy([...ARCHIVE_TABLES].reverse());
  const rotated = legacy([...ARCHIVE_TABLES.slice(1), ARCHIVE_TABLES[0]]);
  const foreign = [legacy(ARCHIVE_TABLES, '{"attempts": 2}'), legacy(ARCHIVE_TABLES, admission, { ...counts, request_binding: 999 })];
  const result = archiveRevision(admission, counts, [reversed, reversed, rotated, ...foreign]);
  expect(new Set(result.compatibleRevisions)).toEqual(new Set([result.revision, reversed, rotated]));
  expect(result.compatibleRevisions).toHaveLength(3);
});

test('legacy cooldown, unchanged state and exhausted budgets apply to the canonical revision', () => {
  const aliases = archiveRevision(admission, counts, [legacy([...ARCHIVE_TABLES].reverse())]);
  const now = 123456789, report = { ledgerId: 'ledger', providerHash: 'provider', counts, bindingCount: 1, counterMatches: true };
  const failed = { ledger_id: 'ledger', provider_hash: 'provider', revision: aliases.compatibleRevisions[1],
    status: 'failed', attempt: 1, retry_after: new Date(now + 1) };
  const due = jobs => archiveDue({ report, ...aliases, jobs, now });
  expect(due([failed])).toBe('cooldown');
  expect(due([{ ...failed, retry_after: new Date(now) }])).toBe('due');
  expect(due([{ ...failed, status: 'verified' }])).toBe('unchanged');
  expect(due([{ ...failed, status: 'retired' }])).toBe('unchanged');
  expect(due([failed, failed, { ...failed, revision: aliases.revision }])).toBe('attempts_exhausted');
  expect(due([{ ...failed, attempt: 3 }])).toBe('attempts_exhausted');
  expect(archiveAttemptsUsed([])).toBe(0);
});
