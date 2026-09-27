/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { seedLegacyRestoreAdmission, RESTORE_ADMISSION_SEED } from '../bootstrap/restoreAdmissionSeed.mjs';

function setup({ applied = false, owned = true, tables = true, failure = false, raced = false } = {}) {
  let markerReads = 0;
  const client = { query: jest.fn(async (sql) => {
    if (sql.includes('to_regclass')) return { rows: tables ? [{ migrations_table: 'migrations', receipts_table: 'receipts' }] : [] };
    if (sql.startsWith('SELECT 1')) return { rows: (applied || (++markerReads === 2 && raced)) ? [{}] : [] };
    if (sql.includes('pg_try')) return { rows: [{ acquired: owned }] };
    return { rows: [] };
  }) };
  const work = jest.fn(async () => { if (failure) throw new Error('migration_failed'); });
  const applyMigration = jest.fn();
  const createRunner = ({ dbClient }) => {
    applyMigration.mockImplementation(async () => dbClient.withTransaction(work));
    return { applyMigration };
  };
  return { client, work, applyMigration, seed: () => seedLegacyRestoreAdmission(client, { createRunner }) };
}
test('uses one fixed migration and commits its work under exclusive ownership', async () => {
  const { client, work, applyMigration, seed } = setup();
  expect(await seed()).toBe(true);
  expect(applyMigration).toHaveBeenCalledWith(RESTORE_ADMISSION_SEED);
  expect(work).toHaveBeenCalledWith(client);
  expect(client.query.mock.calls.map(([sql]) => sql).slice(-2)).toEqual(['COMMIT', 'SELECT pg_advisory_unlock($1)']);
});
test.each([{ applied: true }, { owned: false }, { tables: false }])('does not initialize unsafe state %j', async options => {
  const { work, seed } = setup(options);
  expect(await seed()).toBe(false);
  expect(work).not.toHaveBeenCalled();
});
test('rechecks the ledger under lock, avoiding duplicate work', async () => {
  const { work, seed } = setup({ raced: true });
  expect(await seed()).toBe(true);
  expect(work).not.toHaveBeenCalled();
});
test('rolls back failed seeding and releases exclusive ownership', async () => {
  const { client, seed } = setup({ failure: true });
  await expect(seed()).rejects.toThrow('migration_failed');
  expect(client.query.mock.calls.map(([sql]) => sql).slice(-2)).toEqual(['ROLLBACK', 'SELECT pg_advisory_unlock($1)']);
});
test('seed is snapshot-required, preserves existing rows and refuses historical restore receipts', () => {
  const sql = readFileSync(new URL(`../../../database/migrations/${RESTORE_ADMISSION_SEED}`, import.meta.url), 'utf8');
  expect(sql).toContain('@seed-reconciliation snapshot-required');
  expect(sql).toContain('WHERE NOT EXISTS (SELECT 1 FROM policy_backup_restore_verifications)');
  expect(sql).toContain('ON CONFLICT (gate_id) DO NOTHING');
  expect(sql).not.toMatch(/\b(UPDATE|DELETE|TRUNCATE)\b/);
});
