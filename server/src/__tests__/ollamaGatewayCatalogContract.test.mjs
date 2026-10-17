/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { CATALOG_TABLES, validateCatalog } from '../ollamaGateway/catalogContract.mjs';
import { archiveDumpOptions } from '../ollamaGateway/archiveDump.mjs';
import { validateArchiveReceipt } from '../ollamaGateway/onlineArchiveContract.mjs';
const id = '0199ea26-7d80-7000-8000-000000000001';
const sample = () => ({ version: 1,tables: Object.fromEntries(CATALOG_TABLES.map(name => [name,{ count: 1,maxId: id,sha256: 'a'.repeat(64) }])),
  dependencies: { count: 4,bytes: 100,sha256: 'b'.repeat(64) } });
test('catalog is a fixed compact contract, separate from live receipts', () => {
  expect(validateCatalog(sample())).toEqual(sample());
  expect(Buffer.byteLength(JSON.stringify(sample()))).toBeLessThan(65536);
  expect(() => validateArchiveReceipt({ kind: 'catalog_verification',version: 1,rowsRestored: true,runtimeEnabled: false })).toThrow();
});
test.each([
  value => { value.version = 2; }, value => { value.extra = true; }, value => { value.tables.extra = {}; },
  value => { value.tables[CATALOG_TABLES[0]].count = 10001; }, value => { value.tables[CATALOG_TABLES[1]].count = 1001; },
  value => { value.tables[CATALOG_TABLES[2]].count = 1001; }, value => { value.tables[CATALOG_TABLES[0]].count = -1; },
  value => { value.tables[CATALOG_TABLES[0]].maxId = '../escape'; }, value => { value.tables[CATALOG_TABLES[0]].sha256 = 'bad'; },
  value => { value.dependencies.bytes = 1073741825; }, value => { value.dependencies.count = 40001; },
  value => { value.dependencies.bytes = 1.5; }, value => { value.dependencies.sha256 = null; },
  value => { value.tables[CATALOG_TABLES[0]].count = 0; },
])('reject unknown or unbounded catalog contract %#', mutate => {
  const value = sample(); mutate(value); expect(() => validateCatalog(value)).toThrow('gateway_catalog_contract');
});
test('catalog dump selects exactly ten fixed tables with the same snapshot; old mode unchanged', () => {
  const configuration = { database: { host: '/tmp/socket',database: 'synthetic',user: 'reader' },providerHash: 'a'.repeat(64),retentionDays: 90 };
  const args = archiveDumpOptions(configuration,'00000001-000000AB-1',true).args;
  expect(args.filter(value => value.startsWith('--table='))).toHaveLength(10);
  expect(args).toEqual(expect.arrayContaining(CATALOG_TABLES.map(name => `--table=${name}`)));
  expect(args).toContain('--snapshot=00000001-000000AB-1'); expect(args.some(value => value.startsWith('--schema='))).toBe(false);
  expect(archiveDumpOptions(configuration,'00000001-000000AB-1').args).toContain('--schema=ollama_gateway');
});
