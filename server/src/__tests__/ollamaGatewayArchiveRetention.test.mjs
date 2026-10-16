/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { validateRetentionInventory } from '../ollamaGateway/archiveRetentionContract.mjs';
import { validateArchiveManifest } from '../ollamaGateway/archiveContract.mjs';

const uuid = number => `0199ea26-7d80-7000-8000-${number.toString().padStart(12, '0')}`;
const entry = (number = 1) => ({ bindingId: uuid(number), requestId: uuid(number + 1000), attempt: String(number), rowSha256: 'a'.repeat(64) });
const inventory = () => ({ version: 1, ledgerSha256: 'b'.repeat(64), totalCandidates: 1, hasMore: false, entries: [entry()] });

test('valid inventory is bounded, ordered and keeps bigints as exact decimal strings', () => {
  expect(validateRetentionInventory(inventory(), 1)).toEqual(inventory());
  const value = inventory(); value.entries[0].attempt = '9223372036854775807';
  expect(validateRetentionInventory(value, 1)).toEqual(value);
});

test.each([{}, null, { version: 2 }, { extra: true }, { ledgerSha256: 'X'.repeat(64) },
  { entries: [] }, { totalCandidates: 2 }, { hasMore: true }, { entries: [entry(), entry(2)] }])('reject malformed inventory %j', override => {
  const value = override && Object.keys(override).length ? { ...inventory(), ...override } : override;
  expect(() => validateRetentionInventory(value, 1)).toThrow('gateway_archive_inventory_invalid');
});

test.each([{ bindingId: '00000000-0000-4000-8000-000000000001' }, { requestId: '' }, { rowSha256: 'short' },
  { attempt: 1 }, { attempt: '0' }, { attempt: '-1' }, { attempt: '01' }, { attempt: '9223372036854775808' }, { extra: true }])('reject unsafe row identity %j', override => {
  const value = inventory(); value.entries[0] = { ...entry(), ...override };
  expect(() => validateRetentionInventory(value, 1)).toThrow('gateway_archive_inventory_invalid');
});

test.each([
  [entry(2), entry(1)], [entry(1), entry(1)], [entry(1), { ...entry(2), requestId: entry(1).requestId }],
  [entry(1), { ...entry(2), bindingId: entry(1).bindingId }],
])('reject unordered or duplicated references %#', (...entries) => {
  expect(() => validateRetentionInventory({ ...inventory(), entries, totalCandidates: 2 }, 2)).toThrow();
});

test('full bound reports truncation without allowing arbitrary short or oversized inventories', () => {
  const value = { ...inventory(), entries: Array.from({ length: 100 }, (_, i) => entry(i + 1)), totalCandidates: 101, hasMore: true };
  expect(validateRetentionInventory(value, 101)).toEqual(value);
  expect(() => validateRetentionInventory({ ...value, entries: value.entries.slice(1) }, 101)).toThrow();
  expect(() => validateRetentionInventory({ ...value, entries: [...value.entries, entry(101)] }, 101)).toThrow();
  expect(() => validateRetentionInventory({ ...value, totalCandidates: 100001 }, 100001)).toThrow();
  expect(() => validateRetentionInventory(value, -1)).toThrow();
});

test('v2 is strict while legacy v1 remains verifiable', () => {
  const report = { ledgerId: uuid(1), providerHash: 'a'.repeat(64), capturedAt: '2026-10-15T00:00:00.000Z',
    cutoff: '2026-07-17T00:00:00.000Z', retentionDays: 90, attempts: '1', bindingCount: 1,
    counts: { admission: 1, request_binding: 1, completion_receipt: 1, recovery_receipt: 0, provider_stop_intent: 0,
      provider_stop_observation: 0, upstream_peer_observation: 0 },
    categories: { active: 0, lifecycle: 0, unknown: 0, recent: 0, older_terminal_review: 1 },
    counterMatches: true, legacyActiveWithoutBinding: false, purgeAuthorized: false };
  const legacy = { version: 1, schemaVersion: 7, archiveId: uuid(2), report, dump: { name: 'gateway.dump', bytes: 5, sha256: 'c'.repeat(64) } };
  expect(validateArchiveManifest(legacy)).toEqual(legacy);
  const value = { ...legacy, version: 2, retention: inventory() };
  expect(validateArchiveManifest(value)).toEqual(value);
  expect(Buffer.byteLength(JSON.stringify({ ...value, retention: { ...inventory(), entries: Array.from({ length: 100 }, (_, i) => entry(i + 1)) } })))
    .toBeLessThan(65536);
  expect(() => validateArchiveManifest({ ...legacy, retention: inventory() })).toThrow();
  expect(() => validateArchiveManifest({ ...value, version: 3 })).toThrow();
  expect(() => validateArchiveManifest({ ...value, retention: undefined })).toThrow();
});
