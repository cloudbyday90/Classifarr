/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { catalogInventorySummary, validateCatalogRetention } from '../ollamaGateway/catalogRetentionContract.mjs';
import { catalogSample, inventory, syntheticId } from './fixtures/gatewayCatalogRetention.mjs';

test('inventory is canonical, complete and independently hashable', () => {
  const entries = inventory();
  expect(catalogInventorySummary(entries)).toEqual({ count: 3, bytes: 150,
    sha256: createHash('sha256').update(entries.map(entry => JSON.stringify(entry)).join('\n') + '\n').digest('hex') });
  expect(catalogInventorySummary(entries.map(({ id, kind, bytes, sha256 }) => ({ sha256, bytes, kind, id })))).toEqual(catalogInventorySummary(entries));
  const value = catalogSample();
  expect(validateCatalogRetention(value.manifest, value.manifestSha256, value.verification, entries)).toBe(value.manifest);
});

test.each([
  entries => entries.reverse(), entries => entries.slice(1), entries => [...entries, entries[0]],
  entries => [{ ...entries[0], kind: 'catalog' }, ...entries.slice(1)],
  entries => [{ ...entries[0], path: '/private' }, ...entries.slice(1)],
  entries => [{ ...entries[0], bytes: 268435457 }, ...entries.slice(1)],
  entries => [{ ...entries[0], id: '../escape' }, ...entries.slice(1)],
  entries => [{ ...entries[0], bytes: 0 }, ...entries.slice(1)],
  entries => [{ ...entries[0], bytes: 1.5 }, ...entries.slice(1)],
  entries => entries.map(entry => ({ ...entry, sha256: 'invalid' })),
  entries => [...entries, { ...entries[0], id: syntheticId(3), kind: 'protection' }],
  entries => Array.from({ length: 40001 }, () => entries[0]),
])('reject ambiguous/unsafe/incomplete inventory %#', change => {
  expect(() => catalogInventorySummary(change(inventory()))).toThrow();
});

test.each(['rowsRestored', 'dependenciesAvailable', 'runtimeEnabled', 'purgeAuthorized'])('verification flag %s is not interchangeable', field => {
  const value = catalogSample(); value.verification[field] = !value.verification[field];
  expect(() => validateCatalogRetention(value.manifest, value.manifestSha256, value.verification, value.entries)).toThrow();
});

test('root identity, bytes and dependency drift refuse registration', () => {
  for (const change of [value => { value.verification.archiveId = syntheticId(77); }, value => { value.entries[0].bytes++; },
    value => { value.verification.dumpSha256 = 'b'.repeat(64); }, value => { value.verification.extra = true; },
    value => { value.manifestSha256 = 'b'.repeat(64); }, value => { value.manifest.version = 4; }]) {
    const value = catalogSample(); change(value);
    expect(() => validateCatalogRetention(value.manifest, value.manifestSha256, value.verification, value.entries)).toThrow();
  }
});

test('aggregate bytes remain within the original budget, including markers', () => {
  const entries = Array.from({ length: 4 }, (_, n) => inventory(syntheticId(n + 1)).map(entry =>
    ({ ...entry, bytes: entry.kind === 'dump' ? 268435456 : 50 }))).flat();
  expect(() => catalogInventorySummary(entries)).toThrow('gateway_catalog_size_limit');
});
