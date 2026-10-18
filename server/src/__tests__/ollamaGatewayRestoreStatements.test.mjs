/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@jest/globals';
import { ARCHIVE_TABLES } from '../ollamaGateway/archiveTables.mjs';
import { catalogTables } from '../ollamaGateway/catalogContract.mjs';
import { archiveDeletionProbes, catalogGuardStatements, catalogMutationDenialStatements } from '../ollamaGateway/archiveRestoreStatements.mjs';

test('closed statements cover every packaged denial probe without admitting caller identifiers', () => {
  expect(archiveDeletionProbes()).toEqual(ARCHIVE_TABLES.filter(table => table !== 'admission')
    .map(table => `DELETE FROM ollama_gateway.${table} WHERE false`));
  expect(Object.isFrozen(archiveDeletionProbes())).toBe(true);
  for (const version of [1, 2, 3]) {
    const tables = [...ARCHIVE_TABLES.map(table => `ollama_gateway.${table}`), ...catalogTables(version)];
    expect(catalogMutationDenialStatements(version)).toEqual(tables.flatMap(table =>
      [`DELETE FROM ${table} WHERE false`, `UPDATE ${table} SET id=id WHERE false`]));
    expect(Object.isFrozen(catalogMutationDenialStatements(version))).toBe(true);
  }
  for (const version of [undefined, null, 0, 4, '1;DROP SCHEMA public']) {
    expect(() => catalogMutationDenialStatements(version)).toThrow('gateway_catalog_contract');
  }
});

test('only the same five fixed guards can be disabled and reenabled', () => {
  const pairs = [['gateway_archive.protection', 'archive_protection_guard'],
    ['gateway_archive.protection', 'archive_protection_fence'], ['gateway_archive.protection', 'protection_cleanup_exclusion'],
    ['gateway_archive.job', 'archive_job_protection_guard'], ['gateway_archive.job', 'archive_cleanup_exclusion']];
  for (const enable of [false, true]) {
    expect(catalogGuardStatements(enable)).toEqual(pairs.map(([table, trigger]) =>
      `ALTER TABLE ${table} ${enable ? 'ENABLE' : 'DISABLE'} TRIGGER ${trigger}`));
    expect(Object.isFrozen(catalogGuardStatements(enable))).toBe(true);
  }
  for (const value of [null, undefined, 0, 1, 'ENABLE']) expect(() => catalogGuardStatements(value)).toThrow('gateway_archive_restore_contract');
});
