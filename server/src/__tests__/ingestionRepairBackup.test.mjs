/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@jest/globals';
import { runRepairBackupChild, createIngestionRepairBackup } from '../services/ingestionRepairBackup.mjs';
import { safeguardEnableSql } from '../services/ingestionSafeguardCatalog.mjs';
test('bounded child drains output without a shell', async () => {
  const chunks = [];
  expect(await runRepairBackupChild(process.execPath, ['-e', "process.stdout.write('archive')"], { onChunk: async chunk => chunks.push(chunk) })).toBe(7);
  expect(Buffer.concat(chunks).toString()).toBe('archive');
});
test('large output, timeout, sink failure and unsuccessful exit reject', async () => {
  for (const [source, options] of [
    ["process.stdout.write('too much')", { maxBytes: 2 }],
    ['setInterval(()=>{},1000)', { timeoutMs: 50 }],
    ["process.stdout.write('x')", { onChunk: async () => { throw new Error('disk full'); } }],
    ['process.exit(2)', {}],
    ["process.stderr.write('sensitive warning');process.stdout.write('x')", {}],
  ]) await expect(runRepairBackupChild(process.execPath, ['-e', source], options)).rejects.toThrow('backup_process_failed');
});
test('cancellation refuses before spawning and unsupported platform has no tools', async () => {
  await expect(runRepairBackupChild('not-a-command', [], { signal: AbortSignal.abort() })).rejects.toThrow('backup_cancelled');
  expect(await createIngestionRepairBackup({ platform: 'win32' }).available()).toBe(false);
  await expect(runRepairBackupChild('classifarr-nonexistent-backup-program', [])).rejects.toThrow('backup_process_failed');
});
test('DDL identifiers cannot come from the caller', () => {
  expect(() => safeguardEnableSql({ table: 'users', trigger: 'ingestion_compatibility_rows', status: 'not_always_enabled' })).toThrow('repair_target_invalid');
});
test('storage failures preserve only a safe code for actionable guidance', async () => {
  await expect(runRepairBackupChild(process.execPath, ['-e', "process.stdout.write('x')"], {
    onChunk: async () => { throw Object.assign(new Error('sensitive storage path'), { code: 'ENOSPC' }); },
  })).rejects.toMatchObject({ message: 'backup_process_failed', code: 'ENOSPC' });
});
